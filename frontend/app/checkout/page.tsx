'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import {
    Calendar, MapPin, CreditCard, ChevronRight, ShoppingBag,
    Loader2, Plus, Clock, Minus, Store, Truck, Home,
    ChevronDown, Check, AlertCircle, BookmarkPlus, Bookmark,
    Map as MapIcon, RotateCcw, Search, X, Building2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_KEY } from '@/lib/config';
import StripePaymentModal from '@/components/checkout/StripePaymentModal';
import { calculateProcessingFee } from '@/lib/fee-calculator';

// MIN_ORDER_AMOUNT was migrated to dynamic configuration loaded from the backend API

const mapContainerStyle = {
    width: '100%',
    height: '350px',
    borderRadius: '24px'
};

const centerNY = { lat: 40.7128, lng: -74.0060 };

const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Delivery type
// ─────────────────────────────────────────────────────────────────────────────
type DeliveryType = 'pickup' | 'saved' | 'other';

// ─────────────────────────────────────────────────────────────────────────────
// Inline address form (for "Other address" option)
// ─────────────────────────────────────────────────────────────────────────────
function InlineAddressForm({
    onReady,
    locale,
}: {
    onReady: (data: { alias: string; address: string; notes: string; saveMode: 'save' | 'temporary'; lat: number; lng: number; refined_lat: number | null; refined_lng: number | null }) => void;
    locale: string;
}) {
    const [alias, setAlias] = useState('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [saveMode, setSaveMode] = useState<'save' | 'temporary'>('save');
    const [markerPos, setMarkerPos] = useState(centerNY);
    const [geocodedPos, setGeocodedPos] = useState<{lat: number, lng: number} | null>(null);
    const [refinedPos, setRefinedPos] = useState<{lat: number, lng: number} | null>(null);
    const [isManualAdjustment, setIsManualAdjustment] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_KEY || ''
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);

    useEffect(() => {
        onReady({ 
            alias: alias.trim() || (locale === 'en' ? 'Delivery Address' : 'Dirección de Entrega'), 
            address, 
            notes, 
            saveMode,
            lat: geocodedPos?.lat || markerPos.lat,
            lng: geocodedPos?.lng || markerPos.lng,
            refined_lat: isManualAdjustment ? refinedPos?.lat || null : null,
            refined_lng: isManualAdjustment ? refinedPos?.lng || null : null
        });
    }, [alias, address, notes, saveMode, markerPos, geocodedPos, refinedPos, isManualAdjustment, locale]);

    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    const reverseGeocode = (pos: { lat: number, lng: number }) => {
        if (typeof google === 'undefined') return;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: pos }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                setAddress(results[0].formatted_address);
            }
        });
    };

    const forwardGeocode = () => {
        if (typeof google === 'undefined' || !address) return;
        setIsGeocoding(true);
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address }, (results, status) => {
            setIsGeocoding(false);
            if (status === 'OK' && results && results[0]) {
                const newPos = {
                    lat: results[0].geometry.location.lat(),
                    lng: results[0].geometry.location.lng()
                };
                setMarkerPos(newPos);
                setGeocodedPos(newPos);
                setIsManualAdjustment(false);
                setRefinedPos(null);
                map?.panTo(newPos);
            }
        });
    };

    const handleMapClick = React.useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setMarkerPos(newPos);
            setRefinedPos(newPos);
            setIsManualAdjustment(true);
            reverseGeocode(newPos);
        }
    }, []);

    return (
        <div className="mt-6 bg-muted/30 rounded-2xl border border-border/60 p-6 space-y-6 animate-fade-in shadow-sm">
            <h4 className="text-sm font-black uppercase tracking-widest text-foreground/60 flex items-center gap-2">
                <MapPin size={16} /> {lbl('Nueva dirección de entrega', 'New delivery address')}
            </h4>

            {/* Address */}
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {lbl('Dirección completa', 'Full address')}
                </label>
                <div className="relative group">
                    <textarea
                        required
                        rows={2}
                        placeholder={lbl('Calle, número, ciudad...', 'Street, number, city...')}
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        onBlur={() => { if (address.length > 5) forwardGeocode(); }}
                        className="premium-input px-4 py-3 pr-24 resize-none"
                    />
                    <button
                        type="button"
                        onClick={forwardGeocode}
                        disabled={isGeocoding}
                        className="absolute right-3 bottom-3 px-3 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
                    >
                        {isGeocoding ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                        {lbl('Ubicar', 'Locate')}
                    </button>
                </div>
            </div>

            {/* Map */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <MapIcon size={14} /> {lbl('Refina la ubicación en elmMapa', 'Refine location on the map')}
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setMarkerPos(centerNY);
                            map?.panTo(centerNY);
                            reverseGeocode(centerNY);
                        }}
                        className="text-[9px] font-black uppercase text-primary hover:underline flex items-center gap-1"
                    >
                        <RotateCcw size={10} /> {lbl('Centrar en NY', 'Center on NY')}
                    </button>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-border shadow-inner">
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={markerPos}
                            zoom={14}
                            options={mapOptions}
                            onClick={handleMapClick}
                            onLoad={m => setMap(m)}
                            onUnmount={() => setMap(null)}
                        >
                            <Marker
                                position={markerPos}
                                draggable={true}
                                onDragEnd={(e) => {
                                    if (e.latLng) {
                                        const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                                        setMarkerPos(newPos);
                                        setRefinedPos(newPos);
                                        setIsManualAdjustment(true);
                                        reverseGeocode(newPos);
                                    }
                                }}
                            />
                        </GoogleMap>
                    ) : (
                        <div style={mapContainerStyle} className="bg-muted animate-pulse flex items-center justify-center">
                            <Loader2 className="animate-spin text-primary" size={30} />
                        </div>
                    )}
                </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {lbl('Notas adicionales (opcional)', 'Additional notes (optional)')}
                </label>
                <input
                    type="text"
                    placeholder={lbl('Ej: Portón azul, piso 3...', 'e.g. Blue gate, floor 3...')}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="premium-input px-4 py-3"
                />
            </div>

            {/* Save mode */}
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {lbl('¿Deseas guardar esta dirección?', 'Would you like to save this address?')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setSaveMode('save')}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                            saveMode === 'save'
                                ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                : 'border-border/50 text-muted-foreground hover:border-primary/20'
                        }`}
                    >
                        <BookmarkPlus size={14} />
                        {lbl('Guardar dirección', 'Save address')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSaveMode('temporary')}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                            saveMode === 'temporary'
                                ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                                : 'border-border/50 text-muted-foreground hover:border-amber-300'
                        }`}
                    >
                        <Bookmark size={14} />
                        {lbl('Solo para este pedido', 'One-time only')}
                    </button>
                </div>
                {saveMode === 'temporary' && (
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 mt-2">
                        <p className="text-[9px] text-amber-600 font-bold flex items-center gap-1.5 leading-tight">
                            <AlertCircle size={12} />
                            {lbl(
                                'Esta dirección no aparecerá en tu perfil pero quedará registrada en el pedido.',
                                'This address won\'t appear in your profile but will be stored with the order.'
                            )}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main checkout page
// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
    const { cart, clearCart, updateQuantity, getRawSubtotal, getDiscountedSubtotal, getFinalTotal, getItemPrice } = useCart();
    const { user, profile } = useAuth();
    const { locale } = useLanguage();
    const router = useRouter();

    const [deliveryDate, setDeliveryDate] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [rawDeliveryDate, setRawDeliveryDate] = useState('');
    const [isBeforeCutoff, setIsBeforeCutoff] = useState(true);
    const [isPastCutoff, setIsPastCutoff] = useState(false);
    const [minSelectableDate, setMinSelectableDate] = useState('');
    const [nextAvailableDateFormatted, setNextAvailableDateFormatted] = useState('');
    const [showMinAmountModal, setShowMinAmountModal] = useState(false);
    const [minOrderAmount, setMinOrderAmount] = useState<number>(500);
    const [cutoffHour, setCutoffHour] = useState<number>(12);
    const [termsAccepted, setTermsAccepted] = useState(false);

    // Payment method state
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'ach' | 'zelle' | 'credit'>('stripe');
    const [zelleReference, setZelleReference] = useState('');
    const [zelleReceiptFile, setZelleReceiptFile] = useState<File | null>(null);
    const [zelleReceiptUrl, setZelleReceiptUrl] = useState<string | null>(null);
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

    const [addresses, setAddresses] = useState<any[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(true);

    // Delivery type
    const [deliveryType, setDeliveryType] = useState<DeliveryType>('saved');
    const [otherAddrData, setOtherAddrData] = useState<{
        alias: string; address: string; notes: string; saveMode: 'save' | 'temporary';
        lat: number; lng: number; refined_lat: number | null; refined_lng: number | null;
    }>({ 
        alias: '', address: '', notes: '', saveMode: 'save',
        lat: centerNY.lat, lng: centerNY.lng, refined_lat: null, refined_lng: null
    });

    // Delivery zone resolution state
    const [resolvedZone, setResolvedZone] = useState<any | null>(null);
    const [isResolvingZone, setIsResolvingZone] = useState(false);
    const [resolvedZip, setResolvedZip] = useState<string | null>(null);

    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    // Discounts & Credit
    const [userDiscounts, setUserDiscounts] = useState<any>(null);
    const [creditSummary, setCreditSummary] = useState<any>(null);
    const [stripePaymentData, setStripePaymentData] = useState<{ clientSecret: string; amount: number; orderId: string } | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        type: 'error' | 'warning' | 'info';
    } | null>(null);

    const showNotification = (message: string, type: 'error' | 'warning' | 'info' = 'warning') => {
        setNotification({ message, type });
    };

    useEffect(() => {
        if (!notification) return;
        const timer = setTimeout(() => {
            setNotification(null);
        }, 5000);
        return () => clearTimeout(timer);
    }, [notification]);

    const handleStripePaymentSuccess = async () => {
        if (!stripePaymentData) return;
        try {
            await api.patch(`/orders/${stripePaymentData.orderId}/payment-status`, { payment_status: 'paid' });
        } catch (e) {
            console.error('Error updating payment status:', e);
        }
        clearCart();
        window.location.href = `/orders/${stripePaymentData.orderId}`;
    };

    // ── Fetch user & discounts ──────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        setIsFetchingAddresses(true);
        
        // Parallel fetch for speed
        Promise.all([
            api.get(`/addresses/user/${user.id}`) as Promise<any[]>,
            api.get(`/users/${user.id}`).catch(() => null), // Includes general_discount and productDiscounts
            api.get(`/users/${user.id}/credit-summary`).catch(() => null)
        ]).then(([addrData, userData, creditData]) => {
            setAddresses(Array.isArray(addrData) ? addrData : []);
            if (addrData?.length > 0) setSelectedAddressId(addrData[0].id);
            setUserDiscounts(userData);
            setCreditSummary(creditData);
            if ((creditData as any)?.account_type === 'credit') {
                setPaymentMethod('credit');
            }
        }).finally(() => setIsFetchingAddresses(false));
    }, [user]);

    // ── Fetch min order amount & cutoff configuration ────────────────────────
    useEffect(() => {
        api.get('/configs/min_order_amount')
            .then((res: any) => {
                if (res && res.value) {
                    setMinOrderAmount(Number(res.value) || 500);
                }
            })
            .catch(err => console.error('Error fetching min_order_amount:', err));

        api.get('/configs/cutoff_hour')
            .then((res: any) => {
                if (res && res.value) {
                    setCutoffHour(Number(res.value) || 12);
                }
            })
            .catch(err => console.error('Error fetching cutoff_hour:', err));
    }, []);

    // ── Delivery Zone Resolution Engine ───────────────────────────────────────
    const currentAddress = addresses.find(a => a.id === selectedAddressId);
    const extractZip = (addrText?: string): string | null => {
        if (!addrText) return null;
        const match = addrText.match(/\b\d{5}\b/);
        return match ? match[0] : null;
    };
    const currentZip = deliveryType === 'saved'
        ? (currentAddress?.zip || currentAddress?.zip_code || extractZip(currentAddress?.address))
        : deliveryType === 'other'
        ? extractZip(otherAddrData.address)
        : null;

    useEffect(() => {
        if (deliveryType === 'pickup' || !currentZip) {
            setResolvedZone(null);
            setResolvedZip(null);
            return;
        }

        let isMounted = true;
        setIsResolvingZone(true);
        api.get(`/zones/resolve?zip=${currentZip}`)
            .then((zone: any) => {
                if (isMounted) {
                    setResolvedZone(zone || null);
                    setResolvedZip(currentZip);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setResolvedZone(null);
                    setResolvedZip(currentZip);
                }
            })
            .finally(() => {
                if (isMounted) setIsResolvingZone(false);
            });

        return () => { isMounted = false; };
    }, [currentZip, deliveryType]);

    // ── Calculation logic & Precedence Matrix ─────────────────────────────────
    const rawSubtotal = getRawSubtotal();
    const discountedSubtotal = getDiscountedSubtotal();

    // Matriz de precedencia:
    // 1. Pickup: siempre $0.00
    // 2. Tarifa Especial VIP pactada en perfil (user.delivery_fee > 0): prevalece sobre la zona
    // 3. Zona resuelta por ZIP (si subtotal >= min_free_delivery_amount -> $0.00, sino -> zone.base_fee)
    // 4. Contingencia fallback ($15.00) si el ZIP no está registrado en zonas activas
    const hasVipFee = Number(profile?.delivery_fee) > 0;
    let deliveryFee = 0;
    if (deliveryType === 'pickup') {
        deliveryFee = 0;
    } else if (hasVipFee) {
        deliveryFee = Number(profile?.delivery_fee);
    } else if (resolvedZone) {
        const freeDeliveryThreshold = Number(resolvedZone.min_free_delivery_amount);
        if (freeDeliveryThreshold > 0 && discountedSubtotal >= freeDeliveryThreshold) {
            deliveryFee = 0;
        } else {
            deliveryFee = Number(resolvedZone.base_fee || 0);
        }
    } else {
        deliveryFee = 15.00; // Contingency fallback
    }

    const isFreeDeliveryEligible = !hasVipFee && resolvedZone && Number(resolvedZone.min_free_delivery_amount) > 0 && discountedSubtotal >= Number(resolvedZone.min_free_delivery_amount);
    const freeDeliveryShortage = !hasVipFee && resolvedZone && Number(resolvedZone.min_free_delivery_amount) > 0 && discountedSubtotal < Number(resolvedZone.min_free_delivery_amount)
        ? Math.round((Number(resolvedZone.min_free_delivery_amount) - discountedSubtotal + Number.EPSILON) * 100) / 100
        : 0;

    // TASK-47-02: Processing Fee calculation via pure calculateProcessingFee
    const feeMethod = paymentMethod === 'stripe' ? 'STRIPE_CARD' : paymentMethod === 'ach' ? 'ACH' : paymentMethod.toUpperCase();
    const processingFee = calculateProcessingFee(discountedSubtotal, feeMethod);
    const packagingFee = processingFee;
    const packagingDiscount = 0;

    const finalTotal = Math.round((discountedSubtotal + processingFee + deliveryFee + Number.EPSILON) * 100) / 100;
    const totalDiscount = Math.round((rawSubtotal - discountedSubtotal + Number.EPSILON) * 100) / 100;
    const subtotal = rawSubtotal;

    const isCreditAccount = creditSummary?.account_type === 'credit';
    const creditLimit = Number(creditSummary?.credit_limit || 0);
    const usedCredit = Number(creditSummary?.used_credit || 0);
    const availableCredit = Number(creditSummary?.available_credit || 0);
    const hasCreditOverride = Boolean(creditSummary?.credit_override);
    const exceedsCreditLimit = isCreditAccount && paymentMethod === 'credit' && (usedCredit + finalTotal > creditLimit) && !hasCreditOverride;

    // ── Delivery date (NY timezone & 12:00 PM cutoff guard) ───────────────────
    useEffect(() => {
        const nowNY = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const currentHour = nowNY.getHours();
        const pastCutoff = currentHour >= cutoffHour;
        setIsPastCutoff(pastCutoff);
        setIsBeforeCutoff(!pastCutoff);

        // If past cutoff (12:00 PM), next day delivery is prohibited -> min is T+2 days. Before 12 PM -> T+1 day.
        const daysToAdd = pastCutoff ? 2 : 1;
        const minDate = new Date(nowNY);
        minDate.setDate(nowNY.getDate() + daysToAdd);

        const yyyy = minDate.getFullYear();
        const mm = String(minDate.getMonth() + 1).padStart(2, '0');
        const dd = String(minDate.getDate()).padStart(2, '0');
        const minStr = `${yyyy}-${mm}-${dd}`;
        setMinSelectableDate(minStr);

        const formattedNext = minDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        setNextAvailableDateFormatted(formattedNext);

        setRawDeliveryDate(minStr);
        setDeliveryDate(minDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));

        const payDate = new Date(minDate);
        payDate.setDate(minDate.getDate() + 6);
        setPaymentDate(payDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    }, [cutoffHour, locale]);

    const handleDeliveryDateChange = (newDateStr: string) => {
        if (!newDateStr) return;
        if (minSelectableDate && newDateStr < minSelectableDate) {
            showNotification(
                lbl(
                    `Corte de producción a las 12:00 PM superado. Próxima entrega disponible a partir de ${nextAvailableDateFormatted}.`,
                    `12:00 PM production cutoff exceeded. Next delivery available starting from ${nextAvailableDateFormatted}.`
                ),
                'warning'
            );
            return;
        }
        setRawDeliveryDate(newDateStr);
        const [y, m, d] = newDateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        setDeliveryDate(dateObj.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
        const payDate = new Date(dateObj);
        payDate.setDate(dateObj.getDate() + 6);
        setPaymentDate(payDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    };

    const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setZelleReceiptFile(file);
        setIsUploadingReceipt(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.upload('/orders/upload-receipt', formData) as any;
            if (res?.url) {
                setZelleReceiptUrl(res.url);
                showNotification(lbl('Comprobante subido con éxito.', 'Receipt uploaded successfully.'), 'info');
            }
        } catch (err: any) {
            console.error('Error uploading zelle receipt:', err);
            showNotification(err?.message || lbl('Error al subir el comprobante', 'Error uploading receipt'), 'error');
        } finally {
            setIsUploadingReceipt(false);
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!user || cart.length === 0) return;

        if (!termsAccepted) {
            showNotification(lbl('Por favor acepta los Términos y Condiciones para continuar.', 'Please accept the Terms and Conditions to proceed.'), 'warning');
            return;
        }

        if (paymentMethod === 'zelle') {
            if (!zelleReference.trim()) {
                showNotification(
                    lbl(
                        'Por favor ingresa el Número de Confirmación / Referencia de tu transferencia Zelle.',
                        'Please enter the Confirmation Number / Reference of your Zelle transfer.'
                    ),
                    'warning'
                );
                return;
            }
        }

        if (exceedsCreditLimit) {
            showNotification(lbl(
                `Tu pedido excede tu línea de crédito disponible ($${availableCredit.toFixed(2)}). Comunícate con administración.`,
                `Your order exceeds your available credit line ($${availableCredit.toFixed(2)}). Please contact administration.`
            ), 'error');
            return;
        }

        // Minimum order amount check
        if (finalTotal < minOrderAmount) {
            setShowMinAmountModal(true);
            return;
        }

        let finalAddressId: string | null = null;
        let deliveryAddressText: string | null = null;

        if (deliveryType === 'saved') {
            if (!selectedAddressId) {
                showNotification(lbl('Por favor selecciona una dirección guardada.', 'Please select a saved address.'), 'warning');
                return;
            }
            finalAddressId = selectedAddressId;
        } else if (deliveryType === 'other') {
            if (!otherAddrData.address.trim()) {
                showNotification(lbl('Por favor completa la dirección de entrega.', 'Please fill in delivery address.'), 'warning');
                return;
            }
            // Create address record (temporary or permanent)
            try {
                const newAddr = await api.post('/addresses', {
                    userId: user.id,
                    alias: otherAddrData.alias?.trim() || (locale === 'en' ? 'Delivery Address' : 'Dirección de Entrega'),
                    address: otherAddrData.address,
                    notes: otherAddrData.notes,
                    is_temporary: otherAddrData.saveMode === 'temporary',
                    lat: otherAddrData.lat,
                    lng: otherAddrData.lng,
                    refined_lat: otherAddrData.refined_lat,
                    refined_lng: otherAddrData.refined_lng,
                }) as any;
                finalAddressId = newAddr.id;
                deliveryAddressText = otherAddrData.address;
            } catch (e) {
                showNotification(lbl('Error guardando la dirección. Intenta de nuevo.', 'Error saving address. Please try again.'), 'error');
                return;
            }
        }
        // pickup → no address needed

        setIsLoading(true);
        try {
            const order = await api.post('/orders', {
                userId: user.id,
                addressId: finalAddressId,
                deliveryType,
                deliveryAddressText,
                zip_code: currentZip,
                total: finalTotal,
                status: 'Pedido Enviado',
                deliveryDate: rawDeliveryDate || deliveryDate,
                paymentDueDate: paymentDate,
                payment_method: paymentMethod,
                fee_amount: processingFee,
                fee_method: feeMethod,
                zelle_reference: paymentMethod === 'zelle' ? zelleReference.trim() : null,
                zelle_receipt_url: paymentMethod === 'zelle' ? zelleReceiptUrl : null,
                items: cart.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: getItemPrice(item),
                })),
            }) as any;

            if (paymentMethod === 'zelle') {
                clearCart();
                window.location.href = `/orders/${order.id}`;
            } else if (paymentMethod === 'credit' || (isCreditAccount && paymentMethod !== 'stripe' && paymentMethod !== 'ach')) {
                clearCart();
                window.location.href = `/orders/${order.id}`;
            } else {
                // Cash / Card / ACH customer: launch Stripe payment modal
                try {
                    const intentRes = await api.post('/payments/create-intent', {
                        amount: finalTotal,
                        orderId: order.id,
                        customerEmail: user.email,
                        paymentMethodType: paymentMethod === 'ach' ? 'us_bank_account' : undefined,
                    }) as any;

                    if (intentRes && intentRes.clientSecret) {
                        setStripePaymentData({
                            clientSecret: intentRes.clientSecret,
                            amount: finalTotal,
                            orderId: order.id,
                        });
                        return; // Wait for modal completion
                    }
                } catch (payErr) {
                    console.error('Could not initialize payment intent:', payErr);
                }
                clearCart();
                window.location.href = `/orders/${order.id}`;
            }
        } catch (error) {
            console.error('Error placing order:', error);
            showNotification(lbl(
                'Hubo un error al procesar tu pedido. Por favor, intenta de nuevo.',
                'There was an error processing your order. Please try again.'
            ), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Delivery type options ─────────────────────────────────────────────────
    const typeOptions: { value: DeliveryType; icon: React.ReactNode; label: string; desc: string }[] = [
        {
            value: 'pickup',
            icon: <Store size={20} />,
            label: lbl('Pick Up', 'Pick Up'),
            desc: lbl('Retiro en nuestra tienda (Jhoanes)', 'Pick up at our store (Jhoanes)'),
        },
        {
            value: 'saved',
            icon: <Home size={20} />,
            label: lbl('Dirección Guardada', 'Saved Address'),
            desc: lbl('Usar una de mis direcciones registradas', 'Use one of my saved addresses'),
        },
        {
            value: 'other',
            icon: <Truck size={20} />,
            label: lbl('Otra Dirección', 'Other Address'),
            desc: lbl('Entregar en una dirección diferente', 'Deliver to a different address'),
        },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#fafafa]">
            <Navbar />

            {/* Floating Notification Toast */}
            {notification && (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)] px-2 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
                >
                    <div className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all ${
                        notification.type === 'error'
                            ? 'bg-red-50/95 border-red-200 text-red-900 shadow-red-500/15'
                            : notification.type === 'warning'
                            ? 'bg-amber-50/95 border-amber-200 text-amber-900 shadow-amber-500/15'
                            : 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-500/15'
                    }`}>
                        {notification.type === 'error' ? (
                            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                                <AlertCircle size={18} />
                            </div>
                        ) : notification.type === 'warning' ? (
                            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
                                <AlertCircle size={18} />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
                                <Check size={18} />
                            </div>
                        )}
                        <div className="flex-1 pt-1 text-sm font-semibold leading-relaxed">
                            {notification.message}
                        </div>
                        <button
                            type="button"
                            onClick={() => setNotification(null)}
                            className="p-1.5 rounded-xl hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            aria-label={lbl('Cerrar notificación', 'Close notification')}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 py-12">
                <div className="flex flex-col lg:flex-row gap-12">

                    {/* ── Left column ───────────────────────────────────────── */}
                    <div className="flex-1 space-y-8">
                        <h1 className="text-4xl font-bold font-serif text-foreground">
                            {lbl('Confirmar Pedido', 'Confirm Order')}
                        </h1>

                        {/* ── Delivery type selector ───────────────────────── */}
                        <section className="bg-card rounded-3xl border border-border p-8 shadow-sm">
                            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                <Truck className="text-primary" size={20} />
                                {lbl('Tipo de Entrega', 'Delivery Type')}
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {typeOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setDeliveryType(opt.value)}
                                        className={`flex flex-col items-start gap-2 p-5 rounded-2xl border-2 text-left transition-all ${
                                            deliveryType === opt.value
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/30'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            deliveryType === opt.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                                        }`}>
                                            {deliveryType === opt.value ? <Check size={18} /> : opt.icon}
                                        </div>
                                        <p className="font-black text-sm">{opt.label}</p>
                                        <p className="text-[11px] text-muted-foreground leading-snug">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>

                            {/* ── Pick Up info ────────────────────────────── */}
                            {deliveryType === 'pickup' && (
                                <div className="mt-6 flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-5 animate-fade-in">
                                    <Store size={20} className="text-green-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-green-800 text-sm">
                                            {lbl('Recoger en tienda', 'Store Pickup')}
                                        </p>
                                        <p className="text-xs text-green-600 mt-0.5">
                                            {lbl(
                                                'Te avisaremos cuando tu pedido esté listo para recoger en Jhoanes.',
                                                'We\'ll notify you when your order is ready for pickup at Jhoanes.'
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── Saved addresses ───────────────────────── */}
                            {deliveryType === 'saved' && (
                                <div className="mt-6 animate-fade-in">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-sm font-bold text-muted-foreground">
                                            {lbl('Selecciona tu dirección de entrega:', 'Select your delivery address:')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => router.push('/profile/addresses/new?redirect=/checkout')}
                                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <Plus size={13} />
                                            {lbl('Agregar nueva', 'Add new')}
                                        </button>
                                    </div>

                                    {isFetchingAddresses ? (
                                        <div className="py-6 flex items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 size={18} className="animate-spin" />
                                            {lbl('Cargando tus direcciones...', 'Loading your addresses...')}
                                        </div>
                                    ) : addresses.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {addresses.map(addr => (
                                                <button
                                                    key={addr.id}
                                                    type="button"
                                                    onClick={() => setSelectedAddressId(addr.id)}
                                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                                                        selectedAddressId === addr.id
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-border hover:border-primary/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="font-bold text-sm">{addr.alias}</p>
                                                        {selectedAddressId === addr.id && (
                                                            <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0">
                                                                <Check size={11} strokeWidth={3} className="text-white" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{addr.address}</p>
                                                    {addr.notes && (
                                                        <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{addr.notes}</p>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border/60">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                {lbl('No tienes direcciones guardadas.', 'You have no saved addresses.')}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => router.push('/profile/addresses/new?redirect=/checkout')}
                                                className="px-5 py-2.5 bg-primary text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
                                            >
                                                {lbl('Agregar mi primera dirección', 'Add my first address')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Other address (inline form) ──────────── */}
                            {deliveryType === 'other' && (
                                <InlineAddressForm
                                    locale={locale}
                                    onReady={data => setOtherAddrData(data)}
                                />
                            )}
                        </section>

                        {/* ── Delivery date & Cutoff Guard ────────────────── */}
                        <section className="bg-[#0f0f0f] rounded-3xl border border-[#222] p-8 shadow-xl">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white/10 text-white rounded-2xl shadow-md shrink-0">
                                    <Calendar size={24} />
                                </div>
                                <div className="w-full">
                                    <h3 className="text-xl font-bold text-white mb-2">
                                        {deliveryType === 'pickup' 
                                            ? lbl('Fecha de Disponibilidad para Pick Up', 'Pick Up Ready Date')
                                            : lbl('Fecha de Entrega Programada', 'Scheduled Delivery Date')}
                                    </h3>

                                    {/* Cutoff Status Badge */}
                                    <div className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 ${
                                        isPastCutoff
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    }`}>
                                        <Clock size={12} />
                                        {isPastCutoff
                                            ? lbl('Corte de producción a las 12:00 PM superado', '12:00 PM production cutoff exceeded')
                                            : lbl('Recepción activa antes de las 12:00 PM', 'Order reception active before 12:00 PM')}
                                    </div>

                                    {/* Notice when past 12:00 PM cutoff */}
                                    {isPastCutoff && (
                                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-4 text-amber-300 text-xs flex items-start gap-3">
                                            <AlertCircle size={18} className="shrink-0 text-amber-400 mt-0.5" />
                                            <div>
                                                <p className="font-bold">
                                                    {lbl(
                                                        `Corte de producción a las 12:00 PM superado. Próxima entrega disponible a partir de ${nextAvailableDateFormatted}.`,
                                                        `12:00 PM production cutoff exceeded. Next delivery available starting from ${nextAvailableDateFormatted}.`
                                                    )}
                                                </p>
                                                <p className="text-[11px] text-amber-400/80 mt-1">
                                                    {lbl(
                                                        'Los pedidos recibidos a partir de las 12:00 PM (hora de NY) se preparan en el siguiente ciclo de horneado.',
                                                        'Orders placed after 12:00 PM (NY time) are baked in the next available production cycle.'
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Date Selector input with min limit */}
                                    <div className="mt-2 space-y-2">
                                        <label className="text-xs font-bold text-white/70 block uppercase tracking-wider">
                                            {lbl('Selecciona o confirma la fecha:', 'Select or confirm date:')}
                                        </label>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                            <input
                                                type="date"
                                                min={minSelectableDate}
                                                value={rawDeliveryDate}
                                                onChange={e => handleDeliveryDateChange(e.target.value)}
                                                className="px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-primary text-sm w-full sm:w-auto"
                                            />
                                            <p className="text-2xl font-black text-white capitalize">{deliveryDate}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── Payment Method Section ─────────────────────── */}
                        <section className="bg-white rounded-3xl border border-border p-8 shadow-sm">
                            <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                                <CreditCard size={22} className="text-primary" />
                                {lbl('Método de Pago', 'Payment Method')}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-6">
                                {lbl('Selecciona tu método de pago preferido para completar la orden.', 'Choose your preferred payment method to complete the order.')}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {/* Stripe Card option */}
                                <div 
                                    data-testid="payment-method-stripe"
                                    onClick={() => setPaymentMethod('stripe')}
                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                                        paymentMethod === 'stripe'
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-border/70 hover:border-border bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                                                <CreditCard size={18} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-sm text-slate-800">
                                                    {lbl('Tarjeta de Crédito / Débito', 'Credit / Debit Card')}
                                                </span>
                                                <span className="ml-2 px-2 py-0.5 bg-violet-100 text-violet-800 text-[9px] font-black uppercase rounded-full">
                                                    +3.5% Fee
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                            paymentMethod === 'stripe' ? 'border-primary' : 'border-slate-300'
                                        }`}>
                                            {paymentMethod === 'stripe' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {lbl('Pasarela instantánea Stripe (+3.5% Processing Fee).', 'Instant Stripe gateway (+3.5% Processing Fee).')}
                                    </p>
                                </div>

                                {/* ACH Direct Debit option */}
                                <div 
                                    data-testid="payment-method-ach"
                                    onClick={() => setPaymentMethod('ach')}
                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                                        paymentMethod === 'ach'
                                            ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                                            : 'border-border/70 hover:border-border bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-sm text-slate-800">
                                                    {lbl('Transferencia ACH Direct Debit', 'ACH Direct Debit')}
                                                </span>
                                                <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-full">
                                                    0.8% (Tope $5.00)
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                            paymentMethod === 'ach' ? 'border-emerald-600' : 'border-slate-300'
                                        }`}>
                                            {paymentMethod === 'ach' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {lbl('Débito directo en cuenta bancaria comercial (Tarifa plana de 0.8%, tope máx $5.00).', 'Direct bank account debit (0.8% fee, maximum $5.00 cap).')}
                                    </p>
                                </div>

                                {/* Zelle option */}
                                <div 
                                    data-testid="payment-method-zelle"
                                    onClick={() => setPaymentMethod('zelle')}
                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                                        paymentMethod === 'zelle'
                                            ? 'border-green-600 bg-green-50/50 shadow-sm'
                                            : 'border-border/70 hover:border-border bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs">
                                                Zelle
                                            </div>
                                            <div>
                                                <span className="font-bold text-sm text-slate-800">
                                                    {lbl('Transferencia Zelle B2B', 'Zelle B2B Transfer')}
                                                </span>
                                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-[9px] font-black uppercase rounded-full">
                                                    $0.00 Fee (0%)
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                            paymentMethod === 'zelle' ? 'border-green-600' : 'border-slate-300'
                                        }`}>
                                            {paymentMethod === 'zelle' && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {lbl('Pago directo interbancario sin comisiones de procesamiento ($0.00).', 'Direct bank transfer with zero processing fees ($0.00).')}
                                    </p>
                                </div>
                            </div>

                            {/* Credit Account option if eligible */}
                            {isCreditAccount && (
                                <div 
                                    onClick={() => setPaymentMethod('credit')}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all mb-6 ${
                                        paymentMethod === 'credit'
                                            ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                                            : 'border-border/70 hover:border-border bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                                <Store size={16} />
                                            </div>
                                            <span className="font-bold text-sm text-slate-800">
                                                {lbl('Línea de Crédito Comercial B2B (Sin recargo)', 'Commercial B2B Credit Line (No surcharge)')}
                                            </span>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                            paymentMethod === 'credit' ? 'border-blue-600' : 'border-slate-300'
                                        }`}>
                                            {paymentMethod === 'credit' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Zelle Instructions Box & Reference Input */}
                            {paymentMethod === 'zelle' && (
                                <div className="p-6 bg-purple-50/80 rounded-2xl border border-purple-200/90 space-y-4 animate-in fade-in duration-200">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                                            Z
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-purple-950">
                                                {lbl('Datos de Transferencia Zelle B2B', 'Zelle B2B Transfer Details')}
                                            </h4>
                                            <p className="text-xs text-purple-800 mt-0.5">
                                                {lbl('Envía el pago desde la app de tu banco a los siguientes datos:', 'Send payment from your banking app to:')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-purple-200 space-y-1.5 text-xs">
                                        <div className="flex justify-between items-center py-1 border-b border-purple-100">
                                            <span className="text-purple-700 font-medium">{lbl('Correo Zelle:', 'Zelle Email:')}</span>
                                            <span className="font-black text-purple-950 select-all">pedidos@jhoanes.com</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-purple-700 font-medium">{lbl('Beneficiario / Razón:', 'Payee / Business Name:')}</span>
                                            <span className="font-black text-purple-950">Pedidos Jhoanes LLC</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 pt-2">
                                        <label className="text-xs font-bold text-purple-950 block">
                                            {lbl('Número de Confirmación / Referencia Zelle *', 'Zelle Confirmation / Reference Number *')}
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder={lbl('Ej: Ref: 98765432 o ID de transacción', 'E.g. Ref: 98765432 or transaction ID')}
                                            value={zelleReference}
                                            onChange={e => setZelleReference(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-purple-300 rounded-xl font-bold text-slate-800 placeholder:text-purple-300 outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                        />
                                        <p className="text-[10px] text-purple-700 italic">
                                            {lbl(
                                                'Este número será contrastado por administración para conciliar tu pago y habilitar el pedido en producción.',
                                                'This reference will be verified by administration to reconcile your payment and authorize production.'
                                            )}
                                        </p>
                                    </div>

                                    {/* Upload Screenshot / Comprobante Zelle */}
                                    <div className="space-y-2 pt-2 border-t border-purple-200/70">
                                        <label className="text-xs font-bold text-purple-950 flex items-center justify-between">
                                            <span>{lbl('Comprobante / Captura de Transferencia (Screenshot)', 'Transfer Screenshot / Receipt')}</span>
                                            {isUploadingReceipt && (
                                                <span className="text-[10px] text-purple-600 flex items-center gap-1 font-normal">
                                                    <Loader2 size={12} className="animate-spin" /> {lbl('Subiendo...', 'Uploading...')}
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,application/pdf"
                                            onChange={handleReceiptFileChange}
                                            className="w-full text-xs text-purple-900 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                                        />
                                        {zelleReceiptUrl && (
                                            <div className="flex items-center gap-2 p-2 bg-purple-100/80 rounded-lg text-[11px] text-purple-900 font-medium">
                                                <Check size={14} className="text-emerald-600" />
                                                <span>{lbl('Comprobante adjuntado correctamente', 'Receipt attached successfully')}</span>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-purple-700 italic">
                                            {lbl(
                                                'Adjunta la captura de pantalla de la confirmación bancaria para acelerar la verificación manual.',
                                                'Attach your banking confirmation screenshot to expedite manual verification.'
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* ── Payment Policies Section (TASK-50-04) ─────────────────────── */}
                        <section className="bg-accent/5 rounded-3xl border border-accent/20 p-8 text-black">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <CreditCard size={20} />
                                {lbl('Políticas de Pago y Despacho', 'Payment and Dispatch Policy')}
                            </h3>
                            <p className="text-sm leading-relaxed text-slate-800">
                                {lbl(
                                    'Regla operativa comercial: El pedido debe quedar cancelado a más tardar el día previo a la entrega para programar el despacho (ej. entrega domingo → pago sábado).',
                                    'Operational commercial policy: The order must be paid at the latest the day before delivery to schedule dispatch (e.g. Sunday delivery → Saturday payment).'
                                )}
                            </p>
                            <div className="mt-3 p-3.5 bg-white/80 rounded-xl border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <span className="text-slate-600 font-medium">
                                    {lbl('Entrega programada para:', 'Scheduled delivery for:')}
                                </span>
                                <strong className="text-primary font-bold capitalize text-sm">
                                    {deliveryDate || lbl('Pendiente de selección', 'Pending selection')}
                                </strong>
                            </div>
                        </section>
                    </div>

                    {/* ── Right sidebar ─────────────────────────────────────── */}
                    <div className="w-full lg:w-[400px]">
                        <div className="bg-card rounded-3xl border border-border p-8 shadow-xl sticky top-28">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <ShoppingBag size={20} />
                                {lbl('Resumen', 'Order Summary')}
                            </h2>

                            <div className="space-y-4 mb-8">
                                {cart.map(item => {
                                    const unitPrice = getItemPrice(item);
                                    const basePrice = Number(item.originalPrice || item.price || 0);
                                    const hasDiscount = unitPrice < basePrice;

                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border/40 gap-4">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-foreground truncate">{item.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-primary font-black uppercase tracking-widest">${unitPrice.toFixed(2)} c/u</span>
                                                    {hasDiscount && (
                                                        <span className="text-[8px] text-muted-foreground line-through">${basePrice.toFixed(2)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <div className="grid grid-cols-[24px_auto_24px] items-center gap-1.5 bg-white rounded-xl border border-border/60 p-1 shadow-sm shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        className="w-6 h-6 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="text-xs font-black min-w-[1.25rem] text-center px-1">{item.quantity}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        className="w-6 h-6 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <span className="text-xs font-black text-primary min-w-[50px] text-right">
                                                    ${(unitPrice * item.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {cart.length === 0 && (
                                    <p className="text-sm text-center text-muted-foreground py-4 italic">
                                        {lbl('Tu carrito está vacío', 'Your cart is empty')}
                                    </p>
                                )}

                                {/* Delivery type badge in summary */}
                                <div className="pt-2 flex items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
                                        deliveryType === 'pickup'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-primary/5 text-primary border-primary/20'
                                    }`}>
                                        {deliveryType === 'pickup'
                                            ? lbl('🏪 Pick Up en tienda', '🏪 Store Pickup')
                                            : lbl('🚛 Delivery', '🚛 Delivery')}
                                    </span>
                                </div>

                                 <div className="border-t border-border pt-4 flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <span className="text-muted-foreground">{lbl('Subtotal', 'Subtotal')}</span>
                                        <span className="font-bold">${subtotal.toFixed(2)}</span>
                                    </div>

                                    {/* Delivery fee breakdown according to precedence */}
                                    {deliveryType === 'pickup' ? (
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <span className="text-muted-foreground">{lbl('Entrega en Panadería', 'Bakery Pickup')}</span>
                                            <span className="font-bold text-emerald-600 font-mono">$0.00</span>
                                        </div>
                                    ) : hasVipFee ? (
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground">{lbl('Cargo por Delivery', 'Delivery Fee')}</span>
                                                <span className="text-[10px] text-primary font-bold">{lbl('⭐ Tarifa Especial VIP', '⭐ VIP Special Rate')}</span>
                                            </div>
                                            <span className="font-bold text-amber-600 font-mono">+${deliveryFee.toFixed(2)}</span>
                                        </div>
                                    ) : resolvedZone ? (
                                        isFreeDeliveryEligible ? (
                                            <div className="flex flex-col gap-1 mb-2 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                                        {lbl(`Zona: ${resolvedZone.name}`, `Zone: ${resolvedZone.name}`)}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 font-mono">
                                                        <span className="text-emerald-600/70 line-through text-[11px]">
                                                            +${Number(resolvedZone.base_fee).toFixed(2)}
                                                        </span>
                                                        <span className="font-black text-emerald-700 dark:text-emerald-400">$0.00</span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                    🎉 {lbl(
                                                        `¡Envío Gratis por compra mayor a $${Number(resolvedZone.min_free_delivery_amount).toFixed(2)}!`,
                                                        `Free Delivery for orders over $${Number(resolvedZone.min_free_delivery_amount).toFixed(2)}!`
                                                    )}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1 mb-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <div className="flex flex-col">
                                                        <span className="text-muted-foreground">{lbl('Cargo por Delivery', 'Delivery Fee')}</span>
                                                        <span className="text-[10px] text-muted-foreground font-semibold">
                                                            {resolvedZone.name} {resolvedZip ? `(ZIP ${resolvedZip})` : ''}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-amber-600 font-mono">+${deliveryFee.toFixed(2)}</span>
                                                </div>
                                                {freeDeliveryShortage > 0 && (
                                                    <div className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-xl">
                                                        {lbl(
                                                            `Faltan $${freeDeliveryShortage.toFixed(2)} para Envío Gratis en tu zona`,
                                                            `Add $${freeDeliveryShortage.toFixed(2)} more for Free Delivery in your zone`
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground">{lbl('Cargo por Delivery', 'Delivery Fee')}</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {resolvedZip
                                                        ? lbl(`Tarifa General (ZIP ${resolvedZip})`, `Standard Fee (ZIP ${resolvedZip})`)
                                                        : lbl('Tarifa General', 'Standard Fee')}
                                                </span>
                                            </div>
                                            <span className="font-bold text-amber-600 font-mono">+${deliveryFee.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {/* Processing Fee Line */}
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <div className="flex flex-col">
                                            <span className="text-muted-foreground">{lbl('Processing Fee', 'Processing Fee')}</span>
                                            <span className="text-[10px] text-slate-500 font-semibold">
                                                {paymentMethod === 'stripe'
                                                    ? lbl('Tarjeta de Crédito/Débito (3.5%)', 'Credit/Debit Card (3.5%)')
                                                    : paymentMethod === 'ach'
                                                        ? lbl('ACH Direct Debit (0.8%, máx $5.00)', 'ACH Direct Debit (0.8%, max $5.00)')
                                                        : lbl(`${paymentMethod.toUpperCase()} (0.0% Exento)`, `${paymentMethod.toUpperCase()} (0.0% Exempt)`)}
                                            </span>
                                        </div>
                                        <span className={`font-bold font-mono ${processingFee > 0 ? 'text-slate-800' : 'text-emerald-600'}`}>
                                            {processingFee > 0 ? `+$${processingFee.toFixed(2)}` : '$0.00'}
                                        </span>
                                    </div>

                                    {/* Real-time Dynamic Fees Breakdown: Subtotal + Flete + Processing Fee ($X.XX) = Total (TASK-47-02) */}
                                    <div
                                        data-testid="checkout-fee-breakdown-formula"
                                        className="my-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-sm"
                                    >
                                        <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1 flex items-center justify-between">
                                            <span>{lbl('Desglose Transversal de Pagos', 'Dynamic Fees Breakdown')}</span>
                                            <span className="text-[9px] text-primary lowercase font-mono">live</span>
                                        </div>
                                        <div className="text-[11px] font-mono font-bold text-slate-800 tracking-tight leading-relaxed">
                                            <span>Subtotal (${discountedSubtotal.toFixed(2)}) + Flete (${deliveryFee.toFixed(2)}) + Processing Fee (${processingFee.toFixed(2)}) = Total (${finalTotal.toFixed(2)})</span>
                                        </div>
                                    </div>

                                    {totalDiscount > 0 && (
                                        <div className="flex justify-between items-center text-xs mb-3 text-green-600 bg-green-50/50 p-2 rounded-xl border border-green-100/50">
                                            <div className="flex flex-col">
                                                <span className="font-black uppercase tracking-widest text-[9px]">{lbl('Descuentos Aplicados', 'Discounts Applied')}</span>
                                                <span className="text-[8px] italic">
                                                    {profile?.general_discount > 0 && !profile?.productDiscounts?.length
                                                        ? lbl(`-${profile.general_discount}% aplicado`, `-${profile.general_discount}% applied`)
                                                        : lbl('Descuentos exclusivos aplicados', 'Exclusive discounts applied')}
                                                </span>
                                            </div>
                                            <span className="font-bold">-${totalDiscount.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {finalTotal < minOrderAmount && (
                                        <div className="p-3 bg-red-50 rounded-xl border border-red-100 mb-2">
                                            <p className="text-[10px] text-red-600 font-black uppercase tracking-tight leading-tight">
                                                {lbl(
                                                    `Monto mínimo para pedido: $${minOrderAmount.toFixed(2)}. Te invitamos a completar tu pedido.`,
                                                    `Minimum order amount: $${minOrderAmount.toFixed(2)}. Please add more items to complete.`
                                                )}
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center mt-2">
                                        <span className="font-bold text-lg">{lbl('Total a Pagar', 'Final Total')}</span>
                                        <span className="text-3xl font-black text-primary">${finalTotal.toFixed(2)}</span>
                                    </div>

                                    {totalDiscount > 0 && (
                                        <div className="mt-4 p-5 bg-primary/5 rounded-[2.5rem] border border-primary/20 animate-pulse-slow">
                                            <p className="text-[10px] text-primary font-black uppercase tracking-[0.1em] text-center leading-relaxed">
                                                {userDiscounts?.general_discount > 0 && !userDiscounts?.productDiscounts?.length ? (
                                                    lbl(
                                                        `✨ Descuento especial del ${userDiscounts.general_discount}%, que representa $${totalDiscount.toFixed(2)} en el total de su compra`,
                                                        `✨ Special ${userDiscounts.general_discount}% discount, representing $${totalDiscount.toFixed(2)} in your total purchase`
                                                    )
                                                ) : (
                                                    lbl(
                                                        `🎉 ¡Has ahorrado un total de $${totalDiscount.toFixed(2)} con tus descuentos exclusivos!`,
                                                        `🎉 You have saved a total of $${totalDiscount.toFixed(2)} with your exclusive discounts!`
                                                    )
                                                )}
                                            </p>
                                        </div>
                                    )}

                                    <p className="text-[9px] text-muted-foreground font-bold mt-2 text-center">
                                        {lbl(`Monto mínimo por pedido: $${minOrderAmount.toFixed(2)}`, `Minimum order amount: $${minOrderAmount.toFixed(2)}`)}
                                    </p>
                                </div>
                            </div>

                            {/* B2B Credit Notice */}
                            {isCreditAccount && (
                                <div className="p-4 rounded-2xl border text-xs my-4 space-y-1.5 shadow-sm transition-all bg-blue-50/70 border-blue-200 text-blue-900">
                                    <div className="flex items-center justify-between font-bold">
                                        <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                            <CreditCard size={14} className="text-blue-600" />
                                            {lbl('Modalidad de Cuenta', 'Account Mode')}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-black uppercase">
                                            {lbl('Línea de Crédito', 'Credit Account')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">{lbl('Crédito Disponible:', 'Available Credit:')}</span>
                                        <span className="font-black text-slate-800">${availableCredit.toFixed(2)}</span>
                                    </div>

                                    {exceedsCreditLimit && (
                                        <div className="p-2.5 mt-2 bg-red-100/90 text-red-800 rounded-xl font-bold flex items-start gap-2 border border-red-200">
                                            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                                            <p className="leading-tight">
                                                {lbl(
                                                    `🚫 Límite de crédito excedido. Esta orden ($${finalTotal.toFixed(2)}) supera tu crédito disponible. Comunícate con gerencia para autorizar un sobregiro.`,
                                                    `🚫 Credit limit exceeded. This order ($${finalTotal.toFixed(2)}) exceeds your available credit. Contact management to authorize an overdraft.`
                                                )}
                                            </p>
                                        </div>
                                    )}

                                    {isCreditAccount && (usedCredit + finalTotal > creditLimit) && hasCreditOverride && (
                                        <div className="p-2.5 mt-2 bg-amber-100/90 text-amber-800 rounded-xl font-bold flex items-start gap-2 border border-amber-200">
                                            <Check size={16} className="shrink-0 mt-0.5 text-amber-700" />
                                            <p className="leading-tight">
                                                {lbl(
                                                    '⚠️ Autorización de sobregiro activa: Cuentas con permiso administrativo para procesar esta orden por encima de tu límite.',
                                                    '⚠️ Overdraft override active: You have administrative permission to process this order above your standard limit.'
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}


                            <div className="flex items-start gap-3 p-4 bg-white/60 rounded-2xl border border-border/80 my-4 shadow-sm">
                                <input
                                    id="terms_agree_checkout"
                                    type="checkbox"
                                    checked={termsAccepted}
                                    onChange={e => setTermsAccepted(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                                />
                                <label htmlFor="terms_agree_checkout" className="text-xs text-foreground/80 font-medium leading-relaxed cursor-pointer select-none">
                                    {locale === 'en' ? (
                                        <>I have read and agree to the <a href="/terms" target="_blank" className="text-primary font-bold underline hover:text-black">Commercial Terms and Conditions</a> of Jhoanes Wholesale.</>
                                    ) : (
                                        <>He leído y acepto los <a href="/terms" target="_blank" className="text-primary font-bold underline hover:text-black">Términos y Condiciones Comerciales</a> de Jhoanes Wholesale.</>
                                    )}
                                </label>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={isLoading || cart.length === 0 || exceedsCreditLimit}
                                className="w-full py-4 bg-[#111] hover:bg-[#222] text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        {lbl('Confirmar Pedido', 'Place Order')}
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => router.push('/')}
                                className="w-full py-3 mt-4 text-sm font-bold text-primary hover:bg-primary/5 rounded-2xl transition-colors"
                            >
                                {lbl('Seguir Comprando', 'Continue Shopping')}
                            </button>

                            <div className="mt-8 pt-8 border-t border-border">
                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-2 text-center tracking-widest">
                                    {lbl('¿Necesitas ayuda con tu pedido?', 'Need help with your order?')}
                                </p>
                                <button
                                    onClick={() => window.open('https://wa.me/yournumber?text=Hola, tengo una duda sobre mi pedido antes de confirmarlo.', '_blank')}
                                    className="w-full py-3 text-primary font-bold text-xs hover:underline transition-all flex items-center justify-center gap-2"
                                >
                                    {lbl('Contactar Soporte', 'Contact Support')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <MinimumAmountModal 
                isOpen={showMinAmountModal} 
                onClose={() => setShowMinAmountModal(false)} 
                locale={locale} 
                minOrderAmount={minOrderAmount}
            />

            {stripePaymentData && (
                <StripePaymentModal
                    clientSecret={stripePaymentData.clientSecret}
                    amount={stripePaymentData.amount}
                    orderId={stripePaymentData.orderId}
                    onSuccess={handleStripePaymentSuccess}
                    onCancel={async () => {
                        const cancelledOrderId = stripePaymentData.orderId;
                        setStripePaymentData(null);
                        try {
                            await api.patch(`/orders/${cancelledOrderId}/status`, { status: 'Cancelado' }).catch(() => {});
                        } catch (_) {}
                        showNotification(
                            lbl(
                                'Pago cancelado. Tus productos se mantienen en el carrito para que puedas reintentar cuando gustes.',
                                'Payment cancelled. Your items remain in the cart so you can retry anytime.'
                            ),
                            'warning'
                        );
                    }}
                    locale={locale}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimum Amount Modal
// ─────────────────────────────────────────────────────────────────────────────
function MinimumAmountModal({ isOpen, onClose, locale, minOrderAmount }: { isOpen: boolean; onClose: () => void; locale: string; minOrderAmount: number }) {
    const router = useRouter();
    if (!isOpen) return null;

    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-card w-full max-w-md rounded-[32px] border border-border shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="text-primary" size={40} />
                </div>
                
                <h3 className="text-2xl font-black text-foreground mb-4">
                    {lbl('Monto Mínimo Requerido', 'Minimum Amount Required')}
                </h3>
                
                <p className="text-muted-foreground font-medium mb-8">
                    {lbl(
                        `Tu pedido actual es inferior a $${minOrderAmount.toFixed(2)}. Por favor, añade más productos para completar tu compra mínima.`,
                        `Your current order is below $${minOrderAmount.toFixed(2)}. Please add more items to complete your minimum purchase.`
                    )}
                </p>

                <div className="space-y-3">
                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    >
                        {lbl('Volver al Catálogo', 'Back to Catalog')}
                        <ChevronRight size={16} />
                    </button>
                    
                    <button
                        onClick={onClose}
                        className="w-full py-3 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {lbl('Cerrar', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
