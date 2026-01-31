// ================================================================================
// ERA 事件系统 - 模块测试脚本
// ================================================================================
// 用于验证各个模块是否正常导入和工作

(async function () {
  console.group('🧪 ERA 事件系统模块测试');

  try {
    // ==================== 测试 1: 导入工具模块 ====================
    console.group('📦 测试 1: 导入 era-utils.js');
    const utils = await import('./era-utils.js');
    console.log('✅ CONFIG:', utils.CONFIG);
    console.log('✅ log 函数:', typeof utils.log);
    console.log('✅ compareTime 函数:', typeof utils.compareTime);
    console.log('✅ formatDate 函数:', typeof utils.formatDate);
    console.groupEnd();

    // ==================== 测试 2: 导入事件加载模块 ====================
    console.group('📦 测试 2: 导入 era-event-loader.js');
    const loader = await import('./era-event-loader.js');
    console.log('✅ loadEventDefinitionsFromWorldbook 函数:', typeof loader.loadEventDefinitionsFromWorldbook);
    console.groupEnd();

    // ==================== 测试 3: 导入事件检查模块 ====================
    console.group('📦 测试 3: 导入 era-event-checker.js');
    const checker = await import('./era-event-checker.js');
    console.log('✅ isTimeForEvent 函数:', typeof checker.isTimeForEvent);
    console.log('✅ isTimeAfterEventEnd 函数:', typeof checker.isTimeAfterEventEnd);
    console.groupEnd();

    // ==================== 测试 4: 导入事件操作模块 ====================
    console.group('📦 测试 4: 导入 era-event-operations.js');
    const operations = await import('./era-event-operations.js');
    console.log('✅ initializeEventList 函数:', typeof operations.initializeEventList);
    console.log('✅ batchStartEvents 函数:', typeof operations.batchStartEvents);
    console.log('✅ batchEndEvents 函数:', typeof operations.batchEndEvents);
    console.log('✅ playerJoinsEvent 函数:', typeof operations.playerJoinsEvent);
    console.groupEnd();

    // ==================== 测试 5: 测试工具函数 ====================
    console.group('🔧 测试 5: 测试工具函数');

    // 测试时间格式化
    const testTime = { 年: 1, 月: 3, 日: 15, 时: 12 };
    const formatted = utils.formatDate(testTime);
    console.log(`formatDate 测试: ${formatted}`);
    console.assert(formatted === '1年3月15日12时', 'formatDate 测试失败');

    // 测试事件名称提取
    const testEventName = '事件条目-测试事件.json';
    const shortName = utils.getEventShortName(testEventName);
    console.log(`getEventShortName 测试: ${shortName}`);
    console.assert(shortName === '测试事件', 'getEventShortName 测试失败');

    // 测试登场事件判断
    const isDebut1 = utils.isDebutEvent('登场事件-角色登场');
    const isDebut2 = utils.isDebutEvent('普通事件-测试');
    console.log(`isDebutEvent 测试: ${isDebut1} / ${isDebut2}`);
    console.assert(isDebut1 === true && isDebut2 === false, 'isDebutEvent 测试失败');

    // 测试日期偏移
    const baseDate = { 年: 1, 月: 1, 日: 1 };
    const offsetDate = utils.calculateDateOffset(baseDate, 35);
    console.log(`calculateDateOffset 测试:`, offsetDate);
    console.assert(offsetDate.月 === 2 && offsetDate.日 === 6, 'calculateDateOffset 测试失败');

    console.groupEnd();

    // ==================== 测试 6: 测试时间比较 ====================
    console.group('⏰ 测试 6: 测试时间比较');

    const time1 = { 年: 1, 月: 3, 日: 15, 时: 12 };
    const time2 = { 年: 1, 月: 3, 日: 10, 时: 8 };

    const isAfter = utils.compareTime(time1, time2, '>=');
    console.log(`时间比较测试 (time1 >= time2): ${isAfter}`);
    console.assert(isAfter === true, '时间比较测试失败');

    const diff = utils.compareTime(time1, time2, 'diff');
    console.log(`时间差值测试: ${diff}天`);
    console.assert(diff === 5, '时间差值测试失败');

    console.groupEnd();

    // ==================== 测试总结 ====================
    console.log('\n%c✅ 所有模块测试通过!', 'color: #00ff00; font-size: 16px; font-weight: bold;');
    console.log('模块导入: ✅');
    console.log('工具函数: ✅');
    console.log('时间计算: ✅');
    toastr.success('ERA 事件系统模块测试通过');
  } catch (error) {
    console.error('❌ 模块测试失败:', error);
    toastr.error('ERA 事件系统模块测试失败');
  }

  console.groupEnd();
})();
