import { useEffect, useSyncExternalStore } from 'react'
import { DropAnywhere, UniversalAppsNavBar, UpdateNotice, useFileDrop, type AboutAppConfig } from '@unisim/sdk'
// Generated — `npm run credits` after any dependency change. Never by hand.
import credits from './generated/credits.json'
import ProductLogo from './components/Header/ProductLogo'
import AppMenu, { TuneRows } from './components/AppMenu'
import PictureTitle from './components/Header/PictureTitle'
import Editor from './components/Editor'
import ToolRow from './components/ToolRow'
import OptionsRow from './components/OptionsRow'
import ZoomControls from './components/ZoomControls'
import Dialogs from './components/Dialogs'
import { doc } from './lib/doc'
import { closePicture, copySelection, cropToSelection, cutSelection, deleteSelection, deselect, openFiles, pasteFromEvent, redo, selectAll, showActual, showFit, startBlank, undo, zoomBy } from './lib/actions'
import { CONTAINER, EDITOR_CONTAINER, REPO_URL } from './lib/layout'
import { usePaintStore, type Tool } from './stores/paintStore'
import { useSettings } from './stores/settingsStore'
import { useThemeStore } from './stores/themeStore'
import { useT } from './i18n'

// "About this app" and "Reset to defaults" sit at the foot of Tune this app.
const ABOUT: AboutAppConfig = {
  repo: REPO_URL,
  proof: `${REPO_URL}/blob/main/PRIVACY.md`,
  subject: 'Your images',
  plural: true,
  version: __APP_VERSION__,
  credits,
  noticesHref: `${REPO_URL}/blob/main/THIRD-PARTY-NOTICES.md`,
}

const KEY_TOOLS: Record<string, Tool> = {
  p: 'pencil', b: 'brush', e: 'eraser', f: 'fill', g: 'fill', l: 'line', r: 'box', o: 'ellipse', t: 'text', i: 'picker', s: 'select', m: 'select', h: 'hand',
}

export default function App() {
  const t = useT()
  const theme = useThemeStore((s) => s.effective)
  useSyncExternalStore(doc.subscribe, doc.getVersion)
  const open = !!doc.surface
  const notice = usePaintStore((s) => s.notice)

  // Reset to defaults: the tools, colours and sizes, and the Tune this app
  // ticks. (The SDK clears the default views, language and colour scheme.)
  const resetDefaults = () => {
    usePaintStore.getState().resetTools()
    useSettings.getState().reset()
  }

  // Painter opens straight onto a blank Full HD canvas, shown whole: no start
  // page (James, 2026-10-30). Open, paste and drop all work from there, and
  // a picture opened onto the untouched canvas replaces it.
  useEffect(() => { if (!doc.surface) startBlank() }, [open])

  // A picture dropped anywhere on the open editor is pasted in, as Paint does.
  // The start page has its own page-wide zone (the drop circle).
  const pageDrop = useFileDrop({ onFiles: (files) => openFiles(files), clickToBrowse: false, pageWide: true, disabled: !open })

  // Paste, and the keyboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => void pasteFromEvent(e)
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return
      if (!doc.surface || usePaintStore.getState().dialog) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (mod && k === 'y') { e.preventDefault(); redo(); return }
      if (mod && k === 'c') { if (usePaintStore.getState().selection) { e.preventDefault(); void copySelection() } return }
      if (mod && k === 'x') { if (usePaintStore.getState().selection) { e.preventDefault(); void cutSelection() } return }
      if (mod && k === 'a') { e.preventDefault(); selectAll(); return }
      if (mod && k === 's') { e.preventDefault(); usePaintStore.getState().setDialog('save'); return }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBy(1.25); return }
      if (mod && k === '-') { e.preventDefault(); zoomBy(1 / 1.25); return }
      if (mod && k === '0') { e.preventDefault(); showFit(); return }
      if (mod && k === '1') { e.preventDefault(); showActual(); return }
      if (mod || e.altKey) return
      if (k === 'delete' || k === 'backspace') { if (usePaintStore.getState().selection) { e.preventDefault(); deleteSelection() } return }
      if (k === 'escape') { deselect(); return }
      if (k === 'enter') { if (doc.floating) { doc.settle() } return }
      if (k === '+' || k === '=') { zoomBy(1.25); return }
      if (k === '-') { zoomBy(1 / 1.25); return }
      const tool = KEY_TOOLS[k]
      if (tool) {
        if (tool !== 'select' && doc.floating) doc.settle()
        usePaintStore.getState().setTool(tool)
      }
    }
    // Leaving with unsaved work: the browser asks.
    const onUnload = (e: BeforeUnloadEvent) => { if (doc.surface && doc.dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  // Crop is also a keyboard-free button in the Picture sheet; this keeps
  // Ctrl+Shift+X (Paint's own) working too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x' && usePaintStore.getState().selection) {
        e.preventDefault()
        cropToSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    // ⚠️ pt-[env(safe-area-inset-top)] keeps the bar clear of a notch in a
    // full-screen web app; 0 in a normal browser tab.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100 pt-[env(safe-area-inset-top)] dark:bg-slate-950">
      <UniversalAppsNavBar
        product="painter"
        theme={theme}
        productLogo={<ProductLogo />}
        productHomeHref={import.meta.env.BASE_URL}
        // With a picture open the identity cluster becomes a home button, as in
        // Universal PDF and Images: back to a fresh blank canvas (asking first
        // if there are unsaved changes).
        onHome={open ? () => { closePicture() } : undefined}
        centre={open ? <PictureTitle /> : undefined}
        actions={<AppMenu />}
        actionsLabel={t('menu.label')}
        themeStore={useThemeStore}
        appPreferences={<TuneRows />}
        onResetDefaults={resetDefaults}
        about={ABOUT}
        suiteSwitcherIconSrc={`${import.meta.env.BASE_URL}unisim-icon.png`}
        contentClassName={open ? EDITOR_CONTAINER : CONTAINER}
      />

      <div className={`${open ? EDITOR_CONTAINER : CONTAINER} empty:hidden`}>
        <UpdateNotice />
      </div>

      {open ? (
        <>
          <ToolRow />
          <OptionsRow />
          <main className="relative min-h-0 flex-1 bg-slate-200/70 dark:bg-slate-950">
            <Editor />
            <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <ZoomControls />
            </div>
          </main>
        </>
      ) : (
        // The moment before the starter canvas is made.
        <main className="flex-1" />
      )}

      <DropAnywhere show={pageDrop.pageOver && open} title={t('app.drop_title')} hint={t('app.drop_hint')} icon={<span aria-hidden="true">🎨</span>} />
      <Dialogs />
      {notice && <Notice key={notice.at} text={notice.text} tone={notice.tone} />}
    </div>
  )
}

function Notice({ text, tone }: { text: string; tone: 'info' | 'error' }) {
  const clear = () => usePaintStore.setState({ notice: null })
  useEffect(() => {
    const id = window.setTimeout(clear, tone === 'error' ? 7000 : 2600)
    return () => clearTimeout(id)
  }, [tone])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <div
        role={tone === 'error' ? 'alert' : 'status'}
        className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm shadow-lg ${tone === 'error' ? 'bg-red-700 text-white' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}
        onClick={clear}
      >
        {text}
      </div>
    </div>
  )
}
