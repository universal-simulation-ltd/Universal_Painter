// The toolbar's icons: one-colour strokes on a 24 grid, drawn here so nothing
// is fetched. `currentColor`, so they follow the button's own text colour.
import type { ReactNode } from 'react'
import type { Tool } from '../stores/paintStore'

function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const TOOL_ICONS: Record<Tool, ReactNode> = {
  pencil: <Svg><path d="M4 20l1.2-4.6L16.5 4.1a1.6 1.6 0 0 1 2.3 0l1.1 1.1a1.6 1.6 0 0 1 0 2.3L8.6 18.8z" /><path d="M14.5 6.1l3.4 3.4" /></Svg>,
  brush: <Svg><path d="M20 4c-3.6 1.4-7.4 4.8-9.6 8.2l1.4 1.4C15.2 11.4 18.6 7.6 20 4z" /><path d="M9.6 13.4c-2.2-.2-3.8 1.2-4 3.2-.2 1.6-.8 2.6-2.1 3.1 2.8 1.1 6.6.4 7.4-2.2.4-1.4-.1-2.9-1.3-4.1z" /></Svg>,
  eraser: <Svg><path d="M8.5 19.5l-4-4a1.8 1.8 0 0 1 0-2.6l8.4-8.4a1.8 1.8 0 0 1 2.6 0l4 4a1.8 1.8 0 0 1 0 2.6l-7.9 7.9" /><path d="M8.5 19.5H20" /><path d="M9 10l5.5 5.5" /></Svg>,
  fill: <Svg><path d="M11 3.5l7.5 7.5-6.8 6.8a1.6 1.6 0 0 1-2.3 0l-5.2-5.2a1.6 1.6 0 0 1 0-2.3z" /><path d="M4.4 11h13.9" /><path d="M20 14.5s1.6 2 1.6 3.1a1.6 1.6 0 0 1-3.2 0c0-1.1 1.6-3.1 1.6-3.1z" /></Svg>,
  line: <Svg><path d="M5 19L19 5" /><circle cx="5" cy="19" r="1.4" fill="currentColor" /><circle cx="19" cy="5" r="1.4" fill="currentColor" /></Svg>,
  box: <Svg><rect x="4" y="6" width="16" height="12" rx="1" /></Svg>,
  ellipse: <Svg><ellipse cx="12" cy="12" rx="8.5" ry="6.5" /></Svg>,
  text: <Svg><path d="M5 6.5V5h14v1.5" /><path d="M12 5v14" /><path d="M9 19h6" /></Svg>,
  picker: <Svg><path d="M14.6 4.8l4.6 4.6" /><path d="M16.9 2.9a2 2 0 0 1 2.8 0l1.4 1.4a2 2 0 0 1 0 2.8l-2.2 2.2-4.2-4.2z" /><path d="M14.7 7.1L5.6 16.2 4 20l3.8-1.6 9.1-9.1" /></Svg>,
  select: <Svg><path d="M4 8V5a1 1 0 0 1 1-1h3M12 4h0M16 4h3a1 1 0 0 1 1 1v3M20 12h0M20 16v3a1 1 0 0 1-1 1h-3M12 20h0M8 20H5a1 1 0 0 1-1-1v-3M4 12h0" /></Svg>,
  hand: <Svg><path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5" /><path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6" /><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v6.5" /><path d="M17 9.5a1.5 1.5 0 0 1 3 0V14a6.5 6.5 0 0 1-6.5 6.5h-1.3a6 6 0 0 1-4.6-2.2L4.3 14.4a1.5 1.5 0 0 1 2.3-1.9L8 14" /></Svg>,
}

export const UndoIcon = () => <Svg><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>
export const RedoIcon = () => <Svg><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>
export const SaveIcon = () => <Svg><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></Svg>
export const PictureIcon = () => <Svg><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8.5 8" /></Svg>
export const QrIcon = () => <Svg><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1" /></Svg>
export const SwapIcon = () => <Svg size={16}><path d="M7 4L4 7l3 3" /><path d="M4 7h11a4 4 0 0 1 4 4" /><path d="M17 20l3-3-3-3" /><path d="M20 17H9a4 4 0 0 1-4-4" /></Svg>
export const PlusIcon = () => <Svg size={18}><path d="M12 5v14M5 12h14" /></Svg>
export const MinusIcon = () => <Svg size={18}><path d="M5 12h14" /></Svg>
export const RotateLeftIcon = () => <Svg><path d="M4 4v5h5" /><path d="M4.5 9A8 8 0 1 1 6 16.5" /></Svg>
export const RotateRightIcon = () => <Svg><path d="M20 4v5h-5" /><path d="M19.5 9A8 8 0 1 0 18 16.5" /></Svg>
export const FlipHIcon = () => <Svg><path d="M12 3v18" strokeDasharray="2 2" /><path d="M9 7L3 17h6z" /><path d="M15 7l6 10h-6z" /></Svg>
export const FlipVIcon = () => <Svg><path d="M3 12h18" strokeDasharray="2 2" /><path d="M7 9L17 3v6z" /><path d="M7 15l10 6v-6z" /></Svg>
export const CropIcon = () => <Svg><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M2 6h14a2 2 0 0 1 2 2v14" /></Svg>
export const ResizeIcon = () => <Svg><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></Svg>
export const CanvasIcon = () => <Svg><rect x="3" y="3" width="18" height="18" rx="1.5" strokeDasharray="3 2.5" /><rect x="7" y="7" width="10" height="10" rx="1" /></Svg>
export const SunIcon = () => <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
export const GreyIcon = () => <Svg><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" /></Svg>
export const InvertIcon = () => <Svg><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M3.5 20.5L20.5 3.5V20.5z" fill="currentColor" /></Svg>
export const CopyIcon = () => <Svg size={18}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>
export const CutIcon = () => <Svg size={18}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8 16.5L18 4M16 16.5L6 4" /></Svg>
export const TrashIcon = () => <Svg size={18}><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6 7l1 13h10l1-13" /></Svg>
export const PasteIcon = () => <Svg size={18}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h4" /></Svg>
