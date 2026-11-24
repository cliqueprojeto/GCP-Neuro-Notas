import { useEffect, useMemo, useRef, useState } from 'react';
import { icons, ImagePlus, X } from 'lucide-react';
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
import { useT, useLang } from '../i18n';
import { usePrefs } from '../store/prefs';
import { getTheme } from '../lib/themes';
import { SHAPE_STICKERS } from '../editor/stickers';
import { fileToDataUrl, pickImages } from '../lib/platform';
import { useVault } from '../store/vault';
import { toast } from '../store/ui';

const MAX_CUSTOM = 24;

/** Cor do painel do tema em "r, g, b" (o seletor de emojis pede neste formato). */
function panelRgb(): string {
  const c = document.createElement('canvas').getContext('2d');
  const v = getComputedStyle(document.body).getPropertyValue('--panel').trim() || '#ffffff';
  if (!c) return '255, 255, 255';
  c.fillStyle = '#ffffff';
  c.fillStyle = v;
  c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  return `${d[0]}, ${d[1]}, ${d[2]}`;
}

const LUCIDE = [
  'FileText', 'Notebook', 'BookOpen', 'Book', 'Bookmark', 'Library', 'GraduationCap', 'School', 'Briefcase', 'Building2', 'Calendar',
  'CalendarDays', 'CalendarCheck', 'Clock', 'Timer', 'AlarmClock', 'CheckSquare', 'ListTodo', 'ListChecks', 'KanbanSquare', 'LayoutDashboard',
  'Table', 'Database', 'BarChart3', 'PieChart', 'LineChart', 'TrendingUp', 'Target', 'Flag', 'Rocket', 'Lightbulb', 'Brain', 'Sparkles',
  'Star', 'Heart', 'Smile', 'Sun', 'Moon', 'Cloud', 'Leaf', 'Flower2', 'Trees', 'Mountain', 'Globe', 'Map', 'MapPin', 'Plane', 'Car',
  'Home', 'Coffee', 'Utensils', 'ChefHat', 'ShoppingCart', 'Wallet', 'PiggyBank', 'DollarSign', 'CreditCard', 'Receipt', 'Calculator',
  'Lock', 'KeyRound', 'Shield', 'ShieldCheck', 'Fingerprint', 'Link', 'Globe2', 'Mail', 'Phone', 'MessageCircle', 'Users', 'User',
  'UserCircle', 'Contact', 'Music', 'Headphones', 'Film', 'Camera', 'Image', 'Palette', 'PenTool', 'Brush', 'Code', 'Terminal', 'Cpu',
  'Server', 'Wrench', 'Settings', 'Hammer', 'Package', 'Box', 'Archive', 'Folder', 'FolderOpen', 'Inbox', 'Send', 'Megaphone', 'Mic',
  'Video', 'Gamepad2', 'Dumbbell', 'Bike', 'Activity', 'Stethoscope', 'Pill', 'Baby', 'Dog', 'Cat', 'Gift', 'PartyPopper', 'Trophy',
  'Medal', 'Award', 'Crown', 'Gem', 'Zap', 'Flame', 'Droplet', 'Anchor', 'Compass', 'Feather', 'Puzzle', 'Dices', 'Vote', 'ClipboardList',
  'ClipboardCheck', 'Presentation', 'Newspaper', 'Quote', 'Hash', 'Tag', 'Tags', 'Theater', 'Drama', 'Landmark', 'HandHeart', 'Handshake',
];

const COLORS = ['#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#64748b', '#e5e7eb'];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const theme = usePrefs((s) => s.theme);
  useEffect(() => {
    if (!ref.current) return;
    const picker = new Picker({
      data,
      locale: lang === 'pt' ? 'pt' : lang,
      theme: getTheme(theme).dark ? 'dark' : 'light',
      previewPosition: 'none',
      skinTonePosition: 'search',
      navPosition: 'top',
      perLine: 9,
      maxFrequentRows: 2,
      onEmojiSelect: (e: any) => onSelect(e.native),
    });
    ref.current.innerHTML = '';
    // Fundo sólido na cor do tema: o menu de tom de pele usa esta cor e ficava transparente.
    (picker as unknown as HTMLElement).style.setProperty('--rgb-background', panelRgb());
    ref.current.appendChild(picker as unknown as Node);
    return () => {
      if (ref.current) ref.current.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, theme]);
  return <div ref={ref} className="emoji-host" />;
}

export function IconPicker({ onSelect, onRemove, allowStickers = false }: { onSelect: (icon: string) => void; onRemove?: () => void; allowStickers?: boolean }) {
  const t = useT();
  const [tab, setTab] = useState<'emoji' | 'icons' | 'stickers' | 'image'>('emoji');
  const custom = useVault((v) => v.settings.customIcons) || [];
  const [over, setOver] = useState(false);
  const applyImage = (src: string) => {
    useVault.getState().updateSettings((s) => ((s.customIcons = [src, ...(s.customIcons || []).filter((x) => x !== src)].slice(0, MAX_CUSTOM)), s));
    onSelect(src);
  };
  const fromFiles = async (files: File[]) => {
    const f = files.find((x) => x.type.startsWith('image/') || /\.(ico|svg|png|jpe?g|gif|webp|bmp)$/i.test(x.name));
    if (!f) return toast(t('icon.notImage'), 'error');
    if (f.size > 8 * 1024 * 1024) return toast(t('icon.tooBig'), 'error');
    applyImage(await fileToDataUrl(f, 256));
  };
  const upload = async () => {
    const [src] = await pickImages(false, 256);
    if (src) applyImage(src);
  };
  const [color, setColor] = useState(COLORS[0]);
  const [q, setQ] = useState('');
  const list = useMemo(() => LUCIDE.filter((n) => (icons as any)[n] && n.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="icon-picker">
      <div className="row">
        <div className="seg sm">
          <button className={tab === 'emoji' ? 'on' : ''} onClick={() => setTab('emoji')}>{t('icon.emoji')}</button>
          <button className={tab === 'icons' ? 'on' : ''} onClick={() => setTab('icons')}>{t('icon.icons')}</button>
          {allowStickers && <button className={tab === 'stickers' ? 'on' : ''} onClick={() => setTab('stickers')}>{t('icon.stickers')}</button>}
          <button className={tab === 'image' ? 'on' : ''} onClick={() => setTab('image')}>{t('icon.image')}</button>
        </div>
        <div className="grow" />
        {onRemove && <button className="btn ghost sm" onClick={onRemove}>{t('common.remove')}</button>}
      </div>
      {tab === 'emoji' && <EmojiPicker onSelect={onSelect} />}
      {tab === 'icons' && (
        <div className="stack">
          <input className="input" placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="color-row">
            {COLORS.map((c) => (
              <button key={c} className={'color-dot' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="lucide-grid">
            {list.map((n) => {
              const Cmp = (icons as any)[n];
              return (
                <button key={n} title={n} onClick={() => onSelect(`lucide:${n}:${color}`)}>
                  <Cmp size={20} color={color} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'image' && (
        <div className="stack">
          <div
            className={'icon-drop' + (over ? ' over' : '')}
            onDragOver={(e) => (e.preventDefault(), setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => (e.preventDefault(), setOver(false), void fromFiles(Array.from(e.dataTransfer.files)))}
            onPaste={(e) => void fromFiles(Array.from(e.clipboardData.files))}
            tabIndex={0}
          >
            <ImagePlus size={26} />
            <button className="btn primary sm" onClick={upload}>{t('icon.upload')}</button>
            <span className="muted small">{t('icon.uploadHint')}</span>
          </div>
          {custom.length > 0 && (
            <>
              <div className="muted small">{t('icon.myImages')}</div>
              <div className="custom-icons">
                {custom.map((src) => (
                  <span key={src.slice(-40)} className="custom-icon">
                    <button onClick={() => onSelect(src)}><img src={src} alt="" /></button>
                    <button className="saved-x" title={t('common.delete')} onClick={() => useVault.getState().updateSettings((s) => ((s.customIcons = (s.customIcons || []).filter((x) => x !== src)), s))}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {tab === 'stickers' && (
        <div className="sticker-grid">
          {SHAPE_STICKERS.map((s) => (
            <button key={s.id} onClick={() => onSelect(s.src)}>
              <img src={s.src} alt={s.id} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
