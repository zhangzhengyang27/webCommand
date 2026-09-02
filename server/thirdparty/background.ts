import axios from 'axios'

const ALLOWED_TYPES = ['dongman', 'fengjing', 'meizi', 'suiji']

/**
 * 随机获取背景图 URL（对齐原 thirdpart/backgroundApi.js）。
 */
export async function getRandomBackground(type = 'dongman'): Promise<string | null> {
  const safeType = ALLOWED_TYPES.includes(type) ? type : 'dongman'
  const api = `https://api.btstu.cn/sjbz/api.php?lx=${safeType}&format=json`
  try {
    const res = await axios.get<{ imgurl?: string }>(api, { timeout: 5000 })
    return res.data?.imgurl ?? null
  } catch (error: unknown) {
    console.error('获取随机背景失败', error instanceof Error ? error.message : error)
    return null
  }
}
