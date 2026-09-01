import type { Ref } from 'vue'
import { ref } from 'vue'
import CommandOutputType = Terminal.CommandOutputType
import CommandInputType = Terminal.CommandInputType

/**
 * 查看历史功能
 * @param commandList 命令列表的 Ref（持引用，避免恢复历史时整体替换数组导致失联）
 * @param inputCommand
 */
const useHistory = (commandList: Ref<CommandOutputType[]>, inputCommand: Ref<CommandInputType>) => {
  /**
   * 当前查看的命令位置
   */
  const commandHistoryPos = ref(commandList.value.length)

  const listCommandHistory = () => {
    return commandList.value
  }

  const showNextCommand = () => {
    if (commandHistoryPos.value < commandList.value.length - 1) {
      commandHistoryPos.value++
      inputCommand.value.text = commandList.value[commandHistoryPos.value].text
    } else if (commandHistoryPos.value === commandList.value.length - 1) {
      commandHistoryPos.value++
      inputCommand.value.text = ''
    }
  }

  const showPrevCommand = () => {
    if (commandHistoryPos.value >= 1) {
      commandHistoryPos.value--
      inputCommand.value.text = commandList.value[commandHistoryPos.value].text
    }
  }

  return {
    commandHistoryPos,
    listCommandHistory,
    showNextCommand,
    showPrevCommand,
  }
}

export default useHistory
