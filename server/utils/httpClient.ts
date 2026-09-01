/**
 * 服务端出站 HTTP 助手（替代原 index.js 中基于 https 的 httpsGet*）。
 * 使用 Node 全局 fetch：自动跟随重定向、8s 超时、状态码校验。
 */

const DEFAULT_HEADERS = { 'User-Agent': 'curl/8.0' }

async function fetchOrThrow(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { ...DEFAULT_HEADERS, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`上游返回 ${res.status}: ${url}`)
  return res
}

export async function httpGetText(
  url: string,
  headers?: Record<string, string>,
): Promise<string> {
  const res = await fetchOrThrow(url, headers)
  return await res.text()
}

export async function httpGetJson<T = any>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  return JSON.parse(await httpGetText(url, headers)) as T
}

export async function httpGetBuffer(
  url: string,
  headers?: Record<string, string>,
): Promise<Buffer> {
  const res = await fetchOrThrow(url, headers)
  return Buffer.from(await res.arrayBuffer())
}
