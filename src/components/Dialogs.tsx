// The sheets that open over the canvas: the whole-picture menu, resize,
// canvas size, brightness and contrast, a new canvas and saving.
//
// One `Sheet` for all of them: a centred card on a computer, a sheet from the
// bottom on a phone. Esc, the backdrop and Cancel close it.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { doc } from '../lib/doc'
import { cropToSelection, newBlank, save, showFit } from '../lib/actions'
import { makeCanvas, MAX_PIXELS, stemOf, type SaveFormat } from '../lib/imageFiles'
import { brightnessContrast } from '../lib/pixels'
import { usePaintStore } from '../stores/paintStore'
import { useT } from '../i18n'
import { CanvasIcon, CropIcon, FlipHIcon, FlipVIcon, GreyIcon, InvertIcon, ResizeIcon, RotateLeftIcon, RotateRightIcon, SunIcon } from './icons'

// The QR library only downloads when someone asks for a code.
const QrDialog = lazy(() => import('./QrDialog'))

export default function Dialogs() {
  const dialog = usePaintStore((s) => s.dialog)
  const setDialog = usePaintStore((s) => s.setDialog)
  const close = () => setDialog(null)
  switch (dialog) {
    case 'image': return <PictureMenu onClose={close} />
    case 'resize': return <ResizeDialog onClose={close} />
    case 'canvas': return <CanvasDialog onClose={close} />
    case 'adjust': return <AdjustDialog onClose={close} />
    case 'new': return <NewDialog onClose={close} />
    case 'save': return <SaveDialog onClose={close} />
    case 'qr': return <Suspense fallback={null}><QrDialog onClose={close} /></Suspense>
    default: return null
  }
}

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    const first = ref.current?.querySelector<HTMLElement>('input, select, button[data-autofocus], button')
    first?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pt-sheet max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[26rem] sm:rounded-2xl dark:bg-slate-900"
      >
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

function PictureMenu({ onClose }: { onClose: () => void }) {
  const t = useT()
  const selection = usePaintStore((s) => s.selection)
  const setDialog = usePaintStore((s) => s.setDialog)
  const run = (fn: () => void) => () => { fn(); onClose() }
  const rows: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; hint?: string }[] = [
    { icon: <CropIcon />, label: t('picture.crop'), onClick: run(cropToSelection), disabled: !selection, hint: selection ? undefined : t('picture.crop_needs') },
    { icon: <ResizeIcon />, label: t('picture.resize'), onClick: () => setDialog('resize') },
    { icon: <CanvasIcon />, label: t('picture.canvas'), onClick: () => setDialog('canvas') },
    { icon: <RotateLeftIcon />, label: t('picture.rotate_left'), onClick: run(() => { doc.rotate(3); showFit() }) },
    { icon: <RotateRightIcon />, label: t('picture.rotate_right'), onClick: run(() => { doc.rotate(1); showFit() }) },
    { icon: <RotateRightIcon />, label: t('picture.rotate_180'), onClick: run(() => doc.rotate(2)) },
    { icon: <FlipHIcon />, label: t('picture.flip_h'), onClick: run(() => doc.flip(true)) },
    { icon: <FlipVIcon />, label: t('picture.flip_v'), onClick: run(() => doc.flip(false)) },
    { icon: <SunIcon />, label: t('picture.adjust'), onClick: () => setDialog('adjust') },
    { icon: <GreyIcon />, label: t('picture.greyscale'), onClick: run(() => doc.greyscale()) },
    { icon: <InvertIcon />, label: t('picture.invert'), onClick: run(() => doc.invert()) },
  ]
  return (
    <Sheet title={t('picture.title')} onClose={onClose} footer={<button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>{t('common.close')}</button>}>
      <p className="-mt-2 mb-3 text-xs text-slate-500 dark:text-slate-400">{t('picture.size_now', { w: doc.width, h: doc.height })}</p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.label}>
            <button
              type="button"
              onClick={r.onClick}
              disabled={r.disabled}
              title={r.hint}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-orange-50 hover:text-orange-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700 dark:text-slate-200 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
            >
              <span className="shrink-0 text-slate-500 dark:text-slate-400">{r.icon}</span>
              <span>{r.label}{r.hint && <span className="block text-[11px] text-slate-400">{r.hint}</span>}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

function NumberField({ label, value, onChange, suffix, min = 1, max = 16384 }: { label: string; value: number; onChange: (n: number) => void; suffix?: string; min?: number; max?: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      {label}
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Math.round(Number(e.target.value)))}
          className="pt-input w-full"
        />
        {suffix && <span className="text-slate-500">{suffix}</span>}
      </span>
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-orange-600" />
      {label}
    </label>
  )
}

function ResizeDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const ow = doc.width, oh = doc.height
  const [mode, setMode] = useState<'percent' | 'pixels'>('percent')
  // Unticked = keep the proportions (the suite's tick boxes start unticked).
  const [free, setFree] = useState(false)
  const [pw, setPw] = useState(100)
  const [ph, setPh] = useState(100)
  const [w, setW] = useState(ow)
  const [h, setH] = useState(oh)
  const target = mode === 'percent'
    ? { width: Math.max(1, Math.round((ow * pw) / 100)), height: Math.max(1, Math.round((oh * (free ? ph : pw)) / 100)) }
    : { width: Math.max(1, w), height: Math.max(1, h) }
  const tooBig = target.width * target.height > MAX_PIXELS || Math.max(target.width, target.height) > 16384
  const apply = () => {
    if (tooBig) return
    doc.resizeImage(target.width, target.height)
    showFit()
    onClose()
  }
  return (
    <Sheet
      title={t('dialogs.resize_title')}
      onClose={onClose}
      footer={<>
        <button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="pt-btn pt-btn-primary" disabled={tooBig} onClick={apply}>{t('common.apply')}</button>
      </>}
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t('dialogs.resize_lead')}</p>
      <div className="mb-3 inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600" role="radiogroup">
        {(['percent', 'pixels'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className="px-3 py-1.5 text-xs text-slate-700 aria-checked:bg-orange-600 aria-checked:text-white dark:text-slate-200">
            {t(m === 'percent' ? 'dialogs.percent' : 'dialogs.pixels')}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mode === 'percent' ? (
          <>
            <NumberField label={t('common.width')} value={pw} suffix="%" max={1000} onChange={(n) => { setPw(n); if (!free) setPh(n) }} />
            <NumberField label={t('common.height')} value={free ? ph : pw} suffix="%" max={1000} onChange={(n) => { setPh(n); if (!free) setPw(n) }} />
          </>
        ) : (
          <>
            <NumberField label={t('common.width')} value={w} suffix={t('common.px')} onChange={(n) => { setW(n); if (!free) setH(Math.max(1, Math.round((n * oh) / ow))) }} />
            <NumberField label={t('common.height')} value={h} suffix={t('common.px')} onChange={(n) => { setH(n); if (!free) setW(Math.max(1, Math.round((n * ow) / oh))) }} />
          </>
        )}
      </div>
      <Check label={t('dialogs.free')} checked={free} onChange={setFree} />
      <p className={`mt-3 text-xs ${tooBig ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {tooBig ? t('dialogs.too_big', { max: new Intl.NumberFormat(t.locale).format(MAX_PIXELS) }) : `${ow} × ${oh} → ${target.width} × ${target.height}`}
      </p>
    </Sheet>
  )
}

function CanvasDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const secondary = usePaintStore((s) => s.secondary)
  const [w, setW] = useState(doc.width)
  const [h, setH] = useState(doc.height)
  const [anchor, setAnchor] = useState(4)
  const [fillSecond, setFillSecond] = useState(false)
  const tooBig = w * h > MAX_PIXELS || Math.max(w, h) > 16384 || w < 1 || h < 1
  const apply = () => {
    if (tooBig) return
    doc.resizeCanvas(w, h, anchor, fillSecond ? secondary : null)
    showFit()
    onClose()
  }
  return (
    <Sheet
      title={t('dialogs.canvas_title')}
      onClose={onClose}
      footer={<>
        <button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="pt-btn pt-btn-primary" disabled={tooBig} onClick={apply}>{t('common.apply')}</button>
      </>}
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t('dialogs.canvas_lead')}</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={t('common.width')} value={w} suffix={t('common.px')} onChange={setW} />
        <NumberField label={t('common.height')} value={h} suffix={t('common.px')} onChange={setH} />
      </div>
      <p className="mb-1.5 mt-4 text-xs font-medium text-slate-600 dark:text-slate-300">{t('dialogs.anchor')}</p>
      <div className="grid w-28 grid-cols-3 gap-1" role="radiogroup" aria-label={t('dialogs.anchor')}>
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={anchor === i}
            aria-label={t('dialogs.anchor_cell', { n: i + 1 })}
            onClick={() => setAnchor(i)}
            className="h-8 rounded-md border border-slate-300 bg-white aria-checked:border-orange-600 aria-checked:bg-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:aria-checked:bg-orange-500"
          />
        ))}
      </div>
      <Check label={t('dialogs.fill_second')} checked={fillSecond} onChange={setFillSecond} />
      {tooBig && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{t('dialogs.too_big', { max: new Intl.NumberFormat(t.locale).format(MAX_PIXELS) })}</p>}
    </Sheet>
  )
}

function AdjustDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [b, setB] = useState(0)
  const [c, setC] = useState(0)
  const previewRef = useRef<HTMLCanvasElement>(null)
  // A small copy to preview on, so dragging a slider never touches the picture.
  const small = useMemo(() => {
    const src = doc.canvas
    if (!src) return null
    const k = Math.min(1, 360 / Math.max(src.width, src.height))
    const cv = makeCanvas(src.width * k, src.height * k)
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(src, 0, 0, cv.width, cv.height)
    return ctx.getImageData(0, 0, cv.width, cv.height)
  }, [])
  useEffect(() => {
    const p = previewRef.current
    if (!p || !small) return
    p.width = small.width
    p.height = small.height
    const copy = new ImageData(new Uint8ClampedArray(small.data), small.width, small.height)
    brightnessContrast(copy.data, b, c)
    p.getContext('2d')!.putImageData(copy, 0, 0)
  }, [small, b, c])
  const apply = () => {
    doc.brightnessContrast(b, c)
    onClose()
  }
  const slider = (label: string, v: number, set: (n: number) => void) => (
    <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      <span className="flex justify-between"><span>{label}</span><span className="tabular-nums">{v > 0 ? `+${v}` : v}</span></span>
      <input type="range" min={-100} max={100} value={v} onChange={(e) => set(Number(e.target.value))} className="pt-range w-full" />
    </label>
  )
  return (
    <Sheet
      title={t('dialogs.adjust_title')}
      onClose={onClose}
      footer={<>
        <button type="button" className="pt-btn pt-btn-ghost" onClick={() => { setB(0); setC(0) }}>{t('dialogs.reset')}</button>
        <button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="pt-btn pt-btn-primary" onClick={apply}>{t('common.apply')}</button>
      </>}
    >
      <div className="pt-checker flex justify-center overflow-hidden rounded-lg" style={{ backgroundSize: '16px 16px' }}>
        <canvas ref={previewRef} className="max-h-56 max-w-full" />
      </div>
      {slider(t('dialogs.brightness'), b, setB)}
      {slider(t('dialogs.contrast'), c, setC)}
    </Sheet>
  )
}

export const PRESETS = [
  { id: 'screen', w: 1280, h: 720 },
  { id: 'square', w: 1080, h: 1080 },
  { id: 'hd', w: 1920, h: 1080 },
  { id: 'a4', w: 2480, h: 3508 },
  { id: 'small', w: 640, h: 480 },
] as const

export function BlankForm({ onStarted, compact }: { onStarted?: () => void; compact?: boolean }) {
  const t = useT()
  const [w, setW] = useState(1280)
  const [h, setH] = useState(720)
  const [preset, setPreset] = useState<string>('screen')
  const tooBig = w * h > MAX_PIXELS || Math.max(w, h) > 16384 || w < 1 || h < 1
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!tooBig && newBlank(w, h)) onStarted?.() }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={preset === p.id}
            onClick={() => { setPreset(p.id); setW(p.w); setH(p.h) }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:border-orange-400 aria-checked:border-orange-600 aria-checked:bg-orange-50 aria-checked:text-orange-800 dark:border-slate-600 dark:text-slate-200 dark:aria-checked:bg-orange-500/15 dark:aria-checked:text-orange-200"
          >
            <span className="block font-medium">{t(`landing.preset_${p.id}`)}</span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">{p.w} × {p.h}</span>
          </button>
        ))}
      </div>
      <div className={`grid grid-cols-2 gap-3 ${compact ? '' : 'max-w-xs'}`}>
        <NumberField label={t('common.width')} value={w} suffix={t('common.px')} onChange={(n) => { setW(n); setPreset('custom') }} />
        <NumberField label={t('common.height')} value={h} suffix={t('common.px')} onChange={(n) => { setH(n); setPreset('custom') }} />
      </div>
      {tooBig && <p className="text-xs text-red-600 dark:text-red-400">{t('dialogs.too_big', { max: new Intl.NumberFormat(t.locale).format(MAX_PIXELS) })}</p>}
      <div>
        <button type="submit" disabled={tooBig} className="pt-btn pt-btn-primary">{t('landing.start')}</button>
      </div>
    </form>
  )
}

function NewDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <Sheet title={t('dialogs.new_title')} onClose={onClose} footer={<button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>}>
      <BlankForm compact onStarted={onClose} />
    </Sheet>
  )
}

function SaveDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [name, setName] = useState(doc.stem)
  const go = (format: SaveFormat) => { void save(format, stemOf(name.trim() || 'picture')); onClose() }
  return (
    <Sheet title={t('dialogs.save_title')} onClose={onClose} footer={<button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>}>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        {t('dialogs.file_name')}
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="pt-input" />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="pt-choice" onClick={() => go('image/png')}>
          <span className="font-semibold">PNG</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('dialogs.png_hint')}</span>
        </button>
        <button type="button" className="pt-choice" onClick={() => go('image/jpeg')}>
          <span className="font-semibold">JPEG</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('dialogs.jpeg_hint')}</span>
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('dialogs.save_local')}</p>
    </Sheet>
  )
}
