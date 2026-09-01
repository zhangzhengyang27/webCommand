import type { CommandType } from '../../../command'
import { useTerminalConfigStore } from './terminalConfigStore'
import myAxios from '../../../../utils/myAxios'

/**
 * 切换终端背景
 * @author zhangzhengyang
 */
const backgroundCommand: CommandType = {
  func: 'background',
  name: '切换终端背景',
  alias: ['bg', '背景'],
  desc: '切换终端背景，支持自定义 URL 或随机壁纸（动漫/风景/美女/随机）',
  params: [
    {
      key: 'url',
      desc: '图片地址（不填则随机）',
      required: false,
    },
  ],
  options: [
    {
      key: 'type',
      desc: '随机壁纸分类：dongman（动漫）、fengjing（风景）、meizi（美女）、suiji（随机）',
      alias: ['t'],
      type: 'string',
      defaultValue: 'dongman',
    },
  ],
  async action(options, terminal) {
    const { _, type = 'dongman' } = options
    const url = _[0]
    const { setBackground } = useTerminalConfigStore()
    if (!url) {
      // 随机获取壁纸
      const res: any = await myAxios.post('/background/get/random', { type })
      if (res?.code === 0 && res.data) {
        setBackground(res.data)
        terminal.writeTextSuccessResult('背景设置成功')
      } else {
        terminal.writeTextErrorResult(res?.message ?? '获取随机壁纸失败')
      }
      return
    }
    setBackground(url)
    terminal.writeTextSuccessResult('背景设置成功')
  },
}

export default backgroundCommand
