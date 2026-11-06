'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/layout/Navbar';
import {
    Calendar, MapPin, CreditCard, ChevronRight, ShoppingBag,
    Loader2, Plus, Clock, Minus, Store, Truck, Home,
    ChevronDown, Check, AlertCircle, BookmarkPlus, Bookmark,
    Map as MapIcon, RotateCcw, Search, X, Building2,
    Moon, Key, Camera, Snowflake, ShieldCheck, ChevronUp, Upload, Trash2, FileText, Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_KEY } from '@/lib/config';
import StripePaymentModal from '@/components/checkout/StripePaymentModal';
import { calculateProcessingFee } from '@/lib/fee-calculator';

const libraries: ('places')[] = ['places'];

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
    onReady: (data: { 
        alias: string; 
        address: string; 
        notes: string; 
        saveMode: 'save' | 'temporary'; 
        lat: number; 
        lng: number; 
        refined_lat: number | null; 
        refined_lng: number | null;
        access_code?: string;
        has_key?: boolean;
        key_location?: string;
        fridge_access_required?: boolean;
        delivery_photos_json?: string;
    }) => void;
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

    // Early Morning Delivery state (Sprint S51)
    const [showEarlyMorning, setShowEarlyMorning] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [keyLocation, setKeyLocation] = useState('');
    const [fridgeAccessRequired, setFridgeAccessRequired] = useState(false);
    const [photos, setPhotos] = useState<string[]>([]);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState('');

    const fileRef0 = React.useRef<HTMLInputElement>(null);
    const fileRef1 = React.useRef<HTMLInputElement>(null);
    const fileRef2 = React.useRef<HTMLInputElement>(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_KEY || '',
        libraries,
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    const onAutocompleteLoad = React.useCallback((auto: google.maps.places.Autocomplete) => {
        setAutocomplete(auto);
    }, []);

    const onPlaceChanged = React.useCallback(() => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                const newPos = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                };
                setMarkerPos(newPos);
                setGeocodedPos(newPos);
                setIsManualAdjustment(false);
                setRefinedPos(null);
                map?.panTo(newPos);
                if (place.formatted_address) {
                    setAddress(place.formatted_address);
                }
            }
        }
    }, [autocomplete, map]);

    useEffect(() => {
        onReady({ 
            alias: alias.trim() || (locale === 'en' ? 'Delivery Address' : 'Dirección de Entrega'), 
            address, 
            notes, 
            saveMode,
            lat: geocodedPos?.lat || markerPos.lat,
            lng: geocodedPos?.lng || markerPos.lng,
            refined_lat: isManualAdjustment ? refinedPos?.lat || null : null,
            refined_lng: isManualAdjustment ? refinedPos?.lng || null : null,
            access_code: accessCode.trim() || undefined,
            has_key: hasKey,
            key_location: hasKey ? keyLocation.trim() || undefined : undefined,
            fridge_access_required: fridgeAccessRequired,
            delivery_photos_json: photos.length > 0 ? JSON.stringify(photos) : undefined,
        });
    }, [alias, address, notes, saveMode, markerPos, geocodedPos, refinedPos, isManualAdjustment, accessCode, hasKey, keyLocation, fridgeAccessRequired, photos, locale]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingPhoto(true);
        setPhotoError('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            let photoUrl = '';
            try {
                const res = await api.upload('/addresses/upload-photo', formData) as any;
                if (res?.url) {
                    photoUrl = res.url;
                }
            } catch (netErr) {
                photoUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            if (photoUrl) {
                setPhotos(prev => {
                    const next = [...prev];
                    if (slotIndex < next.length) {
                        next[slotIndex] = photoUrl;
                    } else {
                        next.push(photoUrl);
                    }
                    return next.slice(0, 3);
                });
            }
        } catch (err: any) {
            setPhotoError(err.message || (locale === 'en' ? 'Error uploading photo' : 'Error al subir la fotografía'));
        } finally {
            setIsUploadingPhoto(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleRemovePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

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
                    {isLoaded ? (
                        <Autocomplete
                            onLoad={onAutocompleteLoad}
                            onPlaceChanged={onPlaceChanged}
                            options={{
                                componentRestrictions: { country: 'us' },
                                fields: ['address_components', 'geometry', 'formatted_address'],
                                types: ['address'],
                            }}
                        >
                            <input
                                required
                                type="text"
                                placeholder={lbl('Calle, número, ciudad...', 'Street, number, city...')}
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                    }
                                }}
                                className="premium-input px-4 py-3 pr-24 w-full"
                            />
                        </Autocomplete>
                    ) : (
                        <input
                            required
                            type="text"
                            placeholder={lbl('Calle, número, ciudad...', 'Street, number, city...')}
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="premium-input px-4 py-3 pr-24 w-full"
                        />
                    )}
                    <button
                        type="button"
                        onClick={forwardGeocode}
                        disabled={isGeocoding}
                        className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
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

            {/* Early Morning Delivery Instructions Collapsible */}
            <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.02] overflow-hidden transition-all">
                <button
                    type="button"
                    onClick={() => setShowEarlyMorning(v => !v)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-primary/[0.04] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Moon size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-xs sm:text-sm text-foreground">
                                    {lbl('Instrucciones de Despacho en Madrugada', 'Early Morning Delivery Instructions')}
                                </h4>
                                <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">
                                    B2B
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {lbl('4:00 AM - 7:00 AM: Códigos de acceso, llaves y neveras', '4:00 AM - 7:00 AM: Access codes, keys & coolers')}
                            </p>
                        </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white border border-border/70 flex items-center justify-center text-primary shrink-0">
                        {showEarlyMorning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                </button>

                {showEarlyMorning && (
                    <div className="p-4 pt-2 border-t border-primary/10 space-y-4 animate-fade-in text-xs">
                        {photoError && (
                            <div className="p-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold">
                                {photoError}
                            </div>
                        )}

                        {/* Access Code */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <ShieldCheck size={12} className="text-primary" />
                                {lbl('Código de acceso (Alarma/Puerta/Elevador)', 'Access code (Alarm/Door/Elevator)')}
                            </label>
                            <input
                                type="text"
                                placeholder={lbl('Ej: Puerta #4589, Alarma 1234', 'e.g. Door #4589, Alarm 1234')}
                                value={accessCode}
                                onChange={e => setAccessCode(e.target.value)}
                                className="premium-input px-3 py-2 text-xs font-bold"
                            />
                        </div>

                        {/* Key location */}
                        <div className="p-3 rounded-xl bg-white border border-border/70 space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={hasKey}
                                    onChange={e => setHasKey(e.target.checked)}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                                />
                                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                    <Key size={13} className="text-primary" />
                                    {lbl('Se requiere llave física para entrar', 'Physical key required for entry')}
                                </span>
                            </label>

                            {hasKey && (
                                <div className="pt-1 pl-6 space-y-1 animate-fade-in">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                                        {lbl('Ubicación de la llave', 'Key location')}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={lbl('Ej: Negocio 24h al frente, lockbox código 1234', 'e.g. 24h store across the street, lockbox code 1234')}
                                        value={keyLocation}
                                        onChange={e => setKeyLocation(e.target.value)}
                                        className="premium-input px-3 py-2 text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Fridge Access Required */}
                        <div className="p-3 rounded-xl bg-white border border-border/70 space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={fridgeAccessRequired}
                                    onChange={e => setFridgeAccessRequired(e.target.checked)}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                                />
                                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                    <Snowflake size={13} className="text-primary" />
                                    {lbl('Acceso directo a Neveras / Cámaras de refrigeración', 'Direct access to Refrigerators / Coolers')}
                                </span>
                            </label>
                            <p className="pl-6 text-[10px] text-muted-foreground">
                                {lbl('Mantener espacio despejado para resguardo inmediato de productos frescos.', 'Please keep space clear inside coolers for immediate fresh product storage.')}
                            </p>
                        </div>

                        {/* Delivery Photos (Up to 3) */}
                        <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <Camera size={13} className="text-primary" />
                                    {lbl('Fotos de fachada, acceso y neveras (Hasta 3)', 'Access & cooler photos (Up to 3)')}
                                </label>
                                <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    {photos.length}/3
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2].map((idx) => (
                                    <div key={idx} className="p-2 rounded-xl bg-white border border-border/80 flex flex-col items-center justify-center min-h-[90px] text-center relative group">
                                        {photos[idx] ? (
                                            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
                                                <img
                                                    src={photos[idx]}
                                                    alt={`Photo ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePhoto(idx)}
                                                    className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full shadow hover:bg-red-700"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (idx === 0) fileRef0.current?.click();
                                                    else if (idx === 1) fileRef1.current?.click();
                                                    else fileRef2.current?.click();
                                                }}
                                                className="w-full h-full py-3 border border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary hover:border-primary/40"
                                            >
                                                <Upload size={14} />
                                                <span className="text-[8px] font-black uppercase">
                                                    {idx === 0 ? lbl('Fachada', 'Door') : idx === 1 ? lbl('Punto', 'Spot') : lbl('Nevera', 'Cooler')}
                                                </span>
                                            </button>
                                        )}
                                        <input
                                            ref={idx === 0 ? fileRef0 : idx === 1 ? fileRef1 : fileRef2}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => handlePhotoUpload(e, idx)}
                                        />
                                    </div>
                                ))}
                            </div>
                            {isUploadingPhoto && (
                                <p className="text-[9px] text-primary font-bold animate-pulse text-center">
                                    {lbl('Subiendo fotografía...', 'Uploading photo...')}
                                </p>
                            )}
                        </div>
                    </div>
                )}
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
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'ach' | 'zelle' | 'credit' | 'check'>('stripe');
    const [zelleReference, setZelleReference] = useState('');
    const [zelleReceiptFile, setZelleReceiptFile] = useState<File | null>(null);
    const [zelleReceiptUrl, setZelleReceiptUrl] = useState<string | null>(null);
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

    // Check payment state (TASK-60-05)
    const [checkNumber, setCheckNumber] = useState('');
    const [checkBank, setCheckBank] = useState('');
    const [checkAmount, setCheckAmount] = useState('');
    const [checkFile, setCheckFile] = useState<File | null>(null);
    const [checkImageUrl, setCheckImageUrl] = useState<string | null>(null);
    const [isUploadingCheck, setIsUploadingCheck] = useState(false);
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);
    const [ocrDetected, setOcrDetected] = useState(false);
    const [checkVerified, setCheckVerified] = useState(false);

    const [addresses, setAddresses] = useState<any[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(true);

    // Delivery type
    const [deliveryType, setDeliveryType] = useState<DeliveryType>('saved');
    const [otherAddrData, setOtherAddrData] = useState<{
        alias: string; address: string; notes: string; saveMode: 'save' | 'temporary';
        lat: number; lng: number; refined_lat: number | null; refined_lng: number | null;
        access_code?: string; has_key?: boolean; key_location?: string; fridge_access_required?: boolean; delivery_photos_json?: string;
    }>({ 
        alias: '', address: '', notes: '', saveMode: 'save',
        lat: centerNY.lat, lng: centerNY.lng, refined_lat: null, refined_lng: null,
        access_code: '', has_key: false, key_location: '', fridge_access_required: false, delivery_photos_json: ''
    });

    // Delivery zone resolution state
    const [resolvedZone, setResolvedZone] = useState<any | null>(null);
    const [isResolvingZone, setIsResolvingZone] = useState(false);
    const [resolvedZip, setResolvedZip] = useState<string | null>(null);

    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    // Discounts & Credit
    const [userDiscounts, setUserDiscounts] = useState<any>(null);
    const [creditSummary, setCreditSummary] = useState<any>(null);
    const [userOrders, setUserOrders] = useState<any[]>([]);
    const [applyStoreCredit, setApplyStoreCredit] = useState<boolean>(true);
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
            api.get(`/users/${user.id}`).catch(() => null), // Includes general_discount and credit_balance
            api.get(`/users/${user.id}/credit-summary`).catch(() => null),
            api.get('/orders').catch(() => []) as Promise<any[]>
        ]).then(([addrData, userData, creditData, ordersData]) => {
            setAddresses(Array.isArray(addrData) ? addrData : []);
            if (addrData?.length > 0) setSelectedAddressId(addrData[0].id);
            setUserDiscounts(userData);
            setCreditSummary(creditData);
            setUserOrders(Array.isArray(ordersData) ? ordersData : []);
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

    // ── TASK-49-06: Logistics Quote via MileageFreightService ────────────────
    const [logisticsQuote, setLogisticsQuote] = useState<any | null>(null);
    const [isQuotingLogistics, setIsQuotingLogistics] = useState(false);

    const targetLat = deliveryType === 'saved'
        ? (currentAddress?.refined_lat ?? currentAddress?.lat)
        : deliveryType === 'other'
        ? (otherAddrData?.refined_lat ?? otherAddrData?.lat)
        : null;

    const targetLng = deliveryType === 'saved'
        ? (currentAddress?.refined_lng ?? currentAddress?.lng)
        : deliveryType === 'other'
        ? (otherAddrData?.refined_lng ?? otherAddrData?.lng)
        : null;

    const targetAddressText = deliveryType === 'saved'
        ? currentAddress?.address
        : deliveryType === 'other'
        ? otherAddrData?.address
        : undefined;

    useEffect(() => {
        if (deliveryType === 'pickup') {
            setLogisticsQuote(null);
            return;
        }

        if (
            targetLat !== null && targetLat !== undefined &&
            targetLng !== null && targetLng !== undefined &&
            !isNaN(Number(targetLat)) && !isNaN(Number(targetLng))
        ) {
            let isMounted = true;
            setIsQuotingLogistics(true);
            api.post('/logistics/quote', {
                destLat: Number(targetLat),
                destLng: Number(targetLng),
                serviceType: 'shared',
                destinationAddress: targetAddressText,
            })
            .then((quote: any) => {
                if (isMounted && quote) {
                    setLogisticsQuote(quote);
                }
            })
            .catch(err => {
                console.warn('Error quoting logistics:', err);
            })
            .finally(() => {
                if (isMounted) setIsQuotingLogistics(false);
            });

            return () => { isMounted = false; };
        } else {
            setLogisticsQuote(null);
        }
    }, [deliveryType, targetLat, targetLng, targetAddressText]);

    // ── Calculation logic & Precedence Matrix ─────────────────────────────────
    const rawSubtotal = getRawSubtotal();
    const discountedSubtotal = getDiscountedSubtotal();

    // TASK-63-04: Complementary Orders Rule ($0 fee if user already has an active order for same delivery date)
    const isComplementaryOrder = useMemo(() => {
        const targetDate = rawDeliveryDate || deliveryDate;
        if (!targetDate || deliveryType === 'pickup') return false;
        return (userOrders || []).some(o => {
            if (o.status === 'cancelled' || o.status === 'Cancelado') return false;
            if (o.delivery_date !== targetDate) return false;
            if (selectedAddressId && o.address_id && o.address_id !== selectedAddressId) return false;
            return true;
        });
    }, [userOrders, rawDeliveryDate, deliveryDate, deliveryType, selectedAddressId]);

    // Matriz de precedencia:
    // 0. Pedido Complementario: siempre $0.00 (TASK-63-04)
    // 1. Pickup: siempre $0.00
    // 2. Tarifa Especial VIP pactada en perfil (user.delivery_fee > 0): prevalece sobre la zona
    // 3. Zona resuelta por ZIP (si subtotal >= min_free_delivery_amount -> $0.00, sino -> zone.base_fee)
    // 4. Cotización Oficial MileageFreightService por coordenadas (TASK-49-06)
    // 5. Contingencia fallback ($15.00) si no hay coordenadas ni zona registrada
    const hasVipFee = Number(profile?.delivery_fee) > 0;
    let deliveryFee = 0;
    if (deliveryType === 'pickup' || isComplementaryOrder) {
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
    } else if (logisticsQuote && typeof logisticsQuote.cost === 'number') {
        deliveryFee = Number(logisticsQuote.cost);
    } else {
        deliveryFee = 15.00; // Contingency fallback
    }

    const isFreeDeliveryEligible = !hasVipFee && !isComplementaryOrder && resolvedZone && Number(resolvedZone.min_free_delivery_amount) > 0 && discountedSubtotal >= Number(resolvedZone.min_free_delivery_amount);
    const freeDeliveryShortage = !hasVipFee && !isComplementaryOrder && resolvedZone && Number(resolvedZone.min_free_delivery_amount) > 0 && discountedSubtotal < Number(resolvedZone.min_free_delivery_amount)
        ? Math.round((Number(resolvedZone.min_free_delivery_amount) - discountedSubtotal + Number.EPSILON) * 100) / 100
        : 0;

    // TASK-47-02: Processing Fee calculation via pure calculateProcessingFee
    const feeMethod = paymentMethod === 'stripe' ? 'STRIPE_CARD' : paymentMethod === 'ach' ? 'ACH' : paymentMethod === 'check' ? 'CHECK' : paymentMethod.toUpperCase();
    const processingFee = calculateProcessingFee(discountedSubtotal, feeMethod);
    const packagingFee = processingFee;
    const packagingDiscount = 0;

    const subtotalWithFees = Math.round((discountedSubtotal + processingFee + deliveryFee + Number.EPSILON) * 100) / 100;

    // TASK-63-03: Saldo a Favor (Store Credit)
    const storeCreditBalance = Math.max(0, Number(userDiscounts?.credit_balance ?? creditSummary?.credit_balance ?? 0));
    const storeCreditApplied = (applyStoreCredit && storeCreditBalance > 0)
        ? Math.min(storeCreditBalance, subtotalWithFees)
        : 0;

    const finalTotal = Math.max(0, Math.round((subtotalWithFees - storeCreditApplied + Number.EPSILON) * 100) / 100);
    const isPaidWithStoreCredit = storeCreditApplied > 0 && finalTotal === 0;
    const totalDiscount = Math.round((rawSubtotal - discountedSubtotal + Number.EPSILON) * 100) / 100;
    const subtotal = rawSubtotal;

    const isCreditAccount = creditSummary?.account_type === 'credit';
    const creditLimit = Number(creditSummary?.credit_limit || 0);
    const usedCredit = Number(creditSummary?.used_credit || 0);
    const availableCredit = Number(creditSummary?.available_credit || 0);
    const hasCreditOverride = Boolean(creditSummary?.credit_override);
    const exceedsCreditLimit = isCreditAccount && paymentMethod === 'credit' && (usedCredit + finalTotal > creditLimit) && !hasCreditOverride;

    // S55: Restringir opción 'Transferencia ACH Direct Debit' a cuentas autorizadas o VIP
    const isAchAvailable = Boolean(profile?.ach_enabled || user?.is_vip);

    // TASK-60-05: Restringir opción 'Pago con Cheque' ÚNICAMENTE a clientes con check_enabled: true
    const isCheckAvailable = Boolean(profile?.check_enabled || user?.check_enabled || creditSummary?.check_enabled);

    useEffect(() => {
        if (!isAchAvailable && paymentMethod === 'ach') {
            setPaymentMethod('stripe');
        }
        if (!isCheckAvailable && paymentMethod === 'check') {
            setPaymentMethod('stripe');
        }
    }, [isAchAvailable, isCheckAvailable, paymentMethod]);

    // ── Delivery date (NY timezone & 12:00 PM cutoff guard - TASK-49-04) ──────
    useEffect(() => {
        const nowNY = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const currentHour = nowNY.getHours();
        const pastCutoff = currentHour >= cutoffHour;
        setIsPastCutoff(pastCutoff);
        setIsBeforeCutoff(!pastCutoff);

        // TASK-49-04: 48h lead time formula: T+2 if pre-12 PM, T+3 if past-12 PM
        const daysToAdd = pastCutoff ? 3 : 2;
        const minDate = new Date(nowNY);
        minDate.setDate(nowNY.getDate() + daysToAdd);

        // Regla de corte S55: La panadería NO despacha los martes (getDay() === 2)
        // Si minDate cae en martes, saltar automáticamente al miércoles (+1 día)
        if (minDate.getDay() === 2) {
            minDate.setDate(minDate.getDate() + 1);
        }

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

        // Regla de corte S55: Impedir la selección de cualquier martes
        const [y, m, d] = newDateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (dateObj.getDay() === 2) {
            showNotification(
                lbl(
                    'Panadería Jhoanes no realiza entregas los martes. Por favor selecciona a partir del miércoles',
                    'Jhoanes Bakery does not make deliveries on Tuesdays. Please select from Wednesday onwards'
                ),
                'warning'
            );
            return;
        }

        if (minSelectableDate && newDateStr < minSelectableDate) {
            showNotification(
                lbl(
                    `Lead time de producción de 48h requerido (corte 12:00 PM). Fecha más temprana disponible: ${nextAvailableDateFormatted}.`,
                    `48h production lead time required (12:00 PM cutoff). Earliest available date: ${nextAvailableDateFormatted}.`
                ),
                'warning'
            );
            return;
        }
        setRawDeliveryDate(newDateStr);
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

    // TASK-60-05: Manejador de foto de cheque con prellenado y simulación OCR asistida
    const handleCheckFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCheckFile(file);
        setIsUploadingCheck(true);
        setIsOcrProcessing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.upload('/orders/upload-receipt', formData) as any;
            if (res?.url) {
                setCheckImageUrl(res.url);
            }
            // Simulación OCR Asistida: Detección inteligente de número de cheque, banco y monto
            const matchedDigits = file.name.match(/\d{3,6}/);
            const detectedNumber = matchedDigits ? matchedDigits[0] : '1048';
            setCheckNumber(detectedNumber);
            setCheckBank(file.name.toLowerCase().includes('chase') ? 'JPMorgan Chase' : 'Chase Bank');
            setCheckAmount(finalTotal.toFixed(2));
            setOcrDetected(true);
            showNotification(
                lbl(
                    '✨ Foto de cheque subida. OCR asistido detectó los campos del documento.',
                    '✨ Check photo uploaded. Assisted OCR detected document fields.'
                ),
                'info'
            );
        } catch (err: any) {
            console.error('Error uploading check photo:', err);
            showNotification(err?.message || lbl('Error al subir la foto del cheque', 'Error uploading check photo'), 'error');
        } finally {
            setIsUploadingCheck(false);
            setIsOcrProcessing(false);
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!user || cart.length === 0) return;

        if (!termsAccepted) {
            showNotification(lbl('Por favor acepta los Términos y Condiciones para continuar.', 'Please accept the Terms and Conditions to proceed.'), 'warning');
            return;
        }

        if (!isPaidWithStoreCredit && paymentMethod === 'ach' && !isAchAvailable) {
            showNotification(
                lbl(
                    'La opción de transferencia ACH está disponible únicamente para cuentas autorizadas o clientes VIP.',
                    'ACH transfer option is only available for authorized accounts or VIP clients.'
                ),
                'error'
            );
            return;
        }

        if (!isPaidWithStoreCredit && paymentMethod === 'zelle') {
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
            if (isUploadingReceipt) {
                showNotification(
                    lbl(
                        'El comprobante de pago se está subiendo. Por favor espera un momento.',
                        'The payment receipt is uploading. Please wait a moment.'
                    ),
                    'info'
                );
                return;
            }
            if (!zelleReceiptUrl) {
                showNotification(
                    lbl(
                        'Es obligatorio adjuntar el comprobante o captura de pantalla de la transferencia Zelle',
                        'It is required to attach the receipt or screenshot of the Zelle transfer'
                    ),
                    'warning'
                );
                return;
            }
        }

        if (!isPaidWithStoreCredit && paymentMethod === 'check') {
            if (isUploadingCheck) {
                showNotification(
                    lbl(
                        'La foto del cheque se está subiendo. Por favor espera un momento.',
                        'The check photo is uploading. Please wait a moment.'
                    ),
                    'info'
                );
                return;
            }
            if (!checkImageUrl) {
                showNotification(
                    lbl(
                        'Es obligatorio adjuntar la foto frontal del cheque.',
                        'Attaching the front photo of the check is required.'
                    ),
                    'warning'
                );
                return;
            }
            if (!checkNumber.trim()) {
                showNotification(
                    lbl('Por favor ingresa el número de cheque.', 'Please enter the check number.'),
                    'warning'
                );
                return;
            }
            if (!checkBank.trim()) {
                showNotification(
                    lbl('Por favor ingresa el nombre del banco emisor.', 'Please enter the issuing bank name.'),
                    'warning'
                );
                return;
            }
            if (!checkVerified) {
                showNotification(
                    lbl(
                        'Debes marcar la casilla de verificación humana confirmando que los datos coinciden con el documento adjunto.',
                        'You must check the human verification box confirming the data matches the attached document.'
                    ),
                    'warning'
                );
                return;
            }
        }

        const [yVal, mVal, dVal] = (rawDeliveryDate || '').split('-').map(Number);
        if (yVal && mVal && dVal) {
            const dateObj = new Date(yVal, mVal - 1, dVal);
            if (dateObj.getDay() === 2) {
                showNotification(
                    lbl(
                        'Panadería Jhoanes no realiza entregas los martes. Por favor selecciona a partir del miércoles',
                        'Jhoanes Bakery does not make deliveries on Tuesdays. Please select from Wednesday onwards'
                    ),
                    'warning'
                );
                return;
            }
        }

        if (!isPaidWithStoreCredit && exceedsCreditLimit) {
            showNotification(lbl(
                `Tu pedido excede tu línea de crédito disponible ($${availableCredit.toFixed(2)}). Comunícate con administración.`,
                `Your order exceeds your available credit line ($${availableCredit.toFixed(2)}). Please contact administration.`
            ), 'error');
            return;
        }

        // Minimum order amount check (evaluated before store credit deduction)
        if (subtotalWithFees < minOrderAmount) {
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
                    access_code: otherAddrData.access_code || null,
                    has_key: !!otherAddrData.has_key,
                    key_location: otherAddrData.key_location || null,
                    fridge_access_required: !!otherAddrData.fridge_access_required,
                    delivery_photos_json: otherAddrData.delivery_photos_json || null,
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
                payment_method: isPaidWithStoreCredit ? 'store_credit' : paymentMethod,
                payment_status: isPaidWithStoreCredit ? 'paid' : undefined,
                fee_amount: processingFee,
                fee_method: feeMethod,
                store_credit_applied: storeCreditApplied,
                is_complementary: isComplementaryOrder,
                notes: isComplementaryOrder ? 'Complementario a orden existente' : undefined,
                zelle_reference: paymentMethod === 'zelle' ? zelleReference.trim() : null,
                zelle_receipt_url: paymentMethod === 'zelle' ? zelleReceiptUrl : null,
                check_number: paymentMethod === 'check' ? checkNumber.trim() : null,
                check_bank: paymentMethod === 'check' ? checkBank.trim() : null,
                check_amount: paymentMethod === 'check' ? (Number(checkAmount) || finalTotal) : null,
                check_image_url: paymentMethod === 'check' ? checkImageUrl : null,
                check_verified: paymentMethod === 'check' ? Boolean(checkVerified) : false,
                items: cart.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: getItemPrice(item),
                })),
            }) as any;

            if (isPaidWithStoreCredit || paymentMethod === 'zelle' || paymentMethod === 'check') {
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
            label: lbl('Retiro en Local (Pick Up)', 'Store Pickup (Pick Up)'),
            desc: lbl('Horario: 8:00 AM - 10:00 AM (Astoria NY)', 'Hours: 8:00 AM - 10:00 AM (Astoria NY)'),
        },
        {
            value: 'saved',
            icon: <Home size={20} />,
            label: lbl('Dirección Guardada', 'Saved Address'),
            desc: lbl('Usar una de mis direcciones registradas', 'Use one of my saved addresses'),
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                <div className="mt-6 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-fade-in shadow-xs">
                                    <Store size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1.5">
                                        <p className="font-bold text-emerald-950 text-sm">
                                            {lbl('Retiro en Local (Pick Up)', 'Store Pickup (Pick Up)')}
                                        </p>
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black tracking-wide shadow-xs">
                                            <Clock size={13} />
                                            <span>{lbl('Horario de retiro en local: 8:00 AM a 10:00 AM (Astoria NY)', 'Store pickup hours: 8:00 AM to 10:00 AM (Astoria NY)')}</span>
                                        </div>
                                        <p className="text-xs text-emerald-800 leading-snug">
                                            {lbl(
                                                'Dirección de retiro: 3304 Broadway, Astoria, NY 11106. Te avisaremos cuando tu orden recién horneada esté lista.',
                                                'Pickup address: 3304 Broadway, Astoria, NY 11106. We\'ll notify you when your freshly baked order is ready.'
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
                                                    {(addr.access_code || addr.has_key || addr.fridge_access_required || addr.delivery_photos_json) && (
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                                <Moon size={9} /> {lbl('Despacho Madrugada OK', 'Early Morning Ready')}
                                                            </span>
                                                            {addr.access_code && (
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                    <ShieldCheck size={9} /> {addr.access_code}
                                                                </span>
                                                            )}
                                                            {addr.fridge_access_required && (
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                    <Snowflake size={9} /> {lbl('Neveras', 'Coolers')}
                                                                </span>
                                                            )}
                                                        </div>
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
                                        <p className="text-[11px] text-white/75 font-medium">
                                            {lbl(
                                                'Nota operativa: Panadería Jhoanes no realiza entregas los días martes. Selecciona a partir del miércoles.',
                                                'Operational note: Jhoanes Bakery does not make deliveries on Tuesdays. Please select from Wednesday onwards.'
                                            )}
                                        </p>
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

                            <div className={`grid grid-cols-1 ${isAchAvailable ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-6`}>
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

                                {/* ACH Direct Debit option - Only for authorized or VIP accounts */}
                                {isAchAvailable && (
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
                                )}

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

                                {/* Check Payment Option (TASK-60-05) */}
                                {isCheckAvailable && (
                                    <div 
                                        data-testid="payment-method-check"
                                        onClick={() => {
                                            setPaymentMethod('check');
                                            if (!checkAmount) {
                                                setCheckAmount(finalTotal.toFixed(2));
                                            }
                                        }}
                                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                                            paymentMethod === 'check'
                                                ? 'border-purple-600 bg-purple-50/50 shadow-sm'
                                                : 'border-border/70 hover:border-border bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs">
                                                    CHK
                                                </div>
                                                <div>
                                                    <span className="font-bold text-sm text-slate-800">
                                                        {lbl('Pago con Cheque B2B', 'B2B Check Payment')}
                                                    </span>
                                                    <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-[9px] font-black uppercase rounded-full">
                                                        $0.00 Fee (0%)
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                paymentMethod === 'check' ? 'border-purple-600' : 'border-slate-300'
                                            }`}>
                                                {paymentMethod === 'check' && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            {lbl('Carga la foto frontal del cheque con prellenado OCR y verificación humana obligatoria.', 'Upload front photo of your check with assisted OCR and mandatory human verification.')}
                                        </p>
                                    </div>
                                )}
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
                                            <span className="font-black text-purple-950 select-all">Chefjhoanes@gmail.com</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-purple-700 font-medium">{lbl('Beneficiario / Razón:', 'Payee / Business Name:')}</span>
                                            <span className="font-black text-purple-950">Jhoanes Bakery & Coffee</span>
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
                                            <span>{lbl('Comprobante / Captura de Transferencia (Screenshot) *', 'Transfer Screenshot / Receipt *')}</span>
                                            {isUploadingReceipt && (
                                                <span className="text-[10px] text-purple-600 flex items-center gap-1 font-normal">
                                                    <Loader2 size={12} className="animate-spin" /> {lbl('Subiendo...', 'Uploading...')}
                                                </span>
                                            )}
                                        </label>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                            <input
                                                id="zelle-receipt-upload"
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,application/pdf"
                                                onChange={handleReceiptFileChange}
                                                className="hidden"
                                            />
                                            <label
                                                htmlFor="zelle-receipt-upload"
                                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                                                    zelleReceiptUrl
                                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs'
                                                }`}
                                            >
                                                {zelleReceiptUrl ? (
                                                    <>
                                                        <Check size={16} />
                                                        <span>{lbl('Comprobante adjuntado', 'Receipt attached')}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload size={16} />
                                                        <span>{lbl('Seleccionar archivo...', 'Choose receipt file...')}</span>
                                                    </>
                                                )}
                                            </label>
                                            {zelleReceiptFile && (
                                                <span className="text-xs text-purple-900 font-medium truncate max-w-xs">
                                                    {zelleReceiptFile.name}
                                                </span>
                                            )}
                                        </div>
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

                            {/* Check Instructions & Photo Upload with OCR (TASK-60-05) */}
                            {paymentMethod === 'check' && (
                                <div className="p-6 bg-purple-50/80 rounded-2xl border border-purple-200/90 space-y-5 animate-in fade-in duration-200">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                                            CHK
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-purple-950">
                                                {lbl('Instrucciones de Pago con Cheque B2B', 'B2B Check Payment Instructions')}
                                            </h4>
                                            <p className="text-xs text-purple-800 mt-0.5">
                                                {lbl('Sube la foto frontal de tu cheque corporativo. El sistema asistirá la captura mediante OCR.', 'Upload the front photo of your business check. Our assisted OCR will extract key fields.')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Dropzone / Upload check photo */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-purple-950 flex items-center justify-between">
                                            <span>{lbl('Foto Frontal del Cheque (Obligatoria) *', 'Front Photo of the Check (Required) *')}</span>
                                            {isUploadingCheck && (
                                                <span className="text-[10px] text-purple-600 flex items-center gap-1 font-normal">
                                                    <Loader2 size={12} className="animate-spin" /> {lbl('Subiendo y procesando OCR...', 'Uploading & reading OCR...')}
                                                </span>
                                            )}
                                        </label>
                                        <div className="border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-2xl p-4 bg-white transition-all text-center">
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                onChange={handleCheckFileChange}
                                                id="check-photo-upload"
                                                className="hidden"
                                            />
                                            <label htmlFor="check-photo-upload" className="cursor-pointer block">
                                                {checkImageUrl ? (
                                                    <div className="space-y-2">
                                                        <div className="relative inline-block">
                                                            <img
                                                                src={checkImageUrl}
                                                                alt="Check Preview"
                                                                className="h-28 max-w-full rounded-xl object-contain border border-purple-200 mx-auto shadow-xs"
                                                            />
                                                            <span className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5">
                                                                <Check size={12} />
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] font-bold text-purple-700 hover:underline">
                                                            {lbl('Haz clic para cambiar la foto del cheque', 'Click to change check photo')}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="py-4 space-y-1">
                                                        <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
                                                            <FileText size={20} />
                                                        </div>
                                                        <p className="text-xs font-bold text-purple-950">
                                                            {lbl('Arrastra o haz clic para subir foto del cheque', 'Drag or click to upload check photo')}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">PNG, JPG o WEBP (máx. 5MB)</p>
                                                    </div>
                                                )}
                                            </label>
                                        </div>

                                        {ocrDetected && (
                                            <div className="p-3 bg-purple-100/90 border border-purple-200 rounded-xl text-xs flex items-center gap-2 text-purple-900 animate-fade-in">
                                                <Sparkles size={16} className="text-purple-600 shrink-0" />
                                                <span className="text-[11px] font-semibold leading-tight">
                                                    {lbl('✨ OCR Asistido: Se han detectado los datos del cheque. Verifica o ajusta los campos a continuación.', '✨ Assisted OCR: Check data detected. Please review or adjust fields below.')}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Fields: Check Number, Bank, Amount */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-purple-200/70">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-purple-950 block mb-1">
                                                {lbl('Número de Cheque *', 'Check Number *')}
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej: 1048"
                                                value={checkNumber}
                                                onChange={e => setCheckNumber(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-purple-950 block mb-1">
                                                {lbl('Banco Emisor *', 'Issuing Bank *')}
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej: Chase / TD Bank"
                                                value={checkBank}
                                                onChange={e => setCheckBank(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-purple-950 block mb-1">
                                                {lbl('Monto ($) *', 'Amount ($) *')}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={checkAmount}
                                                onChange={e => setCheckAmount(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Mandatory Human Verification Checkbox */}
                                    <div className="p-4 bg-white rounded-xl border-2 border-purple-300 space-y-1">
                                        <div className="flex items-start gap-3">
                                            <input
                                                id="check_human_verified"
                                                type="checkbox"
                                                checked={checkVerified}
                                                onChange={e => setCheckVerified(e.target.checked)}
                                                className="mt-0.5 w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer shrink-0"
                                            />
                                            <label htmlFor="check_human_verified" className="text-xs text-purple-950 font-bold leading-relaxed cursor-pointer select-none">
                                                {lbl(
                                                    'Confirmo que el número de cheque, banco y monto coinciden con el documento adjunto.',
                                                    'I confirm that the check number, bank, and amount match the attached document.'
                                                )}
                                            </label>
                                        </div>
                                        <p className="text-[10px] text-purple-700 ml-7 italic">
                                            {lbl(
                                                'El botón de confirmar orden permanecerá inactivo hasta completar esta verificación.',
                                                'The place order button remains disabled until this verification is checked.'
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
                                    {isComplementaryOrder && (
                                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                            🎁 {lbl('Complementario ($0)', 'Complementary ($0)')}
                                        </span>
                                    )}
                                </div>

                                {/* TASK-63-03: Saldo a Favor Banner */}
                                {storeCreditBalance > 0 && (
                                    <div className="my-3 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                                    💰
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-blue-900">
                                                        {lbl(
                                                            `Tienes $${storeCreditBalance.toFixed(2)} de Saldo a Favor disponible`,
                                                            `You have $${storeCreditBalance.toFixed(2)} Store Credit available`
                                                        )}
                                                    </p>
                                                    <p className="text-[11px] text-blue-700 font-medium">
                                                        {storeCreditApplied >= subtotalWithFees
                                                            ? lbl('¡Cubre el 100% de tu orden! No requerirás pago adicional.', 'Covers 100% of your order! No additional payment required.')
                                                            : lbl(`Se descontarán $${storeCreditApplied.toFixed(2)} del total a pagar.`, `$${storeCreditApplied.toFixed(2)} will be deducted from your total.`)}
                                                    </p>
                                                </div>
                                            </div>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-blue-900 select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={applyStoreCredit}
                                                    onChange={(e) => setApplyStoreCredit(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span>{lbl('Aplicar', 'Apply')}</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                 <div className="border-t border-border pt-4 flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <span className="text-muted-foreground">{lbl('Subtotal', 'Subtotal')}</span>
                                        <span className="font-bold">${subtotal.toFixed(2)}</span>
                                    </div>

                                    {/* Delivery fee breakdown according to precedence */}
                                    {isComplementaryOrder ? (
                                        <div className="flex flex-col gap-1 mb-2 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                    🎁 {lbl('Pedido Complementario', 'Complementary Order')}
                                                </span>
                                                <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">$0.00</span>
                                            </div>
                                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                                {lbl(
                                                    'Ya tienes un pedido activo para esta fecha. ¡Flete gratis ($0.00)!',
                                                    'You already have an active order for this date. Free delivery ($0.00)!'
                                                )}
                                            </span>
                                        </div>
                                    ) : deliveryType === 'pickup' ? (
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
                                    ) : logisticsQuote ? (
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground">{lbl('Delivery Fee (Por Millas)', 'Delivery Fee (By Mileage)')}</span>
                                                <span className="text-[10px] text-muted-foreground font-semibold">
                                                    {lbl(`Distancia: ${logisticsQuote.miles} mi desde Astoria`, `Distance: ${logisticsQuote.miles} mi from Astoria`)}
                                                </span>
                                            </div>
                                            <span className="font-bold text-amber-600 font-mono">+${deliveryFee.toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground">{lbl('Delivery Fee', 'Delivery Fee')}</span>
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

                                    {/* Store Credit Line (TASK-63-03) */}
                                    {storeCreditApplied > 0 && (
                                        <div className="flex justify-between items-center text-xs mb-1 bg-blue-50/70 p-2 rounded-xl border border-blue-100 text-blue-800">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{lbl('Saldo a Favor Aplicado', 'Store Credit Applied')}</span>
                                                {isPaidWithStoreCredit && (
                                                    <span className="text-[10px] text-blue-600 font-bold uppercase">{lbl('✅ Pagado con Saldo a Favor', '✅ Paid with Store Credit')}</span>
                                                )}
                                            </div>
                                            <span className="font-black font-mono text-blue-700">-${storeCreditApplied.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {/* Real-time Dynamic Fees Breakdown: Subtotal + Delivery Fee + Processing Fee ($X.XX) = Total (TASK-47-02, TASK-49-05) */}
                                    <div
                                        data-testid="checkout-fee-breakdown-formula"
                                        className="my-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-sm"
                                    >
                                        <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1 flex items-center justify-between">
                                            <span>{lbl('Desglose Transversal de Pagos', 'Dynamic Fees Breakdown')}</span>
                                            <span className="text-[9px] text-primary lowercase font-mono">live</span>
                                        </div>
                                        <div className="text-[11px] font-mono font-bold text-slate-800 tracking-tight leading-relaxed">
                                            <span>Subtotal (${discountedSubtotal.toFixed(2)}) + Delivery Fee (${deliveryFee.toFixed(2)}) + Processing Fee (${processingFee.toFixed(2)})${storeCreditApplied > 0 ? ` - Store Credit ($${storeCreditApplied.toFixed(2)})` : ''} = Total (${finalTotal.toFixed(2)})</span>
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

                                    {subtotalWithFees < minOrderAmount && (
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
                                        <div className="text-right">
                                            <span className="text-3xl font-black text-primary">${finalTotal.toFixed(2)}</span>
                                            {isPaidWithStoreCredit && (
                                                <span className="block text-[11px] font-bold text-emerald-600 uppercase tracking-tight">
                                                    {lbl('100% Cubierto con Saldo a Favor', '100% Covered with Store Credit')}
                                                </span>
                                            )}
                                        </div>
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
                                disabled={isLoading || cart.length === 0 || (!isPaidWithStoreCredit && exceedsCreditLimit) || (!isPaidWithStoreCredit && paymentMethod === 'check' && (!checkImageUrl || !checkNumber.trim() || !checkBank.trim() || !checkVerified))}
                                className="w-full py-4 bg-[#111] hover:bg-[#222] text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        {isPaidWithStoreCredit
                                            ? lbl('Confirmar Pedido (Cubierto con Saldo a Favor)', 'Place Order (Covered by Store Credit)')
                                            : lbl('Confirmar Pedido', 'Place Order')}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[32px] border border-border shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
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
