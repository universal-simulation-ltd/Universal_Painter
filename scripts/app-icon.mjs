#!/usr/bin/env node
// Painter's own installed-app icon — the suite's Jukebox-style family (James,
// 2026-10-10/11): its own theme colour, one close-up object, a touch of
// UNI·SIM orange, clear at 40 px, no lettering. An artist's palette on a deep
// blue ground, with its paints; the orange is one of them.
//
//   PLAYWRIGHT=../../backoffice/universal-platform/node_modules/playwright/index.mjs \
//     node scripts/app-icon.mjs
//
// The suite generator leaves this app's native icons alone (`ownNativeIcon`
// in backoffice/universal-platform/scripts/app-marks/marks.mjs). The website's
// favicon, the PWA icons and the suite switcher keep the orange suite mark:
// an app that only runs in a browser keeps the suite mark until it installs
// on a phone or a desktop.
//
// What it writes today: `store-assets/app-icon-1024.png` (the master), ready
// for the iOS/Android/desktop sets when a native shell is added. With
// `PREVIEW=<dir>` it renders the 1024 icon and a 40 px check there instead.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(process.env.PLAYWRIGHT).href : 'playwright')

/** The icon as SVG on a 1024 grid. */
function svg() {
  // The palette: a rounded blob with a thumb hole, tilted, in warm wood.
  const palette = 'M512 170c215 0 380 128 380 300 0 96-70 132-150 128-70-4-112 30-104 92 10 80-40 150-150 150-230 0-410-150-410-340S297 170 512 170Z'
  const blobs = [
    { cx: 300, cy: 330, r: 62, fill: '#e11d48' },
    { cx: 470, cy: 268, r: 62, fill: 'url(#orange)' },
    { cx: 640, cy: 300, r: 62, fill: '#facc15' },
    { cx: 250, cy: 520, r: 62, fill: '#16a34a' },
    { cx: 390, cy: 680, r: 58, fill: '#9333ea' },
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf3e1"/><stop offset="1" stop-color="#e9cfa3"/></linearGradient>
    <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fe8c01"/><stop offset="1" stop-color="#e05504"/></linearGradient>
    <linearGradient id="handle" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <path d="${palette}" fill="#000" fill-opacity="0.22" transform="translate(14 22)"/>
  <path d="${palette}" fill="url(#wood)"/>
  <circle cx="655" cy="520" r="58" fill="url(#bg)"/>
  ${blobs.map((b) => `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${b.fill}"/>`).join('\n  ')}
  <g transform="rotate(-40 760 760)">
    <rect x="560" y="725" width="420" height="58" rx="29" fill="#000" fill-opacity="0.22" transform="translate(10 16)"/>
    <rect x="640" y="725" width="340" height="58" rx="29" fill="url(#handle)"/>
    <rect x="560" y="717" width="96" height="74" rx="14" fill="#94a3b8"/>
    <path d="M560 718 C500 720 440 740 400 754 C440 768 500 788 560 790 Z" fill="url(#orange)"/>
  </g>
</svg>`
}

const browser = await chromium.launch()
async function png(size, art) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><style>html,body{margin:0;width:${size}px;height:${size}px}</style>${art}`)
  const buf = await page.screenshot()
  await page.close()
  return buf
}

if (process.env.PREVIEW) {
  mkdirSync(process.env.PREVIEW, { recursive: true })
  writeFileSync(path.join(process.env.PREVIEW, 'painter-icon-1024.png'), await png(1024, svg()))
  writeFileSync(path.join(process.env.PREVIEW, 'painter-icon-40.png'), await png(40, svg()))
  await browser.close()
  console.log(`Preview: ${process.env.PREVIEW}`)
  process.exit(0)
}

const out = path.join(root, 'store-assets', 'app-icon-1024.png')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, await png(1024, svg()))
await browser.close()
console.log(`Wrote ${path.relative(root, out)}`)
