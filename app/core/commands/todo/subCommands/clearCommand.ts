import type { CommandType } from '../../../command'
import { useTodoStore } from '../todoStore'

/**
 * 清空已完成任务命令
 */
const clearCommand: CommandType = {
  func: 'clear',
  name: '清空已完成任务',
  alias: [],
  options: [
    {
      key: 'all',
      desc: '是否清空所有任务',
      alias: ['a'],
      type: 'boolean',
      defaultValue: false,
    },
  ],
  action(options, terminal): void {
    const { all } = options
    const { clearAll, clearFinished } = useTodoStore()
    if (all) {
      clearAll()
      terminal.writeTextSuccessResult('已清空所有任务')
      return
    }
    clearFinished()
    terminal.writeTextSuccessResult('已清空已完成任务')
  },
}

export default clearCommand
