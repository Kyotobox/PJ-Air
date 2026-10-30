'use client';

import React, { useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    MapPin, ChevronRight, Loader2, Map as MapIcon, RotateCcw,
    Moon, Key, Camera, ChevronDown, ChevronUp, Upload, Trash2,
    Snowflake, ShieldCheck, AlertCircle, Info, Image as ImageIcon
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { GOOGLE_MAPS_KEY, API_URL } from '@/lib/config';

const libraries: ('places')[] = ['places'];

const mapContainerStyle = {
    width: '100%',
    height: '400px',
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

function NewAddressContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect');
    const { user, isLoading: isAuthLoading } = useAuth();
    const { locale } = useLanguage();

    const [isLoading, setIsLoading] = useState(false);
    const [address, setAddress] = useState('');
    const [alias, setAlias] = useState('');
    const [notes, setNotes] = useState('');
    const [markerPos, setMarkerPos] = useState(centerNY);
    const [geocodedPos, setGeocodedPos] = useState<{lat: number, lng: number} | null>(null);
    const [refinedPos, setRefinedPos] = useState<{lat: number, lng: number} | null>(null);
    const [isManualAdjustment, setIsManualAdjustment] = useState(false);
    const [error, setError] = useState('');

    // ── Early Morning Delivery Instructions (Sprint S51) ──────────────────────
    const [showEarlyMorning, setShowEarlyMorning] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [keyLocation, setKeyLocation] = useState('');
    const [fridgeAccessRequired, setFridgeAccessRequired] = useState(false);
    const [photos, setPhotos] = useState<string[]>([]);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const fileInputRef0 = useRef<HTMLInputElement>(null);
    const fileInputRef1 = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_KEY || '',
        libraries,
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    const onAutocompleteLoad = useCallback((auto: google.maps.places.Autocomplete) => {
        setAutocomplete(auto);
    }, []);

    const onPlaceChanged = useCallback(() => {
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

    const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setMarkerPos(newPos);
            setRefinedPos(newPos);
            setIsManualAdjustment(true);
            reverseGeocode(newPos);
        }
    }, []);

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
        setIsLoading(true);
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address }, (results, status) => {
            setIsLoading(false);
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
            } else {
                setError(locale === 'en'
                    ? 'Could not find location on map. Please try a more specific address.'
                    : 'No se pudo encontrar la ubicación en el mapa. Por favor, intenta con una dirección más específica.');
            }
        });
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingPhoto(true);
        setError('');

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
            setError(err.message || (locale === 'en' ? 'Error uploading photo' : 'Error al subir la fotografía'));
        } finally {
            setIsUploadingPhoto(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleRemovePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (!user) {
                if (!isAuthLoading) {
                    router.push('/auth/login');
                } else {
                    setError(locale === 'en' ? 'Waiting for authentication...' : 'Esperando autenticación...');
                }
                return;
            }

            await api.post('/addresses', {
                userId: user.id,
                alias: alias.trim() || (locale === 'en' ? 'Main Address' : 'Dirección Principal'),
                address,
                notes,
                lat: geocodedPos?.lat || markerPos.lat,
                lng: geocodedPos?.lng || markerPos.lng,
                refined_lat: isManualAdjustment ? refinedPos?.lat : null,
                refined_lng: isManualAdjustment ? refinedPos?.lng : null,
                access_code: accessCode.trim() || null,
                has_key: hasKey,
                key_location: hasKey ? keyLocation.trim() || null : null,
                fridge_access_required: fridgeAccessRequired,
                delivery_photos_json: photos.length > 0 ? JSON.stringify(photos) : null,
            });

            router.push(redirect || '/');
        } catch (err: any) {
            setError(err.message || (locale === 'en' ? 'Error saving address' : 'Error al guardar la dirección'));
        } finally {
            setIsLoading(false);
        }
    };

    const onLoad = useCallback((map: google.maps.Map) => { setMap(map); }, []);
    const onUnmount = useCallback(() => { setMap(null); }, []);

    // ── i18n strings ──────────────────────────────────────────────────────────
    const s = locale === 'en' ? {
        title: 'Add your address',
        subtitle: 'Place the marker at the exact delivery point and add early morning access details',
        aliasLabel: 'Name / Business Alias',
        aliasPlaceholder: 'e.g. Downtown Cafe, Main Bakery, Branch #2',
        addressLabel: 'Full Address',
        addressPlaceholder: 'Street, Building, Suite, City, Zip Code...',
        locateBtn: 'Locate',
        notesLabel: 'Additional Notes (Optional)',
        notesPlaceholder: 'e.g. Unload at back alley, ring side doorbell...',
        mapLabel: 'Fine-tune location on map',
        centerBtn: 'Center on NY',
        markerHint: 'Drag the red marker to pin your exact position',
        saveBtn: 'Confirm & Save Address',
        skipBtn: 'Skip this step (Go to catalog)',
        // S51
        earlyTitle: 'Early Morning Delivery Instructions (4:00 AM - 7:00 AM)',
        earlySubtitle: 'Crucial for silent overnight deliveries before store opening',
        earlyBadge: 'B2B Logistics',
        codeLabel: 'Access / Keypad Code (Door, Gate, Alarm, Elevator)',
        codePlaceholder: 'e.g. Door #4589, Alarm 1234, Gate *98',
        hasKeyLabel: 'Key or Physical Token Required for Access',
        keyLocLabel: 'Key Location / Where is it stored or collected?',
        keyLocPlaceholder: 'e.g. 24h bodega across the street, Lockbox code 5544 next to back door',
        fridgeLabel: 'Direct Refrigerator Access Required',
        fridgeNotice: 'Driver will place temperature-sensitive wholesale orders directly inside your walk-in / reach-in coolers. Please keep space clear.',
        photosTitle: 'Access & Delivery Photos (Up to 3 Photos)',
        photosSubtitle: 'Clear photos of facade/door, unloading point, and refrigeration units drastically reduce delivery friction.',
        slot1: '1. Facade & Entrance Door',
        slot2: '2. Drop-off Spot / Route',
        slot3: '3. Coolers / Storage Unit',
        uploadBtn: 'Upload Photo',
        replaceBtn: 'Replace',
        removeBtn: 'Remove',
    } : {
        title: 'Agrega tu dirección',
        subtitle: 'Sitúa el marcador en el punto exacto de entrega e ingresa instrucciones de madrugada',
        aliasLabel: 'Nombre / Alias del Negocio',
        aliasPlaceholder: 'Ej: Cafetería Central, Sucursal 2, Restaurante',
        addressLabel: 'Dirección Completa',
        addressPlaceholder: 'Calle, Av, Edificio, Número, Ciudad, Código Postal...',
        locateBtn: 'Ubicar',
        notesLabel: 'Notas Adicionales (Opcional)',
        notesPlaceholder: 'Ej: Descargar por callejón trasero, timbre lateral...',
        mapLabel: 'Refinar ubicación en el mapa',
        centerBtn: 'Centrar en NY',
        markerHint: 'Arrastra el marcador rojo para fijar tu posición exacta',
        saveBtn: 'Confirmar y Guardar Dirección',
        skipBtn: 'Saltar este paso por ahora (Ir al catálogo)',
        // S51
        earlyTitle: 'Instrucciones de Despacho en Madrugada (4:00 AM - 7:00 AM)',
        earlySubtitle: 'Indispensable para entregas silenciosas antes de la apertura de tu negocio',
        earlyBadge: 'Logística B2B',
        codeLabel: 'Código de Acceso / Teclado (Alarma, Portón, Puerta, Elevador)',
        codePlaceholder: 'Ej: Puerta #4589, Alarma 1234, Portón *98',
        hasKeyLabel: 'Se requiere llave física o tarjeta para ingresar',
        keyLocLabel: 'Ubicación de la Llave (¿Dónde se retira o resguarda?)',
        keyLocPlaceholder: 'Ej: Bodega 24h del frente, Lockbox código 5544 junto a puerta trasera',
        fridgeLabel: 'Requiere acceso directo a Neveras / Refrigeración',
        fridgeNotice: 'El despachador ubicará los productos frescos dentro de tus cámaras/neveras. Asegúrate de dejar espacio libre.',
        photosTitle: 'Fotografías de Acceso (Hasta 3 Fotos)',
        photosSubtitle: 'Fotos claras de fachada, punto de descarga y neveras garantizan entregas puntuales y seguras sin interrupciones.',
        slot1: '1. Fachada y Puerta de Acceso',
        slot2: '2. Punto de Descarga / Pasillo',
        slot3: '3. Neveras / Refrigeración',
        uploadBtn: 'Subir Foto',
        replaceBtn: 'Cambiar',
        removeBtn: 'Eliminar',
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa] pb-20">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-12 animate-fade-in text-foreground">
                <div className="bg-card rounded-[40px] border border-border shadow-premium overflow-hidden">
                    {/* Header */}
                    <div className="jhoanes-gradient p-10 sm:p-12 text-white">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-3 backdrop-blur-sm">
                            <Moon size={12} /> {s.earlyBadge}
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black font-serif mb-2 tracking-tighter">{s.title}</h1>
                        <p className="text-white/80 font-medium text-sm sm:text-base">{s.subtitle}</p>
                    </div>

                    <form onSubmit={handleSave} className="p-8 sm:p-12 space-y-10">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-fade-in text-center flex items-center justify-center gap-2">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Alias */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{s.aliasLabel}</label>
                            <input
                                type="text"
                                placeholder={s.aliasPlaceholder}
                                className="premium-input px-6 py-4 font-bold"
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                            />
                        </div>

                        {/* Full address */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{s.addressLabel}</label>
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
                                            placeholder={s.addressPlaceholder}
                                            className="premium-input px-6 py-4 font-bold pr-32 w-full"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
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
                                        placeholder={s.addressPlaceholder}
                                        className="premium-input px-6 py-4 font-bold pr-32 w-full"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={forwardGeocode}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2"
                                >
                                    <MapPin size={12} /> {s.locateBtn}
                                </button>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{s.notesLabel}</label>
                            <input
                                type="text"
                                placeholder={s.notesPlaceholder}
                                className="premium-input px-6 py-4 font-bold"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        {/* ── Collapsible: Early Morning Delivery Instructions ───────── */}
                        <div className="rounded-3xl border-2 border-primary/20 bg-primary/[0.02] overflow-hidden transition-all">
                            <button
                                type="button"
                                onClick={() => setShowEarlyMorning(v => !v)}
                                className="w-full p-6 sm:p-7 flex items-center justify-between text-left hover:bg-primary/[0.04] transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
                                        <Moon size={22} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-black text-base sm:text-lg text-foreground tracking-tight">
                                                {s.earlyTitle}
                                            </h3>
                                            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                {s.earlyBadge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                            {s.earlySubtitle}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white border border-border/80 flex items-center justify-center text-primary shadow-xs ml-2 shrink-0">
                                    {showEarlyMorning ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </button>

                            {showEarlyMorning && (
                                <div className="p-6 sm:p-8 pt-2 border-t border-primary/10 space-y-7 animate-fade-in">
                                    {/* Access Code */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-primary" /> {s.codeLabel}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={s.codePlaceholder}
                                            value={accessCode}
                                            onChange={(e) => setAccessCode(e.target.value)}
                                            className="premium-input px-5 py-3.5 font-bold"
                                        />
                                    </div>

                                    {/* Key required & Location */}
                                    <div className="p-5 rounded-2xl bg-white border border-border/70 space-y-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={hasKey}
                                                onChange={(e) => setHasKey(e.target.checked)}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                                            />
                                            <span className="font-bold text-sm text-foreground flex items-center gap-2">
                                                <Key size={16} className="text-primary" /> {s.hasKeyLabel}
                                            </span>
                                        </label>

                                        {hasKey && (
                                            <div className="pt-2 pl-8 space-y-2 animate-fade-in">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                                    {s.keyLocLabel}
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder={s.keyLocPlaceholder}
                                                    value={keyLocation}
                                                    onChange={(e) => setKeyLocation(e.target.value)}
                                                    className="premium-input px-4 py-3 text-sm font-medium"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Fridge Access Required */}
                                    <div className="p-5 rounded-2xl bg-white border border-border/70 space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={fridgeAccessRequired}
                                                onChange={(e) => setFridgeAccessRequired(e.target.checked)}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                                            />
                                            <span className="font-bold text-sm text-foreground flex items-center gap-2">
                                                <Snowflake size={16} className="text-primary" /> {s.fridgeLabel}
                                            </span>
                                        </label>
                                        <div className="flex items-start gap-2 pt-1 pl-8 text-xs text-muted-foreground">
                                            <Info size={14} className="text-primary shrink-0 mt-0.5" />
                                            <span>{s.fridgeNotice}</span>
                                        </div>
                                    </div>

                                    {/* ── Photo Uploads (Up to 3 photos) ───────────────────── */}
                                    <div className="space-y-4 pt-2">
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                                    <Camera size={16} className="text-primary" /> {s.photosTitle}
                                                </label>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                    {photos.length}/3
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {s.photosSubtitle}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {/* Slot 1: Facade/Door */}
                                            <div className="p-4 rounded-2xl bg-white border border-border/80 flex flex-col items-center justify-between min-h-[170px] text-center relative group">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                                                    {s.slot1}
                                                </span>
                                                {photos[0] ? (
                                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/60 bg-muted">
                                                        <img
                                                            src={photos[0].startsWith('http') || photos[0].startsWith('data:') ? photos[0] : `${API_URL}${photos[0]}`}
                                                            alt="Slot 1"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePhoto(0)}
                                                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow hover:bg-red-700 transition-colors"
                                                            title={s.removeBtn}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef0.current?.click()}
                                                        className="w-full py-6 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
                                                    >
                                                        <Upload size={18} />
                                                        <span className="text-[10px] font-black uppercase tracking-wider">{s.uploadBtn}</span>
                                                    </button>
                                                )}
                                                <input
                                                    ref={fileInputRef0}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handlePhotoUpload(e, 0)}
                                                />
                                            </div>

                                            {/* Slot 2: Drop-off spot */}
                                            <div className="p-4 rounded-2xl bg-white border border-border/80 flex flex-col items-center justify-between min-h-[170px] text-center relative group">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                                                    {s.slot2}
                                                </span>
                                                {photos[1] ? (
                                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/60 bg-muted">
                                                        <img
                                                            src={photos[1].startsWith('http') || photos[1].startsWith('data:') ? photos[1] : `${API_URL}${photos[1]}`}
                                                            alt="Slot 2"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePhoto(1)}
                                                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow hover:bg-red-700 transition-colors"
                                                            title={s.removeBtn}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef1.current?.click()}
                                                        className="w-full py-6 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
                                                    >
                                                        <Upload size={18} />
                                                        <span className="text-[10px] font-black uppercase tracking-wider">{s.uploadBtn}</span>
                                                    </button>
                                                )}
                                                <input
                                                    ref={fileInputRef1}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handlePhotoUpload(e, 1)}
                                                />
                                            </div>

                                            {/* Slot 3: Coolers */}
                                            <div className="p-4 rounded-2xl bg-white border border-border/80 flex flex-col items-center justify-between min-h-[170px] text-center relative group">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                                                    {s.slot3}
                                                </span>
                                                {photos[2] ? (
                                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/60 bg-muted">
                                                        <img
                                                            src={photos[2].startsWith('http') || photos[2].startsWith('data:') ? photos[2] : `${API_URL}${photos[2]}`}
                                                            alt="Slot 3"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePhoto(2)}
                                                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow hover:bg-red-700 transition-colors"
                                                            title={s.removeBtn}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef2.current?.click()}
                                                        className="w-full py-6 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
                                                    >
                                                        <Upload size={18} />
                                                        <span className="text-[10px] font-black uppercase tracking-wider">{s.uploadBtn}</span>
                                                    </button>
                                                )}
                                                <input
                                                    ref={fileInputRef2}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handlePhotoUpload(e, 2)}
                                                />
                                            </div>
                                        </div>

                                        {isUploadingPhoto && (
                                            <div className="flex items-center justify-center gap-2 text-xs text-primary font-bold animate-pulse pt-2">
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>{locale === 'en' ? 'Uploading photo...' : 'Subiendo fotografía...'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Map */}
                        <div className="space-y-4 pt-6 border-t border-border/40">
                            <div className="flex items-center justify-between px-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                    <MapIcon size={14} /> {s.mapLabel}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMarkerPos(centerNY);
                                        map?.panTo(centerNY);
                                        reverseGeocode(centerNY);
                                    }}
                                    className="text-[10px] font-black uppercase text-primary hover:underline flex items-center gap-1"
                                >
                                    <RotateCcw size={12} /> {s.centerBtn}
                                </button>
                            </div>

                            <div className="relative group">
                                {isLoaded ? (
                                    <GoogleMap
                                        mapContainerStyle={mapContainerStyle}
                                        center={markerPos}
                                        zoom={14}
                                        options={mapOptions}
                                        onClick={onMapClick}
                                        onLoad={onLoad}
                                        onUnmount={onUnmount}
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
                                            animation={typeof google !== 'undefined' ? google.maps.Animation.DROP : undefined}
                                        />
                                    </GoogleMap>
                                ) : (
                                    <div style={mapContainerStyle} className="bg-muted animate-pulse flex items-center justify-center">
                                        <Loader2 className="animate-spin text-primary" size={40} />
                                    </div>
                                )}
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none w-full px-10">
                                    <div className="bg-foreground/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white text-center">
                                        {s.markerHint}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-4 pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full premium-button jhoanes-gradient text-white py-5 shadow-2xl"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={24} /> : (
                                    <>{s.saveBtn} <ChevronRight size={20} /></>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors bg-muted/30 rounded-[28px] border border-transparent hover:border-primary/10"
                            >
                                {s.skipBtn}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default function NewAddressPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        }>
            <NewAddressContent />
        </Suspense>
    );
}
