import type { CommandType } from '../../command'
import { defineAsyncComponent } from 'vue'
import ComponentOutputType = YuTerminal.ComponentOutputType
import addCommand from './subCommands/addCommand'
import listCommand from './subCommands/listCommand'
import deleteCommand from './subCommands/deleteCommand'
import doneCommand from './subCommands/doneCommand'
import clearCommand from './subCommands/clearCommand'
import statsCommand from './subCommands/statsCommand'

/**
 * 待办事项命令
 * @author yupi
 */
const todoCommand: CommandType = {
  func: 'todo',
  name: '待办事项',
  desc: '记录和管理任务',
  alias: ['待办'],
  params: [
    {
      key: 'subCommand',
      desc: '子命令',
      required: true,
    },
  ],
  options: [],
  subCommands: {
    add: addCommand,
    list: listCommand,
    delete: deleteCommand,
    done: doneCommand,
    clear: clearCommand,
    stats: statsCommand,
  },
  collapsible: true,
  action(options, terminal) {
    const { _ } = options
    if (_.length < 1) {
      const output: ComponentOutputType = {
        type: 'component',
        component: defineAsyncComponent(() => import('./TodoBox.vue')),
      }
      terminal.writeResult(output)
      return
    }
  },
}

export default todoCommand
