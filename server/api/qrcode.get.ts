import { proxyLimiter } from '../utils/rateLimit'
import { bizHandler, BizError, ERROR_CODE } from '../utils/response'

// 二维码生成（返回图片 URL），对齐原 GET /api/qrcode
export default bizHandler(async (event) => {
  if (proxyLimiter.hit(event))
    throw new BizError(ERROR_CODE.RATE_LIMIT, '操作过于频繁，请稍后再试', 429)
  const text = getQuery(event).text as string | undefined
  if (!text) throw new BizError(ERROR_CODE.PARAMS, '缺少内容')
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    text,
  )}`
  return url
})
