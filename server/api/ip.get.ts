import { proxyLimiter } from '../utils/rateLimit'
import { httpGetJson, httpGetText } from '../utils/httpClient'

// 客户端公网 IP 查询（多源容错），对齐原 GET /api/ip
export default defineEventHandler(async (event) => {
  if (proxyLimiter.hit(event)) {
    setResponseStatus(event, 429)
    return { code: 40000, message: '操作过于频繁，请稍后再试', data: null }
  }
  const sources: Array<{
    url: string
    text?: boolean
    pick: (d: any) => string
  }> = [
    { url: 'https://api.ip.sb/jsonip', pick: (d) => d.ip },
    { url: 'https://api.ipify.org?format=json', pick: (d) => d.ip },
    { url: 'http://ip-api.com/json/?fields=query', pick: (d) => d.query },
    { url: 'https://ifconfig.me/ip', text: true, pick: (d) => d.trim() },
  ]
  for (const s of sources) {
    try {
      const ip = s.text ? s.pick(await httpGetText(s.url)) : s.pick(await httpGetJson<any>(s.url))
      if (ip) return { code: 0, data: { ip } }
    } catch (e: any) {
      console.error('ip source failed:', s.url, e?.message || e)
    }
  }
  setResponseStatus(event, 502)
  return { code: 502, message: '获取 IP 失败', data: null }
})
