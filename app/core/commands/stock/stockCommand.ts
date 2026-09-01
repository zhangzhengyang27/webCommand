import type { CommandType } from '../../command'
import myAxios from '../../../utils/myAxios'

/**
 * 股票行情命令 (#27)
 */
const stockCommand: CommandType = {
  func: 'stock',
  name: '股票行情',
  alias: ['股票', '行情'],
  desc: '查询 A 股实时行情，如 stock sh600519',
  params: [
    {
      key: 'code',
      desc: '股票代码，如 sh600519 / sz000001',
      required: true,
    },
  ],
  options: [],
  async action(options, terminal) {
    const { _ } = options
    const code = _[0]
    if (!code) {
      terminal.writeTextErrorResult('用法：stock <代码，如 sh600519>')
      return
    }
    try {
      const res: any = await myAxios.get(`/stock?code=${encodeURIComponent(code)}`)
      if (res?.code === 0 && res.data) {
        const d = res.data
        terminal.writeTextSuccessResult(
          `${d.name}  现价 ${d.price}  今开 ${d.open}  昨收 ${d.preClose}  最高 ${d.high}  最低 ${d.low}`,
        )
      } else {
        terminal.writeTextErrorResult(res?.message ?? '获取失败')
      }
    } catch (e: any) {
      terminal.writeTextErrorResult(e?.message ?? '获取失败')
    }
  },
}

export default stockCommand
