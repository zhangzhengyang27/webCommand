import { CommandType } from "../../command";
import myAxios from "../../../utils/myAxios";

/**
 * 解码 HTML 实体（wttr.in 文本中含 &#47; 等），避免被 smartText 二次转义后原样显示
 * @param text
 */
const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'");

/**
 * 天气查询命令
 * 基于 wttr.in 服务
 * @author m4tt72 (ported)
 */
const weatherCommand: CommandType = {
  func: "weather",
  name: "天气查询",
  alias: ["tianqi", "tq", "天气"],
  desc: "查询指定城市天气",
  params: [
    {
      key: "city",
      desc: "城市名",
      required: true,
    },
  ],
  options: [],
  async action(options, terminal) {
    const { _ } = options;
    const city = _.join(" ");
    if (!city) {
      terminal.writeTextResult("用法：weather <城市名>\n示例：weather 北京");
      return;
    }
    try {
      const json: any = await myAxios.get("/weather", { params: { city } });
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || "天气服务返回异常");
      }
      // 浏览器 User-Agent 下 wttr.in 会返回 HTML 页面，需从 term-container 中提取纯文本
      const text = json.data as string;
      const containerMatch = text.match(/<div class="term-container">([\s\S]*?)<\/div>/);
      const cleanText = containerMatch
        ? containerMatch[1].replace(/<[^>]+>/g, "").trim()
        : text.trim();
      terminal.writeTextResult(decodeHtmlEntities(cleanText) || "暂无天气数据");
    } catch (e) {
      terminal.writeTextErrorResult(
        `天气查询失败：${(e as Error).message}，请检查城市名或网络`,
      );
    }
  },
};

export default weatherCommand;
