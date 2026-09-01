// 纯 tsc 无法解析 .vue 模块（Nuxt 4 依赖 Volar），此处提供通用模块声明
// 以消除 TS2307；IDE 中 Volar 仍使用精确的组件类型推断。
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}
