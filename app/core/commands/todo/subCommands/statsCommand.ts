import { CommandType } from "../../../command";
import { useTodoStore } from "../todoStore";

/**
 * 任务统计命令
 */
const statsCommand: CommandType = {
  func: "stats",
  name: "任务统计",
  alias: ["stat"],
  options: [],
  action(options, terminal): void {
    const store = useTodoStore();
    const { total, done, todo } = store.stats;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    terminal.writeTextResult(`任务统计：`);
    terminal.writeTextResult(`  总计：${total}`);
    terminal.writeTextResult(`  未完成：${todo}`);
    terminal.writeTextResult(`  已完成：${done}`);
    terminal.writeTextResult(`  完成率：${progress}%`);
  },
};

export default statsCommand;
