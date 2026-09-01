import { proxyLimiter } from '../utils/rateLimit'
import { httpGetJson } from '../utils/httpClient'

// 翻译代理（Google，替代已失效的百度前端直连），对齐原 POST /api/translate
export default defineEventHandler(async (event) => {
  if (proxyLimiter.hit(event)) {
    setResponseStatus(event, 429)
    return { code: 40000, message: '操作过于频繁，请稍后再试', data: null }
  }
  const { text, from, to } = (await readBody(event)) || {}
  if (!text) {
    setResponseStatus(event, 400)
    return { code: 400, message: '缺少翻译内容', data: null }
  }
  const sl = from && from !== 'auto' ? from : 'auto'
  const tl = to && to !== 'auto' ? to : 'zh-CN'
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&q=${encodeURIComponent(
    text,
  )}&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t`
  try {
    const apiRes = await httpGetJson<any[]>(url)
    const translated = ((apiRes[0] || []) as any[])
      .map((seg) => seg[0])
      .join('')
      .trim()
    if (!translated) {
      setResponseStatus(event, 502)
      return { code: 502, message: '翻译结果为空', data: null }
    }
    return { code: 0, data: { trans_result: [{ dst: translated }] } }
  } catch (e: any) {
    console.error('translate proxy error:', e?.message || e)
    setResponseStatus(event, 502)
    return { code: 502, message: '翻译服务不可用', data: null }
  }
})
