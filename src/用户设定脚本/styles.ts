/**
 * 用户设定脚本 - 样式定义
 */

import { PERSONA_BUTTON_ID, PERSONA_PANEL_ID } from './types';

// ==================== 样式定义 ====================

/**
 * 面板和按钮的 CSS 样式
 */
export const styles = `
<style>
  /* ===== 面板主容器 ===== */
  #${PERSONA_PANEL_ID} {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--SmartThemeBlurTintColor, rgba(26, 26, 46, 0.98));
    border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    border-radius: 12px;
    z-index: 10000;
    width: 900px;
    height: 650px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    font-family: var(--mainFontFamily, sans-serif);
    color: var(--SmartThemeBodyColor, #e0e0e0);
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  /* ===== 内容区域 ===== */
  #${PERSONA_PANEL_ID} .persona-tab-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ===== 标题区域 ===== */
  #${PERSONA_PANEL_ID} .persona-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    background: rgba(0, 0, 0, 0.2);
  }

  #${PERSONA_PANEL_ID} h2 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--SmartThemeBodyColor, #fff);
  }

  #${PERSONA_PANEL_ID} .persona-status-bar {
    font-size: 13px;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  #${PERSONA_PANEL_ID} .status-value {
    color: var(--SmartThemeEmColor, #a0a0ff);
    font-weight: bold;
  }

  /* ===== 全局操作区（默认用户人设绑定操作） ===== */
  #${PERSONA_PANEL_ID} .persona-global-actions {
    padding: 16px 20px;
    border-bottom: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    background: linear-gradient(135deg, rgba(218, 165, 32, 0.08), rgba(184, 134, 11, 0.05));
  }

  #${PERSONA_PANEL_ID} .global-actions-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #daa520;
  }

  #${PERSONA_PANEL_ID} .global-actions-icon {
    font-size: 18px;
  }

  #${PERSONA_PANEL_ID} .global-actions-label {
    color: #daa520;
  }

  #${PERSONA_PANEL_ID} .global-actions-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }

  #${PERSONA_PANEL_ID} .global-action-btn {
    border: 1px solid #b8860b;
    background: linear-gradient(135deg, rgba(218, 165, 32, 0.15), rgba(184, 134, 11, 0.1));
    box-shadow: 0 0 0 1px rgba(218, 165, 32, 0.3), inset 0 0 10px rgba(218, 165, 32, 0.05);
    color: #ffd700;
    padding: 10px 16px;
  }

  #${PERSONA_PANEL_ID} .global-action-btn:hover {
    background: linear-gradient(135deg, rgba(218, 165, 32, 0.25), rgba(184, 134, 11, 0.2));
    border-color: #daa520;
    box-shadow: 0 0 0 2px rgba(218, 165, 32, 0.4), 0 4px 12px rgba(218, 165, 32, 0.2);
  }

  /* ===== 关闭按钮 ===== */
  #${PERSONA_PANEL_ID} .close-btn {
    cursor: pointer;
    font-size: 24px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    opacity: 0.7;
    transition: all 0.2s ease;
  }

  #${PERSONA_PANEL_ID} .close-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  /* ===== 主内容区域 (双栏布局) ===== */
  #${PERSONA_PANEL_ID} .persona-content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* 左侧列表面板 */
  #${PERSONA_PANEL_ID} .persona-list-panel {
    width: 250px;
    background: rgba(0, 0, 0, 0.15);
    border-right: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    display: flex;
    flex-direction: column;
  }

  #${PERSONA_PANEL_ID} .panel-title {
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--SmartThemeBodyColor, #ccc);
    border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(74, 74, 106, 0.3));
  }

  #${PERSONA_PANEL_ID} .persona-list-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  #${PERSONA_PANEL_ID} .list-actions {
    padding: 8px;
    border-top: 1px solid var(--SmartThemeBorderColor, rgba(74, 74, 106, 0.3));
  }

  /* 右侧编辑面板 */
  #${PERSONA_PANEL_ID} .persona-edit-panel {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ===== 列表项样式 ===== */
  #${PERSONA_PANEL_ID} .persona-list-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    margin-bottom: 4px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  #${PERSONA_PANEL_ID} .persona-list-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  #${PERSONA_PANEL_ID} .persona-list-item.active {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
  }

  #${PERSONA_PANEL_ID} .persona-list-item.is-default {
    background: rgba(0, 0, 0, 0.15);
  }

  #${PERSONA_PANEL_ID} .persona-list-item.is-default .item-name {
    color: #ffd700;
  }

  #${PERSONA_PANEL_ID} .persona-default-badge {
    font-size: 12px;
    margin-left: 4px;
  }

  /* ===== 人设头像样式 ===== */
  #${PERSONA_PANEL_ID} .item-avatar-wrapper {
    position: relative;
    width: 50px;
    height: 50px;
    flex-shrink: 0;
  }

  #${PERSONA_PANEL_ID} .item-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--SmartThemeBorderColor, #4a4a6a);
  }

  /* 默认人设的金圈 */
  #${PERSONA_PANEL_ID} .default-avatar-ring {
    position: absolute;
    top: -3px;
    left: -3px;
    right: -3px;
    bottom: -3px;
    border: 2px solid #daa520;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(218, 165, 32, 0.3), 0 0 6px rgba(218, 165, 32, 0.4);
    pointer-events: none;
  }

  /* 列表项选中时的头像高亮 */
  #${PERSONA_PANEL_ID} .persona-list-item.active .item-avatar {
    border-color: rgba(255, 255, 255, 1);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
  }
  
  #${PERSONA_PANEL_ID} .item-info {
    flex: 1;
    overflow: hidden;
  }
  
  #${PERSONA_PANEL_ID} .item-name {
    font-weight: 500;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  #${PERSONA_PANEL_ID} .item-desc {
    font-size: 11px;
    opacity: 0.6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ===== 表单样式 ===== */
  #${PERSONA_PANEL_ID} .form-group {
    margin-bottom: 16px;
  }
  
  #${PERSONA_PANEL_ID} label {
    display: block;
    font-size: 13px;
    opacity: 0.8;
    margin-bottom: 8px;
    font-weight: 500;
  }

  #${PERSONA_PANEL_ID} .persona-input,
  #${PERSONA_PANEL_ID} .persona-textarea {
    width: 100%;
    padding: 10px 12px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    color: var(--SmartThemeBodyColor, #e0e0e0);
    font-size: 14px;
    box-sizing: border-box;
    transition: all 0.2s ease;
    font-family: inherit;
  }
  
  #${PERSONA_PANEL_ID} .persona-textarea {
    min-height: 120px;
    resize: vertical;
    line-height: 1.5;
  }

  #${PERSONA_PANEL_ID} .persona-input:focus,
  #${PERSONA_PANEL_ID} .persona-textarea:focus {
    outline: none;
    border-color: var(--SmartThemeEmColor, #7a7aff);
    box-shadow: 0 0 0 2px rgba(122, 122, 255, 0.15);
  }

  /* ===== 按钮样式 ===== */
  #${PERSONA_PANEL_ID} .persona-btn {
    padding: 8px 14px;
    border-radius: 6px;
    background: var(--SmartThemeBlurTintColor, rgba(42, 42, 78, 0.8));
    border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    color: var(--SmartThemeBodyColor, #e0e0e0);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  
  #${PERSONA_PANEL_ID} .persona-btn.small {
    padding: 4px 8px;
    font-size: 12px;
    width: 100%;
  }

  #${PERSONA_PANEL_ID} .persona-btn:hover {
    background: var(--SmartThemeQuoteColor, rgba(100, 100, 150, 0.4));
    border-color: var(--SmartThemeEmColor, #7a7aaa);
  }
  
  #${PERSONA_PANEL_ID} .persona-btn.primary {
    background: linear-gradient(135deg, rgba(80, 120, 200, 0.6), rgba(100, 80, 180, 0.6));
    border-color: #5080c0;
    color: #fff;
    padding: 10px 20px;
  }
  
  #${PERSONA_PANEL_ID} .persona-btn.success {
    background: linear-gradient(135deg, rgba(60, 150, 100, 0.5), rgba(40, 120, 80, 0.5));
    border-color: #4cae4c;
    color: #fff;
    padding: 10px 20px;
  }

  /* ===== 动作条 ===== */
  #${PERSONA_PANEL_ID} .edit-actions-bar {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    justify-content: flex-end;
  }
  
  #${PERSONA_PANEL_ID} .quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  /* ===== 分隔线 ===== */
  #${PERSONA_PANEL_ID} .persona-divider {
    border: none;
    border-top: 1px solid var(--SmartThemeBorderColor, rgba(74, 74, 106, 0.5));
    margin: 20px 0;
    width: 100%;
  }

  /* ===== 扩展菜单按钮 ===== */
  #${PERSONA_BUTTON_ID} {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  #${PERSONA_BUTTON_ID}:hover {
    background: var(--SmartThemeQuoteColor, rgba(100, 100, 150, 0.3));
  }

  #${PERSONA_BUTTON_ID}.active {
    background-color: #6a4a7e !important;
    color: #fff !important;
  }

  /* ===== 遮罩层 ===== */
  .persona-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    backdrop-filter: blur(2px);
  }

  .empty-list {
    text-align: center;
    padding: 20px;
    opacity: 0.5;
    font-size: 13px;
  }

  /* ===== 角色设定区域 ===== */
  #${PERSONA_PANEL_ID} .persona-traits-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #${PERSONA_PANEL_ID} .persona-traits-section .panel-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  #${PERSONA_PANEL_ID} .persona-traits-container {
    max-height: 250px;
    overflow-y: auto;
  }

  /* 角色设定条目 */
  #${PERSONA_PANEL_ID} .persona-trait-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    margin-bottom: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid transparent;
    transition: all 0.2s ease;
  }

  #${PERSONA_PANEL_ID} .persona-trait-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  #${PERSONA_PANEL_ID} .persona-trait-item.enabled {
    border-color: rgba(160, 200, 120, 0.5);
  }

  #${PERSONA_PANEL_ID} .persona-trait-item.disabled {
    opacity: 0.5;
  }

  #${PERSONA_PANEL_ID} .trait-item-main {
    flex: 1;
    overflow: hidden;
  }

  #${PERSONA_PANEL_ID} .trait-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  #${PERSONA_PANEL_ID} .trait-item-name {
    font-weight: 500;
    font-size: 14px;
  }

  #${PERSONA_PANEL_ID} .trait-toggle-checkbox {
    cursor: pointer;
    transform: scale(1.2);
  }

  #${PERSONA_PANEL_ID} .trait-item-desc {
    font-size: 12px;
    opacity: 0.7;
    white-space: pre-wrap;
  }

  #${PERSONA_PANEL_ID} .trait-item-actions {
    display: flex;
    gap: 8px;
  }

  #${PERSONA_PANEL_ID} .trait-btn {
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    color: var(--SmartThemeBodyColor, #e0e0e0);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
  }

  #${PERSONA_PANEL_ID} .trait-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  #${PERSONA_PANEL_ID} .trait-btn.delete:hover {
    background: rgba(200, 80, 80, 0.3);
    border-color: #c86060;
  }

  /* ===== 编辑弹窗 ===== */
  .pool-edit-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10001;
    display: flex;
  }

  .pool-edit-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: -1;
  }

  .pool-edit-content {
    background: var(--SmartThemeBlurTintColor, rgba(26, 26, 46, 0.98));
    border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
    border-radius: 12px;
    padding: 24px;
    min-width: 400px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
  }

  .pool-edit-content h3 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
  }

  .pool-edit-content .persona-textarea {
    min-height: 150px;
  }
</style>
`;

/**
 * 注入样式到文档
 * @param doc 目标文档对象
 */
export function injectStyles(doc: Document = document): void {
  if ($('#persona-panel-styles', doc).length === 0) {
    const styleElement = styles.replace('<style>', '<style id="persona-panel-styles">');
    $('head', doc).append(styleElement);
  }
}
/**
 * 移除样式
 * @param doc 目标文档对象
 * @param styleId 样式标签的 ID
 */
export function removeStyles(doc: Document, styleId: string = 'persona-panel-styles'): void {
  $(`#${styleId}`, doc).remove();
}
