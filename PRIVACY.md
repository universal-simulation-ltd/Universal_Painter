# What Universal Painter does with your pictures

You landed here from the word **Guaranteed**, so this page owes you something
better than a privacy policy. It is written to be checked: every claim below
names the file in this repository that makes it true.

The short version: **your pictures are painted by your own browser.** There is
no upload, no server doing the work, and no account. This app has no button
that sends a picture anywhere.

---

## What happens to a picture

| Step | Where it happens | The code |
|---|---|---|
| Opening a PNG, JPEG or WebP | your browser's own decoder | [`src/lib/imageFiles.ts`](src/lib/imageFiles.ts) |
| Opening an iPhone HEIC | your browser, via libheif compiled to WebAssembly (`heic-to`), loaded only when you open one | [`src/lib/imageFiles.ts`](src/lib/imageFiles.ts) |
| Painting, selecting, undo | a canvas in the page | [`src/lib/doc.ts`](src/lib/doc.ts), [`src/lib/draw.ts`](src/lib/draw.ts), [`src/lib/pixels.ts`](src/lib/pixels.ts) |
| Saving as PNG or JPEG | your browser's download | [`src/lib/actions.ts`](src/lib/actions.ts) |

Nothing in that table is a network call. The picture lives in the tab you
opened it in, and it is gone when you close it (the page asks first if you have
unsaved changes). Copy and paste go through your own clipboard.

## What the app talks to a server for

If you open your browser's Network tab you will see a few requests:

- **The page itself**, its scripts and styles, from opensource.unisim.co.uk.
- **The changelog and update notice**, from changelog.unisim.co.uk.

There is **no account of its own**, and nothing here needs one (`noAccounts` in
[`src/main.tsx`](src/main.tsx)). If your browser is already signed in to the
suite (a Universal ID), the app recognises it so your suite-wide settings, such
as colour scheme and language, come with you, and Tune this app offers a
discreet Sign in; your pictures are never tied to it. There is no
usage tracking and no user count: the suite's anonymous daily open count is
switched off here (`openCount: false`). There is no analytics, no tracking pixel
and no advertising script. The Content-Security-Policy in
[`public/_headers`](public/_headers) lists every place the page may load from or
talk to.

Your settings (the Tune this app ticks, your colours and the view you like
pictures to open at) are kept in this browser only.

## How to prove it to yourself

**Turn off your Wi-Fi, open a picture and paint on it.** Once the page has
loaded it keeps working, and saving still works, because nothing needed the
network in the first place.

Questions: <inbox@unisim.co.uk>.
