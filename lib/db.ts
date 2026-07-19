import type { SQLiteDatabase } from 'expo-sqlite';

export type ExerciseLog = {
  id: number;
  date: string; // YYYY-MM-DD (local time)
  exercise_name: string;
  weight_kg: number;
  reps: number;
  created_at: string;
};

export type ExerciseGoal = {
  id: number;
  date: string; // YYYY-MM-DD (local time)
  exercise_name: string;
  target_sets: number;
  done_sets: number; // 조회 시 exercise_logs에서 집계된다
};

export const DATABASE_NAME = 'workout_logs.db';

export type DayNote = {
  date: string;
  note: string;
  cardio: string;
};

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercise_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      reps INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_exercise_logs_date ON exercise_logs(date);
    CREATE TABLE IF NOT EXISTS exercise_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      target_sets INTEGER NOT NULL,
      UNIQUE(date, exercise_name)
    );
    CREATE TABLE IF NOT EXISTS day_notes (
      date TEXT PRIMARY KEY,
      note TEXT NOT NULL DEFAULT '',
      cardio TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // 예전 수기 메모 데이터 1회성 임포트 (meta 플래그로 중복 방지)
  const { importLegacyData, renameKoreanExercises } = await import('./seed');
  await importLegacyData(db);
  // 기존 설치본의 한국어 운동명을 영어로 일괄 변경 (1회성)
  await renameKoreanExercises(db);
}

export function getDayNote(db: SQLiteDatabase, date: string) {
  return db.getFirstAsync<DayNote>('SELECT * FROM day_notes WHERE date = ?', date);
}

export function setDayNote(db: SQLiteDatabase, date: string, note: string, cardio: string) {
  if (!note.trim() && !cardio.trim()) {
    return db.runAsync('DELETE FROM day_notes WHERE date = ?', date);
  }
  return db.runAsync(
    `INSERT INTO day_notes (date, note, cardio) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET note = excluded.note, cardio = excluded.cardio`,
    date,
    note.trim(),
    cardio.trim()
  );
}

// 달력에 메모 있는 날짜 표시용
export function getNotedDates(db: SQLiteDatabase) {
  return db.getAllAsync<{ date: string }>('SELECT date FROM day_notes');
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function addLog(
  db: SQLiteDatabase,
  entry: { date: string; exercise_name: string; weight_kg: number; reps: number }
) {
  return db.runAsync(
    'INSERT INTO exercise_logs (date, exercise_name, weight_kg, reps) VALUES (?, ?, ?, ?)',
    entry.date,
    entry.exercise_name,
    entry.weight_kg,
    entry.reps
  );
}

export function getLogsByDate(db: SQLiteDatabase, date: string) {
  return db.getAllAsync<ExerciseLog>(
    'SELECT * FROM exercise_logs WHERE date = ? ORDER BY created_at ASC, id ASC',
    date
  );
}

export function getAllLogs(db: SQLiteDatabase) {
  return db.getAllAsync<ExerciseLog>(
    'SELECT * FROM exercise_logs ORDER BY date DESC, created_at ASC, id ASC'
  );
}

export function deleteLog(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM exercise_logs WHERE id = ?', id);
}

export function getLogById(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ExerciseLog>('SELECT * FROM exercise_logs WHERE id = ?', id);
}

export function updateLog(
  db: SQLiteDatabase,
  id: number,
  fields: { weight_kg: number; reps: number }
) {
  return db.runAsync(
    'UPDATE exercise_logs SET weight_kg = ?, reps = ? WHERE id = ?',
    fields.weight_kg,
    fields.reps,
    id
  );
}

// 이 운동의 가장 최근 세트 (날짜 불문) — 무게/횟수 자동 채움에 쓴다.
export function getLastSetForExercise(db: SQLiteDatabase, exerciseName: string) {
  return db.getFirstAsync<ExerciseLog>(
    `SELECT * FROM exercise_logs WHERE exercise_name = ?
     ORDER BY date DESC, created_at DESC, id DESC LIMIT 1`,
    exerciseName
  );
}

export function setGoal(
  db: SQLiteDatabase,
  goal: { date: string; exercise_name: string; target_sets: number }
) {
  return db.runAsync(
    `INSERT INTO exercise_goals (date, exercise_name, target_sets) VALUES (?, ?, ?)
     ON CONFLICT(date, exercise_name) DO UPDATE SET target_sets = excluded.target_sets`,
    goal.date,
    goal.exercise_name,
    goal.target_sets
  );
}

export function getGoalsByDate(db: SQLiteDatabase, date: string) {
  return db.getAllAsync<ExerciseGoal>(
    `SELECT g.*,
       (SELECT COUNT(*) FROM exercise_logs l
        WHERE l.date = g.date AND l.exercise_name = g.exercise_name) AS done_sets
     FROM exercise_goals g WHERE g.date = ? ORDER BY g.id ASC`,
    date
  );
}

export function deleteGoal(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM exercise_goals WHERE id = ?', id);
}

// 이 운동의 가장 최근 목표 세트 수 — 운동 추가 모달의 기본값으로 쓴다.
export function getLastGoalTarget(db: SQLiteDatabase, exerciseName: string) {
  return db.getFirstAsync<{ target_sets: number }>(
    `SELECT target_sets FROM exercise_goals WHERE exercise_name = ?
     ORDER BY date DESC, id DESC LIMIT 1`,
    exerciseName
  );
}

// 달력 히트맵용: 날짜별 세트 수
export function getDailySetCounts(db: SQLiteDatabase) {
  return db.getAllAsync<{ date: string; sets: number }>(
    'SELECT date, COUNT(*) AS sets FROM exercise_logs GROUP BY date'
  );
}

// 통계 그래프용: 종목 목록 (많이 한 순)
export function getExerciseNamesByFrequency(db: SQLiteDatabase) {
  return db.getAllAsync<{ exercise_name: string; count: number }>(
    `SELECT exercise_name, COUNT(*) AS count FROM exercise_logs
     GROUP BY exercise_name ORDER BY count DESC`
  );
}

// 통계 그래프용: 한 종목의 날짜별 최고 무게 / 총 횟수 (최근 limit회 운동일)
export async function getExerciseSessionStats(db: SQLiteDatabase, exerciseName: string, limit = 12) {
  const rows = await db.getAllAsync<{ date: string; max_weight: number; total_reps: number; sets: number }>(
    `SELECT date, MAX(weight_kg) AS max_weight, SUM(reps) AS total_reps, COUNT(*) AS sets
     FROM exercise_logs WHERE exercise_name = ?
     GROUP BY date ORDER BY date DESC LIMIT ?`,
    exerciseName,
    limit
  );
  return rows.reverse(); // 그래프는 과거 → 최신 순으로 그린다
}

// 졸라맨 부위 레벨용: 특정 날짜 이후 종목별 세트 수
export function getSetCountsByExerciseSince(db: SQLiteDatabase, sinceDate: string) {
  return db.getAllAsync<{ exercise_name: string; sets: number }>(
    `SELECT exercise_name, COUNT(*) AS sets FROM exercise_logs
     WHERE date >= ? GROUP BY exercise_name`,
    sinceDate
  );
}

// 졸라맨 방치 단계용: 마지막으로 운동한 날짜
export function getLastWorkoutDate(db: SQLiteDatabase) {
  return db.getFirstAsync<{ date: string | null }>('SELECT MAX(date) AS date FROM exercise_logs');
}

export function getRecentExerciseNames(db: SQLiteDatabase, limit = 12) {
  return db.getAllAsync<{ exercise_name: string }>(
    `SELECT exercise_name, MAX(created_at) AS last_used
     FROM exercise_logs GROUP BY exercise_name
     ORDER BY last_used DESC LIMIT ?`,
    limit
  );
}
