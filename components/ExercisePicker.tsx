import { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, TextInput, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getAllExerciseNamesByRecency,
  getCustomExercises,
  addCustomExercise,
  renameCustomExercise,
  deleteCustomExercise,
} from '../lib/db';
import { PRESET_EXERCISES } from '../constants/exercises';
import { strings } from '../lib/i18n';
import { colors } from '../constants/colors';

type Item = { name: string; custom: boolean };

// 운동 기구 검색 피커: 필드를 누르면 검색창 + 리스트(최근순 → 알파벳)가 뜬다.
// 검색으로 좁히고, 없으면 새로 추가하며, 직접 추가한 기구는 이름 수정/삭제할 수 있다.
export function ExercisePicker({ value, onSelect }: { value: string; onSelect: (name: string) => void }) {
  const db = useSQLiteContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const loadCatalog = useCallback(async () => {
    const [recents, customs] = await Promise.all([
      getAllExerciseNamesByRecency(db),
      getCustomExercises(db),
    ]);
    const customLc = new Set(customs.map((c) => c.name.toLowerCase()));
    const seen = new Set<string>();
    const ordered: string[] = [];
    // 1) 최근 사용 순
    for (const r of recents) {
      const k = r.exercise_name.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        ordered.push(r.exercise_name);
      }
    }
    // 2) 나머지(프리셋 + 커스텀) 알파벳 순
    const rest: string[] = [];
    for (const n of [...PRESET_EXERCISES, ...customs.map((c) => c.name)]) {
      const k = n.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        rest.push(n);
      }
    }
    rest.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    setItems([...ordered, ...rest].map((name) => ({ name, custom: customLc.has(name.toLowerCase()) })));
  }, [db]);

  const openPicker = () => {
    setQuery('');
    setEditing(null);
    loadCatalog();
    setOpen(true);
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items;
  const showAdd = q.length > 0 && !items.some((it) => it.name.toLowerCase() === q);

  const choose = (name: string) => {
    onSelect(name);
    setOpen(false);
  };

  const doAdd = async () => {
    const name = query.trim();
    if (!name) return;
    await addCustomExercise(db, name);
    choose(name);
  };

  const saveEdit = async (oldName: string) => {
    const next = editText.trim();
    if (!next || next.toLowerCase() === oldName.toLowerCase()) {
      setEditing(null);
      return;
    }
    try {
      await renameCustomExercise(db, oldName, next);
      if (value === oldName) onSelect(next); // 선택 중이던 이름도 동기화
    } catch {
      // 이름 충돌(UNIQUE) 등은 무시하고 편집만 닫는다
    }
    setEditing(null);
    await loadCatalog();
  };

  const doDelete = (name: string) => {
    Alert.alert(strings.deleteExerciseTitle, strings.deleteExerciseMessage(name), [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.delete,
        style: 'destructive',
        onPress: async () => {
          await deleteCustomExercise(db, name);
          await loadCatalog();
        },
      },
    ]);
  };

  return (
    <>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={value ? styles.fieldText : styles.fieldPlaceholder} numberOfLines={1}>
          {value || strings.exercisePickerPlaceholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      {/* 전체화면 검색 페이지: 검색창을 상단에 고정해, 키보드가 올라와도 검색어와
          "추가" 행(리스트 맨 위)은 항상 보이고 아래 리스트만 스크롤된다. */}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheetFull} edges={['top', 'bottom']}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.search}
              placeholder={strings.exerciseSearchPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
            />
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(it) => it.name}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            ListHeaderComponent={
              showAdd ? (
                <Pressable style={styles.addRow} onPress={doAdd}>
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                  <Text style={styles.addText}>{strings.addExerciseNamed(query.trim())}</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              !showAdd ? <Text style={styles.empty}>{strings.noExerciseMatch}</Text> : null
            }
            renderItem={({ item }) =>
              editing === item.name ? (
                <View style={styles.row}>
                  <TextInput
                    style={styles.editInput}
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus
                    autoCorrect={false}
                    onSubmitEditing={() => saveEdit(item.name)}
                  />
                  <Pressable onPress={() => saveEdit(item.name)} hitSlop={8}>
                    <Ionicons name="checkmark" size={22} color={colors.success} />
                  </Pressable>
                  <Pressable onPress={() => setEditing(null)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.row} onPress={() => choose(item.name)}>
                  <Text style={styles.rowText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {value === item.name && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  {item.custom && (
                    <>
                      <Pressable
                        onPress={() => {
                          setEditing(item.name);
                          setEditText(item.name);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="pencil" size={18} color={colors.textMuted} />
                      </Pressable>
                      <Pressable onPress={() => doDelete(item.name)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </>
                  )}
                </Pressable>
              )
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldText: { color: colors.text, fontSize: 16, flex: 1 },
  fieldPlaceholder: { color: colors.textMuted, fontSize: 16, flex: 1 },
  sheetFull: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: { flex: 1, color: colors.text, fontSize: 16 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { color: colors.text, fontSize: 16, flex: 1 },
  editInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
});
