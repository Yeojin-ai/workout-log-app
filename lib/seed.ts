import type { SQLiteDatabase } from 'expo-sqlite';

// 앱 사용 전 수기 메모(2026.05.24 ~ 2026.07.19)를 한 번만 DB로 옮긴다.
// 운동명은 사용자와 확인을 거쳐 정리했다:
//  - Pectoral Fly(7/19) → Reverse Pec Deck (어깨 뒤 운동이었음)
//  - 레그 익스프레스 → Leg Extension (30lb ≈ 13.6kg으로 환산)
//  - 풀 레버리지/레버리지 풀 다운 → "레버리지 풀다운" 통일
//  - Inner Thigh(abduction) → "Hip Adduction (Inner Thigh)"
//  - 몬스터 글루트는 안쪽/바깥쪽 두 종목으로 분리
//  - "지칠 때까지" 세트와 유산소는 날짜 메모/유산소 필드에 기록

type LegacyExercise = { name: string; weightKg: number; reps: number[] };
type LegacyDay = {
  date: string;
  exercises?: LegacyExercise[];
  note?: string;
  cardio?: string;
};

const rep = (count: number, times: number) => Array(times).fill(count) as number[];

// 한국어로 기록된 운동명 → 영어 표준 명칭. seed 데이터와 기존 DB 행 모두에 적용된다.
const KOREAN_TO_ENGLISH: [string, string][] = [
  ['덤벨 레이즈', 'Dumbbell Lateral Raise'],
  ['레버리지 풀다운', 'Leverage Lat Pulldown'],
  ['머신 로우', 'Machine Row'],
  ['몬스터 글루트(안쪽)', 'Monster Glute (Inner)'],
  ['몬스터 글루트(바깥쪽)', 'Monster Glute (Outer)'],
  ['핵스쿼트', 'Hack Squat'],
  ['런지', 'Lunge'],
  ['스윙', 'Kettlebell Swing'],
  ['복근 운동', 'Ab Crunch'],
  ['팔 운동', 'Arm Workout'],
  ['스쿼트', 'Squat'],
];

const LEGACY_DATA: LegacyDay[] = [
  {
    date: '2026-07-19',
    exercises: [
      { name: 'Leg Press', weightKg: 30, reps: [15] },
      { name: 'Leg Press', weightKg: 50, reps: [15] },
      { name: 'Leg Press', weightKg: 70, reps: rep(15, 3) },
      { name: 'Monster Glute (Inner)', weightKg: 10, reps: rep(20, 3) },
      { name: 'Monster Glute (Outer)', weightKg: 10, reps: rep(20, 3) },
      { name: 'Dumbbell Lateral Raise', weightKg: 2, reps: rep(20, 4) },
      { name: 'Reverse Pec Deck', weightKg: 30, reps: rep(15, 6) },
    ],
    cardio: '러닝 (9km/h) 4km',
  },
  {
    date: '2026-07-09',
    exercises: [
      { name: 'Monster Glute (Inner)', weightKg: 10, reps: rep(20, 3) },
      { name: 'Monster Glute (Outer)', weightKg: 10, reps: rep(20, 3) },
      { name: 'Hack Squat', weightKg: 0, reps: rep(10, 6) },
    ],
    note: '매일 실시',
  },
  {
    date: '2026-07-08',
    exercises: [
      { name: 'Machine Row', weightKg: 19, reps: [10, 15, 10, 15, 15] },
      { name: 'Face Pull', weightKg: 5, reps: rep(15, 6) },
      { name: 'Dumbbell Lateral Raise', weightKg: 2, reps: rep(20, 2) },
      { name: 'Hip Abduction', weightKg: 23, reps: rep(20, 6) },
    ],
  },
  {
    date: '2026-07-03',
    note: 'PT · 맨몸 등운동 100회 연습',
  },
  {
    date: '2026-06-29',
    exercises: [
      { name: 'Hip Abduction', weightKg: 0, reps: rep(20, 6) },
      { name: 'Leverage Lat Pulldown', weightKg: 0, reps: [20] },
      { name: 'Dumbbell Lateral Raise', weightKg: 2, reps: rep(20, 4) },
    ],
  },
  {
    date: '2026-06-18',
    exercises: [{ name: 'Dumbbell Lateral Raise', weightKg: 2, reps: rep(20, 4) }],
    note: 'PT · 매일 실시',
  },
  {
    date: '2026-06-17',
    note: 'PT · 목 뒤 조이기 (로봇 팔 끼듯이)',
  },
  {
    date: '2026-06-10',
    exercises: [
      { name: 'Leg Extension', weightKg: 13.6, reps: [20] }, // 30lb
      { name: 'Hip Adduction (Inner Thigh)', weightKg: 23, reps: [25] },
    ],
    note: 'PT · 스쿼트 기본 무게 5~6세트',
  },
  {
    date: '2026-06-09',
    exercises: [
      { name: 'Hip Abduction', weightKg: 0, reps: [25, 20, 20, 20, 20, 20, 20] },
      { name: 'Leverage Lat Pulldown', weightKg: 0, reps: rep(10, 5) },
      { name: 'Face Pull', weightKg: 0, reps: rep(15, 6) },
    ],
    cardio: '러닝 2km',
  },
  {
    date: '2026-06-08',
    exercises: [{ name: 'Standing Plate Front Raise', weightKg: 0, reps: [20] }],
    note: 'PT · 숄더 프레스 2kg / 레터럴 레이즈 1kg 지칠 때까지 · 프론트 레이즈는 승모근 당겨지면 종료',
  },
  {
    date: '2026-06-04',
    exercises: [
      { name: 'Lunge', weightKg: 0, reps: [20] },
      { name: 'Kettlebell Swing', weightKg: 0, reps: [20] },
      { name: 'Ab Crunch', weightKg: 0, reps: [20] },
    ],
    note: 'PT · 월요일 가능 여부 일요일에 전달',
    cardio: '러닝 30~40분 (빠른 속도)',
  },
  {
    date: '2026-05-30',
    exercises: [
      { name: 'Face Pull', weightKg: 0, reps: rep(15, 6) },
      { name: 'Rear Deltoid', weightKg: 0, reps: [20, 20, 20, 20, 20, 15] },
      { name: 'Hip Abduction', weightKg: 0, reps: rep(20, 6) },
      { name: 'Leverage Lat Pulldown', weightKg: 0, reps: rep(10, 5) },
    ],
  },
  {
    date: '2026-05-29',
    exercises: [
      { name: 'Hip Abduction', weightKg: 0, reps: rep(20, 6) },
      { name: 'Leverage Lat Pulldown', weightKg: 0, reps: rep(10, 5) },
      { name: 'Arm Workout', weightKg: 0, reps: rep(20, 6) },
    ],
    cardio: '천국의 계단 Level 5 · 30분',
  },
  {
    date: '2026-05-27',
    note: 'PT · 랫풀다운/레버리지 풀다운, Rear Deltoid (기록 없음)',
  },
  {
    date: '2026-05-24',
    exercises: [
      { name: 'Face Pull', weightKg: 5, reps: rep(15, 6) },
      { name: 'Squat', weightKg: 0, reps: rep(5, 15) },
      { name: 'Hip Abduction', weightKg: 27, reps: rep(20, 6) },
    ],
    cardio: '천국의 계단 Level 5 · 40분',
  },
];

const IMPORT_FLAG = 'legacy_import_v1';

export async function importLegacyData(db: SQLiteDatabase) {
  const done = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    IMPORT_FLAG
  );
  if (done) return;

  await db.withTransactionAsync(async () => {
    // 앱에서 이미 쓰던 "Hip adduction" 표기를 정리된 이름으로 통일
    await db.runAsync(
      "UPDATE exercise_logs SET exercise_name = 'Hip Abduction' WHERE exercise_name = 'Hip adduction'"
    );

    for (const day of LEGACY_DATA) {
      for (const exercise of day.exercises ?? []) {
        for (const reps of exercise.reps) {
          await db.runAsync(
            'INSERT INTO exercise_logs (date, exercise_name, weight_kg, reps) VALUES (?, ?, ?, ?)',
            day.date,
            exercise.name,
            exercise.weightKg,
            reps
          );
        }
      }
      if (day.note || day.cardio) {
        await db.runAsync(
          `INSERT INTO day_notes (date, note, cardio) VALUES (?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET note = excluded.note, cardio = excluded.cardio`,
          day.date,
          day.note ?? '',
          day.cardio ?? ''
        );
      }
    }

    await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', IMPORT_FLAG, 'done');
  });
}

const RENAME_FLAG = 'rename_korean_v1';

// 이미 한국어 이름으로 저장된 기존 설치본의 로그/목표를 영어 명칭으로 일괄 변경.
// 새 설치는 seed가 처음부터 영어라 no-op이 된다.
export async function renameKoreanExercises(db: SQLiteDatabase) {
  const done = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    RENAME_FLAG
  );
  if (done) return;

  await db.withTransactionAsync(async () => {
    for (const [ko, en] of KOREAN_TO_ENGLISH) {
      await db.runAsync('UPDATE exercise_logs SET exercise_name = ? WHERE exercise_name = ?', en, ko);
      await db.runAsync('UPDATE exercise_goals SET exercise_name = ? WHERE exercise_name = ?', en, ko);
    }
    await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', RENAME_FLAG, 'done');
  });
}
