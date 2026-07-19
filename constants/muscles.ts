// 종목 이름 → 신체 부위 분류. 사용자가 직접 입력한 이름도 잡을 수 있게
// 키워드 포함 여부로 판단한다 (한국어/영어 모두).
export type MusclePart = 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'core';

// 신체 위 → 아래 순서 (졸라맨 옆 게이지 정렬에 쓰인다)
export const MUSCLE_PARTS: MusclePart[] = ['shoulders', 'chest', 'back', 'arms', 'core', 'legs'];

// 순서가 중요: 위에서부터 먼저 매칭된 부위로 분류된다.
const KEYWORDS: [MusclePart, string[]][] = [
  ['core', ['복근', '크런치', '플랭크', '싯업', '코어', 'crunch', 'plank', 'situp', 'sit-up', 'abdominal', 'abs', 'core']],
  ['shoulders', ['숄더', '어깨', '레터럴', '레이즈', '델트', '페이스풀', 'shoulder', 'lateral', 'raise', 'delt', 'face pull', 'rear', 'reverse pec']],
  ['arms', ['컬', '이두', '삼두', '바이셉', '트라이셉', '푸시다운', '아령', '팔', 'curl', 'bicep', 'tricep', 'pushdown', 'forearm', 'arm']],
  ['chest', ['벤치', '체스트', '가슴', '푸시업', '펙', '딥스', 'bench', 'chest', 'push-up', 'pushup', 'pec', 'fly', 'dip']],
  ['back', ['렛풀', '로우', '풀업', '턱걸이', '데드리프트', '등', 'lat', 'row', 'pull-up', 'pullup', 'pulldown', 'deadlift', 'back']],
  ['legs', ['스쿼트', '레그', '런지', '힙', '카프', '다리', '하체', '종아리', '엉덩이', 'squat', 'leg', 'lunge', 'hip', 'calf', 'abduction', 'adduction', 'hamstring', 'glute', 'thrust']],
];

export function classifyExercise(name: string): MusclePart | null {
  const lower = name.toLowerCase();
  for (const [part, words] of KEYWORDS) {
    if (words.some((word) => lower.includes(word))) return part;
  }
  return null;
}

// 최근 14일 세트 수 → 부위 레벨 (0~3). 졸라맨 팔다리 굵기에 쓰인다.
export function partLevel(sets: number): 0 | 1 | 2 | 3 {
  if (sets <= 0) return 0;
  if (sets <= 5) return 1;
  if (sets <= 14) return 2;
  return 3;
}
