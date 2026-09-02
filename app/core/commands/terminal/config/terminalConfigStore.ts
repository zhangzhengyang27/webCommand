import { defineStore } from 'pinia'

/**
 * 终端配置状态存储
 *
 * @author zhangzhengyang
 */
export const useTerminalConfigStore = defineStore('terminalConfig', {
  state: () => ({
    background: 'black', // 背景
    showHint: true, // 输入提示
    welcomeTexts: [] as string[], // 终端欢迎语
  }),
  getters: {},
  // 持久化
  persist: {
    key: 'terminal-config-store',
    storage: window.localStorage,
    beforeHydrate: (_context) => {
      console.log('加载终端配置数据开始')
    },
    afterHydrate: (_context) => {
      console.log('加载终端配置数据结束')
    },
  },
  actions: {
    setBackground(url: string) {
      if (!url) {
        return
      }
      this.background = url
    },
    /**
     * 设置或反转提示
     * @param hint
     * @return 修改后的提示开启 / 关闭状态
     */
    setOrToggleShowHint(hint?: string): boolean {
      // 反转提示
      if (!hint) {
        this.showHint = !this.showHint
        return this.showHint
      }
      // 设置提示
      if (hint === 'on') {
        this.showHint = true
      } else if (hint === 'off') {
        this.showHint = false
      }
      return this.showHint
    },
    /**
     * 修改终端提示语
     * @param welcomeTexts
     */
    setWelcomeTexts(welcomeTexts: string[]) {
      this.welcomeTexts = welcomeTexts
    },
    reset() {
      this.$reset()
    },
  },
})
