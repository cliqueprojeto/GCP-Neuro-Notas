import { useVault, livePages } from '../store/vault';
import { useUi } from '../store/ui';
import { resolvedLang } from '../store/prefs';
import { LOCALES, t } from '../i18n';
import { formatDate, todayKey } from '../lib/doc';
import { TEMPLATES } from '../templates/templates';

/** Abre (ou cria) a nota diária de hoje dentro da página "Diário". */
export function openDaily(date = todayKey()) {
  const v = useVault.getState();
  const pages = livePages(v.pages);
  let root = pages.find((p) => p.icon === '📅' && p.parentId === null && p.title === t('journal.root'));
  if (!root) root = pages.find((p) => p.parentId === null && p.title === t('journal.root'));
  if (!root) root = v.createPage({ title: t('journal.root'), icon: '📅', cover: 'g:5' });
  let day = pages.find((p) => p.journalDate === date);
  if (!day) {
    const lang = resolvedLang();
    const tpl = TEMPLATES.find((x) => x.id === 'journal')!.build(lang)[0];
    day = v.createPage({
      ...tpl,
      title: formatDate(date, LOCALES[lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      icon: '📔',
      parentId: root.id,
      journalDate: date,
    });
  }
  useUi.getState().go({ name: 'page', id: day.id });
}
