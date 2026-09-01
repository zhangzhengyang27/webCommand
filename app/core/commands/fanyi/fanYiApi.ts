import myAxios from "../../../utils/myAxios";

/**
 * 翻译文本（走后端 /api/translate 代理，避免 CORS 与失效问题）(#113)
 * @param keywords
 * @param config
 */
export const translate = async (
  keywords: string,
  config: Record<string, string>,
) => {
  if (!keywords) {
    return null;
  }
  return await myAxios.post("/translate", {
    text: keywords,
    from: config.from,
    to: config.to,
  });
};
