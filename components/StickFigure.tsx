import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Ellipse, Text as SvgText } from 'react-native-svg';
import type { MusclePart } from '../constants/muscles';
import { MUSCLE_PARTS } from '../constants/muscles';
import { strings } from '../lib/i18n';
import { colors } from '../constants/colors';

export type AvatarStage = 'energetic' | 'normal' | 'slouch' | 'jelly' | 'ghost';

export type AvatarState = {
  stage: AvatarStage;
  staleDays: number;
  streak: number;
  partLevels: Record<MusclePart, number>;
  headband: boolean; // 이번 주 4일 이상 운동
  dumbbell: boolean; // 이번 주 30세트 이상
};

// 방치 일수 → 단계. 오늘 운동했으면 energetic.
export function avatarStage(staleDays: number, workedToday: boolean): AvatarStage {
  if (workedToday) return 'energetic';
  if (staleDays <= 2) return 'normal';
  if (staleDays <= 6) return 'slouch';
  if (staleDays <= 13) return 'jelly';
  return 'ghost';
}

function faceEmoji(stage: AvatarStage, streak: number): string {
  switch (stage) {
    case 'energetic':
      return streak >= 7 ? '🔥' : '😤';
    case 'normal':
      return streak >= 3 ? '🙂' : '😌';
    case 'slouch':
      return '😪';
    case 'jelly':
      return '🫠';
    case 'ghost':
      return '👻';
  }
}

// 부위 레벨(0~3) → 획 굵기. 레벨 0이면 흐릿하게 그려서 약한 부위가 눈에 띈다.
function limbWidth(level: number): number {
  return 3 + level * 2;
}
function limbColor(level: number): string {
  return level === 0 ? colors.border : colors.text;
}

// 모든 부위 만렙 + 활기찬 상태 = "목표" 졸라맨. 배경 실루엣에 쓴다.
export const GOAL_STATE: AvatarState = {
  stage: 'energetic',
  staleDays: 0,
  streak: 7,
  partLevels: { legs: 3, back: 3, chest: 3, shoulders: 3, arms: 3, core: 3 },
  headband: true,
  dumbbell: true,
};

// faded=true면 얼굴/음영 없이 흐릿한 실루엣만 그린다 (목표 배경용).
export function StickFigure({ state, faded = false }: { state: AvatarState; faded?: boolean }) {
  const { stage, partLevels } = state;
  const face = faded ? '' : faceEmoji(stage, state.streak);
  const opacity = faded ? 0.2 : stage === 'ghost' ? 0.45 : stage === 'jelly' ? 0.85 : 1;

  if (stage === 'ghost') {
    // 유령: 몸이 사라지고 흐물흐물한 보자기만 남는다
    return (
      <Svg width={160} height={190} opacity={opacity}>
        <Path
          d="M50,70 Q50,28 80,28 Q110,28 110,70 L110,140 Q102,128 94,140 Q86,152 80,140 Q74,152 66,140 Q58,128 50,140 Z"
          fill={colors.surface}
          stroke={colors.textMuted}
          strokeWidth={2}
        />
        <SvgText x={80} y={78} fontSize={26} textAnchor="middle">
          {face}
        </SvgText>
      </Svg>
    );
  }

  const isJelly = stage === 'jelly';
  const isSlouch = stage === 'slouch';
  const armsUp = stage === 'energetic';

  // 자세별 좌표
  const headX = isSlouch ? 86 : 80;
  const headY = isSlouch ? 40 : 32;
  const neckY = headY + 20;
  const hipY = 115;

  const shoulderHalf = 22 + partLevels.shoulders * 3;

  // 팔: 활기차면 만세, 처지면 축 늘어짐, 젤리면 물결
  const leftArm = armsUp
    ? `M${headX - shoulderHalf + 4},${neckY + 4} L${headX - shoulderHalf - 14},${headY - 2}`
    : isJelly
      ? `M${headX - shoulderHalf + 4},${neckY + 4} q -12 18 -6 30 q 4 10 -4 16`
      : isSlouch
        ? `M${headX - shoulderHalf + 4},${neckY + 6} L${headX - shoulderHalf - 4},${hipY - 6}`
        : `M${headX - shoulderHalf + 4},${neckY + 4} L${headX - shoulderHalf - 12},${hipY - 14}`;
  const rightArm = armsUp
    ? `M${headX + shoulderHalf - 4},${neckY + 4} L${headX + shoulderHalf + 14},${headY - 2}`
    : isJelly
      ? `M${headX + shoulderHalf - 4},${neckY + 4} q 12 18 6 30 q -4 10 4 16`
      : isSlouch
        ? `M${headX + shoulderHalf - 4},${neckY + 6} L${headX + shoulderHalf + 4},${hipY - 6}`
        : `M${headX + shoulderHalf - 4},${neckY + 4} L${headX + shoulderHalf + 12},${hipY - 14}`;

  // 다리: 젤리면 흐물흐물
  const leftLeg = isJelly
    ? `M80,${hipY} q -14 20 -8 34 q 4 12 -6 18`
    : `M80,${hipY} L${60},${hipY + 55}`;
  const rightLeg = isJelly
    ? `M80,${hipY} q 14 20 8 34 q -4 12 6 18`
    : `M80,${hipY} L${100},${hipY + 55}`;

  // 몸통: 구부정하면 굽은 곡선
  const torso = isSlouch
    ? `M${headX + 2},${neckY} Q${headX + 12},${(neckY + hipY) / 2} 80,${hipY}`
    : `M80,${neckY} L80,${hipY}`;

  return (
    <Svg width={160} height={190} opacity={opacity}>
      {/* 머리 */}
      <Circle cx={headX} cy={headY} r={17} stroke={colors.text} strokeWidth={3} fill="none" />
      <SvgText x={headX} y={headY + 6} fontSize={16} textAnchor="middle">
        {face}
      </SvgText>
      {/* 헤어밴드 (이번 주 4일 이상 운동) */}
      {state.headband && (
        <Path
          d={`M${headX - 15},${headY - 8} Q${headX},${headY - 17} ${headX + 15},${headY - 8}`}
          stroke={colors.danger}
          strokeWidth={5}
          fill="none"
        />
      )}

      {/* 어깨 */}
      <Line
        x1={headX - shoulderHalf}
        y1={neckY + 4}
        x2={headX + shoulderHalf}
        y2={neckY + 4}
        stroke={limbColor(partLevels.shoulders)}
        strokeWidth={limbWidth(partLevels.shoulders)}
        strokeLinecap="round"
      />

      {/* 몸통(등) */}
      <Path
        d={torso}
        stroke={limbColor(partLevels.back)}
        strokeWidth={limbWidth(partLevels.back)}
        strokeLinecap="round"
        fill="none"
      />
      {/* 가슴 */}
      {partLevels.chest > 0 && (
        <Ellipse
          cx={headX}
          cy={neckY + 18}
          rx={8 + partLevels.chest * 3}
          ry={7}
          fill={colors.primary}
          opacity={0.35}
        />
      )}
      {/* 코어(복근) */}
      {partLevels.core > 0 && (
        <Circle cx={80} cy={hipY - 18} r={4 + partLevels.core * 2} fill={colors.success} opacity={0.35} />
      )}

      {/* 팔 */}
      <Path d={leftArm} stroke={limbColor(partLevels.arms)} strokeWidth={limbWidth(partLevels.arms)} strokeLinecap="round" fill="none" />
      <Path d={rightArm} stroke={limbColor(partLevels.arms)} strokeWidth={limbWidth(partLevels.arms)} strokeLinecap="round" fill="none" />
      {/* 아령 (이번 주 30세트 이상) */}
      {state.dumbbell && armsUp && (
        <>
          <Line x1={headX + shoulderHalf + 6} y1={headY - 8} x2={headX + shoulderHalf + 22} y2={headY + 4} stroke={colors.textMuted} strokeWidth={3} />
          <Circle cx={headX + shoulderHalf + 6} cy={headY - 8} r={5} fill={colors.textMuted} />
          <Circle cx={headX + shoulderHalf + 22} cy={headY + 4} r={5} fill={colors.textMuted} />
        </>
      )}
      {state.dumbbell && !armsUp && (
        <>
          <Line x1={headX - shoulderHalf - 20} y1={hipY - 14} x2={headX - shoulderHalf - 4} y2={hipY - 14} stroke={colors.textMuted} strokeWidth={3} />
          <Circle cx={headX - shoulderHalf - 20} cy={hipY - 14} r={5} fill={colors.textMuted} />
          <Circle cx={headX - shoulderHalf - 4} cy={hipY - 14} r={5} fill={colors.textMuted} />
        </>
      )}

      {/* 다리 */}
      <Path d={leftLeg} stroke={limbColor(partLevels.legs)} strokeWidth={limbWidth(partLevels.legs)} strokeLinecap="round" fill="none" />
      <Path d={rightLeg} stroke={limbColor(partLevels.legs)} strokeWidth={limbWidth(partLevels.legs)} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// 부위별 레벨 게이지 (● ● ○)
export function PartGauges({ partLevels }: { partLevels: Record<MusclePart, number> }) {
  return (
    <View style={styles.gauges}>
      {MUSCLE_PARTS.map((part) => (
        <View key={part} style={styles.gaugeRow}>
          <Text style={styles.gaugeName}>{strings.partNames[part]}</Text>
          <View style={styles.gaugeDots}>
            {[1, 2, 3].map((level) => (
              <View
                key={level}
                style={[styles.dot, partLevels[part] >= level ? styles.dotOn : styles.dotOff]}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gauges: { gap: 8, flex: 1 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gaugeName: { color: colors.text, fontSize: 13 },
  gaugeDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: colors.primary },
  dotOff: { backgroundColor: colors.border },
});
