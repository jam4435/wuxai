import { createWorldbookEntries } from '../api.js';
import { errorCatched } from '../utils.js';

const IMPORT_MODAL_ID = 'lorebook-import-modal';

function ensureJsYaml() {
  return new Promise((resolve, reject) => {
    if (window.jsyaml) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
    script.onload = () => resolve();
    script.onerror = () => {
      alert('错误：无法加载YAML解析器，批量导入功能不可用。');
      reject(new Error('Failed to load js-yaml.'));
    };
    document.head.appendChild(script);
  });
}

export const handleBulkImport = errorCatched(async (lorebookName, isGlobal) => {
  const parentDoc = window.parent.document;
  const $modal = $(`#${IMPORT_MODAL_ID}`, parentDoc);
  const $confirmBtn = $modal.find(`#${IMPORT_MODAL_ID}-confirm`);
  const $errorDisplay = $modal.find(`#${IMPORT_MODAL_ID}-error`);
  let yamlText = $modal.find(`#${IMPORT_MODAL_ID}-textarea`).val();

  // Pre-process the text to replace all tabs with 2 spaces to prevent indentation errors.
  yamlText = yamlText.replace(/\t/g, '  ');

  if (!yamlText.trim()) {
    $errorDisplay.text('错误：输入内容不能为空。').show();
    return false;
  }

  $confirmBtn.text('处理中...').prop('disabled', true);
  $errorDisplay.hide();

  try {
    await ensureJsYaml();

    const yamlTypeToApiType = { Constant: 'constant', Normal: 'selective' };
    const yamlPositionToApiPosition = {
      'Before Character Definition': 'before_character_definition',
      'After Character Definition': 'after_character_definition',
      'Before Example Messages': 'before_example_messages',
      'After Example Messages': 'after_example_messages',
      'Before Author Note': 'before_author_note',
      'After Author Note': 'after_author_note',
      'At Depth as System': 'at_depth',
      'At Depth as Assistant': 'at_depth',
      'At Depth as User': 'at_depth',
    };

    // Use js-yaml's `loadAll` to safely handle multiple documents,
    // which is more robust than splitting the string manually.
    const documents = window.jsyaml.loadAll(yamlText);

    // 获取现有条目以计算最大UID
    const existingEntries = (await window.parent.getWorldbook?.(lorebookName)) || [];
    let maxUid = 0;
    if (existingEntries && existingEntries.length > 0) {
      maxUid = Math.max(...existingEntries.map(e => (typeof e.uid === 'number' ? e.uid : parseInt(e.uid) || 0)));
    }

    const entriesToCreate = [];
    for (const doc of documents) {
      // Skip any empty documents that might result from extra `---`
      if (!doc || typeof doc !== 'object') continue;

      if (!doc.trigger || !doc.trigger.Title || !doc.content) {
        // Try to find a title for a better error message
        const entryIdentifier = doc.trigger?.Title || doc.uid || '未知条目';
        throw new Error(`条目 "${entryIdentifier}" 缺少 "trigger.Title" 或 "content" 字段。`);
      }

      entriesToCreate.push({
        uid: maxUid + 1 + entriesToCreate.length,
        name: doc.trigger.Title,
        content: doc.content,
        enabled: doc.enabled !== undefined ? doc.enabled : true,
        probability: doc.probability !== undefined ? doc.probability : 100,
        strategy: {
          type: yamlTypeToApiType[doc.trigger.type] || 'selective',
          keys: doc.trigger.Comma_separated_list
            ? doc.trigger.Comma_separated_list.split(',')
                .map(k => k.trim())
                .filter(Boolean)
            : [],
        },
        position: {
          type: yamlPositionToApiPosition[doc.trigger.position] || 'after_character_definition',
          depth: doc.trigger.depth !== undefined ? doc.trigger.depth : 0,
          order: doc.trigger.order !== undefined ? doc.trigger.order : 100,
        },
      });
    }

    if (entriesToCreate.length === 0) throw new Error('未找到任何有效的条目。请检查YAML格式。');

    const result = await createWorldbookEntries(lorebookName, entriesToCreate);
    alert(`成功导入 ${result.new_entries.length} 个条目到 "${lorebookName}"！`);
    $modal.hide();
    return true;
  } catch (error) {
    console.error('角色世界书: 批量导入失败', error);
    $errorDisplay.text(`导入失败: ${error.message}`).show();
    return false;
  } finally {
    $confirmBtn.text('确认导入').prop('disabled', false);
  }
}, 'handleBulkImport');

// 【重构】批量导入模块
export function initBulkImport() {
  const parentDoc = window.parent.document;

  if ($('#enhanced-lorebook-import-styles', parentDoc).length === 0) {
    const importStyles = `
            <style id="enhanced-lorebook-import-styles">
                #${IMPORT_MODAL_ID} {
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
                #${IMPORT_MODAL_ID}-content {
                    background: var(--panel-bg-color, #2a2a2a);
                    color: var(--panel-text-color, #eee);
                    padding: 0;
                    border: 1px solid rgba(255,255,255,0.15);
                    width: 95%;
                    max-width: 700px;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                    max-height: calc(100vh - 100px);
                    display: flex;
                    flex-direction: column;
                    margin: 50px auto;
                    box-sizing: border-box;
                }
                #${IMPORT_MODAL_ID}-header {
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
                #${IMPORT_MODAL_ID}-header h4 {
                    margin: 0;
                    font-size: 1.1em;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--panel-text-color, white);
                }
                #${IMPORT_MODAL_ID}-header h4::before {
                    content: "📝";
                    font-size: 1.2em;
                }
                #${IMPORT_MODAL_ID} .close-button {
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
                #${IMPORT_MODAL_ID} .close-button:hover {
                    background-color: rgba(255,255,255,0.2);
                    transform: rotate(90deg);
                }
                #${IMPORT_MODAL_ID}-body {
                    padding: 20px;
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    overflow-y: auto;
                }
                #${IMPORT_MODAL_ID}-body > p {
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
                #${IMPORT_MODAL_ID}-textarea {
                    width: 100%;
                    min-height: 300px;
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
                #${IMPORT_MODAL_ID}-textarea:focus {
                    outline: none;
                    border-color: var(--panel-accent-color, #7a5abe);
                    background-color: var(--yaml-input-bg-color, #353535);
                    box-shadow: 0 0 0 3px color-mix(in srgb, var(--panel-accent-color, #7a5abe) 20%, transparent);
                }
                #${IMPORT_MODAL_ID}-textarea::placeholder {
                    color: var(--panel-text-color, #777);
                    opacity: 0.4;
                }
                #${IMPORT_MODAL_ID}-footer {
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
                #${IMPORT_MODAL_ID}-footer button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.95em;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                #${IMPORT_MODAL_ID}-cancel {
                    background-color: var(--panel-entry-bg-color, #555);
                    color: var(--panel-text-color, white);
                }
                #${IMPORT_MODAL_ID}-cancel:hover {
                    filter: brightness(1.2);
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }
                #${IMPORT_MODAL_ID}-confirm {
                    background: var(--panel-accent-color, #5a3a8e);
                    color: var(--panel-text-color, white);
                }
                #${IMPORT_MODAL_ID}-confirm:hover:not(:disabled) {
                    filter: brightness(1.15);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px color-mix(in srgb, var(--panel-accent-color, #5a3a8e) 40%, transparent);
                }
                #${IMPORT_MODAL_ID}-confirm:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                #${IMPORT_MODAL_ID}-error {
                    color: #ff6b6b;
                    font-size: 0.9em;
                    padding: 10px 12px;
                    background-color: rgba(255, 107, 107, 0.1);
                    border: 1px solid rgba(255, 107, 107, 0.3);
                    border-radius: 6px;
                    display: none;
                    margin-top: 8px;
                }
                #${IMPORT_MODAL_ID}-error::before {
                    content: "⚠️ ";
                }
                /* 示例代码块样式 */
                .yaml-example-container {
                    margin-bottom: 12px;
                }
                .yaml-example-toggle {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background-color: var(--panel-entry-bg-color, rgba(0,0,0,0.2));
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: var(--panel-text-color, #bbb);
                    font-size: 0.9em;
                }
                .yaml-example-toggle:hover {
                    background-color: var(--panel-entry-bg-color, rgba(0,0,0,0.3));
                    border-color: var(--panel-accent-color, #5a3a8e);
                }
                .yaml-example-toggle .toggle-icon {
                    transition: transform 0.2s ease;
                    font-size: 0.8em;
                }
                .yaml-example-toggle.expanded .toggle-icon {
                    transform: rotate(180deg);
                }
                .yaml-example-code {
                    display: none;
                    margin-top: 8px;
                    position: relative;
                }
                .yaml-example-code.show {
                    display: block;
                }
                .yaml-example-code pre {
                    margin: 0;
                    padding: 12px;
                    background-color: var(--yaml-input-bg-color, #2d2d2d);
                    color: var(--panel-text-color, #f0f0f0);
                    border: 2px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                    font-size: 0.85em;
                    line-height: 1.6;
                    overflow-x: auto;
                    white-space: pre;
                }
                .yaml-copy-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    padding: 6px 12px;
                    background: var(--panel-accent-color, #5a3a8e);
                    color: var(--panel-text-color, white);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8em;
                    transition: all 0.2s ease;
                    opacity: 0.9;
                }
                .yaml-copy-btn:hover {
                    opacity: 1;
                    filter: brightness(1.15);
                }
                .yaml-copy-btn.copied {
                    background: #4caf50;
                }
            </style>
        `;
    $('head', parentDoc).append(importStyles);
  }

  if ($(`#${IMPORT_MODAL_ID}`, parentDoc).length === 0) {
    const modalHtml = `
            <div id="${IMPORT_MODAL_ID}" style="display: none;">
                <div id="${IMPORT_MODAL_ID}-content">
                    <div id="${IMPORT_MODAL_ID}-header">
                        <h4>批量导入条目</h4>
                        <span class="close-button">&times;</span>
                    </div>
                    <div id="${IMPORT_MODAL_ID}-body">
                        <p>将YAML格式的条目文本粘贴到下方 (支持多个条目，用 --- 分隔):</p>
                        <div class="yaml-example-container">
                            <div class="yaml-example-toggle">
                                <span>📖 查看YAML示例格式</span>
                                <span class="toggle-icon">▼</span>
                            </div>
                            <div class="yaml-example-code">
                                <button class="yaml-copy-btn" title="复制示例代码">📋 复制</button>
                                <pre>---
trigger:
  Title: '示例条目'
  type: 'Normal'
  Comma_separated_list: '关键词1, 关键词2'
  position: 'After Character Definition'
  depth: 0
  order: 100
content: '这是条目的内容。'
enabled: true
probability: 100
---
trigger:
  Title: '第二个条目'
  type: 'Constant'
  position: 'Before Character Definition'
content: '这是第二个条目的内容。'</pre>
                            </div>
                        </div>
                        <textarea id="${IMPORT_MODAL_ID}-textarea" placeholder="在此粘贴YAML格式的条目..."></textarea>
                        <div id="${IMPORT_MODAL_ID}-error"></div>
                    </div>
                    <div id="${IMPORT_MODAL_ID}-footer">
                        <button id="${IMPORT_MODAL_ID}-cancel" class="lorebook-copy-cancel-btn">取消</button>
                        <button id="${IMPORT_MODAL_ID}-confirm" class="lorebook-copy-confirm-btn">确认导入</button>
                    </div>
                </div>
            </div>
        `;
    $('body', parentDoc).append(modalHtml);
  }

  const $modal = $(`#${IMPORT_MODAL_ID}`, parentDoc);
  $(parentDoc).on('click', `#${IMPORT_MODAL_ID} .close-button, #${IMPORT_MODAL_ID}-cancel`, () => {
    $modal.hide();
  });
  $modal.on('click', e => {
    if (e.target.id === IMPORT_MODAL_ID) $modal.hide();
  });

  // 示例代码折叠/展开功能
  $(parentDoc).on('click', '.yaml-example-toggle', function () {
    const $toggle = $(this);
    const $code = $toggle.siblings('.yaml-example-code');
    $toggle.toggleClass('expanded');
    $code.toggleClass('show');
  });

  // 复制示例代码功能
  $(parentDoc).on('click', '.yaml-copy-btn', function (e) {
    e.stopPropagation();
    const $btn = $(this);
    const codeText = $btn.siblings('pre').text();

    // 使用现代剪贴板API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(codeText)
        .then(() => {
          $btn.text('✅ 已复制').addClass('copied');
          setTimeout(() => {
            $btn.text('📋 复制').removeClass('copied');
          }, 2000);
        })
        .catch(err => {
          console.error('复制失败:', err);
          fallbackCopy(codeText, $btn);
        });
    } else {
      // 降级方案
      fallbackCopy(codeText, $btn);
    }
  });

  // 降级复制方案
  function fallbackCopy(text, $btn) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      $btn.text('✅ 已复制').addClass('copied');
      setTimeout(() => {
        $btn.text('📋 复制').removeClass('copied');
      }, 2000);
    } catch (err) {
      console.error('降级复制失败:', err);
      alert('复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
  }
}
