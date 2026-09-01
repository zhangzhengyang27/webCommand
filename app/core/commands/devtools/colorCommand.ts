import type { CommandType } from '../../command'
import { defineAsyncComponent } from 'vue'
import ComponentOutputType = Terminal.ComponentOutputType

/**
 * 颜色解析：支持 #rgb / #rgba / #rrggbb / #rrggbbaa / rgb(r,g,b) / r,g,b
 */
function parseColor(input: string): { r: number; g: number; b: number; a: number } | null {
  const text = input.trim().toLowerCase()
  let m = text.match(/^#?([0-9a-f]{3,4})$/)
  if (m) {
    const [r, g, b, a] = m[1].split('').map((c) => parseInt(c + c, 16))
    return { r, g, b, a: a === undefined ? 1 : a / 255 }
  }
  m = text.match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/)
  if (m) {
    return {
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16),
      a: m[2] ? parseInt(m[2], 16) / 255 : 1,
    }
  }
  m = text.match(
    /^(?:rgb(?:a)?\s*\()?\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})(?:\s*[,，]\s*(\d+(\.\d+)?))?\s*\)?$/,
  )
  if (m) {
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if ([r, g, b].some((v) => v > 255)) {
      return null
    }
    return { r, g, b, a: m[4] !== undefined ? Number(m[4]) : 1 }
  }
  return null
}

function toHex({ r, g, b, a }: { r: number; g: number; b: number; a: number }): string {
  const hex =
    '#' +
    [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('') +
    (a < 1
      ? Math.round(a * 255)
          .toString(16)
          .padStart(2, '0')
      : '')
  return hex
}

function toHsl({ r, g, b }: { r: number; g: number; b: number }): string {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return `${Math.round(h * 360)}°, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`
}

/**
 * 颜色查看命令：输出色块预览组件
 */
const colorCommand: CommandType = {
  func: 'color',
  name: '颜色查看',
  alias: ['颜色'],
  desc: '查看颜色值并预览色块',
  params: [
    {
      key: 'color',
      desc: '颜色值，如 #1e90ff 或 30,144,255',
      required: true,
    },
  ],
  options: [],
  action(options, terminal) {
    const { _ } = options
    const input = _.join(' ').trim()
    if (!input) {
      terminal.writeTextErrorResult('用法：color <#hex | rgb(r,g,b) | r,g,b>')
      return
    }
    const parsed = parseColor(input)
    if (!parsed) {
      terminal.writeTextErrorResult('无法识别颜色，支持 #hex、rgb(r,g,b)、r,g,b')
      return
    }
    const output: ComponentOutputType = {
      type: 'component',
      component: defineAsyncComponent(() => import('./ColorBox.vue')),
      props: {
        hex: toHex(parsed),
        rgb: `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`,
        alpha: parsed.a,
        hsl: toHsl(parsed),
      },
    }
    terminal.writeResult(output)
  },
}

export default colorCommand
