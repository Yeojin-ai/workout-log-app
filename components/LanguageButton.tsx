import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { getLanguage, setLanguage, strings, type Lang } from '../lib/i18n';
import { colors } from '../constants/colors';

const OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
];

// Stats 헤더 우측의 작은 국기 알약 버튼. 탭하면 언어 선택 팝업이 뜨고,
// 언어를 바꾸면 앱을 자연스럽게 재시작해(스플래시 후) 새 언어로 다시 뜬다.
export function LanguageButton() {
  const [open, setOpen] = useState(false);
  const lang = getLanguage();
  const current = OPTIONS.find((o) => o.code === lang) ?? OPTIONS[1];

  const choose = async (code: Lang) => {
    setOpen(false);
    if (code === lang) return;
    setLanguage(code); // 파일에 저장 → 재시작 후 이 값으로 뜬다
    try {
      await Updates.reloadAsync();
    } catch {
      // 개발 환경 등 재시작이 불가한 경우: 선택은 저장됐으니 다음 실행에 적용된다.
    }
  };

  return (
    <>
      <Pressable style={styles.pill} onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={styles.pillText}>
          {current.flag} {current.label}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{strings.languageTitle}</Text>
            {OPTIONS.map((o) => {
              const active = o.code === lang;
              return (
                <Pressable
                  key={o.code}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => choose(o.code)}
                >
                  <Text style={styles.optionText}>
                    {o.flag} {o.label}
                  </Text>
                  {active && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
  },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionActive: { borderColor: colors.primary },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  check: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
