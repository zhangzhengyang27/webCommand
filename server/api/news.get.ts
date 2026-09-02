import { proxyLimiter } from '../utils/rateLimit'
import { httpGetJson } from '../utils/httpClient'
import { bizHandler, BizError, ERROR_CODE } from '../utils/response'

interface NewsItem {
  rank: number
  title: string
  hot: string
  url?: string
}

/** 热搜源响应中最小区块（各源字段名不一致，统一映射到 NewsItem） */
interface NewsEntry {
  title?: string
  hot?: string
  hot_value?: string
  hotValue?: string
  link?: string
  url?: string
}

interface NewsSourceResponse {
  data?: NewsEntry[]
}

interface NewsSource {
  url: string
  map: (d: NewsSourceResponse) => NewsItem[]
}

// 新闻热搜（后端代理避免 CORS，多源容错），对齐原 GET /api/news
export default bizHandler(async (event) => {
  if (proxyLimiter.hit(event))
    throw new BizError(ERROR_CODE.RATE_LIMIT, '操作过于频繁，请稍后再试', 429)
  const type = String(getQuery(event).type || 'weibo')
  const sources: NewsSource[] = [
    {
      url: `https://60s.viki.moe/v2/${encodeURIComponent(type)}`,
      map: (d) =>
        (d.data ?? []).map((it, i) => ({
          rank: i + 1,
          title: it.title ?? '',
          hot: it.hot_value || it.hot || '',
          url: it.link || it.url,
        })),
    },
    {
      url: 'https://api.vvhan.com/api/hotlist?type=wbHot',
      map: (d) =>
        (d.data ?? []).map((it, i) => ({
          rank: i + 1,
          title: it.title ?? '',
          hot: it.hot ?? '',
          url: it.url,
        })),
    },
    {
      url: 'https://api.oioweb.cn/api/common/HotList?type=weibo',
      map: (d) =>
        (d.data ?? []).map((it, i) => ({
          rank: i + 1,
          title: it.title ?? '',
          hot: it.hot || it.hotValue || '',
          url: it.url,
        })),
    },
  ]
  for (const s of sources) {
    try {
      const d = await httpGetJson<NewsSourceResponse>(s.url)
      const list = s.map(d)
      if (list.length) return list.slice(0, 20)
    } catch (e) {
      console.error('news source failed:', s.url, e)
    }
  }
  throw new BizError(ERROR_CODE.THIRD_PART, '获取热搜失败', 502)
})
