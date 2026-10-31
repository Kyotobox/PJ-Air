'use client';

import React, { useState } from 'react';
import { 
    KeyRound, Lock, Refrigerator, Building2, Eye, EyeOff, 
    Navigation, ExternalLink, Image as ImageIcon, AlertCircle 
} from 'lucide-react';
import { GOOGLE_MAPS_KEY } from '@/lib/config';
import { API_URL } from '@/lib/config';

export interface DeliveryAddressData {
    address: string;
    city: string;
    state?: string;
    lat?: number;
    lng?: number;
    refined_lat?: number;
    refined_lng?: number;
    access_code?: string;
    has_key?: boolean;
    key_location?: string;
    fridge_access_required?: boolean;
    delivery_photos_json?: string;
}

interface StreetViewFacadeCardProps {
    address?: DeliveryAddressData;
    autoLoad?: boolean;
    title?: string;
}

export default function StreetViewFacadeCard({
    address,
    autoLoad = false,
    title = 'Guía Visual de Acceso Nocturno (3:00 AM)'
}: StreetViewFacadeCardProps) {
    const [showStreetView, setShowStreetView] = useState<boolean>(autoLoad);
    const [imageError, setImageError] = useState<boolean>(false);

    if (!address) return null;

    const lat = address.refined_lat || address.lat;
    const lng = address.refined_lng || address.lng;

    const locationQuery = (lat && lng)
        ? `${lat},${lng}`
        : `${address.address}, ${address.city || ''}, ${address.state || 'NY'}`;

    const streetViewUrl = GOOGLE_MAPS_KEY
        ? `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodeURIComponent(locationQuery)}&fov=90&heading=235&pitch=5&key=${GOOGLE_MAPS_KEY}`
        : '';

    const navigationUrl = `https://www.google.com/maps/dir/?api=1&origin=3304+Broadway,+Astoria,+NY+11106&destination=${encodeURIComponent(locationQuery)}`;

    let clientPhotos: string[] = [];
    if (address.delivery_photos_json) {
        try {
            const parsed = JSON.parse(address.delivery_photos_json);
            if (Array.isArray(parsed)) clientPhotos = parsed;
        } catch (_) {}
    }

    return (
        <div className="bg-slate-900 text-white rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
            {/* Header */}
            <div className="p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Building2 size={18} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">{title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold truncate max-w-[220px]">
                            {address.address}, {address.city}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowStreetView(!showStreetView)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                    >
                        {showStreetView ? <EyeOff size={13} /> : <Eye size={13} />}
                        {showStreetView ? 'Ocultar' : 'Street View'}
                    </button>
                    <a
                        href={navigationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-xl bg-primary hover:bg-primary/80 text-white transition-all shadow-md"
                        title="Navegar desde Astoria Hub"
                    >
                        <Navigation size={15} />
                    </a>
                </div>
            </div>

            {/* Street View Visual Area (Lazy loaded) */}
            {showStreetView && (
                <div className="relative w-full h-48 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
                    {!imageError && streetViewUrl ? (
                        <img
                            src={streetViewUrl}
                            alt="Fachada a nivel de calle"
                            className="w-full h-full object-cover"
                            onError={() => setImageError(true)}
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
                            <Building2 size={32} className="opacity-40" />
                            <p className="text-xs font-bold">Vista previa Street View no disponible</p>
                            <p className="text-[10px] text-slate-600">Utilice el botón de navegación GPS directo</p>
                        </div>
                    )}
                    <div className="absolute bottom-2 left-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Persiana / Fachada Comercial
                    </div>
                </div>
            )}

            {/* Night Access Credentials Block (3:00 AM) */}
            <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Clave de Acceso */}
                    <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800/80 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                            <KeyRound size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                Código de Acceso
                            </span>
                            <span className="text-sm font-black font-mono tracking-wider text-emerald-400 select-all block truncate mt-0.5">
                                {address.access_code ? address.access_code : 'Sin código requerido'}
                            </span>
                        </div>
                    </div>

                    {/* Candado / Lockbox */}
                    <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800/80 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                            <Lock size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                Candado / Lockbox
                            </span>
                            <span className="text-xs font-bold text-slate-200 block truncate mt-0.5">
                                {address.has_key
                                    ? address.key_location || 'Posee llave (consultar encargado)'
                                    : 'Sin llave física'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Badges: Nevera / Refrigerador */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    {address.fridge_access_required ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                            <Refrigerator size={14} className="text-cyan-400 animate-pulse" />
                            Acceso Obligatorio a Nevera / Cámara de Frío
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-800 text-slate-400 text-[10px] font-bold">
                            <Refrigerator size={14} />
                            Entrega en Mostrador / Área Seca
                        </div>
                    )}
                </div>

                {/* Fotos registradas por el cliente */}
                {clientPhotos.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/60">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                            <ImageIcon size={12} /> Fotos de Acceso del Local ({clientPhotos.length})
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {clientPhotos.map((photoUrl, idx) => (
                                <a
                                    key={idx}
                                    href={photoUrl.startsWith('http') ? photoUrl : `${API_URL}${photoUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 shrink-0 hover:border-amber-400 transition-all relative group"
                                >
                                    <img
                                        src={photoUrl.startsWith('http') ? photoUrl : `${API_URL}${photoUrl}`}
                                        alt={`Foto de acceso ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
