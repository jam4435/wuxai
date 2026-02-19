/**
 * 用户设定脚本 - UI 创建和面板控制
 */

import { createScriptIdDiv, destroyScriptIdDiv, deteleportStyle, teleportStyle } from '../util/script';
import {
  extractBaseDescriptionFromComposed,
  findPersonaByAvatarId,
  getCurrentPersonaFromDOM,
  getPersonaActivationState,
  getPersonaListFromDOM,
  getRuntimeContext,
  handleLockToCharacter,
  handleLockToChat,
  handleSyncMessages,
  handleUnlock,
  loadPersonaAdvancedConfig,
  loadPersonaBaseDescription,
  loadPersonaRules,
  loadPersonaSnapshots,
  loadPersonaTraits,
  recordPersonaSnapshot,
  restoreLastPersonaSnapshot,
  runCompatibilitySelfCheck,
  savePersonaAdvancedConfig,
  savePersonaBaseDescription,
  savePersonaRules,
  savePersonaTraits,
  selectPersonaInParentUI,
  setActiveProfileId,
  updateCurrentPersonaDisplay,
  composePersonaDescription,
} from './handlers';
import {
  CompatibilityCheckReport,
  PERSONA_BUTTON_ICON,
  PERSONA_BUTTON_ID,
  PERSONA_BUTTON_TEXT_IN_MENU,
  PERSONA_BUTTON_TOOLTIP,
  PERSONA_PANEL_ID,
  PersonaAutoRule,
  PersonaInfo,
  PersonaProfile,
  PersonaTrait,
} from './types';
import { injectStyles, styles } from './styles';

const PANEL_EVENT_NAMESPACE = '.persona-panel-events';
let contextWatcherTimer: ReturnType<typeof setInterval> | null = null;
let lastContextSignature = '';
let baseDescDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastCompatibilityReport: CompatibilityCheckReport | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  const hh = `${d.getHours()}`.padStart(2, '0');
  const min = `${d.getMinutes()}`.padStart(2, '0');
  const ss = `${d.getSeconds()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function buildContextSignature(): string {
  const context = getRuntimeContext();
  return `${context.chatId}|${context.chatName}|${context.characterId}|${context.characterName}`;
}

function getEditingAvatarId(): string {
  const parentDoc = window.parent.document;
  return ($('#edit-persona-avatar', parentDoc).val() as string | undefined) || '';
}

function createPanelHtml(): string {
  return `
    <div class="persona-overlay" id="persona-overlay"></div>
    <div id="${PERSONA_PANEL_ID}">
      <div class="persona-header">
        <h2>
          <span>👤 用户设定管理</span>
          <span class="close-btn" id="persona-close-btn">×</span>
        </h2>
        <div class="persona-status-bar">
          <span class="status-label">当前角色:</span>
          <span class="status-value" id="current-persona-name">加载中...</span>
          <span class="compat-status-mini" id="persona-compat-mini-status">自检中...</span>
        </div>
      </div>

      <div class="persona-global-actions">
        <div class="global-actions-title">
          <span class="global-actions-icon">👑</span>
          <span class="global-actions-label">当前用户人设绑定</span>
        </div>
        <div class="global-actions-buttons">
          <button class="persona-btn global-action-btn" id="persona-lock-chat-btn" title="锁定到当前聊天">🔒 锁定到聊天</button>
          <button class="persona-btn global-action-btn" id="persona-lock-char-btn" title="锁定到当前角色">🔗 锁定到角色</button>
          <button class="persona-btn global-action-btn" id="persona-unlock-btn" title="解除锁定">🔓 解除锁定</button>
          <button class="persona-btn global-action-btn" id="persona-sync-btn" title="同步历史消息">🔄 同步消息</button>
        </div>
      </div>

      <div class="persona-content-wrapper">
        <div class="persona-tab-content active">
          <div class="persona-list-panel">
            <div class="panel-title">角色列表</div>
            <div id="persona-list-container" class="persona-list-container"></div>
            <div class="list-actions">
              <button class="persona-btn small" id="persona-refresh-btn" title="刷新列表">🔄 刷新</button>
            </div>
          </div>

          <div class="persona-edit-panel">
            <div class="panel-title">角色详情</div>

            <div class="edit-form">
              <input type="hidden" id="edit-persona-original-name">
              <input type="hidden" id="edit-persona-avatar">
              <input type="hidden" id="edit-persona-base-desc">

              <div class="form-group">
                <label for="edit-persona-name">名称</label>
                <input type="text" class="persona-input" id="edit-persona-name" placeholder="角色名称">
              </div>

              <div class="form-group">
                <label for="edit-persona-desc">基础设定（自动规则和预设会追加到最终描述）</label>
                <textarea class="persona-textarea" id="edit-persona-desc" placeholder="输入角色基础设定..."></textarea>
                <div class="persona-hint-row">
                  <span id="persona-auto-status">自动拼装状态: -</span>
                </div>
              </div>
            </div>

            <hr class="persona-divider">

            <div class="persona-traits-section">
              <div class="panel-title">
                <span>📂 条目与文件夹</span>
                <div class="inline-actions">
                  <button class="persona-btn small" id="persona-folder-add-btn" title="添加条目文件夹">📁 添加文件夹</button>
                  <button class="persona-btn small" id="persona-trait-add-btn" title="添加新设定">➕ 添加条目</button>
                </div>
              </div>
              <div id="persona-traits-container" class="persona-traits-container"></div>
            </div>

            <hr class="persona-divider">

            <div class="persona-snapshot-section">
              <div class="panel-title">
                <span>🛡️ 变更保护</span>
              </div>
              <div id="persona-snapshot-info" class="text-note">快照: 0</div>
              <div class="profile-toolbar">
                <button class="persona-btn small" id="persona-rollback-btn">↩️ 回滚上一版</button>
                <button class="persona-btn small" id="persona-snapshot-list-btn">📜 查看快照</button>
              </div>
            </div>

            <hr class="persona-divider">

            <div class="persona-compat-section">
              <div class="panel-title">
                <span>🔍 兼容性自检</span>
                <button class="persona-btn small" id="persona-compat-refresh-btn">🔄 重新检测</button>
              </div>
              <div id="persona-compat-summary" class="text-note">未检测</div>
              <div id="persona-compat-details" class="persona-compat-details"></div>
            </div>
          </div>
        </div>
      </div>

      <input type="hidden" id="persona-name-input">
    </div>
  `;
}

function createPersonaItemHtml(persona: PersonaInfo): string {
  const activeClass = persona.isSelected ? 'active' : '';
  const lockIcon = persona.isLockedToChat ? '🔒' : persona.isLockedToCharacter ? '🔗' : '';
  const defaultBadge = persona.isDefault ? '<span class="persona-default-badge">👑</span>' : '';
  const avatarSrc = persona.avatarId ? `/thumbnail?type=persona&file=${encodeURIComponent(persona.avatarId)}` : '';
  const defaultBadgeClass = persona.isDefault ? 'has-default-badge' : '';
  const safeName = escapeHtml(persona.name || '未命名');
  const safeDesc = escapeHtml(persona.description ? `${persona.description.slice(0, 24)}...` : '无描述');

  return `
    <div class="persona-list-item ${activeClass}" data-avatar-id="${escapeHtml(persona.avatarId || '')}">
      <div class="item-avatar-wrapper ${defaultBadgeClass}">
        ${persona.isDefault ? '<div class="default-avatar-ring"></div>' : ''}
        <img class="item-avatar" src="${avatarSrc}" alt="${safeName}" onerror="this.src='/public/logo.png'">
      </div>
      <div class="item-info">
        <div class="item-name">${safeName} ${lockIcon} ${defaultBadge}</div>
        <div class="item-desc">${safeDesc}</div>
      </div>
    </div>
  `;
}

function createPersonaTraitHtml(trait: PersonaTrait, effectiveTraitIds: Set<string>): string {
  const isManualEnabled = trait.enabled;
  const isEffectiveEnabled = effectiveTraitIds.has(trait.id);
  const isAutoEnabled = isEffectiveEnabled && !isManualEnabled;
  const enabledClass = isEffectiveEnabled ? 'enabled' : 'disabled';
  const stateTag = isAutoEnabled
    ? '<span class="state-tag auto">自动</span>'
    : isManualEnabled
      ? '<span class="state-tag manual">手动</span>'
      : '<span class="state-tag off">关闭</span>';
  const safeName = escapeHtml(trait.name);
  const safeDesc = escapeHtml(trait.description || '').slice(0, 80) || '无描述';

  return `
    <div class="persona-trait-item ${enabledClass}" data-id="${escapeHtml(trait.id)}">
      <div class="trait-item-main">
        <div class="trait-item-header">
          <div class="trait-item-name">${safeName}</div>
          <div class="trait-item-state">
            ${stateTag}
            <input type="checkbox" class="trait-toggle-checkbox" ${isManualEnabled ? 'checked' : ''} title="手动启用/禁用">
          </div>
        </div>
        <div class="trait-item-desc">${safeDesc}</div>
      </div>
      <div class="trait-item-actions">
        <button class="trait-btn edit" data-id="${escapeHtml(trait.id)}" title="编辑">✏️</button>
        <button class="trait-btn delete" data-id="${escapeHtml(trait.id)}" title="删除">🗑️</button>
      </div>
    </div>
  `;
}

function findFolderRule(config: ReturnType<typeof loadPersonaAdvancedConfig>, profileId: string): PersonaAutoRule | null {
  return (
    config.rules.find(rule => rule.profileId === profileId) ||
    config.rules.find(
      rule => rule.profileIds.length === 1 && rule.profileIds[0] === profileId && rule.traitIds.length === 0,
    ) ||
    null
  );
}

function createProfileFolderHtml(
  profile: PersonaProfile,
  folderRule: PersonaAutoRule | null,
  isManualActive: boolean,
  isAutoActive: boolean,
): string {
  const safeName = escapeHtml(profile.name);
  const modeTag = isManualActive
    ? '<span class="state-tag manual">手动激活</span>'
    : isAutoActive
      ? '<span class="state-tag auto">规则激活</span>'
      : '<span class="state-tag off">未激活</span>';
  const ruleText = folderRule?.enabled
    ? `自动规则: ${folderRule.scope}/${folderRule.matchMode} "${escapeHtml(folderRule.pattern)}"`
    : '自动规则: 未启用';

  return `
    <div class="persona-folder-item" data-profile-id="${escapeHtml(profile.id)}">
      <div class="trait-item-main">
        <div class="trait-item-header">
          <div class="trait-item-name">📁 ${safeName}</div>
          <div class="trait-item-state">
            ${modeTag}
            <label class="folder-toggle-wrap">
              <input type="checkbox" class="folder-active-checkbox" ${isManualActive ? 'checked' : ''}>
              手动
            </label>
          </div>
        </div>
        <div class="trait-item-desc">${ruleText} | 条目数: ${profile.traitIds.length}</div>
      </div>
      <div class="trait-item-actions">
        <button class="trait-btn edit folder-btn" data-action="edit">✏️</button>
        <button class="trait-btn delete folder-btn" data-action="delete">🗑️</button>
      </div>
    </div>
  `;
}

// ==================== 面板控制函数 ====================

export function showPanel(): void {
  const parentDoc = window.parent.document;

  teleportStyle();

  const $container = createScriptIdDiv();
  $container.html(createPanelHtml());
  $('body', parentDoc).append($container);

  bindPanelEvents();
  void renderPersonaList();
  void updateCurrentPersonaDisplay();
  refreshCompatibilitySection();
  lastContextSignature = buildContextSignature();

  console.log('用户设定脚本: 面板已显示');
}

export function hidePanel(): void {
  const parentDoc = window.parent.document;
  const $button = $(`#${PERSONA_BUTTON_ID}`, parentDoc);

  destroyScriptIdDiv();
  deteleportStyle();

  if ($button.length) {
    $button.removeClass('active');
  }
}

export function togglePanel(): void {
  const parentDoc = window.parent.document;
  const $panel = $(`#${PERSONA_PANEL_ID}`, parentDoc);
  const $button = $(`#${PERSONA_BUTTON_ID}`, parentDoc);

  if ($panel.length > 0) {
    hidePanel();
    if ($button.length) {
      $button.removeClass('active');
    }
  } else {
    showPanel();
    if ($button.length) {
      $button.addClass('active');
    }
  }
}

async function renderPersonaList(): Promise<void> {
  const parentDoc = window.parent.document;
  const listContainer = $('#persona-list-container', parentDoc);
  const personas = getPersonaListFromDOM();

  listContainer.empty();

  if (personas.length === 0) {
    listContainer.html('<div class="empty-list">未找到角色信息</div>');
    return;
  }

  personas.forEach(persona => listContainer.append(createPersonaItemHtml(persona)));

  $('.persona-list-item', listContainer)
    .off(`click${PANEL_EVENT_NAMESPACE}`)
    .on(`click${PANEL_EVENT_NAMESPACE}`, async function () {
      const avatarId = ($(this).attr('data-avatar-id') || '').trim();
      const persona = findPersonaByAvatarId(avatarId);
      if (!persona || !avatarId) {
        return;
      }

      if (!persona.isSelected) {
        const switched = await selectPersonaInParentUI(avatarId);
        if (!switched) {
          return;
        }
      }

      $('.persona-list-item', listContainer).removeClass('active');
      $(`.persona-list-item[data-avatar-id="${avatarId}"]`, listContainer).addClass('active');

      await updateCurrentPersonaDisplay();
      await selectPersonaForEdit(avatarId);
    });

  const current = personas.find(p => p.isSelected);
  if (current?.avatarId) {
    await selectPersonaForEdit(current.avatarId);
    $(`.persona-list-item[data-avatar-id="${current.avatarId}"]`, listContainer).addClass('active');
  } else if (personas[0]?.avatarId) {
    await selectPersonaForEdit(personas[0].avatarId);
    $(`.persona-list-item[data-avatar-id="${personas[0].avatarId}"]`, listContainer).addClass('active');
  }
}

async function selectPersonaForEdit(avatarId: string): Promise<void> {
  const parentDoc = window.parent.document;
  const persona = findPersonaByAvatarId(avatarId);
  if (!persona || !avatarId) {
    return;
  }

  const fallbackDescription = persona.description || '';
  const baseDescription = loadPersonaBaseDescription(avatarId, extractBaseDescriptionFromComposed(fallbackDescription));

  $('#edit-persona-name', parentDoc).val(persona.name);
  $('#edit-persona-desc', parentDoc).val(baseDescription);
  $('#edit-persona-base-desc', parentDoc).val(baseDescription);
  $('#edit-persona-original-name', parentDoc).val(persona.name);
  $('#edit-persona-avatar', parentDoc).val(avatarId);
  $('#persona-name-input', parentDoc).val(persona.name);

  renderPersonaTraits(avatarId);
  renderProfileSection(avatarId);
  renderRulesSection(avatarId);
  renderSnapshotSection(avatarId);
  await applyComposedDescriptionForAvatar(avatarId, '切换角色编辑时同步描述');
}

function renderPersonaTraits(avatarId: string): void {
  const parentDoc = window.parent.document;
  const container = $('#persona-traits-container', parentDoc);
  if (!container.length) {
    return;
  }

  const traits = loadPersonaTraits(avatarId);
  const activation = getPersonaActivationState(avatarId);
  const effectiveTraitIds = new Set(activation.effectiveTraitIds);

  container.empty();
  if (traits.length === 0) {
    container.html('<div class="empty-list">暂无设定条目</div>');
  } else {
    traits.forEach(trait => container.append(createPersonaTraitHtml(trait, effectiveTraitIds)));
  }

  updateAutoStatusText(avatarId);
}

function renderProfileSection(avatarId: string): void {
  const parentDoc = window.parent.document;
  const $select = $('#persona-profile-select', parentDoc);
  const $summary = $('#persona-profile-summary', parentDoc);

  const config = loadPersonaAdvancedConfig(avatarId);
  const traits = loadPersonaTraits(avatarId);
  const traitNameMap = new Map(traits.map(t => [t.id, t.name]));
  const activation = getPersonaActivationState(avatarId);

  $select.empty();
  $select.append('<option value="">(不激活手动 Profile)</option>');
  for (const profile of config.profiles) {
    const selected = config.activeProfileId === profile.id ? 'selected' : '';
    $select.append(`<option value="${escapeHtml(profile.id)}" ${selected}>${escapeHtml(profile.name)}</option>`);
  }

  if (config.profiles.length === 0) {
    $summary.text('暂无预设');
    return;
  }

  const manualProfile = config.profiles.find(p => p.id === config.activeProfileId);
  const activeProfiles = config.profiles.filter(p => activation.activeProfileIds.includes(p.id));
  const activeNames = activeProfiles.map(p => p.name).join('、') || '无';
  const manualName = manualProfile ? manualProfile.name : '无';

  const firstProfile = manualProfile || config.profiles[0];
  const traitPreview =
    firstProfile?.traitIds.map(id => traitNameMap.get(id) || id).slice(0, 6).join('、') ||
    '该预设没有绑定 trait';

  $summary.html(
    `手动激活: <b>${escapeHtml(manualName)}</b> | 当前生效: <b>${escapeHtml(activeNames)}</b><br>示例条目: ${escapeHtml(traitPreview)}`,
  );
}

function renderRulesSection(avatarId: string): void {
  const parentDoc = window.parent.document;
  const container = $('#persona-rules-container', parentDoc);
  const rules = loadPersonaRules(avatarId);

  container.empty();
  if (rules.length === 0) {
    container.html('<div class="empty-list">暂无自动规则</div>');
    return;
  }

  rules.forEach(rule => container.append(createRuleHtml(rule)));
}

function renderSnapshotSection(avatarId: string): void {
  const parentDoc = window.parent.document;
  const snapshots = loadPersonaSnapshots(avatarId);
  const $info = $('#persona-snapshot-info', parentDoc);

  if (snapshots.length === 0) {
    $info.text('快照: 0');
    return;
  }

  const latest = snapshots[snapshots.length - 1];
  $info.text(`快照: ${snapshots.length} | 最近: ${formatTime(latest.timestamp)} (${latest.reason})`);
}

function renderCompatibilitySection(report: CompatibilityCheckReport): void {
  const parentDoc = window.parent.document;
  const $summary = $('#persona-compat-summary', parentDoc);
  const $details = $('#persona-compat-details', parentDoc);
  const $miniStatus = $('#persona-compat-mini-status', parentDoc);

  const statusText = report.ok ? '通过' : '存在兼容性风险';
  $summary.text(`状态: ${statusText} | 检测时间: ${formatTime(report.checkedAt)}`);
  $miniStatus
    .text(`自检: ${statusText}`)
    .toggleClass('ok', report.ok)
    .toggleClass('warn', !report.ok);

  $details.empty();
  report.items.forEach(item => {
    const icon = item.ok ? '✅' : item.required ? '❌' : '⚠️';
    const level = item.ok ? 'ok' : item.required ? 'danger' : 'warn';
    $details.append(`<div class="compat-item ${level}">${icon} ${escapeHtml(item.message)}</div>`);
  });
}

function refreshCompatibilitySection(): void {
  const report = runCompatibilitySelfCheck();
  lastCompatibilityReport = report;
  renderCompatibilitySection(report);
  if (!report.ok) {
    toastr.warning('检测到兼容性风险，部分功能可能不可用');
  }
}

async function applyComposedDescriptionForAvatar(avatarId: string, reason: string): Promise<void> {
  if (!avatarId) {
    return;
  }
  const parentDoc = window.parent.document;
  const currentEditingAvatarId = getEditingAvatarId();

  let baseDescription = '';
  if (currentEditingAvatarId === avatarId) {
    baseDescription = ($('#edit-persona-base-desc', parentDoc).val() as string | undefined) || '';
  } else {
    const persona = findPersonaByAvatarId(avatarId);
    baseDescription = loadPersonaBaseDescription(avatarId, persona?.description || '');
  }

  savePersonaBaseDescription(avatarId, baseDescription);
  const composed = await composePersonaDescription(avatarId, baseDescription);
  await syncDescriptionToTavern(avatarId, composed, reason);
  updateAutoStatusText(avatarId);
}

function updateAutoStatusText(avatarId: string): void {
  const parentDoc = window.parent.document;
  const $status = $('#persona-auto-status', parentDoc);
  if (!$status.length || !avatarId) {
    return;
  }
  const activation = getPersonaActivationState(avatarId);
  const totalTraits = loadPersonaTraits(avatarId).length;
  $status.text(
    `自动拼装状态: 生效 trait ${activation.effectiveTraitIds.length}/${totalTraits}，生效 profile ${activation.activeProfileIds.length}，命中规则 ${activation.matchedRuleIds.length}`,
  );
}

async function syncDescriptionToTavern(avatarId: string, description: string, reason: string): Promise<void> {
  const parentDoc = window.parent.document;
  const $personaDescription = $('#persona_description', parentDoc);
  if ($personaDescription.length === 0) {
    return;
  }

  const nextValue = description.replace(/\r\n/g, '\n').trim();
  const currentValue = (($personaDescription.val() as string | undefined) || '').replace(/\r\n/g, '\n').trim();

  if (nextValue === currentValue) {
    return;
  }

  const baseDescription = ($('#edit-persona-base-desc', parentDoc).val() as string | undefined) || '';
  recordPersonaSnapshot(avatarId, reason, baseDescription);
  $personaDescription.val(nextValue).trigger('input').trigger('blur');
}

// ==================== 角色设定管理 ====================

async function addPersonaTrait(avatarId: string): Promise<void> {
  const traits = loadPersonaTraits(avatarId);
  const now = Date.now();

  const newTrait: PersonaTrait = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    name: '新设定',
    description: '',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  recordPersonaSnapshot(avatarId, '新增 trait');
  traits.push(newTrait);
  if (savePersonaTraits(avatarId, traits)) {
    renderPersonaTraits(avatarId);
    await editPersonaTrait(avatarId, newTrait.id);
    await applyComposedDescriptionForAvatar(avatarId, '新增 trait 后自动同步');
    renderSnapshotSection(avatarId);
    toastr.success('设定已添加');
  }
}

async function togglePersonaTrait(avatarId: string, traitId: string, enabled: boolean): Promise<void> {
  const traits = loadPersonaTraits(avatarId);
  const index = traits.findIndex(t => t.id === traitId);
  if (index === -1) {
    return;
  }

  recordPersonaSnapshot(avatarId, `切换 trait: ${traits[index].name}`);
  traits[index].enabled = enabled;
  traits[index].updatedAt = Date.now();

  if (savePersonaTraits(avatarId, traits)) {
    renderPersonaTraits(avatarId);
    await applyComposedDescriptionForAvatar(avatarId, '切换 trait 后自动同步');
    renderSnapshotSection(avatarId);
  }
}

async function editPersonaTrait(avatarId: string, traitId: string): Promise<void> {
  const traits = loadPersonaTraits(avatarId);
  const trait = traits.find(t => t.id === traitId);
  if (!trait) {
    toastr.error('找不到指定的设定');
    return;
  }

  const modalHtml = `
    <div class="pool-edit-modal">
      <div class="pool-edit-content">
        <h3>编辑设定</h3>
        <div class="form-group">
          <label>名称</label>
          <input type="text" class="persona-input" id="trait-edit-name" value="${escapeHtml(trait.name)}">
        </div>
        <div class="form-group">
          <label>描述（将拼接到人设描述中）</label>
          <textarea class="persona-textarea" id="trait-edit-desc" rows="10">${escapeHtml(trait.description)}</textarea>
        </div>
        <div class="edit-actions-bar">
          <button class="persona-btn" id="trait-edit-save">💾 保存</button>
          <button class="persona-btn" id="trait-edit-close">✖ 关闭</button>
        </div>
      </div>
      <div class="pool-edit-overlay"></div>
    </div>
  `;

  const parentDoc = window.parent.document;
  const $modal = $(modalHtml).appendTo($('body', parentDoc));

  const closeModal = () => {
    $modal.remove();
  };

  $('#trait-edit-close', $modal).on('click', closeModal);
  $('.pool-edit-overlay', $modal).on('click', closeModal);

  $('#trait-edit-save', $modal).on('click', async () => {
    const newName = ($('#trait-edit-name', $modal).val() as string | undefined)?.trim() || trait.name;
    const newDesc = ($('#trait-edit-desc', $modal).val() as string | undefined) || '';
    const index = traits.findIndex(t => t.id === traitId);
    if (index === -1) {
      closeModal();
      return;
    }

    recordPersonaSnapshot(avatarId, `编辑 trait: ${traits[index].name}`);
    traits[index].name = newName;
    traits[index].description = newDesc;
    traits[index].updatedAt = Date.now();
    savePersonaTraits(avatarId, traits);
    renderPersonaTraits(avatarId);
    await applyComposedDescriptionForAvatar(avatarId, '编辑 trait 后自动同步');
    renderSnapshotSection(avatarId);
    toastr.success('设定已保存');
    closeModal();
  });
}

async function deletePersonaTrait(avatarId: string, traitId: string): Promise<void> {
  const traits = loadPersonaTraits(avatarId);
  const target = traits.find(t => t.id === traitId);
  if (!target) {
    return;
  }

  recordPersonaSnapshot(avatarId, `删除 trait: ${target.name}`);
  const filtered = traits.filter(t => t.id !== traitId);
  if (savePersonaTraits(avatarId, filtered)) {
    const config = loadPersonaAdvancedConfig(avatarId);
    config.profiles = config.profiles.map(profile => ({
      ...profile,
      traitIds: profile.traitIds.filter(id => id !== traitId),
      updatedAt: Date.now(),
    }));
    config.rules = config.rules.map(rule => ({
      ...rule,
      traitIds: rule.traitIds.filter(id => id !== traitId),
      updatedAt: Date.now(),
    }));
    savePersonaAdvancedConfig(avatarId, config);

    renderPersonaTraits(avatarId);
    renderProfileSection(avatarId);
    renderRulesSection(avatarId);
    await applyComposedDescriptionForAvatar(avatarId, '删除 trait 后自动同步');
    renderSnapshotSection(avatarId);
    toastr.success('设定已删除');
  }
}

// ==================== Profile 管理 ====================

async function upsertProfile(avatarId: string, existingProfile?: PersonaProfile): Promise<void> {
  const parentDoc = window.parent.document;
  const traits = loadPersonaTraits(avatarId);

  if (traits.length === 0) {
    toastr.warning('请先创建至少一个 trait 再设置 Profile');
    return;
  }

  const title = existingProfile ? '编辑 Profile' : '新建 Profile';
  const selectedIds = new Set(existingProfile?.traitIds || []);
  const traitCheckboxes = traits
    .map(
      trait => `
      <label class="inline-check-row">
        <input type="checkbox" class="profile-trait-checkbox" value="${escapeHtml(trait.id)}" ${selectedIds.has(trait.id) ? 'checked' : ''}>
        <span>${escapeHtml(trait.name)}</span>
      </label>
    `,
    )
    .join('');

  const modalHtml = `
    <div class="pool-edit-modal">
      <div class="pool-edit-content">
        <h3>${title}</h3>
        <div class="form-group">
          <label>名称</label>
          <input type="text" class="persona-input" id="profile-edit-name" value="${escapeHtml(existingProfile?.name || '')}">
        </div>
        <div class="form-group">
          <label>包含的 trait</label>
          <div class="checkbox-list">${traitCheckboxes}</div>
        </div>
        <div class="edit-actions-bar">
          <button class="persona-btn" id="profile-save-btn">💾 保存</button>
          <button class="persona-btn" id="profile-close-btn">✖ 关闭</button>
        </div>
      </div>
      <div class="pool-edit-overlay"></div>
    </div>
  `;

  const $modal = $(modalHtml).appendTo($('body', parentDoc));
  const closeModal = () => $modal.remove();
  $('#profile-close-btn', $modal).on('click', closeModal);
  $('.pool-edit-overlay', $modal).on('click', closeModal);

  $('#profile-save-btn', $modal).on('click', async () => {
    const config = loadPersonaAdvancedConfig(avatarId);
    const name = ($('#profile-edit-name', $modal).val() as string | undefined)?.trim();
    if (!name) {
      toastr.warning('请输入 Profile 名称');
      return;
    }

    const traitIds = $('.profile-trait-checkbox:checked', $modal)
      .map((_, el) => ($(el).val() as string | undefined) || '')
      .get()
      .filter(Boolean);

    if (traitIds.length === 0) {
      toastr.warning('至少选择一个 trait');
      return;
    }

    if (existingProfile) {
      recordPersonaSnapshot(avatarId, `编辑 profile: ${existingProfile.name}`);
      const index = config.profiles.findIndex(p => p.id === existingProfile.id);
      if (index !== -1) {
        config.profiles[index] = {
          ...config.profiles[index],
          name,
          traitIds,
          updatedAt: Date.now(),
        };
      }
    } else {
      recordPersonaSnapshot(avatarId, '新增 profile');
      config.profiles.push({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
        name,
        traitIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    savePersonaAdvancedConfig(avatarId, config);
    renderProfileSection(avatarId);
    renderRulesSection(avatarId);
    renderSnapshotSection(avatarId);
    await applyComposedDescriptionForAvatar(avatarId, '更新 profile 后自动同步');
    toastr.success('Profile 已保存');
    closeModal();
  });
}

async function deleteActiveProfile(avatarId: string): Promise<void> {
  const parentDoc = window.parent.document;
  const profileId = ($('#persona-profile-select', parentDoc).val() as string | undefined) || '';
  if (!profileId) {
    toastr.warning('请先选择要删除的 Profile');
    return;
  }

  const config = loadPersonaAdvancedConfig(avatarId);
  const target = config.profiles.find(p => p.id === profileId);
  if (!target) {
    toastr.warning('未找到目标 Profile');
    return;
  }

  if (!confirm(`确定删除 Profile「${target.name}」吗？`)) {
    return;
  }

  recordPersonaSnapshot(avatarId, `删除 profile: ${target.name}`);
  config.profiles = config.profiles.filter(p => p.id !== profileId);
  config.rules = config.rules.map(rule => ({
    ...rule,
    profileIds: rule.profileIds.filter(id => id !== profileId),
    updatedAt: Date.now(),
  }));
  if (config.activeProfileId === profileId) {
    config.activeProfileId = '';
  }
  savePersonaAdvancedConfig(avatarId, config);
  renderProfileSection(avatarId);
  renderRulesSection(avatarId);
  renderSnapshotSection(avatarId);
  await applyComposedDescriptionForAvatar(avatarId, '删除 profile 后自动同步');
  toastr.success('Profile 已删除');
}

// ==================== 自动规则管理 ====================

async function upsertRule(avatarId: string, existingRule?: PersonaAutoRule): Promise<void> {
  const parentDoc = window.parent.document;
  const traits = loadPersonaTraits(avatarId);
  const config = loadPersonaAdvancedConfig(avatarId);
  const selectedTraitIds = new Set(existingRule?.traitIds || []);
  const selectedProfileIds = new Set(existingRule?.profileIds || []);

  const traitRows = traits
    .map(
      trait => `
      <label class="inline-check-row">
        <input type="checkbox" class="rule-trait-checkbox" value="${escapeHtml(trait.id)}" ${selectedTraitIds.has(trait.id) ? 'checked' : ''}>
        <span>${escapeHtml(trait.name)}</span>
      </label>
    `,
    )
    .join('');
  const profileRows = config.profiles
    .map(
      profile => `
      <label class="inline-check-row">
        <input type="checkbox" class="rule-profile-checkbox" value="${escapeHtml(profile.id)}" ${selectedProfileIds.has(profile.id) ? 'checked' : ''}>
        <span>${escapeHtml(profile.name)}</span>
      </label>
    `,
    )
    .join('');

  const title = existingRule ? '编辑自动规则' : '新建自动规则';
  const modalHtml = `
    <div class="pool-edit-modal">
      <div class="pool-edit-content">
        <h3>${title}</h3>
        <div class="form-group">
          <label>规则名称</label>
          <input type="text" class="persona-input" id="rule-edit-name" value="${escapeHtml(existingRule?.name || '')}">
        </div>
        <div class="form-group two-col-grid">
          <div>
            <label>匹配范围</label>
            <select id="rule-edit-scope" class="persona-input">
              <option value="chat" ${existingRule?.scope === 'chat' || !existingRule ? 'selected' : ''}>聊天</option>
              <option value="character" ${existingRule?.scope === 'character' ? 'selected' : ''}>角色</option>
            </select>
          </div>
          <div>
            <label>匹配方式</label>
            <select id="rule-edit-mode" class="persona-input">
              <option value="includes" ${existingRule?.matchMode === 'includes' || !existingRule ? 'selected' : ''}>includes</option>
              <option value="equals" ${existingRule?.matchMode === 'equals' ? 'selected' : ''}>equals</option>
              <option value="regex" ${existingRule?.matchMode === 'regex' ? 'selected' : ''}>regex</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>匹配内容（可填 chatId/角色名等）</label>
          <input type="text" class="persona-input" id="rule-edit-pattern" value="${escapeHtml(existingRule?.pattern || '')}">
        </div>
        <div class="form-group">
          <label class="inline-check-row">
            <input type="checkbox" id="rule-edit-enabled" ${existingRule?.enabled ?? true ? 'checked' : ''}>
            <span>启用规则</span>
          </label>
        </div>
        <div class="form-group">
          <label>命中后启用的 Profile</label>
          <div class="checkbox-list">${profileRows || '<div class="text-note">暂无 Profile</div>'}</div>
        </div>
        <div class="form-group">
          <label>命中后启用的 Trait</label>
          <div class="checkbox-list">${traitRows || '<div class="text-note">暂无 Trait</div>'}</div>
        </div>
        <div class="edit-actions-bar">
          <button class="persona-btn" id="rule-save-btn">💾 保存</button>
          <button class="persona-btn" id="rule-close-btn">✖ 关闭</button>
        </div>
      </div>
      <div class="pool-edit-overlay"></div>
    </div>
  `;

  const $modal = $(modalHtml).appendTo($('body', parentDoc));
  const closeModal = () => $modal.remove();
  $('#rule-close-btn', $modal).on('click', closeModal);
  $('.pool-edit-overlay', $modal).on('click', closeModal);

  $('#rule-save-btn', $modal).on('click', async () => {
    const name = ($('#rule-edit-name', $modal).val() as string | undefined)?.trim();
    const scope = (($('#rule-edit-scope', $modal).val() as string | undefined) || 'chat') as 'chat' | 'character';
    const matchMode = (($('#rule-edit-mode', $modal).val() as string | undefined) || 'includes') as
      | 'includes'
      | 'equals'
      | 'regex';
    const pattern = ($('#rule-edit-pattern', $modal).val() as string | undefined)?.trim() || '';
    const enabled = Boolean($('#rule-edit-enabled', $modal).prop('checked'));
    const profileIds = $('.rule-profile-checkbox:checked', $modal)
      .map((_, el) => ($(el).val() as string | undefined) || '')
      .get()
      .filter(Boolean);
    const traitIds = $('.rule-trait-checkbox:checked', $modal)
      .map((_, el) => ($(el).val() as string | undefined) || '')
      .get()
      .filter(Boolean);

    if (!name) {
      toastr.warning('请输入规则名称');
      return;
    }
    if (!pattern) {
      toastr.warning('请输入匹配内容');
      return;
    }
    if (profileIds.length === 0 && traitIds.length === 0) {
      toastr.warning('至少选择一个 Profile 或 Trait');
      return;
    }

    if (existingRule) {
      recordPersonaSnapshot(avatarId, `编辑规则: ${existingRule.name}`);
      const idx = config.rules.findIndex(r => r.id === existingRule.id);
      if (idx !== -1) {
        config.rules[idx] = {
          ...config.rules[idx],
          name,
          scope,
          matchMode,
          pattern,
          enabled,
          profileIds,
          traitIds,
          updatedAt: Date.now(),
        };
      }
    } else {
      recordPersonaSnapshot(avatarId, '新增自动规则');
      config.rules.push({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
        name,
        enabled,
        scope,
        matchMode,
        pattern,
        traitIds,
        profileIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    savePersonaAdvancedConfig(avatarId, config);
    renderRulesSection(avatarId);
    renderProfileSection(avatarId);
    renderPersonaTraits(avatarId);
    renderSnapshotSection(avatarId);
    await applyComposedDescriptionForAvatar(avatarId, '更新自动规则后自动同步');
    toastr.success('规则已保存');
    closeModal();
  });
}

async function toggleRuleEnabled(avatarId: string, ruleId: string, enabled: boolean): Promise<void> {
  const rules = loadPersonaRules(avatarId);
  const index = rules.findIndex(rule => rule.id === ruleId);
  if (index === -1) {
    return;
  }

  recordPersonaSnapshot(avatarId, `切换规则: ${rules[index].name}`);
  rules[index].enabled = enabled;
  rules[index].updatedAt = Date.now();
  savePersonaRules(avatarId, rules);
  renderRulesSection(avatarId);
  renderPersonaTraits(avatarId);
  renderProfileSection(avatarId);
  renderSnapshotSection(avatarId);
  await applyComposedDescriptionForAvatar(avatarId, '切换规则后自动同步');
}

async function deleteRule(avatarId: string, ruleId: string): Promise<void> {
  const rules = loadPersonaRules(avatarId);
  const target = rules.find(rule => rule.id === ruleId);
  if (!target) {
    return;
  }

  if (!confirm(`确定删除规则「${target.name}」吗？`)) {
    return;
  }

  recordPersonaSnapshot(avatarId, `删除规则: ${target.name}`);
  const filtered = rules.filter(rule => rule.id !== ruleId);
  savePersonaRules(avatarId, filtered);
  renderRulesSection(avatarId);
  renderPersonaTraits(avatarId);
  renderProfileSection(avatarId);
  renderSnapshotSection(avatarId);
  await applyComposedDescriptionForAvatar(avatarId, '删除规则后自动同步');
  toastr.success('规则已删除');
}

// ==================== 快照回滚 ====================

function showSnapshotList(avatarId: string): void {
  const parentDoc = window.parent.document;
  const snapshots = loadPersonaSnapshots(avatarId);
  const list = snapshots
    .slice(-20)
    .reverse()
    .map(snapshot => `<li>${escapeHtml(formatTime(snapshot.timestamp))} - ${escapeHtml(snapshot.reason)}</li>`)
    .join('');

  const modalHtml = `
    <div class="pool-edit-modal">
      <div class="pool-edit-content">
        <h3>最近快照</h3>
        <ul class="snapshot-list">${list || '<li>暂无快照</li>'}</ul>
        <div class="edit-actions-bar">
          <button class="persona-btn" id="snapshot-close-btn">关闭</button>
        </div>
      </div>
      <div class="pool-edit-overlay"></div>
    </div>
  `;

  const $modal = $(modalHtml).appendTo($('body', parentDoc));
  const closeModal = () => $modal.remove();
  $('#snapshot-close-btn', $modal).on('click', closeModal);
  $('.pool-edit-overlay', $modal).on('click', closeModal);
}

async function rollbackLastSnapshot(avatarId: string): Promise<void> {
  const restored = restoreLastPersonaSnapshot(avatarId);
  if (!restored) {
    toastr.warning('没有可回滚的快照');
    return;
  }

  const parentDoc = window.parent.document;
  $('#edit-persona-base-desc', parentDoc).val(restored.baseDescription);
  $('#edit-persona-desc', parentDoc).val(restored.baseDescription);
  savePersonaBaseDescription(avatarId, restored.baseDescription);

  renderPersonaTraits(avatarId);
  renderProfileSection(avatarId);
  renderRulesSection(avatarId);
  renderSnapshotSection(avatarId);
  await applyComposedDescriptionForAvatar(avatarId, '回滚快照后自动同步');
  toastr.success(`已回滚到 ${formatTime(restored.timestamp)} 的版本`);
}

// ==================== 事件绑定 ====================

function bindPanelEvents(): void {
  const parentDoc = window.parent.document;

  $('#persona-close-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, hidePanel);
  $('#persona-overlay', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, hidePanel);

  $('#persona-refresh-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    await renderPersonaList();
    toastr.success('列表已刷新');
  });

  $('#persona-lock-chat-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, handleLockToChat);
  $('#persona-lock-char-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, handleLockToCharacter);
  $('#persona-unlock-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, handleUnlock);
  $('#persona-sync-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, handleSyncMessages);

  $('#edit-persona-name', parentDoc).on(`input${PANEL_EVENT_NAMESPACE}`, function () {
    $('#persona-name-input', parentDoc).val($(this).val() as string);
  });

  $('#edit-persona-desc', parentDoc).on(`input${PANEL_EVENT_NAMESPACE}`, function () {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }

    const baseDescription = ($(this).val() as string | undefined) || '';
    $('#edit-persona-base-desc', parentDoc).val(baseDescription);
    savePersonaBaseDescription(avatarId, baseDescription);

    if (baseDescDebounceTimer) {
      clearTimeout(baseDescDebounceTimer);
    }
    baseDescDebounceTimer = setTimeout(() => {
      void applyComposedDescriptionForAvatar(avatarId, '编辑基础描述后自动同步');
    }, 450);
  });

  $('#persona-trait-add-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      toastr.warning('请先选择一个角色');
      return;
    }
    await addPersonaTrait(avatarId);
  });

  $(parentDoc)
    .off(`change${PANEL_EVENT_NAMESPACE}`, '.trait-toggle-checkbox')
    .on(`change${PANEL_EVENT_NAMESPACE}`, '.trait-toggle-checkbox', async function () {
      const avatarId = getEditingAvatarId();
      const traitId = ($(this).closest('.persona-trait-item').attr('data-id') || '').trim();
      const enabled = Boolean($(this).prop('checked'));
      if (!avatarId || !traitId) {
        return;
      }
      await togglePersonaTrait(avatarId, traitId, enabled);
    });

  $(parentDoc)
    .off(`click${PANEL_EVENT_NAMESPACE}`, '.trait-btn.edit')
    .on(`click${PANEL_EVENT_NAMESPACE}`, '.trait-btn.edit', async function () {
      const avatarId = getEditingAvatarId();
      const traitId = (($(this).attr('data-id') as string | undefined) || '').trim();
      if (!avatarId || !traitId) {
        return;
      }
      await editPersonaTrait(avatarId, traitId);
    });

  $(parentDoc)
    .off(`click${PANEL_EVENT_NAMESPACE}`, '.trait-btn.delete')
    .on(`click${PANEL_EVENT_NAMESPACE}`, '.trait-btn.delete', async function () {
      const avatarId = getEditingAvatarId();
      const traitId = (($(this).attr('data-id') as string | undefined) || '').trim();
      if (!avatarId || !traitId) {
        return;
      }
      if (confirm('确定要删除此设定吗？')) {
        await deletePersonaTrait(avatarId, traitId);
      }
    });

  $('#persona-profile-select', parentDoc).on(`change${PANEL_EVENT_NAMESPACE}`, async function () {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    const profileId = (($(this).val() as string | undefined) || '').trim();
    recordPersonaSnapshot(avatarId, '切换手动激活 Profile');
    setActiveProfileId(avatarId, profileId);
    renderProfileSection(avatarId);
    renderPersonaTraits(avatarId);
    renderSnapshotSection(avatarId);
    await applyComposedDescriptionForAvatar(avatarId, '切换手动 Profile 后自动同步');
  });

  $('#persona-profile-add-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    await upsertProfile(avatarId);
  });

  $('#persona-profile-edit-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    const profileId = ($('#persona-profile-select', parentDoc).val() as string | undefined) || '';
    if (!profileId) {
      toastr.warning('请先选择一个 Profile');
      return;
    }
    const profile = loadPersonaAdvancedConfig(avatarId).profiles.find(p => p.id === profileId);
    if (!profile) {
      toastr.warning('找不到选中的 Profile');
      return;
    }
    await upsertProfile(avatarId, profile);
  });

  $('#persona-profile-delete-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    await deleteActiveProfile(avatarId);
  });

  $('#persona-profile-clear-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    recordPersonaSnapshot(avatarId, '清空手动激活 Profile');
    setActiveProfileId(avatarId, '');
    renderProfileSection(avatarId);
    renderPersonaTraits(avatarId);
    renderSnapshotSection(avatarId);
    await applyComposedDescriptionForAvatar(avatarId, '清空手动 Profile 后自动同步');
  });

  $('#persona-rule-add-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    await upsertRule(avatarId);
  });

  $(parentDoc)
    .off(`change${PANEL_EVENT_NAMESPACE}`, '.rule-enable-checkbox')
    .on(`change${PANEL_EVENT_NAMESPACE}`, '.rule-enable-checkbox', async function () {
      const avatarId = getEditingAvatarId();
      const ruleId = ($(this).closest('.persona-rule-item').attr('data-rule-id') || '').trim();
      if (!avatarId || !ruleId) {
        return;
      }
      const enabled = Boolean($(this).prop('checked'));
      await toggleRuleEnabled(avatarId, ruleId, enabled);
    });

  $(parentDoc)
    .off(`click${PANEL_EVENT_NAMESPACE}`, '.rule-btn')
    .on(`click${PANEL_EVENT_NAMESPACE}`, '.rule-btn', async function () {
      const avatarId = getEditingAvatarId();
      const ruleId = ($(this).closest('.persona-rule-item').attr('data-rule-id') || '').trim();
      const action = ($(this).attr('data-action') || '').trim();
      if (!avatarId || !ruleId) {
        return;
      }

      if (action === 'edit') {
        const rule = loadPersonaRules(avatarId).find(item => item.id === ruleId);
        if (rule) {
          await upsertRule(avatarId, rule);
        }
      } else if (action === 'delete') {
        await deleteRule(avatarId, ruleId);
      }
    });

  $('#persona-rollback-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, async () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    await rollbackLastSnapshot(avatarId);
  });

  $('#persona-snapshot-list-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, () => {
    const avatarId = getEditingAvatarId();
    if (!avatarId) {
      return;
    }
    showSnapshotList(avatarId);
  });

  $('#persona-compat-refresh-btn', parentDoc).on(`click${PANEL_EVENT_NAMESPACE}`, () => {
    refreshCompatibilitySection();
    toastr.success('兼容性检测已刷新');
  });
}

// ==================== 初始化函数 ====================

export function initPanel(): void {
  const parentDoc = window.parent.document;

  injectStyles(parentDoc);
  const $existingButton = $(`#${PERSONA_BUTTON_ID}`, parentDoc);

  if ($existingButton.length > 0 && !$existingButton.closest('#extensionsMenu').length) {
    $existingButton.remove();
  }

  if ($(`#${PERSONA_BUTTON_ID}`, parentDoc).length === 0) {
    const $extensionsMenu = $('#extensionsMenu', parentDoc);
    if ($extensionsMenu.length > 0) {
      const buttonHtml = `
        <div id="${PERSONA_BUTTON_ID}" class="list-group-item flex-container flexGap5 interactable" title="${PERSONA_BUTTON_TOOLTIP}" tabIndex="0">
          <i class="${PERSONA_BUTTON_ICON}"></i>
          <span>${PERSONA_BUTTON_TEXT_IN_MENU}</span>
        </div>
      `;
      $extensionsMenu.append(buttonHtml);
      console.log('用户设定脚本: 扩展栏按钮已创建');
    } else {
      console.warn('用户设定脚本: 找不到扩展菜单容器 (#extensionsMenu)');
    }
  }

  lastCompatibilityReport = runCompatibilitySelfCheck();
  if (!lastCompatibilityReport.ok) {
    toastr.warning('用户设定脚本兼容性自检未通过，可在面板中查看详情');
  }
}

async function handleContextChanged(): Promise<void> {
  const signature = buildContextSignature();
  if (signature === lastContextSignature) {
    return;
  }
  lastContextSignature = signature;

  const currentPersona = getCurrentPersonaFromDOM();
  if (!currentPersona?.avatarId) {
    return;
  }

  await applyComposedDescriptionForAvatar(currentPersona.avatarId, '上下文变化触发自动规则');

  const editingAvatarId = getEditingAvatarId();
  if (editingAvatarId && editingAvatarId === currentPersona.avatarId) {
    renderPersonaTraits(editingAvatarId);
    renderProfileSection(editingAvatarId);
    renderRulesSection(editingAvatarId);
  }
}

function startContextWatcher(): void {
  if (contextWatcherTimer) {
    return;
  }

  lastContextSignature = buildContextSignature();
  contextWatcherTimer = setInterval(() => {
    void handleContextChanged();
  }, 1800);
}

export function bindEventListeners(): void {
  const parentDoc = window.parent.document;

  $(parentDoc)
    .off(`click.${PERSONA_BUTTON_ID}`)
    .on(`click.${PERSONA_BUTTON_ID}`, `#${PERSONA_BUTTON_ID}`, event => {
      event.preventDefault();
      togglePanel();
    });

  startContextWatcher();
}

export function injectStylesToIframe(): void {
  $('head').append(styles);
}
