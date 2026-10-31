'use client';

import React, { useState, useEffect } from 'react';
import { 
    Truck, MapPin, Navigation, Compass, Clock, DollarSign, 
    CheckCircle2, AlertTriangle, ExternalLink, ShieldCheck, 
    ArrowRight, Building2, Eye, EyeOff
} from 'lucide-react';
import { api } from '@/lib/api';
import { GOOGLE_MAPS_KEY } from '@/lib/config';

export interface DispatchOrderData {
    id: string;
    delivery_type?: string;
    delivery_date?: string;
    delivery_fee_charged?: number;
    delivery_address_text?: string;
    notes?: string;
    address?: {
        address: string;
        city?: string;
        zone?: string;
        state?: string;
        lat?: number;
        lng?: number;
        refined_lat?: number;
        refined_lng?: number;
        access_code?: string;
        has_key?: boolean;
        key_location?: string;
        fridge_access_required?: boolean;
    };
}

const ASTORIA_ORIGIN = {
    address: '3304 Broadway, Astoria, NY 11106',
    lat: 40.761032,
    lng: -73.923714,
};

function calculateLocalDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const miles = R * c * 1.25; // 1.25x road factor
    return Math.round(miles * 10) / 10;
}

function calculateSuggestedFreight(miles: number, isPickup: boolean): { cost: number; special: boolean } {
    if (isPickup) return { cost: 0, special: false };
    if (miles > 250) return { cost: 0, special: true };
    if (miles <= 10) return { cost: 40, special: false };
    if (miles <= 20) return { cost: 60, special: false };
    if (miles <= 30) return { cost: 80, special: false };
    if (miles <= 40) return { cost: 100, special: false };
    if (miles <= 50) return { cost: 125, special: false };
    const extra = Math.ceil((miles - 50) / 10);
    return { cost: 125 + extra * 25, special: false };
}

export default function AdminOrderDispatchSheet({ order }: { order: DispatchOrderData }) {
    const isPickup = order.delivery_type === 'pickup';
    const rawDestAddress = order.address?.address || order.delivery_address_text || '';
    const destCity = order.address?.city || '';
    const destState = order.address?.state || 'NY';
    const destLat = order.address?.refined_lat || order.address?.lat;
    const destLng = order.address?.refined_lng || order.address?.lng;

    const [miles, setMiles] = useState<number>(0);
    const [suggestedFee, setSuggestedFee] = useState<number>(40);
    const [requiresSpecialQuote, setRequiresSpecialQuote] = useState<boolean>(false);
    const [loadingQuote, setLoadingQuote] = useState<boolean>(false);
    const [showStreetView, setShowStreetView] = useState<boolean>(false);

    useEffect(() => {
        let isMounted = true;

        async function resolveQuote() {
            if (isPickup) {
                setMiles(0);
                setSuggestedFee(0);
                setRequiresSpecialQuote(false);
                return;
            }

            // Si tenemos coordenadas, cálculo instantáneo local
            if (typeof destLat === 'number' && typeof destLng === 'number') {
                const computedMiles = calculateLocalDistanceMiles(
                    ASTORIA_ORIGIN.lat,
                    ASTORIA_ORIGIN.lng,
                    destLat,
                    destLng,
                );
                const { cost, special } = calculateSuggestedFreight(computedMiles, false);
                if (isMounted) {
                    setMiles(computedMiles);
                    setSuggestedFee(cost);
                    setRequiresSpecialQuote(special);
                }
            }

            // Consultar endpoint /logistics/quote para confirmación oficial del backend
            try {
                setLoadingQuote(true);
                const payload: any = { serviceType: 'shared' };
                if (typeof destLat === 'number' && typeof destLng === 'number') {
                    payload.destLat = destLat;
                    payload.destLng = destLng;
                } else if (rawDestAddress) {
                    payload.address = `${rawDestAddress}, ${destCity}, ${destState}`;
                }

                if (payload.destLat || payload.address) {
                    const quote = await api.post('/logistics/quote', payload) as any;
                    if (isMounted && quote) {
                        if (typeof quote.miles === 'number') setMiles(quote.miles);
                        if (typeof quote.cost === 'number') setSuggestedFee(quote.cost);
                        if (typeof quote.requiresSpecialQuote === 'boolean') {
                            setRequiresSpecialQuote(quote.requiresSpecialQuote);
                        }
                    }
                }
            } catch (_) {
                // Mantener cálculo local si backend no responde
            } finally {
                if (isMounted) setLoadingQuote(false);
            }
        }

        resolveQuote();

        return () => {
            isMounted = false;
        };
    }, [isPickup, destLat, destLng, rawDestAddress, destCity, destState]);

    const chargedFee = Number(order.delivery_fee_charged || 0);
    const feeDifference = chargedFee - suggestedFee;

    const destQuery = (destLat && destLng)
        ? `${destLat},${destLng}`
        : `${rawDestAddress}, ${destCity}, ${destState}`;

    const googleMapsRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=3304+Broadway,+Astoria,+NY+11106&destination=${encodeURIComponent(destQuery)}`;

    const streetViewUrl = GOOGLE_MAPS_KEY && destQuery
        ? `https://maps.googleapis.com/maps/api/streetview?size=600x260&location=${encodeURIComponent(destQuery)}&fov=90&heading=235&pitch=5&key=${GOOGLE_MAPS_KEY}`
        : '';

    // Estimación de tiempo van en minutos (tráfico metropolitano ~ 20-25 mph + 10 min de puente/maniobra)
    const estimatedMinutes = isPickup ? 0 : Math.max(15, Math.round(miles * 2.4 + 10));

    return (
        <section className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                        <Truck size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-tight">Ficha de Despacho Logístico</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Origen Central: Astoria Hub (3304 Broadway, NY 11106)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {rawDestAddress && !isPickup && (
                        <button
                            type="button"
                            onClick={() => setShowStreetView(!showStreetView)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                            {showStreetView ? <EyeOff size={13} /> : <Eye size={13} />}
                            {showStreetView ? 'Ocultar Fachada' : 'Ver Fachada'}
                        </button>
                    )}
                    <a
                        href={googleMapsRouteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        <Navigation size={13} className="text-amber-400" />
                        Trazar Ruta en Google Maps
                    </a>
                </div>
            </div>

            {/* Street View preview collapsible */}
            {showStreetView && streetViewUrl && (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
                    <img
                        src={streetViewUrl}
                        alt="Fachada del destino"
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                    <div className="absolute bottom-2 left-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-black text-amber-400 uppercase tracking-widest">
                        Fachada Comercial de Entrega (Street View)
                    </div>
                </div>
            )}

            {/* Hub To Destination Specs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Millaje */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-primary shadow-sm shrink-0">
                        <Compass size={18} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Distancia desde Astoria
                        </span>
                        <span className="text-lg font-black text-slate-800">
                            {isPickup ? '0 mi (Retiro)' : `${miles.toFixed(1)} mi`}
                        </span>
                    </div>
                </div>

                {/* Tiempo Estimado */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-primary shadow-sm shrink-0">
                        <Clock size={18} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Tiempo de Tránsito Van
                        </span>
                        <span className="text-lg font-black text-slate-800">
                            {isPickup ? 'Inmediato' : `~${estimatedMinutes} min`}
                        </span>
                    </div>
                </div>

                {/* Tarifa Sugerida Matriz */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                        <DollarSign size={18} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Tarifa Matriz Oficial
                        </span>
                        <span className="text-lg font-black text-slate-800">
                            {requiresSpecialQuote ? 'Cotización Especial' : `$${suggestedFee.toFixed(2)}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Freight Reconciliation Bar */}
            <div className="p-5 rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                        Conciliación de Flete
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-700">
                            Cobrado: <strong className="font-black text-slate-900">${chargedFee.toFixed(2)}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-sm font-bold text-slate-700">
                            Sugerido: <strong className="font-black text-slate-900">${suggestedFee.toFixed(2)}</strong>
                        </span>
                    </div>
                </div>

                <div>
                    {isPickup ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider">
                            <CheckCircle2 size={13} className="text-slate-500" /> Retiro en Tienda ($0)
                        </span>
                    ) : requiresSpecialQuote ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-[10px] uppercase tracking-wider">
                            <AlertTriangle size={13} className="text-purple-600" /> Ruta &gt; 250 Millas (Cotización Especial)
                        </span>
                    ) : Math.abs(feeDifference) < 0.01 ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-[10px] uppercase tracking-wider shadow-sm">
                            <CheckCircle2 size={14} className="text-emerald-600" /> Tarifa Exacta Matriz
                        </span>
                    ) : feeDifference > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-black text-[10px] uppercase tracking-wider">
                            <ShieldCheck size={14} className="text-amber-600" /> Superávit de Flete (+${feeDifference.toFixed(2)})
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-black text-[10px] uppercase tracking-wider">
                            <AlertTriangle size={14} className="text-red-600" /> Diferencia de Flete (-${Math.abs(feeDifference).toFixed(2)})
                        </span>
                    )}
                </div>
            </div>

            {/* Destino y Credenciales de Entrega */}
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-primary shrink-0" />
                    <span className="font-bold text-slate-800">
                        {rawDestAddress ? `${rawDestAddress}, ${destCity}` : 'Panadería Jhoanes Central (Astoria)'}
                    </span>
                    {destLat && destLng && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            {destLat.toFixed(4)}, {destLng.toFixed(4)}
                        </span>
                    )}
                </div>

                {order.address?.access_code && (
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="text-slate-400">Código de Acceso:</span>
                        <span className="font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-black">
                            {order.address.access_code}
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}
