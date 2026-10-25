'use client';

import React, { useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, ChevronRight, Loader2, Map as MapIcon, RotateCcw } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { GOOGLE_MAPS_KEY } from '@/lib/config';



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

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_KEY || ''
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);

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
        subtitle: 'Place the marker at the exact delivery point',
        aliasLabel: 'Name (Alias)',
        aliasPlaceholder: 'e.g. Home, Office',
        zoneLabel: 'Delivery Zone',
        zonePlaceholder: 'Select a zone',
        addressLabel: 'Full Address',
        addressPlaceholder: 'Street, Building, House number...',
        locateBtn: 'Locate',
        notesLabel: 'Additional Notes (Optional)',
        notesPlaceholder: 'e.g. Green gate, call on arrival...',
        mapLabel: 'Fine-tune location on map',
        centerBtn: 'Center on NY',
        markerHint: 'Drag the red marker to pin your exact position',
        saveBtn: 'Confirm & Save Address',
        skipBtn: 'Skip this step (Go to catalog)',
    } : {
        title: 'Agrega tu dirección',
        subtitle: 'Sitúa el marcador en el punto exacto de entrega',
        aliasLabel: 'Nombre (Alias)',
        aliasPlaceholder: 'Ej: Mi Casa, Oficina',
        zoneLabel: 'Zona de Entrega',
        zonePlaceholder: 'Selecciona una zona',
        addressLabel: 'Dirección Completa',
        addressPlaceholder: 'Calle, Av, Edificio, Número de casa...',
        locateBtn: 'Ubicar',
        notesLabel: 'Notas Adicionales (Opcional)',
        notesPlaceholder: 'Ej: Portón verde, llamar al llegar...',
        mapLabel: 'Refinar ubicación en el mapa',
        centerBtn: 'Centrar en NY',
        markerHint: 'Arrastra el marcador rojo para fijar tu posición exacta',
        saveBtn: 'Confirmar y Guardar Dirección',
        skipBtn: 'Saltar este paso por ahora (Ir al catálogo)',
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa] pb-20">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-12 animate-fade-in text-foreground">
                <div className="bg-card rounded-[40px] border border-border shadow-premium overflow-hidden">
                    {/* Header */}
                    <div className="jhoanes-gradient p-12 text-white">
                        <h1 className="text-4xl font-black font-serif mb-2 tracking-tighter">{s.title}</h1>
                        <p className="text-white/80 font-medium">{s.subtitle}</p>
                    </div>

                    <form onSubmit={handleSave} className="p-12 space-y-10">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-fade-in text-center">
                                {error}
                            </div>
                        )}

                        {/* Full address */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{s.addressLabel}</label>
                            <div className="relative group">
                                <textarea
                                    required
                                    rows={3}
                                    placeholder={s.addressPlaceholder}
                                    className="premium-input px-6 py-4 font-bold pr-32"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    onBlur={() => { if (address.length > 5) forwardGeocode(); }}
                                />
                                <button
                                    type="button"
                                    onClick={forwardGeocode}
                                    className="absolute right-4 bottom-4 px-4 py-2 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2"
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
