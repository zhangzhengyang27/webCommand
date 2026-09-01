import { proxyLimiter } from '../utils/rateLimit'
import { httpGetBuffer } from '../utils/httpClient'

// 股票行情（新浪，需 Referer，GBK 解码），对齐原 GET /api/stock
export default defineEventHandler(async (event) => {
  if (proxyLimiter.hit(event)) {
    setResponseStatus(event, 429)
    return { code: 40000, message: '操作过于频繁，请稍后再试', data: null }
  }
  const code = getQuery(event).code as string | undefined
  if (!code) {
    setResponseStatus(event, 400)
    return { code: 400, message: '缺少股票代码', data: null }
  }
  try {
    const buf = await httpGetBuffer(
      `https://hq.sinajs.cn/list=${encodeURIComponent(code)}`,
      { Referer: 'https://finance.sina.com.cn' },
    )
    const resp = new TextDecoder('gbk').decode(buf)
    const m = resp.match(/="(.+?)"/)
    if (!m || !m[1]) {
      setResponseStatus(event, 502)
      return { code: 502, message: '无行情数据', data: null }
    }
    const f = m[1].split(',')
    return {
      code: 0,
      data: {
        name: f[0],
        open: f[1],
        preClose: f[2],
        price: f[3],
        high: f[4],
        low: f[5],
        volume: f[8],
        time: f[30],
      },
    }
  } catch (e: any) {
    console.error('stock proxy error:', e?.message || e)
    setResponseStatus(event, 502)
    return { code: 502, message: '获取行情失败', data: null }
  }
})
