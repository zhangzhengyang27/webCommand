import { proxyLimiter } from '../utils/rateLimit'
import { httpGetBuffer } from '../utils/httpClient'
import { bizHandler, BizError, ERROR_CODE } from '../utils/response'

// 股票行情（新浪，需 Referer，GBK 解码），对齐原 GET /api/stock
export default bizHandler(async (event) => {
  if (proxyLimiter.hit(event))
    throw new BizError(ERROR_CODE.RATE_LIMIT, '操作过于频繁，请稍后再试', 429)
  const code = getQuery(event).code as string | undefined
  if (!code) throw new BizError(ERROR_CODE.PARAMS, '缺少股票代码')
  try {
    const buf = await httpGetBuffer(`https://hq.sinajs.cn/list=${encodeURIComponent(code)}`, {
      Referer: 'https://finance.sina.com.cn',
    })
    const resp = new TextDecoder('gbk').decode(buf)
    const m = resp.match(/="(.+?)"/)
    if (!m || !m[1]) throw new BizError(ERROR_CODE.THIRD_PART, '无行情数据', 502)
    const f = m[1].split(',')
    return {
      name: f[0],
      open: f[1],
      preClose: f[2],
      price: f[3],
      high: f[4],
      low: f[5],
      volume: f[8],
      time: f[30],
    }
  } catch (e) {
    if (e instanceof BizError) throw e
    console.error('stock proxy error:', e)
    throw new BizError(ERROR_CODE.THIRD_PART, '获取行情失败', 502)
  }
})
