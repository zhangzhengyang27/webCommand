/**
 * 提取任意异常的可读 message。
 * axios 拦截器 reject 的是 { code, message } 对象而非 Error 实例，
 * 统一在此处理，替代各处 `catch (e: any) { e?.message }`。
 */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = (e as { message?: unknown }).message
    if (typeof msg === 'string') return msg
  }
  return String(e)
}
