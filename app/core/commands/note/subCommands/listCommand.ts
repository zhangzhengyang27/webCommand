import { CommandType } from "../../../command";
import { useNoteStore } from "../noteStore";

/**
 * 列出速记
 */
const listCommand: CommandType = {
  func: "list",
  name: "查看速记",
  alias: ["ls"],
  options: [],
  action(options, terminal) {
    const { noteList } = useNoteStore();
    if (!noteList.length) {
      terminal.writeTextResult("暂无速记，使用 note add <内容> 添加");
      return;
    }
    const lines = noteList.map((n, i) => {
      const time = new Date(n.createTime).toLocaleString();
      return `${i + 1}. [${time}] ${n.text}`;
    });
    terminal.writeTextResult(
      lines.join("\n") + `\n共 ${noteList.length} 条（删除：note rm <序号>）`,
    );
  },
};

export default listCommand;
