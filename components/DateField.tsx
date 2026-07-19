import { useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toDateString, todayString } from '../lib/db';
import { strings } from '../lib/i18n';
import { colors } from '../constants/colors';

// YYYY-MM-DD 문자열로 날짜를 주고받는 선택 필드. 오늘 이후 날짜는 고를 수 없다.
export function DateField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [year, month, day] = value.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  const label = strings.formatDateLong(year, month, day, dateObj.getDay());
  const isToday = value === todayString();

  return (
    <>
      <Pressable style={styles.field} onPress={() => setShowPicker(true)}>
        <Text style={styles.fieldText}>
          {isToday ? `${strings.today} · ${label}` : label}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          maximumDate={new Date()}
          onChange={(_event, selected) => {
            setShowPicker(false);
            if (selected) onChange(toDateString(selected));
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldText: { color: colors.text, fontSize: 15 },
});
