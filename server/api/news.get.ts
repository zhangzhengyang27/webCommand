import { proxyLimiter } from '../utils/rateLimit'
import { httpGetJson } from '../utils/httpClient'

// 新闻热搜（后端代理避免 CORS，多源容错），对齐原 GET /api/news
export default defineEventHandler(async (event) => {
  if (proxyLimiter.hit(event)) {
    setResponseStatus(event, 429)
    return { code: 40000, message: '操作过于频繁，请稍后再试', data: null }
  }
  const type = String(getQuery(event).type || 'weibo')
  const sources = [
    {
      url: `https://60s.viki.moe/v2/${encodeURIComponent(type)}`,
      map: (d: any) =>
        (d.data || []).map((it: any, i: number) => ({
          rank: i + 1,
          title: it.title,
          hot: it.hot_value || it.hot || '',
          url: it.link || it.url,
        })),
    },
    {
      url: 'https://api.vvhan.com/api/hotlist?type=wbHot',
      map: (d: any) =>
        (d.data || []).map((it: any, i: number) => ({
          rank: i + 1,
          title: it.title,
          hot: it.hot,
          url: it.url,
        })),
    },
    {
      url: 'https://api.oioweb.cn/api/common/HotList?type=weibo',
      map: (d: any) =>
        (d.data || []).map((it: any, i: number) => ({
          rank: i + 1,
          title: it.title,
          hot: it.hot || it.hotValue,
          url: it.url,
        })),
    },
  ]
  for (const s of sources) {
    try {
      const d = await httpGetJson<any>(s.url)
      const list = s.map(d)
      if (list.length) return { code: 0, data: list.slice(0, 20) }
    } catch (e: any) {
      console.error('news source failed:', s.url, e?.message || e)
    }
  }
  setResponseStatus(event, 502)
  return { code: 502, message: '获取热搜失败', data: null }
})
