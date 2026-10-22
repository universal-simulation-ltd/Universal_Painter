import { useEffect, useSyncExternalStore } from 'react'
import { DropAnywhere, UniversalAppsNavBar, UpdateNotice, useFileDrop, type AboutAppConfig } from '@unisim/sdk'
// Generated — `npm run credits` after any dependency change. Never by hand.
import credits from './generated/credits.json'
import ProductLogo from './components/Header/ProductLogo'
import AppMenu, { TuneRows } from './components/AppMenu'
import Landing from './components/Landing'
import Editor from './components/Editor'
import ToolRow from './components/ToolRow'
import OptionsRow from './components/OptionsRow'
import ZoomControls from './components/ZoomControls'
import Dialogs from './components/Dialogs'
import { doc } from './lib/doc'
import { closePicture, copySelection, cropToSelection, cutSelection, deleteSelection, deselect, openFiles, pasteFromEvent, redo, selectAll, showActual, showFit, undo, zoomBy } from './lib/actions'
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
    <div className={`flex flex-col bg-slate-100 pt-[env(safe-area-inset-top)] dark:bg-slate-950 ${open ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'}`}>
      <UniversalAppsNavBar
        product="painter"
        theme={theme}
        productLogo={<ProductLogo />}
        productHomeHref={import.meta.env.BASE_URL}
        // With a picture open the identity cluster becomes a home button, as in
        // Universal PDF and Images: back to the start page (asking first if
        // there are unsaved changes).
        onHome={open ? () => { closePicture() } : undefined}
        centre={open ? (
          <span className="hidden truncate text-xs text-slate-500 md:inline dark:text-slate-400">
            {doc.stem} · {doc.width} × {doc.height}{doc.dirty ? ' •' : ''}
          </span>
        ) : undefined}
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
        <>
          <main className="flex-1">
            <Landing />
          </main>
          <footer className="border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900">
            <div className={`${CONTAINER} flex flex-row items-center gap-3 py-4 text-xs text-slate-500 sm:gap-4 dark:text-slate-400`}>
              <span>
                {t.rich('app.footer', {
                  james: <a href="https://www.jamesmarkey.co.uk" target="_blank" rel="noreferrer" className="text-slate-700 underline-offset-2 hover:text-orange-700 hover:underline dark:text-slate-200 dark:hover:text-orange-400">James Markey MBE</a>,
                  team: <a href="https://www.unisim.co.uk" target="_blank" rel="noreferrer" className="text-slate-700 underline-offset-2 hover:text-orange-700 hover:underline dark:text-slate-200 dark:hover:text-orange-400">{t('app.footer_team')}</a>,
                })}
              </span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                aria-label={t('app.github_label')}
                title={t('app.github_title')}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.09 3.29 9.4 7.86 10.92.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.26 5.68.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.21.66.79.55 4.57-1.52 7.86-5.83 7.86-10.92C23.5 5.65 18.35.5 12 .5z" />
                </svg>
                <span className="hidden sm:inline">GitHub</span>
              </a>
            </div>
          </footer>
        </>
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
