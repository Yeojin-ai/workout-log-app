import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DATABASE_NAME, migrateDb } from '../lib/db';
import { strings } from '../lib/i18n';
import { colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDb}>
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
  );
}
