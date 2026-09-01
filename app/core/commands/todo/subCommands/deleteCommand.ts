import type { CommandType } from '../../../command'
import { useTodoStore } from '../todoStore'

/**
 * 删除任务命令
 */
const deleteCommand: CommandType = {
  func: 'delete',
  name: '删除任务',
  alias: ['rm', 'remove'],
  params: [
    {
      key: 'identifier',
      desc: '任务序号或 ID',
      required: true,
    },
  ],
  options: [],
  action(options, terminal): void {
    const { _ } = options
    const identifier = String(_[0] ?? '').trim()
    if (!identifier) {
      terminal.writeTextErrorResult('请输入任务序号或 ID')
      return
    }
    const store = useTodoStore()
    let res: boolean
    const index = Number(identifier)
    if (!isNaN(index) && index >= 1) {
      // 序号按当前列表（可能与全量不同）定位真实任务，再按 id 删除，避免过滤态下删错
      const list = store.filteredTaskList(store.currentFilter)
      const target = list[index - 1]
      res = target ? store.deleteTaskById(target.id) : false
    } else {
      res = store.deleteTaskById(identifier)
    }
    if (res) {
      terminal.writeTextSuccessResult('删除任务成功')
    } else {
      terminal.writeTextErrorResult('删除失败，请检查任务序号或 ID')
    }
  },
}

export default deleteCommand
