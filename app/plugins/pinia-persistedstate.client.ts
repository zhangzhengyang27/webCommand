import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

// 注册 pinia-plugin-persistedstate（localStorage 持久化）
// 对齐原 main.ts 中的 pinia.use(piniaPluginPersistedstate)
export default defineNuxtPlugin((nuxtApp) => {
  const pinia = nuxtApp.$pinia
  // _p 为 Pinia 内部已安装插件数组，类型未公开，此处显式断言访问
  const installed = (pinia as unknown as { _p?: Array<{ _isPersistedstate?: boolean }> })._p
  if (pinia && !installed?.some((p) => p?._isPersistedstate)) {
    // 标记避免重复注册
    const plugin = piniaPluginPersistedstate as any
    plugin._isPersistedstate = true
    pinia.use(plugin)
  }
})
