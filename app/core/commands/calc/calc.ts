export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalcError";
  }
}

export function evaluate(expression: string): number {
  const parser = new Parser(expression);
  const result = parser.parseExpression();
  parser.expectEnd();
  return result;
}

class Parser {
  private input: string;
  private pos = 0;

  constructor(input: string) {
    this.input = input;
  }

  parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      this.skipWhitespace();
      if (this.startsWith("**") || this.peek() === "^") {
        this.throwUnknownOperator();
      }
      const op = this.peek();
      if (op === "+" || op === "-") {
        this.pos++;
        const right = this.parseTerm();
        value = op === "+" ? value + right : value - right;
      } else {
        break;
      }
    }
    return value;
  }

  parseTerm(): number {
    let value = this.parseFactor();
    while (true) {
      this.skipWhitespace();
      if (this.startsWith("**") || this.peek() === "^") {
        this.throwUnknownOperator();
      }
      const op = this.peek();
      if (op === "*" || op === "/" || op === "%") {
        this.pos++;
        const right = this.parseFactor();
        if ((op === "/" || op === "%") && right === 0) {
          throw new CalcError("错误：除数不能为零");
        }
        if (op === "*") {
          value = value * right;
        } else if (op === "/") {
          value = value / right;
        } else {
          value = value % right;
        }
      } else {
        break;
      }
    }
    return value;
  }

  parseFactor(): number {
    this.skipWhitespace();
    if (this.peek() === "-") {
      this.pos++;
      return -this.parseFactor();
    }
    if (this.peek() === "+") {
      this.pos++;
      return this.parseFactor();
    }
    return this.parsePrimary();
  }

  parsePrimary(): number {
    this.skipWhitespace();
    if (this.peek() === "(") {
      this.pos++;
      const value = this.parseExpression();
      this.skipWhitespace();
      if (this.peek() !== ")") {
        throw new CalcError("错误：缺少右括号 ')'");
      }
      this.pos++;
      return value;
    }
    return this.parseNumber();
  }

  parseNumber(): number {
    this.skipWhitespace();
    const start = this.pos;
    while (
      this.pos < this.input.length &&
      /[0-9.]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    if (start === this.pos) {
      const ch = this.peek();
      if (ch === "") {
        throw new CalcError("错误：表达式意外结束");
      }
      if (this.startsWith("**") || ch === "^") {
        this.throwUnknownOperator();
      }
      throw new CalcError(`错误：非法字符 '${ch}'`);
    }
    const text = this.input.substring(start, this.pos);
    if ((text.match(/\./g) || []).length > 1) {
      throw new CalcError(`错误：非法数字 '${text}'`);
    }
    if (text === ".") {
      throw new CalcError("错误：非法数字 '.'");
    }
    const num = Number(text);
    if (Number.isNaN(num)) {
      throw new CalcError(`错误：非法数字 '${text}'`);
    }
    return num;
  }

  expectEnd(): void {
    this.skipWhitespace();
    if (this.pos < this.input.length) {
      if (this.startsWith("**") || this.peek() === "^") {
        this.throwUnknownOperator();
      }
      throw new CalcError(`错误：非法字符 '${this.input[this.pos]}'`);
    }
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private peek(): string {
    return this.input[this.pos] ?? "";
  }

  private startsWith(s: string): boolean {
    return this.input.startsWith(s, this.pos);
  }

  private throwUnknownOperator(): never {
    const op = this.startsWith("**") ? "**" : "^";
    throw new CalcError(`错误：不支持运算符 '${op}'`);
  }
}
