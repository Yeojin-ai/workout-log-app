// 앱 아이콘 생성기: assets/workout-log-icon2.png(완성된 정사각 타일, 검정 배경)에서
// 런처/어댑티브/파비콘 PNG를 뽑아낸다. 실행: node scripts/gen-icon.js  (레포 루트에서)
//
// splash-icon.png는 여기서 만들지 않는다 — 스플래시는 예전 졸라맨(icon1) 피규어를
// 그대로 유지하기로 했으므로 assets/splash-icon.png는 손대지 않는다.
const sharp = require('sharp');
const path = require('path');

const S = 1024;
const BLACK = '#000000'; // icon2 코너에 구워진 색 — 어댑티브 배경/배경색도 이 값(app.json)
const SRC = path.join(__dirname, '..', 'assets', 'workout-log-icon2.png');
const A = (name) => path.join(__dirname, '..', 'assets', name);

// 투명 캔버스 중앙에 scale 배율로 축소해 얹는다 (adaptive foreground/monochrome 안전영역용)
async function centered(buf, scale) {
  const size = Math.round(S * scale);
  const inner = await sharp(buf).resize(size, size).png().toBuffer();
  const off = Math.round((S - size) / 2);
  return sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left: off, top: off }])
    .png()
    .toBuffer();
}

// 검정 배경을 뺀 흰색 실루엣 (Android themed 아이콘용)
async function whiteSilhouette() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.max(data[i], data[i + 1], data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = m > 40 ? 255 : 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function write(buf, file, size = S) {
  await sharp(buf).resize(size, size).png().toFile(A(file));
  console.log('wrote', file);
}

(async () => {
  const tile = await sharp(SRC).resize(S, S).png().toBuffer();
  await write(tile, 'icon.png'); // iOS/일반 (OS가 모서리 마스크)
  await write(tile, 'favicon.png', 96);
  await write(
    await sharp({ create: { width: S, height: S, channels: 4, background: BLACK } }).png().toBuffer(),
    'android-icon-background.png'
  );
  await write(await centered(tile, 0.82), 'android-icon-foreground.png');
  await write(await centered(await whiteSilhouette(), 0.72), 'android-icon-monochrome.png');
})();
