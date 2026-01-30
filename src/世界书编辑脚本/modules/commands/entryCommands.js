/**
 * 条目操作相关命令
 * 处理条目的展开、编辑、切换状态、选择等操作
 */

import { saveEntryField, toggleEntryEnabled } from '../api.js';
import { DEBUG_MODE } from '../config.js';
import { addPinnedEntry, removePinnedEntry } from '../settings.js';
import { allEntriesData, toggleEntrySelection, virtualScrollers } from '../state.js';
import { showContentEditor } from '../ui/contentEditor.js';
import { showEntryEditor } from '../ui/editor.js';
import { toggleExpanded } from '../ui/expandManager.js';
import { updateHeaderCheckboxState, updateVirtualScroll } from '../ui/list.js';
import { ensureNumericUID } from '../utils.js';
import { registerCommands } from './index.js';

/**
 * 打开条目编辑器
 */
function openEditor({ event, lorebookName, numericUid, isGlobal }) {
  if ($(event.target).hasClass('entry-header')) {
    showEntryEditor(lorebookName, numericUid, isGlobal);
  }
}

/**
 * 展开/折叠条目
 */
function expand({ $item, lorebookName, numericUid }) {
  // 获取虚拟滚动实例以获取 styleHeight
  const clusterize = virtualScrollers[lorebookName];
  const styleHeight = clusterize?.options?.item_height ? clusterize.options.item_height - 8 : null;

  // 使用 expandManager 统一处理展开/折叠
  const newExpandedState = toggleExpanded($item, lorebookName, numericUid, styleHeight, true);

  if (DEBUG_MODE) {
    console.log(`[Expand] ${lorebookName}/${numericUid} -> ${newExpandedState}`);
  }

  // 初始化token计数
  if (newExpandedState) {
    const $textarea = $item.find('.content-textarea');
    const content = $textarea.val() || '';
    const $counter = $item.find('.token-counter');
    $counter.text('计算中...');

    // 使用酒馆的真实tokenizer计算token数
    if (window.SillyTavern && window.SillyTavern.getTokenCountAsync) {
      window.SillyTavern.getTokenCountAsync(content)
        .then(tokenCount => {
          $counter.text(`${tokenCount} 词符`);
        })
        .catch(err => {
          console.warn('Token计数失败，使用字符数作为后备:', err);
          $counter.text(`${content.length} 字符`);
        });
    } else {
      // 后备方案：使用字符数
      $counter.text(`${content.length} 字符`);
    }
  }
}

/**
 * 切换条目启用状态
 */
async function toggleEnabled({ $target, $item, lorebookName, numericUid }) {
  const newState = $target.prop('checked');
  const success = await toggleEntryEnabled(lorebookName, numericUid, newState);
  if (success) {
    $item.toggleClass('disabled-entry', !newState).attr('data-enabled', newState);
  } else {
    $target.prop('checked', !newState);
  }
}

/**
 * 编辑条目标题
 */
function editTitle({ event, $target, lorebookName, numericUid }) {
  if (event.type === 'change') {
    saveEntryField(numericUid, lorebookName, 'name', $target.val());
  }
}

/**
 * 切换常驻/关键字模式
 */
function toggleConstant({ $target, lorebookName, numericUid }) {
  const isNowConstant = $target.prop('checked');
  $target
    .next('.mini-toggle-slider')
    .toggleClass('constant', isNowConstant)
    .toggleClass('keyword', !isNowConstant);
  saveEntryField(numericUid, lorebookName, 'strategy.type', isNowConstant ? 'constant' : 'selective');
}

/**
 * 编辑插入位置
 */
function editPosition({ $target, $item, lorebookName, numericUid }) {
  const newPosition = $target.val();
  const $depthInput = $item.find('[data-action="edit-depth"]');
  const needsDepth = newPosition === 'at_depth';
  $depthInput.prop('disabled', !needsDepth);
  $depthInput.closest('.depth-input-container').toggleClass('depth-disabled', !needsDepth);
  saveEntryField(numericUid, lorebookName, 'position.type', newPosition);
}

/**
 * 编辑深度
 */
function editDepth({ event, $target, lorebookName, numericUid }) {
  if (event.type === 'change' && !$target.prop('disabled')) {
    saveEntryField(numericUid, lorebookName, 'position.depth', parseInt($target.val()));
  }
}

/**
 * 编辑顺序
 */
function editOrder({ event, $target, lorebookName, numericUid }) {
  if (event.type === 'change') {
    saveEntryField(numericUid, lorebookName, 'position.order', parseInt($target.val()));
  }
}

/**
 * 编辑概率
 */
function editProb({ event, $target, lorebookName, numericUid }) {
  if (event.type === 'change') {
    saveEntryField(numericUid, lorebookName, 'probability', parseInt($target.val()));
  }
}

/**
 * 打开内容编辑器
 */
async function openContentEditor({ lorebookName, numericUid }) {
  await showContentEditor(lorebookName, numericUid);
}

/**
 * 选择条目
 */
function selectEntry({ $target, lorebookName, numericUid, isGlobal }) {
  const isSelected = $target.prop('checked');
  toggleEntrySelection(lorebookName, numericUid, isSelected);
  updateHeaderCheckboxState(lorebookName, isGlobal);
}

/**
 * 编辑内容
 */
function editContent({ event, $target, $item, lorebookName, numericUid }) {
  if (event.type === 'change') {
    saveEntryField(numericUid, lorebookName, 'content', $target.val());
  }
  if (event.type === 'input') {
    const content = $target.val() || '';
    const $counter = $item.find('.token-counter');

    // 使用酒馆的真实tokenizer计算token数
    if (window.SillyTavern && window.SillyTavern.getTokenCountAsync) {
      window.SillyTavern.getTokenCountAsync(content)
        .then(tokenCount => {
          $counter.text(`${tokenCount} 词符`);
        })
        .catch(err => {
          console.warn('Token计数失败，使用字符数作为后备:', err);
          $counter.text(`${content.length} 字符`);
        });
    } else {
      // 后备方案：使用字符数
      $counter.text(`${content.length} 字符`);
    }
  }
}

/**
 * 编辑主关键字
 */
function editKeys({ event, $target, lorebookName, numericUid }) {
  if (event.type === 'change') {
    const newKeywords = $target
      .val()
      .split(',')
      .map(k => k.trim())
      .filter(k => k);
    saveEntryField(numericUid, lorebookName, 'strategy.keys', newKeywords);
  }
}

/**
 * 编辑次要关键字
 */
function editKeysSecondary({ event, $target, lorebookName, numericUid }) {
  if (event.type === 'change') {
    const newKeywords = $target
      .val()
      .split(',')
      .map(k => k.trim())
      .filter(k => k);
    saveEntryField(numericUid, lorebookName, 'strategy.keys_secondary.keys', newKeywords);
  }
}

/**
 * 编辑次要关键字逻辑
 */
function editKeysSecondaryLogic({ event, $target, lorebookName, numericUid }) {
  if (event.type === 'change') {
    saveEntryField(numericUid, lorebookName, 'strategy.keys_secondary.logic', $target.val());
  }
}

/**
 * 切换防止递归
 */
function togglePreventOutgoing({ $target, lorebookName, numericUid }) {
  saveEntryField(numericUid, lorebookName, 'recursion.prevent_outgoing', $target.prop('checked'));
}

/**
 * 切换排除递归
 */
function togglePreventIncoming({ $target, lorebookName, numericUid }) {
  saveEntryField(numericUid, lorebookName, 'recursion.prevent_incoming', $target.prop('checked'));
}

/**
 * 切换延迟递归
 */
function toggleDelayRecursion({ $target, lorebookName, numericUid }) {
  saveEntryField(numericUid, lorebookName, 'recursion.delay_until', $target.prop('checked'));
}

/**
 * 切换置顶
 */
async function togglePinned({ $target, lorebookName, numericUid }) {
  const isChecked = $target.prop('checked');

  // 步骤 1: 更新持久化存储
  if (isChecked) {
    addPinnedEntry(lorebookName, numericUid);
  } else {
    removePinnedEntry(lorebookName, numericUid);
  }

  // 步骤 2: 立即在前端内存状态中更新
  const entryToUpdate = allEntriesData[lorebookName].find(e => ensureNumericUID(e.uid) === numericUid);
  if (entryToUpdate) {
    entryToUpdate.pinned = isChecked;
  }

  // 步骤 3: 调用无感刷新，UI立即响应
  await updateVirtualScroll(lorebookName);
}

// 注册所有条目操作命令
registerCommands({
  'open-editor': openEditor,
  'expand': expand,
  'toggle-enabled': toggleEnabled,
  'edit-title': editTitle,
  'toggle-constant': toggleConstant,
  'edit-position': editPosition,
  'edit-depth': editDepth,
  'edit-order': editOrder,
  'edit-prob': editProb,
  'open-content-editor': openContentEditor,
  'select-entry': selectEntry,
  'edit-content': editContent,
  'edit-keys': editKeys,
  'edit-keys-secondary': editKeysSecondary,
  'edit-keys-secondary-logic': editKeysSecondaryLogic,
  'toggle-prevent-outgoing': togglePreventOutgoing,
  'toggle-prevent-incoming': togglePreventIncoming,
  'toggle-delay-recursion': toggleDelayRecursion,
  'toggle-pinned': togglePinned,
});
