import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import { StorageAccessFramework, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { buildBackupCsv, parseBackupCsv, importBackup } from '../../lib/backup';
import {
  getExerciseNamesByFrequency,
  getExerciseSessionStats,
  getSetCountsByExerciseSince,
  getLastWorkoutDate,
  getDailySetCounts,
  getMetaValue,
  setMetaValue,
  toDateString,
  todayString,
} from '../../lib/db';
import { strings } from '../../lib/i18n';
import { ExerciseChart, type SessionStat } from '../../components/ExerciseChart';
import { StickFigure, PartGauges, avatarStage, GOAL_STATE, type AvatarState } from '../../components/StickFigure';
import { classifyExercise, partLevel, MUSCLE_PARTS, type MusclePart } from '../../constants/muscles';
import { colors } from '../../constants/colors';

// 내보내기 폴더의 SAF 권한 URI를 저장해 두는 meta 키
const BACKUP_DIR_KEY = 'backup_dir_uri';
// 폴더 선택기가 처음에 Download 폴더를 보여주도록 하는 힌트
const DOWNLOAD_TREE_HINT = 'content://com.android.externalstorage.documents/tree/primary%3ADownload';

type Stats = {
  workoutDays: number;
  currentStreakDays: number;
  volumeThisWeekKg: number;
  totalVolumeKg: number;
};

type MonthInfo = {
  days: number;
  volumeKg: number;
  setsByDay: Map<string, number>;
};

function computeStreak(dates: string[]): number {
  const daySet = new Set(dates);
  let streak = 0;
  const cursor = new Date();

  // 오늘 기록이 아직 없어도 어제까지 이어진 연속 기록은 유지된 것으로 본다.
  if (!daySet.has(toDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (daySet.has(toDateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function daysAgoString(days: number): string {
  return toDateString(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

export default function StatsScreen() {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [avatar, setAvatar] = useState<AvatarState | null>(null);
  const [weakPart, setWeakPart] = useState<MusclePart | null>(null);
  const [hasAnyLog, setHasAnyLog] = useState(false);
  const [month, setMonth] = useState<MonthInfo | null>(null);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionStat[]>([]);

  const load = useCallback(async () => {
    const today = todayString();
    const weekStart = daysAgoString(6);
    const twoWeeksStart = daysAgoString(13);
    const monthStart = today.slice(0, 8) + '01';

    const [totals, week, monthVolume, dates, names, counts14, counts7, lastDate, daily] =
      await Promise.all([
        db.getFirstAsync<{ volume: number | null }>(
          'SELECT SUM(weight_kg * reps) AS volume FROM exercise_logs'
        ),
        db.getFirstAsync<{ volume: number | null }>(
          'SELECT SUM(weight_kg * reps) AS volume FROM exercise_logs WHERE date >= ?',
          weekStart
        ),
        db.getFirstAsync<{ volume: number | null }>(
          'SELECT SUM(weight_kg * reps) AS volume FROM exercise_logs WHERE date >= ?',
          monthStart
        ),
        db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM exercise_logs'),
        getExerciseNamesByFrequency(db),
        getSetCountsByExerciseSince(db, twoWeeksStart),
        getSetCountsByExerciseSince(db, weekStart),
        getLastWorkoutDate(db),
        getDailySetCounts(db),
      ]);

    const dateList = dates.map((row) => row.date);
    const streak = computeStreak(dateList);

    setStats({
      workoutDays: dateList.length,
      currentStreakDays: streak,
      volumeThisWeekKg: week?.volume ?? 0,
      totalVolumeKg: totals?.volume ?? 0,
    });

    // ── 졸라맨 상태 계산 ──
    const partSets: Record<MusclePart, number> = {
      legs: 0, back: 0, chest: 0, shoulders: 0, arms: 0, core: 0,
    };
    for (const row of counts14) {
      const part = classifyExercise(row.exercise_name);
      if (part) partSets[part] += row.sets;
    }
    const partLevels = Object.fromEntries(
      MUSCLE_PARTS.map((part) => [part, partLevel(partSets[part])])
    ) as Record<MusclePart, number>;

    const last = lastDate?.date ?? null;
    const staleDays = last
      ? Math.floor((Date.now() - new Date(last + 'T00:00:00').getTime()) / (24 * 60 * 60 * 1000))
      : 999;
    const workedToday = last === today;

    const weekDays = dateList.filter((d) => d >= weekStart).length;
    const weekSets = counts7.reduce((sum, row) => sum + row.sets, 0);

    setHasAnyLog(last !== null);
    setAvatar({
      stage: avatarStage(staleDays, workedToday),
      staleDays,
      streak,
      partLevels,
      headband: weekDays >= 4,
      dumbbell: weekSets >= 30,
    });

    // 최근 2주간 가장 소홀한 부위 (전부 0이면 힌트 생략)
    const trained = MUSCLE_PARTS.filter((part) => partSets[part] > 0);
    if (trained.length > 0 && trained.length < MUSCLE_PARTS.length) {
      const weakest = MUSCLE_PARTS.filter((part) => partSets[part] === 0)[0];
      setWeakPart(weakest ?? null);
    } else {
      setWeakPart(null);
    }

    // ── 이번 달 요약 ──
    setMonth({
      days: dateList.filter((d) => d >= monthStart).length,
      volumeKg: Math.round(monthVolume?.volume ?? 0),
      setsByDay: new Map(
        daily.filter((row) => row.date >= monthStart).map((row) => [row.date, row.sets])
      ),
    });

    const nameList = names.map((row) => row.exercise_name);
    setExerciseNames(nameList);
    // 처음 열 때는 가장 많이 한 종목을 자동 선택
    setSelectedExercise((current) => current ?? nameList[0] ?? null);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (!selectedExercise) {
        setSessions([]);
        return;
      }
      getExerciseSessionStats(db, selectedExercise).then(setSessions);
    }, [db, selectedExercise])
  );

  if (!stats || !avatar) return <View style={styles.container} />;

  const caption = !hasAnyLog
    ? strings.avatarNoData
    : avatar.stage === 'energetic'
      ? `${strings.avatarEnergetic} 🔥`
      : avatar.stage === 'normal'
        ? strings.avatarNormal
        : avatar.stage === 'slouch'
          ? strings.avatarSlouch(avatar.staleDays)
          : avatar.stage === 'jelly'
            ? strings.avatarJelly(avatar.staleDays)
            : `${strings.avatarGhost} 👻`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 졸라맨 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{strings.avatarTitle}</Text>
        <View style={styles.avatarRow}>
          <View style={styles.avatarStack}>
            {/* 최고 상태(목표) 실루엣을 흐릿하게 뒤에 깔아둔다 */}
            <View style={styles.goalLayer} pointerEvents="none">
              <StickFigure state={GOAL_STATE} faded />
            </View>
            <StickFigure state={avatar} />
          </View>
          <PartGauges partLevels={avatar.partLevels} />
        </View>
        <Text style={styles.caption}>{caption}</Text>
        {weakPart && hasAnyLog && (
          <Text style={styles.weakHint}>{strings.avatarWeakHint(strings.partNames[weakPart])}</Text>
        )}
      </View>

      <View style={styles.grid}>
        <StatTile label={strings.statWorkoutDays} value={strings.days(stats.workoutDays)} />
        <StatTile label={strings.statStreak} value={strings.days(stats.currentStreakDays)} />
        <StatTile label={strings.statWeekVolume} value={`${Math.round(stats.volumeThisWeekKg).toLocaleString()}kg`} />
        <StatTile label={strings.statTotalVolume} value={`${Math.round(stats.totalVolumeKg).toLocaleString()}kg`} />
      </View>

      {exerciseNames.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{strings.exerciseChartSection}</Text>
          <Text style={styles.hint}>{strings.selectExerciseHint}</Text>

          <View style={styles.chipWrap}>
            {exerciseNames.map((name) => {
              const isSelected = name === selectedExercise;
              return (
                <Pressable
                  key={name}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setSelectedExercise(name)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>

          <ExerciseChart sessions={sessions} />
        </View>
      )}

      {/* 이번 달 요약 */}
      {month && hasAnyLog && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{strings.monthSummaryTitle}</Text>
          <MonthStrip setsByDay={month.setsByDay} />
          <Text style={styles.caption}>{strings.monthSummary(month.days, month.volumeKg)}</Text>
        </View>
      )}

      {/* 데이터 백업 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{strings.backupTitle}</Text>
        <Text style={styles.hint}>{strings.backupHint}</Text>
        <View style={styles.backupRow}>
          <Pressable style={styles.backupButton} onPress={() => exportCsv()}>
            <Text style={styles.backupButtonText}>{strings.backupExport}</Text>
          </Pressable>
          <Pressable style={[styles.backupButton, styles.backupButtonSecondary]} onPress={() => importCsv()}>
            <Text style={styles.backupButtonText}>{strings.backupImport}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  async function exportCsv() {
    try {
      const { csv, counts } = await buildBackupCsv(db);
      if (counts.logs + counts.goals + counts.notes === 0) {
        Alert.alert(strings.backupTitle, strings.backupNothing);
        return;
      }
      const baseName = `workout-log-backup-${todayString()}`;

      if (Platform.OS !== 'android') {
        // Android 외 플랫폼은 공유 시트로 대체
        const file = new File(Paths.cache, `${baseName}.csv`);
        if (file.exists) file.delete();
        file.create();
        file.write(csv);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values-text',
          dialogTitle: strings.backupExport,
        });
        return;
      }

      // Android: SAF로 사용자가 지정한 폴더(권장: Download)에 직접 저장.
      // 처음 한 번 폴더를 고르면 권한 URI를 meta에 저장해 두고 재사용한다.
      const saved = await saveViaSaf(csv, baseName, await getMetaValue(db, BACKUP_DIR_KEY));
      if (saved === 'denied') return; // 폴더 선택을 취소함
      // SAF 폴더 선택기에서 막 돌아온 직후에 띄우는 Alert는 씹힐 수 있어 잠시 기다린다
      await new Promise((resolve) => setTimeout(resolve, 500));
      Alert.alert(strings.exportDoneTitle, strings.exportDoneMessage(`${baseName}.csv`));
    } catch {
      Alert.alert(strings.exportFailedTitle, strings.exportFailedMessage);
    }
  }

  // 저장된 폴더 권한으로 파일 생성을 시도하고, 권한이 없거나 만료됐으면 다시 폴더를 고르게 한다.
  async function saveViaSaf(csv: string, baseName: string, knownDirUri: string | null): Promise<'saved' | 'denied'> {
    if (knownDirUri) {
      try {
        const fileUri = await StorageAccessFramework.createFileAsync(knownDirUri, baseName, 'text/csv');
        await writeAsStringAsync(fileUri, csv);
        return 'saved';
      } catch {
        // 권한 만료/폴더 삭제 → 아래에서 다시 요청
      }
    }
    const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync(DOWNLOAD_TREE_HINT);
    if (!perm.granted) return 'denied';
    await setMetaValue(db, BACKUP_DIR_KEY, perm.directoryUri);
    const fileUri = await StorageAccessFramework.createFileAsync(perm.directoryUri, baseName, 'text/csv');
    await writeAsStringAsync(fileUri, csv);
    return 'saved';
  }

  async function importCsv() {
    let parsed: ReturnType<typeof parseBackupCsv>;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (picked.canceled) return;
      const text = await new File(picked.assets[0].uri).text();
      parsed = parseBackupCsv(text);
    } catch {
      Alert.alert(strings.importFailedTitle, strings.importInvalidMessage);
      return;
    }
    Alert.alert(
      strings.importConfirmTitle,
      strings.importConfirmMessage(parsed.logs.length, parsed.goals.length, parsed.notes.length),
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.importAction,
          onPress: async () => {
            try {
              const counts = await importBackup(db, parsed);
              await load();
              Alert.alert(strings.importDoneTitle, strings.importDoneMessage(counts.logs));
            } catch {
              Alert.alert(strings.importFailedTitle, strings.importInvalidMessage);
            }
          },
        },
      ]
    );
  }
}

// 이번 달 1일~말일을 한 줄 히트맵으로 (많이 한 날일수록 진하게)
function MonthStrip({ setsByDay }: { setsByDay: Map<string, number> }) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const prefix = todayString().slice(0, 8);

  return (
    <View style={styles.monthStrip}>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const date = `${prefix}${String(i + 1).padStart(2, '0')}`;
        const sets = setsByDay.get(date) ?? 0;
        const intensity = Math.min(sets / 12, 1);
        return (
          <View
            key={date}
            style={[
              styles.monthCell,
              sets > 0 && { backgroundColor: `rgba(94, 92, 230, ${0.3 + 0.6 * intensity})` },
            ]}
          />
        );
      })}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  tileValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  tileLabel: { color: colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarStack: { width: 160, height: 190 },
  goalLayer: { position: 'absolute', top: 0, left: 0 },
  caption: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  weakHint: { color: colors.danger, fontSize: 12, textAlign: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  backupRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  backupButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backupButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backupButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  monthStrip: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  monthCell: {
    flexGrow: 1,
    flexBasis: 6,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.background,
  },
});
