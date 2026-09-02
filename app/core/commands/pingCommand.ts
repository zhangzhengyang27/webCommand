import type { CommandType } from '../command'
//import axios from "axios";

/**
 * ping 命令
 * @author yupi
 */
const pingCommand: CommandType = {
  func: 'ping',
  name: '网络连通测试',
  desc: '检测某个地址是否存活',
  alias: ['检测', '网络'],
  params: [
    {
      key: 'dest',
      desc: '目标地址',
      required: true,
    },
  ],
  options: [
    {
      key: 'timeout',
      desc: '请求超时时间(单位:毫秒)',
      alias: ['t'],
      type: 'string',
      defaultValue: '3000',
    },
  ],
  async action(options, terminal) {
    const { _ } = options
    const { timeout = '3000' } = options
    if (_.length < 1) {
      terminal.writeTextErrorResult('参数不足')
      return
    }
    let dest = _[0]!
    if (!dest.toLowerCase().startsWith('http://') && !dest.toLowerCase().startsWith('https://')) {
      dest = 'https://' + dest
    }
    // 尊重用户输入的协议，不再强制把 http 转为 https
    const startTime = Date.now()
    try {
      const resp = await fetch(dest, {
        mode: 'no-cors',
        cache: 'reload',
        signal: AbortSignal.timeout(Number(timeout)),
      })
      if (resp.ok || resp.status === 200 || resp.type === 'opaque') {
        terminal.writeTextSuccessResult('目标地址正常')
        terminal.writeTextResult(`延迟=${Date.now() - startTime}ms`)
      } else {
        terminal.writeTextErrorResult('ping 不通！')
      }
    } catch {
      terminal.writeTextErrorResult('ping 不通！')
    }
  },
}

export default pingCommand
