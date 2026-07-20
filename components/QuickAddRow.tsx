import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { strings } from '../lib/i18n';
import { fromKg, toKg, getDefaultUnit, setDefaultUnit, type Unit } from '../lib/units';
import { colors } from '../constants/colors';

// 카드 안에서 바로 세트를 기록하는 입력줄: [무게][kg/lb][횟수][회][✓]
// 직전 세트 값·단위가 미리 채워져 있어서 보통은 ✓만 누르면 된다.
export function QuickAddRow({
  initialWeight,
  initialReps,
  initialUnit,
  onAdd,
}: {
  initialWeight?: number; // kg으로 들어온다
  initialReps?: number;
  initialUnit?: Unit;
  onAdd: (weightKg: number, reps: number, unit: Unit) => void;
}) {
  const [unit, setUnit] = useState<Unit>(initialUnit ?? getDefaultUnit());
  const [weight, setWeight] = useState(
    initialWeight != null ? String(fromKg(initialWeight, initialUnit ?? getDefaultUnit())) : ''
  );
  const [reps, setReps] = useState(initialReps != null ? String(initialReps) : '');

  // 무게는 비워두면 0(맨몸 운동)으로 저장한다.
  const weightValue = weight.trim() === '' ? 0 : Number(weight);
  const repsValue = Number(reps);
  const canAdd =
    Number.isFinite(weightValue) && weightValue >= 0 && Number.isInteger(repsValue) && repsValue > 0;

  // 단위를 바꿀 때 입력값도 같은 실제 무게로 환산해준다 (100lb ↔ 45.36kg).
  const toggleUnit = () => {
    const next: Unit = unit === 'kg' ? 'lb' : 'kg';
    const n = Number(weight);
    if (weight.trim() !== '' && Number.isFinite(n)) setWeight(String(fromKg(toKg(n, unit), next)));
    setUnit(next);
  };

  const add = () => {
    setDefaultUnit(unit);
    onAdd(toKg(weightValue, unit), repsValue, unit);
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        selectTextOnFocus
      />
      <Pressable style={styles.unitToggle} onPress={toggleUnit} hitSlop={6}>
        <Text style={styles.unitToggleText}>{unit}</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={reps}
        onChangeText={setReps}
        keyboardType="number-pad"
        placeholder="15"
        placeholderTextColor={colors.textMuted}
        selectTextOnFocus
      />
      <Text style={styles.unit}>{strings.repsUnit}</Text>
      <Pressable
        style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
        disabled={!canAdd}
        onPress={add}
      >
        <Ionicons name="checkmark" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
  unitToggle: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  unitToggleText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  unit: { color: colors.textMuted, fontSize: 13 },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 4,
  },
  addButtonDisabled: { opacity: 0.4 },
});
