'use client';

import React, { useState, useEffect } from 'react';
import {
    X, ShieldCheck, FileText, CheckCircle2, AlertCircle, Clock, ExternalLink,
    Loader2, Sparkles, User, Building2, Eye, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

interface ST120AuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any | null;
    onStatusUpdated: (userId: string, newStatus: string, taxExempt: boolean) => void;
}

export const ST120AuditModal: React.FC<ST120AuditModalProps> = ({
    isOpen,
    onClose,
    user,
    onStatusUpdated,
}) => {
    const [verdict, setVerdict] = useState<any | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const docUrl = user?.profile?.st120_document_url || user?.st120_document_url || null;
    const isPdf = docUrl?.toLowerCase().endsWith('.pdf');
    const fullDocUrl = docUrl
        ? (docUrl.startsWith('http') ? docUrl : `${API_URL}${docUrl}`)
        : null;

    useEffect(() => {
        setVerdict(null);
        setActionMessage(null);
        setShowRejectInput(false);
        setRejectReason('');

        // Automatically trigger Vision AI if document is present and pending
        if (isOpen && user && docUrl) {
            handleRunVisionAI();
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const handleRunVisionAI = async () => {
        if (!user.id || !docUrl) return;
        setIsValidating(true);
        setActionMessage(null);
        try {
            const result = await api.post(`/tax/validate-st120/${user.id}`, {}) as any;
            setVerdict(result);
        } catch (err: any) {
            console.error('Vision AI error:', err);
            setActionMessage({
                type: 'error',
                text: err.message || 'Error al ejecutar validación de Visión AI'
            });
        } finally {
            setIsValidating(false);
        }
    };

    const handleApprove = async () => {
        setIsApproving(true);
        setActionMessage(null);
        try {
            await api.post(`/tax/approve/${user.id}`, {});
            onStatusUpdated(user.id, 'APPROVED', true);
            setActionMessage({
                type: 'success',
                text: '✅ Certificado ST-120 Aprobado. Cliente exento de impuestos (0% Sales Tax).'
            });
        } catch (err: any) {
            setActionMessage({
                type: 'error',
                text: err.message || 'Error al aprobar exención'
            });
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        setIsRejecting(true);
        setActionMessage(null);
        try {
            await api.post(`/tax/reject/${user.id}`, { reason: rejectReason || 'Rechazado tras auditoría ST-120' });
            onStatusUpdated(user.id, 'REJECTED', false);
            setActionMessage({
                type: 'success',
                text: '⚠️ Certificado ST-120 rechazado. Cliente marcado como no exento.'
            });
            setShowRejectInput(false);
        } catch (err: any) {
            setActionMessage({
                type: 'error',
                text: err.message || 'Error al rechazar certificado'
            });
        } finally {
            setIsRejecting(false);
        }
    };

    const currentStatus = user.profile?.st120_status || user.st120_status || 'NONE';
    const isExempt = Boolean(user.profile?.tax_exempt ?? user.tax_exempt);
    const registeredTaxId = user.profile?.tax_id || user.tax_id || 'Sin registrar';
    const registeredCompany = user.profile?.company_name || user.profile?.full_name || 'Sin registrar';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-lg tracking-tight">
                                Auditoría Fiscal ST-120 & Visión AI
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Cliente: <strong className="text-slate-800">{registeredCompany}</strong> ({user.email})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {actionMessage && (
                        <div className={`p-4 rounded-2xl text-xs font-bold border ${
                            actionMessage.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                            {actionMessage.text}
                        </div>
                    )}

                    {/* Status Pill & Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado ST-120</span>
                            <div className="mt-1 flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                    currentStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                    currentStatus === 'PENDING' ? 'bg-amber-100 text-amber-900' :
                                    currentStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                    'bg-slate-200 text-slate-700'
                                }`}>
                                    {currentStatus}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exención 0% Tax</span>
                            <div className="mt-1">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                    isExempt ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {isExempt ? '✅ APLICADA (0.00%)' : '❌ NO EXENTO'}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tax ID Registrado</span>
                            <p className="mt-1 font-mono font-bold text-sm text-slate-800">{registeredTaxId}</p>
                        </div>
                    </div>

                    {/* Split View: Document Preview vs Vision AI Verdict */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Document Preview */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                    <FileText size={16} className="text-primary" />
                                    Documento ST-120 Subido
                                </span>
                                {fullDocUrl && (
                                    <a
                                        href={fullDocUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                    >
                                        <span>Abrir original</span>
                                        <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>

                            {docUrl ? (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900/5 min-h-[300px] flex items-center justify-center p-2">
                                    {isPdf ? (
                                        <div className="p-8 text-center space-y-3">
                                            <FileText size={48} className="text-red-500 mx-auto" />
                                            <p className="text-xs font-bold text-slate-700">Certificado ST-120 (PDF)</p>
                                            <a
                                                href={fullDocUrl!}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-block"
                                            >
                                                Visualizar PDF en Pestaña
                                            </a>
                                        </div>
                                    ) : (
                                        <img
                                            src={fullDocUrl!}
                                            alt="ST-120 Doc"
                                            className="max-h-[340px] w-auto object-contain rounded-xl"
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-slate-50">
                                    <FileText size={36} className="text-slate-300 mx-auto" />
                                    <p className="text-xs font-bold text-slate-500">Este cliente aún no ha cargado el documento ST-120.</p>
                                </div>
                            )}
                        </div>

                        {/* Right: Vision AI Analysis */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                    <Sparkles size={16} className="text-amber-500" />
                                    Veredicto de Visión AI (Gemini Flash)
                                </span>
                                {docUrl && (
                                    <button
                                        type="button"
                                        onClick={handleRunVisionAI}
                                        disabled={isValidating}
                                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                        {isValidating && <Loader2 size={12} className="animate-spin" />}
                                        <span>Re-analizar</span>
                                    </button>
                                )}
                            </div>

                            {isValidating ? (
                                <div className="border border-slate-200 rounded-2xl p-12 text-center space-y-3 bg-slate-50 min-h-[300px] flex flex-col items-center justify-center">
                                    <Loader2 size={32} className="animate-spin text-primary" />
                                    <p className="text-xs font-bold text-slate-700">Analizando documento con Gemini Flash Vision...</p>
                                    <p className="text-[11px] text-slate-400">Extrayendo Tax ID, nombre de empresa y validando firma...</p>
                                </div>
                            ) : verdict ? (
                                <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                                    {/* Verdict Banner */}
                                    <div className={`p-4 rounded-xl flex items-center justify-between ${
                                        verdict.verdict === 'MATCH'
                                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                                            : verdict.verdict === 'MISMATCH'
                                            ? 'bg-rose-50 border border-rose-200 text-rose-900'
                                            : 'bg-amber-50 border border-amber-200 text-amber-900'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            {verdict.verdict === 'MATCH' ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" /> :
                                             verdict.verdict === 'MISMATCH' ? <AlertCircle size={20} className="text-rose-600 shrink-0" /> :
                                             <Clock size={20} className="text-amber-600 shrink-0" />}
                                            <div>
                                                <p className="font-black text-sm uppercase tracking-wide">
                                                    Dictamen: {verdict.verdict}
                                                </p>
                                                <p className="text-xs font-medium opacity-90 mt-0.5">{verdict.reason}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black px-2 py-0.5 bg-white/70 rounded-md">
                                            {Math.round((verdict.confidenceScore || 0.85) * 100)}% Confianza
                                        </span>
                                    </div>

                                    {/* Extracted fields vs User Data */}
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100">
                                            <span className="text-slate-500 font-bold">Formato Válido ST-120:</span>
                                            <span className={`font-black ${verdict.isValidST120Format ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {verdict.isValidST120Format ? 'Sí (Formulario Oficial NY)' : 'No (Inválido)'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100">
                                            <span className="text-slate-500 font-bold">Tax ID Extraído:</span>
                                            <span className="font-mono font-bold text-slate-800">
                                                {verdict.extractedTaxId || 'No detectado'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100">
                                            <span className="text-slate-500 font-bold">Empresa Extraída:</span>
                                            <span className="font-bold text-slate-800">
                                                {verdict.extractedCompanyName || 'No detectada'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100">
                                            <span className="text-slate-500 font-bold">Firma Física/Legal:</span>
                                            <span className={`font-black ${verdict.hasPhysicalSignature ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {verdict.hasPhysicalSignature ? '✅ Presente y Detectada' : '❌ Ausente'}
                                            </span>
                                        </div>
                                    </div>

                                    {verdict.notes && (
                                        <div className="p-3 bg-white rounded-xl border border-slate-100 text-[11px] text-slate-500 italic">
                                            Notas AI: {verdict.notes}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-slate-50 min-h-[300px] flex flex-col items-center justify-center">
                                    <Sparkles size={32} className="text-slate-300" />
                                    <p className="text-xs font-bold text-slate-500">Sin análisis ejecutado todavía.</p>
                                    {docUrl && (
                                        <button
                                            type="button"
                                            onClick={handleRunVisionAI}
                                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl mt-2 cursor-pointer"
                                        >
                                            Ejecutar Auditoría con Visión AI
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Reject Reason input if opened */}
                    {showRejectInput && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 animate-fade-in">
                            <label className="text-xs font-black text-rose-900 uppercase tracking-wider">
                                Motivo de Rechazo del Certificado ST-120
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: El Tax ID no coincide o el documento está borroso sin firma"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-rose-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/20"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRejectInput(false)}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={isRejecting}
                                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                                >
                                    {isRejecting && <Loader2 size={12} className="animate-spin" />}
                                    Confirmar Rechazo
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer: Action Buttons */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Cerrar
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowRejectInput(true)}
                            disabled={isApproving || isRejecting}
                            className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <ThumbsDown size={14} />
                            <span>Rechazar ST-120</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={isApproving || isRejecting || !docUrl}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isApproving ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                            <span>Aprobar Exención ST-120 (0% Tax)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
