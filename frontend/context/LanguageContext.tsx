'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import type { Translations } from '@/lib/i18n/en';

export type Locale = 'en' | 'es';

const TRANSLATIONS: Record<Locale, Translations> = { en, es };

export const DEFAULT_LOCALE_KEY = 'app_default_locale';
export const USER_LOCALE_KEY = 'app_user_locale';

interface LanguageContextType {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  /** Admin-only: sets default locale for ALL users (persisted in localStorage) */
  setDefaultLocale: (locale: Locale) => void;
  defaultLocale: Locale;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  t: en,
  setLocale: () => {},
  setDefaultLocale: () => {},
  defaultLocale: 'en',
});

/**
 * Evaluates whether URL query parameters indicate incoming ad traffic in Spanish
 * (?lang=es or ?utm_content=es or utm_campaign contains 'es' or 'spanish')
 */
export function isSpanishAdTraffic(search: string): boolean {
  if (!search) return false;
  try {
    const cleanSearch = search.startsWith('?') ? search.slice(1) : search;
    const params = new URLSearchParams(cleanSearch);
    const lang = params.get('lang')?.toLowerCase();
    const utmContent = params.get('utm_content')?.toLowerCase();
    const utmCampaign = params.get('utm_campaign')?.toLowerCase();

    if (lang === 'es' || utmContent === 'es') {
      return true;
    }
    if (utmCampaign && (utmCampaign.includes('es') || utmCampaign.includes('spanish'))) {
      return true;
    }
  } catch (e) {
    // INTENTIONAL: Malformed URL query string ignored
  }
  return false;
}

/**
 * Evaluates whether the client's browser language begins with Spanish ('es')
 */
export function isSpanishBrowserLanguage(navigatorLang?: string): boolean {
  if (!navigatorLang) return false;
  return navigatorLang.toLowerCase().startsWith('es');
}

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [defaultLocale, setDefaultLocaleState] = useState<Locale>('en');
  const [locale, setLocaleState] = useState<Locale>('en');

  /** Change language for the current user session */
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_LOCALE_KEY, l);
      }
    } catch (e) {
      // INTENTIONAL: Handle localStorage access restrictions
    }
  };

  /** Admin sets the default for everyone (new sessions / no personal pref) */
  const setDefaultLocale = (l: Locale) => {
    setDefaultLocaleState(l);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(DEFAULT_LOCALE_KEY, l);
      }
    } catch (e) {
      // INTENTIONAL: Handle localStorage access restrictions
    }
    // Apply immediately for current session too
    setLocale(l);
  };

  useEffect(() => {
    // 1. Read the admin-set default locale (fallback: 'en')
    let storedDefault: Locale = 'en';
    let userPref: Locale | null = null;
    try {
      storedDefault = (localStorage.getItem(DEFAULT_LOCALE_KEY) as Locale) || 'en';
      userPref = localStorage.getItem(USER_LOCALE_KEY) as Locale | null;
    } catch (e) {
      // INTENTIONAL: Handle localStorage access restrictions
    }
    setDefaultLocaleState(storedDefault);

    // 2. Check URL parameters for Spanish ad traffic: lang=es, utm_content=es, utm_campaign with es/spanish
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (isSpanishAdTraffic(search)) {
      setLocale('es');
      return;
    }

    // 3. Check existing user preference
    if (userPref) {
      setLocaleState(userPref);
      return;
    }

    // 4. If no previous saved preference and navigator.language starts with 'es'
    const navLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
    if (isSpanishBrowserLanguage(navLang)) {
      setLocale('es');
      return;
    }

    // 5. Fallback to default
    setLocaleState(storedDefault);
  }, []);

  return (
    <LanguageContext.Provider
      value={{ locale, t: TRANSLATIONS[locale], setLocale, setDefaultLocale, defaultLocale }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
