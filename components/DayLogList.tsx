import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ExerciseLog } from '../lib/db';
import { strings } from '../lib/i18n';
import { formatWeight } from '../lib/units';
import { colors } from '../constants/colors';

// 같은 기구의 세트들을 한 카드로 묶어서 보여준다.
export function groupByExercise(logs: ExerciseLog[]) {
  const groups = new Map<string, ExerciseLog[]>();
  for (const log of logs) {
    const existing = groups.get(log.exercise_name);
    if (existing) {
      existing.push(log);
    } else {
      groups.set(log.exercise_name, [log]);
    }
  }
  return Array.from(groups.entries()).map(([name, sets]) => ({ name, sets }));
}

export function ExerciseGroupCard({
  name,
  sets,
  onPressSet,
  onLongPressSet,
  footer,
}: {
  name: string;
  sets: ExerciseLog[];
  onPressSet?: (log: ExerciseLog) => void;
  onLongPressSet?: (log: ExerciseLog) => void;
  footer?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.exerciseName}>{name}</Text>
      {sets.map((set, index) => (
        <Pressable
          key={set.id}
          style={styles.setRow}
          onPress={onPressSet ? () => onPressSet(set) : undefined}
          onLongPress={onLongPressSet ? () => onLongPressSet(set) : undefined}
          delayLongPress={400}
        >
          <Text style={styles.setIndex}>{strings.setIndex(index + 1)}</Text>
          <Text style={styles.setDetail}>{strings.setDetail(formatWeight(set.weight_kg, set.unit), set.reps)}</Text>
        </Pressable>
      ))}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  exerciseName: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setIndex: { color: colors.textMuted, fontSize: 14 },
  setDetail: { color: colors.text, fontSize: 15, fontWeight: '500' },
});
