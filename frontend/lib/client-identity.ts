/**
 * Canonical Universal Client Commercial Identity Helper
 * Sprint S95: Normalización de Identidad Comercial B2B
 *
 * Precedencia estricta para getClientBusinessName:
 * 1. user?.profile?.nickname (si existe y no está vacío tras trim)
 * 2. user?.dba (si existe y no está vacío tras trim)
 * 3. user?.profile?.company_name || user?.company_name (si existe y no está vacío tras trim)
 * 4. user?.legal_business_name (si existe y no está vacío tras trim)
 * 5. user?.profile?.full_name (fallback a contacto personal solo si no hay datos de negocio)
 * 6. user?.email (fallback si no hay nombre)
 * 7. 'Cliente B2B' (fallback final seguro)
 */

export interface ClientProfile {
  id?: string;
  full_name?: string | null;
  nickname?: string | null;
  company_name?: string | null;
  phone?: string | null;
  [key: string]: any;
}

export interface ClientUser {
  id?: string;
  email?: string | null;
  legal_business_name?: string | null;
  dba?: string | null;
  company_name?: string | null;
  signer_name?: string | null;
  signer_phone?: string | null;
  signer_email?: string | null;
  phone?: string | null;
  profile?: ClientProfile | null;
  [key: string]: any;
}

export interface ClientOrder {
  id?: string;
  user_id?: string;
  user?: ClientUser | null;
  email?: string | null;
  phone?: string | null;
  delivery_phone?: string | null;
  [key: string]: any;
}

export interface ClientFullIdentity {
  businessName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
}

export const FALLBACK_BUSINESS_NAME = 'Cliente B2B';

/**
 * Normaliza y limpia una cadena de texto, retornando null si es nula, indefinida,
 * no es de tipo string, o queda vacía tras eliminar espacios en blanco.
 */
export function cleanString(val: unknown): string | null {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

/**
 * Resuelve la entidad usuario a partir de un objeto que puede ser
 * un pedido (Order con relación user) o un usuario directo (User).
 */
function resolveUser(userOrOrder: any): any {
  if (!userOrOrder || typeof userOrOrder !== 'object') {
    return null;
  }
  if (userOrOrder.user && typeof userOrOrder.user === 'object') {
    return userOrOrder.user;
  }
  return userOrOrder;
}

/**
 * Obtiene el nombre comercial canónico del cliente con estricta precedencia B2B.
 */
export function getClientBusinessName(userOrOrder: any): string {
  if (!userOrOrder || typeof userOrOrder !== 'object') {
    return FALLBACK_BUSINESS_NAME;
  }

  const user = resolveUser(userOrOrder);

  // 1. user?.profile?.nickname (si existe y no está vacío tras trim)
  const nickname =
    cleanString(user?.profile?.nickname) ||
    cleanString(userOrOrder?.profile?.nickname);
  if (nickname) return nickname;

  // 2. user?.dba (si existe y no está vacío tras trim)
  const dba =
    cleanString(user?.dba) ||
    cleanString(userOrOrder?.dba);
  if (dba) return dba;

  // 3. user?.profile?.company_name || user?.company_name (si existe y no está vacío tras trim)
  const companyName =
    cleanString(user?.profile?.company_name) ||
    cleanString(user?.company_name) ||
    cleanString(userOrOrder?.profile?.company_name) ||
    cleanString(userOrOrder?.company_name);
  if (companyName) return companyName;

  // 4. user?.legal_business_name (si existe y no está vacío tras trim)
  const legalBusinessName =
    cleanString(user?.legal_business_name) ||
    cleanString(userOrOrder?.legal_business_name);
  if (legalBusinessName) return legalBusinessName;

  // 5. user?.profile?.full_name (fallback a contacto personal solo si no hay datos de negocio)
  const fullName =
    cleanString(user?.profile?.full_name) ||
    cleanString(user?.full_name) ||
    cleanString(userOrOrder?.profile?.full_name) ||
    cleanString(userOrOrder?.full_name);
  if (fullName) return fullName;

  // 6. user?.email (fallback si no hay nombre)
  const email =
    cleanString(user?.email) ||
    cleanString(userOrOrder?.email);
  if (email) return email;

  // 7. 'Cliente B2B' (fallback final seguro)
  return FALLBACK_BUSINESS_NAME;
}

/**
 * Obtiene el nombre del contacto personal / firmante del cliente.
 * Retorna user?.profile?.full_name || user?.signer_name || null.
 */
export function getClientContactName(userOrOrder: any): string | null {
  if (!userOrOrder || typeof userOrOrder !== 'object') {
    return null;
  }

  const user = resolveUser(userOrOrder);

  const fullName =
    cleanString(user?.profile?.full_name) ||
    cleanString(user?.full_name) ||
    cleanString(userOrOrder?.profile?.full_name) ||
    cleanString(userOrOrder?.full_name);
  if (fullName) return fullName;

  const signerName =
    cleanString(user?.signer_name) ||
    cleanString(userOrOrder?.signer_name);
  if (signerName) return signerName;

  return null;
}

/**
 * Obtiene la identidad completa estructurada del cliente:
 * { businessName: string, contactName: string | null, email: string, phone: string | null }
 */
export function getClientFullIdentity(userOrOrder: any): ClientFullIdentity {
  const businessName = getClientBusinessName(userOrOrder);
  const contactName = getClientContactName(userOrOrder);

  let email = '';
  let phone: string | null = null;

  if (userOrOrder && typeof userOrOrder === 'object') {
    const user = resolveUser(userOrOrder);

    email =
      cleanString(user?.email) ||
      cleanString(userOrOrder?.email) ||
      cleanString(user?.signer_email) ||
      cleanString(userOrOrder?.signer_email) ||
      '';

    phone =
      cleanString(user?.profile?.phone) ||
      cleanString(user?.phone) ||
      cleanString(user?.signer_phone) ||
      cleanString(userOrOrder?.profile?.phone) ||
      cleanString(userOrOrder?.phone) ||
      cleanString(userOrOrder?.signer_phone) ||
      cleanString(userOrOrder?.delivery_phone) ||
      null;
  }

  return {
    businessName,
    contactName,
    email,
    phone,
  };
}

/**
 * Validador estricto de entrada para flujos que requieran verificación obligatoria (§6)
 */
export function assertValidClientIdentityInput(input: unknown): asserts input is object {
  if (input === null || input === undefined) {
    throw new TypeError('Invalid client identity input: input cannot be null or undefined');
  }
  if (typeof input !== 'object') {
    throw new TypeError('Invalid client identity input: input must be an object');
  }
}
