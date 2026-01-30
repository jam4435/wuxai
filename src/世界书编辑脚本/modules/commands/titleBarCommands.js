/**
 * 标题栏操作相关命令
 * 处理筛选、优化器、批量导入、批量操作、全选等标题栏上的操作
 */

import { createNewLorebookEntry } from '../api.js';
import {
  DEBUG_MODE,
  LOREBOOK_ENTRY_CHECKBOX_CLASS,
  LOREBOOK_ENTRY_CLASS,
} from '../config.js';
import {
  adjustSelectedEntriesPosition,
  batchUpdateEntries,
  copySelectedEntries,
  deleteSelectedEntries,
  toggleAllEntries,
} from '../features/batchActions.js';
import { handleBulkImport } from '../features/bulkImport.js';
import { getActiveFilters, setActiveFilter } from '../state.js';
import { updateHeaderCheckboxState, updateVirtualScroll } from '../ui/list.js';
import { registerCommands } from './index.js';

/**
 * 设置筛选条件
 */
function setFilter({ $target, lorebookName }) {
  const filterType = $target.data('filter-type');
  const value = $target.prop('checked');

  if (DEBUG_MODE) {
    console.log(`[Filter] ${lorebookName}: ${filterType} = ${value}`);
  }

  if (!lorebookName) {
    console.error('[Filter] 错误: lorebookName 未获取到');
  }

  setActiveFilter(lorebookName, filterType, value);

  // Refresh UI to reflect filter state
  const $dropdown = $target.closest('.filter-dropdown');
  const filters = getActiveFilters(lorebookName);
  $dropdown.find('input[type="checkbox"]').each(function () {
    const $cb = $(this);
    const type = $cb.data('filter-type');
    $cb.prop('checked', !!filters[type]);
  });

  // Reload the entries list using the efficient virtual scroll update
  updateVirtualScroll(lorebookName);
}

/**
 * 打开优化器模态框
 */
function openOptimizer({ lorebookName, isGlobal, parentDoc }) {
  const $modal = $('#lorebook-optimize-modal', parentDoc);
  $modal.find('#lorebook-optimize-modal-title').text(`世界书优化工具: ${lorebookName}`);
  $modal.data('lorebook-name', lorebookName);
  $modal.data('is-global', isGlobal);
  $modal.css('display', 'flex');
}

/**
 * 打开批量导入模态框
 */
function bulkImport({ lorebookName, isGlobal, parentDoc, refreshList }) {
  const IMPORT_MODAL_ID = 'lorebook-import-modal';
  const $modal = $(`#${IMPORT_MODAL_ID}`, parentDoc);
  $modal.find(`#${IMPORT_MODAL_ID}-textarea`).val('');
  $modal.find(`#${IMPORT_MODAL_ID}-error`).hide();
  $modal.find(`#${IMPORT_MODAL_ID}-confirm`).text('确认导入').prop('disabled', false);
  $modal.find(`#${IMPORT_MODAL_ID}-header h4`).text(`批量导入到: ${lorebookName}`);
  $modal
    .find(`#${IMPORT_MODAL_ID}-confirm`)
    .off('click')
    .on('click', async () => {
      const success = await handleBulkImport(lorebookName, isGlobal);
      if (success) {
        refreshList(lorebookName, isGlobal);
      }
    });
  $modal.css('display', 'flex');
}

/**
 * 复制选中的条目
 */
async function copyEntries({ lorebookName, isGlobal }) {
  await copySelectedEntries(lorebookName, isGlobal);
}

/**
 * 调整选中条目的位置
 */
async function adjustPosition({ lorebookName, isGlobal, refreshList }) {
  if (await adjustSelectedEntriesPosition(lorebookName, isGlobal)) {
    refreshList(lorebookName, isGlobal);
  }
}

/**
 * 删除选中的条目
 */
async function deleteEntries({ lorebookName, isGlobal, refreshList }) {
  if (await deleteSelectedEntries(lorebookName, isGlobal)) {
    refreshList(lorebookName, isGlobal);
  }
}

/**
 * 添加新条目
 */
async function addEntry({ lorebookName, isGlobal, refreshList }) {
  if (await createNewLorebookEntry(lorebookName, isGlobal)) {
    refreshList(lorebookName, isGlobal);
  }
}

/**
 * 反转字段值
 */
async function invert({ $target, lorebookName, isGlobal, refreshList }) {
  const field = $target.closest('[data-field]').data('field');
  const title = $target.closest('[title]').attr('title');
  const message = `确定要${title}吗？`;
  if (await batchUpdateEntries(lorebookName, isGlobal, { invert: field }, message)) {
    refreshList(lorebookName, isGlobal);
  }
}

/**
 * 执行批量切换操作
 */
async function executeBatchToggle({ $target, lorebookName, isGlobal, parentDoc, refreshList }) {
  const $dropdown = $target.closest('.batch-toggle-dropdown');
  const operation = $dropdown.find('input[name="batch-operation"]:checked').val();
  const selectedFields = $dropdown
    .find('.batch-toggle-checkbox-group input:checked')
    .map(function () {
      return $(this).val();
    })
    .get();

  if (DEBUG_MODE) {
    console.log('[批量操作] 操作类型:', operation, '选中字段:', selectedFields);
  }

  if (selectedFields.length === 0) {
    window.toastr?.warning('请至少选择一个操作字段');
    return;
  }

  const fieldNames = {
    enabled: '启用状态',
    'strategy.type': '激活模式',
    'recursion.prevent_outgoing': '防止递归',
    'recursion.prevent_incoming': '排除递归',
  };
  const operationNames = { enable: '全开', disable: '全关', invert: '反转' };
  const fieldList = selectedFields.map(f => fieldNames[f]).join('、');
  const message = `确定要对 ${fieldList} 进行${operationNames[operation]}操作吗？`;

  if (!confirm(message)) {
    return;
  }

  let successCount = 0;
  for (const field of selectedFields) {
    let updateData;
    if (operation === 'invert') {
      updateData = { invert: field };
    } else if (operation === 'enable') {
      if (field === 'enabled') {
        updateData = { [field]: true };
      } else if (field === 'strategy.type') {
        updateData = { [field]: 'constant' };
      } else if (field.startsWith('recursion.')) {
        updateData = { [field]: true };
      }
    } else if (operation === 'disable') {
      if (field === 'enabled') {
        updateData = { [field]: false };
      } else if (field === 'strategy.type') {
        updateData = { [field]: 'selective' };
      } else if (field.startsWith('recursion.')) {
        updateData = { [field]: false };
      }
    }

    if (await batchUpdateEntries(lorebookName, isGlobal, updateData, null)) {
      successCount++;
    }
  }

  if (successCount > 0) {
    $('.lorebook-batch-toggle-container', parentDoc).removeClass('active');
    refreshList(lorebookName, isGlobal);
  }
}

/**
 * 全选/取消全选
 */
function selectAll({ $actionTarget, lorebookName, isGlobal, parentDoc }) {
  // 从按钮获取属性，优先使用按钮自己的属性
  const buttonLorebookName = $actionTarget.attr('data-lorebook-name') || lorebookName;
  // 正确处理字符串到布尔值的转换
  const buttonIsGlobalAttr = $actionTarget.attr('data-is-global');
  const buttonIsGlobal = buttonIsGlobalAttr !== undefined ? buttonIsGlobalAttr === 'true' : isGlobal;

  // 构建正确的选择器
  const containerSelector = buttonIsGlobal
    ? `.lorebook-entries-container[data-lorebook-name="${buttonLorebookName}"][data-is-global="true"]`
    : `.lorebook-entries-container[data-lorebook-name="${buttonLorebookName}"]:not([data-is-global="true"])`;

  const $container = $(containerSelector, parentDoc);

  if ($container.length) {
    const $allCheckboxes = $container.find(`.${LOREBOOK_ENTRY_CHECKBOX_CLASS}`);
    const $checkedCheckboxes = $allCheckboxes.filter(':checked');
    const shouldSelectAll = $checkedCheckboxes.length < $allCheckboxes.length;

    toggleAllEntries(buttonLorebookName, buttonIsGlobal, shouldSelectAll);
  }
}

// 注册所有标题栏操作命令
registerCommands({
  'set-filter': setFilter,
  'open-optimizer': openOptimizer,
  'bulk-import': bulkImport,
  'copy-entries': copyEntries,
  'adjust-position': adjustPosition,
  'delete-entries': deleteEntries,
  'add-entry': addEntry,
  'invert': invert,
  'execute-batch-toggle': executeBatchToggle,
  'select-all': selectAll,
});
