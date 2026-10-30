// English (en-GB): the source, and the shape every other language follows.
// A key is `<namespace>.<key>` everywhere else. Placeholders are `{name}`; a
// plural is two keys sharing a stem (`steps_one`, `steps_other`).

const common = {
  cancel: 'Cancel',
  close: 'Close',
  apply: 'Apply',
  done: 'Done',
  width: 'Width',
  height: 'Height',
  px: 'px',
  steps_one: '{count} step',
  steps_other: '{count} steps',
}

const app = {
  drop_title: 'Drop to open',
  drop_hint: 'PNG, JPEG, WebP or HEIC',
  close_unsaved: 'Close this picture? Changes you haven’t saved will be lost.',
  replace_unsaved: 'Open this instead? Changes you haven’t saved will be lost.',
  canvas_label: 'Picture being painted, {w} by {h} pixels',
  rename: 'Rename the picture',
  rename_tip: 'Click to rename',
  size_edit: 'Canvas size',
  size_tip: 'Click to change the canvas size',
}

const landing = {
  preset_screen: 'Screen',
  preset_square: 'Square',
  preset_hd: 'Full HD',
  preset_a4: 'A4 page',
  preset_small: 'Small',
  custom: 'Your own size',
  start: 'Start drawing',
}

const tools = {
  group: 'Tools',
  pencil: 'Pencil',
  brush: 'Brush',
  eraser: 'Eraser',
  fill: 'Fill',
  line: 'Line',
  box: 'Box',
  ellipse: 'Ellipse',
  text: 'Text',
  picker: 'Picker',
  select: 'Select',
  hand: 'Move',
  pencil_tip: 'Pencil: hard-edged lines, exact to the pixel',
  brush_tip: 'Brush: soft, round strokes that follow pen pressure',
  eraser_tip: 'Eraser: rubs out to see-through',
  fill_tip: 'Fill: floods an area with the first colour',
  line_tip: 'Line: drag from end to end (Shift snaps to 45°)',
  box_tip: 'Box: drag corner to corner (Shift makes a square)',
  ellipse_tip: 'Ellipse: drag across it (Shift makes a circle)',
  text_tip: 'Text: tap where it should start, then type',
  picker_tip: 'Pick colour: tap the picture to take a colour from it',
  select_tip: 'Select: drag a box round part of the picture to move, copy or crop it',
  hand_tip: 'Move: drag to look around the picture',
  undo: 'Undo',
  redo: 'Redo',
  save: 'Save',
  picture: 'Picture',
  picture_tip: 'Crop, resize, rotate, flip and adjust the whole picture',
  qr: 'QR code',
  qr_tip: 'Put a QR code on the canvas',
}

const options = {
  size: 'Size',
  style: 'Shape style',
  style_outline: 'Outline',
  style_fill: 'Filled',
  style_both: 'Outline and fill',
  spread: 'Spread',
  spread_tip: 'How different a colour can be and still be filled',
  text_size: 'Text size',
  bold: 'Bold',
  text_hint: 'Tap the canvas, type, then press Done',
  text_placeholder: 'Type here',
  primary: 'First colour',
  secondary: 'Second colour',
  swap: 'Swap the two colours',
  custom_colour: 'Any colour',
  picker_hint: 'Tap the picture to take a colour from it',
  select_hint: 'Click a shape, text or picture to pick it up, or drag a box round part of the picture',
  selected: '{w} × {h} selected',
  move_hint: 'Drag the selection to move it; hold Alt (Option) to move a copy',
  object_hint: 'Drag to move it, or drag a corner to resize it. It stays movable until you paint over it.',
  copy: 'Copy',
  cut: 'Cut',
  delete: 'Delete',
  crop: 'Crop to selection',
  select_all: 'Select all',
  deselect: 'Deselect',
  paste: 'Paste',
  hand_hint: 'Drag to look around; pinch or Ctrl + scroll to zoom',
  eraser_hint: 'Rubs out to see-through. A JPEG saves see-through as white.',
  fill_hint: 'Tap an area to fill it with the first colour',
}

const zoom = {
  zoom_in: 'Zoom in',
  zoom_out: 'Zoom out',
  fit: 'Fit',
  actual: '100%',
  fit_tip: 'Fit the whole picture on screen',
  actual_tip: 'Show the picture at its actual size',
  level: 'Zoom: {pct}%',
}

const picture = {
  title: 'The whole picture',
  size_now: '{w} × {h} pixels',
  resize: 'Resize the picture…',
  canvas: 'Canvas size…',
  crop: 'Crop to the selection',
  crop_needs: 'Select an area first',
  rotate_left: 'Rotate left',
  rotate_right: 'Rotate right',
  rotate_180: 'Turn upside down',
  flip_h: 'Flip left to right',
  flip_v: 'Flip top to bottom',
  adjust: 'Brightness and contrast…',
  greyscale: 'Black and white',
  invert: 'Invert colours',
}

const dialogs = {
  resize_title: 'Resize the picture',
  resize_lead: 'Stretches or shrinks everything in the picture.',
  percent: 'Percentage',
  pixels: 'Pixels',
  free: 'Stretch freely (ignore the proportions)',
  canvas_title: 'Canvas size',
  canvas_lead: 'The picture is not stretched: the canvas grows with see-through edges, or is trimmed.',
  anchor: 'Keep the picture at',
  anchor_cell: 'Anchor {n} of 9',
  fill_second: 'Fill new edges with the second colour',
  adjust_title: 'Brightness and contrast',
  brightness: 'Brightness',
  contrast: 'Contrast',
  reset: 'Back to 0',
  new_title: 'New blank canvas',
  too_big: 'That is bigger than this device can paint: up to {max} pixels in all.',
  save_title: 'Save a copy',
  file_name: 'File name',
  png_hint: 'Sharp edges, keeps see-through areas',
  jpeg_hint: 'Smaller files, best for photos',
  save_local: 'Saved straight to this device. Nothing is uploaded.',
}

const menu = {
  label: 'Painter',
  new: 'New blank canvas…',
  open: 'Open a picture…',
  save_png: 'Save as PNG',
  save_jpeg: 'Save as JPEG',
}

const tune = {
  opens_at: 'Pictures open at',
  opens_fit: 'Fit the screen',
  opens_actual: 'Actual size (100%)',
  pen_only: 'Only a pen draws; fingers move and zoom',
  ignore_pressure: 'Ignore pen pressure',
  smaller_jpeg: 'Save JPEGs smaller (lower quality)',
  transparent_new: 'Start new canvases see-through',
  pixel_grid: 'Show a pixel grid when zoomed right in',
}

const notices = {
  copied: 'Copied',
  copied_inside: 'Copied (paste it inside Painter)',
  saved: 'Saved {name}',
  scaled: 'This picture was {w} × {h}. It has been scaled to {sw} × {sh} to fit what this device can paint.',
  nothing_to_paste: 'There’s no picture on the clipboard.',
  paste_blocked: 'Your browser didn’t allow pasting from here. Press Ctrl+V (⌘V on a Mac) instead.',
  picked: 'Picked {hex}',
}

const errors = {
  empty_file: '{name} came through empty. Try opening it again.',
  unreadable: '{name} could not be read from this device. If it lives in the cloud, open it in your photos app first so it downloads.',
  heic: 'This HEIC couldn’t be decoded: {why}',
  cannot_decode: 'Couldn’t open {name}. Is it a PNG, JPEG, WebP or HEIC picture?',
  too_big_canvas: 'This browser won’t make a {w} × {h} canvas. Try a smaller size.',
  save_failed: 'Saving didn’t work. Try PNG, or a smaller picture.',
  not_image: '{name} isn’t a picture Painter can open.',
}

const qr = {
  title: 'Add a QR code',
  data: 'Link or text',
  size: 'Size',
  place: 'Put it on the canvas',
  empty: 'Type a link to see the code',
  hint: 'It lands like a paste: drag it into place. Click it later with Select to move it again.',
}

export const en = { common, app, landing, tools, options, zoom, picture, dialogs, menu, tune, notices, errors, qr }

/** The shape every language must match exactly, once it is finished. */
export type Messages = {
  [N in keyof typeof en]: { [K in keyof (typeof en)[N]]: string }
}

/**
 * A language being translated: every namespace, any subset of its keys. A key
 * left out shows in English; a misspelt or stale key is a `tsc` error.
 */
export type Draft = {
  [N in keyof Messages]: Partial<Messages[N]>
}
