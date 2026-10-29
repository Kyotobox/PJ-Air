'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import {
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Building2,
    Hash,
    DollarSign,
    Calendar,
    FileText,
    Clock
} from 'lucide-react';

interface RegisterCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    orderTotal?: number;
    userId?: string;
    onSuccess?: (check: any) => void;
}

export function RegisterCheckModal({
    isOpen,
    onClose,
    orderId,
    orderTotal,
    userId,
    onSuccess,
}: RegisterCheckModalProps) {
    const today = new Date().toISOString().split('T')[0];

    const [checkNumber, setCheckNumber] = useState('');
    const [bankName, setBankName] = useState('');
    const [amount, setAmount] = useState<string>(
        orderTotal !== undefined && orderTotal > 0 ? orderTotal.toFixed(2) : ''
    );
    const [receivedDate, setReceivedDate] = useState(today);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!checkNumber.trim()) {
            setError('Por favor ingresa el número de cheque.');
            return;
        }
        if (!bankName.trim()) {
            setError('Por favor ingresa el banco emisor.');
            return;
        }
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError('El monto debe ser mayor a 0.');
            return;
        }
        if (!receivedDate) {
            setError('Por favor selecciona la fecha de recepción.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                order_id: orderId,
                check_number: checkNumber.trim(),
                bank_name: bankName.trim(),
                amount: numAmount,
                received_date: receivedDate,
                notes: notes.trim(),
                user_id: userId,
            };

            const response = await api.post('/payments/checks', payload) as any;
            setSuccessMessage(`Cheque #${checkNumber} registrado con éxito. Plazo estimado de acreditación: ${response.clearance_deadline || '3 días hábiles'}.`);

            if (onSuccess) {
                onSuccess(response);
            }

            setTimeout(() => {
                setSuccessMessage(null);
                setCheckNumber('');
                setBankName('');
                setNotes('');
                onClose();
            }, 1200);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Error al registrar el cheque.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 bg-slate-50/80 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight">
                                Registrar Pago por Cheque
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Orden #{orderId.substring(0, 8)} • Ciclo de Conciliación
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 font-semibold animate-in fade-in">
                            <AlertCircle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 font-semibold animate-in fade-in">
                            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Check Number */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Hash size={13} className="text-slate-400" />
                                N° de Cheque *
                            </label>
                            <input
                                type="text"
                                required
                                value={checkNumber}
                                onChange={(e) => setCheckNumber(e.target.value)}
                                placeholder="Ej. CHK-10045"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                        </div>

                        {/* Bank Name */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Building2 size={13} className="text-slate-400" />
                                Banco Emisor *
                            </label>
                            <input
                                type="text"
                                required
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                placeholder="Ej. Chase Bank / BoA"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Amount */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-slate-400" />
                                Monto ($ USD) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                        </div>

                        {/* Received Date */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Calendar size={13} className="text-slate-400" />
                                Fecha Recepción *
                            </label>
                            <input
                                type="date"
                                required
                                value={receivedDate}
                                onChange={(e) => setReceivedDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <FileText size={13} className="text-slate-400" />
                            Notas / Observaciones
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Información contable adicional, sucursal, etc."
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                        />
                    </div>

                    {/* Clearance Info Banner */}
                    <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-center gap-3">
                        <Clock size={16} className="text-amber-600 shrink-0" />
                        <p className="text-[11px] text-amber-900 leading-tight">
                            <strong className="font-bold">Ciclo Contable:</strong> Al registrarse queda en estado <span className="font-mono font-bold">IN_HAND</span> con vencimiento estimado en <span className="font-bold">3 días hábiles</span> (excluyendo fines de semana). Al marcarlo como <span className="font-bold">DEPOSITADO</span>, se liberará el cupo de crédito del cliente.
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-amber-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Registrar Cheque
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
