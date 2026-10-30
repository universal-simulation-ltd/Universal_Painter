// The picture's name and size in the middle of the bar. Click the name to
// rename it (the name it saves under); click the size to type a new canvas
// size. Enter or clicking away keeps the change, Esc drops it. The rename is
// Universal PDF's FileNameEditor (src/components/Header/FileNameEditor.tsx).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { doc } from '../../lib/doc'
import { setCanvasSize } from '../../lib/actions'
import { useT } from '../../i18n'

const CHIP = 'group inline-flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 border border-transparent transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100'
const FIELD = 'rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

export default function PictureTitle() {
  useSyncExternalStore(doc.subscribe, doc.getVersion)
  return (
    <span className="hidden min-w-0 items-center gap-0.5 text-xs text-slate-500 md:inline-flex dark:text-slate-400">
      <NameEditor />
      <span aria-hidden="true">·</span>
      <SizeEditor />
      {doc.dirty && <span aria-hidden="true">•</span>}
    </span>
  )
}

function Pencil() {
  return <span aria-hidden="true" className="text-[11px] opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60">✎</span>
}

function NameEditor() {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) ref.current?.select()
  }, [editing])

  if (editing) {
    const commit = () => { doc.rename(draft); setEditing(false) }
    return (
      <input
        ref={ref}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          else if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
        }}
        className={`${FIELD} w-48`}
        aria-label={t('app.rename')}
      />
    )
  }
  return (
    <button type="button" onClick={() => { setDraft(doc.stem); setEditing(true) }} title={t('app.rename_tip')} className={`${CHIP} max-w-[16rem]`}>
      <span className="truncate">{doc.stem}</span>
      <Pencil />
    </button>
  )
}

function SizeEditor() {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [w, setW] = useState('')
  const [h, setH] = useState('')
  const group = useRef<HTMLSpanElement>(null)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) first.current?.select()
  }, [editing])

  if (editing) {
    const commit = () => {
      const nw = Math.round(Number(w)), nh = Math.round(Number(h))
      if (Number.isFinite(nw) && Number.isFinite(nh) && !setCanvasSize(nw, nh)) return
      setEditing(false)
    }
    const keys = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      else if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
    }
    // Clicking from one box to the other is not clicking away.
    const blur = (e: React.FocusEvent) => { if (!group.current?.contains(e.relatedTarget as Node | null)) commit() }
    return (
      <span ref={group} className="inline-flex items-center gap-1" role="group" aria-label={t('app.size_edit')}>
        <input ref={first} autoFocus type="number" inputMode="numeric" min={1} value={w} onChange={(e) => setW(e.target.value)} onKeyDown={keys} onBlur={blur} className={`${FIELD} w-16 tabular-nums`} aria-label={t('common.width')} />
        <span aria-hidden="true">×</span>
        <input type="number" inputMode="numeric" min={1} value={h} onChange={(e) => setH(e.target.value)} onKeyDown={keys} onBlur={blur} className={`${FIELD} w-16 tabular-nums`} aria-label={t('common.height')} />
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => { setW(String(doc.width)); setH(String(doc.height)); setEditing(true) }}
      title={t('app.size_tip')}
      className={`${CHIP} tabular-nums`}
    >
      {doc.width} × {doc.height}
      <Pencil />
    </button>
  )
}
