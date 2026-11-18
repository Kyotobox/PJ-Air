/**
 * GOOGLE ADS WHOLESALE PHONE COMPLIANCE HELPER (Sprint S98)
 * 
 * SSSoT for Google Ads Call Extension & Click-to-Call Compliance.
 * Google Ads requires the exact phone number displayed in visible plain text
 * on the verified landing page / footer / header.
 */

export const GOOGLE_ADS_WHOLESALE_CONFIG = {
    exactDisplayText: 'Wholesale: (347) 761-2687',
    phoneNumberFormatted: '(347) 761-2687',
    e164PhoneNumber: '+13477612687',
    telHref: 'tel:+13477612687',
    areaCode: '347',
    prefix: '761',
    lineNumber: '2687',
    countryCode: '+1',
    businessDepartment: 'Wholesale & B2B Sales',
} as const;

/**
 * Validates and normalizes phone number to RFC 3966 `tel:` URI.
 * Throws on malformed or empty phone strings (Sad Path §6).
 */
export function formatWholesaleTelUri(rawPhone: string): string {
    if (!rawPhone || typeof rawPhone !== 'string') {
        throw new Error('[GOOGLE_ADS_PHONE_ERR] Phone number string must not be empty');
    }

    const digitsOnly = rawPhone.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
        return `tel:+1${digitsOnly}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return `tel:+${digitsOnly}`;
    }

    throw new Error(`[GOOGLE_ADS_PHONE_ERR] Invalid US phone format for Google Ads: "${rawPhone}". Expected 10 digits or 11 digits with US country code.`);
}

/**
 * Validates whether an HTML string or text snippet contains the mandatory
 * Google Ads crawler text and tel protocol.
 * Returns true or throws specific descriptive validation errors (Sad Path §6).
 */
export function validateGoogleAdsPhoneCompliance(content: string): {
    hasExactText: boolean;
    hasTelProtocol: boolean;
    compliant: boolean;
} {
    if (!content || typeof content !== 'string') {
        throw new Error('[GOOGLE_ADS_COMPLIANCE_ERR] Content to validate cannot be null or empty');
    }

    const hasExactText = content.includes(GOOGLE_ADS_WHOLESALE_CONFIG.exactDisplayText);
    if (!hasExactText) {
        throw new Error(`[GOOGLE_ADS_COMPLIANCE_ERR] Missing exact Google Ads required text: "${GOOGLE_ADS_WHOLESALE_CONFIG.exactDisplayText}"`);
    }

    const hasTelProtocol = content.includes(GOOGLE_ADS_WHOLESALE_CONFIG.telHref);
    if (!hasTelProtocol) {
        throw new Error(`[GOOGLE_ADS_COMPLIANCE_ERR] Missing direct dial click-to-call link: "${GOOGLE_ADS_WHOLESALE_CONFIG.telHref}"`);
    }

    return {
        hasExactText,
        hasTelProtocol,
        compliant: true,
    };
}

/**
 * Deconstructs and parses wholesale phone components for structured metadata.
 */
export function parseWholesalePhone(phoneStr: string): {
    countryCode: string;
    areaCode: string;
    prefix: string;
    lineNumber: string;
} {
    if (!phoneStr) {
        throw new Error('[GOOGLE_ADS_PHONE_PARSE_ERR] Phone string is required');
    }

    const digits = phoneStr.replace(/\D/g, '');
    let clean10 = digits;
    if (digits.length === 11 && digits.startsWith('1')) {
        clean10 = digits.slice(1);
    }

    if (clean10.length !== 10) {
        throw new Error(`[GOOGLE_ADS_PHONE_PARSE_ERR] Cannot parse phone with ${clean10.length} digits: "${phoneStr}"`);
    }

    return {
        countryCode: '+1',
        areaCode: clean10.slice(0, 3),
        prefix: clean10.slice(3, 6),
        lineNumber: clean10.slice(6, 10),
    };
}
