/**
 * Canonical Croissant Classification Helper (TASK-92-02)
 * Aligned with plant operations:
 * - Grupo 1: Plain (Base) - 11 products
 * - Grupo 2: De Colores (Masas Especiales) - 10 products
 * - Grupo 3: Small Croissants - 4 products
 */

export type CroissantGroupId = '1' | '2' | '3';

export interface CroissantGroupInfo {
  id: CroissantGroupId;
  key: string;
  name: string;
  headerColorClass: string;
  badgeColorClass: string;
}

export const CROISSANT_GROUPS: Record<CroissantGroupId, CroissantGroupInfo> = {
  '1': {
    id: '1',
    key: 'croissants_g1_plain',
    name: '🥐 Croissants (Grupo 1: Plain / Base)',
    headerColorClass: 'bg-yellow-400 text-black',
    badgeColorClass: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  },
  '2': {
    id: '2',
    key: 'croissants_g2_colores',
    name: '🎨 Croissants (Grupo 2: De Colores / Masas Especiales)',
    headerColorClass: 'bg-sky-500 text-white',
    badgeColorClass: 'bg-sky-100 text-sky-900 border-sky-300',
  },
  '3': {
    id: '3',
    key: 'croissants_g3_small',
    name: '🥐 Croissants (Grupo 3: Small Croissants)',
    headerColorClass: 'bg-emerald-600 text-white',
    badgeColorClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
};

export function resolveCroissantGroup(productName?: string, productionGroup?: string | null): CroissantGroupId {
  if (productionGroup === '1' || productionGroup === '2' || productionGroup === '3') {
    return productionGroup;
  }
  const name = (productName || '').trim().toLowerCase();
  if (name.startsWith('small') || name.includes('small')) {
    return '3';
  }
  if (
    name.includes('almond') ||
    name.includes('banoffee') ||
    name.includes('beef puff') ||
    name.includes('chicken puff') ||
    name.includes('chocolate mousse') ||
    name.includes('fruit danish') ||
    name.includes('new york roll') ||
    name.includes('pain au chocolat') ||
    name.includes('pistachio') ||
    name.includes('raspberry') ||
    name.includes('pain suisse') ||
    name.includes('pan swiss') ||
    name.includes('cheese') ||
    name.includes('turkey bacon')
  ) {
    return '2';
  }
  return '1';
}

export function isCroissantCategory(categoryName?: string): boolean {
  if (!categoryName) return false;
  const norm = categoryName.trim().toLowerCase();
  return norm.includes('croissant');
}
