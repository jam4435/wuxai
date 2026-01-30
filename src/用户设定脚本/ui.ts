/**
 * 用户设定脚本 - UI 创建和面板控制
 */

import { createScriptIdDiv, destroyScriptIdDiv, deteleportStyle, teleportStyle } from '../util/script';
import {
  findPersonaByAvatarId,
  getPersonaListFromDOM,
  handleLockToCharacter,
  handleLockToChat,
  handleSyncMessages,
  handleUnlock,
  updateCurrentPersonaDisplay,
  selectPersonaInParentUI,
  loadPersonaTraits,
  savePersonaTraits,
} from './handlers';
import {
  PERSONA_BUTTON_ICON,
  PERSONA_BUTTON_ID,
  PERSONA_BUTTON_TEXT_IN_MENU,
  PERSONA_BUTTON_TOOLTIP,
  PERSONA_PANEL_ID,
  PersonaInfo,
  PersonaTrait,
} from './types';
import { injectStyles, styles } from './styles';

// ==================== HTML 模板 ====================

/**
 * 创建面板 HTML
 */
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
        </div>
      </div>

      <!-- 全局操作区（当前用户人设绑定操作） -->
      <div class="persona-global-actions">
        <div class="global-actions-title">
          <span class="global-actions-icon">👑</span>
          <span class="global-actions-label">当前用户人设绑定</span>
        </div>
        <div class="global-actions-buttons">
          <button class="persona-btn global-action-btn" id="persona-lock-chat-btn" title="锁定到当前聊天">
            🔒 锁定到聊天
          </button>
          <button class="persona-btn global-action-btn" id="persona-lock-char-btn" title="锁定到当前角色">
            🔗 锁定到角色
          </button>
          <button class="persona-btn global-action-btn" id="persona-unlock-btn" title="解除锁定">
            🔓 解除锁定
          </button>
          <button class="persona-btn global-action-btn" id="persona-sync-btn" title="同步历史消息">
            🔄 同步消息
          </button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="persona-content-wrapper">
        <!-- 角色列表和编辑区 -->
        <div class="persona-tab-content active">
          <!-- 左侧列表 -->
          <div class="persona-list-panel">
            <div class="panel-title">角色列表</div>
            <div id="persona-list-container" class="persona-list-container">
              <!-- 列表项将通过 JS 动态生成 -->
            </div>
            <div class="list-actions">
              <button class="persona-btn small" id="persona-refresh-btn" title="刷新列表">🔄 刷新</button>
            </div>
          </div>

          <!-- 右侧编辑区 -->
          <div class="persona-edit-panel">
            <div class="panel-title">角色详情</div>

            <div class="edit-form">
              <input type="hidden" id="edit-persona-original-name">
              <input type="hidden" id="edit-persona-avatar">

              <div class="form-group">
                <label for="edit-persona-name">名称</label>
                <input type="text" class="persona-input" id="edit-persona-name" placeholder="角色名称">
              </div>

              <div class="form-group">
                <label for="edit-persona-desc">设定内容 (Description)</label>
                <textarea class="persona-textarea" id="edit-persona-desc" placeholder="输入角色设定/描述..."></textarea>
                <input type="hidden" id="edit-persona-base-desc">
              </div>

            </div>

            <hr class="persona-divider">

            <!-- 角色设定管理区域 -->
            <div class="persona-traits-section">
              <div class="panel-title">
                <span>📋 角色设定列表</span>
                <button class="persona-btn small" id="persona-trait-add-btn" title="添加新设定">➕ 添加</button>
              </div>
              <div id="persona-traits-container" class="persona-traits-container">
                <!-- 设定条目列表将通过 JS 动态生成 -->
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 为了兼容旧逻辑，保留此隐藏输入框供 handlers 使用 -->
      <input type="hidden" id="persona-name-input">
    </div>
  `;
}

/**
 * 生成单个列表项 HTML
 */
function createPersonaItemHtml(persona: PersonaInfo): string {
  const activeClass = persona.isSelected ? 'active' : '';
  const lockIcon = persona.isLockedToChat ? '🔒' : persona.isLockedToCharacter ? '🔗' : '';
  const defaultBadge = persona.isDefault ? '<span class="persona-default-badge">👑</span>' : '';
  const avatarSrc = persona.avatarId ? `/thumbnail?type=persona&file=${encodeURIComponent(persona.avatarId)}` : '';
  const defaultBadgeClass = persona.isDefault ? 'has-default-badge' : '';

  return `
    <div class="persona-list-item ${activeClass}" data-name="${persona.name}" data-avatar-id="${persona.avatarId || ''}">
      <div class="item-avatar-wrapper ${defaultBadgeClass}">
        ${persona.isDefault ? '<div class="default-avatar-ring"></div>' : ''}
        <img class="item-avatar" src="${avatarSrc}" alt="${persona.name}" onerror="this.src='/public/logo.png'">
      </div>
      <div class="item-info">
        <div class="item-name">
          ${persona.name} ${lockIcon} ${defaultBadge}
        </div>
        <div class="item-desc">${persona.description ? persona.description.substring(0, 20) + '...' : '无描述'}</div>
      </div>
    </div>
  `;
}

/**
 * 生成角色设定条目 HTML
 */
function createPersonaTraitHtml(trait: PersonaTrait): string {
  const enabledClass = trait.enabled ? 'enabled' : 'disabled';

  return `
    <div class="persona-trait-item ${enabledClass}" data-id="${trait.id}">
      <div class="trait-item-main">
        <div class="trait-item-header">
          <div class="trait-item-name">${trait.name}</div>
          <input type="checkbox" class="trait-toggle-checkbox" ${trait.enabled ? 'checked' : ''} title="启用/禁用">
        </div>
        <div class="trait-item-desc">${trait.description ? trait.description.substring(0, 50) + '...' : '无描述'}</div>
      </div>
      <div class="trait-item-actions">
        <button class="trait-btn edit" data-id="${trait.id}" title="编辑">✏️</button>
        <button class="trait-btn delete" data-id="${trait.id}" title="删除">🗑️</button>
      </div>
    </div>
  `;
}

// ==================== 面板控制函数 ====================

/**
 * 显示面板
 */
export function showPanel(): void {
  const parentDoc = window.parent.document;

  // 先传送样式到父文档
  teleportStyle();

  // 创建面板容器
  const $container = createScriptIdDiv();
  $container.html(createPanelHtml());
  $('body', parentDoc).append($container);

  // 绑定面板内事件
  bindPanelEvents();

  // 渲染列表
  renderPersonaList();

  // 更新当前 Persona 显示
  updateCurrentPersonaDisplay();

  console.log('用户设定脚本: 面板已显示');
}

/**
 * 渲染 Persona 列表
 */
async function renderPersonaList(): Promise<void> {
  const parentDoc = window.parent.document;
  const listContainer = $('#persona-list-container', parentDoc);
  const personas = getPersonaListFromDOM();

  listContainer.empty();

  if (personas.length === 0) {
    listContainer.html('<div class="empty-list">未找到角色信息</div>');
    return;
  }

  personas.forEach(p => {
    const itemHtml = createPersonaItemHtml(p);
    listContainer.append(itemHtml);
  });

  // 绑定列表项点击事件
  $('.persona-list-item', listContainer).on('click', async function () {
    const avatarId = $(this).data('avatar-id');
    const persona = findPersonaByAvatarId(avatarId);

    if (!persona) return;

    // 如果不是当前选中的，则切换到该人设
    if (!persona.isSelected) {
      // 通过 avatarId 在主界面中选中的对应人设（避免同名人设混淆）
      await selectPersonaInParentUI(avatarId);
      // 只更新当前选中样式，避免完整重新渲染导致卡顿
      $('.persona-list-item', listContainer).removeClass('active');
      $(`.persona-list-item[data-avatar-id="${avatarId}"]`, listContainer).addClass('active');
      // 更新状态栏显示
      await updateCurrentPersonaDisplay();
    }

    // 填充编辑表单
    await selectPersonaForEdit(avatarId);
  });

  // 默认选中当前使用的角色
  const current = personas.find(p => p.isSelected);
  if (current) {
    await selectPersonaForEdit(current.avatarId || '');
    $(`.persona-list-item[data-avatar-id="${current.avatarId}"]`, listContainer).addClass('active');
  } else if (personas.length > 0) {
    await selectPersonaForEdit(personas[0].avatarId || '');
    $('.persona-list-item', listContainer).first().addClass('active');
  }
}

/**
 * 选中角色并填充编辑表单
 * @param avatarId Persona 的 avatarId（唯一标识）
 */
async function selectPersonaForEdit(avatarId: string): Promise<void> {
  const parentDoc = window.parent.document;
  const persona = findPersonaByAvatarId(avatarId);

  if (!persona) return;

  // 获取基础描述（移除已有的设定拼接部分）
  let baseDescription = persona.description || '';
  const separator = '--- 角色设定 ---';
  const separatorIndex = baseDescription.indexOf(separator);
  if (separatorIndex !== -1) {
    baseDescription = baseDescription.substring(0, separatorIndex).trim();
  }

  $('#edit-persona-name', parentDoc).val(persona.name);
  $('#edit-persona-desc', parentDoc).val(baseDescription);
  $('#edit-persona-base-desc', parentDoc).val(baseDescription); // 保存基础描述
  $('#edit-persona-original-name', parentDoc).val(persona.name);
  $('#edit-persona-avatar', parentDoc).val(persona.avatarId || '');

  // 更新隐藏的输入框，供 handlers 使用
  $('#persona-name-input', parentDoc).val(persona.name);

  // 渲染该角色的设定列表
  renderPersonaTraits(avatarId);

  // 将启用的设定拼接到描述文本框中
  await updateDescriptionWithTraits(avatarId);
}

/**
 * 隐藏面板
 */
export function hidePanel(): void {
  const parentDoc = window.parent.document;
  const $button = $(`#${PERSONA_BUTTON_ID}`, parentDoc);

  destroyScriptIdDiv();
  deteleportStyle();

  if ($button.length) $button.removeClass('active');

  console.log('用户设定脚本: 面板已隐藏');
}

/**
 * 切换面板显示/隐藏
 */
export function togglePanel(): void {
  const parentDoc = window.parent.document;
  const $panel = $(`#${PERSONA_PANEL_ID}`, parentDoc);
  const $button = $(`#${PERSONA_BUTTON_ID}`, parentDoc);

  if ($panel.length > 0) {
    hidePanel();
    if ($button.length) $button.removeClass('active');
  } else {
    showPanel();
    if ($button.length) $button.addClass('active');
  }
}

/**
 * 绑定面板内事件
 */
function bindPanelEvents(): void {
  const parentDoc = window.parent.document;

  // 关闭按钮
  $('#persona-close-btn', parentDoc).on('click', hidePanel);
  $('#persona-overlay', parentDoc).on('click', hidePanel);

  // 刷新按钮
  $('#persona-refresh-btn', parentDoc).on('click', () => {
    renderPersonaList();
    toastr.success('列表已刷新');
  });

  // 锁定功能
  $('#persona-lock-chat-btn', parentDoc).on('click', handleLockToChat);
  $('#persona-lock-char-btn', parentDoc).on('click', handleLockToCharacter);
  $('#persona-unlock-btn', parentDoc).on('click', handleUnlock);

  // 同步功能
  $('#persona-sync-btn', parentDoc).on('click', handleSyncMessages);

  // 监听名字输入框变化，同步到隐藏输入框
  $('#edit-persona-name', parentDoc).on('input', function () {
    $('#persona-name-input', parentDoc).val($(this).val() as string);
  });

  // 角色设定：添加新条目
  $('#persona-trait-add-btn', parentDoc).on('click', async () => {
    const avatarId = $('#edit-persona-avatar', parentDoc).val() as string;
    if (!avatarId) {
      toastr.warning('请先选择一个角色');
      return;
    }
    await addPersonaTrait(avatarId);
  });

  // 角色设定：启用/禁用
  $(parentDoc).on('change', '.trait-toggle-checkbox', async function () {
    const avatarId = $('#edit-persona-avatar', parentDoc).val() as string;
    const id = $(this).closest('.persona-trait-item').data('id');
    const enabled = $(this).prop('checked');
    await togglePersonaTrait(avatarId, id, enabled);
  });

  // 角色设定：编辑按钮
  $(parentDoc).on('click', '.trait-btn.edit', async function () {
    const avatarId = $('#edit-persona-avatar', parentDoc).val() as string;
    const id = $(this).data('id');
    await editPersonaTrait(avatarId, id);
  });

  // 角色设定：删除按钮
  $(parentDoc).on('click', '.trait-btn.delete', async function () {
    const avatarId = $('#edit-persona-avatar', parentDoc).val() as string;
    const id = $(this).data('id');
    if (confirm('确定要删除此设定吗？')) {
      await deletePersonaTrait(avatarId, id);
    }
  });
}

// ==================== 初始化函数 ====================

/**
 * 初始化面板 - 创建面板结构和样式，并添加扩展栏按钮
 */
export function initPanel(): void {
  const parentDoc = window.parent.document;

  // 1. 注入样式到父文档
  injectStyles(parentDoc);

  // 2. 检查并创建扩展栏按钮
  const $existingButton = $(`#${PERSONA_BUTTON_ID}`, parentDoc);

  // 如果按钮存在但不在扩展菜单中，移除它
  if ($existingButton.length > 0 && !$existingButton.closest('#extensionsMenu').length) {
    $existingButton.remove();
  }

  // 如果扩展菜单中没有按钮，创建一个
  if ($(`#${PERSONA_BUTTON_ID}`, parentDoc).length === 0) {
    // 查找扩展菜单容器
    const $extensionsMenu = $('#extensionsMenu', parentDoc);

    if ($extensionsMenu.length > 0) {
      // 创建按钮 HTML，使用酒馆标准的扩展按钮格式
      const buttonHtml = `
        <div id="${PERSONA_BUTTON_ID}" class="list-group-item flex-container flexGap5 interactable" title="${PERSONA_BUTTON_TOOLTIP}" tabIndex="0">
          <i class="${PERSONA_BUTTON_ICON}"></i>
          <span>${PERSONA_BUTTON_TEXT_IN_MENU}</span>
        </div>
      `;

      // 添加到扩展菜单
      $extensionsMenu.append(buttonHtml);
      console.log('用户设定脚本: 扩展栏按钮已创建');
    } else {
      console.warn('用户设定脚本: 找不到扩展菜单容器 (#extensionsMenu)');
    }
  }
}

/**
 * 绑定全局事件监听器
 */
export function bindEventListeners(): void {
  const parentDoc = window.parent.document;

  // 使用事件委托绑定扩展栏按钮点击事件
  $(parentDoc)
    .off(`click.${PERSONA_BUTTON_ID}`)
    .on(`click.${PERSONA_BUTTON_ID}`, `#${PERSONA_BUTTON_ID}`, event => {
      event.preventDefault();
      togglePanel();
    });
}

/**
 * 注入样式到 iframe
 */
export function injectStylesToIframe(): void {
  $('head').append(styles);
}

// ==================== 角色设定管理函数 ====================

/**
 * 渲染角色的设定列表
 */
function renderPersonaTraits(avatarId: string): void {
  const parentDoc = window.parent.document;
  const container = $('#persona-traits-container', parentDoc);

  if (!container.length) {
    return;
  }

  const traits = loadPersonaTraits(avatarId);

  container.empty();

  if (traits.length === 0) {
    container.html('<div class="empty-list">暂无设定条目</div>');
    return;
  }

  traits.forEach(trait => {
    const itemHtml = createPersonaTraitHtml(trait);
    container.append(itemHtml);
  });
}

/**
 * 添加新的角色设定条目
 */
async function addPersonaTrait(avatarId: string): Promise<void> {
  const traits = loadPersonaTraits(avatarId);

  const newTrait: PersonaTrait = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 11),
    name: '新设定',
    description: '',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  traits.push(newTrait);

  if (savePersonaTraits(avatarId, traits)) {
    renderPersonaTraits(avatarId);
    await editPersonaTrait(avatarId, newTrait.id);
    toastr.success('设定已添加');
  }
}

/**
 * 切换角色设定的启用状态
 */
async function togglePersonaTrait(avatarId: string, traitId: string, enabled: boolean): Promise<void> {
  const parentDoc = window.parent.document;
  const traits = loadPersonaTraits(avatarId);
  const index = traits.findIndex(t => t.id === traitId);

  if (index === -1) {
    return;
  }

  traits[index].enabled = enabled;
  traits[index].updatedAt = Date.now();

  if (savePersonaTraits(avatarId, traits)) {
    renderPersonaTraits(avatarId);

    // 立即更新设定内容文本框，将启用的设定拼接进去
    await updateDescriptionWithTraits(avatarId);
  }
}

/**
 * 更新设定内容文本框，将启用的设定拼接到基础描述中
 */
async function updateDescriptionWithTraits(avatarId: string): Promise<void> {
  const parentDoc = window.parent.document;
  const $descTextarea = $('#edit-persona-desc', parentDoc);
  const $baseDescInput = $('#edit-persona-base-desc', parentDoc);

  if (!$descTextarea.length) {
    return;
  }

  // 从隐藏字段获取基础描述
  const baseDesc = ($baseDescInput.val() as string) || '';

  // 加载启用的设定
  const traits = loadPersonaTraits(avatarId);
  const enabledTraits = traits.filter(t => t.enabled);

  if (enabledTraits.length === 0) {
    // 没有启用的设定，只显示基础描述
    $descTextarea.val(baseDesc);
    // 同步到酒馆
    await syncDescriptionToTavern(baseDesc);
    return;
  }

  // 拼接启用的设定（使用 "- 设定内容" 格式）
  const traitsDescriptions = enabledTraits
    .map(trait => trait.description.trim())
    .filter(desc => desc.length > 0)
    .map(desc => `- ${desc}`);

  let composedDesc = baseDesc;
  if (traitsDescriptions.length > 0) {
    composedDesc = baseDesc + '\n\n' + traitsDescriptions.join('\n');
  }

  $descTextarea.val(composedDesc);
  // 同步到酒馆
  await syncDescriptionToTavern(composedDesc);
}

/**
 * 同步描述内容到酒馆的 persona_description
 */
async function syncDescriptionToTavern(description: string): Promise<void> {
  const parentDoc = window.parent.document;
  const $personaDescription = $('#persona_description', parentDoc);

  if ($personaDescription.length > 0) {
    $personaDescription.val(description).trigger('input');
  }
}

/**
 * 编辑角色设定条目
 */
async function editPersonaTrait(avatarId: string, traitId: string): Promise<void> {
  const parentDoc = window.parent.document;
  const traits = loadPersonaTraits(avatarId);
  const trait = traits.find(t => t.id === traitId);

  if (!trait) {
    toastr.error('找不到指定的设定');
    return;
  }

  // 创建编辑弹窗
  const modalHtml = `
    <div class="pool-edit-modal">
      <div class="pool-edit-content">
        <h3>编辑设定</h3>
        <div class="form-group">
          <label>名称</label>
          <input type="text" class="persona-input" id="trait-edit-name" value="${trait.name}">
        </div>
        <div class="form-group">
          <label>描述（将拼接到人设描述中）</label>
          <textarea class="persona-textarea" id="trait-edit-desc" rows="10">${trait.description}</textarea>
        </div>
        <div class="edit-actions-bar">
          <button class="persona-btn" id="trait-edit-close">✓ 关闭</button>
        </div>
      </div>
      <div class="pool-edit-overlay"></div>
    </div>
  `;

  const $modal = $(modalHtml).appendTo($('body', parentDoc));

  // 防抖保存函数
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const debouncedSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      const newName = ($('#trait-edit-name', $modal).val() as string) || trait.name;
      const newDesc = $('#trait-edit-desc', $modal).val() as string;

      const index = traits.findIndex(t => t.id === traitId);
      if (index !== -1) {
        traits[index].name = newName;
        traits[index].description = newDesc;
        traits[index].updatedAt = Date.now();

        savePersonaTraits(avatarId, traits);
        renderPersonaTraits(avatarId);
        // 同步更新描述到文本框和酒馆
        await updateDescriptionWithTraits(avatarId);
      }
    }, 500);
  };

  // 监听输入变化，自动保存
  $('#trait-edit-name', $modal).on('input', debouncedSave);
  $('#trait-edit-desc', $modal).on('input', debouncedSave);

  // 绑定关闭按钮
  $('#trait-edit-close', $modal).on('click', async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    // 立即保存最终状态
    const newName = ($('#trait-edit-name', $modal).val() as string) || trait.name;
    const newDesc = $('#trait-edit-desc', $modal).val() as string;

    const index = traits.findIndex(t => t.id === traitId);
    if (index !== -1) {
      traits[index].name = newName;
      traits[index].description = newDesc;
      traits[index].updatedAt = Date.now();

      savePersonaTraits(avatarId, traits);
      renderPersonaTraits(avatarId);
      // 同步更新描述到文本框和酒馆
      await updateDescriptionWithTraits(avatarId);
    }
    $modal.remove();
  });

  // 绑定遮罩点击
  $('.pool-edit-overlay', $modal).on('click', () => {
    $('#trait-edit-close', $modal).trigger('click');
  });
}

/**
 * 删除角色设定条目
 */
async function deletePersonaTrait(avatarId: string, traitId: string): Promise<void> {
  const traits = loadPersonaTraits(avatarId);
  const filtered = traits.filter(t => t.id !== traitId);

  if (savePersonaTraits(avatarId, filtered)) {
    renderPersonaTraits(avatarId);
    // 同步更新描述到文本框和酒馆
    await updateDescriptionWithTraits(avatarId);
    toastr.success('设定已删除');
  }
}
