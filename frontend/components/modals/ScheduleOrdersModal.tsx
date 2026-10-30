'use client';

import React from 'react';
import { 
    Clock, Calendar, X, Moon, Truck, Store, 
    Sparkles, AlertCircle, CheckCircle2, ChevronRight, ShieldCheck 
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

interface ScheduleOrdersModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ScheduleOrdersModal({ isOpen, onClose }: ScheduleOrdersModalProps) {
    const { locale } = useLanguage();

    if (!isOpen) return null;

    const isEn = locale === 'en';

    const scheduleData = [
        {
            dayEn: 'Monday (before 12 PM)',
            dayEs: 'Lunes (antes 12 PM)',
            bakeEn: 'Mon Night',
            bakeEs: 'Lunes Noche',
            deliveryEn: 'Wednesday Morning (4 - 7 AM)',
            deliveryEs: 'Miércoles Madrugada (4 - 7 AM)',
            pickupEn: 'Wednesday (8 - 10 AM)',
            pickupEs: 'Miércoles (8 - 10 AM)',
        },
        {
            dayEn: 'Tuesday (before 12 PM)',
            dayEs: 'Martes (antes 12 PM)',
            bakeEn: 'Tue Night',
            bakeEs: 'Martes Noche',
            deliveryEn: 'Thursday Morning (4 - 7 AM)',
            deliveryEs: 'Jueves Madrugada (4 - 7 AM)',
            pickupEn: 'Thursday (8 - 10 AM)',
            pickupEs: 'Jueves (8 - 10 AM)',
        },
        {
            dayEn: 'Wednesday (before 12 PM)',
            dayEs: 'Miércoles (antes 12 PM)',
            bakeEn: 'Wed Night',
            bakeEs: 'Miércoles Noche',
            deliveryEn: 'Friday Morning (4 - 7 AM)',
            deliveryEs: 'Viernes Madrugada (4 - 7 AM)',
            pickupEn: 'Friday (8 - 10 AM)',
            pickupEs: 'Viernes (8 - 10 AM)',
        },
        {
            dayEn: 'Thursday (before 12 PM)',
            dayEs: 'Jueves (antes 12 PM)',
            bakeEn: 'Thu Night',
            bakeEs: 'Jueves Noche',
            deliveryEn: 'Saturday Morning (4 - 7 AM)',
            deliveryEs: 'Sábado Madrugada (4 - 7 AM)',
            pickupEn: 'Saturday (8 - 10 AM)',
            pickupEs: 'Sábado (8 - 10 AM)',
        },
        {
            dayEn: 'Friday (before 12 PM)',
            dayEs: 'Viernes (antes 12 PM)',
            bakeEn: 'Sun Night',
            bakeEs: 'Domingo Noche',
            deliveryEn: 'Monday Morning (4 - 7 AM)',
            deliveryEs: 'Lunes Madrugada (4 - 7 AM)',
            pickupEn: 'Monday (8 - 10 AM)',
            pickupEs: 'Lunes (8 - 10 AM)',
        },
        {
            dayEn: 'Sat - Sun (Weekend)',
            dayEs: 'Sáb - Dom (Fin de semana)',
            bakeEn: 'Mon Night',
            bakeEs: 'Lunes Noche',
            deliveryEn: 'Wednesday Morning (4 - 7 AM)',
            deliveryEs: 'Miércoles Madrugada (4 - 7 AM)',
            pickupEn: 'Wednesday (8 - 10 AM)',
            pickupEs: 'Miércoles (8 - 10 AM)',
        },
    ];

    return (
        <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            style={{ background: 'rgba(10,8,5,0.72)', backdropFilter: 'blur(10px)' }}
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-border/60 animate-fade-in my-8"
                onClick={e => e.stopPropagation()}
            >
                {/* Top gradient banner */}
                <div className="jhoanes-gradient p-8 sm:p-10 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-3 backdrop-blur-sm">
                        <Clock size={12} /> {isEn ? 'B2B Production & Delivery Cycles' : 'Cronograma de Producción y Despacho B2B'}
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight leading-snug">
                        {isEn ? 'Baking Schedule & Early Morning Delivery' : 'Horarios de Horneado y Despacho en Madrugada'}
                    </h2>
                    <p className="text-white/80 text-xs sm:text-sm mt-2 max-w-xl font-medium">
                        {isEn 
                            ? 'Our artisanal overnight production ensures croissants and viennoiserie arrive freshly baked at your establishment before store opening.'
                            : 'Nuestra producción artesanal nocturna garantiza croissants y bollería recién horneada en tu establecimiento antes de la apertura.'}
                    </p>
                </div>

                {/* Content body */}
                <div className="p-6 sm:p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    
                    {/* 4-Step Infographic */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                            <Sparkles size={14} className="text-primary" />
                            {isEn ? 'How Our Daily B2B Cycle Works' : 'Cómo Funciona Nuestro Ciclo Mayorista Diario'}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Step 1 */}
                            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full inline-block mb-2">
                                        Paso 1
                                    </span>
                                    <h4 className="font-bold text-sm text-amber-950 mb-1">
                                        {isEn ? '12:00 PM Cutoff' : 'Corte a las 12:00 PM'}
                                    </h4>
                                    <p className="text-[11px] text-amber-900/80 leading-relaxed">
                                        {isEn 
                                            ? 'Orders placed before noon lock your spot in the next production batch.'
                                            : 'Pedidos confirmados antes de las 12 PM entran al siguiente lote de horneado.'}
                                    </p>
                                </div>
                                <div className="mt-3 text-[10px] font-black text-amber-800 flex items-center gap-1">
                                    <Clock size={11} /> 12:00 PM NY
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-amber-300 bg-white/10 px-2 py-0.5 rounded-full inline-block mb-2">
                                        Paso 2
                                    </span>
                                    <h4 className="font-bold text-sm text-white mb-1">
                                        {isEn ? 'Overnight Baking' : 'Horneado Nocturno'}
                                    </h4>
                                    <p className="text-[11px] text-white/70 leading-relaxed">
                                        {isEn 
                                            ? 'Long fermentation doughs baked between 6 PM and 3:30 AM.'
                                            : 'Masa madre y mantequilla europea horneadas entre 6 PM y 3:30 AM.'}
                                    </p>
                                </div>
                                <div className="mt-3 text-[10px] font-black text-amber-300 flex items-center gap-1">
                                    <Moon size={11} /> 6:00 PM - 3:30 AM
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block mb-2">
                                        Paso 3
                                    </span>
                                    <h4 className="font-bold text-sm text-foreground mb-1">
                                        {isEn ? 'Early Delivery' : 'Despacho Madrugada'}
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {isEn 
                                            ? 'Silent drop-off inside coolers using access codes before your opening.'
                                            : 'Entrega silenciosa con código o llave en neveras antes de abrir tu local.'}
                                    </p>
                                </div>
                                <div className="mt-3 text-[10px] font-black text-primary flex items-center gap-1">
                                    <Truck size={11} /> 4:00 AM - 7:00 AM
                                </div>
                            </div>

                            {/* Step 4 */}
                            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-block mb-2">
                                        Paso 4
                                    </span>
                                    <h4 className="font-bold text-sm text-foreground mb-1">
                                        {isEn ? 'Store Pick Up' : 'Retiro en Tienda'}
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {isEn 
                                            ? 'Collect directly at 3304 Broadway, Astoria, NY 11106.'
                                            : 'Retiro en Astoria, NY para clientes con modalidad Pick Up sin flete.'}
                                    </p>
                                </div>
                                <div className="mt-3 text-[10px] font-black text-muted-foreground flex items-center gap-1">
                                    <Store size={11} /> 8:00 AM - 10:00 AM
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table of Schedules */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                            <Calendar size={14} className="text-primary" />
                            {isEn ? 'Weekly Order & Delivery Matrix (Lead Time 48h)' : 'Tabla Semanal de Pedidos y Entregas (Lead Time 48h)'}
                        </h3>

                        <div className="overflow-x-auto rounded-2xl border border-border shadow-xs">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-muted/60 text-muted-foreground font-black text-[10px] uppercase tracking-wider border-b border-border">
                                        <th className="py-3 px-4">{isEn ? 'Order Received' : 'Pedido Realizado'}</th>
                                        <th className="py-3 px-4">{isEn ? 'Bake Night' : 'Horneado'}</th>
                                        <th className="py-3 px-4">{isEn ? 'Delivery (Van)' : 'Entrega a Domicilio'}</th>
                                        <th className="py-3 px-4">{isEn ? 'Store Pick Up' : 'Pick Up Astoria'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {scheduleData.map((row, i) => (
                                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                                            <td className="py-3 px-4 font-bold text-foreground">
                                                {isEn ? row.dayEn : row.dayEs}
                                            </td>
                                            <td className="py-3 px-4 font-medium text-muted-foreground">
                                                {isEn ? row.bakeEn : row.bakeEs}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-primary">
                                                {isEn ? row.deliveryEn : row.deliveryEs}
                                            </td>
                                            <td className="py-3 px-4 font-medium text-foreground/80">
                                                {isEn ? row.pickupEn : row.pickupEs}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">
                            * {isEn 
                                ? 'Orders submitted after 12:00 PM shift to the subsequent production cycle (T+3).'
                                : 'Pedidos enviados después de las 12:00 PM se desplazan automáticamente al ciclo subsiguiente (T+3).'}
                        </p>
                    </div>

                    {/* Operational Highlights */}
                    <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/20 flex items-start gap-3">
                        <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
                        <div className="text-xs">
                            <p className="font-bold text-foreground">
                                {isEn ? 'Nocturnal Logistics Protocol' : 'Protocolo de Seguridad y Logística Nocturna'}
                            </p>
                            <p className="text-muted-foreground mt-0.5 leading-relaxed">
                                {isEn 
                                    ? 'Our drivers follow strict quiet-delivery standards. Provide access codes, key locations, and clear photo references in your address profile to ensure uninterrupted delivery.'
                                    : 'Nuestros conductores cumplen estándares estrictos de silencio y cuidado. Configura tus códigos de acceso, ubicación de llave y fotos en tu perfil para entregas 100% fluidas.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer action */}
                <div className="p-6 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-full border border-border text-foreground font-black text-xs uppercase tracking-wider hover:bg-muted transition-all"
                    >
                        {isEn ? 'Close' : 'Cerrar'}
                    </button>

                    <Link
                        href="/#catalogo"
                        onClick={onClose}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-primary text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-md group"
                    >
                        <span>{isEn ? 'Explore Catalog & Order' : 'Explorar Catálogo y Pedir'}</span>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
