import type { CommandType } from '../../../command'
import { useNoteStore } from '../noteStore'

/**
 * 清空速记
 */
const clearCommand: CommandType = {
  func: 'clear',
  name: '清空速记',
  options: [],
  action(options, terminal) {
    const { clearNotes } = useNoteStore()
    const count = clearNotes()
    terminal.writeTextSuccessResult(`已清空 ${count} 条速记`)
  },
}

export default clearCommand
