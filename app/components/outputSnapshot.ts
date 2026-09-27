/**
 * 终端输出快照的序列化工具（从 Terminal.vue 抽出，便于单测）。
 *
 * 组件输出（defineAsyncComponent 的结果）无法 JSON 序列化：直接存会得到
 * 类似 {"name":"AsyncComponentWrapper"} 的空壳，恢复后 <component :is> 拿到
 * 普通对象，渲染成一片空白。所以写快照和读快照都必须把它换成提示文本。
 */

/**
 * 脱敏命令历史中的密码参数，避免明文凭据落入 localStorage
 * 覆盖 -p xxx / -p=xxx / --password xxx / --password=xxx / -password xxx
 */
export function redactSensitiveText(text: string): string {
  if (!text) {
    return text
  }
  return text.replace(/(--?password|-p)\b(=|\s+)(\S+)/gi, (_m, flag, sep) => `${flag}${sep}***`)
}

/** 组件内容无法恢复，用一个明确的占位说明替代空白 */
export const COMPONENT_OMITTED_TEXT = '（该内容包含交互组件，刷新后已省略）'

/**
 * 清洗一条输出，使其可安全 JSON 序列化。
 *
 * 注意命令行（type: 'command'）自己带着 resultList，交互组件就嵌在里面：
 * 只处理顶层字段、不递归进去，脏数据就会留在快照里 —— 这正是之前刷新后
 * help / todo list 等输出变空白的原因。
 */
export function sanitizeForSnapshot(o: unknown): unknown {
  if (!o || typeof o !== 'object') {
    return null
  }
  const obj = o as Record<string, unknown>
  if (obj.type === 'component') {
    return { type: 'text', text: COMPONENT_OMITTED_TEXT }
  }
  let cleaned: Record<string, unknown> = obj
  // 命令回显同样需要脱敏，避免 `user login -p xxx` 明文落入 localStorage
  if (obj.type === 'command' && typeof obj.text === 'string') {
    cleaned = { ...obj, text: redactSensitiveText(obj.text) }
  }
  if (Array.isArray(cleaned.resultList)) {
    cleaned = {
      ...cleaned,
      resultList: cleaned.resultList.map((r) => sanitizeForSnapshot(r)).filter(Boolean),
    }
  }
  return cleaned
}
