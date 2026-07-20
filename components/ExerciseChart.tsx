import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { G, Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { strings } from '../lib/i18n';
import { fromKg, unitLabel } from '../lib/units';
import { colors } from '../constants/colors';

export type SessionStat = { date: string; max_weight: number; total_reps: number; sets: number };

const PLOT_HEIGHT = 120;
const PAD_TOP = 22;
const PAD_BOTTOM = 26;
const PAD_X = 30;
const STEP = 62;

// 한 종목의 날짜별 최고 무게(보라)와 총 횟수(초록) 꺾은선 그래프.
export function ExerciseChart({ sessions }: { sessions: SessionStat[] }) {
  if (sessions.length === 0) {
    return <Text style={styles.emptyText}>{strings.noChartData}</Text>;
  }

  const maxWeight = Math.max(...sessions.map((s) => s.max_weight), 1);
  const maxReps = Math.max(...sessions.map((s) => s.total_reps), 1);

  const width = PAD_X * 2 + STEP * Math.max(sessions.length - 1, 1);
  const height = PAD_TOP + PLOT_HEIGHT + PAD_BOTTOM;

  const xAt = (index: number) => PAD_X + index * STEP;
  const yAt = (value: number, max: number) => PAD_TOP + (1 - value / max) * PLOT_HEIGHT;

  const weightPoints = sessions.map((s, i) => `${xAt(i)},${yAt(s.max_weight, maxWeight)}`).join(' ');
  const repsPoints = sessions.map((s, i) => `${xAt(i)},${yAt(s.total_reps, maxReps)}`).join(' ');

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          {/* 바닥 기준선 */}
          <Line
            x1={PAD_X - 10}
            y1={PAD_TOP + PLOT_HEIGHT}
            x2={width - PAD_X + 10}
            y2={PAD_TOP + PLOT_HEIGHT}
            stroke={colors.border}
            strokeWidth={1}
          />

          {sessions.length > 1 && (
            <>
              <Polyline points={weightPoints} fill="none" stroke={colors.primary} strokeWidth={2.5} />
              <Polyline points={repsPoints} fill="none" stroke={colors.success} strokeWidth={2.5} />
            </>
          )}

          {sessions.map((session, i) => {
            const [, month, day] = session.date.split('-').map(Number);
            const wx = xAt(i);
            const wy = yAt(session.max_weight, maxWeight);
            const ry = yAt(session.total_reps, maxReps);
            return (
              <G key={session.date}>
                <Circle cx={wx} cy={wy} r={4} fill={colors.primary} />
                <Circle cx={wx} cy={ry} r={4} fill={colors.success} />
                {/* 횟수 라벨은 점 아래에 둬서 무게 라벨과 겹치지 않게 한다 */}
                <SvgText x={wx} y={wy - 8} fontSize={10} fill={colors.primary} textAnchor="middle">
                  {fromKg(session.max_weight)}
                </SvgText>
                <SvgText x={wx} y={ry + 16} fontSize={10} fill={colors.success} textAnchor="middle">
                  {session.total_reps}
                </SvgText>
                <SvgText
                  x={wx}
                  y={PAD_TOP + PLOT_HEIGHT + 16}
                  fontSize={10}
                  fill={colors.textMuted}
                  textAnchor="middle"
                >
                  {`${month}/${day}`}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
        <Text style={styles.legendText}>{strings.chartWeight(unitLabel())}</Text>
        <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
        <Text style={styles.legendText}>{strings.chartReps}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  legendText: { color: colors.textMuted, fontSize: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
});
