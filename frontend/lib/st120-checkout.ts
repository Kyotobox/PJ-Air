/**
 * Business and calculation logic for ST-120 Tax Exemption and Early Morning Security Access
 * Sprint S79: TASK-79-03, TASK-79-04, TASK-79-05
 */

export const NY_COMBINED_SALES_TAX_RATE = 8.875; // Standard NYC combined rate

export interface TaxCalculationResult {
    salesTax: number;
    salesTaxRate: number;
    isExempt: boolean;
    legend: string | null;
}

/**
 * Calculates sales tax for checkout orders based on ST-120 exemption status.
 */
export function calculateCheckoutSalesTax(
    discountedSubtotal: number,
    isTaxExempt: boolean,
    customRate: number = NY_COMBINED_SALES_TAX_RATE
): TaxCalculationResult {
    if (typeof discountedSubtotal !== 'number' || isNaN(discountedSubtotal) || discountedSubtotal < 0) {
        throw new Error('Invalid discounted subtotal: must be a non-negative number');
    }

    if (typeof customRate !== 'number' || isNaN(customRate) || customRate < 0) {
        throw new Error('Invalid tax rate: must be a non-negative number');
    }

    if (isTaxExempt) {
        return {
            salesTax: 0.0,
            salesTaxRate: 0.0,
            isExempt: true,
            legend: 'Exempt from NY State and Local Sales and Use Tax under NYS DTF Form ST-120 (Resale Certificate)',
        };
    }

    const calculated = Math.round((discountedSubtotal * (customRate / 100) + Number.EPSILON) * 100) / 100;
    return {
        salesTax: calculated,
        salesTaxRate: customRate,
        isExempt: false,
        legend: null,
    };
}

export interface NightAccessData {
    access_code?: string | null;
    has_key?: boolean | null;
    key_location?: string | null;
    fridge_access_required?: boolean | null;
    delivery_notes?: string | null;
}

/**
 * Validates and normalizes early morning security access details.
 */
export function validateNightAccessPayload(data: NightAccessData): {
    access_code?: string;
    has_key: boolean;
    key_location?: string;
    fridge_access_required: boolean;
    delivery_notes?: string;
} {
    if (!data || typeof data !== 'object') {
        throw new Error('Payload must be a valid object');
    }

    const hasKey = Boolean(data.has_key);
    let keyLocation = data.key_location ? data.key_location.trim() : undefined;

    if (hasKey && (!keyLocation || keyLocation.length < 2)) {
        throw new Error('Key location and lockbox code are required when physical key / lockbox is enabled');
    }

    const accessCode = data.access_code ? data.access_code.trim() : undefined;
    if (accessCode && accessCode.length > 50) {
        throw new Error('Access code exceeds maximum allowed length of 50 characters');
    }

    const deliveryNotes = data.delivery_notes ? data.delivery_notes.trim() : undefined;
    if (deliveryNotes && deliveryNotes.length > 500) {
        throw new Error('Delivery notes exceed maximum allowed length of 500 characters');
    }

    return {
        access_code: accessCode,
        has_key: hasKey,
        key_location: hasKey ? keyLocation : undefined,
        fridge_access_required: Boolean(data.fridge_access_required),
        delivery_notes: deliveryNotes,
    };
}

/**
 * Validates file upload for ST-120 resale certificates.
 */
export function validateST120UploadFile(file: { name?: string; type?: string; size?: number }): boolean {
    if (!file || typeof file !== 'object') {
        throw new Error('No file provided');
    }

    const fileName = (file.name || '').toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    const isPdf = mimeType === 'application/pdf' || fileName.endsWith('.pdf');
    const isImage = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(fileName);

    if (!isPdf && !isImage) {
        throw new Error('Invalid file type: only PDF documents or image files (camera photos) are supported');
    }

    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (typeof file.size === 'number' && file.size > MAX_SIZE) {
        throw new Error('File exceeds maximum size limit of 15MB');
    }

    return true;
}

/**
 * Validates registration ST-120 dual options.
 */
export function validateST120RegistrationOption(formData: {
    tax_id?: string;
    st120_mode?: 'digital' | 'upload' | string;
    st120_auto_generate?: boolean;
    st120_document_url?: string | null;
}): { isValid: boolean; mode: 'digital' | 'upload'; autoGenerate: boolean } {
    if (!formData || typeof formData !== 'object') {
        throw new Error('Form data must be an object');
    }

    const cleanTax = (formData.tax_id || '').trim();
    if (!cleanTax) {
        throw new Error('Tax ID / EIN is required for wholesale registration');
    }

    const isUpload = formData.st120_mode === 'upload';
    if (isUpload) {
        if (!formData.st120_document_url || !formData.st120_document_url.trim()) {
            throw new Error('Uploaded Form ST-120 document copy is required when Option 2 (Upload) is selected');
        }
        return {
            isValid: true,
            mode: 'upload',
            autoGenerate: false,
        };
    }

    return {
        isValid: true,
        mode: 'digital',
        autoGenerate: true,
    };
}
