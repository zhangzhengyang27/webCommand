import { baiduTranslate } from '../../thirdparty/baiduTranslate'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'

export default bizHandler(async (event) => {
  const { keywords, config } = (await readBody(event)) || {}
  if (!keywords) throw new BizError(ERROR_CODE.PARAMS, '请输入关键词')
  const result = await baiduTranslate(keywords, config)
  if (!result) throw new BizError(ERROR_CODE.THIRD_PART)
  return result
})
