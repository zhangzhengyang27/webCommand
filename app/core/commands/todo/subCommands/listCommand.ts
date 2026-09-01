import type { CommandType } from '../../../command'
import type { TaskFilter } from '../todoStore'
import { useTodoStore } from '../todoStore'
import MyDayjs from '../../../../utils/myDayjs'

/**
 * 列出任务命令
 */
const listCommand: CommandType = {
  func: 'list',
  name: '列出任务',
  alias: ['ls'],
  options: [
    {
      key: 'all',
      desc: '显示全部任务',
      alias: ['a'],
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'todo',
      desc: '仅显示未完成任务',
      alias: ['t'],
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'done',
      desc: '仅显示已完成任务',
      alias: ['d'],
      type: 'boolean',
      defaultValue: false,
    },
  ],
  action(options, terminal): void {
    const { all, todo, done } = options
    const store = useTodoStore()
    let filter: TaskFilter = 'all'
    if (all) {
      filter = 'all'
    } else if (todo) {
      filter = 'todo'
    } else if (done) {
      filter = 'done'
    }
    const taskList = store.filteredTaskList(filter)
    store.currentFilter = filter
    if (taskList.length === 0) {
      terminal.writeTextResult('暂无任务')
      return
    }
    const statusLabel = filter === 'all' ? '全部' : filter === 'todo' ? '未完成' : '已完成'
    terminal.writeTextResult(`[${statusLabel}] 共 ${taskList.length} 个任务：`)
    taskList.forEach((task, index) => {
      const status = task.isFinished ? '[x]' : '[ ]'
      const createTime = MyDayjs(task.createTime).format('MM-DD HH:mm')
      const finishTime = task.finishTime
        ? `，完成于 ${MyDayjs(task.finishTime).format('MM-DD HH:mm')}`
        : ''
      terminal.writeTextResult(
        `${index + 1}. ${status} ${task.name} (ID: ${task.id})\n     创建于 ${createTime}${finishTime}`,
      )
    })
  },
}

export default listCommand
