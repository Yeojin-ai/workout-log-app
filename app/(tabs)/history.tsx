import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getLogsByDate,
  getDailySetCounts,
  getDayNote,
  setDayNote,
  getNotedDates,
  deleteLog,
  todayString,
  toDateString,
  type ExerciseLog,
} from '../../lib/db';
import { strings } from '../../lib/i18n';
import { formatWeight } from '../../lib/units';
import { groupByExercise, ExerciseGroupCard } from '../../components/DayLogList';
import { colors } from '../../constants/colors';

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return strings.formatDateLong(year, month, day, weekday);
}

// 세트 수 → 히트맵 진하기 (많이 한 날일수록 진하다)
function heatColor(sets: number): string | undefined {
  if (sets <= 0) return undefined;
  const intensity = Math.min(sets / 12, 1);
  return `rgba(94, 92, 230, ${0.25 + 0.65 * intensity})`;
}

export default function TrackingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [setCounts, setSetCounts] = useState<Map<string, number>>(new Map());
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [dayLogs, setDayLogs] = useState<ExerciseLog[]>([]);
  const [notedDates, setNotedDates] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [cardio, setCardio] = useState('');
  const [savedNote, setSavedNote] = useState({ note: '', cardio: '' });

  const load = useCallback(async () => {
    const [counts, logs, dayNote, noted] = await Promise.all([
      getDailySetCounts(db),
      getLogsByDate(db, selectedDate),
      getDayNote(db, selectedDate),
      getNotedDates(db),
    ]);
    setSetCounts(new Map(counts.map((row) => [row.date, row.sets])));
    setDayLogs(logs);
    setNotedDates(new Set(noted.map((row) => row.date)));
    const loaded = { note: dayNote?.note ?? '', cardio: dayNote?.cardio ?? '' };
    setNote(loaded.note);
    setCardio(loaded.cardio);
    setSavedNote(loaded);
  }, [db, selectedDate]);

  const noteChanged = note.trim() !== savedNote.note || cardio.trim() !== savedNote.cardio;

  const handleSaveNote = async () => {
    await setDayNote(db, selectedDate, note, cardio);
    load();
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePressSet = (log: ExerciseLog) => {
    router.push({ pathname: '/log/edit', params: { id: String(log.id) } });
  };

  const handleLongPressSet = (log: ExerciseLog) => {
    Alert.alert(strings.deleteSetTitle, strings.deleteSetMessage(log.exercise_name, formatWeight(log.weight_kg), log.reps), [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.delete,
        style: 'destructive',
        onPress: async () => {
          await deleteLog(db, log.id);
          load();
        },
      },
    ]);
  };

  // 달력 그리드 계산
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth(); // 0-based
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayString();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const groups = groupByExercise(dayLogs);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 달력 헤더 */}
      <View style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            style={styles.monthArrow}
            onPress={() => setMonthDate(new Date(year, month - 1, 1))}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.monthTitle}>{strings.monthTitle(year, month + 1)}</Text>
          <Pressable
            style={styles.monthArrow}
            onPress={() => setMonthDate(new Date(year, month + 1, 1))}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {strings.weekdaysShort.map((weekday, i) => (
            <Text key={i} style={styles.weekdayLabel}>
              {weekday}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, index) => {
            if (day === null) return <View key={`pad-${index}`} style={styles.cell} />;
            const dateString = toDateString(new Date(year, month, day));
            const sets = setCounts.get(dateString) ?? 0;
            const isSelected = dateString === selectedDate;
            const isToday = dateString === today;
            return (
              <Pressable
                key={dateString}
                style={styles.cell}
                onPress={() => setSelectedDate(dateString)}
              >
                <View
                  style={[
                    styles.cellInner,
                    sets > 0 && { backgroundColor: heatColor(sets) },
                    isToday && styles.cellToday,
                    isSelected && styles.cellSelected,
                  ]}
                >
                  <Text style={[styles.cellText, sets > 0 && styles.cellTextActive]}>{day}</Text>
                  {notedDates.has(dateString) && <View style={styles.noteDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 선택한 날짜의 기록 */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{formatDate(selectedDate)}</Text>
        <Pressable
          style={styles.dayAddButton}
          onPress={() => router.push({ pathname: '/log/new', params: { date: selectedDate } })}
        >
          <Text style={styles.dayAddText}>{strings.addLog}</Text>
        </Pressable>
      </View>

      {/* 메모 + 유산소 */}
      <View style={styles.noteCard}>
        <Text style={styles.noteLabel}>{strings.memoLabel}</Text>
        <TextInput
          style={styles.noteInput}
          placeholder={strings.memoPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
        />
        <Text style={styles.noteLabel}>{strings.cardioLabel}</Text>
        <TextInput
          style={styles.noteInput}
          placeholder={strings.cardioPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={cardio}
          onChangeText={setCardio}
          multiline
        />
        {noteChanged && (
          <Pressable style={styles.noteSaveButton} onPress={handleSaveNote}>
            <Text style={styles.noteSaveText}>{strings.save}</Text>
          </Pressable>
        )}
      </View>

      {groups.length === 0 ? (
        <Text style={styles.emptyText}>{strings.emptyHistory}</Text>
      ) : (
        <View style={styles.dayList}>
          {groups.map((group) => (
            <ExerciseGroupCard
              key={group.name}
              name={group.name}
              sets={group.sets}
              onPressSet={handlePressSet}
              onLongPressSet={handleLongPressSet}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  calendarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: { padding: 8 },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 100/7%로 하면 반올림 때문에 7칸이 한 줄에 안 들어가 요일이 밀린다
  cell: { width: '14.28%', aspectRatio: 1, padding: 3 },
  cellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellToday: { borderWidth: 1, borderColor: colors.textMuted },
  cellSelected: { borderWidth: 2, borderColor: colors.primary },
  cellText: { color: colors.textMuted, fontSize: 13 },
  cellTextActive: { color: '#fff', fontWeight: '700' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  dayAddButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dayAddText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  dayList: { gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  noteDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  noteLabel: { color: colors.textMuted, fontSize: 12 },
  noteInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
    minHeight: 38,
  },
  noteSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  noteSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
