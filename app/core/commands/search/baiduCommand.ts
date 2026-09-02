import type { CommandType } from '../../command'

/**
 * 百度搜索命令
 * @author yupi
 */
const baiduCommand: CommandType = {
  func: 'baidu',
  name: '百度搜索',
  alias: ['百度'],
  params: [
    {
      key: 'word',
      desc: '搜索内容',
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
    {
      key: 'picture',
      desc: '是否搜索图片',
      alias: ['p'],
      type: 'boolean',
      defaultValue: false,
    },
  ],
  action(options, _terminal) {
    const { _, self, picture } = options
    const word = _.length > 0 ? _.join(' ') : ''
    const encodedWord = encodeURIComponent(word)
    let targetLink = `https://www.baidu.com/s?wd=${encodedWord}`
    // 搜索图片
    if (picture) {
      targetLink = `https://image.baidu.com/search/index?tn=baiduimage&word=${encodedWord}`
    }
    if (self) {
      window.location.href = targetLink
    } else {
      window.open(targetLink, '_blank', 'noopener,noreferrer')
    }
  },
}

export default baiduCommand
