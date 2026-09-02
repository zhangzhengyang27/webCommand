import type { CommandType } from '../../command'

/**
 * 简单 curl-like HTTP 请求命令
 * @author m4tt72 (ported)
 */
const curlCommand: CommandType = {
  func: 'curl',
  name: 'HTTP 请求',
  alias: ['fetch', 'request', '请求'],
  desc: '发起简单的 GET 请求并返回文本内容（受浏览器 CORS 限制）',
  params: [
    {
      key: 'url',
      desc: '请求地址',
    },
  ],
  options: [
    {
      key: 'method',
      desc: '请求方法，默认 GET',
      alias: ['X'],
      type: 'string',
      defaultValue: 'GET',
    },
    {
      key: 'maxLength',
      desc: '最大返回字符数，默认 2000',
      alias: ['l'],
      type: 'string',
      defaultValue: '2000',
    },
  ],
  async action(options, terminal) {
    const { _, method = 'GET', maxLength = '2000' } = options
    const url = _[0]
    if (!url) {
      terminal.writeTextResult('用法：curl <URL> [-X GET] [-l 2000]')
      return
    }
    const limit = Number(maxLength)
    try {
      const res = await fetch(url, {
        method: String(method).toUpperCase(),
      })
      const text = await res.text()
      const output = text.length > limit ? text.slice(0, limit) + '\n...（已截断）' : text
      terminal.writeTextResult(output)
    } catch (e) {
      terminal.writeTextErrorResult(`请求失败：${(e as Error).message}（可能受 CORS 限制）`)
    }
  },
}

export default curlCommand
