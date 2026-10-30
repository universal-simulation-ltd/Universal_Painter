// The second row: what the chosen tool can be set to. (The two colours live in
// the tool row, left of Pencil; the 28-swatch palette was dropped, James
// 2026-10-30: each colour opens the system picker instead.)
//
// The tool's options start under the tool's own button (James, 2026-10-30),
// slid back left only as far as they need to fit.
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { doc } from '../lib/doc'
import { copySelection, cropToSelection, cutSelection, deleteSelection, deselect, pasteFromButton, selectAll } from '../lib/actions'
import { sizeKey, usePaintStore, type ShapeStyle, type Tool } from '../stores/paintStore'
import { useT } from '../i18n'
import { CopyIcon, CropIcon, CutIcon, PasteIcon, TrashIcon } from './icons'

const SIZE_MAX = { pencil: 16, brush: 120, eraser: 200, shape: 60 } as const

export default function OptionsRow() {
  const t = useT()
  useSyncExternalStore(doc.subscribe, doc.getVersion)
  const s = usePaintStore()
  const key = sizeKey(s.tool)
  const under = useUnderTool(s.tool)

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
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
      <div ref={under.box} className="flex min-h-9 min-w-0 items-center">
        <div ref={under.inner} data-tool-options style={{ marginLeft: under.offset }} className="flex w-max shrink-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2">{context}</div>
      </div>
    </div>
  )
}

/**
 * How far in the options start: level with the chosen tool's button in the
 * row above (found by its `data-tool`), but never so far that they would run
 * past the room they have. Follows the tool row's sideways scroll on a phone.
 */
function useUnderTool(tool: Tool) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  useLayoutEffect(() => {
    const b = box.current, i = inner.current
    if (!b || !i) return
    const measure = () => {
      const btn = document.querySelector<HTMLElement>(`[data-tool="${tool}"]`)
      if (!btn) { setOffset(0); return }
      const want = btn.getBoundingClientRect().left - b.getBoundingClientRect().left
      setOffset(Math.round(Math.max(0, Math.min(b.clientWidth - i.offsetWidth, want))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(b)
    ro.observe(i)
    const row = document.querySelector('[data-tool-row]')
    row?.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro.disconnect()
      row?.removeEventListener('scroll', measure)
    }
  }, [tool])
  return { box, inner, offset }
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
