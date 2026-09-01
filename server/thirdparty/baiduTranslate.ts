import axios from 'axios'
import md5 from 'md5'
import { BizError, ERROR_CODE } from '../utils/response'

interface TranslateConfig {
  from?: string
  to?: string
}

/**
 * 百度翻译（对齐原 thirdpart/baiduFanYi/baiduFanYiApi.js）。
 * 签名为标准 MD5，直接使用 md5 包，结果与原手写 md5.js 一致。
 */
export async function baiduTranslate(keywords: string, config?: TranslateConfig) {
  if (!keywords) return null
  const c = useRuntimeConfig()
  const appid = c.baiduAppid
  const key = c.baiduKey
  if (!appid || !key) throw new BizError(ERROR_CODE.THIRD_PART, '百度翻译配置缺失')

  const salt = Date.now()
  const from = config?.from ?? 'auto'
  const to = config?.to ?? 'auto'
  const sign = md5(appid + keywords + salt + key)

  const res = await axios({
    method: 'get',
    url: 'https://api.fanyi.baidu.com/api/trans/vip/translate',
    params: { q: keywords, appid, salt, from, to, sign },
    timeout: 5000,
  })
  const data = res.data
  if (data && data.error_code) {
    throw new BizError(ERROR_CODE.THIRD_PART, `百度翻译失败：${data.error_msg || data.error_code}`)
  }
  return data
}
