// The second row: what the chosen tool can be set to, then the two colours and
// the palette. A swatch tap sets the first colour; a right-click or a long
// press sets the second, as in Paint.
import { useRef, useSyncExternalStore } from 'react'
import { doc } from '../lib/doc'
import { copySelection, cropToSelection, cutSelection, deleteSelection, deselect, pasteFromButton, selectAll } from '../lib/actions'
import { useScrollHint } from '../lib/scrollRow'
import { PALETTE, sizeKey, usePaintStore, type ShapeStyle } from '../stores/paintStore'
import { useT } from '../i18n'
import { CopyIcon, CropIcon, CutIcon, PasteIcon, SwapIcon, TrashIcon } from './icons'

const SIZE_MAX = { pencil: 16, brush: 120, eraser: 200, shape: 60 } as const

export default function OptionsRow() {
  const t = useT()
  useSyncExternalStore(doc.subscribe, doc.getVersion)
  const s = usePaintStore()
  const key = sizeKey(s.tool)
  const hint = useScrollHint<HTMLDivElement>()

  let context: React.ReactNode = null
  if (key) {
    context = (
      <>
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('options.size')}</span>
          <input
            type="range"
            min={1}
            max={SIZE_MAX[key]}
            value={s.sizes[key]}
            onChange={(e) => s.setSize(key, Number(e.target.value))}
            className="pt-range w-28 sm:w-36"
            aria-valuetext={`${s.sizes[key]} ${t('common.px')}`}
          />
          <span className="w-12 text-xs tabular-nums text-slate-600 dark:text-slate-300">{s.sizes[key]} {t('common.px')}</span>
        </label>
        {(s.tool === 'box' || s.tool === 'ellipse') && (
          <Segmented<ShapeStyle>
            label={t('options.style')}
            value={s.shapeStyle}
            onChange={s.setShapeStyle}
            options={[
              { value: 'outline', label: t('options.style_outline') },
              { value: 'fill', label: t('options.style_fill') },
              { value: 'both', label: t('options.style_both') },
            ]}
          />
        )}
        {s.tool === 'eraser' && <Hint>{t('options.eraser_hint')}</Hint>}
      </>
    )
  } else if (s.tool === 'fill') {
    context = (
      <>
        <label className="flex items-center gap-2" title={t('options.spread_tip')}>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('options.spread')}</span>
          <input type="range" min={0} max={100} value={s.tolerance} onChange={(e) => s.setTolerance(Number(e.target.value))} className="pt-range w-28 sm:w-36" />
          <span className="w-10 text-xs tabular-nums text-slate-600 dark:text-slate-300">{s.tolerance}%</span>
        </label>
        <Hint>{t('options.fill_hint')}</Hint>
      </>
    )
  } else if (s.tool === 'text') {
    context = (
      <>
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('options.text_size')}</span>
          <input type="range" min={8} max={240} value={s.fontSize} onChange={(e) => s.setFontSize(Number(e.target.value))} className="pt-range w-28 sm:w-36" />
          <span className="w-12 text-xs tabular-nums text-slate-600 dark:text-slate-300">{s.fontSize} {t('common.px')}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={s.bold} onChange={(e) => s.setBold(e.target.checked)} className="h-4 w-4 accent-orange-600" />
          <span className="font-bold">{t('options.bold')}</span>
        </label>
        <button type="button" className="pt-btn pt-btn-soft" onClick={() => window.dispatchEvent(new Event('painter:commit-text'))}>
          {t('common.done')}
        </button>
        <Hint>{t('options.text_hint')}</Hint>
      </>
    )
  } else if (s.tool === 'picker') {
    context = <Hint>{t('options.picker_hint')}</Hint>
  } else if (s.tool === 'hand') {
    context = <Hint>{t('options.hand_hint')}</Hint>
  } else if (s.tool === 'select') {
    const sel = s.selection
    context = (
      <>
        {sel ? (
          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{t('options.selected', { w: sel.width, h: sel.height })}</span>
        ) : (
          <Hint>{t('options.select_hint')}</Hint>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <SmallBtn icon={<CopyIcon />} label={t('options.copy')} disabled={!sel} onClick={() => void copySelection()} />
          <SmallBtn icon={<CutIcon />} label={t('options.cut')} disabled={!sel} onClick={() => void cutSelection()} />
          <SmallBtn icon={<TrashIcon />} label={t('options.delete')} disabled={!sel} onClick={deleteSelection} />
          <SmallBtn icon={<CropIcon />} label={t('options.crop')} disabled={!sel} onClick={cropToSelection} />
          <SmallBtn icon={<PasteIcon />} label={t('options.paste')} onClick={() => void pasteFromButton()} />
          <SmallBtn label={t('options.select_all')} onClick={selectAll} />
          {sel && <SmallBtn label={t('options.deselect')} onClick={deselect} />}
        </div>
        {sel && <Hint>{t('options.move_hint')}</Hint>}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 lg:flex-row lg:items-center lg:gap-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex min-h-9 flex-1 flex-wrap items-center gap-x-4 gap-y-2">{context}</div>
      <div className="flex min-w-0 items-center gap-3">
        <Colours />
        <div ref={hint.ref} style={hint.style} className="pt-noscrollbar min-w-0 flex-1 overflow-x-auto lg:flex-none">
          <div className="grid w-max grid-flow-col grid-rows-2 gap-1" role="listbox" aria-label={t('options.colour_hint')}>
            {PALETTE.map((hex) => (
              <Swatch key={hex} hex={hex} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Colours() {
  const t = useT()
  const primary = usePaintStore((s) => s.primary)
  const secondary = usePaintStore((s) => s.secondary)
  const setPrimary = usePaintStore((s) => s.setPrimary)
  const setSecondary = usePaintStore((s) => s.setSecondary)
  const swap = usePaintStore((s) => s.swapColours)
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className="relative h-11 w-11">
        <label className="absolute left-0 top-0 h-7 w-7 cursor-pointer rounded-md border-2 border-white shadow ring-1 ring-slate-300 dark:border-slate-900 dark:ring-slate-600" style={{ background: primary, zIndex: 1 }} title={t('options.primary')}>
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="sr-only" aria-label={t('options.primary')} />
        </label>
        <label className="absolute bottom-0 right-0 h-7 w-7 cursor-pointer rounded-md border-2 border-white shadow ring-1 ring-slate-300 dark:border-slate-900 dark:ring-slate-600" style={{ background: secondary, zIndex: 0 }} title={t('options.secondary')}>
          <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="sr-only" aria-label={t('options.secondary')} />
        </label>
      </div>
      <button type="button" onClick={swap} title={t('options.swap')} aria-label={t('options.swap')} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
        <SwapIcon />
      </button>
    </div>
  )
}

function Swatch({ hex }: { hex: string }) {
  const t = useT()
  const setPrimary = usePaintStore((s) => s.setPrimary)
  const setSecondary = usePaintStore((s) => s.setSecondary)
  const primary = usePaintStore((s) => s.primary)
  const timer = useRef<number | null>(null)
  const long = useRef(false)
  return (
    <button
      type="button"
      role="option"
      aria-selected={primary.toLowerCase() === hex}
      title={t('options.colour_set', { hex })}
      aria-label={t('options.colour_set', { hex })}
      onClick={() => { if (!long.current) setPrimary(hex); long.current = false }}
      onContextMenu={(e) => { e.preventDefault(); setSecondary(hex) }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return
        long.current = false
        timer.current = window.setTimeout(() => { long.current = true; setSecondary(hex) }, 500)
      }}
      onPointerUp={() => { if (timer.current) clearTimeout(timer.current) }}
      onPointerLeave={() => { if (timer.current) clearTimeout(timer.current) }}
      className="h-5 w-5 rounded-[5px] ring-1 ring-slate-300 transition-transform hover:scale-110 aria-selected:ring-2 aria-selected:ring-orange-500 dark:ring-slate-600"
      style={{ background: hex, touchAction: 'manipulation' }}
    />
  )
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-100 aria-checked:bg-orange-600 aria-checked:text-white dark:text-slate-200 dark:hover:bg-slate-800 dark:aria-checked:bg-orange-500"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SmallBtn({ icon, label, onClick, disabled }: { icon?: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-orange-400 hover:text-orange-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-orange-300"
    >
      {icon}
      {label}
    </button>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-slate-500 dark:text-slate-400">{children}</span>
}
