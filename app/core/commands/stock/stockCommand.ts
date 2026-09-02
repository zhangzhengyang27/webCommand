import type { CommandType } from '../../command'
import myAxios from '../../../utils/myAxios'
import { errMsg } from '../../../utils/error'

/** 股票行情（对齐 server/api/stock.get.ts 返回） */
interface StockQuote {
  name: string
  open: string
  preClose: string
  price: string
  high: string
  low: string
  volume: string
  time: string
}

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
      const res = await myAxios.get<StockQuote>(`/stock?code=${encodeURIComponent(code)}`)
      if (res?.code === 0 && res.data) {
        const d = res.data
        terminal.writeTextSuccessResult(
          `${d.name}  现价 ${d.price}  今开 ${d.open}  昨收 ${d.preClose}  最高 ${d.high}  最低 ${d.low}`,
        )
      } else {
        terminal.writeTextErrorResult(res?.message ?? '获取失败')
      }
    } catch (e) {
      terminal.writeTextErrorResult(errMsg(e))
    }
  },
}

export default stockCommand
