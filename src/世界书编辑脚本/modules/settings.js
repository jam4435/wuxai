import { HIGHLIGHT_ACTIVE_ENTRIES_KEY, PINNED_ENTRIES_KEY } from './config.js';

// 读取高亮激活条目的设置
export function getHighlightActiveEntriesSetting() {
  const saved = localStorage.getItem(HIGHLIGHT_ACTIVE_ENTRIES_KEY);
  return saved === 'true';
}

// 保存高亮激活条目的设置
export function setHighlightActiveEntriesSetting(enabled) {
  localStorage.setItem(HIGHLIGHT_ACTIVE_ENTRIES_KEY, enabled ? 'true' : 'false');
}

// 读取搜索栏显示设置
export function getShowSearchBarSetting() {
  const saved = localStorage.getItem('lorebook-show-search-bar');
  return saved === null ? true : saved === 'true'; // 默认显示
}

// 保存搜索栏显示设置
export function setShowSearchBarSetting(enabled) {
  localStorage.setItem('lorebook-show-search-bar', enabled ? 'true' : 'false');
}

// 读取全屏模式设置
export function getFullscreenModeSetting() {
  const saved = localStorage.getItem('lorebook-fullscreen-mode');
  return saved === 'true';
}

// 保存全屏模式设置
export function setFullscreenModeSetting(enabled) {
  localStorage.setItem('lorebook-fullscreen-mode', enabled ? 'true' : 'false');
}

// --- 置顶条目管理 ---

// 获取所有已置顶条目的数据结构
function getAllPinnedEntries() {
  const saved = localStorage.getItem(PINNED_ENTRIES_KEY);
  try {
    // 尝试解析JSON，如果为空或无效则返回一个空对象
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('角色世界书: 解析置顶条目数据失败', error);
    return {}; // 解析失败时返回空对象以避免崩溃
  }
}

// 保存整个置顶条目的数据结构
function saveAllPinnedEntries(data) {
  localStorage.setItem(PINNED_ENTRIES_KEY, JSON.stringify(data));
}

/**
 * 获取指定世界书的已置顶条目UID数组
 * @param {string} lorebookName 世界书名称
 * @returns {number[]} 置顶条目的UID数组
 */
export function getPinnedEntries(lorebookName) {
  const allPinned = getAllPinnedEntries();
  // 确保即使lorebookName不存在也返回一个空数组
  return allPinned[lorebookName] || [];
}

/**
 * 添加一个置顶条目
 * @param {string} lorebookName 世界书名称
 * @param {number} uid 要置顶的条目UID
 */
export function addPinnedEntry(lorebookName, uid) {
  const allPinned = getAllPinnedEntries();
  if (!allPinned[lorebookName]) {
    allPinned[lorebookName] = [];
  }
  // 使用Set来自动处理重复项，确保UID的唯一性
  const pinnedSet = new Set(allPinned[lorebookName]);
  pinnedSet.add(uid);
  allPinned[lorebookName] = [...pinnedSet];
  saveAllPinnedEntries(allPinned);
}

/**
 * 移除一个置顶条目
 * @param {string} lorebookName 世界书名称
 * @param {number} uid 要取消置顶的条目UID
 */
export function removePinnedEntry(lorebookName, uid) {
  const allPinned = getAllPinnedEntries();
  if (allPinned[lorebookName]) {
    // 从数组中过滤掉指定的UID
    allPinned[lorebookName] = allPinned[lorebookName].filter(id => id !== uid);
    // 如果过滤后数组为空，则可以从对象中删除该世界书的键
    if (allPinned[lorebookName].length === 0) {
      delete allPinned[lorebookName];
    }
  }
  saveAllPinnedEntries(allPinned);
}
