// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier'

export default withNuxt(
  // 关闭与 Prettier 冲突的 ESLint 规则（代码格式由 Prettier 负责）
  prettier,
  {
    rules: {
      // 前后端 any 已全部收敛，恢复默认 error 防止回退。
      // 若后续新增代码确需处理动态第三方数据，请使用 unknown + 类型收窄。
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
