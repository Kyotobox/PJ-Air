'use client';

import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, RotateCcw, Loader2, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

export interface FacadePhotoUploaderProps {
    value?: string | null;
    onChange: (url: string | null) => void;
    locale?: string;
    disabled?: boolean;
}

export const FacadePhotoUploader: React.FC<FacadePhotoUploaderProps> = ({
    value,
    onChange,
    locale = 'es',
    disabled = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset the input value so the same file could be re-selected if desired
        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            setError(locale === 'en' ? 'Only image files are allowed' : 'Solo se permiten archivos de imagen');
            return;
        }

        // Limit size to 10MB
        if (file.size > 10 * 1024 * 1024) {
            setError(locale === 'en' ? 'The image size must be under 10MB' : 'La imagen no debe superar los 10MB');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            let photoUrl = '';

            // Try primary endpoint POST /addresses/upload-facade
            try {
                const res = await api.upload('/addresses/upload-facade', formData) as any;
                if (res?.url) {
                    photoUrl = res.url;
                }
            } catch (facadeErr) {
                // Secondary fallback endpoint POST /addresses/upload-photo
                try {
                    const res = await api.upload('/addresses/upload-photo', formData) as any;
                    if (res?.url) {
                        photoUrl = res.url;
                    }
                } catch {
                    // Offline-first (§45) fallback to base64 DataURL
                    photoUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }
            }

            if (photoUrl) {
                onChange(photoUrl);
            } else {
                throw new Error(locale === 'en' ? 'Failed to process image' : 'No se pudo procesar la imagen');
            }
        } catch (err: any) {
            setError(err.message || (locale === 'en' ? 'Error uploading facade photo' : 'Error al subir la foto de fachada'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setError(null);
    };

    const imageSrc = value
        ? (value.startsWith('http') || value.startsWith('data:') ? value : `${API_URL || ''}${value}`)
        : '';

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                    <Camera size={13} className="text-primary" />
                    <span>{locale === 'en' ? 'Storefront / Facade Photo' : 'Foto de Fachada / Entrada del Local'}</span>
                </label>
                {value ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 size={10} />
                        <span>{locale === 'en' ? 'Photo Attached' : 'Foto Cargada'}</span>
                    </span>
                ) : (
                    <span className="text-[9px] font-bold text-muted-foreground">
                        {locale === 'en' ? 'Recommended for B2B' : 'Recomendado B2B'}
                    </span>
                )}
            </div>

            {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[11px] font-medium flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={disabled || isUploading}
                onChange={handleFileChange}
            />

            {value ? (
                /* Preview State */
                <div className="relative group rounded-2xl overflow-hidden border border-border/80 bg-slate-50 p-2 flex items-center gap-3">
                    <div className="relative w-24 h-20 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-border/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imageSrc}
                            alt="Fachada del local comercial"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-foreground truncate">
                            {locale === 'en' ? 'Storefront photo uploaded' : 'Foto de fachada registrada'}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                            {locale === 'en'
                                ? 'Facilitates early morning deliveries & visual verification.'
                                : 'Facilita entregas en madrugada y verificación comercial.'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                type="button"
                                disabled={disabled || isUploading}
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                            >
                                <RotateCcw size={11} />
                                <span>{locale === 'en' ? 'Change' : 'Cambiar'}</span>
                            </button>
                            <span className="text-border">|</span>
                            <button
                                type="button"
                                disabled={disabled || isUploading}
                                onClick={handleRemove}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:underline"
                            >
                                <Trash2 size={11} />
                                <span>{locale === 'en' ? 'Remove' : 'Eliminar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Empty Upload Dropzone */
                <div
                    onClick={() => {
                        if (!disabled && !isUploading) {
                            fileInputRef.current?.click();
                        }
                    }}
                    className={`border-2 border-dashed border-border/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/[0.02] ${
                        disabled || isUploading ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                >
                    {isUploading ? (
                        <div className="py-2 flex flex-col items-center gap-2 text-primary">
                            <Loader2 className="animate-spin" size={20} />
                            <span className="text-[11px] font-bold">
                                {locale === 'en' ? 'Uploading storefront photo...' : 'Subiendo foto de fachada...'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 py-1">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Building2 size={20} />
                            </div>
                            <div className="text-left">
                                <span className="text-xs font-bold text-foreground block">
                                    {locale === 'en' ? 'Upload Storefront / Facade Photo' : 'Subir Foto de Fachada / Local'}
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                    {locale === 'en'
                                        ? 'Take a photo or choose from gallery (camera / file)'
                                        : 'Toma una foto con tu cámara o elige un archivo'}
                                </span>
                            </div>
                            <div className="ml-auto pl-2">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                                    <Upload size={12} />
                                    <span>{locale === 'en' ? 'Browse' : 'Subir'}</span>
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
