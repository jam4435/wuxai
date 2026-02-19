# 用户设定脚本 - Persona 管理助手

## 📋 功能概述

这是一个用于 SillyTavern 酒馆的用户角色（Persona）管理脚本，提供快捷的 Persona 切换和管理功能。

## ✨ 主要功能

- **快速切换用户角色** - 在不同的 Persona 之间快速切换
- **临时切换** - 仅在当前会话中使用临时名称
- **锁定到聊天** - 自动在打开特定聊天时切换到指定 Persona
- **锁定到角色** - 自动在打开特定角色时切换到指定 Persona
- **同步消息** - 将所有用户消息归属到当前 Persona
- **状态显示** - 显示当前 Persona 状态
- **角色设定管理** - 每个角色独立的设定列表，开启后自动拼接到人设描述中
- **规则自动启用** - 按聊天/角色上下文匹配规则，自动启用指定 trait/Profile
- **设定预设（Profile）** - 将多个 trait 组合为预设，一键激活/取消
- **变更保护** - 关键变更自动生成快照，支持回滚上一版与查看快照列表
- **兼容性自检** - 启动和面板内可检查关键 DOM/API 可用性

## 📁 文件结构

```
用户设定脚本/
├── index.ts      # 脚本入口，初始化逻辑
├── handlers.ts   # 事件处理和 Persona 操作函数
├── ui.ts         # UI 创建和面板控制
├── styles.ts     # CSS 样式定义
├── types.ts      # TypeScript 类型和常量定义
├── 信息.txt      # 酒馆用户设定管理的完整前端代码
└── README.md     # 本文档
```

## 🔧 使用方法

### 基本操作

1. 脚本加载后会在酒馆扩展菜单中添加「用户角色管理」按钮
2. 点击按钮打开管理面板
3. 在面板中可以：
   - 查看和切换当前 Persona
   - 编辑角色的名称和描述
   - 使用锁定功能绑定 Persona 到聊天/角色
   - 同步消息到当前 Persona

### 角色设定功能

每个角色可以拥有独立的设定列表：

1. 在角色列表中选中一个角色
2. 在角色详情区可以看到「角色设定列表」
3. 点击「➕ 添加」按钮创建新的设定条目
4. 编辑设定的名称和描述内容
5. 勾选复选框启用/禁用设定
6. 启用的设定会自动拼接到最终人设描述中（基础描述 + 自动拼装）

设定拼装格式：

```text
[原始人设描述]

--- 角色设定 ---
- [启用的设定条目1]
- [启用的设定条目2]
...
```

### 设定预设（Profile）

1. 在「设定预设（Profile）」中点击「新建」
2. 选择要纳入预设的 trait
3. 通过下拉框切换手动激活的 Profile
4. 规则命中的 Profile 会与手动 Profile 叠加生效

### 规则自动启用

1. 在「规则自动启用」中添加规则
2. 选择匹配范围（聊天/角色）和匹配方式（includes/equals/regex）
3. 填写匹配内容（可用 chatId/角色名等）
4. 选择命中后自动启用的 trait 或 Profile
5. 聊天/角色上下文变化时会自动重算并同步描述

### 变更保护与回滚

- 会在 trait/Profile/规则/描述等关键变更前自动记录快照
- 可在「变更保护」中回滚上一版
- 可查看最近快照历史（时间 + 原因）

### 兼容性自检

- 初始化时自动检查关键依赖（jQuery、扩展菜单、Persona 列表、triggerSlash 等）
- 可在面板中点击「重新检测」
- 自检失败会显示风险项，便于定位酒馆版本差异问题

## 🛠️ 技术实现

- 使用 jQuery 操作 DOM
- 通过 `window.parent.document` 访问酒馆主文档
- 使用 Slash 命令 (`/persona`, `/persona-lock`, `/persona-sync`) 执行操作
- 样式注入到父文档和 iframe
- 数据存储在 localStorage 中：
  - `tavern_helper_persona_traits_{avatarId}` - trait 列表
  - `tavern_helper_persona_advanced_{avatarId}` - Profile + 自动规则 + 当前激活 Profile
  - `tavern_helper_persona_base_desc_{avatarId}` - 基础描述
  - `tavern_helper_persona_snapshot_{avatarId}` - 变更保护快照

## 📝 相关 Slash 命令

| 命令                              | 说明                   |
| --------------------------------- | ---------------------- |
| `/persona <name>`                 | 切换到指定 Persona     |
| `/persona mode=temp <name>`       | 临时切换名称           |
| `/persona-lock type=chat on`      | 锁定到当前聊天         |
| `/persona-lock type=character on` | 锁定到当前角色         |
| `/persona-lock type=none`         | 解除锁定               |
| `/persona-sync`                   | 同步消息到当前 Persona |

## 🎨 UI 元素 ID

- `persona-quick-panel` - 主面板容器
- `persona-quick-btn` - 扩展菜单按钮
- `current-persona-name` - 当前 Persona 显示
- `persona-name-input` - Persona 名称输入框
- `persona-traits-container` - 角色设定列表容器
- `persona-profile-select` - Profile 选择器
- `persona-rules-container` - 自动规则列表容器
- `persona-snapshot-info` - 变更快照状态
- `persona-compat-details` - 兼容性自检详情

## 📄 许可证

此脚本遵循项目整体许可证。
