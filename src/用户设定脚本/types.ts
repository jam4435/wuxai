/**
 * 用户设定脚本 - 类型定义
 */

// ==================== 接口定义 ====================

/**
 * Persona 信息接口
 */
export interface PersonaInfo {
  name: string;
  description?: string;
  avatarId?: string;
  isDefault?: boolean;
  isLockedToChat?: boolean;
  isLockedToCharacter?: boolean;
  isSelected?: boolean;
  // 用于编辑时保存原始名称
  originalName?: string;
}

/**
 * 角色设定条目接口
 * 每个角色可以有自己的设定列表
 */
export interface PersonaTrait {
  /** 唯一 ID */
  id: string;
  /** 名称 */
  name: string;
  /** 描述/设定内容 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 角色设定配置接口
 * 存储某个角色的所有设定条目
 */
export interface PersonaTraitsConfig {
  /** 角色 avatarId */
  avatarId: string;
  /** 角色名称（用于显示） */
  personaName: string;
  /** 设定条目列表 */
  traits: PersonaTrait[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ==================== 常量定义 ====================

/** 面板容器 ID */
export const PERSONA_PANEL_ID = 'persona-quick-panel';

/** 扩展菜单按钮 ID */
export const PERSONA_BUTTON_ID = 'persona-quick-btn';

/** 按钮提示文本 */
export const PERSONA_BUTTON_TOOLTIP = '用户角色快捷管理';

/** 按钮图标类名 */
export const PERSONA_BUTTON_ICON = 'fa-solid fa-user-gear';

/** 菜单中显示的按钮文本 */
export const PERSONA_BUTTON_TEXT_IN_MENU = '用户角色管理';

/** 角色设定存储键前缀 */
export const PERSONA_TRAITS_STORAGE_PREFIX = 'tavern_helper_persona_traits_';
