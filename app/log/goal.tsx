import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { setGoal, getRecentExerciseNames, getLastGoalTarget, todayString } from '../../lib/db';
import { strings } from '../../lib/i18n';
import { PRESET_EXERCISES } from '../../constants/exercises';
import { DateField } from '../../components/DateField';
import { colors } from '../../constants/colors';

export default function GoalScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [date, setDate] = useState(todayString());
  const [exerciseName, setExerciseName] = useState('');
  const [customName, setCustomName] = useState('');
  const [targetSets, setTargetSets] = useState('');
  const [recentNames, setRecentNames] = useState<string[]>([]);

  useEffect(() => {
    getRecentExerciseNames(db).then((rows) => setRecentNames(rows.map((row) => row.exercise_name)));
  }, [db]);

  const chipNames = [...recentNames, ...PRESET_EXERCISES.filter((name) => !recentNames.includes(name))];

  const selectedName = customName.trim() || exerciseName;

  // 운동을 고르면 지난번 목표 세트 수를 기본값으로 채운다.
  useEffect(() => {
    if (!selectedName) return;
    getLastGoalTarget(db, selectedName).then((last) => {
      if (last) setTargetSets(String(last.target_sets));
    });
  }, [db, selectedName]);

  const targetValue = Number(targetSets);
  const canSave = selectedName.length > 0 && Number.isInteger(targetValue) && targetValue > 0;

  const handleSave = async () => {
    try {
      await setGoal(db, { date, exercise_name: selectedName, target_sets: targetValue });
      router.back();
    } catch {
      Alert.alert(strings.saveFailedTitle, strings.saveFailedMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{strings.dateLabel}</Text>
        <DateField value={date} onChange={setDate} />

        <Text style={styles.label}>{strings.exerciseLabel}</Text>
        <View style={styles.chipWrap}>
          {chipNames.map((name) => {
            const isSelected = exerciseName === name && !customName.trim();
            return (
              <Pressable
                key={name}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => {
                  setExerciseName(name);
                  setCustomName('');
                }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder={strings.customExercisePlaceholder}
          placeholderTextColor={colors.textMuted}
          value={customName}
          onChangeText={setCustomName}
        />

        <Text style={styles.label}>{strings.targetSetsLabel}</Text>
        <TextInput
          style={styles.input}
          placeholder="5"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={targetSets}
          onChangeText={setTargetSets}
        />

        <Pressable
          style={[styles.button, !canSave && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.buttonText}>{strings.save}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12 },
  label: { color: colors.textMuted, fontSize: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
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
});
