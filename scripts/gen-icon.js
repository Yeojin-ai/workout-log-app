// 네온 졸라맨 앱 아이콘 생성기. SVG를 만들어 sharp로 PNG로 렌더한다.
// 실행: node scripts/gen-icon.js  (레포 루트에서)
const sharp = require('sharp');
const path = require('path');

const S = 1024;
const DARK = '#0B0B0F';
const NEON = '#7B79FF'; // 밝은 인디고 (네온)
const GLOW = '#5E5CE6'; // 앱 primary
const BAND = '#FF5C5C'; // 헤어밴드
const PLATE = '#D4D4E0'; // 아령
const CX = 512;

// 굵은 획 하나를 글로우(뒤에 흐린 넓은 획 2겹) + 본선으로 그린다.
function glowStroke(d, width, color = NEON, glow = GLOW) {
  return `
    <path d="${d}" fill="none" stroke="${glow}" stroke-width="${width + 30}" stroke-linecap="round" stroke-linejoin="round" opacity="0.16"/>
    <path d="${d}" fill="none" stroke="${glow}" stroke-width="${width + 14}" stroke-linecap="round" stroke-linejoin="round" opacity="0.30"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function glowCircle(cx, cy, r, width, color = NEON, glow = GLOW) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${glow}" stroke-width="${width + 30}" opacity="0.16"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${glow}" stroke-width="${width + 14}" opacity="0.30"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

// 아령: 손 지점에 45° 바 + 양끝 원판
function dumbbell(x, y) {
  const dx = 30,
    dy = 18;
  return `
    <line x1="${x - dx}" y1="${y - dy}" x2="${x + dx}" y2="${y + dy}" stroke="${PLATE}" stroke-width="14" stroke-linecap="round"/>
    <circle cx="${x - dx}" cy="${y - dy}" r="22" fill="${PLATE}"/>
    <circle cx="${x + dx}" cy="${y + dy}" r="22" fill="${PLATE}"/>`;
}

// 만세 포즈 히어로 졸라맨 (mono=true면 단색 흰색 실루엣)
function figure(mono = false) {
  const c = mono ? '#FFFFFF' : NEON;
  const g = mono ? '#FFFFFF' : GLOW;
  const stroke = (d, w) => (mono ? `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` : glowStroke(d, w, c, g));
  const circ = (cx, cy, r, w) => (mono ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${w}"/>` : glowCircle(cx, cy, r, w, c, g));

  const headCY = 300;
  const headR = 74;
  const shoulderY = 452;
  const shoulderHalf = 150;
  const hipY = 660;

  return `
    <g>
      ${circ(CX, headCY, headR, 26)}
      ${!mono ? `<path d="M ${CX - 52},${headCY - 46} Q ${CX},${headCY - 86} ${CX + 52},${headCY - 46}" fill="none" stroke="${BAND}" stroke-width="22" stroke-linecap="round"/>` : ''}
      <circle cx="${CX - 26}" cy="${headCY + 4}" r="9" fill="${c}"/>
      <circle cx="${CX + 26}" cy="${headCY + 4}" r="9" fill="${c}"/>
      ${stroke(`M ${CX},${headCY + headR} L ${CX},${shoulderY}`, 26)}
      ${stroke(`M ${CX - shoulderHalf},${shoulderY} L ${CX + shoulderHalf},${shoulderY}`, 30)}
      ${stroke(`M ${CX},${shoulderY} L ${CX},${hipY}`, 30)}
      ${stroke(`M ${CX - shoulderHalf + 8},${shoulderY + 4} L ${CX - 232},${headCY + 2}`, 28)}
      ${stroke(`M ${CX + shoulderHalf - 8},${shoulderY + 4} L ${CX + 232},${headCY + 2}`, 28)}
      ${!mono ? dumbbell(CX - 232, headCY + 2) + dumbbell(CX + 232, headCY + 2) : ''}
      ${stroke(`M ${CX},${hipY} L ${CX - 118},${hipY + 200}`, 30)}
      ${stroke(`M ${CX},${hipY} L ${CX + 118},${hipY + 200}`, 30)}
    </g>`;
}

// 적응형 아이콘 전경: 투명 배경 + 안전영역 고려해 축소한 졸라맨
function svgForeground(mono = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <g transform="translate(${CX} 540) scale(0.62) translate(${-CX} -540)">
      ${figure(mono)}
    </g>
  </svg>`;
}

function svgBackground() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${DARK}"/></svg>`;
}

const A = (name) => path.join(__dirname, '..', 'assets', name);

async function render(svg, file, size = S) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(A(file));
  console.log('wrote', file);
}

(async () => {
  // iOS/일반 아이콘: 다크 사각형 + 네온 졸라맨 (풀블리드, OS가 모서리 둥글게 마스크)
  // 작은 크기 가독성을 위해 살짝 축소해 여백을 준다.
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="${DARK}"/><g transform="translate(${CX} 540) scale(0.84) translate(${-CX} -540)">${figure(false)}</g></svg>`;
  await render(full, 'icon.png');
  await render(full, 'splash-icon.png');
  await render(full, 'favicon.png', 96);
  await render(svgForeground(false), 'android-icon-foreground.png');
  await render(svgBackground(), 'android-icon-background.png');
  await render(svgForeground(true), 'android-icon-monochrome.png');
})();
