import { proxyLimiter } from '../utils/rateLimit'
import { httpGetText } from '../utils/httpClient'
import { bizHandler, BizError, ERROR_CODE } from '../utils/response'

// 天气代理（解决 wttr.in 的 CORS）
export default bizHandler(async (event) => {
  if (proxyLimiter.hit(event))
    throw new BizError(ERROR_CODE.RATE_LIMIT, '操作过于频繁，请稍后再试', 429)
  const query = getQuery(event)
  const city = query.city as string | undefined
  if (!city) throw new BizError(ERROR_CODE.PARAMS, '缺少 city 参数')
  const format = (query.format as string) || '%l: %c %t 湿度 %h 风速 %w'
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=${encodeURIComponent(format)}`
  try {
    return await httpGetText(url)
  } catch (e) {
    console.error('weather proxy error:', e)
    throw new BizError(ERROR_CODE.THIRD_PART, '天气服务不可用', 502)
  }
})
