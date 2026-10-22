// Zoom, over the bottom-right of the canvas. Fit and 100% are a view row:
// double-tap either to make it how pictures open (the suite rule, 2026-09-30),
// and the same choice sits in Tune this app ▸ "Pictures open at".
import { useDefaultView } from '@unisim/sdk'
import { OPENS_AT_ROW, showActual, showFit, zoomBy, type OpensAt } from '../lib/actions'
import { usePaintStore } from '../stores/paintStore'
import { useT } from '../i18n'
import { MinusIcon, PlusIcon } from './icons'

const VIEWS = ['fit', 'actual'] as const

export default function ZoomControls() {
  const t = useT()
  const zoom = usePaintStore((s) => s.zoom)
  const dv = useDefaultView<OpensAt>(OPENS_AT_ROW, 'fit', { views: VIEWS })
  const pct = Math.round(zoom * 100)

  const view = (id: OpensAt, label: string, tip: string, run: () => void) => {
    const props = dv.buttonProps(id, label)
    return (
      <button
        type="button"
        {...props}
        title={`${tip}. ${props.title}`}
        onClick={() => { dv.tap(id); run() }}
        className="pt-zoombtn rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 data-[default-view=true]:text-orange-700 data-[default-view=true]:ring-1 data-[default-view=true]:ring-orange-500 dark:text-slate-200 dark:hover:bg-slate-800 dark:data-[default-view=true]:text-orange-300"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <button type="button" onClick={() => zoomBy(1 / 1.25)} title={t('zoom.zoom_out')} aria-label={t('zoom.zoom_out')} className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
        <MinusIcon />
      </button>
      <span className="w-12 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300" aria-live="polite" aria-label={t('zoom.level', { pct })}>{pct}%</span>
      <button type="button" onClick={() => zoomBy(1.25)} title={t('zoom.zoom_in')} aria-label={t('zoom.zoom_in')} className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
        <PlusIcon />
      </button>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      {view('fit', t('zoom.fit'), t('zoom.fit_tip'), showFit)}
      {view('actual', t('zoom.actual'), t('zoom.actual_tip'), showActual)}
    </div>
  )
}
