import type { CommandType } from '../../command'

/**
 * JSON 工具命令：格式化 / 压缩 / 校验
 */
const jsonCommand: CommandType = {
  func: 'json',
  name: 'JSON 工具',
  alias: ['json格式化'],
  desc: '格式化、压缩或校验 JSON 文本',
  params: [
    {
      key: 'text',
      desc: 'JSON 文本',
      required: true,
    },
  ],
  options: [
    {
      key: 'compact',
      desc: '压缩为单行',
      alias: ['c'],
      type: 'boolean',
    },
  ],
  action(options, terminal) {
    const { _, compact } = options
    const text = _.join(' ').trim()
    if (!text) {
      terminal.writeTextErrorResult('用法：json [-c] <JSON 文本>')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      terminal.writeTextErrorResult(`JSON 无效：${e instanceof Error ? e.message : String(e)}`)
      return
    }
    const output = compact ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2)
    terminal.writeTextSuccessResult(output)
  },
}

export default jsonCommand
