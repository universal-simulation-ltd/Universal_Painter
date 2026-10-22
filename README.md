# Universal Painter

**Draw, or touch up a picture.** One canvas and the classic tools, in your
browser. Closer to Microsoft Paint than to Photoshop. Nothing is uploaded and
no account is needed.

Live at **[opensource.unisim.co.uk/painter](https://opensource.unisim.co.uk/painter)**.

---

## What it does

- **One canvas, no layers.** Start a blank canvas at a chosen size (or one of
  the presets), open a picture, or paste one.
- **Tools:** pencil (hard-edged, exact to the pixel), brush (soft and round,
  following Apple Pencil pressure), eraser (rubs out to see-through), fill
  bucket (with a spread setting), line, box and ellipse (outline, filled, or
  both), text, colour picker, and a 28-colour palette with a first and second
  colour, plus any colour from the system picker.
- **Select** a rectangle to move it (Alt/Option moves a copy), copy, cut,
  delete or **crop to it**. Paste a picture onto the canvas and move it into
  place.
- **The whole picture:** resize it (by percentage or pixels), change the canvas
  size (with an anchor), rotate left/right/180°, flip, and a few one-tap photo
  fixes: brightness and contrast, black and white, invert colours.
- **Undo and redo**, for every step, kept to a memory budget rather than a
  count (smaller on phones and tablets).
- **Zoom and pan** with whatever you have: pinch and two-finger drag on a touch
  screen, Ctrl/⌘ + scroll or a trackpad pinch, a scroll to pan, Space + drag or
  the middle button, the Move tool, and the zoom buttons. One finger draws;
  an Apple Pencil draws with pressure. Tick *Only a pen draws* in Tune this app
  and fingers only move and zoom.
- **Files:** opens PNG, JPEG, WebP and HEIC (iPhone photos); saves PNG or JPEG.
  A JPEG has no transparency, so see-through areas save as white.

Keyboard: `P` pencil, `B` brush, `E` eraser, `F` fill, `L` line, `R` box,
`O` ellipse, `T` text, `I` picker, `S` select, `H` move; Ctrl/⌘ + Z / Shift + Z
undo and redo, Ctrl/⌘ + C / X / V / A, Delete, Esc, Ctrl/⌘ + S save,
Ctrl/⌘ + 0 fit, Ctrl/⌘ + 1 actual size.

## Everything stays on your device

Pictures are opened, painted and saved by your own browser. There is no
upload, no server doing the work, no sign-in and no usage tracking. See
[PRIVACY.md](PRIVACY.md) for what that means and how to check it.

## Shared code with Universal Images

[Universal Images](https://github.com/universal-simulation-ltd/Universal_Images)
already resizes, crops and converts pictures. Rather than a shared package or a
link out to Images, Painter **copies** the parts Images has already proven on
real phones, each marked with its source file, so this app stays
self-contained:

| Here | From Universal Images |
|---|---|
| `src/lib/heicSniff.ts` | `src/lib/heicSniff.ts` (unchanged) |
| HEIC decoding (`heic-to`), the half-step downscale and the JPEG-on-white rule in `src/lib/imageFiles.ts` | `src/lib/imageResize.ts` |

Fix a bug in one, check the other.

## Running it

```sh
npm install
npm run dev          # http://localhost:5212
npm test             # pixel maths, translations, theme
npm run build
```

`./scripts/preview.sh` (or `.\scripts\preview.ps1` on Windows) does the
install and starts the dev server on the same port.

Built with Vite, React, TypeScript, Tailwind and
[`@unisim/sdk`](https://www.npmjs.com/package/@unisim/sdk) (the navigation bar,
Tune this app and the suite language). Translated into English, French,
Spanish, Italian, German, Portuguese (Brazil and Portugal) and Turkish
(`src/i18n/`).

It is served from Cloudflare Workers static assets (`wrangler.jsonc`); a push to
`main` deploys it.

## Licence

AGPL-3.0-or-later, with an additional permission for app store distribution.
See [LICENSE](LICENSE), [CONTRIBUTING.md](CONTRIBUTING.md) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Made by [James Markey MBE](https://www.jamesmarkey.co.uk) and the
[UNI·SIM team](https://www.unisim.co.uk).
