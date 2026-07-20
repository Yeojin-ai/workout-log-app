import type { SQLiteDatabase } from 'expo-sqlite';
import type { Unit } from './units';

// CSV 백업/복원. 한 파일에 세 테이블을 담기 위해 첫 컬럼 type으로 행 종류를 구분한다:
//   log  → date, exercise, weight_kg, reps, unit, created_at
//   goal → date, exercise, target_sets
//   note → date, note, cardio
// 복원은 "파일에 등장하는 날짜의 기존 행을 지우고 파일 내용으로 대체"라서 재실행해도 안전하다.
// weight_kg는 항상 kg, unit은 표시 단위. 예전(unit 컬럼 없는) 백업은 kg으로 읽는다.

const HEADER = ['type', 'date', 'exercise', 'weight_kg', 'reps', 'unit', 'target_sets', 'note', 'cardio', 'created_at'];

export type BackupCounts = { logs: number; goals: number; notes: number };

export type ParsedBackup = {
  logs: { date: string; exercise_name: string; weight_kg: number; reps: number; unit: Unit; created_at: string | null }[];
  goals: { date: string; exercise_name: string; target_sets: number }[];
  notes: { date: string; note: string; cardio: string }[];
};

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

function csvLine(fields: (string | number | null)[]): string {
  return fields.map((f) => csvField(f == null ? '' : String(f))).join(',');
}

export async function buildBackupCsv(db: SQLiteDatabase): Promise<{ csv: string; counts: BackupCounts }> {
  const logs = await db.getAllAsync<{
    date: string; exercise_name: string; weight_kg: number; reps: number; unit: string; created_at: string;
  }>('SELECT date, exercise_name, weight_kg, reps, unit, created_at FROM exercise_logs ORDER BY date ASC, created_at ASC, id ASC');
  const goals = await db.getAllAsync<{ date: string; exercise_name: string; target_sets: number }>(
    'SELECT date, exercise_name, target_sets FROM exercise_goals ORDER BY date ASC, id ASC'
  );
  const notes = await db.getAllAsync<{ date: string; note: string; cardio: string }>(
    'SELECT date, note, cardio FROM day_notes ORDER BY date ASC'
  );

  const lines = [HEADER.join(',')];
  for (const l of logs) lines.push(csvLine(['log', l.date, l.exercise_name, l.weight_kg, l.reps, l.unit, '', '', '', l.created_at]));
  for (const g of goals) lines.push(csvLine(['goal', g.date, g.exercise_name, '', '', '', g.target_sets, '', '', '']));
  for (const n of notes) lines.push(csvLine(['note', n.date, '', '', '', '', '', n.note, n.cardio, '']));

  return {
    // BOM을 붙여야 Excel이 한글을 UTF-8로 읽는다
    csv: '\uFEFF' + lines.join('\r\n') + '\r\n',
    counts: { logs: logs.length, goals: goals.length, notes: notes.length },
  };
}

// 따옴표/줄바꿈/이스케이프("")를 처리하는 CSV 파서 (RFC 4180 수준)
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { pushField(); i++; continue; }
    if (ch === '\r') { if (text[i + 1] === '\n') i++; pushRow(); i++; continue; }
    if (ch === '\n') { pushRow(); i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) pushRow();
  // 완전히 빈 행은 버린다
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBackupCsv(text: string): ParsedBackup {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length === 0) throw new Error('empty file');

  const header = rows[0].map((f) => f.trim().toLowerCase());
  if (header[0] !== 'type' || header[1] !== 'date') throw new Error('unrecognized header');

  const col = (row: string[], name: string) => {
    const idx = header.indexOf(name);
    return idx >= 0 && idx < row.length ? row[idx].trim() : '';
  };

  const parsed: ParsedBackup = { logs: [], goals: [], notes: [] };
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const type = col(row, 'type').toLowerCase();
    const date = col(row, 'date');
    if (!DATE_RE.test(date)) throw new Error(`row ${r + 1}: bad date "${date}"`);

    if (type === 'log') {
      const exercise = col(row, 'exercise');
      const weight = Number(col(row, 'weight_kg') || '0');
      const reps = Number(col(row, 'reps'));
      if (!exercise || !Number.isFinite(weight) || !Number.isInteger(reps) || reps <= 0) {
        throw new Error(`row ${r + 1}: bad log row`);
      }
      const rawUnit = col(row, 'unit').toLowerCase();
      const unit: Unit = rawUnit === 'lb' ? 'lb' : 'kg'; // 예전 백업엔 unit 컬럼이 없음 → kg
      parsed.logs.push({
        date,
        exercise_name: exercise,
        weight_kg: weight,
        reps,
        unit,
        created_at: col(row, 'created_at') || null,
      });
    } else if (type === 'goal') {
      const exercise = col(row, 'exercise');
      const target = Number(col(row, 'target_sets'));
      if (!exercise || !Number.isInteger(target) || target <= 0) throw new Error(`row ${r + 1}: bad goal row`);
      parsed.goals.push({ date, exercise_name: exercise, target_sets: target });
    } else if (type === 'note') {
      parsed.notes.push({ date, note: col(row, 'note'), cardio: col(row, 'cardio') });
    } else {
      throw new Error(`row ${r + 1}: unknown type "${type}"`);
    }
  }
  return parsed;
}

// 파일에 등장하는 날짜의 기존 행을 테이블별로 지우고 파일 내용을 넣는다 (트랜잭션).
export async function importBackup(db: SQLiteDatabase, parsed: ParsedBackup): Promise<BackupCounts> {
  await db.withTransactionAsync(async () => {
    for (const date of new Set(parsed.logs.map((l) => l.date))) {
      await db.runAsync('DELETE FROM exercise_logs WHERE date = ?', date);
    }
    for (const date of new Set(parsed.goals.map((g) => g.date))) {
      await db.runAsync('DELETE FROM exercise_goals WHERE date = ?', date);
    }
    for (const l of parsed.logs) {
      if (l.created_at) {
        await db.runAsync(
          'INSERT INTO exercise_logs (date, exercise_name, weight_kg, reps, unit, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          l.date, l.exercise_name, l.weight_kg, l.reps, l.unit, l.created_at
        );
      } else {
        await db.runAsync(
          'INSERT INTO exercise_logs (date, exercise_name, weight_kg, reps, unit) VALUES (?, ?, ?, ?, ?)',
          l.date, l.exercise_name, l.weight_kg, l.reps, l.unit
        );
      }
    }
    for (const g of parsed.goals) {
      await db.runAsync(
        'INSERT INTO exercise_goals (date, exercise_name, target_sets) VALUES (?, ?, ?)',
        g.date, g.exercise_name, g.target_sets
      );
    }
    for (const n of parsed.notes) {
      await db.runAsync(
        `INSERT INTO day_notes (date, note, cardio) VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET note = excluded.note, cardio = excluded.cardio`,
        n.date, n.note, n.cardio
      );
    }
  });
  return { logs: parsed.logs.length, goals: parsed.goals.length, notes: parsed.notes.length };
}
