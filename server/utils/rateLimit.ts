import type { H3Event } from 'h3'
import { boolSetting } from './appConfig'

interface RateLimiter {
  /** 返回 true 表示已被限流 */
  hit: (event: H3Event) => boolean
}

const MAX_KEYS = 10000

function sweep(map: Map<string, number[]>, windowMs: number) {
  const now = Date.now()
  for (const [key, hits] of map) {
    const recent = hits.filter((t) => now - t < windowMs)
    if (recent.length) map.set(key, recent)
    else map.delete(key)
  }
}

function recordHit(map: Map<string, number[]>, key: string, windowMs: number): number {
  const now = Date.now()
  if (!map.has(key) && map.size >= MAX_KEYS) {
    sweep(map, windowMs)
    if (map.size >= MAX_KEYS) map.delete(map.keys().next().value as string)
  }
  const hits = (map.get(key) || []).filter((t) => now - t < windowMs)
  hits.push(now)
  map.set(key, hits)
  return hits.length
}

/**
 * 获取真实客户端 IP；仅当 TRUST_PROXY=true 时信任 x-forwarded-for，
 * 防止伪造该头绕过限流（对齐原 getClientIp）。
 */
export function getClientIp(event: H3Event): string {
  const cfg = useRuntimeConfig(event)
  const fwd = getRequestHeader(event, 'x-forwarded-for')
  // 走 boolSetting 而非直接读 cfg.trustProxy：容器里的 TRUST_PROXY 不会映射进 runtimeConfig
  if (boolSetting(cfg.trustProxy, 'NUXT_TRUST_PROXY', 'TRUST_PROXY') && fwd) {
    return fwd.split(',')[0]!.trim()
  }
  return event.node.req.socket.remoteAddress || ''
}

/**
 * 创建按 IP 限流的内存限流器（对齐原 createRateLimiter）。
 */
export function createRateLimiter(windowMs: number, max: number): RateLimiter {
  const map = new Map<string, number[]>()
  const timer = setInterval(() => sweep(map, windowMs), Math.max(windowMs, 60 * 1000))
  if (timer.unref) timer.unref()
  return {
    hit(event: H3Event) {
      return recordHit(map, getClientIp(event), windowMs) > max
    },
  }
}

// 公网代理接口限流：每 IP 每分钟 30 次
export const proxyLimiter = createRateLimiter(60 * 1000, 30)
// 登录/注册/找回密码限流：每 IP 每分钟 10 次，防爆破
export const authLimiter = createRateLimiter(60 * 1000, 10)
// 云同步读写限流：每次同步为「拉取 + 上传」两个请求，按每 IP 每分钟 120 次
export const dataLimiter = createRateLimiter(60 * 1000, 120)
