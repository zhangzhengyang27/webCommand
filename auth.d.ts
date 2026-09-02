// nuxt-auth-utils 用户会话类型扩展
// session.user 保存的是脱敏后的 SafeUser（id/username/email 等），
// 扩展空接口 User 以在服务端代码中获得类型提示（替代既有的 `as any`）。
declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    email?: string
  }
}

export {}
