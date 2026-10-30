// Put a QR code on the canvas: type a link (or any text), pick a size, and it
// lands as a paste, so it can be dragged, and picked up again later with Select.
//
// The code itself is drawn by @unisim/qr, the same renderer as Universal QR and
// Universal PDF, in its default suite look. Lazy-loaded (Dialogs.tsx), so the
// QR library is only downloaded when someone asks for a code.
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_DESIGN, renderQrCanvas, type QrDesign } from '@unisim/qr'
import { floatPicture } from '../lib/actions'
import { usePaintStore } from '../stores/paintStore'
import { useT } from '../i18n'
import { Sheet } from './Dialogs'

const SIZES = [256, 512, 1024] as const

function design(data: string, size: number): QrDesign {
  return { ...DEFAULT_DESIGN, data, size, name: '' }
}

export default function QrDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [size, setSize] = useState<(typeof SIZES)[number]>(512)
  const [busy, setBusy] = useState(false)
  const preview = useRef<HTMLDivElement>(null)
  const data = text.trim()

  // A small live preview, redrawn as they type.
  useEffect(() => {
    const host = preview.current
    if (!host) return
    if (!data) { host.replaceChildren(); return }
    let live = true
    const id = window.setTimeout(() => {
      renderQrCanvas(design(data, 320), 320)
        .then((c) => {
          if (!live) return
          c.className = 'h-40 w-40'
          host.replaceChildren(c)
        })
        .catch(() => { if (live) host.replaceChildren() })
    }, 150)
    return () => { live = false; clearTimeout(id) }
  }, [data])

  const place = async () => {
    if (!data || busy) return
    setBusy(true)
    try {
      floatPicture(await renderQrCanvas(design(data, size), size))
      onClose()
    } catch (e) {
      usePaintStore.getState().notify(e instanceof Error ? e.message : String(e), 'error')
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={t('qr.title')}
      onClose={onClose}
      footer={<>
        <button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="pt-btn pt-btn-primary" disabled={!data || busy} onClick={() => void place()}>{t('qr.place')}</button>
      </>}
    >
      <form onSubmit={(e) => { e.preventDefault(); void place() }}>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {t('qr.data')}
          <input type="text" inputMode="url" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://" className="pt-input" />
        </label>
      </form>
      <p className="mb-1.5 mt-4 text-xs font-medium text-slate-600 dark:text-slate-300">{t('qr.size')}</p>
      <div role="radiogroup" aria-label={t('qr.size')} className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
        {SIZES.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={size === n}
            onClick={() => setSize(n)}
            className="px-3 py-1.5 text-xs tabular-nums text-slate-700 aria-checked:bg-orange-600 aria-checked:text-white dark:text-slate-200"
          >
            {n} × {n}
          </button>
        ))}
      </div>
      <div className="mt-4 flex h-40 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/60">
        <div ref={preview} aria-hidden="true" />
        {!data && <span className="text-xs text-slate-400">{t('qr.empty')}</span>}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('qr.hint')}</p>
    </Sheet>
  )
}
