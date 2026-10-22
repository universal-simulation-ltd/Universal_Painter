// The start page: open a picture (the suite's drop circle), paste one, or start
// a blank canvas at a chosen size.
import { DropRing, PrivacyNote, useFileDrop } from '@unisim/sdk'
import { openFiles, pasteFromButton } from '../lib/actions'
import { CONTAINER, REPO_URL } from '../lib/layout'
import { useThemeStore } from '../stores/themeStore'
import { useT } from '../i18n'
import { BlankForm } from './Dialogs'
import { PasteIcon } from './icons'

export default function Landing() {
  const t = useT()
  const theme = useThemeStore((s) => s.effective)
  const picker = useFileDrop({
    onFiles: (files) => openFiles(files),
    accept: 'image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif',
    pageWide: true,
    label: t('landing.open'),
  })

  return (
    <div className={`${CONTAINER} py-8 lg:py-12`}>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">{t('landing.title')}</h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{t('landing.lead')}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('landing.open')}</h2>
          <div className="flex flex-col items-center">
            {/* DropRing takes the theme, so its interior is dark in dark mode and the copy on it follows. */}
            <div
              {...picker.dropzoneProps}
              className={`relative w-full max-w-[240px] cursor-pointer rounded-full transition-transform focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 ${picker.over ? 'scale-[1.02]' : ''}`}
            >
              <DropRing size="100%" over={picker.over} motion="idle" theme={theme}>
                <span className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{picker.over ? t('app.drop_title') : t('landing.open')}</span>
                <span className="px-6 text-center text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{t('landing.open_hint')}</span>
              </DropRing>
              <input {...picker.inputProps} className="sr-only" tabIndex={-1} aria-hidden="true" />
            </div>
            <button type="button" onClick={() => void pasteFromButton()} className="pt-btn pt-btn-ghost mt-5 inline-flex items-center gap-2">
              <PasteIcon />
              {t('landing.paste')}
            </button>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{t('landing.paste_hint')}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('landing.blank_title')}</h2>
          <BlankForm />
        </section>
      </div>

      <div className="mt-8">
        <PrivacyNote
          repo={REPO_URL}
          proof={`${REPO_URL}/blob/main/PRIVACY.md`}
          subject="Your images"
          plural
          except={null}
          theme={theme}
        />
      </div>
    </div>
  )
}
