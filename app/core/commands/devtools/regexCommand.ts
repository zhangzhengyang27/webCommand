import type { CommandType } from '../../command'

/**
 * 正则测试命令：列出所有匹配及分组
 */
const MAX_MATCHES = 100

const regexCommand: CommandType = {
  func: 'regex',
  name: '正则测试',
  desc: '测试正则表达式并列出匹配结果',
  params: [
    {
      key: 'pattern',
      desc: '正则表达式',
      required: true,
    },
    {
      key: 'text',
      desc: '待匹配文本',
      required: true,
    },
  ],
  options: [
    {
      key: 'ignoreCase',
      desc: '忽略大小写',
      alias: ['i'],
      type: 'boolean',
    },
    {
      key: 'multiline',
      desc: '多行模式',
      alias: ['m'],
      type: 'boolean',
    },
  ],
  action(options, terminal) {
    const { _, ignoreCase, multiline } = options
    const pattern = String(_[0] ?? '')
    const text = _.slice(1).join(' ')
    if (!pattern || !text) {
      terminal.writeTextErrorResult('用法：regex [-i] [-m] <正则> <文本>')
      return
    }
    let regex: RegExp
    try {
      regex = new RegExp(pattern, `g${ignoreCase ? 'i' : ''}${multiline ? 'm' : ''}`)
    } catch (e) {
      terminal.writeTextErrorResult(`正则无效：${e instanceof Error ? e.message : String(e)}`)
      return
    }
    const lines: string[] = []
    let m: RegExpExecArray | null
    let count = 0
    while ((m = regex.exec(text)) && count < MAX_MATCHES) {
      count++
      lines.push(`#${count} [${m.index}-${m.index + m[0].length}] ${m[0]}`)
      if (m.length > 1) {
        const groups = m
          .slice(1)
          .map((g, i) => `$${i + 1}=${g ?? 'undefined'}`)
          .join('  ')
        lines.push(`    分组：${groups}`)
      }
      // 防止零宽匹配导致死循环
      if (m[0] === '') {
        regex.lastIndex++
      }
    }
    if (!lines.length) {
      terminal.writeTextResult('无匹配')
      return
    }
    terminal.writeTextSuccessResult(
      lines.join('\n') + (count >= MAX_MATCHES ? '\n（仅显示前 100 个匹配）' : ''),
    )
  },
}

export default regexCommand
