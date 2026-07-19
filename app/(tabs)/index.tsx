import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  addLog,
  getLogsByDate,
  getGoalsByDate,
  getLastSetForExercise,
  deleteLog,
  deleteGoal,
  todayString,
  type ExerciseLog,
  type ExerciseGoal,
} from '../../lib/db';
import { strings } from '../../lib/i18n';
import { groupByExercise, ExerciseGroupCard } from '../../components/DayLogList';
import { QuickAddRow } from '../../components/QuickAddRow';
import { colors } from '../../constants/colors';

type Row =
  | { type: 'goal'; goal: ExerciseGoal; sets: ExerciseLog[]; lastWeight?: number; lastReps?: number }
  | { type: 'group'; name: string; sets: ExerciseLog[]; lastWeight?: number; lastReps?: number };

export default function TodayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const today = todayString();
    const [logs, goals] = await Promise.all([getLogsByDate(db, today), getGoalsByDate(db, today)]);

    const goalNames = new Set(goals.map((goal) => goal.exercise_name));
    const groups = groupByExercise(logs);
    const setsByName = new Map(groups.map((group) => [group.name, group.sets]));

    // 인라인 입력줄에 미리 채울 직전 값: 오늘 세트가 있으면 그 마지막 값,
    // 없으면 (다른 날짜 포함) 이 운동의 가장 최근 세트 값을 쓴다.
    const lastValuesFor = async (name: string, sets: ExerciseLog[]) => {
      const last = sets.length > 0 ? sets[sets.length - 1] : await getLastSetForExercise(db, name);
      return last ? { lastWeight: last.weight_kg, lastReps: last.reps } : {};
    };

    setRows(
      await Promise.all([
        ...goals.map(async (goal): Promise<Row> => {
          const sets = setsByName.get(goal.exercise_name) ?? [];
          return { type: 'goal', goal, sets, ...(await lastValuesFor(goal.exercise_name, sets)) };
        }),
        ...groups
          .filter((group) => !goalNames.has(group.name))
          .map(async (group): Promise<Row> => {
            return { type: 'group', name: group.name, sets: group.sets, ...(await lastValuesFor(group.name, group.sets)) };
          }),
      ])
    );
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleQuickAdd = async (exerciseName: string, weightKg: number, reps: number) => {
    await addLog(db, { date: todayString(), exercise_name: exerciseName, weight_kg: weightKg, reps });
    load();
  };

  const handlePressSet = (log: ExerciseLog) => {
    router.push({ pathname: '/log/edit', params: { id: String(log.id) } });
  };

  const handleLongPressSet = (log: ExerciseLog) => {
    Alert.alert(strings.deleteSetTitle, strings.deleteSetMessage(log.exercise_name, log.weight_kg, log.reps), [
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

  const handleLongPressGoal = (goal: ExerciseGoal) => {
    Alert.alert(strings.deleteGoalTitle, strings.deleteGoalMessage(goal.exercise_name), [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.delete,
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(db, goal.id);
          load();
        },
      },
    ]);
  };

  const today = new Date();

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === 'goal' ? `goal-${row.goal.id}` : `group-${row.name}`)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text style={styles.dateText}>
            {strings.formatDateShort(today.getMonth() + 1, today.getDate(), today.getDay())}
          </Text>
        }
        renderItem={({ item }) =>
          item.type === 'goal' ? (
            <GoalCard
              goal={item.goal}
              sets={item.sets}
              lastWeight={item.lastWeight}
              lastReps={item.lastReps}
              onAdd={(weight, reps) => handleQuickAdd(item.goal.exercise_name, weight, reps)}
              onPressSet={handlePressSet}
              onLongPress={() => handleLongPressGoal(item.goal)}
              onLongPressSet={handleLongPressSet}
            />
          ) : (
            <ExerciseGroupCard
              name={item.name}
              sets={item.sets}
              onPressSet={handlePressSet}
              onLongPressSet={handleLongPressSet}
              footer={
                <QuickAddRow
                  initialWeight={item.lastWeight}
                  initialReps={item.lastReps}
                  onAdd={(weight, reps) => handleQuickAdd(item.name, weight, reps)}
                />
              }
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{strings.emptyToday}</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => router.push('/log/goal')}>
        <Text style={styles.fabText}>{strings.addExercise}</Text>
      </Pressable>
    </View>
  );
}

// 목표 세트만큼 슬롯을 미리 그려두고, 세트를 마칠 때마다 하나씩 ✓로 채워진다.
function GoalCard({
  goal,
  sets,
  lastWeight,
  lastReps,
  onAdd,
  onPressSet,
  onLongPress,
  onLongPressSet,
}: {
  goal: ExerciseGoal;
  sets: ExerciseLog[];
  lastWeight?: number;
  lastReps?: number;
  onAdd: (weightKg: number, reps: number) => void;
  onPressSet: (log: ExerciseLog) => void;
  onLongPress: () => void;
  onLongPressSet: (log: ExerciseLog) => void;
}) {
  const isDone = goal.done_sets >= goal.target_sets;
  const progress = Math.min(goal.done_sets / goal.target_sets, 1);

  const slots = [];
  for (let i = 0; i < Math.max(goal.target_sets, sets.length); i++) {
    if (i < sets.length) {
      // 완료된 세트
      const set = sets[i];
      slots.push(
        <Pressable
          key={`done-${set.id}`}
          style={styles.slotRow}
          onPress={() => onPressSet(set)}
          onLongPress={() => onLongPressSet(set)}
          delayLongPress={400}
        >
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={styles.slotLabelDone}>{strings.setIndex(i + 1)}</Text>
          <Text style={styles.slotDetail}>{strings.setDetail(set.weight_kg, set.reps)}</Text>
        </Pressable>
      );
    } else if (i === sets.length) {
      // 지금 할 차례인 세트: 인라인 입력줄
      slots.push(
        <View key="active" style={styles.activeSlot}>
          <Ionicons name="ellipse-outline" size={22} color={colors.primary} />
          <Text style={styles.slotLabelActive}>{strings.setIndex(i + 1)}</Text>
          <View style={styles.activeSlotInput}>
            <QuickAddRow initialWeight={lastWeight} initialReps={lastReps} onAdd={onAdd} />
          </View>
        </View>
      );
    } else {
      // 아직 남은 빈 슬롯
      slots.push(
        <View key={`empty-${i}`} style={styles.slotRow}>
          <Ionicons name="ellipse-outline" size={22} color={colors.border} />
          <Text style={styles.slotLabelEmpty}>{strings.setIndex(i + 1)}</Text>
          <Text style={styles.slotDetailEmpty}>—</Text>
        </View>
      );
    }
  }

  return (
    <Pressable style={[styles.goalCard, isDone && styles.goalCardDone]} onLongPress={onLongPress} delayLongPress={400}>
      <View style={styles.goalHeader}>
        <Text style={styles.exerciseName}>{goal.exercise_name}</Text>
        <Text style={[styles.goalProgress, isDone && styles.goalProgressDone]}>
          {strings.goalProgress(goal.done_sets, goal.target_sets)}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }, isDone && styles.progressFillDone]} />
      </View>

      {slots}

      {isDone && (
        <>
          <Text style={styles.goalDoneText}>{strings.goalDone}</Text>
          <QuickAddRow initialWeight={lastWeight} initialReps={lastReps} onAdd={onAdd} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, gap: 12, paddingBottom: 100, flexGrow: 1 },
  dateText: { color: colors.textMuted, fontSize: 14, marginBottom: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  exerciseName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  goalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  goalCardDone: { borderColor: colors.success },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalProgress: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  goalProgressDone: { color: colors.success },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressFillDone: { backgroundColor: colors.success },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  slotLabelDone: { color: colors.text, fontSize: 14, width: 52 },
  slotLabelActive: { color: colors.primary, fontSize: 14, fontWeight: '700', width: 52 },
  slotLabelEmpty: { color: colors.textMuted, fontSize: 14, width: 52 },
  slotDetail: { color: colors.text, fontSize: 15, fontWeight: '500', flex: 1, textAlign: 'right' },
  slotDetailEmpty: { color: colors.border, fontSize: 15, flex: 1, textAlign: 'right' },
  activeSlot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  activeSlotInput: { flex: 1 },
  goalDoneText: { color: colors.success, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 2 },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
