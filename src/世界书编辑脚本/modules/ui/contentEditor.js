import { getLorebookEntry, saveEntryField } from '../api.js';
import { errorCatched } from '../utils.js';

const CONTENT_EDITOR_MODAL_ID = 'content-editor-modal';

// 初始化内容编辑器弹窗
export function initContentEditor() {
  const parentDoc = window.parent.document;

  // 检查是否已经存在样式
  if ($(`#enhanced-content-editor-styles`, parentDoc).length === 0) {
    const editorStyles = `
      <style id="enhanced-content-editor-styles">
        #${CONTENT_EDITOR_MODAL_ID} {
          display: none;
          position: fixed;
          z-index: 10001;
          left: 0;
          top: 0;
          width: 100vw;
          height: 100vh;
          overflow-y: auto;
          background-color: rgba(0,0,0,0.75);
          backdrop-filter: blur(4px);
          box-sizing: border-box;
        }
        #${CONTENT_EDITOR_MODAL_ID}-content {
          background: var(--panel-bg-color, #2a2a2a);
          color: var(--panel-text-color, #eee);
          padding: 0;
          border: 1px solid rgba(255,255,255,0.15);
          width: 95%;
          max-width: 800px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          max-height: calc(100vh - 100px);
          display: flex;
          flex-direction: column;
          margin: 50px auto;
          box-sizing: border-box;
        }
        #${CONTENT_EDITOR_MODAL_ID}-header {
          padding: 15px 20px;
          background: var(--panel-accent-color, #5a3a8e);
          color: var(--panel-text-color, white);
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        #${CONTENT_EDITOR_MODAL_ID}-header h4 {
          margin: 0;
          font-size: 1.1em;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--panel-text-color, white);
        }
        #${CONTENT_EDITOR_MODAL_ID}-header h4::before {
          content: "📝";
          font-size: 1.2em;
        }
        #${CONTENT_EDITOR_MODAL_ID} .close-button {
          color: var(--panel-text-color, white);
          font-size: 24px;
          font-weight: bold;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
          background-color: rgba(255,255,255,0.1);
        }
        #${CONTENT_EDITOR_MODAL_ID} .close-button:hover {
          background-color: rgba(255,255,255,0.2);
          transform: rotate(90deg);
        }
        #${CONTENT_EDITOR_MODAL_ID}-body {
          padding: 20px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }
        #${CONTENT_EDITOR_MODAL_ID}-body > p {
          margin: 0;
          font-size: 0.95em;
          color: var(--panel-text-color, #bbb);
          opacity: 0.8;
          padding: 10px;
          background-color: var(--panel-entry-bg-color, rgba(0,0,0,0.2));
          border-left: 3px solid var(--panel-accent-color, #5a3a8e);
          border-radius: 4px;
          line-height: 1.5;
        }
        #${CONTENT_EDITOR_MODAL_ID}-entry-info {
          background-color: var(--panel-entry-bg-color, rgba(0,0,0,0.2));
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 10px;
        }
        #${CONTENT_EDITOR_MODAL_ID}-entry-info .entry-title {
          font-weight: bold;
          margin-bottom: 5px;
          color: var(--panel-text-color, #eee);
        }
        #${CONTENT_EDITOR_MODAL_ID}-entry-info .entry-uid {
          font-size: 0.9em;
          color: var(--panel-text-color, #bbb);
        }
        #${CONTENT_EDITOR_MODAL_ID}-textarea {
          width: 100%;
          min-height: 400px;
          flex-grow: 1;
          background-color: var(--yaml-input-bg-color, #2d2d2d);
          color: var(--panel-text-color, #f0f0f0);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          resize: vertical;
          box-sizing: border-box;
          padding: 12px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 0.9em;
          line-height: 1.6;
          transition: all 0.2s ease;
        }
        #${CONTENT_EDITOR_MODAL_ID}-textarea:focus {
          outline: none;
          border-color: var(--panel-accent-color, #7a5abe);
          background-color: var(--yaml-input-bg-color, #353535);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--panel-accent-color, #7a5abe) 20%, transparent);
        }
        #${CONTENT_EDITOR_MODAL_ID}-textarea::placeholder {
          color: var(--panel-text-color, #777);
          opacity: 0.4;
        }
        #${CONTENT_EDITOR_MODAL_ID}-footer {
          padding: 15px 20px;
          text-align: right;
          border-top: 1px solid rgba(255,255,255,0.1);
          background-color: var(--panel-entry-bg-color, rgba(0,0,0,0.2));
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        #${CONTENT_EDITOR_MODAL_ID}-footer button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95em;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        #${CONTENT_EDITOR_MODAL_ID}-cancel {
          background-color: var(--panel-entry-bg-color, #555);
          color: var(--panel-text-color, white);
        }
        #${CONTENT_EDITOR_MODAL_ID}-cancel:hover {
          filter: brightness(1.2);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        #${CONTENT_EDITOR_MODAL_ID}-save {
          background: var(--panel-accent-color, #5a3a8e);
          color: var(--panel-text-color, white);
        }
        #${CONTENT_EDITOR_MODAL_ID}-save:hover:not(:disabled) {
          filter: brightness(1.15);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--panel-accent-color, #5a3a8e) 40%, transparent);
        }
        #${CONTENT_EDITOR_MODAL_ID}-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        #${CONTENT_EDITOR_MODAL_ID}-error {
          color: #ff6b6b;
          font-size: 0.9em;
          padding: 10px 12px;
          background-color: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 6px;
          display: none;
          margin-top: 8px;
        }
        #${CONTENT_EDITOR_MODAL_ID}-error::before {
          content: "⚠️ ";
        }
      </style>
    `;
    $('head', parentDoc).append(editorStyles);
  }

  // 检查是否已经存在弹窗
  if ($(`#${CONTENT_EDITOR_MODAL_ID}`, parentDoc).length === 0) {
    const modalHtml = `
      <div id="${CONTENT_EDITOR_MODAL_ID}" style="display: none;">
        <div id="${CONTENT_EDITOR_MODAL_ID}-content">
          <div id="${CONTENT_EDITOR_MODAL_ID}-header">
            <h4>编辑条目内容</h4>
            <span class="close-button">&times;</span>
          </div>
          <div id="${CONTENT_EDITOR_MODAL_ID}-body">
            <textarea id="${CONTENT_EDITOR_MODAL_ID}-textarea" placeholder="在此输入条目内容..."></textarea>
            <div id="${CONTENT_EDITOR_MODAL_ID}-error"></div>
          </div>
          <div id="${CONTENT_EDITOR_MODAL_ID}-footer">
            <button id="${CONTENT_EDITOR_MODAL_ID}-cancel" class="lorebook-copy-cancel-btn">取消</button>
            <button id="${CONTENT_EDITOR_MODAL_ID}-save" class="lorebook-copy-confirm-btn">保存</button>
          </div>
        </div>
      </div>
    `;
    $('body', parentDoc).append(modalHtml);
  }

  const $modal = $(`#${CONTENT_EDITOR_MODAL_ID}`, parentDoc);

  // 绑定关闭事件
  $(parentDoc).on('click', `#${CONTENT_EDITOR_MODAL_ID} .close-button, #${CONTENT_EDITOR_MODAL_ID}-cancel`, () => {
    $modal.hide();
  });

  // 点击背景关闭
  $modal.on('click', e => {
    if (e.target.id === CONTENT_EDITOR_MODAL_ID) $modal.hide();
  });

  // 绑定保存事件
  $(parentDoc).on('click', `#${CONTENT_EDITOR_MODAL_ID}-save`, async function () {
    const $saveBtn = $(this);
    const $errorDisplay = $modal.find(`#${CONTENT_EDITOR_MODAL_ID}-error`);
    const content = $modal.find(`#${CONTENT_EDITOR_MODAL_ID}-textarea`).val();
    const lorebookName = $modal.data('lorebook-name');
    const entryUid = $modal.data('entry-uid');

    $saveBtn.text('保存中...').prop('disabled', true);
    $errorDisplay.hide();

    try {
      const success = await saveEntryField(entryUid, lorebookName, 'content', content);
      if (success) {
        // 刷新UI
        const parentDoc = window.parent.document;
        const $panel = $(`#enhanced-lorebook-panel`, parentDoc);
        if ($panel.is(':visible')) {
          // 触发内容区域的change事件以更新token计数
          const $item = $(`.lorebook-entry[data-entry-uid="${entryUid}"]`, parentDoc);
          const $textarea = $item.find('.content-textarea');
          $textarea.val(content).trigger('input');
        }
        $modal.hide();
      } else {
        $errorDisplay.text('保存失败，请重试。').show();
      }
    } catch (error) {
      console.error('角色世界书: 保存内容时出错', error);
      $errorDisplay.text(`保存失败: ${error.message}`).show();
    } finally {
      $saveBtn.text('保存').prop('disabled', false);
    }
  });
}

// 显示内容编辑器弹窗
export const showContentEditor = errorCatched(async (lorebookName, entryUid) => {
  const parentDoc = window.parent.document;
  const $modal = $(`#${CONTENT_EDITOR_MODAL_ID}`, parentDoc);

  // 获取条目数据
  const entry = await getLorebookEntry(lorebookName, entryUid);
  if (!entry) {
    alert(`无法获取UID为 ${entryUid} 的条目数据`);
    return;
  }

  // 填充数据
  $modal.find(`#${CONTENT_EDITOR_MODAL_ID}-textarea`).val(entry.content || '');
  $modal.find(`#${CONTENT_EDITOR_MODAL_ID}-error`).hide();
  $modal.find(`#${CONTENT_EDITOR_MODAL_ID}-save`).text('保存').prop('disabled', false);

  // 存储数据以便保存时使用
  $modal.data('lorebook-name', lorebookName);
  $modal.data('entry-uid', entryUid);

  // 显示弹窗
  $modal.css('display', 'flex');
}, 'showContentEditor');
