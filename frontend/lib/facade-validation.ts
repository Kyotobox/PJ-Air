export type FacadeCategory = 'STOREFRONT' | 'FOOD_PRODUCT' | 'DOCUMENT' | 'SELFIE_PERSON' | 'OTHER';

export interface FacadeValidationResponse {
  success?: boolean;
  isValid: boolean;
  category: FacadeCategory | string;
  confidence?: number;
  status?: 'VERIFIED' | 'REJECTED' | 'PENDING_AUDIT' | 'PENDING_INSPECTION' | string;
  message?: string;
  reason?: string;
}

export const BREAD_FOOD_REJECTION_MESSAGE =
  '⚠️ Foto rechazada: Detectamos un producto alimenticio (pan/pastelería) en lugar de la fachada de su negocio. Por favor suba una foto del frente de su local comercial con aviso o entrada.';

export const DOCUMENT_REJECTION_MESSAGE =
  '⚠️ Foto rechazada: Detectamos un documento en lugar de la fachada exterior de su local comercial. Por favor suba una foto del frente de su local.';

export const SELFIE_REJECTION_MESSAGE =
  '⚠️ Foto rechazada: Detectamos un selfie o retrato personal en lugar de la fachada comercial. Por favor suba una foto del frente de su local.';

export const GENERIC_REJECTION_MESSAGE =
  '⚠️ Foto rechazada: La imagen no corresponde a la fachada de un local comercial. Por favor suba una foto del frente de su negocio con aviso o entrada.';

export function getFacadeRejectionMessage(category?: string, backendReason?: string): string {
  const cat = (category || '').toUpperCase();
  if (cat === 'FOOD_PRODUCT' || cat.includes('FOOD') || cat.includes('BREAD') || cat.includes('PAN')) {
    return BREAD_FOOD_REJECTION_MESSAGE;
  }
  if (cat === 'DOCUMENT' || cat.includes('DOC') || cat.includes('INVOICE') || cat.includes('BILL')) {
    return DOCUMENT_REJECTION_MESSAGE;
  }
  if (cat === 'SELFIE_PERSON' || cat.includes('SELFIE') || cat.includes('PERSON') || cat.includes('PORTRAIT')) {
    return SELFIE_REJECTION_MESSAGE;
  }
  if (backendReason && backendReason.trim()) {
    return backendReason.startsWith('⚠️') ? backendReason : `⚠️ Foto rechazada: ${backendReason}`;
  }
  return GENERIC_REJECTION_MESSAGE;
}

export function parseFacadeValidationResult(data: any): {
  isValid: boolean;
  category: string;
  rejectionMessage: string | null;
  status: string;
  badgeLabel: string;
} {
  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta de validación de fachada inválida o vacía');
  }

  const isValid = Boolean(data.isValid ?? (data.status === 'VERIFIED'));
  const category = (data.category || (isValid ? 'STOREFRONT' : 'OTHER')).toUpperCase();
  const status = data.status || (isValid ? 'VERIFIED' : 'REJECTED');

  if (!isValid) {
    return {
      isValid: false,
      category,
      rejectionMessage: getFacadeRejectionMessage(category, data.message || data.reason),
      status: 'REJECTED',
      badgeLabel: '🔴 Foto Rechazada / Requiere Cambio',
    };
  }

  return {
    isValid: true,
    category,
    rejectionMessage: null,
    status: status === 'PENDING_AUDIT' ? 'PENDING_INSPECTION' : 'VERIFIED',
    badgeLabel: '🟢 Fachada Verificada por IA (Local Comercial)',
  };
}
