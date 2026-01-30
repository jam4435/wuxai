import { LOREBOOK_ENTRY_CHECKBOX_CLASS, LOREBOOK_ENTRY_CLASS, LOREBOOK_PANEL_ID } from '../config.js';
import { allEntriesData, getSelectedEntries } from '../state.js';
import { ensureNumericUID, errorCatched } from '../utils.js';
import { batchUpdateEntries } from './batchActions.js';

export function initOptimizer() {
  const parentDoc = window.parent.document;
  if ($('#lorebook-optimize-modal', parentDoc).length > 0) return;

  const optimizeModalHtml = `
        <div id="lorebook-optimize-modal" style="display:none; position: fixed; z-index: 10002; left: 0; top: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0.7); overflow-y: auto; box-sizing: border-box;">
            <div id="lorebook-optimize-modal-content" style="background-color: #2c2c2c; color: #eee; padding: 0; border: 1px solid #555; width: 90%; max-width: 600px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column; max-height: calc(100vh - 150px); margin: 80px auto 50px auto; box-sizing: border-box;">
                <div id="lorebook-optimize-modal-header" style="padding: 10px 15px; background-color: #3a6a8e; color: white; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <h4 id="lorebook-optimize-modal-title">世界书优化工具</h4>
                    <span class="close-button" style="font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
                </div>
                <div id="lorebook-optimize-modal-body" style="padding: 15px; display: flex; flex-direction: column; gap: 20px; max-height: 70vh; overflow-y: auto;">
                    <!-- 1. 删除无用格式 -->
                    <div class="optimize-section">
                        <h5>1. 格式清理</h5>
                        <p class="description">清理选中条目内容中的多余格式：删除所有**和*。</p>
                        <div class="action-area">
                            <button data-action="run-format-cleanup">执行格式清理</button>
                        </div>
                    </div>
                    <!-- 2. 关键字修复 -->
                    <div class="optimize-section">
                        <h5>2. 关键字修复</h5>
                        <p class="description">修复并拆分因误用中文逗号（，）而未能正确识别的关键字。</p>
                        <div class="action-area">
                            <button data-action="run-keyword-fix">执行关键字修复</button>
                        </div>
                    </div>
                    <!-- 3. 排序优化 -->
                    <div class="optimize-section">
                        <h5>3. 顺序重排</h5>
                        <p class="description">为选中的、属于同一插入位置的条目，自定义起始编号和步长来重新排序。</p>
                        <div class="action-area">
                            <button data-action="run-reorder-entries-interactive">打开排序工具</button>
                        </div>
                    </div>
                    <!-- 4. 深度优化 -->
                    <div class="optimize-section">
                        <h5>4. 深度合并</h5>
                        <p class="description">将选中条目中，深度在0-10范围内的条目，全部合并到深度0，并按当前UI顺序重新排序。</p>
                        <div class="action-area">
                            <button data-action="run-depth-optimization">执行深度合并</button>
                        </div>
                    </div>
                    <!-- 5. 删除八股词 -->
                    <div class="optimize-section">
                        <h5>5. 八股词清理</h5>
                        <p class="description">输入要删除的八股词，每行一个。将从选中条目的内容中删除这些词。</p>
                        <div class="action-area" style="flex-direction: column; align-items: stretch;">
                            <textarea id="optimize-cliche-words-textarea" placeholder="输入或粘贴八股词，每行一个...">像是,如同,好像,像,就像,似乎,仿佛,可能,大概,近乎,几乎,猛地,狂野,激烈,恨不,狂喜,一丝,一些,一抹,一种,揉进身体,指甲掐进,猛地,重重地,弓起,吞噬,cố gắng,手术刀,涟漪,石子,泛白,指节发白</textarea>
                            <button data-action="run-cliche-cleanup" style="margin-top: 10px;">执行八股词清理</button>
                        </div>
                    </div>
                    <!-- 6. 全局搜索替换 -->
                    <div class="optimize-section" id="global-search-replace-area">
                        <h5>6. 全局搜索与替换</h5>
                        <p class="description">在 当前打开的世界书 的选中条目中进行搜索和替换。</p>
                        <div class="action-area" style="flex-direction: column; align-items: stretch; gap: 10px;">
                            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                                <input type="text" id="global-search-input" placeholder="要搜索的内容..." style="width: 100%; box-sizing: border-box; background-color: #333; color: #eee; border: 1px solid #555; padding: 8px; border-radius: 4px;">
                                <input type="text" id="global-replace-input" placeholder="替换为..." style="width: 100%; box-sizing: border-box; background-color: #333; color: #eee; border: 1px solid #555; padding: 8px; border-radius: 4px;">
                            </div>
                            <div class="search-scope-container" style="display: flex; gap: 15px; align-items: center; font-size: 0.9em;">
                                <strong>搜索范围:</strong>
                                <label><input type="checkbox" class="search-scope-checkbox" value="name" checked> 标题</label>
                                <label><input type="checkbox" class="search-scope-checkbox" value="content" checked> 内容</label>
                                <label><input type="checkbox" class="search-scope-checkbox" value="keys"> 关键词</label>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <label style="display: flex; align-items: center; gap: 5px;">
                                    <input type="checkbox" id="global-search-use-regex">
                                    <span>使用正则</span>
                                </label>
                                <div style="flex-grow: 1;"></div>
                                <button data-action="preview-global-search-replace">预览</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
  const reorderModalHtml = `
           <div id="lorebook-reorder-modal" style="display:none; position: fixed; z-index: 10003; left: 0; top: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0.7); overflow-y: auto; box-sizing: border-box; justify-content: center; align-items: center;">
               <div style="background-color: #2c2c2c; color: #eee; padding: 0; border: 1px solid #555; width: 85%; max-width: 320px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column; margin: auto; box-sizing: border-box;">
                   <div style="padding: 12px 15px; background-color: #3a6a8e; color: white; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                       <h4 style="margin: 0; font-size: 16px;">交互式顺序重排</h4>
                       <span class="close-button" style="font-size: 24px; font-weight: bold; cursor: pointer; line-height: 1;">&times;</span>
                   </div>
                   <div style="padding: 20px 15px; display: flex; flex-direction: column; gap: 16px;">
                       <div style="display: flex; justify-content: space-between; align-items: center;">
                           <label for="reorder-start-number" style="font-size: 14px;">起始编号</label>
                           <input type="number" id="reorder-start-number" value="0" style="width: 80px; background-color: #333; color: #eee; border: 1px solid #555; padding: 6px 8px; border-radius: 4px; box-sizing: border-box;">
                       </div>
                       <div style="display: flex; justify-content: space-between; align-items: center;">
                           <label for="reorder-step-number" style="font-size: 14px;">步长 (间隔)</label>
                           <input type="number" id="reorder-step-number" value="1" style="width: 80px; background-color: #333; color: #eee; border: 1px solid #555; padding: 6px 8px; border-radius: 4px; box-sizing: border-box;">
                       </div>
                       <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px;">
                           <button class="cancel-reorder-button" style="padding: 8px 16px; background-color: #666; border: none; color: white; cursor: pointer; border-radius: 4px; font-size: 14px;">取消</button>
                           <button id="confirm-reorder-button" style="padding: 8px 16px; background-color: #5a3a8e; border: none; color: white; cursor: pointer; border-radius: 4px; font-size: 14px;">确认重排</button>
                       </div>
                   </div>
               </div>
           </div>
       `;
  const searchPreviewModalHtml = `
           <div id="search-preview-modal" style="display:none; position: fixed; z-index: 10006; left: 0; top: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0.7); overflow-y: auto; box-sizing: border-box;">
               <div style="background-color: #2c2c2c; color: #eee; padding: 0; border: 1px solid #555; width: 90%; max-width: 800px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column; max-height: calc(100vh - 150px); margin: 80px auto 50px auto; box-sizing: border-box;">
                   <div style="padding: 10px 15px; background-color: #3a6a8e; color: white; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                       <h4>搜索替换预览</h4>
                       <span class="close-button" style="font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
                   </div>
                   <div style="padding: 15px; max-height: 70vh; overflow-y: auto;">
                       <div id="search-preview-summary"></div>
                       <div id="search-preview-list"></div>
                   </div>
                   <div style="padding: 10px 15px; text-align: right; border-top: 1px solid #444;">
                        <button id="cancel-search-replace-button" style="padding: 8px 12px; background-color: #555; border: none; color: white; cursor: pointer; border-radius: 4px; margin-right: 10px;">取消</button>
                        <button id="confirm-search-replace-button" style="padding: 8px 12px; background-color: #5a3a8e; border: none; color: white; cursor: pointer; border-radius: 4px;">确认替换</button>
                   </div>
               </div>
           </div>
       `;
  $('body', parentDoc).append(optimizeModalHtml).append(reorderModalHtml).append(searchPreviewModalHtml);

  // 为顺序重排弹窗的关闭按钮添加事件处理
  $('#lorebook-reorder-modal .close-button, #lorebook-reorder-modal .cancel-reorder-button', parentDoc).on(
    'click',
    function () {
      $('#lorebook-reorder-modal', parentDoc).hide();
    },
  );

  // 点击弹窗外部区域关闭弹窗
  $('#lorebook-reorder-modal', parentDoc).on('click', function (e) {
    if (e.target === this) {
      $(this).hide();
    }
  });
}

// 1. 格式清理
export const runFormatCleanup = errorCatched(async (lorebookName, isGlobal) => {
  const updateLogic = content => {
    if (typeof content !== 'string') return content;
    return content.replace(/\*\*/g, '').replace(/\*/g, ' ');
  };

  return await batchUpdateEntries(
    lorebookName,
    isGlobal,
    { content: updateLogic },
    '确定要对所有选中条目执行格式清理吗？',
  );
}, 'runFormatCleanup');

// 新增：关键字修复（修正版）
export const runKeywordFix = errorCatched(async (lorebookName, isGlobal) => {
  // 定义针对 keys 字段的更新逻辑
  const updateLogic = keys => {
    // 安全检查：确保我们处理的是一个数组
    if (!Array.isArray(keys)) {
      return keys;
    }

    // 使用 flatMap 来处理和“拍平”数组
    // 1. 遍历原数组中的每个 key（例如 '水果，苹果'）
    // 2. 将每个 key 按中文或英文逗号分割成一个新数组（例如 ['水果', '苹果']）
    // 3. flatMap 会将所有这些新数组合并成一个单一数组
    const newKeys = keys.flatMap(
      key =>
        typeof key === 'string'
          ? // 同时按中英文逗号分割，更具鲁棒性
            key
              .split(/[，,]/)
              .map(k => k.trim())
              .filter(Boolean)
          : [], // 如果不是字符串，则返回空数组以安全地忽略它
    );

    // 返回去重后的最终结果，以防拆分后出现重复项
    return [...new Set(newKeys)];
  };

  // 调用通用的批量更新函数
  return await batchUpdateEntries(
    lorebookName,
    isGlobal,
    { 'strategy.keys': updateLogic },
    '确定要对所有选中条目的关键字进行拆分和修复吗？',
  );
}, 'runKeywordFix');

// 2. 顺序(Order)重排
export const runReorderEntries = errorCatched(async (lorebookName, isGlobal) => {
  if (typeof updateWorldbookWith !== 'function') {
    alert('核心函数 updateWorldbookWith 不可用，无法执行操作。');
    return false;
  }

  const parentDoc = window.parent.document;
  const $container = $(`.lorebook-entries-container[data-lorebook-name="${lorebookName}"]`, parentDoc);
  const $selectedItems = $container
    .find(`.${LOREBOOK_ENTRY_CHECKBOX_CLASS}:checked`)
    .closest(`.${LOREBOOK_ENTRY_CLASS}`);

  if ($selectedItems.length < 2) {
    alert('请至少选择两个条目进行排序。');
    return false;
  }

  const groups = _.groupBy($selectedItems.get(), item => {
    const entryData = allEntriesData[lorebookName].find(
      e => ensureNumericUID(e.uid) === ensureNumericUID($(item).data('entry-uid')),
    );
    return _.get(entryData, 'position.type', 'unknown');
  });

  let modifiedCount = 0;
  let modifiedGroups = 0;
  let success = false;

  await updateWorldbookWith(lorebookName, entries => {
    let hasChanges = false;
    const updatedEntries = [...entries];

    for (const positionType in groups) {
      const itemsInGroup = groups[positionType];
      if (itemsInGroup.length > 1) {
        modifiedGroups++;
        const uidsInOrder = itemsInGroup.map(item => ensureNumericUID($(item).data('entry-uid')));

        let currentOrder = 0;
        uidsInOrder.forEach(uid => {
          const entryIndex = updatedEntries.findIndex(e => ensureNumericUID(e.uid) === uid);
          if (entryIndex !== -1) {
            const originalEntry = updatedEntries[entryIndex];
            if (_.get(originalEntry, 'position.order') !== currentOrder) {
              const entryToUpdate = _.cloneDeep(originalEntry);
              _.set(entryToUpdate, 'position.order', currentOrder);
              updatedEntries[entryIndex] = entryToUpdate;
              hasChanges = true;
              modifiedCount++;
            }
            currentOrder++;
          }
        });
      }
    }
    if (hasChanges) success = true;
    return hasChanges ? updatedEntries : entries;
  });

  if (modifiedCount > 0) {
    alert(`成功为 ${modifiedGroups} 个组中的 ${modifiedCount} 个条目重新排序！`);
  } else {
    alert('没有需要修改顺序的条目。请确保选中的条目属于同一插入位置且顺序需要更新。');
  }
  return success;
}, 'runReorderEntries');

// 3. 深度(Depth)合并
export const runDepthOptimization = errorCatched(async (lorebookName, isGlobal) => {
  const parentDoc = window.parent.document;
  const $panel = $(`#${LOREBOOK_PANEL_ID}`, parentDoc);
  const selectedUids = new Set();

  // 【修复问题2】始终从DOM中获取实际选中的复选框
  const containerSelector = isGlobal
    ? `.lorebook-entries-container[data-lorebook-name="${lorebookName}"][data-is-global="true"]`
    : `.lorebook-entries-container[data-lorebook-name="${lorebookName}"]:not([data-is-global="true"])`;

  const $container = $panel.find(containerSelector);
  $container.find(`.${LOREBOOK_ENTRY_CHECKBOX_CLASS}:checked`).each(function () {
    selectedUids.add(ensureNumericUID($(this).data('entry-uid')));
  });

  if (selectedUids.size === 0) {
    alert('请至少选择一个条目。');
    return false;
  }

  let modifiedCount = 0;
  let success = false;
  await updateWorldbookWith(lorebookName, entries => {
    let hasChanges = false;
    const entriesToModify = entries.filter(entry => selectedUids.has(ensureNumericUID(entry.uid)));
    const uidsToModify = entriesToModify.map(e => ensureNumericUID(e.uid));

    // 按UI当前顺序获取UIDs
    const $container = $panel.find(`.lorebook-entries-container[data-lorebook-name="${lorebookName}"]`);
    const uidsInOrder = $container
      .find(`.${LOREBOOK_ENTRY_CLASS}`)
      .map((i, el) => ensureNumericUID($(el).data('entry-uid')))
      .get()
      .filter(uid => selectedUids.has(uid));

    let currentOrder = 0;
    const updatedEntries = entries.map(entry => {
      const numericUid = ensureNumericUID(entry.uid);
      if (uidsInOrder.includes(numericUid)) {
        const positionType = _.get(entry, 'position.type');
        const currentDepth = _.get(entry, 'position.depth');

        if (positionType === 'at_depth' && currentDepth >= 1 && currentDepth <= 10) {
          const updatedEntry = _.cloneDeep(entry);
          _.set(updatedEntry, 'position.depth', 0);
          _.set(updatedEntry, 'position.order', currentOrder++);
          modifiedCount++;
          hasChanges = true;
          return updatedEntry;
        }
      }
      return entry;
    });

    if (hasChanges) success = true;
    return hasChanges ? updatedEntries : entries;
  });

  if (modifiedCount > 0) {
    alert(`成功将 ${modifiedCount} 个条目的深度合并到0！`);
  } else {
    alert('选中的条目中没有需要进行深度合并的条目。');
  }
  return success;
}, 'runDepthOptimization');

// 4. 八股词清理
export const runClicheCleanup = errorCatched(async (lorebookName, isGlobal) => {
  const parentDoc = window.parent.document;
  const clicheWordsText = $('#optimize-cliche-words-textarea', parentDoc).val();
  if (!clicheWordsText.trim()) {
    alert('请输入要删除的八股词。');
    return false;
  }

  const clicheWords = clicheWordsText
    .split(/,|\n/)
    .map(word => word.trim())
    .filter(Boolean);
  if (clicheWords.length === 0) {
    alert('请输入有效的八股词。');
    return false;
  }

  const regex = new RegExp(clicheWords.map(word => _.escapeRegExp(word)).join('|'), 'g');

  const cleanupFunc = content => {
    if (typeof content !== 'string') return content;
    return content.replace(regex, '');
  };

  return await batchUpdateEntries(
    lorebookName,
    isGlobal,
    { content: cleanupFunc },
    `确定要从选中条目中删除 ${clicheWords.length} 个八股词吗？`,
  );
}, 'runClicheCleanup');

// 【新功能】全局搜索与替换的核心实现
export const previewGlobalSearchAndReplace = errorCatched(async (lorebookName, isGlobal) => {
  const parentDoc = window.parent.document;
  const $optimizeModal = $('#lorebook-optimize-modal', parentDoc);
  const $previewModal = $('#search-preview-modal', parentDoc);

  const searchTerm = $('#global-search-input', $optimizeModal).val();
  const replaceTerm = $('#global-replace-input', $optimizeModal).val();
  const scopes = $('.search-scope-checkbox:checked', $optimizeModal)
    .map((i, el) => $(el).val())
    .get();
  const useRegex = $('#global-search-use-regex', $optimizeModal).is(':checked');

  if (!searchTerm) {
    alert('请输入要搜索的内容。');
    return;
  }
  if (scopes.length === 0) {
    alert('请至少选择一个搜索范围（标题、内容或关键词）。');
    return;
  }

  // 如果使用正则，验证正则表达式是否有效
  if (useRegex) {
    try {
      new RegExp(searchTerm);
    } catch (e) {
      alert('无效的正则表达式：' + e.message);
      return;
    }
  }

  const selectedUids = getSelectedEntries(lorebookName);

  if (selectedUids.length === 0) {
    alert('请至少选择一个要操作的条目。');
    return;
  }

  const entriesToSearch = (allEntriesData[lorebookName] || []).filter(entry =>
    selectedUids.includes(ensureNumericUID(entry.uid)),
  );
  const changes = [];

  entriesToSearch.forEach(entry => {
    const entryChanges = {
      uid: entry.uid,
      name: entry.name,
      previews: [],
    };

    const createPreview = (field, text) => {
      if (typeof text !== 'string') {
        return;
      }

      // 创建搜索正则表达式
      const regexPattern = useRegex ? searchTerm : _.escapeRegExp(searchTerm);
      // 尝试使用 s 标志（dotAll），如果浏览器不支持则回退到不使用
      let localSearchRegex;
      try {
        localSearchRegex = new RegExp(regexPattern, 'gs');
      } catch (e) {
        localSearchRegex = new RegExp(regexPattern, 'g');
      }

      // 快速检查是否有匹配（用于提前退出）
      if (!localSearchRegex.test(text)) {
        return;
      }
      // 重置 lastIndex 因为 test() 会改变它
      localSearchRegex.lastIndex = 0;

      const CONTEXT_LENGTH = 20;
      const MAX_MATCHES_PER_FIELD = 50; // 每个字段最多显示50个匹配
      let match;
      const diffs = [];
      let matchCount = 0;

      while ((match = localSearchRegex.exec(text)) !== null) {
        const matchedString = match;
        if (matchedString.length === 0) {
          localSearchRegex.lastIndex++;
          continue;
        }

        // 限制匹配数量，防止字符串过长
        if (++matchCount > MAX_MATCHES_PER_FIELD) {
          diffs.push({
            original: '...',
            changed: `<em>（还有更多匹配项未显示）</em>`,
          });
          break;
        }

        const startIndex = Math.max(0, match.index - CONTEXT_LENGTH);
        const endIndex = Math.min(text.length, match.index + matchedString.length + CONTEXT_LENGTH);
        const context = text.substring(startIndex, endIndex);

        // 高亮显示原始匹配项 - 分割字符串逐段处理避免转义问题
        let matchRegexForHighlight;
        if (useRegex) {
          try {
            matchRegexForHighlight = new RegExp(searchTerm, 'gs');
          } catch (e) {
            matchRegexForHighlight = new RegExp(searchTerm, 'g');
          }
        } else {
          matchRegexForHighlight = new RegExp(_.escapeRegExp(matchedString), 'g');
        }

        let originalHighlighted = '';
        let lastIndex = 0;
        const contextMatchRegex = new RegExp(matchRegexForHighlight.source, matchRegexForHighlight.flags);
        let contextMatch;
        while ((contextMatch = contextMatchRegex.exec(context)) !== null) {
          // 防止空匹配导致无限循环
          if (contextMatch[0].length === 0) {
            contextMatchRegex.lastIndex++;
            continue;
          }
          // 添加匹配前的普通文本
          originalHighlighted += _.escape(context.substring(lastIndex, contextMatch.index));
          // 添加高亮的匹配文本
          originalHighlighted += `<span class="search-highlight">${_.escape(contextMatch[0])}</span>`;
          lastIndex = contextMatchRegex.lastIndex;
        }
        // 添加最后剩余的文本
        originalHighlighted += _.escape(context.substring(lastIndex));

        // 执行替换并高亮替换结果
        // 这里也需要使用和搜索时相同的正则标志（包括 s 标志）
        let replaceRegex;
        if (useRegex) {
          try {
            replaceRegex = new RegExp(searchTerm, 'gs');
          } catch (e) {
            replaceRegex = new RegExp(searchTerm, 'g');
          }
        } else {
          replaceRegex = new RegExp(_.escapeRegExp(matchedString), 'g');
        }
        const replacedContext = context.replace(replaceRegex, replaceTerm);

        // 对替换后的结果进行高亮
        let changedHighlighted = '';

        // 如果替换内容为空，直接转义显示结果（不需要高亮）
        if (!replaceTerm || replaceTerm.length === 0) {
          changedHighlighted = _.escape(replacedContext);
        } else {
          // 否则高亮替换后的内容
          lastIndex = 0;
          const replacedMatchRegex = new RegExp(_.escapeRegExp(replaceTerm), 'g');
          let replacedMatch;
          while ((replacedMatch = replacedMatchRegex.exec(replacedContext)) !== null) {
            // 防止空匹配导致无限循环
            if (replacedMatch[0].length === 0) {
              replacedMatchRegex.lastIndex++;
              continue;
            }
            changedHighlighted += _.escape(replacedContext.substring(lastIndex, replacedMatch.index));
            changedHighlighted += `<span class="replace-highlight">${_.escape(replacedMatch[0])}</span>`;
            lastIndex = replacedMatchRegex.lastIndex;
          }
          changedHighlighted += _.escape(replacedContext.substring(lastIndex));
        }

        diffs.push({
          original: `...${originalHighlighted}...`,
          changed: `...${changedHighlighted}...`,
        });
      }

      if (diffs.length > 0) {
        entryChanges.previews.push({
          field: field,
          diffs: diffs,
        });
      }
    };

    if (scopes.includes('name')) createPreview('标题', entry.name);
    if (scopes.includes('content')) createPreview('内容', entry.content);
    if (scopes.includes('keys')) createPreview('关键词', (entry.strategy?.keys || []).join(', '));

    if (entryChanges.previews.length > 0) {
      changes.push(entryChanges);
    }
  });

  const $summary = $('#search-preview-summary', $previewModal);
  const $list = $('#search-preview-list', $previewModal);
  $list.empty();

  if (changes.length === 0) {
    $summary.text(`在 ${entriesToSearch.length} 个选中条目中未找到任何匹配项。`);
  } else {
    let totalChanges = 0;
    changes.forEach(c => c.previews.forEach(p => (totalChanges += p.diffs.length)));
    $summary.html(`将在 <strong>${changes.length}</strong> 个条目中执行 <strong>${totalChanges}</strong> 处更改。`);

    changes.forEach(change => {
      const previewHtml = `
                <div class="preview-item">
                    <h5>条目: ${_.escape(change.name)} (UID: ${change.uid})</h5>
                    ${change.previews
                      .map(
                        p => `
                        <div class="preview-field">
                            <strong>${p.field}:</strong>
                            ${p.diffs
                              .map(
                                d => `
                                <p class="original-text">原始: ${d.original}</p>
                                <p class="changed-text">更改为: ${d.changed}</p>
                            `,
                              )
                              .join('<hr class="diff-separator">')}
                        </div>
                    `,
                      )
                      .join('')}
                </div>
            `;
      $list.append(previewHtml);
    });
  }

  $previewModal
    .find('#confirm-search-replace-button')
    .off('click')
    .on('click', async () => {
      $previewModal.hide();
      const success = await executeGlobalSearchAndReplace(lorebookName, isGlobal);
      if (success) {
        const parentDoc = window.parent.document;
        const $entriesWrapper = $(`.lorebook-entries-wrapper[data-lorebook-name="${lorebookName}"]`, parentDoc);
        if ($entriesWrapper.is(':visible')) {
          const { loadLorebookEntries } = await import('../ui/list.js');
          await loadLorebookEntries(lorebookName, $entriesWrapper, isGlobal);
        }
      }
    });

  $previewModal
    .find('#cancel-search-replace-button, .close-button')
    .off('click')
    .on('click', () => {
      $previewModal.hide();
    });

  $previewModal.css('display', 'block');
}, 'previewGlobalSearchAndReplace');

export const executeGlobalSearchAndReplace = errorCatched(async (lorebookName, isGlobal) => {
  const parentDoc = window.parent.document;
  const $optimizeModal = $('#lorebook-optimize-modal', parentDoc);
  const searchTerm = $('#global-search-input', $optimizeModal).val();
  const replaceTerm = $('#global-replace-input', $optimizeModal).val();
  const scopes = $('.search-scope-checkbox:checked', $optimizeModal)
    .map((i, el) => $(el).val())
    .get();
  const useRegex = $('#global-search-use-regex', $optimizeModal).is(':checked');

  if (!searchTerm) {
    // Although preview checks this, it's good practice to have it here too.
    return false;
  }

  // 根据是否使用正则创建搜索表达式
  const regexPattern = useRegex ? searchTerm : _.escapeRegExp(searchTerm);
  // 尝试使用 s 标志（dotAll），如果浏览器不支持则回退到不使用
  let searchRegex;
  try {
    searchRegex = new RegExp(regexPattern, 'gs');
  } catch (e) {
    searchRegex = new RegExp(regexPattern, 'g');
  }
  const updaters = {};

  if (scopes.includes('name')) {
    updaters['name'] = text => (typeof text === 'string' ? text.replace(searchRegex, replaceTerm) : text);
  }
  if (scopes.includes('content')) {
    updaters['content'] = text => (typeof text === 'string' ? text.replace(searchRegex, replaceTerm) : text);
  }
  if (scopes.includes('keys')) {
    updaters['strategy.keys'] = keys => {
      const keyString = Array.isArray(keys) ? keys.join(', ') : '';
      return keyString
        .replace(searchRegex, replaceTerm)
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
    };
  }

  if (Object.keys(updaters).length === 0) {
    alert('没有选择任何搜索范围，操作已取消。');
    return false;
  }

  // The confirmation is handled by the preview modal, so we pass null for the message.
  return await batchUpdateEntries(lorebookName, isGlobal, updaters, null);
}, 'executeGlobalSearchAndReplace');
