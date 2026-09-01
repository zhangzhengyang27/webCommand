import { proxyLimiter } from '../utils/rateLimit'

// 二维码生成（返回图片 URL），对齐原 GET /api/qrcode
export default defineEventHandler(async (event) => {
  if (proxyLimiter.hit(event)) {
    setResponseStatus(event, 429)
    return { code: 40000, message: '操作过于频繁，请稍后再试', data: null }
  }
  const text = getQuery(event).text as string | undefined
  if (!text) {
    setResponseStatus(event, 400)
    return { code: 400, message: '缺少内容', data: null }
  }
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    text,
  )}`
  return { code: 0, data: url }
})
