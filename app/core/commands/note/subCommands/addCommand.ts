import type { CommandType } from '../../../command'
import { useNoteStore } from '../noteStore'

/**
 * 添加速记
 */
const addCommand: CommandType = {
  func: 'add',
  name: '添加速记',
  options: [
    {
      key: 'text',
      desc: '速记内容',
      alias: ['t'],
      type: 'string',
    },
  ],
  action(options, terminal) {
    const text =
      options.text ||
      options._.join(' ')
        .replace(/^["']|["']$/g, '')
        .trim()
    if (!text) {
      terminal.writeTextErrorResult('用法：note add <内容>')
      return
    }
    const { addNote } = useNoteStore()
    if (addNote(text)) {
      terminal.writeTextSuccessResult('已记录')
    } else {
      terminal.writeTextErrorResult('记录失败')
    }
  },
}

export default addCommand
