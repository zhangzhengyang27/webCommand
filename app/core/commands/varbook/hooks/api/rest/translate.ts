import { translate } from '../index'
import { enBase64 } from '../../character/base64'

/** varbook 翻译接口响应结构 */
export interface NamedVariablesResponse {
  code: number
  msg: string
  data: {
    namedVariables: Record<string, string>
  }
}

const { get } = translate

const getNamedVariables = async (searchText: string): Promise<NamedVariablesResponse> => {
  const s = enBase64(searchText)
  const params = {
    s,
  }
  const res = await get('', { params })
  return res as unknown as NamedVariablesResponse
}

export { getNamedVariables }
