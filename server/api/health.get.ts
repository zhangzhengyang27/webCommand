export default defineEventHandler(() => ({
  code: 0,
  data: {
    status: 'ok',
    service: 'webcommand-nuxt',
    time: new Date().toISOString(),
  },
}))
