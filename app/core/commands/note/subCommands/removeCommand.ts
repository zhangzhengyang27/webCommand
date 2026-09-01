import { CommandType } from "../../../command";
import { useNoteStore } from "../noteStore";

/**
 * 删除速记（按序号或 id）
 */
const removeCommand: CommandType = {
  func: "rm",
  name: "删除速记",
  alias: ["delete", "remove"],
  params: [
    {
      key: "identifier",
      desc: "序号或 id",
      required: true,
    },
  ],
  options: [],
  action(options, terminal) {
    const { _ } = options;
    const identifier = String(_[0] ?? "").trim();
    if (!identifier) {
      terminal.writeTextErrorResult("请输入要删除的速记序号");
      return;
    }
    const store = useNoteStore();
    let res: boolean;
    const index = Number(identifier);
    if (!isNaN(index) && index >= 1) {
      // 按 list 展示的序号定位
      const target = store.noteList[index - 1];
      res = target ? store.removeNote(target.id) : false;
    } else {
      res = store.removeNote(identifier);
    }
    if (res) {
      terminal.writeTextSuccessResult("删除成功");
    } else {
      terminal.writeTextErrorResult("删除失败，请检查序号");
    }
  },
};

export default removeCommand;
