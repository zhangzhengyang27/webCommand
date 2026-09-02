import type { CommandType } from '../../command'
import { CalcError, evaluate } from './calc'

/**
 * 安全计算器命令
 * @author m4tt72 (ported)
 */
const calcCommand: CommandType = {
  func: 'calc',
  name: '计算器',
  alias: ['calculator', 'jsq', '计算器'],
  desc: '安全算术表达式计算，支持 + - * / % 和括号',
  params: [
    {
      key: 'expression',
      desc: '算术表达式',
    },
  ],
  options: [],
  action(options, terminal) {
    const { _ } = options
    const expr = _.join(' ').trim()
    if (!expr) {
      terminal.writeTextResult(
        '用法：calc <表达式>\n示例：\n  calc 2+2\n  calc (3 + 4) * 2 - 1\n  calc 100 / 7\n支持：+ - * / % 和括号',
      )
      return
    }
    try {
      const result = evaluate(expr)
      terminal.writeTextResult(String(result))
    } catch (e) {
      if (e instanceof CalcError) {
        terminal.writeTextErrorResult(e.message)
      } else {
        terminal.writeTextErrorResult(`计算错误：${(e as Error).message}`)
      }
    }
  },
}

export default calcCommand
