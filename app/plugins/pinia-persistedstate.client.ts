import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

// 注册 pinia-plugin-persistedstate（localStorage 持久化）
// 对齐原 main.ts 中的 pinia.use(piniaPluginPersistedstate)
export default defineNuxtPlugin((nuxtApp) => {
  const pinia = nuxtApp.$pinia
  if (pinia && !pinia._p?.some((p: any) => p?._isPersistedstate)) {
    // 标记避免重复注册
    const plugin = piniaPluginPersistedstate as any
    plugin._isPersistedstate = true
    pinia.use(plugin)
  }
})
