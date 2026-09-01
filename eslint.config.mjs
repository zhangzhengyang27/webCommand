// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier'

export default withNuxt(
  // 关闭与 Prettier 冲突的 ESLint 规则（代码格式由 Prettier 负责）
  prettier,
  {
    rules: {
      // 存量代码中存在大量处理第三方 API 响应 / 数据库返回的 any，
      // 暂降级为 warning（提示但不阻断），后续逐步收敛为 error。
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
