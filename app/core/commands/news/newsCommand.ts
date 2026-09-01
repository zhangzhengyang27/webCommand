import { CommandType } from "../../command";
import myAxios from "../../../utils/myAxios";

/**
 * 新闻热搜命令 (#27)
 */
const newsCommand: CommandType = {
  func: "news",
  name: "新闻热搜",
  alias: ["热搜", "新闻"],
  desc: "查看实时热搜榜（微博/知乎/抖音等）",
  params: [
    {
      key: "type",
      desc: "榜单类型：weibo(默认)/zhihu/douyin/bili/baidu",
      required: false,
    },
  ],
  options: [],
  async action(options, terminal) {
    const type = (options?._?.[0] || "weibo").toString();
    try {
      const res: any = await myAxios.get("/news", { params: { type } });
      if (res?.code === 0 && Array.isArray(res.data)) {
        if (res.data.length === 0) {
          terminal.writeTextResult("暂无热搜数据");
          return;
        }
        terminal.writeTextResult(`—— ${type} 热搜榜 ——`);
        res.data.forEach((it: any) => {
          terminal.writeTextResult(`${it.rank}. ${it.title}  🔥${it.hot || ""}`);
        });
      } else {
        terminal.writeTextErrorResult(res?.message ?? "获取失败");
      }
    } catch (e: any) {
      terminal.writeTextErrorResult(e?.message ?? "获取失败");
    }
  },
};

export default newsCommand;
