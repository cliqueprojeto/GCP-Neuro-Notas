/**
 * Fontes embutidas no app (funcionam sem internet em todos os instaladores).
 * Só o alfabeto latino (português, inglês, espanhol) para manter o app leve.
 */
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-700.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/raleway/latin-400.css';
import '@fontsource/raleway/latin-700.css';
import '@fontsource/work-sans/latin-400.css';
import '@fontsource/work-sans/latin-700.css';
import '@fontsource/merriweather/latin-400.css';
import '@fontsource/merriweather/latin-700.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-700.css';
import '@fontsource/libre-baskerville/latin-400.css';
import '@fontsource/libre-baskerville/latin-700.css';
import '@fontsource/crimson-pro/latin-400.css';
import '@fontsource/crimson-pro/latin-700.css';
import '@fontsource/fira-code/latin-400.css';
import '@fontsource/fira-code/latin-700.css';
import '@fontsource/source-code-pro/latin-400.css';
import '@fontsource/source-code-pro/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-700.css';
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-700.css';
import '@fontsource/caveat/latin-400.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/patrick-hand/latin-400.css';

export type FontGroup = 'sans' | 'serif' | 'mono' | 'read' | 'hand';

export interface FontDef {
  id: string;
  label: string;
  family: string;
  group: FontGroup;
}

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = 'Georgia, serif';
const MONO = 'ui-monospace, Consolas, monospace';

/** `sans`, `serif` e `mono` mantêm os nomes antigos (páginas já salvas continuam iguais). */
export const FONTS: FontDef[] = [
  { id: 'sans', label: 'Inter', family: `'Inter', ${SANS}`, group: 'sans' },
  { id: 'roboto', label: 'Roboto', family: `'Roboto', ${SANS}`, group: 'sans' },
  { id: 'open-sans', label: 'Open Sans', family: `'Open Sans', ${SANS}`, group: 'sans' },
  { id: 'lato', label: 'Lato', family: `'Lato', ${SANS}`, group: 'sans' },
  { id: 'montserrat', label: 'Montserrat', family: `'Montserrat', ${SANS}`, group: 'sans' },
  { id: 'poppins', label: 'Poppins', family: `'Poppins', ${SANS}`, group: 'sans' },
  { id: 'nunito', label: 'Nunito', family: `'Nunito', ${SANS}`, group: 'sans' },
  { id: 'source-sans', label: 'Source Sans 3', family: `'Source Sans 3', ${SANS}`, group: 'sans' },
  { id: 'raleway', label: 'Raleway', family: `'Raleway', ${SANS}`, group: 'sans' },
  { id: 'work-sans', label: 'Work Sans', family: `'Work Sans', ${SANS}`, group: 'sans' },
  { id: 'serif', label: 'Lora', family: `'Lora', ${SERIF}`, group: 'serif' },
  { id: 'merriweather', label: 'Merriweather', family: `'Merriweather', ${SERIF}`, group: 'serif' },
  { id: 'playfair', label: 'Playfair Display', family: `'Playfair Display', ${SERIF}`, group: 'serif' },
  { id: 'garamond', label: 'EB Garamond', family: `'EB Garamond', ${SERIF}`, group: 'serif' },
  { id: 'baskerville', label: 'Libre Baskerville', family: `'Libre Baskerville', ${SERIF}`, group: 'serif' },
  { id: 'crimson', label: 'Crimson Pro', family: `'Crimson Pro', ${SERIF}`, group: 'serif' },
  { id: 'atkinson', label: 'Atkinson Hyperlegible', family: `'Atkinson Hyperlegible', ${SANS}`, group: 'read' },
  { id: 'lexend', label: 'Lexend', family: `'Lexend', ${SANS}`, group: 'read' },
  { id: 'opendyslexic', label: 'OpenDyslexic', family: `'OpenDyslexic', ${SANS}`, group: 'read' },
  { id: 'mono', label: 'JetBrains Mono', family: `'JetBrains Mono', ${MONO}`, group: 'mono' },
  { id: 'fira-code', label: 'Fira Code', family: `'Fira Code', ${MONO}`, group: 'mono' },
  { id: 'source-code', label: 'Source Code Pro', family: `'Source Code Pro', ${MONO}`, group: 'mono' },
  { id: 'plex-mono', label: 'IBM Plex Mono', family: `'IBM Plex Mono', ${MONO}`, group: 'mono' },
  { id: 'caveat', label: 'Caveat', family: `'Caveat', cursive`, group: 'hand' },
  { id: 'patrick-hand', label: 'Patrick Hand', family: `'Patrick Hand', cursive`, group: 'hand' },
];

export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 32, 36];

export function fontById(id?: string): FontDef {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}
