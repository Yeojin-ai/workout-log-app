import { File, Paths } from 'expo-file-system';

// 무게 표시/입력 단위. 저장은 항상 kg으로 하고(DB의 weight_kg), 표시·입력만 이 단위를 따른다.
// 볼륨 합산은 kg 기준으로 계산한다 (사용자 요청).
export type Unit = 'kg' | 'lb';

const UNIT_FILE = 'weight_unit';
const KG_PER_LB = 0.45359237;

function readStoredUnit(): Unit | null {
  try {
    const f = new File(Paths.document, UNIT_FILE);
    if (!f.exists) return null;
    const v = f.textSync().trim();
    return v === 'kg' || v === 'lb' ? v : null;
  } catch {
    return null;
  }
}

function writeStoredUnit(unit: Unit) {
  try {
    const f = new File(Paths.document, UNIT_FILE);
    if (!f.exists) f.create();
    f.write(unit);
  } catch {
    // 저장 실패해도 현재 세션 단위는 바뀐다.
  }
}

let currentUnit: Unit = readStoredUnit() ?? 'kg';

export function getUnit(): Unit {
  return currentUnit;
}

export function setUnit(unit: Unit) {
  currentUnit = unit;
  writeStoredUnit(unit);
}

export function unitLabel(): Unit {
  return currentUnit;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// 저장된 kg 값을 현재 단위의 숫자로 (표시·입력 프리필용).
// lb 입력을 kg으로 저장하면 소수점이 길어지므로 표시할 땐 반올림한다 (kg 2자리, lb 1자리).
export function fromKg(kg: number): number {
  return currentUnit === 'kg' ? round(kg, 2) : round(kg / KG_PER_LB, 1);
}

// 현재 단위로 입력한 값을 저장용 kg으로. kg일 땐 그대로.
export function toKg(value: number): number {
  if (currentUnit === 'kg') return value;
  return value * KG_PER_LB;
}

// 저장된 kg 값을 "30kg" / "66.1lb" 형태 문자열로.
export function formatWeight(kg: number): string {
  return `${fromKg(kg)}${currentUnit}`;
}
