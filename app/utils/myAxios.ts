import axios, { type AxiosRequestConfig } from 'axios'

/** 后端统一响应结构（对齐 server/utils/response.ts 的 ok/fail） */
export interface ApiResult<T = unknown> {
  code: number
  message?: string
  data?: T
}

// 自定义 axios 实例
// 后端地址：默认同源 "/api"（Nuxt 单体部署时 Nitro 直接处理 /api）；
// 后端单独部署时，构建/运行前设置 NUXT_PUBLIC_API_BASE_URL（如 https://api.example.com/api）
// 注：Nuxt 会在构建时将 process.env.NUXT_PUBLIC_* 内联到客户端包中
const http = axios.create({
  baseURL: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
})

http.defaults.withCredentials = true

// 响应拦截器：直接返回 response.data（对齐原 request.js）
http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 统一处理网络错误
    if (error.response) {
      const { status, data } = error.response
      if (status === 401) {
        return Promise.reject({ code: 40100, message: '未登录' })
      }
      return Promise.reject(data ?? { code: status, message: '请求失败' })
    }
    return Promise.reject({
      code: 50000,
      message: error.message || '网络异常',
    })
  },
)

// 拦截器实际返回的是 response.data，因此这里将方法返回类型收窄为 Promise<ApiResult<T>>，
// 使调用方无需 `as any` 即可访问 code/data/message
const myAxios = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return http.get(url, config) as Promise<ApiResult<T>>
  },
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResult<T>> {
    return http.post(url, data, config) as Promise<ApiResult<T>>
  },
}

export default myAxios
