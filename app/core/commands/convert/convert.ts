export type ConvertCategory = "length" | "mass" | "temperature" | "data";

interface LinearUnit {
  category: Exclude<ConvertCategory, "temperature">;
  factor: number;
  canonical: string;
}

interface TemperatureUnit {
  category: "temperature";
  canonical: "C" | "F" | "K";
}

type UnitMeta = LinearUnit | TemperatureUnit;

const LINEAR_UNITS: Record<string, LinearUnit> = {
  // length: base = meter
  m: { category: "length", factor: 1, canonical: "m" },
  km: { category: "length", factor: 1000, canonical: "km" },
  cm: { category: "length", factor: 0.01, canonical: "cm" },
  mm: { category: "length", factor: 0.001, canonical: "mm" },
  mi: { category: "length", factor: 1609.344, canonical: "mi" },
  ft: { category: "length", factor: 0.3048, canonical: "ft" },
  in: { category: "length", factor: 0.0254, canonical: "in" },
  yd: { category: "length", factor: 0.9144, canonical: "yd" },
  // mass: base = gram
  g: { category: "mass", factor: 1, canonical: "g" },
  kg: { category: "mass", factor: 1000, canonical: "kg" },
  mg: { category: "mass", factor: 0.001, canonical: "mg" },
  lb: { category: "mass", factor: 453.59237, canonical: "lb" },
  oz: { category: "mass", factor: 28.349523125, canonical: "oz" },
  t: { category: "mass", factor: 1_000_000, canonical: "t" },
  // data: byte (decimal SI prefixes)
  B: { category: "data", factor: 1, canonical: "B" },
  KB: { category: "data", factor: 1_000, canonical: "KB" },
  MB: { category: "data", factor: 1_000_000, canonical: "MB" },
  GB: { category: "data", factor: 1_000_000_000, canonical: "GB" },
  TB: { category: "data", factor: 1_000_000_000_000, canonical: "TB" },
  // data: binary IEC prefixes
  KiB: { category: "data", factor: 1024, canonical: "KiB" },
  MiB: { category: "data", factor: 1024 ** 2, canonical: "MiB" },
  GiB: { category: "data", factor: 1024 ** 3, canonical: "GiB" },
  TiB: { category: "data", factor: 1024 ** 4, canonical: "TiB" },
};

const TEMP_UNITS: Record<string, TemperatureUnit> = {
  C: { category: "temperature", canonical: "C" },
  F: { category: "temperature", canonical: "F" },
  K: { category: "temperature", canonical: "K" },
};

export interface ConvertOk {
  ok: true;
  value: number;
  fromUnit: string;
  toUnit: string;
}

export interface ConvertErr {
  ok: false;
  error: string;
}

export type ConvertResult = ConvertOk | ConvertErr;

export function convert(
  value: number,
  from: string,
  to: string,
): ConvertResult {
  const fromMeta = lookup(from);
  const toMeta = lookup(to);
  if (!fromMeta) {
    return { ok: false, error: `未知单位 '${from}'` };
  }
  if (!toMeta) {
    return { ok: false, error: `未知单位 '${to}'` };
  }
  if (fromMeta.category !== toMeta.category) {
    return {
      ok: false,
      error: `无法将 ${fromMeta.category} 转换为 ${toMeta.category}`,
    };
  }
  if (
    fromMeta.category === "temperature" &&
    toMeta.category === "temperature"
  ) {
    const k = toKelvin(value, fromMeta.canonical);
    const result = fromKelvin(k, toMeta.canonical);
    return {
      ok: true,
      value: result,
      fromUnit: fromMeta.canonical,
      toUnit: toMeta.canonical,
    };
  }
  const fromLin = fromMeta as LinearUnit;
  const toLin = toMeta as LinearUnit;
  return {
    ok: true,
    value: (value * fromLin.factor) / toLin.factor,
    fromUnit: fromLin.canonical,
    toUnit: toLin.canonical,
  };
}

function lookup(unit: string): UnitMeta | null {
  if (LINEAR_UNITS[unit]) {
    return LINEAR_UNITS[unit];
  }
  const upper = unit.toUpperCase();
  if (TEMP_UNITS[upper] && unit.length === 1) {
    return TEMP_UNITS[upper];
  }
  const lower = unit.toLowerCase();
  if (LINEAR_UNITS[lower]) {
    return LINEAR_UNITS[lower];
  }
  return null;
}

function toKelvin(value: number, unit: "C" | "F" | "K"): number {
  if (unit === "K") return value;
  if (unit === "C") return value + 273.15;
  return ((value - 32) * 5) / 9 + 273.15;
}

function fromKelvin(value: number, unit: "C" | "F" | "K"): number {
  if (unit === "K") return value;
  if (unit === "C") return value - 273.15;
  return ((value - 273.15) * 9) / 5 + 32;
}

export function listSupportedUnits(): string {
  return [
    "  长度: m, km, cm, mm, mi, ft, in, yd",
    "  质量: g, kg, mg, lb, oz, t",
    "  温度: C, F, K",
    "  数据: B, KB, MB, GB, TB, KiB, MiB, GiB, TiB",
  ].join("\n");
}
