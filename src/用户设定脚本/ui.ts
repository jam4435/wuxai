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
                <span>📋 角色设定列表</span>
                <button class="persona-btn small" id="persona-trait-add-btn" title="添加新设定">➕ 添加</button>
              </div>
              <div id="persona-traits-container" class="persona-traits-container"></div>
            </div>

            <hr class="persona-divider">

            <div class="persona-profiles-section">
              <div class="panel-title">
                <span>🧩 设定预设（Profile）</span>
              </div>
              <div class="profile-toolbar">
                <select id="persona-profile-select" class="persona-input profile-select"></select>
                <button class="persona-btn small" id="persona-profile-add-btn">➕ 新建</button>
                <button class="persona-btn small" id="persona-profile-edit-btn">✏️ 编辑</button>
                <button class="persona-btn small" id="persona-profile-delete-btn">🗑️ 删除</button>
                <button class="persona-btn small" id="persona-profile-clear-btn">🚫 清空激活</button>
              </div>
              <div id="persona-profile-summary" class="text-note">暂无预设</div>
            </div>

            <hr class="persona-divider">

            <div class="persona-rules-section">
              <div class="panel-title">
                <span>⚙️ 规则自动启用</span>
                <button class="persona-btn small" id="persona-rule-add-btn">➕ 添加规则</button>
              </div>
              <div id="persona-rules-container" class="persona-rules-container"></div>
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

