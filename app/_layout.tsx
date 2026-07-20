import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DATABASE_NAME, migrateDb } from '../lib/db';
import { strings } from '../lib/i18n';
import { LanguageProvider } from '../lib/language';
import { colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <LanguageProvider>
      {(lang) => (
        <SafeAreaProvider>
          {/* key={lang}: 언어를 바꾸면 라우터 트리 전체(탭 네비게이터·헤더·모든 화면)가
              remount되어 교체된 strings를 다시 읽는다. expo-router는 <Stack>에 key를 줘도
              이미 마운트된 하위 라우트까지 remount하지 않으므로 여기(Provider)에 건다.
              migrateDb는 idempotent라 재실행돼도 안전하다. */}
          <SQLiteProvider key={lang} databaseName={DATABASE_NAME} onInit={migrateDb}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="log/new" options={{ presentation: 'modal', title: strings.addLogTitle }} />
              <Stack.Screen name="log/goal" options={{ presentation: 'modal', title: strings.setGoalTitle }} />
              <Stack.Screen name="log/edit" options={{ presentation: 'modal', title: strings.editSetTitle }} />
            </Stack>
            <StatusBar style="light" />
          </SQLiteProvider>
        </SafeAreaProvider>
      )}
    </LanguageProvider>
  );
}
