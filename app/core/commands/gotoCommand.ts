import type { CommandType } from '../command'
import { useSpaceStore } from './space/spaceStore'

/**
 * 跳转命令
 * @author yupi
 */
export default {
  func: 'goto',
  name: '网页跳转',
  alias: ['to', 'open', 'visit', 'jump', '跳转'],
  params: [
    {
      key: 'link',
      desc: '目标链接',
      required: true,
    },
  ],
  options: [
    {
      key: 'self',
      desc: '是否当前页面打开',
      alias: ['s'],
      type: 'boolean',
      defaultValue: false,
    },
  ],
  action(options, terminal): void {
    const { _, self } = options
    if (_.length < 1) {
      terminal.writeTextErrorResult('参数不足')
      return
    }
    let link = _[0]
    // 优先找空间条目链接
    const { getItem } = useSpaceStore()
    const item = getItem(link)
    if (item?.link) {
      link = item?.link
    }
    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      link = 'http://' + link
    }
    // 利用 URL 构造函数规范化链接并自动编码特殊字符
    try {
      link = new URL(link).toString()
    } catch {
      terminal.writeTextErrorResult('链接格式错误')
      return
    }
    if (self) {
      window.location.href = link
    } else {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  },
} as CommandType
