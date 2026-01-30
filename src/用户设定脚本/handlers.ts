/**
 * 用户设定脚本 - 事件处理和 Persona 操作
 */

import { PersonaInfo, PersonaTrait } from './types';

declare const toastr: any;
declare function triggerSlash(command: string): Promise<string>;

// ==================== Persona 数据获取函数 ====================

/**
 * 从前端 DOM 获取所有已存在的 Persona 列表
 * 通过解析 #user_avatar_block 中的 .avatar-container 元素
 */
export function getPersonaListFromDOM(): PersonaInfo[] {
  const parentDoc = window.parent.document;
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

    // 从 .ch_description 元素获取描述
    const $descriptionElement = $container.find('.ch_description');
    let description = $descriptionElement.text().trim();
    // 清理文本中的多余空格，但保留换行符
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
      isLockedToCharacter
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
 * 根据 avatarId 查找 Persona（推荐使用，avatarId 是唯一标识）
 */
export function findPersonaByAvatarId(avatarId: string): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => p.avatarId === avatarId) || null;
}

/**
 * 根据名称查找 Persona（返回第一个匹配的，可能不准确）
 * @deprecated 建议使用 findPersonaByAvatarId 替代
 */
export function findPersonaByName(name: string): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => p.name === name) || null;
}

/**
 * 获取默认用户人设（带有 default_persona 类的 persona）
 * 默认用户人设是酒馆中主要用于绑定操作的人设
 */
export function getDefaultPersona(): PersonaInfo | null {
  const personas = getPersonaListFromDOM();
  return personas.find(p => p.isDefault) || null;
}


// ==================== UI 辅助函数 ====================

/**
 * 获取输入框中的 Persona 名称
 * (此函数主要由旧的 handle 函数使用)
 */
export function getInputPersonaName(): string {
  const parentDoc = window.parent.document;
  return ($('#persona-name-input', parentDoc).val() as string || '').trim();
}

/**
 * 更新当前 Persona 显示
 */
export async function updateCurrentPersonaDisplay(): Promise<void> {
  const parentDoc = window.parent.document;
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
 * @param avatarId 要选中的 persona 的头像 ID
 */
export async function selectPersonaInParentUI(avatarId: string): Promise<boolean> {
    console.log(`用户设定脚本: 尝试在主界面中选中 Persona (avatarId: ${avatarId})`);
    const parentDoc = window.parent.document;
    const $personaCard = $(`#user_avatar_block .avatar-container[data-avatar-id="${avatarId}"]`, parentDoc);

    if ($personaCard.length === 0) {
        console.error(`用户设定脚本: 在主界面中找不到 avatarId 为 ${avatarId} 的 Persona 卡片`);
        toastr.error('在主界面找不到对应的 Persona 卡片');
        return false;
    }

    // 如果未被选中，则触发点击
    if (!$personaCard.hasClass('selected')) {
        console.log('用户设定脚本: Persona 未选中，执行点击操作');
        $personaCard.trigger('click');

        // 等待一小段时间确保状态更新
        await new Promise(resolve => setTimeout(resolve, 100));

        // 再次检查是否选中
        if (!$personaCard.hasClass('selected')) {
             console.error(`用户设定脚本: 点击后，Persona (avatarId: ${avatarId}) 仍然未被选中`);
             toastr.error('切换 Persona 失败，无法继续保存');
             return false;
        }
    }

    console.log(`用户设定脚本: Persona (avatarId: ${avatarId}) 已成功选中`);
    return true;
}


/**
 * 保存 Persona 信息 (修复版，使用正确的用户设定管理 DOM 元素)
 * @param originalAvatarId Persona 的原始头像 ID，用于在主 UI 中定位并选中它
 * @param newName Persona 的新名称
 * @param newDescription Persona 的新描述（会自动拼入启用的设定）
 */
export async function savePersona(originalAvatarId: string, newName: string, newDescription: string): Promise<boolean> {
  try {
    console.log(`用户设定脚本: 开始保存 Persona... (avatarId: ${originalAvatarId})`);
    const parentDoc = window.parent.document;

    // 步骤 1: 在主 UI 中选中要编辑的 Persona
    const selectionSuccess = await selectPersonaInParentUI(originalAvatarId);
    if (!selectionSuccess) {
      return false;
    }

    // 步骤 2: 拼装完整描述（人设描述 + 启用的设定）
    const fullDescription = await composePersonaDescription(originalAvatarId, newDescription);

    // 步骤 3: 更新描述
    const $personaDescription = $('#persona_description', parentDoc);
    if ($personaDescription.length > 0) {
      console.log('用户设定脚本: 更新描述');
      $personaDescription.val(fullDescription).trigger('input').trigger('blur');
    } else {
      console.warn('用户设定脚本: 找不到 #persona_description 元素');
    }

    // 步骤 4: 处理名称变更
    const $personaName = $('#your_name', parentDoc);
    const currentName = $personaName.text().trim();

    if (newName !== currentName) {
      console.log(`用户设定脚本: 名称需要更新: "${currentName}" -> "${newName}"`);
      const $renameBtn = $('#persona_rename_button', parentDoc);
      if ($renameBtn.length > 0) {
        $renameBtn.trigger('click');
        await handlePersonaRenameModal(newName);
      } else {
        console.warn('用户设定脚本: 找不到重命名按钮，跳过名称更新');
      }
    }

    // 步骤 5: 等待保存
    await new Promise(resolve => setTimeout(resolve, 500));

    // 步骤 6: 验证保存结果
    const personas = getPersonaListFromDOM();
    const savedPersona = personas.find(p => p.avatarId === originalAvatarId);

    if (savedPersona && savedPersona.name === newName) {
      toastr.success(`Persona "${newName}" 已成功保存`);
    } else {
      toastr.success(`Persona 修改已提交 (需确认结果)`);
    }

    return true;

  } catch (error) {
    console.error('用户设定脚本: 保存 Persona 时发生意外错误', error);
    toastr.error('保存过程中发生意外错误');
    return false;
  }
}

/**
 * 处理 Persona 重命名模态框
 * @param newName 新的 Persona 名称
 */
async function handlePersonaRenameModal(newName: string): Promise<boolean> {
  const parentDoc = window.parent.document;

  // 等待模态框出现
  await new Promise(resolve => setTimeout(resolve, 300));

  // 查找模态框中的输入框
  const $modalInput = $('.popup .wide100p input[type="text"]', parentDoc);
  if ($modalInput.length > 0) {
    $modalInput.val(newName).trigger('input');

    // 查找并点击确认按钮
    const $confirmBtn = $('.popup-menu_buttons .menu_button:contains("OK")', parentDoc);
    if ($confirmBtn.length > 0) {
      $confirmBtn.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 300));
      return true;
    } else {
      console.warn('用户设定脚本: 找不到模态框确认按钮');
    }
  } else {
    console.warn('用户设定脚本: 找不到模态框输入框');
  }

  return false;
}

// ==================== 角色设定存储管理 ====================

/**
 * 获取角色设定的存储键
 */
function getPersonaTraitStorageKey(avatarId: string): string {
  return `tavern_helper_persona_traits_${avatarId}`;
}

/**
 * 加载角色的设定列表
 */
export function loadPersonaTraits(avatarId: string): PersonaTrait[] {
  try {
    const key = getPersonaTraitStorageKey(avatarId);
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error('用户设定脚本: 加载角色设定失败', error);
  }
  return [];
}

/**
 * 保存角色的设定列表
 */
export function savePersonaTraits(avatarId: string, traits: PersonaTrait[]): boolean {
  try {
    const key = getPersonaTraitStorageKey(avatarId);
    localStorage.setItem(key, JSON.stringify(traits));
    return true;
  } catch (error) {
    console.error('用户设定脚本: 保存角色设定失败', error);
    toastr.error('保存角色设定失败');
    return false;
  }
}

// ==================== 描述拼装逻辑 ====================

/**
 * 拼装最终的用户描述（人设描述 + 启用的设定条目）
 * @param avatarId 角色的 avatarId
 * @param baseDescription 人设基础描述
 */
export async function composePersonaDescription(avatarId: string, baseDescription: string): Promise<string> {
  const traits = loadPersonaTraits(avatarId);

  if (!traits || traits.length === 0) {
    // 没有设定条目，直接返回原始描述
    return baseDescription;
  }

  // 筛选出已启用的设定条目
  const enabledTraits = traits.filter(t => t.enabled);

  if (enabledTraits.length === 0) {
    return baseDescription;
  }

  // 拼装人设描述和设定条目
  let composedDescription = baseDescription.trim();

  // 添加设定条目（使用 "- 设定内容" 格式）
  const traitsDescriptions = enabledTraits
    .map(trait => trait.description.trim())
    .filter(desc => desc.length > 0)
    .map(desc => `- ${desc}`);

  if (traitsDescriptions.length > 0) {
    composedDescription += '\n\n' + traitsDescriptions.join('\n');
  }

  return composedDescription;
}

/**
 * 获取当前应用的完整描述（用于发送消息时）
 */
export async function getCurrentPersonaFullDescription(): Promise<string> {
  const currentPersona = getCurrentPersonaFromDOM();
  if (!currentPersona || !currentPersona.description || !currentPersona.avatarId) {
    return '';
  }

  return await composePersonaDescription(currentPersona.avatarId, currentPersona.description);
}
