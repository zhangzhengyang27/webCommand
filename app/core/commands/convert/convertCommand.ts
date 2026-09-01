import type { CommandType } from '../../command'
import { convert, listSupportedUnits } from './convert'

/**
 * 单位换算命令
 * @author m4tt72 (ported)
 */
const convertCommand: CommandType = {
  func: 'convert',
  name: '单位换算',
  alias: ['conv', 'dwhs', '转换', '单位换算'],
  desc: '长度、质量、温度、数据单位换算',
  params: [
    {
      key: 'value',
      desc: '数值',
      required: true,
    },
    {
      key: 'from',
      desc: '原单位',
      required: true,
    },
    {
      key: 'to',
      desc: '目标单位',
      required: true,
    },
  ],
  options: [],
  action(options, terminal) {
    const { _ } = options
    if (_.length === 0) {
      terminal.writeTextResult(
        `用法：convert <数值> <原单位> to <目标单位>\n示例：\n  convert 100 km to mi\n  convert 0 C to F\n  convert 1 GiB to MiB\n支持单位：\n${listSupportedUnits()}`,
      )
      return
    }
    if (_.length !== 4 || _[2] !== 'to') {
      terminal.writeTextErrorResult('格式错误，应为：convert <数值> <原单位> to <目标单位>')
      return
    }
    const value = Number(_[0])
    if (Number.isNaN(value)) {
      terminal.writeTextErrorResult(`'${_[0]}' 不是有效数字`)
      return
    }
    const result = convert(value, _[1], _[3])
    if (!result.ok) {
      terminal.writeTextErrorResult(result.error)
      return
    }
    terminal.writeTextResult(`${value} ${result.fromUnit} = ${result.value} ${result.toUnit}`)
  },
}

export default convertCommand
