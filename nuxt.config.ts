import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import type { SessionConfig } from 'h3'

// 生产环境 DB_PASSWORD 校验见 server/plugins/check-env.ts（构建期 NODE_ENV=production，
// 此处校验会阻断 nuxt prepare/build，故放到 Nitro 运行时启动时校验）

// 站点绝对地址（SEO：canonical / og:url / og:image 需要绝对 URL）
// 部署时通过环境变量 NUXT_PUBLIC_SITE_URL 提供，未配置时回退为空（使用相对路径）
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // 本项目为终端型个人应用：数据来自 localStorage / 登录态，无公开内容可收录，
  // 采用 SPA 渲染（ssr:false）规避 localStorage / antd css-in-js 的水合成本；
  // 注意：SPA 模式下 Nitro 后端（server/api）依然完整可用。
  ssr: false,
  compatibilityDate: '2026-09-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', 'nuxt-auth-utils', '@nuxt/eslint'],

  // ESLint：仅负责代码质量检查，关闭 stylistic 格式规则，
  // 代码格式统一交由 Prettier 处理，避免两套格式规则冲突。
  eslint: {
    config: {
      stylistic: false,
    },
  },

  // ant-design-vue 4 reset.css（css-in-js 模式下需手动引入基础重置）
  css: ['ant-design-vue/dist/reset.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'webCommand - 极客范儿的浏览器主页',
      link: [
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', href: '/favicon.png', sizes: '512x512' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
        { rel: 'manifest', href: '/site.webmanifest' },
        // canonical（SEO：指定权威页面，防止重复收录）
        ...(siteUrl
          ? [{ rel: 'canonical' as const, href: `${siteUrl}/` }]
          : []),
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
        // SEO
        {
          name: 'description',
          content: 'webCommand - 极客范儿的浏览器主页，集成终端、搜索、翻译、计算、IP 查询等一站式工具。',
        },
        { name: 'theme-color', content: '#101422' },
        // Open Graph（社交分享：Twitter / Facebook / Telegram 等）
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'webCommand - 极客范儿的浏览器主页' },
        {
          property: 'og:description',
          content: '集成终端、搜索、翻译、计算、IP 查询等一站式工具的浏览器主页',
        },
        // og:image / og:url 使用绝对 URL（社交平台抓取器不支持相对路径）
        { property: 'og:image', content: siteUrl ? `${siteUrl}/og-image.png` : '/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'webCommand 终端风格浏览器主页' },
        ...(siteUrl ? [{ property: 'og:url', content: `${siteUrl}/` }] : []),
        { property: 'og:site_name', content: 'webCommand' },
        { property: 'og:locale', content: 'zh_CN' },
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'webCommand - 极客范儿的浏览器主页' },
        {
          name: 'twitter:description',
          content: '集成终端、搜索、翻译、计算、IP 查询等一站式工具的浏览器主页',
        },
        { name: 'twitter:image', content: siteUrl ? `${siteUrl}/og-image.png` : '/og-image.png' },
      ],
      // 百度统计（对齐原 index.html）
      script: [
        {
          innerHTML: `var _hmt = _hmt || [];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?f3cd8238138d11b92f82f00e78961aa9";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);})();`,
          type: 'text/javascript',
        },
        // JSON-LD 结构化数据（SEO / GEO：WebSite + SoftwareApplication + FAQ）
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'webCommand',
            alternateName: 'webCommand 极客范儿的浏览器主页',
            url: siteUrl ? `${siteUrl}/` : 'https://command.zhangzhengyang.com/',
            description:
              'webCommand - 极客范儿的浏览器主页，集成终端、搜索、翻译、计算、IP 查询等一站式工具。',
            inLanguage: 'zh-CN',
          }),
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'webCommand',
            operatingSystem: 'Web',
            applicationCategory: 'UtilitiesApplication',
            description: '集成终端、搜索、翻译、计算、IP 查询等一站式工具的极客浏览器主页',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
            inLanguage: 'zh-CN',
          }),
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'webCommand 是什么？',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'webCommand 是一个极客风格的浏览器主页，通过终端命令交互，集成了搜索、翻译、计算、IP 查询、天气、新闻、股票、待办事项、笔记等一站式工具，支持登录后云同步数据。',
                },
              },
              {
                '@type': 'Question',
                name: 'webCommand 如何使用？',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '打开首页后在终端输入框中输入 help 命令，即可查看所有可用命令的列表和使用说明。',
                },
              },
              {
                '@type': 'Question',
                name: 'webCommand 需要注册登录吗？',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '大多数工具（搜索、翻译、计算、IP 查询等）无需登录即可使用；注册登录后可获得待办、笔记、空间等数据的云端同步能力。',
                },
              },
            ],
          }),
        },
      ],
    },
  },

  vite: {
    plugins: [
      // ant-design-vue 按需加载（css-in-js 模式）
      Components({
        resolvers: [
          AntDesignVueResolver({
            importStyle: 'css-in-js',
          }),
        ],
      }),
    ],
  },

  // 会话有效期 30 天（对齐原 express-session 的 cookie maxAge）
  // password 由环境变量 NUXT_SESSION_PASSWORD 提供，此处仅覆盖 maxAge
  runtimeConfig: {
    session: {
      maxAge: 60 * 60 * 24 * 30,
    } as SessionConfig,
    // MySQL（dbPassword 默认值仅用于本地开发，生产环境已在上方强制校验）
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: Number(process.env.DB_PORT) || 3306,
    dbName: process.env.DB_NAME || 'yuindex',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || 'root1234',
    // 百度翻译
    baiduAppid: process.env.BAIDU_FANYI_APPID || '',
    baiduKey: process.env.BAIDU_FANYI_KEY || '',
    // SMTP（找回密码）
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT) || 465,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || '',
    // 是否信任反向代理的 x-forwarded-for（限流取真实 IP）
    trustProxy: process.env.TRUST_PROXY === 'true',
    public: {
      // 前端 API 基地址（对齐原 VITE_API_BASE_URL，默认同源 /api）
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
      // 站点绝对地址（SEO canonical / og 标签），如 https://example.com
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || '',
    },
  },

  typescript: {
    strict: true,
    // 项目使用全局 namespace + import alias（如 `import X = Terminal.X`）定义终端类型，
    // 该写法与 Nuxt 4 默认开启的 verbatimModuleSyntax 不兼容，覆盖为 false 以消除 TS1288。
    tsConfig: {
      compilerOptions: {
        verbatimModuleSyntax: false,
      },
    },
  },
})
