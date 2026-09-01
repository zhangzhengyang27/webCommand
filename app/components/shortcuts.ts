/**
 * 快捷键系统
 * @author yupi
 */
import TerminalType = Terminal.TerminalType

/**
 * 注册快捷键
 * @param terminal
 * @returns 清理函数，用于移除事件监听
 */
export const registerShortcuts = (terminal: TerminalType) => {
  const keydownHandler = (e: KeyboardEvent) => {
    // console.log(e);
    const key = e.key
    // 自动聚焦输入框
    if (key >= 'a' && key <= 'z' && !e.metaKey && !e.shiftKey && !e.ctrlKey) {
      terminal.focusInput()
      return
    }
    // 匹配快捷键
    const code = e.code
    for (const shortcut of shortcutList) {
      if (
        code === shortcut.code &&
        e.ctrlKey == !!shortcut.ctrlKey &&
        e.metaKey == !!shortcut.metaKey &&
        e.shiftKey == !!shortcut.shiftKey
      ) {
        shortcut.action(e, terminal)
      }
    }
  }
  document.addEventListener('keydown', keydownHandler)
  return () => {
    document.removeEventListener('keydown', keydownHandler)
  }
}

/**
 * 快捷键类型
 */
interface ShortcutType {
  code: string // 按键码
  desc?: string // 功能描述
  keyDesc?: string // 按键描述
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  action: (e: Event, terminal: TerminalType) => void
}

/**
 * 快捷键列表
 */
export const shortcutList: ShortcutType[] = [
  {
    desc: '清屏',
    code: 'KeyL',
    keyDesc: 'Ctrl + L',
    ctrlKey: true,
    action(e, terminal) {
      e.preventDefault()
      terminal.clear()
    },
  },
  {
    desc: '折叠',
    code: 'KeyO',
    keyDesc: 'Ctrl + O',
    ctrlKey: true,
    action(e, terminal) {
      e.preventDefault()
      terminal.toggleAllCollapse()
    },
  },
  {
    desc: '聚焦输入框',
    code: 'KeyV',
    keyDesc: 'Ctrl + V',
    metaKey: true,
    action(e, terminal) {
      terminal.focusInput()
    },
  },
  {
    code: 'Tab',
    action(e, terminal) {
      e.preventDefault()
      if (terminal.isInputFocused()) {
        terminal.setTabCompletion()
      } else {
        terminal.focusInput()
      }
    },
  },
  {
    code: 'Backspace',
    action(e, terminal) {
      terminal.focusInput()
    },
  },
  {
    code: 'Enter',
    action(e, terminal) {
      terminal.focusInput()
    },
  },
  {
    desc: '查看上一条命令',
    code: 'ArrowUp',
    keyDesc: '↑',
    action(e, terminal) {
      e.preventDefault()
      terminal.showPrevCommand()
    },
  },
  {
    desc: '反向搜索历史',
    code: 'KeyR',
    keyDesc: 'Ctrl + R',
    ctrlKey: true,
    action(e, terminal) {
      e.preventDefault()
      terminal.reverseSearch()
    },
  },
  {
    desc: '退出历史搜索',
    code: 'Escape',
    action(e, terminal) {
      terminal.exitReverseSearch()
    },
  },
  {
    desc: '查看下一条命令',
    code: 'ArrowDown',
    keyDesc: '↓',
    action(e, terminal) {
      e.preventDefault()
      terminal.showNextCommand()
    },
  },
  {
    desc: '命令面板',
    code: 'KeyK',
    keyDesc: 'Ctrl + K',
    ctrlKey: true,
    action(e, terminal) {
      e.preventDefault()
      terminal.openCommandPalette()
    },
  },
]
