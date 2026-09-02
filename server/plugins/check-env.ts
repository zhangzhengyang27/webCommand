// 生产环境启动校验：数据库密码必须显式配置，禁止弱默认值 'root1234' 上线
// （该默认值仅用于本地开发体验；构建期不校验，避免阻断 nuxt prepare/build）
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
    throw new Error('[webcommand] 生产环境必须通过环境变量 DB_PASSWORD 提供数据库密码')
  }
})
