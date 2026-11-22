import type { DatabaseData, Page, Property, PropType, Row, View, ViewType, Widget } from '../lib/types';

interface VDef { type?: ViewType; name?: L; groupBy?: string; dateProp?: string; sort?: { prop: string; dir: 'asc' | 'desc' } }
import type { Lang } from '../store/prefs';
import { uid } from '../lib/crypto';
import { htmlToDoc } from '../lib/transfer';
import { todayKey } from '../lib/doc';

type L = { pt: string; en: string; es: string };
const l = (pt: string, en: string, es: string): L => ({ pt, en, es });

export type TemplateCategory = 'work' | 'journal' | 'education' | 'projects' | 'tasks' | 'databases' | 'personal' | 'reports';

export interface Template {
  id: string;
  category: TemplateCategory;
  icon: string;
  cover?: string;
  title: L;
  description: L;
  build: (lang: Lang) => Partial<Page>[]; // [raiz, ...filhas com parentId '$root']
}

// ------------------------------------------------------------ auxiliares

function page(lang: Lang, title: L, icon: string, html: L, extra: Partial<Page> = {}): Partial<Page> {
  return { type: 'page', title: title[lang], icon, content: htmlToDoc(html[lang]), ...extra };
}

interface ColDef {
  key: string;
  name: L | string;
  type: PropType;
  options?: { label: L; color: string }[];
  format?: Property['format'];
}

function database(lang: Lang, title: L, icon: string, cols: ColDef[], rows: Record<string, any>[], views: VDef[] = [], extra: Partial<Page> = {}): Partial<Page> {
  const ids: Record<string, string> = {};
  const props: Property[] = cols.map((c) => {
    const id = uid('c');
    ids[c.key] = id;
    return {
      id,
      name: typeof c.name === 'string' ? c.name : c.name[lang],
      type: c.type,
      format: c.format,
      options: c.options?.map((o) => ({ id: uid('o'), label: o.label[lang], color: o.color })),
    };
  });
  const opt = (key: string, label: string) => {
    const p = props.find((x) => x.id === ids[key]);
    return p?.options?.find((o) => o.label === label)?.id ?? '';
  };
  const now = Date.now();
  const dbRows: Row[] = rows.map((r, i) => {
    const cells: Record<string, any> = {};
    for (const c of cols) {
      let v = r[c.key];
      if (v == null) continue;
      if (typeof v === 'object' && !Array.isArray(v) && 'pt' in v) v = v[lang];
      if (c.type === 'select' || c.type === 'status') v = opt(c.key, v);
      if (c.type === 'multi') v = (v as any[]).map((x) => opt(c.key, typeof x === 'object' ? x[lang] : x));
      cells[ids[c.key]] = v;
    }
    return { id: uid('r'), cells, createdAt: now - (rows.length - i) * 3600_000, updatedAt: now };
  });
  const vs: View[] = (views.length ? views : [{ type: 'table' as ViewType }]).map((v: VDef) => ({
    id: uid('v'),
    name: v.name?.[lang] || { table: l('Tabela', 'Table', 'Tabla'), board: l('Quadro', 'Board', 'Tablero'), gallery: l('Galeria', 'Gallery', 'Galería'), calendar: l('Calendário', 'Calendar', 'Calendario'), list: l('Lista', 'List', 'Lista') }[v.type || 'table'][lang],
    type: v.type || 'table',
    filters: [],
    groupBy: v.groupBy ? ids[v.groupBy] : undefined,
    dateProp: v.dateProp ? ids[v.dateProp] : undefined,
    sort: v.sort ? { prop: ids[v.sort.prop], dir: v.sort.dir } : null,
  }));
  const db: DatabaseData = { properties: props, rows: dbRows, views: vs, activeView: vs[0].id };
  return { type: 'database', title: title[lang], icon, db, ...extra, _ids: ids } as any;
}

const d = (offset: number) => {
  const x = new Date();
  x.setDate(x.getDate() + offset);
  return todayKey(x);
};

const STATUS = [
  { label: l('A fazer', 'To do', 'Por hacer'), color: 'gray' },
  { label: l('Em andamento', 'In progress', 'En curso'), color: 'blue' },
  { label: l('Concluído', 'Done', 'Hecho'), color: 'green' },
];
const PRIORITY = [
  { label: l('Alta', 'High', 'Alta'), color: 'red' },
  { label: l('Média', 'Medium', 'Media'), color: 'yellow' },
  { label: l('Baixa', 'Low', 'Baja'), color: 'teal' },
];
const S = { todo: STATUS[0].label, doing: STATUS[1].label, done: STATUS[2].label };
const P = { high: PRIORITY[0].label, mid: PRIORITY[1].label, low: PRIORITY[2].label };

// --------------------------------------------------------------- catálogo

export const TEMPLATES: Template[] = [
  // ---------------------------------------------------------------- trabalho
  {
    id: 'meeting', category: 'work', icon: '🤝', cover: 'g:1',
    title: l('Ata de reunião', 'Meeting notes', 'Acta de reunión'),
    description: l('Pauta, decisões e próximos passos com responsáveis.', 'Agenda, decisions and next steps with owners.', 'Agenda, decisiones y próximos pasos con responsables.'),
    build: (lang) => [page(lang, l('Ata de reunião', 'Meeting notes', 'Acta de reunión'), '🤝', l(
      `<div data-type="callout" data-emoji="📅" data-tone="info">Data: ${d(0)} · Participantes: @ · Local/link:</div><h2>Pauta</h2><ol><li><p>Abertura e objetivos</p></li><li><p>Atualizações da equipe</p></li><li><p>Assuntos em aberto</p></li></ol><h2>Discussão</h2><p></p><h2>Decisões</h2><ul><li><p></p></li></ul><h2>Próximos passos</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Ação — responsável — prazo</p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
      `<div data-type="callout" data-emoji="📅" data-tone="info">Date: ${d(0)} · Attendees: @ · Place/link:</div><h2>Agenda</h2><ol><li><p>Opening and goals</p></li><li><p>Team updates</p></li><li><p>Open topics</p></li></ol><h2>Discussion</h2><p></p><h2>Decisions</h2><ul><li><p></p></li></ul><h2>Next steps</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Action — owner — due date</p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
      `<div data-type="callout" data-emoji="📅" data-tone="info">Fecha: ${d(0)} · Participantes: @ · Lugar/enlace:</div><h2>Agenda</h2><ol><li><p>Apertura y objetivos</p></li><li><p>Novedades del equipo</p></li><li><p>Temas abiertos</p></li></ol><h2>Discusión</h2><p></p><h2>Decisiones</h2><ul><li><p></p></li></ul><h2>Próximos pasos</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Acción — responsable — plazo</p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
    ))],
  },
  {
    id: 'weekly', category: 'work', icon: '📈', cover: 'g:0',
    title: l('Relatório semanal', 'Weekly report', 'Informe semanal'),
    description: l('Conquistas, métricas, bloqueios e prioridades.', 'Wins, metrics, blockers and priorities.', 'Logros, métricas, bloqueos y prioridades.'),
    build: (lang) => [page(lang, l('Relatório semanal', 'Weekly report', 'Informe semanal'), '📈', l(
      `<h2>🏆 Conquistas da semana</h2><ul><li><p></p></li></ul><h2>📊 Indicadores</h2><table><tr><th><p>Indicador</p></th><th><p>Meta</p></th><th><p>Realizado</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></table><h2>🚧 Bloqueios</h2><div data-type="callout" data-emoji="⚠️" data-tone="warning">O que precisa de ajuda?</div><h2>🎯 Prioridades da próxima semana</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
      `<h2>🏆 Wins this week</h2><ul><li><p></p></li></ul><h2>📊 Metrics</h2><table><tr><th><p>Metric</p></th><th><p>Target</p></th><th><p>Actual</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></table><h2>🚧 Blockers</h2><div data-type="callout" data-emoji="⚠️" data-tone="warning">What do you need help with?</div><h2>🎯 Next week priorities</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
      `<h2>🏆 Logros de la semana</h2><ul><li><p></p></li></ul><h2>📊 Indicadores</h2><table><tr><th><p>Indicador</p></th><th><p>Meta</p></th><th><p>Realizado</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></table><h2>🚧 Bloqueos</h2><div data-type="callout" data-emoji="⚠️" data-tone="warning">¿En qué necesitas ayuda?</div><h2>🎯 Prioridades de la próxima semana</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
    ))],
  },
  {
    id: 'okr', category: 'work', icon: '🎯', cover: 'g:4',
    title: l('OKRs e metas', 'OKRs & goals', 'OKRs y metas'),
    description: l('Objetivos com resultados-chave e progresso.', 'Objectives with key results and progress.', 'Objetivos con resultados clave y progreso.'),
    build: (lang) => [database(lang, l('OKRs e metas', 'OKRs & goals', 'OKRs y metas'), '🎯', [
      { key: 'kr', name: l('Resultado-chave', 'Key result', 'Resultado clave'), type: 'title' },
      { key: 'obj', name: l('Objetivo', 'Objective', 'Objetivo'), type: 'select', options: [{ label: l('Crescer o público', 'Grow audience', 'Crecer la audiencia'), color: 'purple' }, { label: l('Captar recursos', 'Raise funds', 'Captar recursos'), color: 'green' }] },
      { key: 'progress', name: l('Progresso', 'Progress', 'Progreso'), type: 'progress' },
      { key: 'owner', name: l('Responsável', 'Owner', 'Responsable'), type: 'text' },
      { key: 'q', name: l('Trimestre', 'Quarter', 'Trimestre'), type: 'select', options: [{ label: l('T1', 'Q1', 'T1'), color: 'blue' }, { label: l('T2', 'Q2', 'T2'), color: 'teal' }] },
    ], [
      { kr: l('Chegar a 10 mil seguidores', 'Reach 10k followers', 'Llegar a 10 mil seguidores'), obj: l('Crescer o público', 'Grow audience', 'Crecer la audiencia'), progress: 62, owner: 'Ana', q: l('T1', 'Q1', 'T1') },
      { kr: l('Aprovar 2 projetos em editais', 'Get 2 grants approved', 'Aprobar 2 proyectos'), obj: l('Captar recursos', 'Raise funds', 'Captar recursos'), progress: 50, owner: 'Bruno', q: l('T1', 'Q1', 'T1') },
      { kr: l('Fechar 3 patrocínios', 'Close 3 sponsorships', 'Cerrar 3 patrocinios'), obj: l('Captar recursos', 'Raise funds', 'Captar recursos'), progress: 33, owner: 'Carla', q: l('T2', 'Q2', 'T2') },
    ], [{ type: 'table' }, { type: 'board', groupBy: 'obj' }])],
  },
  // ------------------------------------------------------------------ diário
  {
    id: 'journal', category: 'journal', icon: '📔', cover: 'g:5',
    title: l('Diário', 'Daily journal', 'Diario'),
    description: l('Intenção do dia, gratidão, reflexões e humor.', 'Daily intention, gratitude, reflections and mood.', 'Intención del día, gratitud, reflexiones y ánimo.'),
    build: (lang) => [page(lang, l('Diário', 'Daily journal', 'Diario'), '📔', l(
      `<div data-type="callout" data-emoji="🌅" data-tone="purple">Como quero me sentir hoje?</div><h2>🙏 Sou grato(a) por</h2><ol><li><p></p></li><li><p></p></li><li><p></p></li></ol><h2>🎯 Três prioridades</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>💭 Reflexões</h2><p></p><h2>🌙 Fechamento do dia</h2><p>O que aprendi hoje?</p>`,
      `<div data-type="callout" data-emoji="🌅" data-tone="purple">How do I want to feel today?</div><h2>🙏 I am grateful for</h2><ol><li><p></p></li><li><p></p></li><li><p></p></li></ol><h2>🎯 Top three priorities</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>💭 Reflections</h2><p></p><h2>🌙 End of day</h2><p>What did I learn today?</p>`,
      `<div data-type="callout" data-emoji="🌅" data-tone="purple">¿Cómo quiero sentirme hoy?</div><h2>🙏 Agradezco</h2><ol><li><p></p></li><li><p></p></li><li><p></p></li></ol><h2>🎯 Tres prioridades</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>💭 Reflexiones</h2><p></p><h2>🌙 Cierre del día</h2><p>¿Qué aprendí hoy?</p>`,
    ))],
  },
  {
    id: 'habits', category: 'journal', icon: '✅', cover: 'g:2',
    title: l('Rastreador de hábitos', 'Habit tracker', 'Seguimiento de hábitos'),
    description: l('Marque seus hábitos todos os dias.', 'Check off your habits every day.', 'Marca tus hábitos cada día.'),
    build: (lang) => [database(lang, l('Rastreador de hábitos', 'Habit tracker', 'Seguimiento de hábitos'), '✅', [
      { key: 'day', name: l('Dia', 'Day', 'Día'), type: 'title' },
      { key: 'date', name: l('Data', 'Date', 'Fecha'), type: 'date' },
      { key: 'water', name: l('💧 Água', '💧 Water', '💧 Agua'), type: 'checkbox' },
      { key: 'read', name: l('📚 Leitura', '📚 Reading', '📚 Lectura'), type: 'checkbox' },
      { key: 'move', name: l('🏃 Exercício', '🏃 Exercise', '🏃 Ejercicio'), type: 'checkbox' },
      { key: 'med', name: l('🧘 Meditação', '🧘 Meditation', '🧘 Meditación'), type: 'checkbox' },
      { key: 'mood', name: l('Humor', 'Mood', 'Ánimo'), type: 'rating' },
    ], [0, -1, -2, -3, -4].map((o, i) => ({ day: d(o), date: d(o), water: i !== 2, read: i % 2 === 0, move: i < 3, med: i === 0 || i === 3, mood: [4, 5, 3, 4, 2][i] })), [{ type: 'table', sort: { prop: 'date', dir: 'desc' } }, { type: 'calendar', dateProp: 'date' }])],
  },
  {
    id: 'mood', category: 'journal', icon: '🌈', cover: 'g:10',
    title: l('Registro de humor', 'Mood log', 'Registro de ánimo'),
    description: l('Entenda padrões de humor e energia ao longo do tempo.', 'Understand mood and energy patterns over time.', 'Entiende patrones de ánimo y energía.'),
    build: (lang) => [database(lang, l('Registro de humor', 'Mood log', 'Registro de ánimo'), '🌈', [
      { key: 'note', name: l('Nota', 'Note', 'Nota'), type: 'title' },
      { key: 'date', name: l('Data', 'Date', 'Fecha'), type: 'date' },
      { key: 'mood', name: l('Humor', 'Mood', 'Ánimo'), type: 'select', options: [{ label: l('😄 Ótimo', '😄 Great', '😄 Genial'), color: 'green' }, { label: l('🙂 Bem', '🙂 Good', '🙂 Bien'), color: 'teal' }, { label: l('😐 Neutro', '😐 Neutral', '😐 Neutral'), color: 'gray' }, { label: l('😔 Baixo', '😔 Low', '😔 Bajo'), color: 'orange' }] },
      { key: 'energy', name: l('Energia', 'Energy', 'Energía'), type: 'rating' },
    ], [
      { note: l('Dia produtivo', 'Productive day', 'Día productivo'), date: d(0), mood: l('😄 Ótimo', '😄 Great', '😄 Genial'), energy: 5 },
      { note: l('Cansado depois do ensaio', 'Tired after rehearsal', 'Cansado tras el ensayo'), date: d(-1), mood: l('😐 Neutro', '😐 Neutral', '😐 Neutral'), energy: 3 },
      { note: l('Boa conversa com a equipe', 'Good talk with the team', 'Buena charla con el equipo'), date: d(-2), mood: l('🙂 Bem', '🙂 Good', '🙂 Bien'), energy: 4 },
    ], [{ type: 'calendar', dateProp: 'date' }, { type: 'table' }])],
  },
  // ---------------------------------------------------------------- educação
  {
    id: 'cornell', category: 'education', icon: '🎓', cover: 'g:9',
    title: l('Anotações de aula (Cornell)', 'Class notes (Cornell)', 'Apuntes de clase (Cornell)'),
    description: l('Método Cornell: perguntas, notas e resumo.', 'Cornell method: cues, notes and summary.', 'Método Cornell: preguntas, notas y resumen.'),
    build: (lang) => [page(lang, l('Anotações de aula', 'Class notes', 'Apuntes de clase'), '🎓', l(
      `<p><strong>Disciplina:</strong> · <strong>Professor(a):</strong> · <strong>Data:</strong> ${d(0)}</p><table><tr><th><p>❓ Perguntas-chave</p></th><th><p>📝 Anotações</p></th></tr><tr><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td></tr></table><h2>🧠 Resumo</h2><div data-type="callout" data-emoji="✍️" data-tone="success">Escreva com suas palavras as 3 ideias principais.</div><h2>🔁 Revisão</h2><div data-type="toggle" data-summary="Pergunta 1"><p>Resposta</p></div><div data-type="toggle" data-summary="Pergunta 2"><p>Resposta</p></div>`,
      `<p><strong>Course:</strong> · <strong>Teacher:</strong> · <strong>Date:</strong> ${d(0)}</p><table><tr><th><p>❓ Cues</p></th><th><p>📝 Notes</p></th></tr><tr><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td></tr></table><h2>🧠 Summary</h2><div data-type="callout" data-emoji="✍️" data-tone="success">Write the 3 main ideas in your own words.</div><h2>🔁 Review</h2><div data-type="toggle" data-summary="Question 1"><p>Answer</p></div><div data-type="toggle" data-summary="Question 2"><p>Answer</p></div>`,
      `<p><strong>Materia:</strong> · <strong>Profesor(a):</strong> · <strong>Fecha:</strong> ${d(0)}</p><table><tr><th><p>❓ Preguntas clave</p></th><th><p>📝 Notas</p></th></tr><tr><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td></tr></table><h2>🧠 Resumen</h2><div data-type="callout" data-emoji="✍️" data-tone="success">Escribe con tus palabras las 3 ideas principales.</div><h2>🔁 Repaso</h2><div data-type="toggle" data-summary="Pregunta 1"><p>Respuesta</p></div><div data-type="toggle" data-summary="Pregunta 2"><p>Respuesta</p></div>`,
    ))],
  },
  {
    id: 'study', category: 'education', icon: '📚', cover: 'g:6',
    title: l('Plano de estudos', 'Study plan', 'Plan de estudios'),
    description: l('Matérias, sessões, provas e progresso.', 'Subjects, sessions, exams and progress.', 'Materias, sesiones, exámenes y progreso.'),
    build: (lang) => [database(lang, l('Plano de estudos', 'Study plan', 'Plan de estudios'), '📚', [
      { key: 'topic', name: l('Tópico', 'Topic', 'Tema'), type: 'title' },
      { key: 'subject', name: l('Matéria', 'Subject', 'Materia'), type: 'select', options: [{ label: l('Matemática', 'Math', 'Matemáticas'), color: 'blue' }, { label: l('História', 'History', 'Historia'), color: 'orange' }, { label: l('Inglês', 'English', 'Inglés'), color: 'pink' }] },
      { key: 'status', name: 'Status', type: 'status', options: STATUS },
      { key: 'date', name: l('Data', 'Date', 'Fecha'), type: 'date' },
      { key: 'hours', name: l('Horas', 'Hours', 'Horas'), type: 'number' },
    ], [
      { topic: l('Funções do 2º grau', 'Quadratic functions', 'Funciones cuadráticas'), subject: l('Matemática', 'Math', 'Matemáticas'), status: S.done, date: d(-2), hours: 2 },
      { topic: l('Revolução Industrial', 'Industrial Revolution', 'Revolución Industrial'), subject: l('História', 'History', 'Historia'), status: S.doing, date: d(0), hours: 1.5 },
      { topic: l('Phrasal verbs', 'Phrasal verbs', 'Phrasal verbs'), subject: l('Inglês', 'English', 'Inglés'), status: S.todo, date: d(2), hours: 1 },
    ], [{ type: 'board', groupBy: 'status' }, { type: 'calendar', dateProp: 'date' }, { type: 'table' }])],
  },
  {
    id: 'reading', category: 'education', icon: '📖', cover: 'g:11',
    title: l('Lista de leitura', 'Reading list', 'Lista de lectura'),
    description: l('Livros, autores, status e avaliações.', 'Books, authors, status and ratings.', 'Libros, autores, estado y valoraciones.'),
    build: (lang) => [database(lang, l('Lista de leitura', 'Reading list', 'Lista de lectura'), '📖', [
      { key: 'title', name: l('Título', 'Title', 'Título'), type: 'title' },
      { key: 'author', name: l('Autor(a)', 'Author', 'Autor(a)'), type: 'text' },
      { key: 'status', name: 'Status', type: 'status', options: [{ label: l('Quero ler', 'Want to read', 'Quiero leer'), color: 'gray' }, { label: l('Lendo', 'Reading', 'Leyendo'), color: 'blue' }, { label: l('Lido', 'Read', 'Leído'), color: 'green' }] },
      { key: 'rating', name: l('Nota', 'Rating', 'Nota'), type: 'rating' },
      { key: 'genre', name: l('Gênero', 'Genre', 'Género'), type: 'multi', options: [{ label: l('Romance', 'Fiction', 'Novela'), color: 'pink' }, { label: l('Negócios', 'Business', 'Negocios'), color: 'blue' }, { label: l('Cultura', 'Culture', 'Cultura'), color: 'purple' }] },
    ], [
      { title: 'Dom Casmurro', author: 'Machado de Assis', status: l('Lido', 'Read', 'Leído'), rating: 5, genre: [l('Romance', 'Fiction', 'Novela')] },
      { title: l('Hábitos Atômicos', 'Atomic Habits', 'Hábitos Atómicos'), author: 'James Clear', status: l('Lendo', 'Reading', 'Leyendo'), rating: 4, genre: [l('Negócios', 'Business', 'Negocios')] },
      { title: l('Cem anos de solidão', 'One Hundred Years of Solitude', 'Cien años de soledad'), author: 'Gabriel García Márquez', status: l('Quero ler', 'Want to read', 'Quiero leer'), genre: [l('Romance', 'Fiction', 'Novela'), l('Cultura', 'Culture', 'Cultura')] },
    ], [{ type: 'gallery' }, { type: 'board', groupBy: 'status' }, { type: 'table' }])],
  },
  // ---------------------------------------------------------------- projetos
  {
    id: 'project', category: 'projects', icon: '🚀', cover: 'g:0',
    title: l('Plano de projeto', 'Project plan', 'Plan de proyecto'),
    description: l('Visão, escopo, cronograma e base de tarefas vinculada.', 'Vision, scope, timeline and a linked task database.', 'Visión, alcance, cronograma y tareas vinculadas.'),
    build: (lang) => [
      page(lang, l('Plano de projeto', 'Project plan', 'Plan de proyecto'), '🚀', l(
        `<div data-type="callout" data-emoji="🎯" data-tone="purple">Em uma frase: qual problema este projeto resolve?</div><h2>Objetivos</h2><ul><li><p></p></li></ul><h2>Escopo</h2><table><tr><th><p>Dentro do escopo</p></th><th><p>Fora do escopo</p></th></tr><tr><td><p></p></td><td><p></p></td></tr></table><h2>Cronograma</h2><table><tr><th><p>Etapa</p></th><th><p>Início</p></th><th><p>Fim</p></th></tr><tr><td><p>Pré-produção</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Produção</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Pós-produção</p></td><td><p></p></td><td><p></p></td></tr></table><h2>Riscos</h2><div data-type="toggle" data-summary="Risco 1"><p>Impacto · Probabilidade · Mitigação</p></div><h2>Tarefas</h2><p>Veja a base de tarefas dentro desta página.</p>`,
        `<div data-type="callout" data-emoji="🎯" data-tone="purple">In one sentence: what problem does this project solve?</div><h2>Goals</h2><ul><li><p></p></li></ul><h2>Scope</h2><table><tr><th><p>In scope</p></th><th><p>Out of scope</p></th></tr><tr><td><p></p></td><td><p></p></td></tr></table><h2>Timeline</h2><table><tr><th><p>Phase</p></th><th><p>Start</p></th><th><p>End</p></th></tr><tr><td><p>Pre-production</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Production</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Post-production</p></td><td><p></p></td><td><p></p></td></tr></table><h2>Risks</h2><div data-type="toggle" data-summary="Risk 1"><p>Impact · Likelihood · Mitigation</p></div><h2>Tasks</h2><p>See the task database inside this page.</p>`,
        `<div data-type="callout" data-emoji="🎯" data-tone="purple">En una frase: ¿qué problema resuelve este proyecto?</div><h2>Objetivos</h2><ul><li><p></p></li></ul><h2>Alcance</h2><table><tr><th><p>Dentro del alcance</p></th><th><p>Fuera del alcance</p></th></tr><tr><td><p></p></td><td><p></p></td></tr></table><h2>Cronograma</h2><table><tr><th><p>Etapa</p></th><th><p>Inicio</p></th><th><p>Fin</p></th></tr><tr><td><p>Preproducción</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Producción</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Posproducción</p></td><td><p></p></td><td><p></p></td></tr></table><h2>Riesgos</h2><div data-type="toggle" data-summary="Riesgo 1"><p>Impacto · Probabilidad · Mitigación</p></div><h2>Tareas</h2><p>Mira la base de tareas dentro de esta página.</p>`,
      )),
      { ...tasksDb(lang), parentId: '$root' },
    ],
  },
  {
    id: 'kanban', category: 'tasks', icon: '🗂️', cover: 'g:1',
    title: l('Quadro Kanban', 'Kanban board', 'Tablero Kanban'),
    description: l('Tarefas por status, prioridade e prazo.', 'Tasks by status, priority and due date.', 'Tareas por estado, prioridad y plazo.'),
    build: (lang) => [tasksDb(lang)],
  },
  {
    id: 'todo', category: 'tasks', icon: '☑️', cover: 'g:2',
    title: l('Lista de tarefas', 'To-do list', 'Lista de tareas'),
    description: l('Hoje, esta semana e algum dia.', 'Today, this week and someday.', 'Hoy, esta semana y algún día.'),
    build: (lang) => [page(lang, l('Lista de tarefas', 'To-do list', 'Lista de tareas'), '☑️', l(
      `<h2>☀️ Hoje</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>📅 Esta semana</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>💤 Algum dia</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
      `<h2>☀️ Today</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>📅 This week</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>💤 Someday</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
      `<h2>☀️ Hoy</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>📅 Esta semana</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>💤 Algún día</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
    ))],
  },
  {
    id: 'eisenhower', category: 'tasks', icon: '🧭', cover: 'g:7',
    title: l('Matriz de Eisenhower', 'Eisenhower matrix', 'Matriz de Eisenhower'),
    description: l('Priorize por urgência e importância.', 'Prioritize by urgency and importance.', 'Prioriza por urgencia e importancia.'),
    build: (lang) => [page(lang, l('Matriz de Eisenhower', 'Eisenhower matrix', 'Matriz de Eisenhower'), '🧭', l(
      `<table><tr><th><p>🔥 Urgente e importante — FAÇA</p></th><th><p>📅 Importante, não urgente — AGENDE</p></th></tr><tr><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td></tr><tr><th><p>🤝 Urgente, não importante — DELEGUE</p></th><th><p>🗑️ Nem urgente nem importante — ELIMINE</p></th></tr><tr><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td></tr></table>`,
      `<table><tr><th><p>🔥 Urgent & important — DO</p></th><th><p>📅 Important, not urgent — SCHEDULE</p></th></tr><tr><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td></tr><tr><th><p>🤝 Urgent, not important — DELEGATE</p></th><th><p>🗑️ Neither — DELETE</p></th></tr><tr><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td></tr></table>`,
      `<table><tr><th><p>🔥 Urgente e importante — HAZ</p></th><th><p>📅 Importante, no urgente — AGENDA</p></th></tr><tr><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td></tr><tr><th><p>🤝 Urgente, no importante — DELEGA</p></th><th><p>🗑️ Ni urgente ni importante — ELIMINA</p></th></tr><tr><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td><td><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul></td></tr></table>`,
    ))],
  },
  {
    id: 'event', category: 'projects', icon: '🎭', cover: 'g:8',
    title: l('Produção de evento cultural', 'Cultural event production', 'Producción de evento cultural'),
    description: l('Checklist de pré, produção e pós, com fornecedores.', 'Pre, production and post checklists, with vendors.', 'Checklist de pre, producción y post, con proveedores.'),
    build: (lang) => [page(lang, l('Produção de evento', 'Event production', 'Producción de evento'), '🎭', l(
      `<div data-type="callout" data-emoji="🎪" data-tone="info">Evento: · Data: · Local: · Público estimado:</div><h2>Pré-produção</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Definir conceito e curadoria</p></li><li data-type="taskItem" data-checked="false"><p>Orçamento e captação</p></li><li data-type="taskItem" data-checked="false"><p>Contratos e alvarás</p></li><li data-type="taskItem" data-checked="false"><p>Plano de comunicação</p></li></ul><h2>Produção</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Montagem técnica (som, luz, palco)</p></li><li data-type="taskItem" data-checked="false"><p>Credenciamento e acessibilidade</p></li></ul><h2>Pós-produção</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Prestação de contas</p></li><li data-type="taskItem" data-checked="false"><p>Clipping e relatório de impacto</p></li></ul><h2>Fornecedores</h2><table><tr><th><p>Serviço</p></th><th><p>Contato</p></th><th><p>Valor</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></table>`,
      `<div data-type="callout" data-emoji="🎪" data-tone="info">Event: · Date: · Venue: · Expected audience:</div><h2>Pre-production</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Define concept and curation</p></li><li data-type="taskItem" data-checked="false"><p>Budget and fundraising</p></li><li data-type="taskItem" data-checked="false"><p>Contracts and permits</p></li><li data-type="taskItem" data-checked="false"><p>Communication plan</p></li></ul><h2>Production</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Technical setup (sound, light, stage)</p></li><li data-type="taskItem" data-checked="false"><p>Check-in and accessibility</p></li></ul><h2>Post-production</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Financial report</p></li><li data-type="taskItem" data-checked="false"><p>Press clipping and impact report</p></li></ul><h2>Vendors</h2><table><tr><th><p>Service</p></th><th><p>Contact</p></th><th><p>Price</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></table>`,
      `<div data-type="callout" data-emoji="🎪" data-tone="info">Evento: · Fecha: · Lugar: · Público estimado:</div><h2>Preproducción</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Definir concepto y curaduría</p></li><li data-type="taskItem" data-checked="false"><p>Presupuesto y captación</p></li><li data-type="taskItem" data-checked="false"><p>Contratos y permisos</p></li><li data-type="taskItem" data-checked="false"><p>Plan de comunicación</p></li></ul><h2>Producción</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Montaje técnico (sonido, luz, escenario)</p></li><li data-type="taskItem" data-checked="false"><p>Acreditación y accesibilidad</p></li></ul><h2>Posproducción</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Rendición de cuentas</p></li><li data-type="taskItem" data-checked="false"><p>Clipping e informe de impacto</p></li></ul><h2>Proveedores</h2><table><tr><th><p>Servicio</p></th><th><p>Contacto</p></th><th><p>Valor</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></table>`,
    ))],
  },
  // ---------------------------------------------------------- bases de dados
  {
    id: 'passwords', category: 'databases', icon: '🔐', cover: 'g:4',
    title: l('Cofre de senhas', 'Password vault', 'Bóveda de contraseñas'),
    description: l('Logins, senhas mascaradas, gerador e links — tudo criptografado.', 'Logins, masked passwords, generator and links — all encrypted.', 'Accesos, contraseñas ocultas, generador y enlaces — todo cifrado.'),
    build: (lang) => [database(lang, l('Cofre de senhas', 'Password vault', 'Bóveda de contraseñas'), '🔐', [
      { key: 'service', name: l('Serviço', 'Service', 'Servicio'), type: 'title' },
      { key: 'user', name: l('Usuário / e-mail', 'Username / email', 'Usuario / correo'), type: 'text' },
      { key: 'pass', name: l('Senha', 'Password', 'Contraseña'), type: 'password' },
      { key: 'url', name: 'URL', type: 'url' },
      { key: 'cat', name: l('Categoria', 'Category', 'Categoría'), type: 'select', options: [{ label: l('Trabalho', 'Work', 'Trabajo'), color: 'blue' }, { label: l('Pessoal', 'Personal', 'Personal'), color: 'pink' }, { label: l('Financeiro', 'Finance', 'Finanzas'), color: 'green' }] },
      { key: '2fa', name: '2FA', type: 'checkbox' },
    ], [
      { service: l('E-mail do trabalho', 'Work email', 'Correo del trabajo'), user: 'nome@empresa.com', pass: 'Tr0que-esta-senha!', url: 'https://mail.google.com', cat: l('Trabalho', 'Work', 'Trabajo'), '2fa': true },
      { service: l('Banco', 'Bank', 'Banco'), user: '0000-1', pass: 'Ex3mplo#2026', url: 'https://', cat: l('Financeiro', 'Finance', 'Finanzas'), '2fa': true },
    ], [{ type: 'table' }, { type: 'gallery' }])],
  },
  {
    id: 'links', category: 'databases', icon: '🔗', cover: 'g:6',
    title: l('Links e favoritos', 'Links & bookmarks', 'Enlaces y favoritos'),
    description: l('Guarde sites, referências e ferramentas com tags.', 'Save sites, references and tools with tags.', 'Guarda sitios, referencias y herramientas con etiquetas.'),
    build: (lang) => [database(lang, l('Links e favoritos', 'Links & bookmarks', 'Enlaces y favoritos'), '🔗', [
      { key: 'name', name: l('Nome', 'Name', 'Nombre'), type: 'title' },
      { key: 'url', name: 'URL', type: 'url' },
      { key: 'tags', name: 'Tags', type: 'multi', options: [{ label: l('Referência', 'Reference', 'Referencia'), color: 'purple' }, { label: l('Ferramenta', 'Tool', 'Herramienta'), color: 'blue' }, { label: l('Editais', 'Grants', 'Convocatorias'), color: 'green' }] },
      { key: 'rating', name: l('Relevância', 'Relevance', 'Relevancia'), type: 'rating' },
    ], [
      { name: 'Gestão Cultural Pro', url: 'https://www.gestaoculturalpro.com.br', tags: [l('Referência', 'Reference', 'Referencia'), l('Editais', 'Grants', 'Convocatorias')], rating: 5 },
      { name: 'GitHub — GCP-Neuro Notas', url: 'https://github.com/cliqueprojeto/GCP-Notas', tags: [l('Ferramenta', 'Tool', 'Herramienta')], rating: 4 },
    ], [{ type: 'gallery' }, { type: 'table' }])],
  },
  {
    id: 'contacts', category: 'databases', icon: '📇', cover: 'g:3',
    title: l('Contatos e cadastro', 'Contacts & records', 'Contactos y registros'),
    description: l('Pessoas, empresas, telefones e e-mails.', 'People, companies, phones and emails.', 'Personas, empresas, teléfonos y correos.'),
    build: (lang) => [database(lang, l('Contatos', 'Contacts', 'Contactos'), '📇', [
      { key: 'name', name: l('Nome', 'Name', 'Nombre'), type: 'title' },
      { key: 'company', name: l('Empresa', 'Company', 'Empresa'), type: 'text' },
      { key: 'email', name: 'E-mail', type: 'email' },
      { key: 'phone', name: l('Telefone', 'Phone', 'Teléfono'), type: 'phone' },
      { key: 'type', name: l('Tipo', 'Type', 'Tipo'), type: 'select', options: [{ label: l('Cliente', 'Client', 'Cliente'), color: 'green' }, { label: l('Fornecedor', 'Vendor', 'Proveedor'), color: 'orange' }, { label: l('Patrocinador', 'Sponsor', 'Patrocinador'), color: 'purple' }] },
      { key: 'birthday', name: l('Aniversário', 'Birthday', 'Cumpleaños'), type: 'date' },
    ], [
      { name: 'Ana Souza', company: 'Estúdio Aurora', email: 'ana@exemplo.com', phone: '+55 11 90000-0000', type: l('Cliente', 'Client', 'Cliente') },
      { name: 'Carlos Lima', company: 'Som & Luz', email: 'carlos@exemplo.com', phone: '+55 21 98888-0000', type: l('Fornecedor', 'Vendor', 'Proveedor') },
    ], [{ type: 'table' }, { type: 'board', groupBy: 'type' }])],
  },
  {
    id: 'inventory', category: 'databases', icon: '📦', cover: 'g:7',
    title: l('Inventário', 'Inventory', 'Inventario'),
    description: l('Itens, quantidades, valores e localização.', 'Items, quantities, values and location.', 'Artículos, cantidades, valores y ubicación.'),
    build: (lang) => [database(lang, l('Inventário', 'Inventory', 'Inventario'), '📦', [
      { key: 'item', name: l('Item', 'Item', 'Artículo'), type: 'title' },
      { key: 'qty', name: l('Quantidade', 'Quantity', 'Cantidad'), type: 'number' },
      { key: 'price', name: l('Valor unitário', 'Unit price', 'Precio unitario'), type: 'number', format: 'currency' },
      { key: 'cat', name: l('Categoria', 'Category', 'Categoría'), type: 'select', options: [{ label: l('Áudio', 'Audio', 'Audio'), color: 'blue' }, { label: l('Luz', 'Lighting', 'Luz'), color: 'yellow' }, { label: l('Cenografia', 'Set design', 'Escenografía'), color: 'pink' }] },
      { key: 'where', name: l('Local', 'Location', 'Ubicación'), type: 'text' },
    ], [
      { item: l('Microfone sem fio', 'Wireless mic', 'Micrófono inalámbrico'), qty: 6, price: 890, cat: l('Áudio', 'Audio', 'Audio'), where: 'A1' },
      { item: l('Refletor LED', 'LED spotlight', 'Foco LED'), qty: 12, price: 450, cat: l('Luz', 'Lighting', 'Luz'), where: 'B2' },
      { item: l('Praticável', 'Stage riser', 'Tarima'), qty: 8, price: 300, cat: l('Cenografia', 'Set design', 'Escenografía'), where: 'C1' },
    ])],
  },
  // ------------------------------------------------------------------ pessoal
  {
    id: 'budget', category: 'personal', icon: '💰', cover: 'g:2',
    title: l('Orçamento pessoal', 'Personal budget', 'Presupuesto personal'),
    description: l('Receitas e despesas por categoria, prontas para gráficos.', 'Income and expenses by category, ready for charts.', 'Ingresos y gastos por categoría, listos para gráficos.'),
    build: (lang) => [budgetDb(lang)],
  },
  {
    id: 'travel', category: 'personal', icon: '✈️', cover: 'g:9',
    title: l('Planejamento de viagem', 'Travel planner', 'Planificador de viaje'),
    description: l('Roteiro, checklist de mala, reservas e gastos.', 'Itinerary, packing list, bookings and costs.', 'Itinerario, equipaje, reservas y gastos.'),
    build: (lang) => [page(lang, l('Planejamento de viagem', 'Travel planner', 'Planificador de viaje'), '✈️', l(
      `<div data-type="callout" data-emoji="🗺️" data-tone="info">Destino: · Datas: · Orçamento:</div><h2>Roteiro</h2><table><tr><th><p>Dia</p></th><th><p>Manhã</p></th><th><p>Tarde</p></th><th><p>Noite</p></th></tr><tr><td><p>1</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>2</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr></table><h2>🧳 Mala</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Documentos</p></li><li data-type="taskItem" data-checked="false"><p>Carregadores</p></li><li data-type="taskItem" data-checked="false"><p>Remédios</p></li></ul><h2>Reservas</h2><ul><li><p>Voo:</p></li><li><p>Hospedagem:</p></li></ul>`,
      `<div data-type="callout" data-emoji="🗺️" data-tone="info">Destination: · Dates: · Budget:</div><h2>Itinerary</h2><table><tr><th><p>Day</p></th><th><p>Morning</p></th><th><p>Afternoon</p></th><th><p>Evening</p></th></tr><tr><td><p>1</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>2</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr></table><h2>🧳 Packing</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Documents</p></li><li data-type="taskItem" data-checked="false"><p>Chargers</p></li><li data-type="taskItem" data-checked="false"><p>Medicine</p></li></ul><h2>Bookings</h2><ul><li><p>Flight:</p></li><li><p>Stay:</p></li></ul>`,
      `<div data-type="callout" data-emoji="🗺️" data-tone="info">Destino: · Fechas: · Presupuesto:</div><h2>Itinerario</h2><table><tr><th><p>Día</p></th><th><p>Mañana</p></th><th><p>Tarde</p></th><th><p>Noche</p></th></tr><tr><td><p>1</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>2</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr></table><h2>🧳 Equipaje</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Documentos</p></li><li data-type="taskItem" data-checked="false"><p>Cargadores</p></li><li data-type="taskItem" data-checked="false"><p>Medicinas</p></li></ul><h2>Reservas</h2><ul><li><p>Vuelo:</p></li><li><p>Alojamiento:</p></li></ul>`,
    ))],
  },
  {
    id: 'recipes', category: 'personal', icon: '🍲', cover: 'g:3',
    title: l('Receitas', 'Recipes', 'Recetas'),
    description: l('Galeria de receitas com tempo, dificuldade e notas.', 'Recipe gallery with time, difficulty and notes.', 'Galería de recetas con tiempo, dificultad y notas.'),
    build: (lang) => [database(lang, l('Receitas', 'Recipes', 'Recetas'), '🍲', [
      { key: 'name', name: l('Receita', 'Recipe', 'Receta'), type: 'title' },
      { key: 'time', name: l('Tempo (min)', 'Time (min)', 'Tiempo (min)'), type: 'number' },
      { key: 'level', name: l('Dificuldade', 'Difficulty', 'Dificultad'), type: 'select', options: [{ label: l('Fácil', 'Easy', 'Fácil'), color: 'green' }, { label: l('Média', 'Medium', 'Media'), color: 'yellow' }, { label: l('Difícil', 'Hard', 'Difícil'), color: 'red' }] },
      { key: 'rating', name: l('Nota', 'Rating', 'Nota'), type: 'rating' },
    ], [
      { name: l('Pão de queijo', 'Cheese bread', 'Pan de queso'), time: 40, level: l('Fácil', 'Easy', 'Fácil'), rating: 5 },
      { name: l('Moqueca', 'Moqueca stew', 'Moqueca'), time: 60, level: l('Média', 'Medium', 'Media'), rating: 4 },
    ], [{ type: 'gallery' }, { type: 'table' }])],
  },
  {
    id: 'brain', category: 'personal', icon: '🧠', cover: 'g:8',
    title: l('Segundo cérebro (PARA)', 'Second brain (PARA)', 'Segundo cerebro (PARA)'),
    description: l('Projetos, Áreas, Recursos e Arquivo, ligados por links.', 'Projects, Areas, Resources and Archive, connected by links.', 'Proyectos, Áreas, Recursos y Archivo, conectados.'),
    build: (lang) => {
      const kids = [
        [l('Projetos', 'Projects', 'Proyectos'), '🚀', l('Metas com prazo.', 'Goals with a deadline.', 'Metas con plazo.')],
        [l('Áreas', 'Areas', 'Áreas'), '🧭', l('Responsabilidades contínuas.', 'Ongoing responsibilities.', 'Responsabilidades continuas.')],
        [l('Recursos', 'Resources', 'Recursos'), '📚', l('Temas de interesse e referências.', 'Topics of interest and references.', 'Temas de interés y referencias.')],
        [l('Arquivo', 'Archive', 'Archivo'), '🗄️', l('O que não está mais ativo.', 'Things no longer active.', 'Lo que ya no está activo.')],
      ] as const;
      return [
        page(lang, l('Segundo cérebro', 'Second brain', 'Segundo cerebro'), '🧠', l(
          `<div data-type="callout" data-emoji="🧠" data-tone="purple">Capture tudo, organize por ação e conecte ideias com [[links]]. Use o grafo para enxergar as conexões e pergunte à IA sobre suas notas.</div><h2>Como usar</h2><ol><li><p><strong>Capturar:</strong> anote rápido, sem se preocupar com lugar.</p></li><li><p><strong>Organizar:</strong> mova para Projetos, Áreas, Recursos ou Arquivo.</p></li><li><p><strong>Destilar:</strong> destaque o essencial.</p></li><li><p><strong>Expressar:</strong> transforme em entregas.</p></li></ol>`,
          `<div data-type="callout" data-emoji="🧠" data-tone="purple">Capture everything, organize by action and connect ideas with [[links]]. Use the graph to see connections and ask the AI about your notes.</div><h2>How to use</h2><ol><li><p><strong>Capture:</strong> jot down quickly, anywhere.</p></li><li><p><strong>Organize:</strong> move to Projects, Areas, Resources or Archive.</p></li><li><p><strong>Distill:</strong> highlight what matters.</p></li><li><p><strong>Express:</strong> turn it into output.</p></li></ol>`,
          `<div data-type="callout" data-emoji="🧠" data-tone="purple">Captura todo, organiza por acción y conecta ideas con [[enlaces]]. Usa el grafo para ver conexiones y pregunta a la IA sobre tus notas.</div><h2>Cómo usar</h2><ol><li><p><strong>Capturar:</strong> anota rápido, en cualquier lugar.</p></li><li><p><strong>Organizar:</strong> mueve a Proyectos, Áreas, Recursos o Archivo.</p></li><li><p><strong>Destilar:</strong> resalta lo esencial.</p></li><li><p><strong>Expresar:</strong> conviértelo en entregas.</p></li></ol>`,
        )),
        ...kids.map(([title, icon, text]) => ({ ...page(lang, title, icon, l(`<p>${text.pt}</p>`, `<p>${text.en}</p>`, `<p>${text.es}</p>`)), parentId: '$root' })),
      ];
    },
  },
  // ---------------------------------------------------------------- relatórios
  {
    id: 'dashboard', category: 'reports', icon: '📊', cover: 'g:1',
    title: l('Painel de projetos (BI)', 'Project dashboard (BI)', 'Panel de proyectos (BI)'),
    description: l('Base de tarefas + relatório com 5 gráficos prontos.', 'Task database + report with 5 ready-made charts.', 'Base de tareas + informe con 5 gráficos listos.'),
    build: (lang) => {
      const tasks: any = tasksDb(lang);
      const ids = tasks._ids;
      const w = (p: Partial<Widget>): Widget => ({ id: uid('w'), title: '', type: 'bar', source: '$tasks', groupBy: '', measure: 'count', agg: 'count', filters: [], sort: 'value-desc', span: 1, showLegend: true, ...p } as Widget);
      return [
        {
          type: 'report', title: l('Painel de projetos', 'Project dashboard', 'Panel de proyectos')[lang], icon: '📊', cover: 'g:1',
          report: {
            palette: 'gcp',
            widgets: [
              w({ type: 'kpi', title: l('Tarefas', 'Tasks', 'Tareas')[lang], groupBy: ids.status }),
              w({ type: 'donut', title: l('Por status', 'By status', 'Por estado')[lang], groupBy: ids.status, sort: 'label' }),
              w({ type: 'hbar', title: l('Horas por responsável', 'Hours by owner', 'Horas por responsable')[lang], groupBy: ids.owner, measure: ids.hours, agg: 'sum' }),
              w({ type: 'stacked', title: l('Prioridade × status', 'Priority × status', 'Prioridad × estado')[lang], groupBy: ids.priority, seriesBy: ids.status, span: 2, sort: 'label' }),
              w({ type: 'line', title: l('Entregas por semana', 'Deliveries per week', 'Entregas por semana')[lang], groupBy: ids.due, dateBucket: 'week' }),
            ],
          },
        },
        { ...tasks, parentId: '$root', _ref: '$tasks' },
      ];
    },
  },
];

function tasksDb(lang: Lang): Partial<Page> {
  const who = ['Ana', 'Bruno', 'Carla', 'Diego'];
  const names = [
    l('Escrever projeto para edital', 'Write grant proposal', 'Escribir proyecto para convocatoria'),
    l('Orçamento detalhado', 'Detailed budget', 'Presupuesto detallado'),
    l('Reunião com patrocinador', 'Sponsor meeting', 'Reunión con patrocinador'),
    l('Plano de comunicação', 'Communication plan', 'Plan de comunicación'),
    l('Contratar equipe técnica', 'Hire technical crew', 'Contratar equipo técnico'),
    l('Ensaio geral', 'Dress rehearsal', 'Ensayo general'),
    l('Prestação de contas', 'Financial report', 'Rendición de cuentas'),
    l('Relatório de impacto', 'Impact report', 'Informe de impacto'),
  ];
  const st = [S.done, S.done, S.doing, S.doing, S.todo, S.todo, S.todo, S.doing];
  const pr = [P.high, P.high, P.mid, P.low, P.mid, P.high, P.mid, P.low];
  return database(lang, l('Tarefas', 'Tasks', 'Tareas'), '🗂️', [
    { key: 'task', name: l('Tarefa', 'Task', 'Tarea'), type: 'title' },
    { key: 'status', name: 'Status', type: 'status', options: STATUS },
    { key: 'priority', name: l('Prioridade', 'Priority', 'Prioridad'), type: 'select', options: PRIORITY },
    { key: 'owner', name: l('Responsável', 'Owner', 'Responsable'), type: 'text' },
    { key: 'due', name: l('Prazo', 'Due', 'Plazo'), type: 'date' },
    { key: 'hours', name: l('Horas', 'Hours', 'Horas'), type: 'number' },
    { key: 'done', name: l('Progresso', 'Progress', 'Progreso'), type: 'progress' },
  ], names.map((n, i) => ({ task: n, status: st[i], priority: pr[i], owner: who[i % 4], due: d(i * 3 - 6), hours: [6, 4, 2, 5, 3, 8, 6, 4][i], done: st[i] === S.done ? 100 : st[i] === S.doing ? 50 : 0 })),
  [{ type: 'board', groupBy: 'status' }, { type: 'table' }, { type: 'calendar', dateProp: 'due' }]);
}

function budgetDb(lang: Lang): Partial<Page> {
  const cat = [
    { label: l('Moradia', 'Housing', 'Vivienda'), color: 'blue' },
    { label: l('Alimentação', 'Food', 'Comida'), color: 'orange' },
    { label: l('Transporte', 'Transport', 'Transporte'), color: 'teal' },
    { label: l('Lazer', 'Leisure', 'Ocio'), color: 'pink' },
    { label: l('Salário', 'Salary', 'Salario'), color: 'green' },
  ];
  return database(lang, l('Orçamento pessoal', 'Personal budget', 'Presupuesto personal'), '💰', [
    { key: 'desc', name: l('Descrição', 'Description', 'Descripción'), type: 'title' },
    { key: 'value', name: l('Valor', 'Amount', 'Importe'), type: 'number', format: 'currency' },
    { key: 'type', name: l('Tipo', 'Type', 'Tipo'), type: 'select', options: [{ label: l('Receita', 'Income', 'Ingreso'), color: 'green' }, { label: l('Despesa', 'Expense', 'Gasto'), color: 'red' }] },
    { key: 'cat', name: l('Categoria', 'Category', 'Categoría'), type: 'select', options: cat },
    { key: 'date', name: l('Data', 'Date', 'Fecha'), type: 'date' },
  ], [
    { desc: l('Salário', 'Salary', 'Salario'), value: 6500, type: l('Receita', 'Income', 'Ingreso'), cat: cat[4].label, date: d(-20) },
    { desc: l('Aluguel', 'Rent', 'Alquiler'), value: 1900, type: l('Despesa', 'Expense', 'Gasto'), cat: cat[0].label, date: d(-18) },
    { desc: l('Mercado', 'Groceries', 'Supermercado'), value: 820, type: l('Despesa', 'Expense', 'Gasto'), cat: cat[1].label, date: d(-10) },
    { desc: l('Combustível', 'Fuel', 'Combustible'), value: 350, type: l('Despesa', 'Expense', 'Gasto'), cat: cat[2].label, date: d(-7) },
    { desc: l('Cinema e teatro', 'Movies & theater', 'Cine y teatro'), value: 180, type: l('Despesa', 'Expense', 'Gasto'), cat: cat[3].label, date: d(-3) },
  ]);
}

export const CATEGORY_ICONS: Record<TemplateCategory, string> = {
  work: '💼', journal: '📔', education: '🎓', projects: '🚀', tasks: '✅', databases: '🗄️', personal: '🌿', reports: '📊',
};

/** Cria as páginas de um template no cofre e devolve a página raiz. */
export function instantiate(tpl: Template, lang: Lang, parentId: string | null, create: (p: Partial<Page>) => Page): Page {
  const parts = tpl.build(lang);
  const root = create({ ...strip(parts[0]), parentId, cover: parts[0].cover ?? tpl.cover ?? null });
  const refs: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const made = create({ ...strip(p), parentId: p.parentId === '$root' ? root.id : p.parentId ?? root.id });
    if ((p as any)._ref) refs[(p as any)._ref] = made.id;
  }
  if (root.report) {
    root.report = { ...root.report, widgets: root.report.widgets.map((w) => ({ ...w, source: refs[w.source] || w.source })) };
  }
  return root;
}

function strip(p: Partial<Page>): Partial<Page> {
  const { _ids, _ref, ...rest } = p as any;
  return rest;
}
