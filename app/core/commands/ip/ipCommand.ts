import type { CommandType } from '../../command'
import myAxios from '../../../utils/myAxios'
import { errMsg } from '../../../utils/error'

/**
 * 公网 IP 查询命令 (#27)
 */
const ipCommand: CommandType = {
  func: 'ip',
  name: '公网 IP 查询',
  alias: ['ip查询', '公网ip', '我的ip'],
  desc: '查询当前客户端公网 IP',
  params: [],
  options: [],
  async action(options, terminal) {
    try {
      const res = await myAxios.get<{ ip: string }>('/ip')
      if (res?.code === 0 && res.data) {
        terminal.writeTextSuccessResult(`你的公网 IP：${res.data.ip}`)
      } else {
        terminal.writeTextErrorResult(res?.message ?? '查询失败')
      }
    } catch (e) {
      terminal.writeTextErrorResult(errMsg(e))
    }
  },
}

export default ipCommand
