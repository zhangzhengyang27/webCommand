import { defineConfig } from 'vitest/config'

/**
 * vitest 只负责「起 handler 打请求」这一层：路由模块依赖 Nitro 注入的全局函数
 * （defineEventHandler / readBody / getQuery / getUserSession），node --test 跑不了。
 *
 * include 刻意只收 *.test.ts（路由层 + 前端纯函数），否则 vitest 会去抢 test/*.spec.ts
 * ——那些用的是 node:test 的 test()，被 vitest 收集会出现「收集到 0 条却全绿」的假通过。
 */
export default defineConfig({
  test: {
    include: ['test/routes/**/*.test.ts', 'test/unit/**/*.test.ts'],
    environment: 'node',
    // Nitro 全局替身，纯函数用例不读这些全局，装了也无副作用
    setupFiles: ['test/routes/nitroGlobals.ts'],
  },
})
