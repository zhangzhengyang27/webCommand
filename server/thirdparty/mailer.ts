import nodemailer, { type Transporter } from 'nodemailer'
import { setting } from '../utils/appConfig'

/**
 * SMTP 邮件发送（对齐原 thirdpart/mailer.js）。
 * 取值走 setting()：运行期环境变量优先（NUXT_SMTP_* 或裸名 SMTP_*），构建期默认值仅作兜底。
 */
let cached: Transporter | null = null

function smtpConfig() {
  const c = useRuntimeConfig()
  return {
    host: setting(c.smtpHost, 'NUXT_SMTP_HOST', 'SMTP_HOST'),
    user: setting(c.smtpUser, 'NUXT_SMTP_USER', 'SMTP_USER'),
    pass: setting(c.smtpPass, 'NUXT_SMTP_PASS', 'SMTP_PASS'),
    from: setting(c.smtpFrom, 'NUXT_SMTP_FROM', 'SMTP_FROM'),
    port: Number(setting(c.smtpPort, 'NUXT_SMTP_PORT', 'SMTP_PORT')) || 465,
  }
}

function getTransporter(): Transporter | null {
  if (cached) return cached
  const smtp = smtpConfig()
  if (!smtp.host || !smtp.user || !smtp.pass) return null
  cached = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  })
  return cached
}

export function isMailConfigured(): boolean {
  return !!getTransporter()
}

export async function sendMail(opts: { to: string; subject: string; text: string }) {
  const transporter = getTransporter()
  if (!transporter) throw new Error('邮件服务未配置（需要 SMTP_HOST/SMTP_USER/SMTP_PASS）')
  const smtp = smtpConfig()
  await transporter.sendMail({ from: smtp.from || smtp.user, ...opts })
}
