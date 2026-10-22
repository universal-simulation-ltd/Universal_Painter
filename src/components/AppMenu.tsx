// The app's rows in the navbar's actions pill, and its rows in Tune this app.
// Both render inside SDK chrome, so they are inline-styled from the SDK's own
// menu palette to match whichever theme the panel is in.
import { useContext, useSyncExternalStore } from 'react'
import { DefaultViewSelect, MENU, PreferencesThemeContext, type MenuTheme } from '@unisim/sdk'
import { doc } from '../lib/doc'
import { okToReplace, OPENS_AT_ROW, openFiles, pasteFromButton, save, type OpensAt } from '../lib/actions'
import { usePaintStore } from '../stores/paintStore'
import { useSettings, type Settings } from '../stores/settingsStore'
import { useThemeStore } from '../stores/themeStore'
import { useT } from '../i18n'

const ROW: Record<MenuTheme, { rest: string; disabled: string; hoverBg: string; hoverText: string }> = {
  light: { rest: '#374151', disabled: '#94a3b8', hoverBg: '#fff7ed', hoverText: '#c2410c' },
  dark: { rest: MENU.dark.body, disabled: MENU.dark.faint, hoverBg: MENU.dark.rowHover, hoverText: MENU.dark.rowHoverText },
}

/** Opens the system file picker, outside any drop zone. */
function pickFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif'
  input.onchange = () => { if (input.files?.length) void openFiles(Array.from(input.files)) }
  input.click()
}

export default function AppMenu() {
  const t = useT()
  useSyncExternalStore(doc.subscribe, doc.getVersion)
  const theme = useThemeStore((s) => s.effective)
  const setDialog = usePaintStore((s) => s.setDialog)
  const open = !!doc.surface
  return (
    <>
      <MenuRow theme={theme} icon="🆕" label={t('menu.new')} onClick={() => { if (!open) setDialog('new'); else if (okToReplace()) setDialog('new') }} />
      <MenuRow theme={theme} icon="📂" label={t('menu.open')} onClick={() => { if (!open || okToReplace()) { if (open) doc.close(); pickFile() } }} />
      <MenuRow theme={theme} icon="📋" label={t('menu.paste')} onClick={() => void pasteFromButton()} />
      <MenuRow theme={theme} icon="💾" label={t('menu.save_png')} disabled={!open} onClick={() => void save('image/png')} />
      <MenuRow theme={theme} icon="🖼" label={t('menu.save_jpeg')} disabled={!open} onClick={() => void save('image/jpeg')} />
    </>
  )
}

function MenuRow({ theme, icon, label, disabled = false, onClick }: { theme: MenuTheme; icon: string; label: string; disabled?: boolean; onClick: () => void }) {
  const c = ROW[theme]
  const restColor = disabled ? c.disabled : c.rest
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 14px',
        fontSize: 13, fontFamily: 'inherit', textAlign: 'left', border: 0, background: 'transparent',
        color: restColor, cursor: disabled ? 'default' : 'pointer', transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => { if (disabled) return; e.currentTarget.style.background = c.hoverBg; e.currentTarget.style.color = c.hoverText }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = restColor }}
    >
      <span aria-hidden>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  )
}

/** Tune this app: the default opening view, then the tick boxes (all unticked out of the box). */
export function TuneRows() {
  const t = useT()
  return (
    <>
      <DefaultViewSelect<OpensAt>
        id={OPENS_AT_ROW}
        label={t('tune.opens_at')}
        fallback="fit"
        views={[
          { value: 'fit', label: t('tune.opens_fit') },
          { value: 'actual', label: t('tune.opens_actual') },
        ]}
      />
      <Tick k="penOnly" label={t('tune.pen_only')} />
      <Tick k="ignorePressure" label={t('tune.ignore_pressure')} />
      <Tick k="smallerJpeg" label={t('tune.smaller_jpeg')} />
      <Tick k="transparentNew" label={t('tune.transparent_new')} />
      <Tick k="pixelGrid" label={t('tune.pixel_grid')} />
    </>
  )
}

function Tick({ k, label }: { k: keyof Settings; label: string }) {
  const theme = useContext(PreferencesThemeContext)
  const p = MENU[theme]
  const value = useSettings((s) => s[k])
  const set = useSettings((s) => s.set)
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 13, color: p.body, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => set(k, e.target.checked)}
        style={{ width: 16, height: 16, accentColor: '#e05504', flexShrink: 0, margin: 0 }}
      />
      <span>{label}</span>
    </label>
  )
}
