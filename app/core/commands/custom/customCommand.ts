import type { CommandType } from '../../command'
import { useCustomCommandStore } from './customStore'

/**
 * 用户自定义命令（快捷方式）(#73)
 * 用法：
 *   custom add <名称> <要执行的命令>   定义一个快捷命令
 *   custom list                       查看所有自定义命令
 *   custom remove <名称>              删除自定义命令
 * 定义后，直接在终端输入 <名称> 即可执行对应的命令
 */
const customCommand: CommandType = {
  func: 'custom',
  name: '自定义命令',
  alias: ['alias', '快捷'],
  desc: '管理用户自定义快捷命令',
  params: [
    {
      key: 'subCommand',
      desc: '子命令：add / list / remove',
      required: true,
    },
  ],
  options: [],
  async action(options, terminal) {
    const { _ } = options
    const sub = (_[0] || '').toLowerCase()
    const store = useCustomCommandStore()
    if (!sub) {
      terminal.writeTextErrorResult('请输入子命令：add / list / remove')
      return
    }
    if (sub === 'add') {
      // custom add name command...
      const rest = _.slice(1)
      if (rest.length < 2) {
        terminal.writeTextErrorResult('用法：custom add <名称> <要执行的命令>')
        return
      }
      const name = rest[0]
      // 剥离首尾引号：custom add g "goto baidu" 不应把引号一起存入映射
      const commandText = rest
        .slice(1)
        .join(' ')
        .replace(/^["']|["']$/g, '')
      store.addCustom(name, commandText)
      terminal.writeTextSuccessResult(`已添加自定义命令 '${name}' => '${commandText}'`)
      return
    }
    if (sub === 'list') {
      const list = store.listCustom()
      if (list.length === 0) {
        terminal.writeTextResult('暂无自定义命令')
        return
      }
      list.forEach(([name, text]) => {
        terminal.writeTextResult(`${name} => ${text}`)
      })
      return
    }
    if (sub === 'remove') {
      const name = _[1]
      if (!name) {
        terminal.writeTextErrorResult('用法：custom remove <名称>')
        return
      }
      if (!store.getCustom(name)) {
        terminal.writeTextErrorResult(`自定义命令 '${name}' 不存在`)
        return
      }
      store.removeCustom(name)
      terminal.writeTextSuccessResult(`已删除自定义命令 '${name}'`)
      return
    }
    terminal.writeTextErrorResult(`未知子命令 '${sub}'，可用：add / list / remove`)
  },
}

export default customCommand
