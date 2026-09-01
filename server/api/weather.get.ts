import { proxyLimiter } from '../utils/rateLimit'
import { httpGetText } from '../utils/httpClient'

// 天气代理（解决 wttr.in 的 CORS），对齐原 GET /api/weather
export default defineEventHandler(async (event) => {
  if (proxyLimiter.hit(event)) {
    setResponseStatus(event, 429)
    return { code: 40000, message: '操作过于频繁，请稍后再试', data: null }
  }
  const query = getQuery(event)
  const city = query.city as string | undefined
  if (!city) {
    setResponseStatus(event, 400)
    return { code: 400, message: '缺少 city 参数', data: null }
  }
  const format =
    (query.format as string) || '%l: %c %t 湿度 %h 风速 %w'
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=${encodeURIComponent(
    format,
  )}`
  try {
    const result = await httpGetText(url)
    return { code: 0, data: result }
  } catch (e: any) {
    console.error('weather proxy error:', e?.message || e)
    setResponseStatus(event, 502)
    return { code: 502, message: '天气服务不可用', data: null }
  }
})
