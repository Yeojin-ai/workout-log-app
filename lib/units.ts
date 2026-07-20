import { File, Paths } from 'expo-file-system';

// 무게 단위는 세트별로 기록된다(exercise_logs.unit). 저장값 weight_kg는 항상 kg이고,
// 표시·입력만 그 세트의 단위를 따른다. 볼륨 합산은 kg 기준(weight_kg)으로 계산한다.
export type Unit = 'kg' | 'lb';

const KG_PER_LB = 0.45359237;

// 입력 행 토글의 기본값 시드로 쓰는 "마지막으로 쓴 단위" (종목 이력이 없을 때의 폴백).
const UNIT_FILE = 'weight_unit';

export function getDefaultUnit(): Unit {
  try {
    const f = new File(Paths.document, UNIT_FILE);
    if (!f.exists) return 'kg';
    const v = f.textSync().trim();
    return v === 'kg' || v === 'lb' ? v : 'kg';
  } catch {
    return 'kg';
  }
}

export function setDefaultUnit(unit: Unit) {
  try {
    const f = new File(Paths.document, UNIT_FILE);
    if (!f.exists) f.create();
    f.write(unit);
  } catch {
    // 폴백 기본값 저장 실패는 무시 (다음 입력 기본값에만 영향).
  }
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// 저장된 kg 값을 주어진 단위의 숫자로 (표시·입력 프리필용). kg 2자리, lb 1자리 반올림.
export function fromKg(kg: number, unit: Unit): number {
  return unit === 'kg' ? round(kg, 2) : round(kg / KG_PER_LB, 1);
}

// 주어진 단위로 입력한 값을 저장용 kg으로.
export function toKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

// 저장된 kg 값을 그 세트 단위 문자열로 ("100lb" / "45.36kg").
export function formatWeight(kg: number, unit: Unit): string {
  return `${fromKg(kg, unit)}${unit}`;
}
