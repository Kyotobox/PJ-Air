'use client';

import React, { useState } from 'react';
import { FileText, Upload, CheckCircle2, AlertCircle, Clock, ExternalLink, Loader2, ShieldCheck, Eye } from 'lucide-react';
import { API_URL } from '@/lib/config';

interface ST120UploadCardProps {
    userId: string;
    taxId: string;
    st120Status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    st120DocumentUrl: string | null;
    taxExempt: boolean;
    locale: string;
    onUpdated: (updatedProfile: any) => void;
}

export const ST120UploadCard: React.FC<ST120UploadCardProps> = ({
    userId,
    taxId: initialTaxId,
    st120Status,
    st120DocumentUrl,
    taxExempt,
    locale,
    onUpdated,
}) => {
    const [taxId, setTaxId] = useState(initialTaxId || '');
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingTaxId, setIsSavingTaxId] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const isPdf = st120DocumentUrl?.toLowerCase().endsWith('.pdf');
    const fullDocUrl = st120DocumentUrl 
        ? (st120DocumentUrl.startsWith('http') ? st120DocumentUrl : `${API_URL}${st120DocumentUrl}`)
        : null;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        setIsUploading(true);
        setFeedback(null);

        const formData = new FormData();
        formData.append('file', file);
        if (taxId.trim()) {
            formData.append('tax_id', taxId.trim());
        }

        try {
            const token = typeof document !== 'undefined' 
                ? document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1]
                : null;

            const res = await fetch(`${API_URL}/users/${userId}/st120`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {},
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || (locale === 'en' ? 'Failed to upload ST-120 document' : 'Error al subir documento ST-120'));
            }

            const updatedProfile = await res.json();
            onUpdated(updatedProfile);
            setFeedback({
                type: 'success',
                message: locale === 'en' 
                    ? 'ST-120 Certificate uploaded successfully. It is now pending review.'
                    : 'Certificado ST-120 subido con éxito. Se encuentra en proceso de revisión.'
            });
        } catch (err: any) {
            setFeedback({
                type: 'error',
                message: err.message || (locale === 'en' ? 'Upload failed' : 'Error al cargar')
            });
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleSaveTaxId = async () => {
        if (!userId) return;
        setIsSavingTaxId(true);
        setFeedback(null);
        try {
            const token = typeof document !== 'undefined'
                ? document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1]
                : null;

            const res = await fetch(`${API_URL}/users/${userId}/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
                },
                body: JSON.stringify({ tax_id: taxId.trim() }),
            });

            if (!res.ok) throw new Error('Failed to update Tax ID');
            const updated = await res.json();
            onUpdated(updated);
            setFeedback({
                type: 'success',
                message: locale === 'en' ? 'Tax ID saved successfully' : 'Tax ID guardado con éxito'
            });
        } catch (err: any) {
            setFeedback({
                type: 'error',
                message: err.message || (locale === 'en' ? 'Error saving Tax ID' : 'Error al guardar Tax ID')
            });
        } finally {
            setIsSavingTaxId(false);
        }
    };

    const renderBadge = () => {
        switch (st120Status) {
            case 'APPROVED':
                return (
                    <span data-testid="st120-status-approved" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>{locale === 'en' ? 'ST-120 Approved (0% Sales Tax)' : 'ST-120 Aprobado (0% Impuesto)'}</span>
                    </span>
                );
            case 'PENDING':
                return (
                    <span data-testid="st120-status-pending" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock size={14} className="text-amber-600 animate-spin" />
                        <span>{locale === 'en' ? 'Under Review (Pending)' : 'En Revisión (Pendiente)'}</span>
                    </span>
                );
            case 'REJECTED':
                return (
                    <span data-testid="st120-status-rejected" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertCircle size={14} className="text-rose-600" />
                        <span>{locale === 'en' ? 'Rejected — Please Re-upload' : 'Rechazado — Vuelve a subir'}</span>
                    </span>
                );
            default:
                return (
                    <span data-testid="st120-status-none" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-muted text-muted-foreground border border-border">
                        <FileText size={14} />
                        <span>{locale === 'en' ? 'Not Uploaded' : 'Sin Certificado'}</span>
                    </span>
                );
        }
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h3 className="font-black text-base tracking-tight">
                            {locale === 'en' ? 'New York ST-120 Resale Certificate' : 'Certificado de Reventa ST-120 de Nueva York'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {locale === 'en' 
                                ? 'NYS DTF Form ST-120 for sales tax exemption on wholesale purchases'
                                : 'Formulario oficial NYS DTF ST-120 para exención del 0% de Sales Tax'}
                        </p>
                    </div>
                </div>
                <div>{renderBadge()}</div>
            </div>

            {feedback && (
                <div className={`p-4 rounded-xl text-xs font-bold border ${
                    feedback.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                    {feedback.message}
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                {/* Tax ID Input */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                        {locale === 'en' ? 'Tax ID / NY Resale Certificate #' : 'Tax ID / N° Certificado de Reventa NY'}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="e.g. 12-3456789"
                            className="premium-input flex-1"
                            value={taxId}
                            onChange={(e) => setTaxId(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={handleSaveTaxId}
                            disabled={isSavingTaxId || !taxId.trim() || taxId.trim() === (initialTaxId || '')}
                            className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-2 cursor-pointer"
                        >
                            {isSavingTaxId && <Loader2 size={14} className="animate-spin" />}
                            <span>{locale === 'en' ? 'Save' : 'Guardar'}</span>
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground ml-1">
                        {locale === 'en'
                            ? 'Must match the Certificate of Authority or TIN on your Form ST-120.'
                            : 'Debe coincidir exactamente con el TIN o Certificado de Autoridad de tu ST-120.'}
                    </p>
                </div>

                {/* Upload Action */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                        {locale === 'en' ? 'Upload Certificate (PDF / Image)' : 'Cargar Certificado (PDF / Imagen)'}
                    </label>
                    <div className="relative">
                        <input
                            type="file"
                            id="st120_file_upload"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="hidden"
                        />
                        <label
                            htmlFor="st120_file_upload"
                            className={`w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 rounded-xl cursor-pointer transition-all text-xs font-bold ${
                                isUploading ? 'opacity-50 pointer-events-none' : ''
                            }`}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin text-primary" />
                                    <span>{locale === 'en' ? 'Uploading document...' : 'Subiendo documento...'}</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={16} className="text-primary" />
                                    <span>{locale === 'en' ? 'Choose ST-120 file (PDF, PNG, JPG)' : 'Seleccionar archivo ST-120 (PDF, PNG, JPG)'}</span>
                                </>
                            )}
                        </label>
                    </div>
                    <p className="text-[11px] text-muted-foreground ml-1">
                        {locale === 'en' ? 'Max file size 5MB. Must show signature.' : 'Máximo 5MB. Debe incluir firma física o digital.'}
                    </p>
                </div>
            </div>

            {/* Document Preview & Details */}
            {st120DocumentUrl && fullDocUrl && (
                <div className="border border-border/80 bg-muted/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                            <Eye size={16} className="text-primary" />
                            <span>{locale === 'en' ? 'Uploaded Document Preview' : 'Vista Previa del Documento Subido'}</span>
                        </div>
                        <a
                            href={fullDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                            <span>{locale === 'en' ? 'Open in new window' : 'Abrir en pestaña nueva'}</span>
                            <ExternalLink size={13} />
                        </a>
                    </div>

                    <div className="mt-2 rounded-lg overflow-hidden border border-border bg-background">
                        {isPdf ? (
                            <div className="p-8 flex flex-col items-center justify-center gap-3 text-center bg-muted/20">
                                <FileText size={48} className="text-rose-500" />
                                <div>
                                    <p className="text-sm font-bold text-foreground">Certificado ST-120 (PDF)</p>
                                    <p className="text-xs text-muted-foreground">{st120DocumentUrl.split('/').pop()}</p>
                                </div>
                                <a
                                    href={fullDocUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                                >
                                    {locale === 'en' ? 'View PDF Document' : 'Visualizar Documento PDF'}
                                </a>
                            </div>
                        ) : (
                            <div className="relative max-h-64 overflow-hidden flex items-center justify-center bg-black/5">
                                <img
                                    src={fullDocUrl}
                                    alt="ST-120 Certificate Preview"
                                    className="max-h-64 object-contain rounded"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
