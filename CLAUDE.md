# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A React Native mobile app (Expo SDK 57, Expo Router, TypeScript) for logging daily gym workouts:
pick a machine/exercise, record weight (kg) and reps per set. **Offline-first by design** — all data
lives in an on-device SQLite database (expo-sqlite); there is no backend, no auth, and no network
dependency. Do not add a server or accounts unless the user asks.

UI is bilingual (Korean/English), chosen once at launch from the device locale — see
[lib/i18n.ts](lib/i18n.ts). Every user-facing string must go through the `strings` object there
(both `ko` and `en` variants; the `en` object is typed `typeof ko` so a missing key is a compile
error). Exercise presets are also localized in [constants/exercises.ts](constants/exercises.ts).
Never hardcode UI text in a screen. App display name is "Workout Log".

There is no web or desktop target — do not add `react-dom`/`react-native-web` unless asked.

## Commands

- `npm start` — start the Metro dev server (scan the QR code with Expo Go, or press `a`/`i` for a
  simulator).
- `npm run android` / `npm run ios` — start the dev server targeting a specific platform.
- `npm run typecheck` — `tsc --noEmit`. Run this after any change; there is no test suite yet.
- `npx expo export --platform android` — headless bundle build, useful for verifying the app compiles
  without a simulator/device attached (this is how bundling was last verified, since this environment
  has no emulator). Delete the `dist/` output afterward.

Node is installed via nvm (`~/.nvm/versions/node/v24.18.0/bin`). Interactive shells load it from
`~/.bashrc`; if a non-interactive shell can't find `node`, prefix commands with
`PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.

npm installs need `.npmrc`'s `legacy-peer-deps=true` (already committed) — expo-router 57 has an
upstream radix-ui peer conflict that otherwise fails every `npm install`.

There is no lint script configured. `npm run web` is wired up in package.json but `react-dom` /
`react-native-web` are not installed, so it will fail until those are added.

### Building an installable APK (local, no EAS account)

JDK 17 lives at `~/tools/jdk-17.0.19+10` and the Android SDK at `~/android-sdk` (both installed
without sudo; licenses already accepted). The native `android/` directory is generated — regenerate
it with `npx expo prebuild --platform android --no-install` after changing app.json (name, plugins,
icons), then build:

```
cd android && JAVA_HOME=~/tools/jdk-17.0.19+10 ANDROID_HOME=~/android-sdk \
  PATH="$HOME/tools/jdk-17.0.19+10/bin:$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" \
  ./gradlew assembleRelease --no-daemon
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. The release build is signed with
the debug keystore (Expo prebuild default) — fine for personal sideloading, not for Play Store.
First build takes ~10 min; cached rebuilds are much faster. Adding an Expo native module changes
autolinking, so prebuild + rebuild is required (JS-only changes still need a rebuild to refresh the
embedded bundle).

## Architecture

**Storage** is four SQLite tables owned by [lib/db.ts](lib/db.ts): `exercise_logs` (one row per set:
date, exercise_name, weight_kg, reps), `exercise_goals` (per date+exercise target set count, UNIQUE
on that pair — `setGoal` upserts), `day_notes` (per-date free-text `note` + `cardio` fields, edited
on the Tracking tab; green dot on calendar days that have one), and `meta` (key/value flags).
[lib/seed.ts](lib/seed.ts) imports the user's pre-app paper logs (2026-05-24 ~ 07-19) once on first
launch, guarded by the `legacy_import_v1` meta flag — never re-run it, and bump to a new flag name
if more legacy data needs importing. Exercise names in the seed were confirmed with the user
(e.g. their "Pectoral Fly" machine is actually a Reverse Pec Deck). Goals and logs are linked **by matching date +
exercise_name strings**, not by foreign key: `getGoalsByDate` computes `done_sets` by counting
matching logs, so renaming an exercise breaks the link. lib/db.ts is the only place SQL lives —
screens call its exported helpers plus ad-hoc aggregate queries in the stats screen. The schema is
created in `migrateDb`, which runs via `SQLiteProvider onInit` in [app/_layout.tsx](app/_layout.tsx);
to change the schema, extend `migrateDb` (it must stay idempotent — it reruns on every app start).

Dates are stored as local-time `YYYY-MM-DD` strings produced by `todayString()` in lib/db.ts — always
use that helper rather than `toISOString().slice(0,10)`, which is UTC and shifts the date for KST
users before 9am.

**Routing** is file-based via `expo-router`:
- `app/(tabs)/index.tsx` — Today. The core flow: "+ Add Exercise" opens `app/log/goal.tsx` (exercise
  chips + target set count, target prefilled from that exercise's last goal). This creates a goal
  card that pre-renders **one slot row per target set** — done slots show ✓ + kg×reps, the next-up
  slot is an inline [QuickAddRow](components/QuickAddRow.tsx) (`[weight][reps][✓]` prefilled from the
  last set via `getLastSetForExercise`), and remaining slots are grayed placeholders. Filling slots
  one-by-one is the deliberate UX (sense of progress); extra sets beyond target are allowed (the
  quick-add row stays after 🎉). Exercises with sets but no goal render as plain cards with the same
  quick-add row.
- `app/(tabs)/history.tsx` — the "Tracking" tab (file name is historical): a custom month-grid
  heatmap calendar (no calendar library) where day-cell opacity scales with that day's set count
  (`getDailySetCounts`, capped at 12 sets), plus the selected day's records below. Its "+ Log" button
  opens `app/log/new.tsx` with `?date=` — this is the past-date entry path (the modal's native date
  picker is capped at today).
- `app/(tabs)/progress.tsx` — Stats, four sections:
  1. **"졸라맨" stick-figure avatar** ([components/StickFigure.tsx](components/StickFigure.tsx),
     react-native-svg): limb stroke width grows with per-muscle-part training volume (sets in the
     last 14 days, mapped via keyword matching in [constants/muscles.ts](constants/muscles.ts) —
     handles the user's free-form Korean/English exercise names). Stage degrades with days since the
     last workout: energetic (today) → normal (≤2d) → slouched (3–6d) → jelly 🫠 (7–13d) → ghost 👻
     (14d+). Face emoji follows stage/streak; props (headband ≥4 workout days this week, dumbbell
     ≥30 sets this week). Level-0 parts draw thin/dim so weak spots stand out, plus a "part needs
     love" hint. A faint always-maxed silhouette (`GOAL_STATE`, `StickFigure faded`) is layered
     behind the live figure as an aspirational target. The part gauge lists parts head-to-toe
     (`MUSCLE_PARTS` order: shoulders, chest, back, arms, core, legs).
  2. Summary tiles (workout days / streak / weekly / lifetime volume).
  3. Per-exercise **line charts** ([components/ExerciseChart.tsx](components/ExerciseChart.tsx),
     react-native-svg polylines): exercise chips ordered by frequency; selected exercise shows
     per-session max-weight and total-reps lines (`getExerciseSessionStats`, last 12 sessions).
  4. Month summary strip (one heat cell per day of the current month).
  5. **Data Backup card**: CSV export / import. CSV logic lives in [lib/backup.ts](lib/backup.ts) —
     one file for all three tables, first column `type` = `log`/`goal`/`note`, UTF-8 BOM for Excel,
     RFC-4180 quoting. Import (expo-document-picker) **replaces** each date that appears in the file
     (per-table) inside a transaction, so re-importing is safe; dates absent from the file are
     untouched. Export saves the file via SAF (`expo-file-system/legacy` StorageAccessFramework) to
     a user-picked folder whose permission URI is cached in the `meta` table (`backup_dir_uri`) —
     Android 11+ forbids granting the Download **root**, so the user picks/creates a subfolder
     (e.g. Download/WorkoutLog) once and later exports save there silently. Share-sheet export
     (expo-sharing) remains only as the non-Android fallback; sharing straight to KakaoTalk pastes
     the CSV as text, which is why we save to disk instead.
- `app/log/edit.tsx?id=` — modal for editing/deleting a single set (weight + reps).

Empty weight saves as 0 (bodyweight exercises). Set rows everywhere: **tap = edit modal, long-press
= delete** (with confirm Alert). Goal cards: long-press deletes the goal but keeps its sets. Goals
only surface on the Today tab for today's date.

Screens reload data with `useFocusEffect` (not `useEffect`) so returning from the modal refreshes the
list. Set grouping/rendering shared by the today and history screens lives in
[components/DayLogList.tsx](components/DayLogList.tsx).


### App icon

The launcher/app icon is a cute muscular purple buddy holding dumbbells — user-provided artwork at
[assets/workout-log-icon.png](assets/workout-log-icon.png) (1024px, opaque **black** background
baked in; don't confuse it with the generated `icon.png`). [scripts/gen-icon.js](scripts/gen-icon.js)
processes that source into every PNG variant via `sharp`: it erases a ✨ artifact in the bottom-right
corner, luma-keys the black background out to get a transparent figure (for `splash-icon.png` and,
recolored white, `android-icon-monochrome.png`), shrinks the figure to the adaptive-icon safe zone
for `android-icon-foreground.png`, and uses the cleaned original as full-bleed `icon.png`/`favicon`.
Because the source bakes in pure black, the adaptive `backgroundColor`/background image are
`#000000` (not the app's `#0B0B0F`). `splash-icon.png` must stay transparent (Android 12+ masks the
splash image to a circle, so a baked-in dark square shows as a dark disc); the full-screen splash
background color comes from the `expo-splash-screen` plugin config in app.json instead. Regenerate with `node scripts/gen-icon.js` (needs
`npm i --no-save sharp`), then `npx expo prebuild --platform android --no-install` to push the PNGs
into `android/`. A future idea (deferred): swap among per-stage icons via `activity-alias` so the
launcher icon tracks the avatar's condition — the OS can't redraw an icon live, only switch between
prebuilt ones.

### Styling

No design system or component library — plain `StyleSheet.create` per screen, with a shared dark
palette in [constants/colors.ts](constants/colors.ts). Keep new screens consistent with that palette
rather than introducing new colors inline.
