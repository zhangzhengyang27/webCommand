import type { CommandType } from '../../command'
import myAxios from '../../../utils/myAxios'

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
      const res: any = await myAxios.get('/ip')
      if (res?.code === 0 && res.data) {
        terminal.writeTextSuccessResult(`你的公网 IP：${res.data.ip}`)
      } else {
        terminal.writeTextErrorResult(res?.message ?? '查询失败')
      }
    } catch (e: any) {
      terminal.writeTextErrorResult(e?.message ?? '查询失败')
    }
  },
}

export default ipCommand
