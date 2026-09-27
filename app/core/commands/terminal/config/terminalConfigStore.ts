import { defineStore } from 'pinia'
import { useCloudSync } from '../../../../composables/useCloudSync'
import { localIsFresher } from '../../../../composables/cloudMerge'

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
    /**
     * 本地最后修改时刻（毫秒）。配置类数据按「整包较新者胜出」合并，
     * 历史本地数据（无该字段）视为 0，即云端优先。
     */
    updatedAt: 0,
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
      this.updatedAt = Date.now()
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
        this.updatedAt = Date.now()
        return this.showHint
      }
      // 设置提示
      if (hint === 'on') {
        this.showHint = true
      } else if (hint === 'off') {
        this.showHint = false
      }
      this.updatedAt = Date.now()
      return this.showHint
    },
    /**
     * 修改终端提示语
     * @param welcomeTexts
     */
    setWelcomeTexts(welcomeTexts: string[]) {
      this.welcomeTexts = welcomeTexts
      this.updatedAt = Date.now()
    },
    reset() {
      this.$reset()
      this.updatedAt = Date.now()
    },
    /**
     * 同步到云端（登录后）
     */
    syncToCloud() {
      cloudSync.syncToCloud()
    },
    /**
     * 初始化云端同步：先拉取，再订阅后续变更（按用户幂等）
     */
    initCloudSync() {
      cloudSync.initCloudSync(() => this.$subscribe(() => this.syncToCloud()))
    },
    /**
     * 重置云同步：解除订阅并清除初始化标记（注销时调用）
     */
    resetCloudSync() {
      cloudSync.resetCloudSync()
    },
    /**
     * 从备份导入（覆盖当前数据）
     */
    importBackup(data: unknown) {
      if (!data || typeof data !== 'object') return
      const cfg = data as {
        background?: unknown
        showHint?: unknown
        welcomeTexts?: unknown
      }
      if (typeof cfg.background === 'string') this.background = cfg.background
      if (typeof cfg.showHint === 'boolean') this.showHint = cfg.showHint
      if (Array.isArray(cfg.welcomeTexts)) {
        this.welcomeTexts = cfg.welcomeTexts.filter((t): t is string => typeof t === 'string')
      }
      this.updatedAt = Date.now()
    },
  },
})

// 云同步实例（模块级单例；store 实例通过惰性调用获取，避免循环依赖）
const getStore = () => useTerminalConfigStore()

const cloudSync = useCloudSync('terminalConfig', {
  serialize: () => {
    const store = getStore()
    return {
      background: store.background,
      showHint: store.showHint,
      welcomeTexts: store.welcomeTexts,
      updatedAt: store.updatedAt,
    }
  },
  merge: (data) => {
    if (!data || typeof data !== 'object') return
    const cloud = data as {
      background?: unknown
      showHint?: unknown
      welcomeTexts?: unknown
      updatedAt?: unknown
    }
    const store = getStore()
    // 本地改动更新（或云端还是旧格式）时保持本地，等待上传覆盖云端
    if (localIsFresher({ updatedAt: Number(cloud.updatedAt) || 0 }, store.updatedAt)) return
    if (typeof cloud.background === 'string' && cloud.background) {
      store.background = cloud.background
    }
    if (typeof cloud.showHint === 'boolean') store.showHint = cloud.showHint
    if (Array.isArray(cloud.welcomeTexts)) {
      store.welcomeTexts = cloud.welcomeTexts.filter((t): t is string => typeof t === 'string')
    }
    store.updatedAt = Number(cloud.updatedAt) || 0
  },
})
