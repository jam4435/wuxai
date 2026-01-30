import { disableGlobalLorebook, enableGlobalLorebook, getGlobalLorebooks, getWorldbookSafe } from '../api.js';
import {
  DEBUG_MODE,
  GLOBAL_LOREBOOK_LIST_CONTAINER_ID,
  GLOBAL_WORLDBOOK_PRESETS_KEY,
  GLOBAL_WORLDBOOK_SEARCH_ID,
  GLOBAL_WORLDBOOK_SELECTOR_ID,
  GLOBAL_WORLDBOOK_TAGS_CONTAINER_ID,
  PINNED_GLOBAL_WORLDBOOKS_KEY,
} from '../config.js';
import {
  allEntriesData,
  getFilteredEntries,
  getSelectedEntriesCount,
  isReplacingCharacterLorebook,
  lorebookSorts,
  setAllEntriesData,
  setVirtualScrollers,
  virtualScrollers,
} from '../state.js';

import { getPinnedEntries, getShowSearchBarSetting } from '../settings.js';
import { ensureNumericUID, errorCatched, isMobile } from '../utils.js';
import { createEntryHtml } from './entry.js';

import { enableDragSort, getSortedEntries, loadUISort } from '../features/sorting.js';
import { measureCollapsedHeight, syncVisibleEntries } from './expandManager.js';

// --- 常驻世界书管理 ---
export const getPinnedBooks = () => {
  try {
    const pinned = localStorage.getItem(PINNED_GLOBAL_WORLDBOOKS_KEY);
    return pinned ? JSON.parse(pinned) : [];
  } catch (e) {
    console.error('Error reading pinned worldbooks from localStorage', e);
    return [];
  }
};

export const savePinnedBooks = books => {
  try {
    localStorage.setItem(PINNED_GLOBAL_WORLDBOOKS_KEY, JSON.stringify(books));
  } catch (e) {
    console.error('Error saving pinned worldbooks to localStorage', e);
  }
};

// --- 预设管理 ---
export const getGlobalLorebookPresets = () => {
  try {
    const presets = localStorage.getItem(GLOBAL_WORLDBOOK_PRESETS_KEY);
    return presets ? JSON.parse(presets) : {};
  } catch (e) {
    console.error('Error reading global lorebook presets from localStorage', e);
    return {};
  }
};

export const saveGlobalLorebookPresets = presets => {
  try {
    localStorage.setItem(GLOBAL_WORLDBOOK_PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Error saving global lorebook presets to localStorage', e);
  }
};

export const createPresetFromCurrentState = errorCatched(async name => {
  const pinnedBooks = getPinnedBooks();
  const enabledBooks = await getGlobalLorebooks();
  const enabledSet = new Set(enabledBooks);

  const preset = {
    name,
    pinned: pinnedBooks,
    enabled: pinnedBooks.filter(book => enabledSet.has(book)),
  };

  const presets = getGlobalLorebookPresets();
  presets[name] = preset;
  saveGlobalLorebookPresets(presets);
  return true;
}, 'createPresetFromCurrentState');

export const applyPreset = errorCatched(async presetName => {
  const presets = getGlobalLorebookPresets();
  const preset = presets[presetName];

  if (!preset) {
    console.error(`Preset "${presetName}" not found.`);
    return false;
  }

  // 1. 更新常驻列表
  savePinnedBooks(preset.pinned);

  // 2. 同步启用状态
  const currentEnabled = await getGlobalLorebooks();
  const currentEnabledSet = new Set(currentEnabled);
  const targetEnabledSet = new Set(preset.enabled);

  // 遍历预设中的常驻书，调整其状态
  for (const book of preset.pinned) {
    const shouldBeEnabled = targetEnabledSet.has(book);
    const isEnabled = currentEnabledSet.has(book);

    if (shouldBeEnabled && !isEnabled) {
      await enableGlobalLorebook(book);
    } else if (!shouldBeEnabled && isEnabled) {
      await disableGlobalLorebook(book);
    }
  }

  // 3. 刷新UI
  await renderGlobalLorebookSelector();
  // 刷新列表区域
  const parentDoc = window.parent.document;
  const $listContainer = $(`#${GLOBAL_LOREBOOK_LIST_CONTAINER_ID}`, parentDoc); // 需要导入 GLOBAL_LOREBOOK_LIST_CONTAINER_ID
  if ($listContainer.length) {
    // 简单粗暴地刷新整个列表，确保显示正确
    // 这里我们调用 updateGlobalLorebooksList，它会读取新的常驻列表和启用状态
    await updateGlobalLorebooksList($listContainer, true);
  }

  return true;
}, 'applyPreset');

export const deletePreset = errorCatched(async presetName => {
  const presets = getGlobalLorebookPresets();
  if (presets[presetName]) {
    delete presets[presetName];
    saveGlobalLorebookPresets(presets);
    await renderGlobalLorebookSelector(); // 刷新下拉菜单
    return true;
  }
  return false;
}, 'deletePreset');

// 【性能重构】使用 Clusterize.js 加载条目
export const loadLorebookEntries = errorCatched(async (lorebookName, $container, isGlobal = false) => {
  if (!$container || $container.length === 0 || !lorebookName) return false;

  const startTime = performance.now();
  $container.empty().show(); // 清空并显示容器

  try {
    const result = await getWorldbookSafe(lorebookName);
    if (!result.success) {
      console.error(`角色世界书: 加载世界书 "${lorebookName}" 失败`, result.error);
      $container.html(`<div class="lorebook-error">加载失败: ${result.error?.message || '未知错误'}</div>`);
      return false;
    }
    let entries = result.data;

    // --- 新增：混合持久化的置顶状态 ---
    const pinnedUids = new Set(getPinnedEntries(lorebookName));
    if (pinnedUids.size > 0) {
      entries.forEach(entry => {
        if (pinnedUids.has(ensureNumericUID(entry.uid))) {
          entry.pinned = true;
        }
      });
    }
    // --- 结束 ---

    // 应用排序
    const sortPref = lorebookSorts[lorebookName] || { by: 'priority', dir: 'asc' };

    // 如果是自定义排序，先尝试加载保存的排序
    if (sortPref.by === 'custom') {
      const savedSort = loadUISort(lorebookName);
      if (savedSort && savedSort.length > 0) {
        // 根据保存的 UID 顺序重新排列条目
        const entryMap = new Map(entries.map(e => [ensureNumericUID(e.uid), e]));
        const sortedEntries = [];
        savedSort.forEach(uid => {
          const entry = entryMap.get(uid);
          if (entry) {
            sortedEntries.push(entry);
            entryMap.delete(uid);
          }
        });
        // 添加任何不在保存列表中的新条目
        entryMap.forEach(entry => sortedEntries.push(entry));
        entries = sortedEntries;
      }
    }

    // 注意：无论是否自定义排序，都先经过主排序逻辑处理置顶等情况
    entries = getSortedEntries(entries, sortPref.by, sortPref.dir);

    const currentAllEntries = allEntriesData;
    currentAllEntries[lorebookName] = entries;
    setAllEntriesData(currentAllEntries);

    // Get filtered entries for display
    entries = getFilteredEntries(lorebookName);
    if (DEBUG_MODE) {
      console.log(`[List] 准备渲染 ${entries.length} 个条目 (已排序和筛选)`);
    }

    const parentDoc = window.parent.document;
    const $title = $(`.lorebook-title[data-lorebook-name="${lorebookName}"]`, parentDoc);
    $title.find('.lorebook-entries-count').text(`共 ${entries.length} 个条目`);

    // 创建表头
    const $tableHeader = $('<div></div>')
      .addClass('lorebook-table-header')
      .attr('data-lorebook-name', lorebookName)
      .append($('<div></div>').addClass('header-drag').html(''))
      .append($('<div></div>').addClass('header-expand').html(''))
      .append($('<div></div>').addClass('header-toggle').html('启用'))
      .append($('<div></div>').addClass('header-title').html('标题'))
      .append($('<div></div>').addClass('header-constant').html('类型'))
      .append($('<div></div>').addClass('header-position').html('插入位置'))
      .append($('<div></div>').addClass('header-depth').html('深度'))
      .append($('<div></div>').addClass('header-order').html('顺序'))
      .append($('<div></div>').addClass('header-probability').html('概率'))
      .append(
        $('<div></div>')
          .addClass('header-actions')
          .html(
            '<input type="checkbox" class="header-checkbox" data-lorebook-name="' +
              lorebookName +
              '" data-is-global="' +
              (isGlobal ? 'true' : 'false') +
              '" title="全选/取消全选">',
          ),
      );
    $container.append($tableHeader);

    if (entries.length === 0) {
      $container.append('<div class="no-entries-message">该世界书没有条目</div>');
    } else {
      // 【修复问题1】始终使用虚拟滚动，但在自定义排序时启用兼容的拖拽功能
      const scrollId = `clusterize-scroll-${lorebookName.replace(/\s/g, '-')}-${isGlobal}`;
      const contentId = `clusterize-content-${lorebookName.replace(/\s/g, '-')}-${isGlobal}`;

      const $scrollArea = $('<div></div>').addClass('clusterize-scroll').attr('id', scrollId);
      const $contentArea = $('<ul></ul>')
        .addClass('clusterize-content lorebook-entries-container')
        .attr('id', contentId);
      $contentArea.attr('data-lorebook-name', lorebookName).attr('data-is-global', isGlobal ? 'true' : 'false');

      if (DEBUG_MODE) {
        console.log('[调试-创建容器] 世界书:', lorebookName, 'isGlobal:', isGlobal);
      }

      $scrollArea.append($contentArea);
      $container.append($scrollArea);

      // --- 开始虚拟滚动跳跃问题修复 ---
      // 使用 expandManager 的 DOM 操作方法替代脆弱的正则表达式
      let fixedHeight = null; // 这是逻辑高度 (Logical Height)，包含 margin，用于 Clusterize 计算
      let styleHeight = null; // 这是视觉高度 (Style Height)，不含 margin，用于 DOM 样式
      if (entries.length > 0) {
        // 使用 DOM 操作测量折叠状态下的高度，避免正则表达式的脆弱性
        // 传入 $scrollArea 作为参考容器，确保宽度测量准确
        const heightInfo = measureCollapsedHeight(entries[0], lorebookName, createEntryHtml, $scrollArea);
        styleHeight = heightInfo.styleHeight;
        fixedHeight = heightInfo.fixedHeight;
      }

      // 4. 预注入内联样式：为每个条目注入固定高度 (Style Height)
      const rows = entries.map(entry => {
        const entryHtml = createEntryHtml(entry, lorebookName);
        if (styleHeight !== null) {
          // 直接在 HTML 字符串中注入内联样式
          // 注意：这里注入的是 styleHeight (视觉高度)
          const styledHtml = entryHtml.replace(
            /(<div class="lorebook-entry-item[^"]*")/,
            `$1 style="height: ${styleHeight}px; box-sizing: border-box;"`,
          );
          return `<li>${styledHtml}</li>`;
        }
        return `<li>${entryHtml}</li>`;
      });
      // --- 虚拟滚动跳跃问题修复结束 ---

      // 【修复】添加防抖标记，防止 clusterChanged 回调循环触发
      let isProcessingClusterChange = false;
      // 【调试】添加回调计数器
      let clusterChangeCount = 0;

      const clusterizeOptions = {
        rows: rows,
        scrollElem: $scrollArea[0],
        contentElem: $contentArea[0],
        tag: 'li',
        rows_in_block: 10,
        blocks_in_cluster: 12,
        no_data_text: '没有找到匹配的条目',
        keep_parity: true,
        show_no_data_row: false,
        callbacks: {
          clusterChanged: function () {
            clusterChangeCount++;

            // 防止循环处理
            if (isProcessingClusterChange) {
              return;
            }
            isProcessingClusterChange = true;

            // 使用 expandManager 统一处理展开状态同步
            if (styleHeight !== null) {
              syncVisibleEntries($contentArea, lorebookName, styleHeight, ensureNumericUID);
            }

            // 使用 requestAnimationFrame 延迟重置标记
            requestAnimationFrame(() => {
              isProcessingClusterChange = false;
            });
          },
        },
      };

      // 先声明变量，以便在回调中安全访问（虽然初始化回调时仍为 null，但不会报错）
      let clusterize = null;
      clusterize = new Clusterize(clusterizeOptions);

      // 【修复问题2】强制锁定 Clusterize 的高度测量
      // 既然我们已经精确计算了 fixedHeight，就禁止 Clusterize 在滚动时重新测量
      // 这能彻底解决因亚像素渲染导致的 scrollTop 非整数时的“反复横跳”问题
      if (fixedHeight !== null) {
        // 1. 强制覆盖 options 中的 item_height
        clusterize.options.item_height = fixedHeight;

        // 2. 劫持 getRowsHeight 方法，使其永远返回 false (表示高度未改变)
        // 并始终保持 item_height 为我们设定的固定值
        clusterize.getRowsHeight = function () {
          this.options.item_height = fixedHeight;
          // 重新计算依赖高度的参数，确保内部状态一致
          this.options.block_height = this.options.item_height * this.options.rows_in_block;
          this.options.rows_in_cluster = this.options.blocks_in_cluster * this.options.rows_in_block;
          this.options.cluster_height = this.options.blocks_in_cluster * this.options.block_height;
          return false; // 告诉 Clusterize 高度没有变化，不需要刷新
        };

        // 3. 立即强制刷新一次以应用锁定的高度
        clusterize.refresh(true);
      }

      // 存储实例以便后续更新（如搜索）
      const currentVirtualScrollers = virtualScrollers;
      currentVirtualScrollers[lorebookName] = clusterize;
      setVirtualScrollers(currentVirtualScrollers);

      // 【修复问题1】如果是自定义排序，启用兼容虚拟滚动的拖拽功能
      if (sortPref.by === 'custom') {
        enableDragSort($contentArea, clusterize);
      }
    }

    // 延迟更新全选框状态
    setTimeout(() => updateHeaderCheckboxState(lorebookName, isGlobal), 100);

    $title.attr('data-loaded', 'true');
    const endTime = performance.now();
    return true;
  } catch (error) {
    console.error(`加载世界书 "${lorebookName}" 时发生严重错误:`, error);
    $container.empty().append(`<div class="no-entries-message">加载条目时出错，请查看控制台。</div>`);
    return false;
  }
}, 'loadLorebookEntries');

// 【重构】更新绑定世界书列表
export const updateBoundLorebooksList = errorCatched(async ($listContainer, forceRefresh = false) => {
  if (!$listContainer || $listContainer.length === 0) {
    console.error('角色世界书: 找不到列表容器');
    return;
  }

  // 如果正在替换显示的世界书，且不是强制刷新，则跳过本次更新
  // 这是为了避免 replace-character-lorebook 和 updateBoundLorebooksList 的竞态条件
  if (isReplacingCharacterLorebook && !forceRefresh) {
    if (DEBUG_MODE) {
      console.log('[List] 正在替换显示的世界书，跳过本次自动更新');
    }
    return;
  }

  const scrollTop = $listContainer.scrollTop();
  if (forceRefresh) {
    $listContainer.empty(); // 1. 先清空
  }

  // 2. 再添加搜索栏
  const showSearchBar = getShowSearchBarSetting();
  const searchBarHtml = `
        <div class="global-lorebook-adder" style="margin-bottom: 15px; position: relative; display: ${showSearchBar ? 'flex' : 'none'}; align-items: center;">
            <div class="global-lorebook-search-wrapper" style="flex-grow: 1;">
                <i class="fa-solid fa-search"></i>
                <input type="text" id="character-worldbook-search-input" placeholder="搜索并替换显示的世界书...">
            </div>
            <div class="add-worldbook-results" id="character-worldbook-search-results"></div>
            <div class="character-lorebook-actions" style="display: flex; gap: 5px; margin-left: 10px;">
                <button class="lorebook-batch-action-button" data-action="import-worldbook" title="导入世界书"><i class="fa-solid fa-file-import"></i></button>
                <button class="lorebook-batch-action-button" data-action="export-worldbook" title="导出世界书"><i class="fa-solid fa-file-export"></i></button>
                <button class="lorebook-batch-action-button" data-action="set-as-char-lorebook" title="把当前显示的世界书设为角色世界书"><i class="fa-solid fa-user-check"></i></button>
                <button class="lorebook-batch-action-button" data-action="set-as-chat-lorebook" title="把当前显示的世界书设为聊天世界书"><i class="fa-solid fa-comments"></i></button>
                <button class="lorebook-batch-action-button" data-action="create-worldbook" title="新建世界书"><i class="fa-solid fa-plus"></i></button>
                <button class="lorebook-batch-action-button" data-action="delete-worldbook" title="删除世界书"><i class="fa-solid fa-trash"></i></button>
                <button class="lorebook-batch-action-button" data-action="rename-worldbook" title="重命名世界书"><i class="fa-solid fa-i-cursor"></i></button>
            </div>
        </div>
    `;
  if ($listContainer.find('#character-worldbook-search-input').length === 0) {
    $listContainer.prepend(searchBarHtml);
  }

  try {
    let boundLorebooks = [];
    if (typeof getCharWorldbookNames !== 'function') {
      const msg = '角色世界书: 核心函数 getCharWorldbookNames 不可用，无法获取角色绑定的世界书。';
      console.error(msg);
      $listContainer.append(`<p>${msg}</p>`); // 在搜索栏下方显示错误
      throw new Error(msg);
    }

    const charLorebooks = await getCharWorldbookNames('current');
    if (charLorebooks) {
      if (charLorebooks.primary) boundLorebooks.push(charLorebooks.primary);
      if (Array.isArray(charLorebooks.additional)) boundLorebooks.push(...charLorebooks.additional);
    }

    boundLorebooks = [...new Set(boundLorebooks)];

    if (boundLorebooks.length === 0) {
      $listContainer.append('<p>当前角色卡未绑定任何世界书</p>');
      return;
    }

    // 在搜索栏前添加当前绑定的世界书信息
    const boundBooksHtml = `
        <div class="current-bound-books" style="margin-bottom: 10px; padding: 8px; background-color: #2a2a2a; border-radius: 4px; font-size: 0.9em;">
            <strong>当前角色绑定世界书:</strong> ${boundLorebooks.join(', ')}
        </div>
    `;
    if ($listContainer.find('.current-bound-books').length === 0) {
      $listContainer.find('.global-lorebook-adder').before(boundBooksHtml);
    } else {
      $listContainer
        .find('.current-bound-books')
        .html(`<strong>当前角色绑定世界书:</strong> ${boundLorebooks.join(', ')}`);
    }

    // 移除旧的世界书内容（保留搜索栏）
    if (forceRefresh) {
      $listContainer.find('> *:not(.global-lorebook-adder)').remove();
    }

    boundLorebooks.sort((a, b) => a.localeCompare(b));

    for (const lorebookName of boundLorebooks) {
      if (forceRefresh || $listContainer.find(`.lorebook-title[data-lorebook-name="${lorebookName}"]`).length === 0) {
        const $lorebookTitle = createLorebookTitleSection(lorebookName);
        $lorebookTitle.attr('data-lorebook-name', lorebookName);
        $listContainer.append($lorebookTitle);

        const $entriesWrapper = $('<div></div>')
          .addClass('lorebook-entries-wrapper')
          .attr('data-lorebook-name', lorebookName);
        $listContainer.append($entriesWrapper);

        setTimeout(async () => {
          try {
            await loadLorebookEntries(lorebookName, $entriesWrapper, false);
            if (typeof updateHeaderCheckboxState === 'function') {
              updateHeaderCheckboxState(lorebookName, false);
            }
          } catch (error) {
            console.error(`角色世界书: 加载世界书 ${lorebookName} 时出错:`, error);
            $entriesWrapper.html('<div class="no-entries-message">加载条目时出错</div>');
          }
        }, 10);
      }

      if (lorebookName !== boundLorebooks[boundLorebooks.length - 1]) {
        const $nextElement = $listContainer.find(`[data-lorebook-name="${lorebookName}"]`).last().next();
        if (!$nextElement.hasClass('lorebook-divider')) {
          $listContainer.append('<div class="lorebook-divider"></div>');
        }
      }
    }

    setTimeout(() => $listContainer.scrollTop(scrollTop), 10);
  } catch (error) {
    if (forceRefresh) $listContainer.empty().append('<p>加载角色绑定世界书列表时出错，请查看控制台了解详情。</p>');
    console.error('[调试] 更新角色绑定世界书列表时发生严重错误:', error);
  }
}, 'updateBoundLorebooksList');

// 渲染全局世界书选择器
export const renderGlobalLorebookSelector = errorCatched(async () => {
  const parentDoc = window.parent.document;
  const $selectorContainer = $(`#${GLOBAL_WORLDBOOK_SELECTOR_ID}`, parentDoc);
  if (!$selectorContainer.length) return;

  const pinnedBooks = getPinnedBooks();
  const enabledBookNames = await getGlobalLorebooks();
  if (DEBUG_MODE) {
    console.log('[renderGlobalLorebookSelector] pinnedBooks:', pinnedBooks, 'enabledBookNames:', enabledBookNames);
  }
  const enabledBookSet = new Set(enabledBookNames);
  const presets = getGlobalLorebookPresets();
  const presetNames = Object.keys(presets).sort();

  const selectorHtml = `
        <div class="global-search-bars-container" style="display: flex; gap: 10px; margin-bottom: 5px; align-items: flex-start;">
            <div class="global-lorebook-adder" style="flex: 1; position: relative;">
                <div class="global-lorebook-search-wrapper">
                    <i class="fa-solid fa-search"></i>
                    <input type="text" id="add-worldbook-search-input" placeholder="搜索并添加常驻世界书...">
                </div>
                <div class="add-worldbook-results"></div>
            </div>
            <div class="global-lorebook-search-wrapper" style="flex: 1;">
                <i class="fa-solid fa-search"></i>
                <input type="text" id="${GLOBAL_WORLDBOOK_SEARCH_ID}" placeholder="筛选常驻世界书...">
            </div>
        </div>
        <div class="global-lorebook-selector-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span>常驻世界书 (${pinnedBooks.length})</span>
            <div class="preset-dropdown-container" style="position: relative;">
                <button class="preset-dropdown-button" title="预设管理" style="background: none; border: none; color: var(--panel-text-color); cursor: pointer;">
                    <i class="fa-solid fa-bookmark"></i> 预设 <i class="fa-solid fa-caret-down"></i>
                </button>
                <div class="preset-dropdown-menu" style="display: none; position: absolute; right: 0; top: 100%; background-color: var(--panel-bg-color); border: 1px solid var(--panel-border-color); border-radius: 4px; z-index: 1000; min-width: 150px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                    <div class="preset-item" data-action="save-preset" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--panel-border-color);">
                        <i class="fa-solid fa-plus"></i> 保存当前状态为预设
                    </div>
                    ${
                      presetNames.length > 0
                        ? presetNames
                            .map(
                              name => `
                        <div class="preset-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #444;">
                            <span class="preset-name" data-action="apply-preset" data-preset-name="${name}" style="cursor: pointer; flex-grow: 1;">${name}</span>
                            <i class="fa-solid fa-trash" data-action="delete-preset" data-preset-name="${name}" style="cursor: pointer; color: #ff6b6b; margin-left: 10px;" title="删除预设"></i>
                        </div>
                    `,
                            )
                            .join('')
                        : '<div style="padding: 8px 12px; color: #888; font-style: italic;">暂无预设</div>'
                    }
                </div>
            </div>
        </div>
        <div id="${GLOBAL_WORLDBOOK_TAGS_CONTAINER_ID}" class="global-lorebook-tags">
            ${pinnedBooks
              .sort((a, b) => a.localeCompare(b))
              .map(
                name => {
                  const isActive = enabledBookSet.has(name);
                  return `
                <div class="lorebook-tag ${
                  isActive ? 'active' : ''
                }" data-action="toggle-global-lorebook" data-lorebook-name="${name}">
                    ${name}
                    <i class="fa-solid fa-times-circle" data-action="unpin-global-lorebook"></i>
                </div>
            `;
                },
              )
              .join('')}
        </div>
    `;

  $selectorContainer.html(selectorHtml);
}, 'renderGlobalLorebookSelector');

// 更新全局世界书列表
export const updateGlobalLorebooksList = errorCatched(async ($listContainer, forceRefresh = false) => {
  if (!$listContainer || $listContainer.length === 0) {
    console.error('角色世界书: 找不到全局世界书列表容器');
    return;
  }

  const scrollTop = $listContainer.scrollTop();

  if (forceRefresh) {
    // 只移除世界书条目，保留选择器
    $listContainer.children().not(`#${GLOBAL_WORLDBOOK_SELECTOR_ID}`).remove();
    $listContainer.append('<p>加载中...</p>');
  }

  try {
    // 新增：如果是第一次加载，将当前启用的全局世界书设为默认常驻
    const pinnedBooks = getPinnedBooks();
    if (pinnedBooks.length === 0) {
      const currentGlobalBooks = await getGlobalLorebooks();
      if (currentGlobalBooks.length > 0) {
        savePinnedBooks(currentGlobalBooks);
      }
    }

    await renderGlobalLorebookSelector();
    const globalLorebooks = await getGlobalLorebooks();

    if (forceRefresh) {
      // 只移除世界书条目和加载提示，保留选择器
      $listContainer.children().not(`#${GLOBAL_WORLDBOOK_SELECTOR_ID}`).remove();
    }

    if (!globalLorebooks || globalLorebooks.length === 0) {
      // 只移除世界书条目，保留选择器
      $listContainer.children().not(`#${GLOBAL_WORLDBOOK_SELECTOR_ID}`).remove();
      $listContainer.append('<p>当前未启用任何全局世界书</p>');
      return;
    }

    globalLorebooks.sort((a, b) => a.localeCompare(b));

    for (const lorebookName of globalLorebooks) {
      let $lorebookTitle = $listContainer.find(`.lorebook-title:contains("${lorebookName}")`);

      if ($lorebookTitle.length === 0) {
        $lorebookTitle = createLorebookTitleSection(lorebookName, true);
        $listContainer.append($lorebookTitle);

        const $entriesContainer = $('<div></div>')
          .addClass('lorebook-entries-wrapper')
          .attr('data-lorebook-name', lorebookName)
          .attr('data-is-global', 'true')
          .css('display', 'none');

        $listContainer.append($entriesContainer);
      }

      if (lorebookName !== globalLorebooks[globalLorebooks.length - 1]) {
        const $existingDivider = $listContainer.find(`.lorebook-divider[data-after="${lorebookName}"]`);
        if ($existingDivider.length === 0) {
          $listContainer.append($('<div></div>').addClass('lorebook-divider').attr('data-after', lorebookName));
        }
      }
    }

    setTimeout(() => {
      $listContainer.scrollTop(scrollTop);
    }, 10);
  } catch (error) {
    if (forceRefresh) {
      // 只移除世界书条目，保留选择器
      $listContainer.children().not(`#${GLOBAL_WORLDBOOK_SELECTOR_ID}`).remove();
      $listContainer.append('<p>加载全局世界书时出错</p>');
    }
    console.error('角色世界书: 更新全局世界书列表时出错', error);
  }
}, 'updateGlobalLorebooksList');

/**
 * Adds a single global lorebook title to the list in its alphabetically sorted position.
 * This is a lightweight alternative to a full refresh.
 * @param {jQuery} $listContainer - The container for the global lorebook list.
 * @param {string} lorebookName - The name of the lorebook to add.
 */
export const addGlobalLorebookToList = errorCatched(($listContainer, lorebookName) => {
  // Prevent adding duplicates
  if ($listContainer.find(`.lorebook-title[data-lorebook-name="${lorebookName}"]`).length > 0) {
    console.warn(`[Optimization] Attempted to add duplicate lorebook title: ${lorebookName}. Aborting.`);
    return;
  }

  // 1. Create the new title element and its wrapper
  const $newTitle = createLorebookTitleSection(lorebookName, true);
  const $newEntriesWrapper = $('<div></div>')
    .addClass('lorebook-entries-wrapper')
    .attr('data-lorebook-name', lorebookName)
    .attr('data-is-global', 'true')
    .css('display', 'none');

  // 2. Find all existing title elements to determine the correct insertion point
  const $existingTitles = $listContainer.find('.lorebook-title-clickable');
  let inserted = false;

  if ($existingTitles.length === 0) {
    // If no titles exist, just append it (after the selector)
    $listContainer.append($newTitle).append($newEntriesWrapper);
  } else {
    // Iterate through existing titles to find the correct alphabetical position
    $existingTitles.each(function () {
      const $currentTitle = $(this);
      const currentName = $currentTitle.data('lorebook-name');

      if (lorebookName.localeCompare(currentName) < 0) {
        // Insert before the current title
        $newTitle.insertBefore($currentTitle);
        $newEntriesWrapper.insertAfter($newTitle);
        // Add a divider if it's not the very first element
        if ($currentTitle.prev().length > 0) {
          $('<div></div>').addClass('lorebook-divider').insertBefore($newTitle);
        }
        inserted = true;
        return false; // Exit the loop
      }
    });

    if (!inserted) {
      // If it wasn't inserted, it must be last alphabetically. Append it.
      const $lastWrapper = $existingTitles.last().next('.lorebook-entries-wrapper');
      $('<div></div>').addClass('lorebook-divider').insertAfter($lastWrapper);
      $newTitle.insertAfter($lastWrapper.next('.lorebook-divider'));
      $newEntriesWrapper.insertAfter($newTitle);
    }
  }
}, 'addGlobalLorebookToList');

export function createLorebookTitleSection(lorebookName, isGlobal = false) {
  const $lorebookTitle = $('<div></div>').addClass('lorebook-title');

  const $titleText = $('<span></span>').addClass('lorebook-title-text').text(lorebookName);
  const $countInfo = $('<span></span>').addClass('lorebook-entries-count').text(`共 ? 个条目`);

  const $sortContainer = $('<div></div>').addClass('lorebook-sort-container');
  const $sortButton = $('<button></button>').addClass('sort-display-button');
  const $sortDropdown = $('<ul></ul>').addClass('sort-dropdown');
  const sortOptions = [
    { text: '优先级', by: 'priority', dir: 'asc' },
    { text: '优先级(逆)', by: 'priority', dir: 'desc' },
    { text: '自定义', by: 'custom', dir: 'asc' },
    { text: 'UID 降序', by: 'uid', dir: 'desc' },
    { text: 'UID 升序', by: 'uid', dir: 'asc' },
    { text: '标题 A-Z', by: 'name', dir: 'asc' },
    { text: '标题 Z-A', by: 'name', dir: 'desc' },
    { text: '词符数 降序', by: 'tokens', dir: 'desc' },
    { text: '词符数 升序', by: 'tokens', dir: 'asc' },
  ];
  const currentSort = lorebookSorts[lorebookName] || { by: 'priority', dir: 'asc' };
  let currentSortText = '排序方式';

  sortOptions.forEach(opt => {
    const $li = $('<li></li>').text(opt.text).attr('data-sort-by', opt.by).attr('data-sort-dir', opt.dir);
    if (opt.by === currentSort.by && opt.dir === currentSort.dir) {
      $li.addClass('active');
      currentSortText = opt.text;
    }
    $sortDropdown.append($li);
  });
  $sortButton.html(`${currentSortText} <i class="fa-solid fa-caret-down"></i>`);
  $sortContainer.append($sortButton).append($sortDropdown);

  const $searchContainer = $('<div></div>').addClass('lorebook-search-container');
  const $searchIcon = $('<i></i>').addClass('fa-solid fa-search lorebook-search-icon');
  const $searchInput = $('<input>')
    .addClass('lorebook-search-input')
    .attr('type', 'text')
    .attr('placeholder', '搜索条目标题...')
    .attr('data-lorebook-name', lorebookName)
    .attr('data-is-global', isGlobal ? 'true' : 'false');
  $searchContainer.append($searchIcon).append($searchInput);

  const $importButton = $('<button></button>')
    .addClass('lorebook-batch-action-button')
    .css('background-color', '#4a7c9a')
    .html('<i class="fa-solid fa-file-import"></i>')
    .attr('title', '从YAML批量导入条目')
    .attr('data-action', 'bulk-import');
  const $optimizeButton = $('<button></button>')
    .addClass('lorebook-batch-action-button')
    .css('background-color', '#3a6a8e')
    .html('<i class="fa-solid fa-wand-magic-sparkles"></i>')
    .attr('title', '优化世界书...')
    .attr('data-action', 'open-optimizer');
  const $copyButton = $('<button></button>')
    .addClass('lorebook-batch-action-button')
    .css('background-color', '#4a9a7c')
    .html('<i class="fa-solid fa-copy"></i>')
    .attr('title', '复制选中条目到其他世界书...')
    .attr('data-action', 'copy-entries');

  // 批量操作下拉按钮
  const $batchToggleContainer = $('<div></div>').addClass('lorebook-batch-toggle-container');
  const $batchToggleButton = $('<button></button>')
    .addClass('lorebook-batch-action-button batch-toggle-button')
    .css('background-color', '#8e6ab8')
    .html('<i class="fa-solid fa-sliders"></i>')
    .attr('title', '批量开关操作...');

  const $batchToggleDropdown = $('<div></div>').addClass('batch-toggle-dropdown');
  const dropdownHTML = `
    <div class="batch-toggle-section">
      <div class="batch-toggle-label">操作类型：</div>
      <div class="batch-toggle-radio-group">
        <label><input type="radio" name="batch-operation" value="enable" checked> 全开</label>
        <label><input type="radio" name="batch-operation" value="disable"> 全关</label>
        <label><input type="radio" name="batch-operation" value="invert"> 反转</label>
      </div>
    </div>
    <div class="batch-toggle-section">
      <div class="batch-toggle-label">操作字段：</div>
      <div class="batch-toggle-checkbox-group">
        <label><input type="checkbox" value="enabled"> 启用状态</label>
        <label><input type="checkbox" value="strategy.type"> 激活模式</label>
        <label><input type="checkbox" value="recursion.prevent_outgoing"> 防止递归</label>
        <label><input type="checkbox" value="recursion.prevent_incoming"> 排除递归</label>
      </div>
    </div>
    <button class="batch-toggle-execute-btn" data-action="execute-batch-toggle">执行</button>
  `;
  $batchToggleDropdown.html(dropdownHTML);
  $batchToggleContainer.append($batchToggleButton).append($batchToggleDropdown);

  // Add filter button and dropdown
  const $filterContainer = $('<div></div>').addClass('lorebook-batch-toggle-container'); // 使用相同的基类
  const $filterButton = $('<button></button>')
    .addClass('lorebook-batch-action-button batch-toggle-button filter-button') // 保持按钮样式一致
    .css('background-color', '#b3a992')
    .html('<i class="fa-solid fa-filter"></i>')
    .attr('title', '筛选条目...');

  const $filterDropdown = $('<div></div>').addClass('batch-toggle-dropdown filter-dropdown filter-dropdown-narrow'); // 重点：添加 filter-dropdown-narrow 类
  const filterDropdownHTML = `
    <div class="batch-toggle-label">条目筛选</div>
    <div class="filter-group">
      <label><input type="checkbox" data-action="set-filter" data-filter-type="isEnabled"> 已开启条目</label>
      <label><input type="checkbox" data-action="set-filter" data-filter-type="isNotEnabled"> 已关闭条目</label>
    </div>
    <div class="filter-group">
      <label><input type="checkbox" data-action="set-filter" data-filter-type="isActivated"> 被激活条目</label>
      <label><input type="checkbox" data-action="set-filter" data-filter-type="isNotActivated"> 未激活条目</label>
    </div>
    <div class="filter-group">
      <label><input type="checkbox" data-action="set-filter" data-filter-type="isConstant"> 蓝灯条目</label>
      <label><input type="checkbox" data-action="set-filter" data-filter-type="isSelective"> 绿灯条目</label>
    </div>
  `;
  $filterDropdown.html(filterDropdownHTML);
  $filterContainer.append($filterButton).append($filterDropdown);

  const $adjustPositionButton = $('<button></button>')
    .addClass('lorebook-batch-action-button')
    .css('background-color', '#7a5a9e')
    .html('<i class="fa-solid fa-arrows-up-down"></i>')
    .attr('title', '调整选中条目的插入位置')
    .attr('data-action', 'adjust-position');
  const $deleteButton = $('<button></button>')
    .addClass('lorebook-delete-entries-button')
    .html('<i class="fa-solid fa-trash"></i>')
    .attr('title', '删除选中条目')
    .attr('data-action', 'delete-entries');
  const $addButton = $('<button></button>')
    .addClass('lorebook-add-entry-button')
    .html('<i class="fa-solid fa-plus"></i>')
    .attr('title', '新建条目')
    .attr('data-action', 'add-entry');

  if (isMobile()) {
    const $titleInfoWrapper = $('<div></div>').addClass('lorebook-title-info-wrapper');
    const $actionsWrapper = $('<div></div>').addClass('lorebook-actions-wrapper');
    const $searchSortWrapper = $('<div></div>').addClass('lorebook-search-sort-wrapper');
    $titleInfoWrapper.append($titleText).append($countInfo);
    const $selectAllButton = $('<button></button>')
      .addClass('lorebook-batch-action-button')
      .css('background-color', '#336699')
      .html('<i class="fa-solid fa-check-double"></i>')
      .attr('title', '全选/取消全选')
      .attr('data-action', 'select-all')
      .attr('data-lorebook-name', lorebookName)
      .attr('data-is-global', isGlobal ? 'true' : 'false');
    $searchSortWrapper.append($searchContainer).append($sortContainer);
    $actionsWrapper
      .append($searchSortWrapper)
      .append($importButton)
      .append($optimizeButton)
      .append($copyButton)
      .append($selectAllButton)
      .append($batchToggleContainer)
      .append($filterContainer)
      .append($adjustPositionButton)
      .append($deleteButton)
      .append($addButton);
    $lorebookTitle.append($titleInfoWrapper).append($actionsWrapper);
  } else {
    $lorebookTitle
      .append($titleText)
      .append($countInfo)
      .append($sortContainer)
      .append($searchContainer)
      .append($importButton)
      .append($optimizeButton)
      .append($copyButton)
      .append($batchToggleContainer)
      .append($filterContainer)
      .append($adjustPositionButton)
      .append($deleteButton)
      .append($addButton);
  }

  if (isGlobal) {
    const $expandIcon = $('<i></i>').addClass('fa-solid fa-chevron-down lorebook-expand-icon').css({
      'margin-right': '10px',
      cursor: 'pointer',
      color: '#9a7ace',
    });

    $lorebookTitle.find('.lorebook-title-text').prepend($expandIcon);

    $lorebookTitle
      .addClass('lorebook-title-clickable')
      .attr('data-lorebook-name', lorebookName)
      .attr('data-is-global', 'true')
      .attr('data-expanded', 'false')
      .attr('data-loaded', 'false')
      .css('cursor', 'pointer');
  } else {
    // 非全局世界书也需要设置 data-lorebook-name 和 data-is-global
    $lorebookTitle.attr('data-lorebook-name', lorebookName).attr('data-is-global', 'false');
  }

  return $lorebookTitle;
}

export const updateHeaderCheckboxState = errorCatched((lorebookName, isGlobal) => {
  const parentDoc = window.parent.document;

  // Find header checkboxes for both PC and mobile.
  // These selectors should be unique enough without finding the container first.
  const $headerCheckboxPC = $(
    `.lorebook-table-header[data-lorebook-name="${lorebookName}"] .header-checkbox`,
    parentDoc,
  );
  const $titleContainer = $(
    `.lorebook-title[data-lorebook-name="${lorebookName}"][data-is-global="${isGlobal}"]`,
    parentDoc,
  );
  const $selectAllButtonMobile = $titleContainer.find('[data-action="select-all"]');
  const $headerCheckboxMobile = $titleContainer.find('.header-checkbox');

  const allCheckboxes = $headerCheckboxPC.add($headerCheckboxMobile);

  // Get counts from state
  const selectedCount = getSelectedEntriesCount(lorebookName);
  const totalEntries = getFilteredEntries(lorebookName).length;

  if (totalEntries === 0) {
    allCheckboxes.prop('checked', false).prop('indeterminate', false).prop('disabled', true);
    $selectAllButtonMobile.removeClass('active partial');
  } else if (selectedCount === 0) {
    allCheckboxes.prop('checked', false).prop('indeterminate', false).prop('disabled', false);
    $selectAllButtonMobile.removeClass('active partial');
  } else if (selectedCount === totalEntries) {
    allCheckboxes.prop('checked', true).prop('indeterminate', false).prop('disabled', false);
    $selectAllButtonMobile.removeClass('partial').addClass('active');
  } else {
    // Some are selected
    allCheckboxes.prop('checked', false).prop('indeterminate', true).prop('disabled', false);
    $selectAllButtonMobile.removeClass('active').addClass('active partial');
  }
}, 'updateHeaderCheckboxState');

// 【功能修复】无感刷新虚拟列表，避免滚动条重置和状态更新延迟
export const updateVirtualScroll = errorCatched(async lorebookName => {
  if (!lorebookName) return false;

  try {
    // 1. 从 state.js 中获取指定 lorebookName 的数据
    const entries = allEntriesData[lorebookName];
    if (!entries) {
      console.error(`[无感刷新] 找不到世界书 "${lorebookName}" 的数据`);
      return false;
    }

    const clusterize = virtualScrollers[lorebookName];
    if (!clusterize) {
      console.error(`[无感刷新] 找不到世界书 "${lorebookName}" 的虚拟滚动实例`);
      return false;
    }

    // 2. 应用排序
    const sortPref = lorebookSorts[lorebookName] || { by: 'priority', dir: 'asc' };
    let sortedEntries;

    if (sortPref.by === 'custom') {
      const savedSort = loadUISort(lorebookName);
      if (savedSort && savedSort.length > 0) {
        // 根据保存的 UID 顺序重新排列条目
        const entryMap = new Map(entries.map(e => [ensureNumericUID(e.uid), e]));
        sortedEntries = [];
        savedSort.forEach(uid => {
          const entry = entryMap.get(uid);
          if (entry) {
            sortedEntries.push(entry);
            entryMap.delete(uid);
          }
        });
        // 添加任何不在保存列表中的新条目
        entryMap.forEach(entry => sortedEntries.push(entry));
      } else {
        sortedEntries = entries;
      }
    } else {
      sortedEntries = getSortedEntries(entries, sortPref.by, sortPref.dir);
    }

    // 【关键修复】将排序后的数据同步回中央状态
    const currentAllEntries = { ...allEntriesData };
    currentAllEntries[lorebookName] = sortedEntries;
    setAllEntriesData(currentAllEntries);

    // 3. 获取筛选后的条目 (现在会从已排序的最新状态中获取)
    const filteredEntries = getFilteredEntries(lorebookName);

    // 4. 生成新的HTML内容
    const rows = filteredEntries.map(entry => {
      const entryHtml = createEntryHtml(entry, lorebookName);
      // 保持与 loadLorebookEntries 相同的高度处理逻辑
      const styleHeight = clusterize.options.item_height ? clusterize.options.item_height - 8 : null;
      if (styleHeight !== null) {
        const styledHtml = entryHtml.replace(
          /(<div class="lorebook-entry-item[^"]*")/,
          `$1 style="height: ${styleHeight}px; box-sizing: border-box;"`,
        );
        return `<li>${styledHtml}</li>`;
      }
      return `<li>${entryHtml}</li>`;
    });

    // 5. 更新虚拟列表内容，保持滚动条位置
    clusterize.update(rows);

    // 6. 更新条目计数
    const parentDoc = window.parent.document;
    const $title = $(`.lorebook-title[data-lorebook-name="${lorebookName}"]`, parentDoc);
    $title.find('.lorebook-entries-count').text(`共 ${filteredEntries.length} 个条目`);

    if (DEBUG_MODE) {
      console.log(`[无感刷新] 成功更新世界书 "${lorebookName}"，共 ${filteredEntries.length} 个条目`);
    }
    return true;
  } catch (error) {
    console.error(`[无感刷新] 更新世界书 "${lorebookName}" 时发生错误:`, error);
    return false;
  }
}, 'updateVirtualScroll');
