import type { CommandType } from '../../command'
import myAxios from '../../../utils/myAxios'
import { errMsg } from '../../../utils/error'

/**
 * 二维码生成命令 (#27)
 */
const qrcodeCommand: CommandType = {
  func: 'qrcode',
  name: '二维码生成',
  alias: ['二维码'],
  desc: '生成内容对应的二维码图片地址',
  params: [
    {
      key: 'text',
      desc: '要生成二维码的内容',
      required: true,
    },
  ],
  options: [],
  async action(options, terminal) {
    const { _ } = options
    const text = _.join(' ')
    if (!text) {
      terminal.writeTextErrorResult('用法：qrcode <内容>')
      return
    }
    try {
      const res = await myAxios.get<string>(`/qrcode?text=${encodeURIComponent(text)}`)
      if (res?.code === 0 && res.data) {
        terminal.writeTextSuccessResult(`二维码地址：${res.data}`)
      } else {
        terminal.writeTextErrorResult(res?.message ?? '生成失败')
      }
    } catch (e) {
      terminal.writeTextErrorResult(errMsg(e))
    }
  },
}

export default qrcodeCommand
