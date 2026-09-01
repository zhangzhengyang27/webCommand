import nodemailer, { type Transporter } from 'nodemailer'

/**
 * SMTP 邮件发送（对齐原 thirdpart/mailer.js）。
 * 环境变量经 runtimeConfig 注入：smtpHost/smtpPort/smtpUser/smtpPass/smtpFrom。
 */
let cached: Transporter | null = null

function getTransporter(): Transporter | null {
  if (cached) return cached
  const c = useRuntimeConfig()
  if (!c.smtpHost || !c.smtpUser || !c.smtpPass) return null
  const port = Number(c.smtpPort) || 465
  cached = nodemailer.createTransport({
    host: c.smtpHost,
    port,
    secure: port === 465,
    auth: { user: c.smtpUser, pass: c.smtpPass },
  })
  return cached
}

export function isMailConfigured(): boolean {
  return !!getTransporter()
}

export async function sendMail(opts: {
  to: string
  subject: string
  text: string
}) {
  const transporter = getTransporter()
  if (!transporter)
    throw new Error('邮件服务未配置（需要 SMTP_HOST/SMTP_USER/SMTP_PASS）')
  const c = useRuntimeConfig()
  const from = c.smtpFrom || c.smtpUser
  await transporter.sendMail({ from, ...opts })
}
