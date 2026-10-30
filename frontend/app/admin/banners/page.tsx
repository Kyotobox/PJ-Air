'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    Sparkles, Image as ImageIcon, Plus, Edit2, Trash2, CheckCircle2,
    AlertCircle, Loader2, ArrowUpDown, Eye, EyeOff, Upload,
    ExternalLink, Check, X, RefreshCw, Layers
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useLanguage } from '@/context/LanguageContext';

export interface BannerItem {
    id: number;
    title: string;
    title_en?: string;
    subtitle?: string;
    subtitle_en?: string;
    badge?: string;
    badge_en?: string;
    tag?: string;
    tag_en?: string;
    image_url: string;
    link_url?: string;
    button_text?: string;
    button_text_en?: string;
    display_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export default function AdminBannersPage() {
    const { locale } = useLanguage();
    const isEn = locale === 'en';

    const [banners, setBanners] = useState<BannerItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        title_en: '',
        subtitle: '',
        subtitle_en: '',
        badge: '',
        badge_en: '',
        tag: '',
        tag_en: '',
        image_url: '',
        link_url: '#catalogo',
        button_text: 'Ver Productos',
        button_text_en: 'Browse Catalog',
        display_order: 0,
        is_active: true,
    });
    const [uploadingImage, setUploadingImage] = useState(false);

    const fetchBanners = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api.get('/banners') as BannerItem[];
            setBanners(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message || (isEn ? 'Failed to fetch banners' : 'Error al cargar los banners'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    const openCreateModal = () => {
        setEditingBanner(null);
        setFormData({
            title: '',
            title_en: '',
            subtitle: '',
            subtitle_en: '',
            badge: '',
            badge_en: '',
            tag: '',
            tag_en: '',
            image_url: '',
            link_url: '#catalogo',
            button_text: 'Ver Productos',
            button_text_en: 'Browse Catalog',
            display_order: banners.length,
            is_active: true,
        });
        setIsModalOpen(true);
    };

    const openEditModal = (banner: BannerItem) => {
        setEditingBanner(banner);
        setFormData({
            title: banner.title || '',
            title_en: banner.title_en || '',
            subtitle: banner.subtitle || '',
            subtitle_en: banner.subtitle_en || '',
            badge: banner.badge || '',
            badge_en: banner.badge_en || '',
            tag: banner.tag || '',
            tag_en: banner.tag_en || '',
            image_url: banner.image_url || '',
            link_url: banner.link_url || '#catalogo',
            button_text: banner.button_text || 'Ver Productos',
            button_text_en: banner.button_text_en || 'Browse Catalog',
            display_order: banner.display_order ?? 0,
            is_active: banner.is_active ?? true,
        });
        setIsModalOpen(true);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        setError('');
        try {
            const uploadPayload = new FormData();
            uploadPayload.append('file', file);
            const res = await api.upload('/banners/upload', uploadPayload) as { url: string };
            if (res?.url) {
                setFormData(prev => ({ ...prev, image_url: res.url }));
            }
        } catch (err: any) {
            setError(err.message || (isEn ? 'Error uploading image' : 'Error al subir la imagen'));
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            setError(isEn ? 'Title is required' : 'El título es obligatorio');
            return;
        }
        if (!formData.image_url.trim()) {
            setError(isEn ? 'Image is required' : 'La imagen o URL es obligatoria');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            if (editingBanner) {
                const updated = await api.patch(`/banners/${editingBanner.id}`, formData) as BannerItem;
                setBanners(prev => prev.map(b => b.id === updated.id ? updated : b));
                setSuccessMessage(isEn ? 'Banner updated successfully' : 'Banner actualizado con éxito');
            } else {
                const created = await api.post('/banners', formData) as BannerItem;
                setBanners(prev => [...prev, created].sort((a, b) => a.display_order - b.display_order));
                setSuccessMessage(isEn ? 'Banner created successfully' : 'Banner creado con éxito');
            }
            setIsModalOpen(false);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setError(err.message || (isEn ? 'Failed to save banner' : 'Error al guardar el banner'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (banner: BannerItem) => {
        setTogglingId(banner.id);
        try {
            const newActive = !banner.is_active;
            const updated = await api.patch(`/banners/${banner.id}`, { is_active: newActive }) as BannerItem;
            setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: updated.is_active } : b));
        } catch (err: any) {
            setError(err.message || (isEn ? 'Failed to toggle banner' : 'Error al cambiar estado del banner'));
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await api.delete(`/banners/${deleteConfirmId}`);
            setBanners(prev => prev.filter(b => b.id !== deleteConfirmId));
            setDeleteConfirmId(null);
            setSuccessMessage(isEn ? 'Banner deleted' : 'Banner eliminado correctamente');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setError(err.message || (isEn ? 'Failed to delete banner' : 'Error al eliminar el banner'));
        } finally {
            setIsDeleting(false);
        }
    };

    const getImageSrc = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('blob:')) return url;
        return `${API_URL}${url}`;
    };

    return (
        <div className="flex min-h-screen bg-background">
            <AdminSidebar />

            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                                <Sparkles size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-foreground">
                                    {isEn ? 'Seasonal & Hero Banners' : 'Banners de Temporada y Ocasiones'}
                                </h1>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {isEn
                                        ? 'Manage rotational B2B home banners, promotions and holiday campaigns'
                                        : 'Gestiona los banners rotativos del carrusel Home según temporadas y festividades'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchBanners}
                            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground transition-colors"
                            title={isEn ? 'Refresh' : 'Recargar'}
                        >
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20"
                        >
                            <Plus size={16} />
                            <span>{isEn ? 'New Banner' : 'Nuevo Banner'}</span>
                        </button>
                    </div>
                </div>

                {/* Feedback Alerts */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                        <button onClick={() => setError('')} className="p-1 hover:opacity-70"><X size={14} /></button>
                    </div>
                )}
                {successMessage && (
                    <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 size={16} />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Banner list / grid */}
                {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 size={32} className="animate-spin text-primary mb-3" />
                        <p className="text-xs font-medium">{isEn ? 'Loading banners...' : 'Cargando banners...'}</p>
                    </div>
                ) : banners.length === 0 ? (
                    <div className="py-20 text-center bg-card rounded-3xl border border-dashed border-border p-8">
                        <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                            <ImageIcon size={32} />
                        </div>
                        <h3 className="text-base font-bold text-foreground mb-1">
                            {isEn ? 'No custom banners created' : 'No hay banners personalizados creados'}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto mb-6">
                            {isEn
                                ? 'The Home page is currently using the 4 default gourmet seasonal slides. Create your first custom banner now!'
                                : 'La Home está utilizando actualmente los 4 slides gourmet por defecto. ¡Crea tu primer banner de campaña ahora!'}
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity inline-flex items-center gap-2"
                        >
                            <Plus size={16} />
                            <span>{isEn ? 'Create First Banner' : 'Crear Primer Banner'}</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {banners.map((banner) => (
                            <div
                                key={banner.id}
                                className={`group bg-card rounded-3xl border overflow-hidden transition-all duration-300 flex flex-col ${
                                    banner.is_active
                                        ? 'border-border shadow-sm hover:shadow-xl hover:border-primary/40'
                                        : 'border-border/50 opacity-75 bg-muted/20'
                                }`}
                            >
                                {/* Banner Image Preview */}
                                <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                                    {banner.image_url ? (
                                        <img
                                            src={getImageSrc(banner.image_url)}
                                            alt={banner.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-700">
                                            <ImageIcon size={40} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                    {/* Badges on preview */}
                                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center">
                                        {banner.badge && (
                                            <span className="px-2.5 py-0.5 rounded-full bg-primary/90 text-white text-[10px] font-black uppercase tracking-wider shadow">
                                                {banner.badge}
                                            </span>
                                        )}
                                        {banner.tag && (
                                            <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-amber-300 text-[10px] font-bold">
                                                {banner.tag}
                                            </span>
                                        )}
                                    </div>

                                    {/* Order pill */}
                                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-black border border-white/20">
                                        #{banner.display_order}
                                    </div>

                                    {/* Title preview in image overlay */}
                                    <div className="absolute bottom-3 left-3 right-3 text-white">
                                        <p className="text-xs font-semibold text-white/70 line-clamp-1">
                                            {banner.subtitle || banner.subtitle_en || ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h3 className="font-black text-sm text-foreground line-clamp-1">
                                                {banner.title}
                                            </h3>
                                        </div>
                                        {banner.title_en && (
                                            <p className="text-xs text-muted-foreground font-medium mb-2 line-clamp-1">
                                                EN: {banner.title_en}
                                            </p>
                                        )}
                                        {banner.subtitle && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                                                {banner.subtitle}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 mb-4">
                                            <ExternalLink size={12} />
                                            <span className="truncate">{banner.link_url || '#catalogo'}</span>
                                        </div>
                                    </div>

                                    {/* Footer actions */}
                                    <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
                                        {/* Active Toggle Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleActive(banner)}
                                            disabled={togglingId === banner.id}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                banner.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                            }`}
                                        >
                                            {togglingId === banner.id ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : banner.is_active ? (
                                                <Eye size={12} />
                                            ) : (
                                                <EyeOff size={12} />
                                            )}
                                            <span>
                                                {banner.is_active
                                                    ? (isEn ? 'Active' : 'Activo')
                                                    : (isEn ? 'Paused' : 'Pausado')}
                                            </span>
                                        </button>

                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(banner)}
                                                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                title={isEn ? 'Edit' : 'Editar'}
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirmId(banner.id)}
                                                className="p-2 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                                                title={isEn ? 'Delete' : 'Eliminar'}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Create / Edit */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                        <Sparkles size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-foreground">
                                            {editingBanner
                                                ? (isEn ? 'Edit Seasonal Banner' : 'Editar Banner de Temporada')
                                                : (isEn ? 'New Seasonal Banner' : 'Nuevo Banner de Temporada')}
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            {isEn
                                                ? 'Configure image, occasion tags, and CTA link'
                                                : 'Configura imagen, textos de campaña y enlace de destino'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                                {/* Image upload / URL */}
                                <div>
                                    <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                                        {isEn ? 'Banner Image (Upload or URL) *' : 'Imagen del Banner (Subir o URL) *'}
                                    </label>

                                    {/* Preview container */}
                                    {formData.image_url && (
                                        <div className="mb-3 relative h-40 w-full rounded-2xl overflow-hidden bg-slate-900 border border-border">
                                            <img
                                                src={getImageSrc(formData.image_url)}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white hover:bg-black"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            required
                                            value={formData.image_url}
                                            onChange={e => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                                            placeholder="/uploads/banners/... or https://..."
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        <label className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors border border-border">
                                            {uploadingImage ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Upload size={14} />
                                            )}
                                            <span>{isEn ? 'Upload' : 'Subir'}</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                disabled={uploadingImage}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Titles (ES & EN) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Main Title (ES) *' : 'Título Principal (ES) *'}
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.title}
                                            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="ej. Especial de Navidad"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Main Title (EN)' : 'Título Principal (EN)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.title_en}
                                            onChange={e => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                                            placeholder="e.g. Christmas Special"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Badges & Taglines */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Occasion Badge (ES)' : 'Badge de Ocasión (ES)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.badge}
                                            onChange={e => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                                            placeholder="ej. Temporada, Bestseller"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Occasion Badge (EN)' : 'Badge de Ocasión (EN)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.badge_en}
                                            onChange={e => setFormData(prev => ({ ...prev, badge_en: e.target.value }))}
                                            placeholder="e.g. Seasonal, Bestseller"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Subheading / Tagline (ES)' : 'Cintillo / Tagline (ES)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.tag}
                                            onChange={e => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                                            placeholder="ej. Bollería Francesa Artesanal"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Subheading / Tagline (EN)' : 'Cintillo / Tagline (EN)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.tag_en}
                                            onChange={e => setFormData(prev => ({ ...prev, tag_en: e.target.value }))}
                                            placeholder="e.g. Artisanal French Pastry"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Descriptions / Subtitles */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Description (ES)' : 'Descripción Comercial (ES)'}
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={formData.subtitle}
                                            onChange={e => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                                            placeholder="Descripción atractiva para el carrusel..."
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Description (EN)' : 'Descripción Comercial (EN)'}
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={formData.subtitle_en}
                                            onChange={e => setFormData(prev => ({ ...prev, subtitle_en: e.target.value }))}
                                            placeholder="Commercial description for hero carousel..."
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Link & Button Text */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Target Link URL' : 'Enlace de Destino (URL)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.link_url}
                                            onChange={e => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                                            placeholder="#catalogo or /catalog/category/panes"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Button Text (ES)' : 'Texto de Botón (ES)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.button_text}
                                            onChange={e => setFormData(prev => ({ ...prev, button_text: e.target.value }))}
                                            placeholder="Ver Productos"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Button Text (EN)' : 'Texto de Botón (EN)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.button_text_en}
                                            onChange={e => setFormData(prev => ({ ...prev, button_text_en: e.target.value }))}
                                            placeholder="Browse Catalog"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Order & Active Checkbox */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">
                                            {isEn ? 'Rotation Order (0, 1, 2...)' : 'Orden de Rotación (0, 1, 2...)'}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.display_order}
                                            onChange={e => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value, 10) || 0 }))}
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 pt-6">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </label>
                                        <span className="text-xs font-bold text-foreground">
                                            {isEn ? 'Banner is Active in Home' : 'Banner Activo en la Home'}
                                        </span>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="pt-6 border-t border-border flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-5 py-2.5 rounded-xl border border-border text-foreground font-bold text-xs hover:bg-muted transition-colors"
                                    >
                                        {isEn ? 'Cancel' : 'Cancelar'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity inline-flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isSaving && <Loader2 size={14} className="animate-spin" />}
                                        <span>
                                            {editingBanner
                                                ? (isEn ? 'Save Changes' : 'Guardar Cambios')
                                                : (isEn ? 'Create Banner' : 'Crear Banner')}
                                        </span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Confirm Delete */}
                {deleteConfirmId !== null && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-card w-full max-w-sm rounded-3xl border border-border p-6 shadow-2xl text-center">
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-base font-black text-foreground mb-1">
                                {isEn ? 'Delete Banner?' : '¿Eliminar Banner?'}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-6">
                                {isEn
                                    ? 'This action cannot be undone. The banner will be permanently removed.'
                                    : 'Esta acción no se puede deshacer. El banner se eliminará de forma permanente.'}
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-4 py-2.5 rounded-xl border border-border text-foreground font-bold text-xs hover:bg-muted"
                                >
                                    {isEn ? 'Cancel' : 'Cancelar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-colors inline-flex items-center gap-2"
                                >
                                    {isDeleting && <Loader2 size={14} className="animate-spin" />}
                                    <span>{isEn ? 'Yes, Delete' : 'Sí, Eliminar'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
