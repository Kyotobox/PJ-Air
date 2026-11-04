'use client';

import React, { useState, useEffect } from 'react';
import { 
    Printer, FileSpreadsheet, X, Truck, Package, 
    Calendar, MapPin, User, CheckCircle2, ChevronRight, AlertCircle, Sparkles
} from 'lucide-react';
import { 
    openKitchenPrintWindow, 
    downloadKitchenExcel, 
    groupAndSortKitchenItems, 
    formatDeliveryDateUpper,
    KitchenPrintOptions
} from '@/lib/kitchen-dispatch';

interface PrintKitchenModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any | null;
}

const DRIVER_PRESETS = [
    'WILLIAM MEDINA',
    'JOHANNTN',
    'CARLOS PEREZ',
    'RECOGIDA EN TIENDA',
    'ENTREGA PROPIA',
];

const PACKING_STYLES = [
    { id: 'CAJAS DE CARTON', label: 'Cajas de Cartón', desc: 'Despacho estándar en cajas de cartón selladas' },
    { id: 'CAJA PLASTICA / CONTENEDORES', label: 'Caja Plástica / Contenedores', desc: 'Retornables plásticos para alta conservación' },
];

export default function PrintKitchenModal({ isOpen, onClose, order }: PrintKitchenModalProps) {
    const [driverName, setDriverName] = useState('WILLIAM MEDINA');
    const [packingStyle, setPackingStyle] = useState('CAJAS DE CARTON');

    // Inicializar estado cuando se abre para una orden
    useEffect(() => {
        if (!isOpen || !order) return;
        const initialDriver = order.delivery_user?.profile?.full_name?.toUpperCase() || 'WILLIAM MEDINA';
        setDriverName(initialDriver);
        setPackingStyle('CAJAS DE CARTON');
    }, [isOpen, order]);

    // Cerrar con Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !order) return null;

    const clientName = order.user?.profile?.full_name || order.user?.profile?.nickname || 'Cliente Anónimo';
    const shortOrderId = order.id ? order.id.slice(0, 8).toUpperCase() : 'N/A';
    const deliveryDateStr = order.delivery_date 
        ? (order.delivery_date.includes('T') ? order.delivery_date.split('T')[0] : order.delivery_date.split(' ')[0])
        : '';
    const formattedDate = formatDeliveryDateUpper(deliveryDateStr, 'es');
    
    let deliveryAddress = order.address?.address || '';
    if (order.delivery_type === 'pickup') {
        deliveryAddress = 'PICK UP EN TIENDA (JHÓANES BAKERY)';
    } else if (!deliveryAddress) {
        deliveryAddress = 'DIRECCIÓN NO ESPECIFICADA';
    }

    const items = order.items || [];
    const { groups, totalUnits } = groupAndSortKitchenItems(items);

    const printOptions: KitchenPrintOptions = {
        orderId: order.id,
        clientName,
        deliveryDateStr,
        driverName,
        deliveryAddress,
        packingStyle,
        items,
        orderNotes: order.notes,
        locale: 'es',
    };

    const handlePrintWeb = () => {
        openKitchenPrintWindow(printOptions);
    };

    const handleDownloadExcel = () => {
        downloadKitchenExcel(printOptions);
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-kitchen-title"
        >
            <div 
                className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Superior con Franja Amarilla Distintiva */}
                <div className="bg-amber-400/20 border-b border-amber-300/50 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-black flex items-center justify-center font-black shadow-sm">
                            <Printer size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-black text-white">
                                    Cocina & Despacho
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-700">
                                    #{shortOrderId}
                                </span>
                            </div>
                            <h2 id="modal-kitchen-title" className="text-base font-black text-slate-900 leading-tight">
                                {clientName}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-black flex items-center justify-center transition-all shadow-xs"
                        aria-label="Cerrar modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Contenido Scrolleable */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Información Básica de la Orden */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Fecha de Entrega
                            </span>
                            <span className="font-extrabold text-slate-900">
                                {formattedDate}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Destino / Dirección
                            </span>
                            <span className="font-extrabold text-slate-900 line-clamp-1" title={deliveryAddress}>
                                {deliveryAddress}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Categorías A-Z
                            </span>
                            <span className="font-extrabold text-slate-900">
                                {groups.length} {groups.length === 1 ? 'Categoría' : 'Categorías'}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Volumen Total
                            </span>
                            <span className="font-black text-amber-600">
                                {totalUnits} Unidades
                            </span>
                        </div>
                    </div>

                    {/* 1. Selector de Chofer Asignado */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <Truck size={14} className="text-amber-500" />
                                Chofer Asignado
                            </label>
                            <span className="text-[10px] font-bold text-slate-400">Default: William Medina</span>
                        </div>

                        {/* Presets Rápidos */}
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                            {DRIVER_PRESETS.map((preset) => {
                                const isSelected = driverName.trim().toUpperCase() === preset.toUpperCase();
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setDriverName(preset)}
                                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                            isSelected 
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                        }`}
                                    >
                                        {preset}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Input Editable */}
                        <input
                            type="text"
                            value={driverName}
                            onChange={(e) => setDriverName(e.target.value.toUpperCase())}
                            placeholder="Nombre del Chofer Asignado..."
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all uppercase"
                        />
                    </div>

                    {/* 2. Selector de Estilo de Empaque */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2">
                            <Package size={14} className="text-amber-500" />
                            Estilo de Empaque
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {PACKING_STYLES.map((style) => {
                                const isSelected = packingStyle === style.id;
                                return (
                                    <button
                                        key={style.id}
                                        type="button"
                                        onClick={() => setPackingStyle(style.id)}
                                        className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                                            isSelected
                                                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30'
                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-slate-900 uppercase">
                                                {style.label}
                                            </span>
                                            {isSelected && (
                                                <CheckCircle2 size={16} className="text-amber-600" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                            {style.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resumen de Productos por Categoría A-Z */}
                    <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/60">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                            Vista Previa de Categorías Ordenadas A-Z
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {groups.map((group) => (
                                <div key={group.category} className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded-lg border border-slate-100">
                                    <span className="font-bold text-slate-800">
                                        {group.category} ({group.items.length})
                                    </span>
                                    <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                                        {group.subtotal} uds
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer con Acciones Directas */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handlePrintWeb}
                        className="w-full py-3.5 px-4 rounded-2xl bg-black hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg shadow-black/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <Printer size={16} className="text-amber-400" />
                        <span>Imprimir Vista Web</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <FileSpreadsheet size={16} />
                        <span>Descargar Excel (.xlsx)</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
