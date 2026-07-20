import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getLogById, updateLog, deleteLog, type ExerciseLog } from '../../lib/db';
import { strings } from '../../lib/i18n';
import { fromKg, toKg, unitLabel, formatWeight } from '../../lib/units';
import { colors } from '../../constants/colors';

export default function EditLogScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const logId = Number(id);

  const [log, setLog] = useState<ExerciseLog | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  useEffect(() => {
    getLogById(db, logId).then((row) => {
      if (!row) {
        router.back();
        return;
      }
      setLog(row);
      setWeight(String(fromKg(row.weight_kg)));
      setReps(String(row.reps));
    });
  }, [db, logId]);

  if (!log) return <View style={styles.container} />;

  const weightValue = weight.trim() === '' ? 0 : Number(weight);
  const repsValue = Number(reps);
  const canSave =
    Number.isFinite(weightValue) && weightValue >= 0 && Number.isInteger(repsValue) && repsValue > 0;

  const handleSave = async () => {
    await updateLog(db, logId, { weight_kg: toKg(weightValue), reps: repsValue });
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(strings.deleteSetTitle, strings.deleteSetMessage(log.exercise_name, formatWeight(log.weight_kg), log.reps), [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.delete,
        style: 'destructive',
        onPress: async () => {
          await deleteLog(db, logId);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.exerciseName}>{log.exercise_name}</Text>
        <Text style={styles.dateText}>{log.date}</Text>

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>{strings.weightLabel(unitLabel())}</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              selectTextOnFocus
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{strings.repsLabel}</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={reps}
              onChangeText={setReps}
              selectTextOnFocus
            />
          </View>
        </View>

        <Pressable
          style={[styles.button, !canSave && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.buttonText}>{strings.save}</Text>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>{strings.delete}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12 },
  exerciseName: { color: colors.text, fontSize: 20, fontWeight: '700' },
  dateText: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
