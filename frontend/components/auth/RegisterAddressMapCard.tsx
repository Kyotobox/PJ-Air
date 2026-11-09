'use client';

import React, { useEffect, useState } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

const DEFAULT_CENTER = { lat: 40.7628, lng: -73.9262 }; // NYC (Astoria)

const mapContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '220px',
    borderRadius: '16px',
};

const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    ],
};

export interface RegisterAddressMapCardProps {
    lat?: number | null;
    lng?: number | null;
    formattedAddress?: string;
    isLoaded: boolean;
    locale?: string;
}

export const RegisterAddressMapCard: React.FC<RegisterAddressMapCardProps> = ({
    lat,
    lng,
    formattedAddress,
    isLoaded,
    locale = 'es',
}) => {
    const [map, setMap] = useState<google.maps.Map | null>(null);

    const hasValidCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);

    const center = hasValidCoords ? { lat, lng } : DEFAULT_CENTER;
    const zoom = hasValidCoords ? 16 : 11;

    useEffect(() => {
        if (map && hasValidCoords) {
            map.panTo({ lat, lng });
            map.setZoom(16);
        }
    }, [map, lat, lng, hasValidCoords]);

    return (
        <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                    <Navigation size={13} className="text-primary" />
                    <span>{locale === 'en' ? 'Location Preview' : 'Ubicación Satelital'}</span>
                </span>
                {hasValidCoords && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/60">
                        {lat.toFixed(4)}, {lng.toFixed(4)}
                    </span>
                )}
            </div>

            {/* Map Container (~220px) */}
            <div className="relative w-full h-[220px] rounded-2xl overflow-hidden border border-border/70 shadow-inner bg-slate-100">
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={center}
                        zoom={zoom}
                        options={mapOptions}
                        onLoad={(mapInstance) => setMap(mapInstance)}
                    >
                        {hasValidCoords && (
                            <Marker position={{ lat, lng }} />
                        )}
                    </GoogleMap>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/40">
                        <Loader2 className="animate-spin text-primary" size={24} />
                        <span className="text-xs font-medium">
                            {locale === 'en' ? 'Loading map...' : 'Cargando mapa...'}
                        </span>
                    </div>
                )}
            </div>

            {/* Status Footer */}
            {hasValidCoords ? (
                <div className="space-y-1.5 pt-1 animate-fade-in">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-black tracking-tight">
                        <span>🟢 Dirección Verificada por Google Maps</span>
                    </div>
                    {formattedAddress && (
                        <p className="text-[11px] font-medium text-foreground/80 line-clamp-2 px-1 leading-snug">
                            {formattedAddress}
                        </p>
                    )}
                </div>
            ) : (
                <div className="p-3 bg-white/70 border border-dashed border-border/80 rounded-xl flex items-center gap-2.5 text-muted-foreground animate-fade-in">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <MapPin size={16} />
                    </div>
                    <div className="text-[11px] leading-snug">
                        <span className="font-bold text-foreground block">
                            {locale === 'en' ? 'Commercial address pending' : 'Dirección comercial pendiente'}
                        </span>
                        <span className="text-muted-foreground">
                            {locale === 'en'
                                ? 'Search your store name or street in the address field to verify and pinpoint on the map.'
                                : 'Escribe el nombre o calle de tu negocio en la dirección para ubicarlo con precisión en el mapa.'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
