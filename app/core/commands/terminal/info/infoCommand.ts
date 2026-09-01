import type { CommandType } from '../../../command'
import { defineAsyncComponent } from 'vue'
import ComponentOutputType = Terminal.ComponentOutputType

/**
 * 查看网站本身信息命令
 * @author yupi
 */
const infoCommand: CommandType = {
  func: 'info',
  name: '查看本站信息',
  alias: ['author', 'about', '关于', '作者'],
  options: [],
  action(options, terminal): void {
    const output: ComponentOutputType = {
      type: 'component',
      component: defineAsyncComponent(() => import('./InfoBox.vue')),
    }
    terminal.writeResult(output)
  },
}

export default infoCommand
