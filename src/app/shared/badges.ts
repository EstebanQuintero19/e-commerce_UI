import { Product } from '../core/models';

export interface Badge { text: string; kind: 'editorial' | 'low' | 'out'; }

// Etiqueta editorial del admin + estado de stock derivado de las variantes.
export function productBadges(p: Product): Badge[] {
  const out: Badge[] = [];
  const variants = p.variants ?? [];
  const available = variants.map((v) => v.available);
  if (variants.length && available.every((a) => a === 0)) out.push({ text: 'Agotado', kind: 'out' });
  else if (variants.length && available.some((a) => a > 0 && a <= 3)) out.push({ text: 'Últimas unidades', kind: 'low' });
  if (p.badge) out.unshift({ text: p.badge, kind: 'editorial' });
  return out;
}
