import axios from 'axios'

// 自定义 axios 实例
// 后端地址：默认同源 "/api"（Nuxt 单体部署时 Nitro 直接处理 /api）；
// 后端单独部署时，构建/运行前设置 NUXT_PUBLIC_API_BASE_URL（如 https://api.example.com/api）
// 注：Nuxt 会在构建时将 process.env.NUXT_PUBLIC_* 内联到客户端包中
const myAxios = axios.create({
  baseURL: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
})

myAxios.defaults.withCredentials = true

// 添加请求拦截器
myAxios.interceptors.request.use(
  function (config) {
    return config
  },
  function (error) {
    return Promise.reject(error)
  },
)

// 添加响应拦截器
myAxios.interceptors.response.use(
  function (response) {
    return response.data
  },
  function (error) {
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

export default myAxios
