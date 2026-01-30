import $ from 'jquery';
import _ from 'lodash';
import { App, createApp } from 'vue';
import DuplicateFinder from './DuplicateFinder.vue';

let app: App | null = null;
let $app: JQuery<HTMLElement> | null = null;

/**
 * 关闭并销毁 Vue 面板
 */
function closePanel() {
  if (app && $app) {
    app.unmount();
    $app.remove();
    app = null;
    $app = null;
  }
}

/**
 * 打开查找器面板
 */
async function openPanel() {
  console.log('[查重脚本] > openPanel() 函数已调用');
  if (app) {
    console.log('[查重脚本] > 面板已存在, 正在关闭旧面板...');
    closePanel();
  }

  toastr.info('正在扫描角色卡和世界书...');
  console.log('[查重脚本] > 1. 开始获取数据...');

  const allCharacters = (window as any).SillyTavern?.characters;
  if (!allCharacters || !Array.isArray(allCharacters)) {
    toastr.error('无法获取角色卡列表，请确保酒馆已完全加载。');
    console.error('[查重脚本] > 错误: SillyTavern.characters 不可用或不是一个数组。');
    return;
  }
  console.log(`[查重脚本] > 1.1. 成功获取 ${allCharacters.length} 个角色卡。`);

  const allWorldbookNames = getWorldbookNames();
  console.log(`[查重脚本] > 1.2. 成功获取 ${allWorldbookNames.length} 个世界书。`);

  const duplicateCharacters = _.chain(allCharacters)
    .groupBy('name')
    .filter(group => group.length > 1)
    .value();
  console.log(`[查重脚本] > 2.1. 找到 ${duplicateCharacters.length} 组重复的角色卡。`);

  const duplicateWorldbooks = _.chain(allWorldbookNames)
    .countBy()
    .toPairs()
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }))
    .value();
  console.log(`[查重脚本] > 2.2. 找到 ${duplicateWorldbooks.length} 组重复的世界书。`);

  if (duplicateCharacters.length === 0 && duplicateWorldbooks.length === 0) {
    toastr.success('扫描完成，没有发现重复的角色卡或世界书。');
    console.log('[查重脚本] > 扫描完成, 未发现重复项。');
    return;
  }

  toastr.info(`发现了 ${duplicateCharacters.length} 组重复角色卡和 ${duplicateWorldbooks.length} 组重复世界书。`);

  console.log('[查重脚本] > 3. 开始创建 Vue 组件...');
  $app = $('<div>').attr('id', 'duplicate-finder-root');
  $('body').append($app);
  console.log('[查重脚本] > 3.1. 根元素 #duplicate-finder-root 已创建并添加到 body。');

  app = createApp(DuplicateFinder, {
    initialCharacters: duplicateCharacters,
    initialWorldbooks: duplicateWorldbooks,
    onClose: closePanel,
  });
  console.log('[查重脚本] > 3.2. Vue 应用实例已创建。');

  try {
    const mountTarget = $app.get(0);
    if (!mountTarget) {
      console.error('[查重脚本] > 错误: 无法获取挂载目标 DOM 元素!');
      return;
    }
    console.log('[查重脚本] > 3.3. 正在尝试将 Vue 应用挂载到:', mountTarget);
    app.mount(mountTarget);
    console.log('[查重脚本] > 3.4. Vue 应用已成功挂载。');
  } catch (e) {
    console.error('[查重脚本] > 错误: Vue 应用挂载失败:', e);
    toastr.error('Vue 组件挂载失败, 详情请查看控制台。');
    return;
  }

  console.log('[查重脚本] > 4. 开始注入样式...');
  setTimeout(() => {
    if (!$app) {
      console.warn('[查重脚本] > 4.1. 样式注入失败: $app 为空。');
      return;
    }
    // 使用项目文档推荐的、更通用的方式查找元素
    const containerDiv = $app.find('div')[0];
    if (!containerDiv) {
      console.warn('[查重脚本] > 4.2. 样式注入失败: 未找到任何 div 元素。');
      return;
    }
    console.log('[查重脚本] > 4.3. 找到 containerDiv:', containerDiv);

    const scope_id = containerDiv.getAttributeNames().find((value: string) => value.startsWith('data-v-'));

    if (scope_id) {
      console.log(`[查重脚本] > 4.4. 找到 scope_id: ${scope_id}`);
      $app.append($(`head > style:contains("${scope_id}")`, document));
      console.log('[查重脚本] > 4.5. 样式已成功注入。');
    } else {
      console.warn('[查重脚本] > 4.6. 未找到 scope_id。');
    }
  }, 200); // 增加延迟以确保DOM渲染
}

// 在酒馆加载完成后执行
$(() => {
  // 脚本加载后自动打开查重面板
  openPanel().catch(err => {
    console.error('打开查重面板时出错:', err);
    toastr.error('打开查重面板时出错，详情请查看控制台。');
    closePanel(); // 如果出错则清理
  });
});
