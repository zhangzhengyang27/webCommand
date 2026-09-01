import { CommandType } from "../../../command";
import { useTodoStore } from "../todoStore";

/**
 * 完成任务命令
 */
const doneCommand: CommandType = {
  func: "done",
  name: "完成任务",
  alias: ["finish"],
  params: [
    {
      key: "identifier",
      desc: "任务序号或 ID",
      required: true,
    },
  ],
  options: [],
  action(options, terminal): void {
    const { _ } = options;
    const identifier = String(_[0] ?? "").trim();
    if (!identifier) {
      terminal.writeTextErrorResult("请输入任务序号或 ID");
      return;
    }
    const store = useTodoStore();
    let res: boolean;
    const index = Number(identifier);
    if (!isNaN(index) && index >= 1) {
      // 序号按当前列表（可能与全量不同）定位真实任务，再按 id 完成，避免过滤态下操作错任务
      const list = store.filteredTaskList(store.currentFilter);
      const target = list[index - 1];
      res = target ? store.finishTaskById(target.id) : false;
    } else {
      res = store.finishTaskById(identifier);
    }
    if (res) {
      terminal.writeTextSuccessResult("任务已完成");
    } else {
      terminal.writeTextErrorResult("操作失败，请检查任务序号或 ID");
    }
  },
};

export default doneCommand;
