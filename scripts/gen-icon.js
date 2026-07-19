// 앱 아이콘 생성기: assets/workout-log-icon.png(검정 배경이 구워진 1024px 원본)에서
// 모든 PNG 변형을 뽑아낸다. 실행: node scripts/gen-icon.js  (레포 루트에서)
const sharp = require('sharp');
const path = require('path');

const S = 1024;
const BLACK = '#000000'; // 원본에 구워진 배경색 — 어댑티브 배경도 이 색으로 맞춘다
const SRC = path.join(__dirname, '..', 'assets', 'workout-log-icon.png');
const A = (name) => path.join(__dirname, '..', 'assets', name);

// 우측 하단 ✨ 장식 영역(대략 x/y 820~1000)을 배경색으로 지운다
const SPARKLE = { left: 820, top: 820, width: 204, height: 204 };

async function cleanedSource() {
  return sharp(SRC)
    .composite([
      {
        input: { create: { width: SPARKLE.width, height: SPARKLE.height, channels: 4, background: BLACK } },
        left: SPARKLE.left,
        top: SPARKLE.top,
      },
    ])
    .png()
    .toBuffer();
}

// 검정 배경을 루마 키잉으로 걷어내 투명 배경 피규어를 만든다.
// alpha = clamp((max(r,g,b) - LO) / RAMP) — 경계는 부드럽게, 어두운 보라 외곽선은 살린다.
async function keyOutBlack(buf) {
  const LO = 10;
  const RAMP = 30;
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.max(data[i], data[i + 1], data[i + 2]);
    data[i + 3] = Math.max(0, Math.min(255, Math.round(((m - LO) / RAMP) * 255)));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// 투명 피규어를 흰색 실루엣으로 (Android 테마 아이콘용)
async function toWhite(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = 255;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// 1024 캔버스 중앙에 scale 배율로 축소해 얹는다 (배경 투명 or 지정색)
async function centered(buf, scale, background) {
  const size = Math.round(S * scale);
  const inner = await sharp(buf).resize(size, size).png().toBuffer();
  const off = Math.round((S - size) / 2);
  return sharp({ create: { width: S, height: S, channels: 4, background } })
    .composite([{ input: inner, left: off, top: off }])
    .png()
    .toBuffer();
}

async function write(buf, file, size = S) {
  await sharp(buf).resize(size, size).png().toFile(A(file));
  console.log('wrote', file);
}

(async () => {
  const clean = await cleanedSource();
  const keyed = await keyOutBlack(clean);

  // iOS/일반 아이콘: 원본 그대로 풀블리드 (OS가 모서리를 둥글게 마스크)
  await write(clean, 'icon.png');
  await write(clean, 'favicon.png', 96);

  // 스플래시: 투명 배경 피규어 — 전체 배경색은 app.json expo-splash-screen 플러그인이 담당
  // (Android 12+는 스플래시 이미지를 원형으로 마스킹하므로 배경을 구우면 원판이 보인다)
  await write(keyed, 'splash-icon.png');

  // 적응형 전경: 피규어가 안전영역(중앙 지름 66/108)에 들어오도록 축소. 배경은 별도 레이어.
  await write(await centered(keyed, 0.85, { r: 0, g: 0, b: 0, alpha: 0 }), 'android-icon-foreground.png');
  await write(
    await sharp({ create: { width: S, height: S, channels: 4, background: BLACK } }).png().toBuffer(),
    'android-icon-background.png'
  );
  await write(await centered(await toWhite(keyed), 0.85, { r: 0, g: 0, b: 0, alpha: 0 }), 'android-icon-monochrome.png');
})();
