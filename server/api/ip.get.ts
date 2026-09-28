import { proxyLimiter } from '../utils/rateLimit'
import { httpGetJson, httpGetText } from '../utils/httpClient'
import { bizHandler, BizError, ERROR_CODE } from '../utils/response'

interface IpSource {
  url: string
  text?: boolean
  pick: (d: unknown) => string
}

// 客户端公网 IP 查询（多源容错）
export default bizHandler(async (event) => {
  if (proxyLimiter.hit(event))
    throw new BizError(ERROR_CODE.RATE_LIMIT, '操作过于频繁，请稍后再试', 429)
  const sources: IpSource[] = [
    {
      url: 'https://api.ip.sb/jsonip',
      pick: (d) => String((d as Record<string, unknown>).ip ?? ''),
    },
    {
      url: 'https://api.ipify.org?format=json',
      pick: (d) => String((d as Record<string, unknown>).ip ?? ''),
    },
    {
      url: 'http://ip-api.com/json/?fields=query',
      pick: (d) => String((d as Record<string, unknown>).query ?? ''),
    },
    { url: 'https://ifconfig.me/ip', text: true, pick: (d) => String(d).trim() },
  ]
  for (const s of sources) {
    try {
      const raw = s.text ? await httpGetText(s.url) : await httpGetJson(s.url)
      const ip = s.pick(raw)
      if (ip) return { ip }
    } catch (e) {
      console.error('ip source failed:', s.url, e)
    }
  }
  throw new BizError(ERROR_CODE.THIRD_PART, '获取 IP 失败', 502)
})
