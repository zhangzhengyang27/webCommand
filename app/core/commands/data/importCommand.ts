import type { CommandType } from '../../command'
import { defineAsyncComponent } from 'vue'
import ComponentOutputType = YuTerminal.ComponentOutputType

/**
 * 数据导入命令：展示导入组件，粘贴备份 JSON 恢复
 */
const importCommand: CommandType = {
  func: 'import',
  name: '数据导入',
  alias: ['restore'],
  desc: '从 export 导出的 JSON 备份恢复数据',
  options: [],
  action(options, terminal) {
    const output: ComponentOutputType = {
      type: 'component',
      component: defineAsyncComponent(() => import('./ImportBox.vue')),
    }
    terminal.writeResult(output)
  },
}

export default importCommand
