import { defineStore } from 'pinia'
import { ref } from 'vue'
import themes from './themes.json'

export interface TerminalTheme {
  name: string
  background: string
  foreground: string
  prompt: string
  success: string
  error: string
  warning: string
  link: string
}

const defaultTheme = themes.find((t) => t.name === 'GruvboxDark') as TerminalTheme

/**
 * 终端主题 Store
 */
export const useThemeStore = defineStore(
  'terminalTheme',
  () => {
    const currentTheme = ref<TerminalTheme>(defaultTheme)

    const setTheme = (themeName: string) => {
      const theme = themes.find((t) => t.name.toLowerCase() === themeName.toLowerCase()) as
        TerminalTheme | undefined
      if (theme) {
        currentTheme.value = theme
        return true
      }
      return false
    }

    const themeNames = themes.map((t) => t.name)

    return {
      currentTheme,
      setTheme,
      themeNames,
    }
  },
  {
    persist: {
      key: 'terminal-theme',
      storage: localStorage,
    },
  },
)
