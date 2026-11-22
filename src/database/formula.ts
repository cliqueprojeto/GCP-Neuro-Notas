/**
 * Fórmulas entre campos de uma base de dados.
 *
 * Sintaxe parecida com a do Excel/Notion:
 *   {Quant.} * {Valor unitário}
 *   SE({Status} = "Concluído"; "✅"; "⏳")
 *   ARRED({Horas} / 8; 1) & " dias"
 *   DIAS({Prazo}; HOJE())
 *
 * Argumentos podem ser separados por ";" ou ",". Nomes de função aceitam
 * português, inglês e espanhol. Nada é executado com eval.
 */

export type FValue = number | string | boolean | null;

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: '('; v: '(' }
  | { t: ')'; v: ')' }
  | { t: 'sep'; v: ',' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '{') {
      const j = src.indexOf('}', i);
      if (j < 0) throw new Error('"}" faltando');
      out.push({ t: 'ref', v: src.slice(i + 1, j).trim() });
      i = j + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) s += src[j++];
      if (j >= src.length) throw new Error('aspas não fechadas');
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-zÀ-ÿ_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-zÀ-ÿ_0-9.]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '<>', '!=', '==', '&&', '||'].includes(two)) {
      out.push({ t: 'op', v: two === '!=' ? '<>' : two === '==' ? '=' : two === '&&' ? 'AND' : two === '||' ? 'OR' : two });
      i += 2;
      continue;
    }
    if ('+-*/%^&=<>'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: '(', v: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')', v: ')' }); i++; continue; }
    if (c === ',' || c === ';') { out.push({ t: 'sep', v: ',' }); i++; continue; }
    throw new Error(`caractere inesperado "${c}"`);
  }
  return out;
}

type Node =
  | { k: 'lit'; v: FValue }
  | { k: 'ref'; name: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const PREC: Record<string, number> = { OR: 1, AND: 2, '=': 3, '<>': 3, '<': 3, '>': 3, '<=': 3, '>=': 3, '&': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 7 };

function parse(tokens: Tok[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const primary = (): Node => {
    const tk = tokens[p++];
    if (!tk) throw new Error('expressão incompleta');
    if (tk.t === 'num') return { k: 'lit', v: tk.v };
    if (tk.t === 'str') return { k: 'lit', v: tk.v };
    if (tk.t === 'ref') return { k: 'ref', name: tk.v };
    if (tk.t === 'op' && (tk.v === '-' || tk.v === '+')) return { k: 'un', op: tk.v, a: expr(7) };
    if (tk.t === '(') {
      const e = expr(0);
      if (tokens[p++]?.t !== ')') throw new Error('")" faltando');
      return e;
    }
    if (tk.t === 'id') {
      const up = tk.v.toUpperCase();
      if (peek()?.t === '(') {
        p++;
        const args: Node[] = [];
        if (peek()?.t !== ')') {
          for (;;) {
            args.push(expr(0));
            if (peek()?.t === 'sep') { p++; continue; }
            break;
          }
        }
        if (tokens[p++]?.t !== ')') throw new Error('")" faltando');
        return { k: 'call', fn: up, args };
      }
      if (['TRUE', 'VERDADEIRO', 'VERDADERO'].includes(up)) return { k: 'lit', v: true };
      if (['FALSE', 'FALSO'].includes(up)) return { k: 'lit', v: false };
      if (['AND', 'E', 'Y', 'OR', 'OU', 'O', 'NOT', 'NAO', 'NÃO', 'NO'].includes(up)) throw new Error(`use ${up}(…) como função`);
      return { k: 'ref', name: tk.v }; // nome de campo sem chaves
    }
    throw new Error('expressão inválida');
  };
  const expr = (min: number): Node => {
    let left = primary();
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== 'op') break;
      const pr = PREC[tk.v];
      if (pr === undefined || pr < min) break;
      p++;
      const right = expr(tk.v === '^' ? pr : pr + 1);
      left = { k: 'bin', op: tk.v, a: left, b: right };
    }
    return left;
  };
  const out = expr(0);
  if (p < tokens.length) throw new Error('sobrou texto na fórmula');
  return out;
}

const num = (v: FValue): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v == null || v === '') return 0;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return Date.parse(s.slice(0, 10) + 'T00:00:00') / 86400000;
  const n = Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const str = (v: FValue): string => (v == null ? '' : typeof v === 'boolean' ? (v ? 'VERDADEIRO' : 'FALSO') : typeof v === 'number' ? String(Math.round(v * 1e10) / 1e10) : v);
const truthy = (v: FValue) => (typeof v === 'string' ? v !== '' && v.toUpperCase() !== 'FALSO' && v.toUpperCase() !== 'FALSE' : !!v);
const eq = (a: FValue, b: FValue) => {
  if (typeof a === 'number' || typeof b === 'number') return num(a) === num(b);
  return str(a).trim().toLowerCase() === str(b).trim().toLowerCase();
};
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDate = (v: FValue): Date | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v > 1e11 ? v : v * 86400000);
  const s = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const ALIASES: Record<string, string> = {
  SE: 'IF', SI: 'IF', E: 'AND', Y: 'AND', OU: 'OR', O: 'OR', NAO: 'NOT', NÃO: 'NOT', NO: 'NOT',
  SOMA: 'SUM', SUMA: 'SUM', MEDIA: 'AVG', MÉDIA: 'AVG', PROMEDIO: 'AVG', AVERAGE: 'AVG', ARRED: 'ROUND', REDONDEAR: 'ROUND',
  ARREDONDAR: 'ROUND', ABSOLUTO: 'ABS', CONCATENAR: 'CONCAT', CONCATENATE: 'CONCAT', NÚM: 'NUM', NUMERO: 'NUM', VALOR: 'NUM', VALUE: 'NUM',
  TEXTO: 'TEXT', MAIUSCULA: 'UPPER', MAIÚSCULA: 'UPPER', MAYUSC: 'UPPER', MINUSCULA: 'LOWER', MINÚSCULA: 'LOWER', MINUSC: 'LOWER',
  NÚMCARACT: 'LEN', LARGO: 'LEN', HOJE: 'TODAY', HOY: 'TODAY', AGORA: 'NOW', AHORA: 'NOW', DIAS: 'DAYS', ANO: 'YEAR', AÑO: 'YEAR',
  MES: 'MONTH', MÊS: 'MONTH', DIA: 'DAY', SEERRO: 'IFERROR', SIERROR: 'IFERROR', VAZIO: 'ISBLANK', ÉCÉL_VAZIA: 'ISBLANK', ESBLANCO: 'ISBLANK',
  CONTEM: 'CONTAINS', CONTÉM: 'CONTAINS', CONTIENE: 'CONTAINS', ENTRE: 'BETWEEN', PISO: 'FLOOR', TETO: 'CEIL', TECHO: 'CEIL',
  POTENCIA: 'POW', POTÊNCIA: 'POW', RAIZ: 'SQRT', SES: 'IFS', SI_CONJUNTO: 'IFS', DATAADD: 'DATEADD', SOMARDIAS: 'DATEADD', SUMARDIAS: 'DATEADD',
};

export const FUNCTION_HELP: { fn: string; pt: string; en: string; es: string }[] = [
  { fn: 'SE(cond; sim; não)', pt: 'Condição', en: 'IF(cond, yes, no)', es: 'SI(cond; sí; no)' },
  { fn: 'SES(c1; r1; c2; r2…)', pt: 'Várias condições', en: 'IFS(c1, r1, c2, r2…)', es: 'Varias condiciones' },
  { fn: 'ENTRE(v; mín; máx)', pt: 'Está no intervalo?', en: 'BETWEEN(v, min, max)', es: '¿Está en el rango?' },
  { fn: 'SOMA(a; b…)', pt: 'Soma', en: 'SUM(a, b…)', es: 'SUMA(a; b…)' },
  { fn: 'MEDIA(a; b…)', pt: 'Média', en: 'AVG(a, b…)', es: 'PROMEDIO(a; b…)' },
  { fn: 'MIN / MAX', pt: 'Menor / maior', en: 'Smallest / largest', es: 'Menor / mayor' },
  { fn: 'ARRED(v; casas)', pt: 'Arredonda', en: 'ROUND(v, digits)', es: 'REDONDEAR(v; dec)' },
  { fn: 'E(a; b) / OU(a; b)', pt: 'E / ou lógico', en: 'AND(a, b) / OR(a, b)', es: 'Y(a; b) / O(a; b)' },
  { fn: 'DIAS(fim; início)', pt: 'Dias entre datas', en: 'DAYS(end, start)', es: 'DIAS(fin; inicio)' },
  { fn: 'HOJE()', pt: 'Data de hoje', en: 'TODAY()', es: 'HOY()' },
  { fn: 'SOMARDIAS(data; n)', pt: 'Soma dias a uma data', en: 'DATEADD(date, n)', es: 'SUMARDIAS(fecha; n)' },
  { fn: 'CONTEM(texto; parte)', pt: 'Texto contém', en: 'CONTAINS(text, part)', es: 'CONTIENE(texto; parte)' },
  { fn: 'a & b', pt: 'Junta textos', en: 'Joins text', es: 'Une textos' },
];

function call(fn: string, args: Node[], ev: (n: Node) => FValue): FValue {
  const F = ALIASES[fn] || fn;
  const vals = () => args.map(ev);
  const nums = () => vals().map(num);
  switch (F) {
    case 'IF': return truthy(ev(args[0])) ? (args[1] ? ev(args[1]) : true) : args[2] ? ev(args[2]) : '';
    case 'IFS': {
      for (let i = 0; i + 1 < args.length; i += 2) if (truthy(ev(args[i]))) return ev(args[i + 1]);
      return args.length % 2 ? ev(args[args.length - 1]) : '';
    }
    case 'IFERROR': try { return ev(args[0]); } catch { return args[1] ? ev(args[1]) : ''; }
    case 'AND': return vals().every(truthy);
    case 'OR': return vals().some(truthy);
    case 'NOT': return !truthy(ev(args[0]));
    case 'BETWEEN': { const [v, a, b] = nums(); return v >= Math.min(a, b) && v <= Math.max(a, b); }
    case 'SUM': return nums().reduce((s, x) => s + x, 0);
    case 'AVG': { const n = nums(); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : 0; }
    case 'MIN': return Math.min(...nums());
    case 'MAX': return Math.max(...nums());
    case 'ROUND': { const [v, d = 0] = nums(); const f = 10 ** d; return Math.round(v * f) / f; }
    case 'FLOOR': return Math.floor(num(ev(args[0])));
    case 'CEIL': return Math.ceil(num(ev(args[0])));
    case 'ABS': return Math.abs(num(ev(args[0])));
    case 'SQRT': return Math.sqrt(num(ev(args[0])));
    case 'POW': { const [a, b] = nums(); return a ** b; }
    case 'NUM': return num(ev(args[0]));
    case 'TEXT': return str(ev(args[0]));
    case 'CONCAT': return vals().map(str).join('');
    case 'UPPER': return str(ev(args[0])).toUpperCase();
    case 'LOWER': return str(ev(args[0])).toLowerCase();
    case 'LEN': return str(ev(args[0])).length;
    case 'CONTAINS': return str(ev(args[0])).toLowerCase().includes(str(ev(args[1])).toLowerCase());
    case 'ISBLANK': { const v = ev(args[0]); return v == null || v === ''; }
    case 'TODAY': return dateKey(new Date());
    case 'NOW': return new Date().toISOString();
    case 'DAYS': {
      const a = toDate(ev(args[0])), b = toDate(ev(args[1]));
      if (!a || !b) return '';
      return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
    }
    case 'DATEADD': {
      const d = toDate(ev(args[0]));
      if (!d) return '';
      d.setDate(d.getDate() + num(ev(args[1])));
      return dateKey(d);
    }
    case 'YEAR': return toDate(ev(args[0]))?.getFullYear() ?? '';
    case 'MONTH': { const d = toDate(ev(args[0])); return d ? d.getMonth() + 1 : ''; }
    case 'DAY': return toDate(ev(args[0]))?.getDate() ?? '';
  }
  throw new Error(`função desconhecida ${fn}`);
}

const cache = new Map<string, Node>();
export function compile(src: string): Node {
  let n = cache.get(src);
  if (!n) {
    n = parse(tokenize(src.replace(/^=/, '')));
    if (cache.size > 500) cache.clear();
    cache.set(src, n);
  }
  return n;
}

/** Avalia uma fórmula. `resolve` devolve o valor do campo pelo nome. */
export function evaluate(src: string, resolve: (name: string) => FValue): FValue {
  if (!src.trim()) return '';
  const ev = (n: Node): FValue => {
    switch (n.k) {
      case 'lit': return n.v;
      case 'ref': return resolve(n.name);
      case 'un': return n.op === '-' ? -num(ev(n.a)) : num(ev(n.a));
      case 'call': return call(n.fn, n.args, ev);
      case 'bin': {
        if (n.op === 'AND') return truthy(ev(n.a)) && truthy(ev(n.b));
        if (n.op === 'OR') return truthy(ev(n.a)) || truthy(ev(n.b));
        const a = ev(n.a), b = ev(n.b);
        switch (n.op) {
          case '+': return num(a) + num(b);
          case '-': return num(a) - num(b);
          case '*': return num(a) * num(b);
          case '/': return num(b) === 0 ? '' : num(a) / num(b);
          case '%': return num(a) % num(b);
          case '^': return num(a) ** num(b);
          case '&': return str(a) + str(b);
          case '=': return eq(a, b);
          case '<>': return !eq(a, b);
          case '<': return typeof a === 'string' && typeof b === 'string' && isNaN(+a) ? a < b : num(a) < num(b);
          case '>': return typeof a === 'string' && typeof b === 'string' && isNaN(+a) ? a > b : num(a) > num(b);
          case '<=': return num(a) <= num(b);
          case '>=': return num(a) >= num(b);
        }
      }
    }
    return '';
  };
  return ev(compile(src));
}

/** Verifica a sintaxe; devolve a mensagem de erro ou null. */
export function checkFormula(src: string): string | null {
  try {
    compile(src);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export const toNumber = num;
export const toText = str;
