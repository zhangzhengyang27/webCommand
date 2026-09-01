import type { ParsedOptions } from 'getopts'
import TerminalType = YuTerminal.TerminalType

/**
 * 命令类型
 */
interface CommandType {
  func: string // 命令英文 key（必须唯一）
  name: string // 命令名称
  desc?: string // 介绍
  alias?: string[] // 功能别名
  params?: CommandParamsType[] // 参数配置
  options: CommandOptionType[] // 选项配置
  subCommands?: Record<string, CommandType> // 子命令
  // 执行功能
  action: (options: ParsedOptions, terminal: TerminalType, parentCommand?: CommandType) => void
  // 结果是否允许折叠
  collapsible?: boolean
}

/**
 * 命令参数类型
 */
interface CommandParamsType {
  key: string // 参数名
  desc?: string // 描述
  defaultValue?: string | boolean
  required?: boolean // 是否必填
}

/**
 * 命令选项类型
 */
interface CommandOptionType {
  key: string // 参数名，比如 --word
  alias?: string[] // 命令简写，比如 -w
  desc?: string // 描述
  type: 'string' | 'boolean'
  defaultValue?: string | boolean // 默认值，标识作用
  required?: boolean // 是否必填
}
