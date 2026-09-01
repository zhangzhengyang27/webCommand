import { getRandomBackground } from '../../../thirdparty/background'
import { bizHandler, BizError, ERROR_CODE } from '../../../utils/response'

export default bizHandler(async (event) => {
  const { type } = (await readBody(event)) || {}
  const result = await getRandomBackground(type)
  if (!result) throw new BizError(ERROR_CODE.THIRD_PART, '背景图获取失败')
  return result
})
