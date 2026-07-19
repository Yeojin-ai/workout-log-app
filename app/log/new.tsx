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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { addLog, getRecentExerciseNames, getLastSetForExercise, todayString } from '../../lib/db';
import { strings } from '../../lib/i18n';
import { PRESET_EXERCISES } from '../../constants/exercises';
import { DateField } from '../../components/DateField';
import { colors } from '../../constants/colors';

export default function NewLogScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  // 목표 카드에서 "세트 기록"으로 들어오면 기구가 미리 정해져 있다.
  const params = useLocalSearchParams<{ exercise?: string; date?: string }>();
  const fixedExercise = typeof params.exercise === 'string' ? params.exercise : undefined;

  const [date, setDate] = useState(typeof params.date === 'string' ? params.date : todayString());
  const [exerciseName, setExerciseName] = useState(fixedExercise ?? '');
  const [customName, setCustomName] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (fixedExercise) return;
    getRecentExerciseNames(db).then((rows) => setRecentNames(rows.map((row) => row.exercise_name)));
  }, [db, fixedExercise]);

  // 최근 사용한 기구를 앞에, 나머지 프리셋을 뒤에 붙인다 (중복 제거).
  const chipNames = [...recentNames, ...PRESET_EXERCISES.filter((name) => !recentNames.includes(name))];

  const selectedName = fixedExercise ?? (customName.trim() || exerciseName);

  // 운동을 고르면 그 운동의 직전 무게/횟수를 자동으로 채운다 (아직 세트를 저장하기 전에만).
  useEffect(() => {
    if (!selectedName || savedCount > 0) return;
    getLastSetForExercise(db, selectedName).then((last) => {
      if (!last) return;
      setWeight(String(last.weight_kg));
      setReps(String(last.reps));
    });
  }, [db, selectedName, savedCount]);
  const weightValue = Number(weight);
  const repsValue = Number(reps);
  const canSave =
    selectedName.length > 0 &&
    Number.isFinite(weightValue) &&
    weightValue >= 0 &&
    Number.isInteger(repsValue) &&
    repsValue > 0;

  const save = async () => {
    try {
      await addLog(db, {
        date,
        exercise_name: selectedName,
        weight_kg: weightValue,
        reps: repsValue,
      });
      return true;
    } catch {
      Alert.alert(strings.saveFailedTitle, strings.saveFailedMessage);
      return false;
    }
  };

  const handleSaveAndClose = async () => {
    if (await save()) router.back();
  };

  const handleSaveAndNext = async () => {
    if (await save()) {
      setSavedCount((count) => count + 1);
      // 같은 기구로 다음 세트를 바로 입력할 수 있게 중량/횟수는 유지한다.
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
        {fixedExercise ? (
          <View style={styles.fixedExercise}>
            <Text style={styles.fixedExerciseText}>{fixedExercise}</Text>
          </View>
        ) : (
          <>
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
          </>
        )}

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>{strings.weightLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder="60"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{strings.repsLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder="10"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={reps}
              onChangeText={setReps}
            />
          </View>
        </View>

        {savedCount > 0 && (
          <Text style={styles.savedText}>{strings.savedSets(selectedName, savedCount)}</Text>
        )}

        <Pressable
          style={[styles.secondaryButton, !canSave && styles.buttonDisabled]}
          onPress={handleSaveAndNext}
          disabled={!canSave}
        >
          <Text style={styles.secondaryButtonText}>{strings.saveAndNext}</Text>
        </Pressable>

        <Pressable
          style={[styles.button, !canSave && styles.buttonDisabled]}
          onPress={handleSaveAndClose}
          disabled={!canSave}
        >
          <Text style={styles.buttonText}>{strings.saveAndClose}</Text>
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
  fixedExercise: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fixedExerciseText: { color: colors.text, fontSize: 16, fontWeight: '600' },
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
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 8 },
  savedText: { color: colors.success, fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});
