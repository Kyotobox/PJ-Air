/**
 * Sprint S102: Omnichannel Search & Date Normalization Engine
 * TASK-102-05: Lógica pura de búsqueda omnicanal, detección de coincidencias
 * inter-pestañas y normalización de fechas de despacho.
 */

export interface OrderItem {
    id: string;
    quantity: number;
    price_at_time: number;
    product_id?: string;
    product?: { name: string; category?: string; image?: string; };
}

export interface Order {
    id: string;
    invoice_number?: string;
    total: number;
    status: string;
    payment_status?: string;
    payment_method?: string;
    zelle_reference?: string;
    zelle_receipt_url?: string;
    check_number?: string;
    check_bank?: string;
    check_amount?: number;
    check_image_url?: string;
    check_verified?: boolean;
    wire_reference?: string;
    wire_receipt_url?: string;
    pending_balance?: number;
    packaging_fee?: number;
    packaging_discount?: number;
    refunded_amount?: number;
    refund_reason?: string;
    stripe_payment_id?: string;
    created_at: string;
    delivery_date?: string;
    payment_due_date?: string;
    tax_amount?: number;
    tax_rate?: number;
    tax_exempt?: boolean;
    tax_legend?: string;
    store_credit_applied?: number;
    notes?: string;
    user?: {
        id?: string;
        email: string;
        account_type?: string;
        tax_exempt?: boolean;
        st120_status?: string;
        st120_document_url?: string;
        legal_business_name?: string;
        dba?: string;
        profile?: {
            full_name?: string;
            phone?: string;
            nickname?: string;
            company_name?: string;
            tax_exempt?: boolean;
            st120_status?: string;
            st120_document_url?: string;
        };
    };
    delivery_user_id?: string;
    delivery_user?: { id: string; profile?: { full_name?: string; }; };
    address?: { address: string; city: string; };
    delivery_type?: string;
    fee_amount?: number;
    fee_method?: string;
    delivery_fee_charged?: number;
    delivery_fee?: number;
    global_discount_percentage?: number;
    global_discount_amount?: number;
    global_discount_reason?: string;
    items?: OrderItem[];
}

export type OrderViewTab = 'orders' | 'pending_verification' | 'drafts' | 'in_hand' | 'deposited' | 'bounced';

export interface CrossTabMatch {
    tab: OrderViewTab;
    label: string;
    count: number;
}

/**
 * TASK-102-05: Normalización de fechas para evitar fallas silenciosas con formatos textuales
 * como "Friday, November 13" o "Friday, November 13, 2026" contra filtros ISO (YYYY-MM-DD).
 */
export function normalizeDispatchDate(rawDate?: string | null, referenceCreatedAt?: string | null): string {
    if (!rawDate || typeof rawDate !== 'string') {
        if (referenceCreatedAt) {
            try {
                const d = new Date(referenceCreatedAt);
                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            } catch (_) {}
        }
        return '';
    }

    const trimmed = rawDate.trim();
    if (!trimmed) {
        if (referenceCreatedAt) {
            try {
                const d = new Date(referenceCreatedAt);
                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            } catch (_) {}
        }
        return '';
    }

    // Direct ISO match (YYYY-MM-DD)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // Quitar prefijo de día de la semana si existe (ej. "Friday, ", "Friday: ", "Viernes, ")
    const clean = trimmed
        .replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[,\s:]*/i, '')
        .trim();

    const hasMonthOrDigits = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|\d{1,2}[/-]\d{1,2})/i.test(clean);

    let toParse = clean;
    const yearMatch = clean.match(/\b(20\d\d|19\d\d)\b/);
    if (!yearMatch && hasMonthOrDigits) {
        let refYear = new Date().getFullYear();
        if (referenceCreatedAt) {
            try {
                const refDate = new Date(referenceCreatedAt);
                if (!isNaN(refDate.getTime())) {
                    refYear = refDate.getFullYear();
                }
            } catch (_) {}
        }
        toParse = `${clean}, ${refYear}`;
    }

    const parsed = new Date(toParse);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    if (referenceCreatedAt) {
        try {
            const d = new Date(referenceCreatedAt);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        } catch (_) {}
    }

    return '';
}

/**
 * TASK-102-05: Parser estricto para Sad Paths (§6)
 */
export function parseDispatchDateStrict(rawDate: string | null | undefined, referenceCreatedAt?: string | null): string {
    if (!rawDate && !referenceCreatedAt) {
        throw new Error('Invalid dispatch date: date and reference are both missing');
    }
    const res = normalizeDispatchDate(rawDate, referenceCreatedAt);
    if (!res) {
        throw new Error(`Unable to parse dispatch date: "${rawDate}"`);
    }
    return res;
}

export const isPendingVerificationOrder = (o: { payment_status?: string }): boolean => {
    return (
        o.payment_status === 'pending_zelle_verification' ||
        o.payment_status === 'pending_check_verification' ||
        o.payment_status === 'pending_wire_verification'
    );
};

export const isDraftOrder = (o: { invoice_number?: string; status?: string; payment_status?: string }): boolean => {
    const normStatus = (o.status || '').toLowerCase().trim();
    return (
        !o.invoice_number &&
        (normStatus === 'pending' || normStatus === 'cancelled' || normStatus === 'cancelado') &&
        !isPendingVerificationOrder(o)
    );
};

export const orderMatchesSearch = (o: Order, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const q = query.trim().toLowerCase();
    return Boolean(
        (o.invoice_number && o.invoice_number.toLowerCase().includes(q)) ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.user?.email && o.user.email.toLowerCase().includes(q)) ||
        (o.user?.profile?.nickname && o.user.profile.nickname.toLowerCase().includes(q)) ||
        (o.user?.dba && o.user.dba.toLowerCase().includes(q)) ||
        (o.user?.legal_business_name && o.user.legal_business_name.toLowerCase().includes(q)) ||
        (o.user?.profile?.company_name && o.user.profile.company_name.toLowerCase().includes(q)) ||
        (o.user?.profile?.full_name && o.user.profile.full_name.toLowerCase().includes(q)) ||
        (o.items && o.items.some(item => item.product?.name && item.product.name.toLowerCase().includes(q))) ||
        (o.items && o.items.some(item => {
            const catObj = item.product?.category;
            const catName = typeof catObj === 'object' && catObj ? (catObj as { name: string }).name : (catObj || '');
            return catName.toLowerCase().includes(q);
        }))
    );
};

export const checkMatchesSearch = (c: any, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const q = query.trim().toLowerCase();
    return Boolean(
        c.check_number?.toLowerCase().includes(q) ||
        c.bank_name?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        c.user?.email?.toLowerCase().includes(q) ||
        c.order_id?.toLowerCase().includes(q)
    );
};

export function computeCrossTabMatches(params: {
    activeTab: OrderViewTab;
    search: string;
    orders: Order[];
    checksReconciliation?: {
        inHand: any[];
        deposited: any[];
        bounced: any[];
    };
}): CrossTabMatch[] {
    const { activeTab, search, orders, checksReconciliation } = params;
    const q = (search || '').trim();
    if (!q) return [];

    const tabsMeta: { tab: OrderViewTab; label: string; count: number }[] = [];

    const countOrders = (orders || []).filter(o => orderMatchesSearch(o, q)).length;
    tabsMeta.push({ tab: 'orders', label: 'Todas las Órdenes', count: countOrders });

    const countPending = (orders || []).filter(o => isPendingVerificationOrder(o) && orderMatchesSearch(o, q)).length;
    tabsMeta.push({ tab: 'pending_verification', label: 'Verificaciones Pendientes', count: countPending });

    const countDrafts = (orders || []).filter(o => isDraftOrder(o) && orderMatchesSearch(o, q)).length;
    tabsMeta.push({ tab: 'drafts', label: 'Borradores / Abandonados', count: countDrafts });

    const inHandChecks = checksReconciliation?.inHand || [];
    const countInHand = inHandChecks.filter(c => checkMatchesSearch(c, q)).length;
    tabsMeta.push({ tab: 'in_hand', label: 'Cheques en Cartera', count: countInHand });

    const depositedChecks = checksReconciliation?.deposited || [];
    const countDeposited = depositedChecks.filter(c => checkMatchesSearch(c, q)).length;
    tabsMeta.push({ tab: 'deposited', label: 'Cheques Depositados', count: countDeposited });

    const bouncedChecks = checksReconciliation?.bounced || [];
    const countBounced = bouncedChecks.filter(c => checkMatchesSearch(c, q)).length;
    tabsMeta.push({ tab: 'bounced', label: 'Cheques Rebotados', count: countBounced });

    return tabsMeta.filter(t => t.tab !== activeTab && t.count > 0);
}

export function computeCrossTabMatchesStrict(params: any): CrossTabMatch[] {
    if (!params || typeof params !== 'object') {
        throw new Error('Invalid arguments: params must be an object');
    }
    if (!Array.isArray(params.orders)) {
        throw new Error('Invalid arguments: orders must be an array');
    }
    return computeCrossTabMatches(params);
}
