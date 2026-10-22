// The row of tools. On a phone it scrolls sideways, and shows it: the last
// button that fits is cut in half at the edge, and the edge fades (BRANDING.md,
// "A row that scrolls shows it scrolls").
import { useRef, useSyncExternalStore } from 'react'
import { doc } from '../lib/doc'
import { redo, undo } from '../lib/actions'
import { useCutOffWidth, useScrollHint } from '../lib/scrollRow'
import { TOOLS, usePaintStore, type Tool } from '../stores/paintStore'
import { useT } from '../i18n'
import { PictureIcon, RedoIcon, SaveIcon, TOOL_ICONS, UndoIcon } from './icons'

const BASE = 64

export default function ToolRow() {
  const t = useT()
  useSyncExternalStore(doc.subscribe, doc.getVersion)
  const tool = usePaintStore((s) => s.tool)
  const setTool = usePaintStore((s) => s.setTool)
  const setDialog = usePaintStore((s) => s.setDialog)
  const hint = useScrollHint<HTMLDivElement>()
  const outer = useRef<HTMLDivElement>(null)
  // 2 history + 11 tools + Picture + Save, all one width.
  const width = useCutOffWidth(outer, BASE, TOOLS.length + 4)

  const pick = (next: Tool) => {
    if (next !== 'select' && doc.floating) doc.settle()
    setTool(next)
  }

  return (
    <div ref={outer} className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div ref={hint.ref} style={hint.style} className="pt-noscrollbar flex overflow-x-auto" role="toolbar" aria-label={t('tools.group')}>
        <Btn width={width} label={t('tools.undo')} title={`${t('tools.undo')} (Ctrl+Z)`} disabled={!doc.canUndo} onClick={undo} icon={<UndoIcon />} />
        <Btn width={width} label={t('tools.redo')} title={`${t('tools.redo')} (Ctrl+Shift+Z)`} disabled={!doc.canRedo} onClick={redo} icon={<RedoIcon />} />
        <span aria-hidden="true" className="my-2 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
        {TOOLS.map((id) => (
          <Btn
            key={id}
            width={width}
            label={t(`tools.${id}`)}
            title={t(`tools.${id}_tip`)}
            pressed={tool === id}
            onClick={() => pick(id)}
            icon={TOOL_ICONS[id]}
          />
        ))}
        <span aria-hidden="true" className="my-2 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
        <Btn width={width} label={t('tools.picture')} title={t('tools.picture_tip')} onClick={() => setDialog('image')} icon={<PictureIcon />} />
        <Btn width={width} label={t('tools.save')} title={t('tools.save')} onClick={() => setDialog('save')} icon={<SaveIcon />} accent />
      </div>
    </div>
  )
}

function Btn({
  width, label, title, icon, onClick, pressed, disabled, accent,
}: {
  width: number
  label: string
  title: string
  icon: React.ReactNode
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
  accent?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      onClick={onClick}
      style={{ width, minWidth: width }}
      className={[
        'pt-tool flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] leading-tight transition-colors',
        'disabled:cursor-default disabled:opacity-35',
        pressed
          ? 'bg-orange-50 text-orange-700 shadow-[inset_0_-2px_0_#e05504] dark:bg-orange-500/15 dark:text-orange-300'
          : accent
            ? 'text-orange-700 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-orange-500/10'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
      ].join(' ')}
    >
      {icon}
      <span className="line-clamp-2 max-w-full break-words text-center [hyphens:auto]">{label}</span>
    </button>
  )
}
