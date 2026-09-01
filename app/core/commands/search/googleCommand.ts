import type { CommandType } from '../../command'

/**
 * Google 搜索命令
 * @author yupi
 */
const googleCommand: CommandType = {
  func: 'google',
  name: 'Google 搜索',
  alias: ['谷歌'],
  params: [
    {
      key: 'word',
      desc: '搜索内容',
      required: true,
    },
  ],
  options: [
    {
      key: 'self',
      desc: '是否当前页面打开',
      alias: ['c'],
      type: 'boolean',
      defaultValue: false,
    },
  ],
  action(options, _terminal) {
    const { _, self } = options
    const word = _.length > 0 ? _.join(' ') : ''
    const targetLink = `https://www.google.com/search?q=${encodeURIComponent(word)}`
    if (self) {
      window.location.href = targetLink
    } else {
      window.open(targetLink, '_blank', 'noopener,noreferrer')
    }
  },
}

export default googleCommand
