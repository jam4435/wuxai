/**
 * 用户设定脚本 - 事件处理和 Persona 操作
 */

import {
  CompatibilityCheckItem,
  CompatibilityCheckReport,
  PERSONA_TRAIT_SEPARATOR,
  PersonaActivationState,
  PersonaAdvancedConfig,
  PersonaAutoRule,
  PersonaInfo,
  PersonaProfile,
  PersonaRuntimeContext,
  PersonaSnapshot,
  PersonaTrait,
} from './types';

declare const toastr: any;
declare function triggerSlash(command: string): Promise<string>;

const PERSONA_ADVANCED_CONFIG_VERSION = 1;
const SNAPSHOT_MAX_COUNT = 30;
const SNAPSHOT_MIN_INTERVAL_MS = 4000;
const PERSONA_SCRIPT_STORE_VERSION = 1;
const PERSONA_SCRIPT_STORE_PERSONA_NAME = '设定';
const PERSONA_SCRIPT_STORE_MARKER = '[TH-PERSONA-SCRIPT-STORE-V1]';
const PERSONA_SCRIPT_STORE_FLUSH_DEBOUNCE_MS = 1200;
const PERSONA_SCRIPT_STORE_CREATE_RETRY_INTERVAL_MS = 15000;

type PersonaScriptStore = {
  version: number;
  traitsByAvatar: Record<string, PersonaTrait[]>;
  baseDescriptionByAvatar: Record<string, string>;
  advancedConfigByAvatar: Record<string, PersonaAdvancedConfig>;
  snapshotsByAvatar: Record<string, PersonaSnapshot[]>;
  updatedAt: number;
};

let personaScriptStoreCache: PersonaScriptStore | null = null;
let personaScriptStoreFlushTimer: ReturnType<typeof setTimeout> | null = null;
let personaScriptStoreFlushInProgress = false;
let personaScriptStoreFlushQueued = false;
let personaScriptStoreMissingPersonaWarned = false;
let personaScriptStoreCreateInProgress = false;
let personaScriptStoreLastCreateAttemptAt = 0;

function createId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getParentDoc(): Document {
  return window.parent.document;
}

function ensureString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function ensureStringLike(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function normalizeDescription(description: string): string {
  return description.replace(/\r\n/g, '\n').trim();
}

function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeUtf8Base64(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ==================== Persona 数据获取函数 ====================

/**
 * 从前端 DOM 获取所有已存在的 Persona 列表
 */
export function getPersonaListFromDOM(): PersonaInfo[] {
  const parentDoc = getParentDoc();
  const personas: PersonaInfo[] = [];
  const $avatarBlock = $('#user_avatar_block', parentDoc);

  if ($avatarBlock.length === 0) {
    console.warn('用户设定脚本: 找不到 #user_avatar_block 容器');
    return personas;
  }

  $avatarBlock.find('.avatar-container').each(function () {
    const $container = $(this);
    const avatarId = $container.attr('data-avatar-id') || '';
    const name = $container.find('.ch_name').text().trim();

    const $descriptionElement = $container.find('.ch_description');
    let description = $descriptionElement.text().trim();
    description = description.replace(/ +/g, ' ').trim();

    const isDefault = $container.hasClass('default_persona');
    const isSelected = $container.hasClass('selected');
    const $lockedToChatBtn = $container.find('.locked_to_chat_label');
    const $lockedToCharBtn = $container.find('.locked_to_character_label');
    const isLockedToChat = $lockedToChatBtn.length > 0 && !$lockedToChatBtn.hasClass('disabled');
    const isLockedToCharacter = $lockedToCharBtn.length > 0 && !$lockedToCharBtn.hasClass('disabled');

    personas.push({
      name,
      description: description || undefined,
      avatarId,
      isDefault,
      isSelected,
      isLockedToChat,
      isLockedToCharacter,
    });
  });

  return personas;
}

/**
 * 获取当前选中的 Persona
 */
export function getCurrentPersonaFromDOM(): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => p.isSelected) || null;
}

/**
 * 根据 avatarId 查找 Persona
 */
export function findPersonaByAvatarId(avatarId: string): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => p.avatarId === avatarId) || null;
}

/**
 * 根据名称查找 Persona
 * @deprecated 建议使用 findPersonaByAvatarId
 */
export function findPersonaByName(name: string): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => p.name === name) || null;
}

/**
 * 获取默认用户人设
 */
export function getDefaultPersona(): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => p.isDefault) || null;
}

// ==================== UI 辅助函数 ====================

/**
 * 获取输入框中的 Persona 名称
 */
export function getInputPersonaName(): string {
  const parentDoc = getParentDoc();
  return ($('#persona-name-input', parentDoc).val() as string | undefined)?.trim() || '';
}

/**
 * 更新当前 Persona 显示
 */
export async function updateCurrentPersonaDisplay(): Promise<void> {
  const parentDoc = getParentDoc();
  const $display = $('#current-persona-name', parentDoc);
  try {
    const currentPersona = getCurrentPersonaFromDOM();
    if (currentPersona) {
      $display.text(currentPersona.name || '未设置');
    } else {
      $display.text('未设置');
    }
  } catch (error) {
    console.error('用户设定脚本: 获取当前 Persona 失败', error);
    $display.text('获取失败');
  }
}

// ==================== Persona 操作处理函数 ====================

/**
 * 切换 Persona
 */
export async function handleSwitchPersona(): Promise<void> {
  const name = getInputPersonaName();
  if (!name) {
    toastr.warning('请输入要切换的角色名称');
    return;
  }
  try {
    await triggerSlash(`/persona ${name}`);
    toastr.success(`已切换到角色: ${name}`);
    await updateCurrentPersonaDisplay();
  } catch (error) {
    console.error('用户设定脚本: 切换 Persona 失败', error);
    toastr.error('切换失败，请检查角色名称是否正确');
  }
}

/**
 * 临时切换 Persona
 */
export async function handleTempSwitchPersona(): Promise<void> {
  const name = getInputPersonaName();
  if (!name) {
    toastr.warning('请输入要临时使用的名称');
    return;
  }
  try {
    await triggerSlash(`/persona mode=temp ${name}`);
    toastr.success(`已临时切换到: ${name}`);
    await updateCurrentPersonaDisplay();
  } catch (error) {
    console.error('用户设定脚本: 临时切换 Persona 失败', error);
    toastr.error('临时切换失败');
  }
}

/**
 * 锁定到当前聊天
 */
export async function handleLockToChat(): Promise<void> {
  try {
    await triggerSlash('/persona-lock type=chat on');
    toastr.success('已锁定到当前聊天');
  } catch (error) {
    console.error('用户设定脚本: 锁定到聊天失败', error);
    toastr.error('锁定失败');
  }
}

/**
 * 锁定到当前角色
 */
export async function handleLockToCharacter(): Promise<void> {
  try {
    await triggerSlash('/persona-lock type=character on');
    toastr.success('已锁定到当前角色');
  } catch (error) {
    console.error('用户设定脚本: 锁定到角色失败', error);
    toastr.error('锁定失败');
  }
}

/**
 * 解除锁定
 */
export async function handleUnlock(): Promise<void> {
  try {
    await triggerSlash('/persona-lock type=none');
    toastr.success('已解除锁定');
  } catch (error) {
    console.error('用户设定脚本: 解除锁定失败', error);
    toastr.error('解除锁定失败');
  }
}

/**
 * 同步消息到当前 Persona
 */
export async function handleSyncMessages(): Promise<void> {
  try {
    await triggerSlash('/persona-sync');
    toastr.success('已同步所有消息到当前角色');
  } catch (error) {
    console.error('用户设定脚本: 同步消息失败', error);
    toastr.error('同步失败');
  }
}

/**
 * 在父 UI 中通过点击事件选中指定的 Persona
 */
export async function selectPersonaInParentUI(avatarId: string): Promise<boolean> {
  console.log(`用户设定脚本: 尝试在主界面中选中 Persona (avatarId: ${avatarId})`);
  const parentDoc = getParentDoc();
  const $personaCard = $(`#user_avatar_block .avatar-container[data-avatar-id="${avatarId}"]`, parentDoc);

  if ($personaCard.length === 0) {
    console.error(`用户设定脚本: 在主界面中找不到 avatarId 为 ${avatarId} 的 Persona 卡片`);
    toastr.error('在主界面找不到对应的 Persona 卡片');
    return false;
  }

  if (!$personaCard.hasClass('selected')) {
    $personaCard.trigger('click');
    await new Promise(resolve => setTimeout(resolve, 120));

    if (!$personaCard.hasClass('selected')) {
      console.error(`用户设定脚本: 点击后，Persona (avatarId: ${avatarId}) 仍未选中`);
      toastr.error('切换 Persona 失败，无法继续保存');
      return false;
    }
  }

  return true;
}

/**
 * 保存 Persona 信息
 */
export async function savePersona(originalAvatarId: string, newName: string, newDescription: string): Promise<boolean> {
  try {
    const parentDoc = getParentDoc();

    const selectionSuccess = await selectPersonaInParentUI(originalAvatarId);
    if (!selectionSuccess) {
      return false;
    }

    savePersonaBaseDescription(originalAvatarId, newDescription);
    recordPersonaSnapshot(originalAvatarId, '手动保存 Persona', newDescription);

    const fullDescription = await composePersonaDescription(originalAvatarId, newDescription);

    const $personaDescription = $('#persona_description', parentDoc);
    if ($personaDescription.length > 0) {
      $personaDescription.val(fullDescription).trigger('input').trigger('blur');
    } else {
      console.warn('用户设定脚本: 找不到 #persona_description 元素');
    }

    const $personaName = $('#your_name', parentDoc);
    const currentName = $personaName.text().trim();

    if (newName !== currentName) {
      const $renameBtn = $('#persona_rename_button', parentDoc);
      if ($renameBtn.length > 0) {
        $renameBtn.trigger('click');
        await handlePersonaRenameModal(newName);
      } else {
        console.warn('用户设定脚本: 找不到重命名按钮，跳过名称更新');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 400));
    toastr.success(`Persona "${newName}" 已成功保存`);
    return true;
  } catch (error) {
    console.error('用户设定脚本: 保存 Persona 时发生意外错误', error);
    toastr.error('保存过程中发生意外错误');
    return false;
  }
}

async function handlePersonaRenameModal(newName: string): Promise<boolean> {
  const parentDoc = getParentDoc();
  await new Promise(resolve => setTimeout(resolve, 300));

  const $modalInput = $('.popup .wide100p input[type="text"]', parentDoc);
  if ($modalInput.length > 0) {
    $modalInput.val(newName).trigger('input');
    const $confirmBtn = $('.popup-menu_buttons .menu_button:contains("OK")', parentDoc);
    if ($confirmBtn.length > 0) {
      $confirmBtn.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 300));
      return true;
    }
  }
  return false;
}

// ==================== 角色设定存储管理 ====================

function getDefaultScriptStore(): PersonaScriptStore {
  return {
    version: PERSONA_SCRIPT_STORE_VERSION,
    traitsByAvatar: {},
    baseDescriptionByAvatar: {},
    advancedConfigByAvatar: {},
    snapshotsByAvatar: {},
    updatedAt: Date.now(),
  };
}

function getScriptStorePersona(): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => ensureString(p.name).trim() === PERSONA_SCRIPT_STORE_PERSONA_NAME) || null;
}

async function createScriptStorePersonaViaDOM(): Promise<PersonaInfo | null> {
  const parentDoc = getParentDoc();
  const currentAvatarId = getCurrentPersonaFromDOM()?.avatarId || '';
  const avatarIdsBefore = new Set(
    getPersonaListFromDOM()
      .map(p => ensureString(p.avatarId).trim())
      .filter(Boolean),
  );

  let $createBtn = $('#create_dummy_persona', parentDoc).first();
  if ($createBtn.length === 0) {
    const $personaManagerToggle = $('.drawer-icon.fa-face-smile', parentDoc).first();
    if ($personaManagerToggle.length > 0) {
      $personaManagerToggle.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 180));
      $createBtn = $('#create_dummy_persona', parentDoc).first();
    }
  }

  if ($createBtn.length === 0) {
    console.warn(`用户设定脚本: 找不到 #create_dummy_persona，无法自动创建「${PERSONA_SCRIPT_STORE_PERSONA_NAME}」Persona`);
    return null;
  }

  $createBtn.trigger('click');
  await new Promise(resolve => setTimeout(resolve, 260));

  const personasAfterCreate = getPersonaListFromDOM();
  let createdPersona =
    personasAfterCreate.find(p => p.avatarId && !avatarIdsBefore.has(ensureString(p.avatarId).trim())) ||
    personasAfterCreate.find(p => p.isSelected) ||
    null;

  if (!createdPersona?.avatarId) {
    console.warn(`用户设定脚本: 点击创建后未识别到新 Persona，无法自动创建「${PERSONA_SCRIPT_STORE_PERSONA_NAME}」`);
    return null;
  }

  if (!createdPersona.isSelected) {
    const selected = await selectPersonaInParentUI(createdPersona.avatarId);
    if (!selected) {
      return null;
    }
    createdPersona = findPersonaByAvatarId(createdPersona.avatarId);
  }

  if (ensureString(createdPersona?.name).trim() !== PERSONA_SCRIPT_STORE_PERSONA_NAME) {
    const $renameBtn = $('#persona_rename_button', parentDoc);
    if ($renameBtn.length === 0) {
      console.warn('用户设定脚本: 找不到 #persona_rename_button，无法自动重命名新 Persona');
    } else {
      $renameBtn.trigger('click');
      await handlePersonaRenameModal(PERSONA_SCRIPT_STORE_PERSONA_NAME);
      await new Promise(resolve => setTimeout(resolve, 220));
    }
  }

  const storePersona = getScriptStorePersona();
  if (!storePersona?.avatarId) {
    console.warn(`用户设定脚本: 自动创建后仍未找到「${PERSONA_SCRIPT_STORE_PERSONA_NAME}」Persona，请手动检查`);
    if (currentAvatarId) {
      await selectPersonaInParentUI(currentAvatarId);
    }
    return null;
  }

  console.info(`用户设定脚本: 已自动创建脚本存储 Persona「${PERSONA_SCRIPT_STORE_PERSONA_NAME}」`, {
    avatarId: storePersona.avatarId,
  });

  if (currentAvatarId && currentAvatarId !== storePersona.avatarId) {
    await selectPersonaInParentUI(currentAvatarId);
  }

  return storePersona;
}

async function ensureScriptStorePersona(): Promise<PersonaInfo | null> {
  const existing = getScriptStorePersona();
  if (existing?.avatarId) {
    return existing;
  }

  if (personaScriptStoreCreateInProgress) {
    return null;
  }

  const now = Date.now();
  if (now - personaScriptStoreLastCreateAttemptAt < PERSONA_SCRIPT_STORE_CREATE_RETRY_INTERVAL_MS) {
    return null;
  }
  personaScriptStoreLastCreateAttemptAt = now;
  personaScriptStoreCreateInProgress = true;

  try {
    const created = await createScriptStorePersonaViaDOM();
    if (created?.avatarId) {
      personaScriptStoreMissingPersonaWarned = false;
      return created;
    }
    return null;
  } finally {
    personaScriptStoreCreateInProgress = false;
  }
}

function serializeScriptStore(store: PersonaScriptStore): string {
  const json = JSON.stringify(store);
  return `${PERSONA_SCRIPT_STORE_MARKER}\n${encodeUtf8Base64(json)}`;
}

function parseScriptStoreFromDescription(description: string): PersonaScriptStore | null {
  const text = ensureString(description).trim();
  if (!text) {
    return null;
  }

  const markerIndex = text.indexOf(PERSONA_SCRIPT_STORE_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  const payload = text.slice(markerIndex + PERSONA_SCRIPT_STORE_MARKER.length).trim();
  if (!payload) {
    return null;
  }

  try {
    const json = decodeUtf8Base64(payload);
    const parsed = JSON.parse(json);
    return normalizeScriptStore(parsed);
  } catch (error) {
    console.error('用户设定脚本: 解析“设定”Persona 存储失败', error);
    return null;
  }
}

function normalizeScriptStore(raw: unknown): PersonaScriptStore {
  const base = getDefaultScriptStore();
  const parsed = safeRecord(raw);
  const traitsByAvatarRaw = safeRecord(parsed.traitsByAvatar);
  const baseDescriptionByAvatarRaw = safeRecord(parsed.baseDescriptionByAvatar);
  const advancedConfigByAvatarRaw = safeRecord(parsed.advancedConfigByAvatar);
  const snapshotsByAvatarRaw = safeRecord(parsed.snapshotsByAvatar);

  const traitsByAvatar: Record<string, PersonaTrait[]> = {};
  for (const [avatarId, value] of Object.entries(traitsByAvatarRaw)) {
    traitsByAvatar[avatarId] = safeArray<PersonaTrait>(value).map(trait => ({
      id: ensureString(trait.id),
      name: ensureString(trait.name) || '未命名设定',
      description: ensureString(trait.description),
      enabled: Boolean(trait.enabled),
      createdAt: typeof trait.createdAt === 'number' ? trait.createdAt : Date.now(),
      updatedAt: typeof trait.updatedAt === 'number' ? trait.updatedAt : Date.now(),
    }));
  }

  const baseDescriptionByAvatar: Record<string, string> = {};
  for (const [avatarId, value] of Object.entries(baseDescriptionByAvatarRaw)) {
    baseDescriptionByAvatar[avatarId] = normalizeDescription(ensureString(value));
  }

  const advancedConfigByAvatar: Record<string, PersonaAdvancedConfig> = {};
  for (const [avatarId, value] of Object.entries(advancedConfigByAvatarRaw)) {
    const config = safeRecord(value);
    const profiles = normalizeProfiles(safeArray<PersonaProfile>(config.profiles));
    const rules = normalizeRules(safeArray<PersonaAutoRule>(config.rules));
    const profileIds = new Set(profiles.map(p => p.id));
    const activeProfileId = ensureString(config.activeProfileId);
    advancedConfigByAvatar[avatarId] = {
      version: PERSONA_ADVANCED_CONFIG_VERSION,
      activeProfileId: activeProfileId && profileIds.has(activeProfileId) ? activeProfileId : '',
      profiles,
      rules,
      updatedAt: typeof config.updatedAt === 'number' ? config.updatedAt : Date.now(),
    };
  }

  const snapshotsByAvatar: Record<string, PersonaSnapshot[]> = {};
  for (const [avatarId, value] of Object.entries(snapshotsByAvatarRaw)) {
    snapshotsByAvatar[avatarId] = safeArray<PersonaSnapshot>(value);
  }

  return {
    version: typeof parsed.version === 'number' ? parsed.version : PERSONA_SCRIPT_STORE_VERSION,
    traitsByAvatar,
    baseDescriptionByAvatar,
    advancedConfigByAvatar,
    snapshotsByAvatar,
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
  };
}

function ensureScriptStoreLoaded(): PersonaScriptStore {
  if (personaScriptStoreCache) {
    return personaScriptStoreCache;
  }

  const storePersona = getScriptStorePersona();
  if (storePersona?.description) {
    const parsed = parseScriptStoreFromDescription(storePersona.description);
    if (parsed) {
      personaScriptStoreCache = parsed;
      return personaScriptStoreCache;
    }
  }

  personaScriptStoreCache = getDefaultScriptStore();
  return personaScriptStoreCache;
}

export async function ensureScriptStorePersonaReady(): Promise<boolean> {
  ensureScriptStoreLoaded();
  const storePersona = await ensureScriptStorePersona();
  if (!storePersona?.avatarId) {
    return false;
  }

  if (!parseScriptStoreFromDescription(storePersona.description || '')) {
    markScriptStoreDirty();
  }
  return true;
}

async function flushScriptStoreToPersona(): Promise<void> {
  if (!personaScriptStoreCache) {
    return;
  }
  if (personaScriptStoreFlushInProgress) {
    personaScriptStoreFlushQueued = true;
    return;
  }

  personaScriptStoreFlushInProgress = true;
  try {
    const currentAvatarId = getCurrentPersonaFromDOM()?.avatarId || '';
    const storePersona = await ensureScriptStorePersona();
    if (!storePersona?.avatarId) {
      if (!personaScriptStoreMissingPersonaWarned) {
        personaScriptStoreMissingPersonaWarned = true;
        console.warn(`用户设定脚本: 找不到名为「${PERSONA_SCRIPT_STORE_PERSONA_NAME}」的 Persona，无法持久化脚本设定`);
      }
      return;
    }

    const parentDoc = getParentDoc();
    const payload = serializeScriptStore(personaScriptStoreCache);

    const selected = await selectPersonaInParentUI(storePersona.avatarId);
    if (!selected) {
      console.warn('用户设定脚本: 无法切换到“设定”Persona，跳过持久化');
      return;
    }

    const $personaDescription = $('#persona_description', parentDoc);
    if ($personaDescription.length > 0) {
      const currentDescription = ensureString(($personaDescription.val() as string | undefined) || '');
      if (currentDescription.trim() !== payload.trim()) {
        $personaDescription.val(payload).trigger('input').trigger('blur');
      }
    }

    if (currentAvatarId && currentAvatarId !== storePersona.avatarId) {
      await selectPersonaInParentUI(currentAvatarId);
    }
  } catch (error) {
    console.error('用户设定脚本: 持久化到“设定”Persona 失败', error);
  } finally {
    personaScriptStoreFlushInProgress = false;
    if (personaScriptStoreFlushQueued) {
      personaScriptStoreFlushQueued = false;
      void flushScriptStoreToPersona();
    }
  }
}

function markScriptStoreDirty(): void {
  const store = ensureScriptStoreLoaded();
  store.updatedAt = Date.now();
  if (personaScriptStoreFlushTimer) {
    clearTimeout(personaScriptStoreFlushTimer);
  }
  personaScriptStoreFlushTimer = setTimeout(() => {
    personaScriptStoreFlushTimer = null;
    void flushScriptStoreToPersona();
  }, PERSONA_SCRIPT_STORE_FLUSH_DEBOUNCE_MS);
}

export function loadPersonaTraits(avatarId: string): PersonaTrait[] {
  const store = ensureScriptStoreLoaded();
  return deepClone(store.traitsByAvatar[avatarId] || []);
}

export function savePersonaTraits(avatarId: string, traits: PersonaTrait[]): boolean {
  const store = ensureScriptStoreLoaded();
  store.traitsByAvatar[avatarId] = deepClone(traits);
  markScriptStoreDirty();
  return true;
}

// ==================== 基础描述存储 ====================

export function extractBaseDescriptionFromComposed(description: string): string {
  const normalized = normalizeDescription(description);
  const markerIndex = normalized.indexOf(PERSONA_TRAIT_SEPARATOR);
  if (markerIndex === -1) {
    return normalized;
  }
  return normalized.slice(0, markerIndex).trim();
}

export function loadPersonaBaseDescription(avatarId: string, fallbackDescription: string = ''): string {
  const store = ensureScriptStoreLoaded();
  const cached = store.baseDescriptionByAvatar[avatarId];
  if (typeof cached === 'string') {
    return cached;
  }

  const extracted = extractBaseDescriptionFromComposed(fallbackDescription);
  if (avatarId) {
    savePersonaBaseDescription(avatarId, extracted);
  }
  return extracted;
}

export function savePersonaBaseDescription(avatarId: string, baseDescription: string): boolean {
  const store = ensureScriptStoreLoaded();
  store.baseDescriptionByAvatar[avatarId] = normalizeDescription(baseDescription);
  markScriptStoreDirty();
  return true;
}

// ==================== 高级配置（Profile + Rule） ====================

function getDefaultAdvancedConfig(): PersonaAdvancedConfig {
  return {
    version: PERSONA_ADVANCED_CONFIG_VERSION,
    activeProfileId: '',
    profiles: [],
    rules: [],
    updatedAt: Date.now(),
  };
}

function normalizeProfiles(profiles: PersonaProfile[]): PersonaProfile[] {
  return profiles.map(profile => ({
    id: ensureString(profile.id) || createId(),
    name: ensureString(profile.name) || '未命名预设',
    traitIds: safeArray<string>(profile.traitIds).filter(Boolean),
    createdAt: typeof profile.createdAt === 'number' ? profile.createdAt : Date.now(),
    updatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : Date.now(),
  }));
}

function normalizeRules(rules: PersonaAutoRule[]): PersonaAutoRule[] {
  return rules.map(rule => ({
    id: ensureString(rule.id) || createId(),
    name: ensureString(rule.name) || '未命名规则',
    enabled: Boolean(rule.enabled),
    scope: rule.scope === 'character' ? 'character' : 'chat',
    matchMode: rule.matchMode === 'equals' || rule.matchMode === 'regex' ? rule.matchMode : 'includes',
    pattern: ensureString(rule.pattern),
    traitIds: safeArray<string>(rule.traitIds).filter(Boolean),
    profileIds: safeArray<string>(rule.profileIds).filter(Boolean),
    profileId: ensureString(rule.profileId) || undefined,
    createdAt: typeof rule.createdAt === 'number' ? rule.createdAt : Date.now(),
    updatedAt: typeof rule.updatedAt === 'number' ? rule.updatedAt : Date.now(),
  }));
}

export function loadPersonaAdvancedConfig(avatarId: string): PersonaAdvancedConfig {
  const defaultConfig = getDefaultAdvancedConfig();
  if (!avatarId) {
    return defaultConfig;
  }
  const store = ensureScriptStoreLoaded();
  const config = store.advancedConfigByAvatar[avatarId];
  if (!config) {
    return defaultConfig;
  }
  return deepClone(config);
}

export function savePersonaAdvancedConfig(avatarId: string, config: PersonaAdvancedConfig): boolean {
  if (!avatarId) {
    return false;
  }

  const safeConfig: PersonaAdvancedConfig = {
    version: PERSONA_ADVANCED_CONFIG_VERSION,
    activeProfileId: ensureString(config.activeProfileId),
    profiles: normalizeProfiles(config.profiles),
    rules: normalizeRules(config.rules),
    updatedAt: Date.now(),
  };
  const store = ensureScriptStoreLoaded();
  store.advancedConfigByAvatar[avatarId] = deepClone(safeConfig);
  markScriptStoreDirty();
  return true;
}

export function loadPersonaProfiles(avatarId: string): PersonaProfile[] {
  return loadPersonaAdvancedConfig(avatarId).profiles;
}

export function savePersonaProfiles(avatarId: string, profiles: PersonaProfile[]): boolean {
  const config = loadPersonaAdvancedConfig(avatarId);
  config.profiles = profiles;
  const validIds = new Set(profiles.map(p => p.id));
  if (config.activeProfileId && !validIds.has(config.activeProfileId)) {
    config.activeProfileId = '';
  }
  return savePersonaAdvancedConfig(avatarId, config);
}

export function loadPersonaRules(avatarId: string): PersonaAutoRule[] {
  return loadPersonaAdvancedConfig(avatarId).rules;
}

export function savePersonaRules(avatarId: string, rules: PersonaAutoRule[]): boolean {
  const config = loadPersonaAdvancedConfig(avatarId);
  config.rules = rules;
  return savePersonaAdvancedConfig(avatarId, config);
}

export function getActiveProfileId(avatarId: string): string {
  return loadPersonaAdvancedConfig(avatarId).activeProfileId || '';
}

export function setActiveProfileId(avatarId: string, profileId: string): boolean {
  const config = loadPersonaAdvancedConfig(avatarId);
  const validProfileIds = new Set(config.profiles.map(p => p.id));
  config.activeProfileId = profileId && validProfileIds.has(profileId) ? profileId : '';
  return savePersonaAdvancedConfig(avatarId, config);
}

// ==================== 规则匹配和激活计算 ====================

function getFirstTextBySelector(selectors: string[], doc: Document): string {
  for (const selector of selectors) {
    const text = $(selector, doc).first().text().trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function getFirstAttrBySelector(selectors: string[], attr: string, doc: Document): string {
  for (const selector of selectors) {
    const value = $(selector, doc).first().attr(attr);
    if (value) {
      return value;
    }
  }
  return '';
}

type RuntimeContextDebugInfo = {
  context: PersonaRuntimeContext;
  source: {
    chatId: string;
    chatName: string;
    characterId: string;
    characterName: string;
  };
};

function resolveRuntimeContextDebugInfo(): RuntimeContextDebugInfo {
  const parentDoc = getParentDoc();
  const parentWindow = window.parent as unknown as Record<string, unknown>;
  const maybeSillyTavern = (parentWindow.SillyTavern || (window as unknown as Record<string, unknown>).SillyTavern) as
    | undefined
    | {
        getCurrentChatId?: () => string | number;
        getContext?: () => Record<string, unknown>;
      };

  let chatId = '';
  let chatName = '';
  let characterId = '';
  let characterName = '';
  let domChatFilename = '';
  let chatIdSource = 'unknown';
  let chatNameSource = 'unknown';
  let characterIdSource = 'unknown';
  let characterNameSource = 'unknown';

  try {
    if (maybeSillyTavern?.getCurrentChatId) {
      const id = maybeSillyTavern.getCurrentChatId();
      const value = id !== undefined && id !== null ? String(id) : '';
      if (value) {
        chatId = value;
        chatIdSource = 'sillytavern.getCurrentChatId';
      }
    }

    const ctx = maybeSillyTavern?.getContext?.() || {};
    const ctxChatId = ensureStringLike(ctx.chatId) || ensureStringLike(ctx.chat_id);
    const ctxChatFile = ensureStringLike(ctx.chatFile);
    const ctxCharacterId =
      ensureStringLike(ctx.characterId) || ensureStringLike(ctx.chid) || ensureStringLike(ctx.this_chid);
    const ctxCharacterName = ensureStringLike(ctx.characterName) || ensureStringLike(ctx.name2);
    const ctxGroupId = ensureStringLike(ctx.groupId);

    domChatFilename = getFirstTextBySelector(
      [
        '.select_chat_block.selected .select_chat_block_filename.select_chat_block_filename_item',
        '.select_chat_block.active .select_chat_block_filename.select_chat_block_filename_item',
        '.select_chat_block_filename.select_chat_block_filename_item',
      ],
      parentDoc,
    );

    // 优先使用前端可见的 chat 文件名，便于绑定规则可读且稳定
    if (domChatFilename) {
      chatId = domChatFilename;
      chatIdSource = 'dom.select_chat_block_filename';
    } else if (!chatId && ctxChatId) {
      chatId = ctxChatId;
      chatIdSource = 'sillytavern.context.chatId/chat_id';
    } else if (!chatId && ctxChatFile) {
      chatId = ctxChatFile;
      chatIdSource = 'sillytavern.context.chatFile';
    }

    if (ctxCharacterId) {
      characterId = ctxCharacterId;
      characterIdSource = 'sillytavern.context.characterId/chid/this_chid';
    } else if (ctxGroupId) {
      characterId = `group:${ctxGroupId}`;
      characterIdSource = 'sillytavern.context.groupId';
    }

    if (ctxCharacterName) {
      characterName = ctxCharacterName;
      characterNameSource = 'sillytavern.context.characterName/name2';
    }
  } catch (error) {
    console.warn('用户设定脚本: 获取 SillyTavern 上下文失败', error);
  }

  if (!chatName) {
    chatName = getFirstTextBySelector(
      [
        '#select_chat option:selected',
        '#chat_select option:selected',
        '#chat_name',
        '.chat_name',
        '#chat_header .name_text',
      ],
      parentDoc,
    );
    if (chatName) {
      chatNameSource = 'dom.chat_selectors';
    }
  }
  if (!chatName && domChatFilename) {
    chatName = domChatFilename;
    chatNameSource = 'dom.select_chat_block_filename';
  }

  if (!characterName) {
    characterName = getFirstTextBySelector(
      ['#rm_print_characters_block .character_select.selected .ch_name', '#character_name_pole', '#rm_info_block .ch_name'],
      parentDoc,
    );
    if (characterName) {
      characterNameSource = 'dom.character_name_selectors';
    }
  }

  if (!characterId) {
    characterId = getFirstAttrBySelector(['#rm_print_characters_block .character_select.selected'], 'data-chid', parentDoc);
    if (characterId) {
      characterIdSource = 'dom.selected_character_data_chid';
    }
  }

  if (!chatIdSource || chatIdSource === 'unknown') {
    chatIdSource = 'not_found';
  }
  if (!chatNameSource || chatNameSource === 'unknown') {
    chatNameSource = 'not_found';
  }
  if (!characterIdSource || characterIdSource === 'unknown') {
    characterIdSource = 'not_found';
  }
  if (!characterNameSource || characterNameSource === 'unknown') {
    characterNameSource = 'not_found';
  }

  return {
    context: {
      chatId,
      chatName,
      characterId,
      characterName,
    },
    source: {
      chatId: chatIdSource,
      chatName: chatNameSource,
      characterId: characterIdSource,
      characterName: characterNameSource,
    },
  };
}

export function getRuntimeContext(): PersonaRuntimeContext {
  return resolveRuntimeContextDebugInfo().context;
}

export function getRuntimeContextDebugInfo(): RuntimeContextDebugInfo {
  return resolveRuntimeContextDebugInfo();
}

function isRuleMatched(rule: PersonaAutoRule, context: PersonaRuntimeContext): boolean {
  if (!rule.enabled || !rule.pattern.trim()) {
    return false;
  }

  const target =
    rule.scope === 'character'
      ? `${context.characterId} ${context.characterName}`.trim()
      : `${context.chatId} ${context.chatName}`.trim();
  const source = target.toLowerCase();
  const pattern = rule.pattern.trim();

  if (!source) {
    return false;
  }

  switch (rule.matchMode) {
    case 'equals':
      return source === pattern.toLowerCase();
    case 'regex':
      try {
        return new RegExp(pattern, 'i').test(target);
      } catch (error) {
        console.warn(`用户设定脚本: 规则正则无效 "${rule.name}" -> ${pattern}`, error);
        return false;
      }
    case 'includes':
    default:
      return source.includes(pattern.toLowerCase());
  }
}

export function getPersonaActivationState(avatarId: string, context: PersonaRuntimeContext = getRuntimeContext()): PersonaActivationState {
  const traits = loadPersonaTraits(avatarId);
  const config = loadPersonaAdvancedConfig(avatarId);
  const traitById = new Map(traits.map(t => [t.id, t]));
  const profileById = new Map(config.profiles.map(p => [p.id, p]));

  const matchedRuleIds: string[] = [];
  const activeProfileIds = new Set<string>();
  const effectiveTraitIds = new Set<string>();

  for (const trait of traits) {
    if (trait.enabled) {
      effectiveTraitIds.add(trait.id);
    }
  }

  if (config.activeProfileId && profileById.has(config.activeProfileId)) {
    activeProfileIds.add(config.activeProfileId);
  }

  for (const rule of config.rules) {
    if (!isRuleMatched(rule, context)) {
      continue;
    }
    matchedRuleIds.push(rule.id);
    for (const profileId of rule.profileIds) {
      if (profileById.has(profileId)) {
        activeProfileIds.add(profileId);
      }
    }
    for (const traitId of rule.traitIds) {
      if (traitById.has(traitId)) {
        effectiveTraitIds.add(traitId);
      }
    }
  }

  for (const profileId of activeProfileIds) {
    const profile = profileById.get(profileId);
    if (!profile) {
      continue;
    }
    for (const traitId of profile.traitIds) {
      if (traitById.has(traitId)) {
        effectiveTraitIds.add(traitId);
      }
    }
  }

  return {
    effectiveTraitIds: Array.from(effectiveTraitIds),
    activeProfileIds: Array.from(activeProfileIds),
    matchedRuleIds,
  };
}

function buildComposedDescription(baseDescription: string, lines: string[]): string {
  const base = normalizeDescription(baseDescription);
  if (lines.length === 0) {
    return base;
  }
  if (!base) {
    return `${PERSONA_TRAIT_SEPARATOR}\n${lines.join('\n')}`;
  }
  return `${base}\n\n${PERSONA_TRAIT_SEPARATOR}\n${lines.join('\n')}`;
}

// ==================== 描述拼装逻辑 ====================

/**
 * 拼装最终的用户描述（基础描述 + 生效设定）
 */
export async function composePersonaDescription(avatarId: string, baseDescription: string): Promise<string> {
  const traits = loadPersonaTraits(avatarId);
  if (traits.length === 0) {
    return normalizeDescription(baseDescription);
  }

  const activation = getPersonaActivationState(avatarId);
  const enabledTraitIdSet = new Set(activation.effectiveTraitIds);

  const traitLines = traits
    .filter(trait => enabledTraitIdSet.has(trait.id))
    .map(trait => trait.description.trim())
    .filter(Boolean)
    .map(desc => `- ${desc}`);

  return buildComposedDescription(baseDescription, traitLines);
}

/**
 * 获取当前应用的完整描述
 */
export async function getCurrentPersonaFullDescription(): Promise<string> {
  const currentPersona = getCurrentPersonaFromDOM();
  if (!currentPersona || !currentPersona.avatarId) {
    return '';
  }
  const fallbackDescription = currentPersona.description || '';
  const baseDescription = loadPersonaBaseDescription(currentPersona.avatarId, fallbackDescription);
  return composePersonaDescription(currentPersona.avatarId, baseDescription);
}

// ==================== 变更保护（快照） ====================

export function loadPersonaSnapshots(avatarId: string): PersonaSnapshot[] {
  const store = ensureScriptStoreLoaded();
  return deepClone(store.snapshotsByAvatar[avatarId] || []);
}

function savePersonaSnapshots(avatarId: string, snapshots: PersonaSnapshot[]): boolean {
  const store = ensureScriptStoreLoaded();
  store.snapshotsByAvatar[avatarId] = deepClone(snapshots);
  markScriptStoreDirty();
  return true;
}

/**
 * 记录当前 Persona 的快照，用于回滚
 */
export function recordPersonaSnapshot(avatarId: string, reason: string, fallbackBaseDescription: string = ''): boolean {
  if (!avatarId) {
    return false;
  }

  const parentDoc = getParentDoc();
  const currentPersona = findPersonaByAvatarId(avatarId);
  const personaDescriptionInput = ($('#persona_description', parentDoc).val() as string | undefined) || '';
  const currentDescription = normalizeDescription(currentPersona?.description || personaDescriptionInput || '');
  const baseDescription = loadPersonaBaseDescription(avatarId, fallbackBaseDescription || currentDescription);
  const traits = loadPersonaTraits(avatarId);
  const config = loadPersonaAdvancedConfig(avatarId);
  const snapshots = loadPersonaSnapshots(avatarId);
  const lastSnapshot = snapshots[snapshots.length - 1];
  const now = Date.now();

  if (lastSnapshot) {
    const sameState = lastSnapshot.description === currentDescription && lastSnapshot.baseDescription === baseDescription;
    if (sameState) {
      return false;
    }
    if (now - lastSnapshot.timestamp < SNAPSHOT_MIN_INTERVAL_MS && lastSnapshot.reason === reason) {
      return false;
    }
  }

  const snapshot: PersonaSnapshot = {
    id: createId(),
    timestamp: now,
    reason,
    description: currentDescription,
    baseDescription,
    traits: deepClone(traits),
    config: deepClone(config),
  };

  snapshots.push(snapshot);
  while (snapshots.length > SNAPSHOT_MAX_COUNT) {
    snapshots.shift();
  }

  return savePersonaSnapshots(avatarId, snapshots);
}

/**
 * 回滚到最近一次快照
 */
export function restoreLastPersonaSnapshot(avatarId: string): PersonaSnapshot | null {
  if (!avatarId) {
    return null;
  }

  const snapshots = loadPersonaSnapshots(avatarId);
  if (snapshots.length === 0) {
    return null;
  }

  const lastSnapshot = snapshots.pop() || null;
  if (!lastSnapshot) {
    return null;
  }

  savePersonaTraits(avatarId, lastSnapshot.traits);
  savePersonaAdvancedConfig(avatarId, lastSnapshot.config);
  savePersonaBaseDescription(avatarId, lastSnapshot.baseDescription);
  savePersonaSnapshots(avatarId, snapshots);

  return lastSnapshot;
}

// ==================== 兼容性自检 ====================

function createCheck(key: string, ok: boolean, required: boolean, message: string): CompatibilityCheckItem {
  return { key, ok, required, message };
}

export function runCompatibilitySelfCheck(): CompatibilityCheckReport {
  const parentDoc = getParentDoc();
  const checks: CompatibilityCheckItem[] = [];

  checks.push(createCheck('jquery', typeof $ !== 'undefined', true, '$ (jQuery) 可用'));
  checks.push(createCheck('parent_document', Boolean(parentDoc), true, '可访问父页面 document'));
  checks.push(createCheck('extensions_menu', $('#extensionsMenu', parentDoc).length > 0, true, '扩展菜单 #extensionsMenu 存在'));
  checks.push(createCheck('persona_list', $('#user_avatar_block', parentDoc).length > 0, true, 'Persona 列表 #user_avatar_block 存在'));
  checks.push(createCheck('trigger_slash', typeof triggerSlash === 'function', true, 'triggerSlash 可用'));
  checks.push(createCheck('persona_description', $('#persona_description', parentDoc).length > 0, false, '可访问 #persona_description（用于同步描述）'));
  checks.push(createCheck('rename_button', $('#persona_rename_button', parentDoc).length > 0, false, '可访问 #persona_rename_button（用于改名）'));

  return {
    ok: checks.every(item => (item.required ? item.ok : true)),
    checkedAt: Date.now(),
    items: checks,
  };
}
