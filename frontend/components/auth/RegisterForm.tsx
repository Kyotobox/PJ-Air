'use client';

import React, { useState, useCallback } from 'react';
import { 
    Mail, Lock, User, Phone, Building2, Loader2, ArrowRight, 
    CheckCircle2, Smartphone, FileText, ChevronDown, ChevronUp, 
    Scale, AlertTriangle, ShieldCheck, Clock, CalendarX, PhoneCall,
    Moon, Key, Snowflake, FileUp, Sparkles, Upload
} from 'lucide-react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { useLanguage } from '@/context/LanguageContext';
import { formatPhoneNumber } from '@/lib/firebase';
import { GOOGLE_MAPS_KEY } from '@/lib/config';
import { api } from '@/lib/api';
import { RegisterAddressMapCard } from './RegisterAddressMapCard';
import { FacadePhotoUploader } from './FacadePhotoUploader';

const libraries: ('places')[] = ['places'];

interface RegisterFormProps {
    formData: any;
    setFormData: (data: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error: string;
    isPhoneVerified?: boolean;
    setIsPhoneVerified?: (verified: boolean) => void;
    onVerifyPhoneClick?: () => void;
    onPhoneChange?: () => void;
}

export const RegisterForm = ({
    formData,
    setFormData,
    onSubmit,
    isLoading,
    error,
    isPhoneVerified = false,
    setIsPhoneVerified,
    onVerifyPhoneClick,
    onPhoneChange,
}: RegisterFormProps) => {
    const { t, locale } = useLanguage();
    const [isTermsAccordionOpen, setIsTermsAccordionOpen] = useState(false);
    const [isUploadingST120, setIsUploadingST120] = useState(false);
    const [st120UploadError, setSt120UploadError] = useState<string | null>(null);

    const handleST120FileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input value to allow re-upload
        e.target.value = '';

        if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
            setSt120UploadError(locale === 'en' ? 'Only PDF or image files (camera photos) are allowed' : 'Solo se permiten archivos PDF o fotos de cámara');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setSt120UploadError(locale === 'en' ? 'File size must be under 15MB' : 'El archivo no debe superar los 15MB');
            return;
        }

        setSt120UploadError(null);
        setIsUploadingST120(true);
        try {
            const uploadData = new FormData();
            uploadData.append('file', file);
            let url = '';
            try {
                const res = await api.upload('/addresses/upload-photo', uploadData) as any;
                url = res?.url || '';
            } catch {
                try {
                    const res = await api.upload('/addresses/upload-facade', uploadData) as any;
                    url = res?.url || '';
                } catch {
                    // Fallback to base64 DataURL offline-first (§45)
                    url = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }
            }
            setFormData({
                ...formData,
                st120_document_url: url,
                st120_filename: file.name,
                st120_auto_generate: false,
                st120_mode: 'upload',
                st120_declared: true,
            });
        } catch (err: any) {
            setSt120UploadError(err.message || (locale === 'en' ? 'Error uploading ST-120 document' : 'Error al subir documento ST-120'));
        } finally {
            setIsUploadingST120(false);
        }
    };

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_KEY || '',
        libraries,
    });

    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    const onAutocompleteLoad = useCallback((auto: google.maps.places.Autocomplete) => {
        setAutocomplete(auto);
    }, []);

    const onPlaceChanged = useCallback(() => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            let lat: number | null = null;
            let lng: number | null = null;
            if (place.geometry && place.geometry.location) {
                lat = place.geometry.location.lat();
                lng = place.geometry.location.lng();
            }

            let city = '';
            let postalCode = '';
            if (place.address_components) {
                for (const comp of place.address_components) {
                    if (comp.types.includes('locality')) {
                        city = comp.long_name;
                    } else if (!city && comp.types.includes('sublocality_level_1')) {
                        city = comp.long_name;
                    } else if (!city && comp.types.includes('neighborhood')) {
                        city = comp.long_name;
                    }
                    if (comp.types.includes('postal_code')) {
                        postalCode = comp.long_name;
                    }
                }
            }

            const formattedAddress = place.formatted_address || place.name || '';

            setFormData((prev: any) => ({
                ...prev,
                business_address: formattedAddress,
                address_lat: lat ?? prev.address_lat,
                address_lng: lng ?? prev.address_lng,
                address_city: city || prev.address_city,
                address_zip: postalCode || prev.address_zip,
            }));
        }
    }, [autocomplete, setFormData]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData({ ...formData, phone: formatted });
    };

    const isAllConsentChecked = Boolean(
        formData.terms_consent_1 && 
        formData.terms_consent_2 && 
        formData.terms_consent_3
    );

    const hasSignature = Boolean(
        formData.signature_text && 
        formData.signature_text.trim().length >= 3
    );

    const phoneDigits = formData.phone ? formData.phone.replace(/\D/g, '') : '';
    const phoneFormatRegex = /^[+]?[\d\s\-()]{10,25}$/;
    const isPhoneValid = Boolean(formData.phone && phoneFormatRegex.test(formData.phone.trim()) && phoneDigits.length >= 10 && phoneDigits.length <= 15);

    const isSubmitDisabled = isLoading || !isPhoneValid || !isAllConsentChecked || !hasSignature;

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-fade-in text-center">
                    {error}
                </div>
            )}

            {/* SECCIÓN 1: Credenciales y Usuario */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <User size={16} className="text-primary" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-foreground">
                        {locale === 'en' ? '1. Account & Login' : '1. Cuenta y Acceso'}
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {t.register.fullName} *
                        </label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                            <input
                                required
                                type="text"
                                placeholder={locale === 'en' ? 'John Doe' : 'Juan Pérez'}
                                className="premium-input pl-11 text-xs"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {t.register.email} *
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                            <input
                                required
                                type="email"
                                placeholder="orders@mybusiness.com"
                                className="premium-input pl-11 text-xs"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                {t.register.phone} *
                            </label>
                            {isPhoneValid && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <CheckCircle2 size={10} />
                                    <span>{locale === 'en' ? 'Valid ✓' : 'Válido ✓'}</span>
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                            <input
                                required
                                type="tel"
                                placeholder="+1 (305) 555-0100"
                                className={`premium-input pl-11 text-xs ${isPhoneValid ? 'border-emerald-500 bg-emerald-50/20' : ''}`}
                                value={formData.phone}
                                onChange={handlePhoneChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {t.register.password} *
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                            <input
                                required
                                type="password"
                                placeholder="••••••••"
                                className="premium-input pl-11 text-xs"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {t.register.confirmPassword} *
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                            <input
                                required
                                type="password"
                                placeholder="••••••••"
                                className="premium-input pl-11 text-xs"
                                value={formData.confirm_password}
                                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 2: Datos de Empresa (Wholesale) */}
            <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <Building2 size={16} className="text-primary" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-foreground">
                        {locale === 'en' ? '2. Business Information' : '2. Datos de Empresa'}
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {locale === 'en' ? 'Legal Business Name *' : 'Razón Social (Legal Name) *'}
                        </label>
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. Acme Hospitality LLC' : 'Ej: Acme Hospitality LLC'}
                            className="premium-input text-xs"
                            value={formData.legal_business_name || ''}
                            onChange={(e) => setFormData({ ...formData, legal_business_name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {locale === 'en' ? 'DBA (Doing Business As)' : 'Nombre Comercial / DBA'}
                        </label>
                        <input
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. Sunny Cafe & Bakery' : 'Ej: Sunny Cafe & Bakery'}
                            className="premium-input text-xs"
                            value={formData.dba || ''}
                            onChange={(e) => setFormData({ ...formData, dba: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {locale === 'en' ? 'Store / Company Display Name *' : 'Nombre de Tienda / Establecimiento *'}
                        </label>
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. Downtown Bakery' : 'Ej: Panadería Centro'}
                            className="premium-input text-xs"
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        />
                    </div>

                    {/* TASK-65-01 / TASK-65-02 / TASK-65-03: Dirección Comercial con Autocomplete, Foto de Fachada y Mini-Mapa */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:col-span-2 pt-1">
                        {/* Columna Izquierda (lg:col-span-7): Autocomplete + Cargador de Fachada */}
                        <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center justify-between">
                                    <span>{locale === 'en' ? 'Commercial Address (Billing & Delivery) *' : 'Dirección Comercial (Facturación y Entrega) *'}</span>
                                    {formData.address_lat && formData.address_lng && (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                            GPS ✓
                                        </span>
                                    )}
                                </label>
                                {isLoaded ? (
                                    <Autocomplete
                                        onLoad={onAutocompleteLoad}
                                        onPlaceChanged={onPlaceChanged}
                                        options={{
                                            componentRestrictions: { country: 'us' },
                                            fields: ['address_components', 'geometry', 'formatted_address', 'name'],
                                            types: ['geocode', 'establishment'],
                                        }}
                                    >
                                        <input
                                            required
                                            type="text"
                                            placeholder={locale === 'en' ? 'Search store name or street (e.g. C-Town Supermarket Astoria)' : 'Buscar local o calle (ej. C-Town Supermarket Astoria)'}
                                            className="premium-input text-xs w-full"
                                            value={formData.business_address || ''}
                                            onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                    </Autocomplete>
                                ) : (
                                    <input
                                        required
                                        type="text"
                                        placeholder={locale === 'en' ? '123 Main St, Suite 400, Brooklyn, NY 11201' : '123 Main St, Suite 400, Brooklyn, NY 11201'}
                                        className="premium-input text-xs w-full"
                                        value={formData.business_address || ''}
                                        onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                                    />
                                )}
                                <p className="text-[10px] text-muted-foreground ml-1">
                                    {locale === 'en'
                                        ? 'Powered by Google Places. Search by store name or physical address.'
                                        : 'Con Google Places. Busca por nombre comercial o dirección física.'}
                                </p>
                            </div>

                            {/* TASK-65-03: Cargador de Foto de Fachada del Local */}
                            <FacadePhotoUploader
                                value={formData.facade_image_url}
                                onChange={(url) => setFormData({ ...formData, facade_image_url: url })}
                                locale={locale}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Columna Derecha (lg:col-span-5): TASK-65-02 Mini-Mapa Lateral Interactivo */}
                        <div className="lg:col-span-5 flex flex-col">
                            <RegisterAddressMapCard
                                lat={formData.address_lat}
                                lng={formData.address_lng}
                                formattedAddress={formData.business_address}
                                isLoaded={isLoaded}
                                locale={locale}
                            />
                        </div>
                    </div>

                    {/* TASK-79-03: Acceso Nocturno de Madrugada (3 AM - 6 AM) */}
                    <div className="md:col-span-2 p-5 bg-gradient-to-r from-blue-950/5 via-slate-900/5 to-primary/5 border border-primary/20 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-900/10 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                    <Moon size={16} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                        <span>{locale === 'en' ? 'Early Morning Delivery Access (3 AM - 6 AM)' : 'Acceso Nocturno de Madrugada (3 AM - 6 AM)'}</span>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                            {locale === 'en' ? 'Keypad & Lockbox' : 'Clave y Cerradura'}
                                        </span>
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground">
                                        {locale === 'en' 
                                            ? 'Ensure our driver can securely access and deliver before store opening hours'
                                            : 'Permite que el repartidor ingrese el pedido de forma segura antes de la apertura comercial'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            {/* access_code */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                                    <ShieldCheck size={12} className="text-primary" />
                                    <span>{locale === 'en' ? 'Access / Alarm Code (Keypad)' : 'Código de Acceso / Alarma (Keypad)'}</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={locale === 'en' ? 'e.g. #3421 or Keypad: 9021' : 'Ej: #3421 o Keypad: 9021'}
                                    className="premium-input text-xs"
                                    value={formData.access_code || ''}
                                    onChange={(e) => setFormData({ ...formData, access_code: e.target.value })}
                                />
                            </div>

                            {/* has_key checkbox */}
                            <div className="space-y-1.5 flex flex-col justify-end">
                                <div className="flex items-center gap-3 p-3 bg-background/80 border border-border/80 rounded-xl">
                                    <input
                                        id="register_has_key"
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                                        checked={Boolean(formData.has_key)}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            has_key: e.target.checked,
                                            key_location: e.target.checked ? (formData.key_location || '') : ''
                                        })}
                                    />
                                    <label htmlFor="register_has_key" className="text-xs font-bold text-foreground/90 cursor-pointer select-none">
                                        {locale === 'en' 
                                            ? 'Do you have a physical key or lockbox?' 
                                            : '¿Cuentas con llave física o caja de seguridad (Lockbox)?'}
                                    </label>
                                </div>
                            </div>

                            {/* key_location (conditional on has_key) */}
                            {formData.has_key && (
                                <div className="space-y-1.5 md:col-span-2 animate-fade-in">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                                        <Key size={12} className="text-amber-600" />
                                        <span>{locale === 'en' ? 'Key / Lockbox Location & Code' : 'Ubicación de la llave / Lockbox y clave'}</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={locale === 'en' ? 'e.g. Lockbox next to service door, code 4455' : 'Ej: Caja fuerte al lado de la puerta de servicio, código 4455'}
                                        className="premium-input text-xs border-amber-300 dark:border-amber-700 focus:ring-amber-400"
                                        value={formData.key_location || ''}
                                        onChange={(e) => setFormData({ ...formData, key_location: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* fridge_access_required */}
                            <div className="space-y-1.5 md:col-span-2">
                                <div className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                                    formData.fridge_access_required 
                                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                                        : 'bg-background/80 border-border/80'
                                }`}>
                                    <input
                                        id="register_fridge_access"
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 rounded border-border text-emerald-600 focus:ring-emerald-500/20 accent-emerald-600 cursor-pointer shrink-0"
                                        checked={Boolean(formData.fridge_access_required)}
                                        onChange={(e) => setFormData({ ...formData, fridge_access_required: e.target.checked })}
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="register_fridge_access" className="text-xs font-bold text-foreground/90 flex items-center gap-2 cursor-pointer select-none">
                                            <Snowflake size={14} className="text-emerald-600 dark:text-emerald-400" />
                                            <span>
                                                {locale === 'en' 
                                                    ? 'Delivery driver must enter items directly into walk-in fridge / cold room' 
                                                    : '¿El repartidor debe ingresar los productos a la nevera / cámara fría?'}
                                            </span>
                                        </label>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {locale === 'en'
                                                ? 'Required for perishable dairy, refrigerated batters, or fresh cream products.'
                                                : 'Requerido para productos perecederos, masas refrigeradas y cremas frescas.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* delivery_notes */}
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                                    {locale === 'en' ? 'Night Delivery Notes & Special Access Instructions' : 'Notas o Instrucciones de Acceso de Madrugada'}
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder={locale === 'en' 
                                        ? 'e.g. Ring service bell twice. Push rear alley gate code #3421. Leave bread trays on high metal rack.'
                                        : 'Ej: Tocar timbre de servicio dos veces. Portón trasero con código #3421. Dejar canastillas en el estante metálico alto.'}
                                    className="premium-input text-xs w-full resize-none"
                                    value={formData.delivery_notes || ''}
                                    onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* TASK-79-03: Tax ID / EIN & Selector Dual Formulario ST-120 */}
                    <div className="space-y-4 md:col-span-2 p-5 bg-muted/20 border border-border/80 rounded-2xl">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                            <label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                <FileText size={16} className="text-primary" />
                                <span>{locale === 'en' ? 'Tax ID / EIN & Resale Certificate (Form ST-120)' : 'Tax ID / EIN y Certificado de Reventa (Formulario ST-120)'} *</span>
                            </label>
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles size={11} />
                                <span>{locale === 'en' ? '0% Sales Tax NYS DTF' : '0% Impuestos NYS DTF'}</span>
                            </span>
                        </div>

                        {/* Input for EIN / Tax ID */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                                {locale === 'en' ? 'Federal Tax ID (EIN) or NY Certificate of Authority # *' : 'Tax ID / EIN (Federal Employer Identification Number o Certificado NY) *'}
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. 12-3456789 or NY Certificate #"
                                className="premium-input text-xs"
                                value={formData.tax_id || ''}
                                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value, ein: e.target.value })}
                            />
                        </div>

                        {/* DUAL SELECTOR BUTTONS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {/* Opción 1: 1-Clic Digital */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, st120_mode: 'digital', st120_auto_generate: true })}
                                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                    formData.st120_mode !== 'upload'
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                                        : 'border-border/80 bg-background/60 hover:bg-muted/40'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                            <Sparkles size={14} />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-wide text-foreground">
                                            {locale === 'en' ? 'Option 1: 1-Click Digital ST-120' : 'Opción 1: Generar ST-120 Digital'}
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                        {locale === 'en' ? 'Recommended' : 'Recomendada'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                                    {locale === 'en'
                                        ? 'Generates your official NYS DTF Form ST-120 digital resale certificate with your electronic signature automatically.'
                                        : 'Genera y firma electrónicamente tu formulario ST-120 oficial de New York State DTF con los datos de tu empresa en 1 clic.'}
                                </p>
                            </button>

                            {/* Opción 2: Subir archivo PDF o Foto */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, st120_mode: 'upload', st120_auto_generate: false })}
                                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                    formData.st120_mode === 'upload'
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                                        : 'border-border/80 bg-background/60 hover:bg-muted/40'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                                        <FileUp size={14} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-wide text-foreground">
                                        {locale === 'en' ? 'Option 2: Upload File / Photo' : 'Opción 2: Subir PDF o Foto'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                                    {locale === 'en'
                                        ? 'Already have a signed NY Form ST-120? Upload a PDF copy or camera picture from your device.'
                                        : '¿Ya posees un Formulario ST-120 firmado? Sube una copia en PDF o una fotografía desde tu teléfono o PC.'}
                                </p>
                            </button>
                        </div>

                        {/* CONTENT FOR OPTION 1: PREVIEW */}
                        {formData.st120_mode !== 'upload' ? (
                            <div className="p-4 bg-background/90 border border-primary/20 rounded-xl space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <ShieldCheck size={13} className="text-emerald-600" />
                                        <span>{locale === 'en' ? 'Legal Pre-fill Certificate Summary' : 'Previsualización del Certificado ST-120 Oficial'}</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-primary font-bold">NYS DTF ST-120</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground block">{locale === 'en' ? 'Legal Business Name:' : 'Razón Social:'}</span>
                                        <span className="font-bold text-foreground">{formData.legal_business_name || 'Nombre Legal Registrado'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-muted-foreground block">{locale === 'en' ? 'DBA / Store:' : 'Nombre Comercial / DBA:'}</span>
                                        <span className="font-bold text-foreground">{formData.dba || formData.company_name || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-muted-foreground block">{locale === 'en' ? 'Tax ID / EIN:' : 'Tax ID / EIN:'}</span>
                                        <span className="font-mono font-bold text-foreground">{formData.tax_id || 'Pendiente'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-muted-foreground block">{locale === 'en' ? 'Authorized Signer:' : 'Firmante Autorizado:'}</span>
                                        <span className="font-bold text-foreground">{formData.signer_name || 'Firmante'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-[10px] text-muted-foreground block">{locale === 'en' ? 'Commercial Address:' : 'Dirección Comercial:'}</span>
                                        <span className="font-medium text-foreground text-[11px]">{formData.business_address || 'Dirección registrada'}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
                                    {locale === 'en'
                                        ? 'ℹ By registering, your official NYS DTF ST-120 Resale Certificate will be digitally generated and signed pursuant to NY ESRA / E-SIGN Act.'
                                        : 'ℹ Al enviar el registro, su certificado oficial NYS DTF ST-120 será generado y sellado digitalmente de conformidad con la ley NY ESRA / E-SIGN Act.'}
                                </p>
                            </div>
                        ) : (
                            /* CONTENT FOR OPTION 2: FILE UPLOAD */
                            <div className="p-4 bg-background/90 border border-indigo-200 dark:border-indigo-900/50 rounded-xl space-y-3 animate-fade-in">
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <FileUp size={13} className="text-indigo-600" />
                                    <span>{locale === 'en' ? 'Upload Form ST-120 (PDF or Mobile Photo)' : 'Subir Formulario ST-120 (PDF o Foto de Cámara)'}</span>
                                </span>
                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        id="st120_file_input"
                                        className="hidden"
                                        onChange={handleST120FileUpload}
                                    />
                                    <label
                                        htmlFor="st120_file_input"
                                        className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2"
                                    >
                                        {isUploadingST120 ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                        <span>{locale === 'en' ? 'Choose PDF or Take Photo' : 'Seleccionar PDF o Tomar Foto'}</span>
                                    </label>
                                    {formData.st120_document_url ? (
                                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                                            <CheckCircle2 size={14} />
                                            <span>{formData.st120_filename || (locale === 'en' ? 'Document ready' : 'Documento cargado con éxito')}</span>
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-muted-foreground">
                                            {locale === 'en' ? 'Accepts PDF, JPG, PNG (Max 15MB)' : 'Soporta PDF, JPG, PNG (Cámara de celular)'}
                                        </span>
                                    )}
                                </div>
                                {st120UploadError && (
                                    <p className="text-[11px] text-red-600 font-bold">{st120UploadError}</p>
                                )}
                            </div>
                        )}

                        {/* Checkbox de certificación */}
                        <div className="flex items-start gap-2.5 pt-1">
                            <input
                                id="st120_declared"
                                type="checkbox"
                                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                                checked={Boolean(formData.st120_declared)}
                                onChange={(e) => setFormData({ ...formData, st120_declared: e.target.checked })}
                            />
                            <label htmlFor="st120_declared" className="text-[11px] text-foreground/80 leading-snug cursor-pointer">
                                {locale === 'en' ? (
                                    <>Certify under penalty of perjury that all purchases are for resale under a valid NY Form ST-120 certificate.</>
                                ) : (
                                    <>Certifico bajo pena de perjurio que todas las compras son para reventa amparadas en certificado ST-120 de NY vigente.</>
                                )}
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3: Firmante Autorizado */}
            <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <ShieldCheck size={16} className="text-primary" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-foreground">
                        {locale === 'en' ? '3. Authorized Signer' : '3. Firmante Autorizado'}
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {locale === 'en' ? 'Signer Full Name *' : 'Nombre Completo del Firmante *'}
                        </label>
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. Jane Doe' : 'Ej: Jane Doe'}
                            className="premium-input text-xs"
                            value={formData.signer_name || ''}
                            onChange={(e) => setFormData({ ...formData, signer_name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {locale === 'en' ? 'Title / Position *' : 'Cargo / Puesto *'}
                        </label>
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. Managing Director / Owner' : 'Ej: Propietario / Gerente General'}
                            className="premium-input text-xs"
                            value={formData.signer_title || ''}
                            onChange={(e) => setFormData({ ...formData, signer_title: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {locale === 'en' ? 'Signer Direct Phone *' : 'Teléfono Directo del Firmante *'}
                        </label>
                        <input
                            required
                            type="tel"
                            placeholder="+1 (347) 555-0199"
                            className="premium-input text-xs"
                            value={formData.signer_phone || ''}
                            onChange={(e) => setFormData({ ...formData, signer_phone: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            {locale === 'en' ? 'Signer Official Email *' : 'Email Oficial del Firmante *'}
                        </label>
                        <input
                            required
                            type="email"
                            placeholder="legal@mybusiness.com"
                            className="premium-input text-xs"
                            value={formData.signer_email || ''}
                            onChange={(e) => setFormData({ ...formData, signer_email: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* SECCIÓN 4: Acordeón de Términos y Condiciones Oficiales */}
            <div className="space-y-4 pt-4 border-t border-border/60">
                <div 
                    onClick={() => setIsTermsAccordionOpen(!isTermsAccordionOpen)}
                    className="p-4 bg-muted/40 hover:bg-muted/60 border border-border/80 rounded-2xl cursor-pointer transition-all flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <Scale size={18} className="text-primary" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-foreground">
                                {locale === 'en' ? 'Official Terms & Commercial Conditions (Jhoanes Bakery)' : 'Términos y Condiciones Comerciales Oficiales (Jhoanes Bakery)'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {locale === 'en' ? 'Click to expand terms, delivery schedules, and credit agreement' : 'Haz clic para desplegar cláusulas, horarios de corte y acuerdo comercial'}
                            </p>
                        </div>
                    </div>
                    <div className="text-muted-foreground">
                        {isTermsAccordionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>

                {isTermsAccordionOpen && (
                    <div className="p-5 bg-background border border-border/80 rounded-2xl text-[11px] text-muted-foreground space-y-3 leading-relaxed max-h-64 overflow-y-auto animate-fade-in shadow-inner">
                        <h4 className="font-bold text-foreground uppercase tracking-wider text-xs">
                            Jhoanes Bakery & Coffee Wholesale Agreement (v2026.10.29)
                        </h4>
                        {locale === 'en' ? (
                            <>
                                <p>
                                    <b>1. Production Cutoff Policy (36h):</b> All wholesale orders must be confirmed at least 36 hours prior to the scheduled delivery day. Cancellations requested after the production cutoff will incur 100% of the baking and preparation cost.
                                </p>
                                <p>
                                    <b>2. Operating Delivery Schedule:</b> Deliveries are conducted Wednesday through Monday. <u>No deliveries are scheduled on Tuesdays</u> under any circumstances due to mandatory facility sanitization and major maintenance.
                                </p>
                                <p>
                                    <b>3. Credit & Payment Terms:</b> Approved commercial credit accounts operate under net 7-day terms. Any delinquent, unliquidated balances accrue a late fee of 1.5% per month (18% per annum) or the maximum legal rate allowed under New York State law.
                                </p>
                                <p>
                                    <b>4. Stripe Card-on-File Authorization:</b> Customer authorizes Jhoanes Bakery to securely tokenize a debit or credit card via Stripe without initial charge ($0.00 SetupIntent), and grants automatic recurring debit authorization to cover any past-due balance, unpaid invoices, or applicable late fees.
                                </p>
                                <p>
                                    <b>5. Binding Electronic Signature (NY ESRA / Federal E-SIGN Act):</b> Both parties agree that adopting the typed legal name and checking electronic boxes constitutes a legally binding digital signature with full evidentiary admissibility pursuant to the New York Electronic Signatures and Records Act (State Technology Law §§ 301-309) and the Federal E-SIGN Act (15 U.S.C. § 7001).
                                </p>
                            </>
                        ) : (
                            <>
                                <p>
                                    <b>1. Política de Corte de Producción (36h):</b> Todo pedido mayorista debe confirmarse con un mínimo de 36 horas de antelación al día de despacho. Las cancelaciones posteriores al corte incurren en el 100% del costo de horneado.
                                </p>
                                <p>
                                    <b>2. Calendario Operativo de Entregas:</b> Los despachos se ejecutan de miércoles a lunes. <u>No se realizan entregas los martes</u> bajo ninguna circunstancia debido a mantenimiento mayor y sanitización de plantas.
                                </p>
                                <p>
                                    <b>3. Condiciones de Crédito y Cobro:</b> Las cuentas comerciales bajo modalidad de crédito gozan de un plazo de 7 días naturales. Los saldos vencidos no liquidados generan un interés moratorio del 1.5% mensual (18% anual) o el máximo legal permitido por el Estado de New York.
                                </p>
                                <p>
                                    <b>4. Autorización de Tarjeta en Archivo (Stripe Card-on-File):</b> El cliente autoriza a Jhoanes Bakery a tokenizar de forma segura una tarjeta de crédito o débito mediante Stripe sin cobro inicial ($0.00 SetupIntent), y autoriza su débito automático para cubrir cualquier balance vencido o interés por mora no cubierto oportunamente.
                                </p>
                                <p>
                                    <b>5. Firma Electrónica Vinculante (NY ESRA / E-SIGN Act):</b> Ambas partes acuerdan que la adopción del nombre escrito y la marcación de casillas electrónicas constituye una firma digital vinculante con plena validez legal y admisibilidad probatoria de conformidad con la New York Electronic Signatures and Records Act (State Technology Law §§ 301-309) y el Federal E-SIGN Act (15 U.S.C. § 7001).
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* SECCIÓN 5: Las 3 Casillas de Consentimiento Obligatorias */}
            <div className="space-y-3 pt-4 border-t border-border/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    {locale === 'en' ? 'Mandatory Consent & Legal Acknowledgement' : 'Consentimiento Legal Mandatorio'}
                </p>

                {/* Casilla 1 */}
                <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                    formData.terms_consent_1 ? 'bg-primary/5 border-primary/40' : 'bg-muted/30 border-border/70'
                }`}>
                    <input
                        id="terms_consent_1"
                        type="checkbox"
                        checked={Boolean(formData.terms_consent_1)}
                        onChange={(e) => setFormData({ ...formData, terms_consent_1: e.target.checked })}
                        className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                    />
                    <label htmlFor="terms_consent_1" className="text-xs text-foreground/90 font-medium leading-relaxed cursor-pointer select-none">
                        {locale === 'en' ? (
                            <><b>1.</b> I have read and agree to the <b>Official Commercial Terms and Conditions</b> on behalf of the company.</>
                        ) : (
                            <><b>1.</b> He leído y acepto los <b>Términos Comerciales Oficiales</b> en nombre y representación de la empresa.</>
                        )}
                    </label>
                </div>

                {/* Casilla 2 */}
                <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                    formData.terms_consent_2 ? 'bg-primary/5 border-primary/40' : 'bg-muted/30 border-border/70'
                }`}>
                    <input
                        id="terms_consent_2"
                        type="checkbox"
                        checked={Boolean(formData.terms_consent_2)}
                        onChange={(e) => setFormData({ ...formData, terms_consent_2: e.target.checked })}
                        className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                    />
                    <label htmlFor="terms_consent_2" className="text-xs text-foreground/90 font-medium leading-relaxed cursor-pointer select-none">
                        {locale === 'en' ? (
                            <><b>2.</b> I authorize Jhoanes Bakery to charge the card on file via Stripe for any outstanding balances, overdue invoices, or late fees (<b>1.5% monthly</b>).</>
                        ) : (
                            <><b>2.</b> Autorizo a Jhoanes a cobrar la tarjeta en archivo por Stripe por montos adeudados, facturas vencidas o moras (<b>1.5% mensual</b>).</>
                        )}
                    </label>
                </div>

                {/* Casilla 3 */}
                <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                    formData.terms_consent_3 ? 'bg-primary/5 border-primary/40' : 'bg-muted/30 border-border/70'
                }`}>
                    <input
                        id="terms_consent_3"
                        type="checkbox"
                        checked={Boolean(formData.terms_consent_3)}
                        onChange={(e) => setFormData({ ...formData, terms_consent_3: e.target.checked })}
                        className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                    />
                    <label htmlFor="terms_consent_3" className="text-xs text-foreground/90 font-medium leading-relaxed cursor-pointer select-none">
                        {locale === 'en' ? (
                            <><b>3.</b> I accept electronic notifications and adopt my typed name below as my binding electronic signature under the <b>NY ESRA / Federal E-SIGN Act</b>.</>
                        ) : (
                            <><b>3.</b> Acepto notificaciones electrónicas y adopto mi nombre escrito como firma electrónica vinculante bajo la <b>NY ESRA / E-SIGN Act</b>.</>
                        )}
                    </label>
                </div>
            </div>

            {/* SECCIÓN 6: Campo de Firma Electrónica */}
            <div className="space-y-3 pt-4 border-t border-border/60">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-2">
                    <Scale size={14} className="text-primary" />
                    <span>{locale === 'en' ? 'Typed full name (electronic signature) *' : 'Nombre completo escrito (Firma electrónica vinculante) *'}</span>
                </label>
                <div className="relative">
                    <input
                        required
                        type="text"
                        placeholder={locale === 'en' ? 'Type your full legal name here' : 'Escribe tu nombre legal completo aquí'}
                        className="premium-input text-sm font-serif italic pl-4"
                        value={formData.signature_text || ''}
                        onChange={(e) => setFormData({ ...formData, signature_text: e.target.value })}
                    />
                    {hasSignature && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-[10px] font-bold">
                            <CheckCircle2 size={16} />
                            <span>{locale === 'en' ? 'Signed' : 'Firmado'}</span>
                        </div>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground italic ml-1">
                    {locale === 'en'
                        ? 'By typing your name, you certify with legal force that you are authorized to bind this entity.'
                        : 'Al escribir tu nombre, certificas con validez legal que tienes facultades suficientes para obligar a la entidad.'}
                </p>
            </div>

            {/* Botón de Envío */}
            <div className="pt-4">
                <button
                    disabled={isSubmitDisabled}
                    className={`w-full premium-button jhoanes-gradient text-white text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 transition-all ${
                        isSubmitDisabled ? 'opacity-50 cursor-not-allowed shadow-none' : ''
                    }`}
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>{t.register.submit} <ArrowRight size={20} /></>
                    )}
                </button>

                {/* Validaciones pendientes indicativas */}
                {!isPhoneValid && formData.phone && formData.phone.trim().length > 0 && (
                    <p className="text-[11px] text-center text-amber-700/80 font-bold mt-2.5 animate-fade-in">
                        {locale === 'en'
                            ? '⚠ Please enter a valid phone number (10 to 15 digits)'
                            : '⚠ Por favor ingresa un número de teléfono válido (10 a 15 dígitos)'}
                    </p>
                )}
                {isPhoneValid && (!isAllConsentChecked || !hasSignature) && (
                    <p className="text-[11px] text-center text-slate-500 font-bold mt-2.5 animate-fade-in">
                        {locale === 'en'
                            ? '⚠ Please mark all 3 consent checkboxes and enter your electronic signature to proceed'
                            : '⚠ Por favor marca las 3 casillas de consentimiento y escribe tu firma electrónica para continuar'}
                    </p>
                )}
            </div>
        </form>
    );
};
