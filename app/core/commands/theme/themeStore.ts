import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import themes from './themes.json'
import { useCloudSync } from '../../../composables/useCloudSync'
import { localIsFresher } from '../../../composables/cloudMerge'

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
    /**
     * 本地最后修改时刻（毫秒）；云端只同步主题名，调色板仍取自内置 themes.json。
     * 历史本地数据无该字段，视为 0，即云端优先。
     */
    const updatedAt = ref(0)

    const setTheme = (themeName: string) => {
      const theme = themes.find((t) => t.name.toLowerCase() === themeName.toLowerCase()) as
        TerminalTheme | undefined
      if (theme) {
        currentTheme.value = theme
        updatedAt.value = Date.now()
        return true
      }
      return false
    }

    /** 云端合并：仅在云端较新时套用其主题名（主题名在本地不存在时保持现状） */
    const applyCloudTheme = (themeName: unknown, cloudUpdatedAt: number) => {
      if (typeof themeName !== 'string' || !themeName) return
      if (localIsFresher({ updatedAt: cloudUpdatedAt }, updatedAt.value)) return
      // 套用云端主题；本地不含该主题名时 setTheme 返回 false，保持本地现状
      if (setTheme(themeName)) updatedAt.value = cloudUpdatedAt
    }

    const themeNames = themes.map((t) => t.name)

    const cloudSync = useCloudSync('theme', {
      serialize: () => ({ themeName: currentTheme.value.name, updatedAt: updatedAt.value }),
      merge: (data) => {
        if (!data || typeof data !== 'object') return
        const cloud = data as { themeName?: unknown; updatedAt?: unknown }
        applyCloudTheme(cloud.themeName, Number(cloud.updatedAt) || 0)
      },
    })

    return {
      currentTheme,
      updatedAt,
      setTheme,
      themeNames,
      /** 主题变更后同步到云端 */
      syncToCloud: () => cloudSync.syncToCloud(),
      /** 初始化云端同步：先拉取，再订阅后续变更（按用户幂等） */
      initCloudSync: () =>
        cloudSync.initCloudSync(() => {
          const stop = watch(currentTheme, () => cloudSync.syncToCloud(), { deep: true })
          return stop
        }),
      /** 重置云同步：解除订阅并清除初始化标记（注销时调用） */
      resetCloudSync: () => cloudSync.resetCloudSync(),
    }
  },
  {
    persist: {
      key: 'terminal-theme',
      storage: localStorage,
    },
  },
)
