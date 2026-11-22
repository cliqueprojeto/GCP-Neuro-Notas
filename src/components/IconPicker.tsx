import { useEffect, useMemo, useRef, useState } from 'react';
import { icons } from 'lucide-react';
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
import { useT, useLang } from '../i18n';
import { usePrefs } from '../store/prefs';
import { getTheme } from '../lib/themes';
import { SHAPE_STICKERS } from '../editor/stickers';

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
  const [tab, setTab] = useState<'emoji' | 'icons' | 'stickers'>('emoji');
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
