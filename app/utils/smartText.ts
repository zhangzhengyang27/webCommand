/**
 * 匹配网址正则
 */
const URL_REG =
  /(((https?:\/\/)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(?::\d+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/\.\w-_]*)?\??(?:[-\+=&;%@\.\w_]*)#?(?:[\w]*))?)/;

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param text
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * 识别文本中的超链接
 * @param text
 */
const smartText = (text?: string) => {
  if (!text) {
    return text;
  }
  const reg = new RegExp(URL_REG, "gi");
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = reg.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const url = escapeHtml(match[0]);
    result += `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    lastIndex = reg.lastIndex;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
};

export default smartText;
