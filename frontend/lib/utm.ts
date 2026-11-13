/**
 * UTM & Ad Attribution helper for Jhoanes Bakery (Sprint S84C).
 * Captures query parameters (utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid)
 * and persists them in localStorage with key 'jhoanes_utm_attribution' for cross-navigation attribution.
 */

export interface UtmAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  captured_at?: string;
}

export const UTM_STORAGE_KEY = 'jhoanes_utm_attribution';

export const UTM_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
] as const;

/**
 * Extracts UTM and attribution parameters from a search string or URL.
 */
export function parseUtmParams(urlOrQuery?: string | URLSearchParams | null): UtmAttribution | null {
  if (typeof window === 'undefined' && !urlOrQuery) {
    return null;
  }

  let searchParams: URLSearchParams | null = null;

  try {
    if (urlOrQuery instanceof URLSearchParams) {
      searchParams = urlOrQuery;
    } else if (typeof urlOrQuery === 'string') {
      const q = urlOrQuery.includes('?') ? urlOrQuery.split('?')[1] : urlOrQuery;
      searchParams = new URLSearchParams(q);
    } else if (typeof window !== 'undefined' && window.location) {
      searchParams = new URLSearchParams(window.location.search);
    }
  } catch {
    return null;
  }

  if (!searchParams) return null;

  const result: UtmAttribution = {};
  let hasAny = false;

  for (const key of UTM_PARAM_KEYS) {
    const val = searchParams.get(key);
    if (val && typeof val === 'string' && val.trim().length > 0) {
      result[key] = val.trim();
      hasAny = true;
    }
  }

  if (!hasAny) {
    return null;
  }

  result.captured_at = new Date().toISOString();
  return result;
}

/**
 * Persists UTM attribution to localStorage.
 */
export function storeUtm(utm: UtmAttribution): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // Silently ignore storage quota or private browsing errors
  }
}

/**
 * Retrieves the stored UTM attribution from localStorage.
 */
export function getStoredUtm(): UtmAttribution | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as UtmAttribution;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears stored UTM attribution.
 */
export function clearStoredUtm(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Captures UTM parameters from current URL (or provided query) and stores them if present.
 * If already stored, does not overwrite with null. Returns current stored attribution.
 */
export function captureAndStoreUtm(urlOrQuery?: string | URLSearchParams | null): UtmAttribution | null {
  const parsed = parseUtmParams(urlOrQuery);
  if (parsed) {
    storeUtm(parsed);
    return parsed;
  }
  return getStoredUtm();
}

/**
 * Helper to produce human-readable source label & badge for display in Admin UI.
 */
export function formatUtmDisplay(utm?: {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  fbclid?: string | null;
} | null): {
  sourceLabel: string;
  badgeClass: string;
  campaignLabel?: string;
  detailLabel?: string;
  isDirect: boolean;
} {
  if (!utm || (!utm.utm_source && !utm.utm_campaign && !utm.fbclid && !utm.utm_medium)) {
    return {
      sourceLabel: 'Directo',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
      isDirect: true,
    };
  }

  const s = (utm.utm_source || '').toLowerCase().trim();
  const m = (utm.utm_medium || '').toLowerCase().trim();
  const c = utm.utm_campaign?.trim();
  const content = utm.utm_content?.trim();

  let sourceLabel = utm.utm_source?.trim() || 'Campaña';
  let badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';

  if (s.includes('meta') || s.includes('facebook') || s.includes('instagram') || s.includes('ig') || s.includes('fb') || utm.fbclid) {
    if (s.includes('instagram') || s.includes('ig')) {
      sourceLabel = 'Meta Ads (Instagram)';
    } else if (s.includes('facebook') || s.includes('fb')) {
      sourceLabel = 'Meta Ads (Facebook)';
    } else {
      sourceLabel = 'Meta Ads';
    }
    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (s.includes('google') || s.includes('adwords') || s.includes('gads')) {
    sourceLabel = 'Google Ads';
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s.includes('tiktok')) {
    sourceLabel = 'TikTok Ads';
    badgeClass = 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
  } else if (s.includes('email') || s.includes('newsletter')) {
    sourceLabel = 'Email / Newsletter';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (utm.utm_source) {
    sourceLabel = utm.utm_source.charAt(0).toUpperCase() + utm.utm_source.slice(1);
  }

  const campaignLabel = c ? `Campaña: ${c}` : undefined;
  const detailLabel = m ? (content ? `${m} • ${content}` : m) : content;

  return {
    sourceLabel,
    badgeClass,
    campaignLabel,
    detailLabel,
    isDirect: false,
  };
}
