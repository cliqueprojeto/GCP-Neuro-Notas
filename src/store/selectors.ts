/**
 * Assinaturas "leves" do cofre: componentes que não mostram o texto das páginas
 * (barra lateral, topo, notificações…) não precisam redesenhar a cada letra digitada.
 */
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useVault } from './vault';
import type { Page } from '../lib/types';

const META: (keyof Page)[] = ['title', 'icon', 'parentId', 'order', 'favorite', 'deletedAt', 'archivedAt', 'purged', 'type', 'tags', 'presentation', 'presFolders', 'mode', 'chat', 'cover', 'remindAt'] as any;

function sameMap(a: Record<string, Page>, b: Record<string, Page>, extra: (keyof Page)[]): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const id of ka) {
    const pa = a[id], pb = b[id];
    if (pa === pb) continue;
    if (!pb) return false;
    for (const k of META) if (pa[k] !== pb[k]) return false;
    for (const k of extra) if (pa[k] !== pb[k]) return false;
  }
  return true;
}

/** Páginas, mas só redesenha quando muda a estrutura (título, ícone, posição, lixeira…), não o conteúdo. */
export function usePagesMeta(): Record<string, Page> {
  return useStoreWithEqualityFn(useVault, (s) => s.pages, (a, b) => sameMap(a, b, []));
}

/** Como usePagesMeta, mas também acompanha bases de dados e quadros (para prazos, alertas e agendas). */
export function usePagesData(): Record<string, Page> {
  return useStoreWithEqualityFn(useVault, (s) => s.pages, (a, b) => sameMap(a, b, ['db', 'canvas'] as (keyof Page)[]));
}
