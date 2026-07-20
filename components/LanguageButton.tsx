import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useSettings } from '../lib/settings';
import { strings } from '../lib/i18n';
import { colors } from '../constants/colors';
import type { Lang } from '../lib/i18n';

const OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
];

// Stats 헤더 우측의 작은 국기 알약 버튼. 탭하면 언어 선택 팝업이 뜬다.
export function LanguageButton() {
  const { lang, setLang } = useSettings();
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.code === lang) ?? OPTIONS[1];

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
                  onPress={() => {
                    setOpen(false);
                    setLang(o.code);
                  }}
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
