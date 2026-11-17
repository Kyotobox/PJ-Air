'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  Loader2,
  Trash2,
  Camera,
  Package,
  HelpCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  INCIDENT_REASONS,
  validateIncidentPayload,
  isPhotoRequiredForReason,
  isWithinReportingWindow,
} from '@/lib/incident-validation';

export interface OrderItemOption {
  id?: number | string;
  product_id?: number;
  productId?: number;
  quantity: number;
  price_at_time?: number;
  product?: {
    id: number;
    name: string;
    image_url?: string;
    price?: number;
  };
}

export interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  deliveryDate?: string | Date;
  items: OrderItemOption[];
  onSuccess?: (incident: any) => void;
  locale?: string;
}

export default function ReportIncidentModal({
  isOpen,
  onClose,
  orderId,
  deliveryDate,
  items,
  onSuccess,
  locale = 'es',
}: ReportIncidentModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reasonCategory, setReasonCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inicializar o resetear cuando abre el modal
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessToast(null);
      setDescription('');
      setPhotoPreview(null);
      if (items && items.length > 0) {
        const firstItem = items[0];
        const firstId = Number(firstItem.product_id ?? firstItem.productId ?? firstItem.product?.id);
        setSelectedProductId(!isNaN(firstId) ? firstId : '');
        setQuantity(1);
      } else {
        setSelectedProductId('');
        setQuantity(1);
      }
      setReasonCategory(INCIDENT_REASONS[0].id);
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  // Buscar ítem seleccionado
  const selectedItem = items.find((item) => {
    const pId = Number(item.product_id ?? item.productId ?? item.product?.id);
    return pId === Number(selectedProductId);
  });

  const maxQuantity = selectedItem ? Number(selectedItem.quantity) || 1 : 1;
  const isPhotoRequired = isPhotoRequiredForReason(reasonCategory);

  // Verificación preventiva de ventana horaria
  const isWindowActive = deliveryDate ? isWithinReportingWindow(deliveryDate) : true;

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    setSelectedProductId(isNaN(val) ? '' : val);
    setQuantity(1);
    setErrorMessage(null);
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setQuantity(1);
      return;
    }
    // Límite máximo = cantidad ordenada
    if (val > maxQuantity) {
      setQuantity(maxQuantity);
    } else if (val < 1) {
      setQuantity(1);
    } else {
      setQuantity(val);
    }
    setErrorMessage(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage(
        locale === 'en'
          ? 'Selected file must be an image'
          : 'El archivo seleccionado debe ser una imagen válida (JPG, PNG)',
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage(
        locale === 'en'
          ? 'Error reading photo file'
          : 'Error al leer el archivo de la fotografía',
      );
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const prodIdNum = Number(selectedProductId);
    const validation = validateIncidentPayload({
      productId: prodIdNum,
      quantity,
      maxQuantity,
      reason: reasonCategory,
      photoRequired: isPhotoRequired,
      hasPhoto: Boolean(photoPreview),
    });

    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Error en el formulario de incidencia');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        product_id: prodIdNum,
        quantity,
        reason_category: reasonCategory,
        description: description.trim() || undefined,
        photo_url: photoPreview || undefined,
      };

      const response = await api.post(`/orders/${orderId}/incidents`, payload) as any;

      const toastMessage =
        locale === 'en'
          ? 'Report received. It will be evaluated to credit your Store Credit balance.'
          : 'Reporte recibido. Se evaluará para acreditar tu Saldo a Favor (Store Credit)';

      setSuccessToast(toastMessage);

      if (onSuccess) {
        onSuccess(response);
      }

      // Cerrar modal automáticamente después de mostrar el Toast de confirmación
      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: any) {
      console.error('Error reporting incident:', err);
      setErrorMessage(
        err.message ||
          (locale === 'en'
            ? 'Failed to register incident report. Please try again.'
            : 'Error al registrar la incidencia. Por favor intenta de nuevo.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 relative my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón de cierre */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar modal"
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {locale === 'en' ? 'Report Delivery Incident' : 'Reportar Faltante o Daño'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {locale === 'en'
                ? 'Request store credit for missing or damaged products in this delivery'
                : 'Solicita Saldo a Favor por productos faltantes o dañados en esta entrega'}
            </p>
          </div>
        </div>

        {/* Alerta de ventana horaria si aplica */}
        {!isWindowActive && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {locale === 'en'
                  ? 'Reporting window closed (10:00 AM limit)'
                  : 'Ventana de reporte finalizada (Límite 10:00 AM)'}
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                {locale === 'en'
                  ? 'Delivery incidents for overnight unattended drops must be reported before 10:00 AM of delivery day.'
                  : 'Para entregas de madrugada, las incidencias deben reportarse antes de las 10:00 AM del día de entrega.'}
              </p>
            </div>
          </div>
        )}

        {/* Toast Flotante de Éxito dentro del Modal */}
        {successToast && (
          <div
            data-testid="incident-success-toast"
            className="mb-6 p-4 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-3 shadow-lg shadow-emerald-600/30 animate-in fade-in slide-in-from-top-2"
          >
            <CheckCircle2 size={20} className="shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            data-testid="incident-error-alert"
            className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-center gap-2.5 animate-in fade-in"
          >
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selector de Producto Afectado */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              {locale === 'en' ? 'Affected Product' : 'Producto Afectado'} *
            </label>
            <select
              data-testid="incident-product-select"
              value={selectedProductId}
              onChange={handleProductChange}
              disabled={isSubmitting || Boolean(successToast)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="">
                {locale === 'en' ? '-- Select a product --' : '-- Selecciona un producto --'}
              </option>
              {items.map((item, idx) => {
                const prodId = Number(item.product_id ?? item.productId ?? item.product?.id);
                const name = item.product?.name || `Producto #${prodId}`;
                const qty = item.quantity;
                return (
                  <option key={`${prodId}-${idx}`} value={prodId}>
                    {qty}x {name} (Entregados: {qty})
                  </option>
                );
              })}
            </select>

            {/* Vista previa del producto seleccionado */}
            {selectedItem && (
              <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs">
                {selectedItem.product?.image_url ? (
                  <img
                    src={selectedItem.product.image_url}
                    alt={selectedItem.product.name}
                    className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                    <Package size={18} />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900">
                    {selectedItem.product?.name || `Producto #${selectedProductId}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {locale === 'en' ? 'Ordered quantity:' : 'Cantidad ordenada:'}{' '}
                    <span className="font-black text-slate-800">{selectedItem.quantity} unid.</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Cantidad Afectada */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {locale === 'en' ? 'Affected Quantity' : 'Cantidad Afectada'} *
              </label>
              <span className="text-[11px] text-muted-foreground">
                {locale === 'en' ? 'Max:' : 'Máximo permitido:'}{' '}
                <strong className="text-slate-900">{maxQuantity}</strong>
              </span>
            </div>
            <input
              type="number"
              data-testid="incident-quantity-input"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={handleQuantityChange}
              disabled={isSubmitting || Boolean(successToast)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Selector de Motivo */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              {locale === 'en' ? 'Reason for Incident' : 'Motivo del Reporte'} *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INCIDENT_REASONS.map((r) => {
                const isSelected = reasonCategory === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    data-testid={`incident-reason-${r.id}`}
                    onClick={() => {
                      setReasonCategory(r.id);
                      setErrorMessage(null);
                    }}
                    disabled={isSubmitting || Boolean(successToast)}
                    className={`p-3 text-left rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm ring-1 ring-primary'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span>{locale === 'en' ? r.labelEn : r.label}</span>
                      {r.requiresPhoto && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                          Foto req.
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{r.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subida de Fotografía de Evidencia */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Camera size={14} className="text-slate-600" />
                {locale === 'en' ? 'Photo Evidence' : 'Fotografía de Evidencia'}
                {isPhotoRequired && <span className="text-rose-600">*</span>}
              </label>
              {isPhotoRequired ? (
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                  {locale === 'en' ? 'Mandatory for this reason' : 'Obligatoria para este motivo'}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">
                  {locale === 'en' ? 'Optional' : 'Opcional'}
                </span>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
              data-testid="incident-photo-file-input"
            />

            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 group">
                <img
                  src={photoPreview}
                  alt="Vista previa de evidencia"
                  className="w-full h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-xl shadow-md hover:bg-rose-700 transition-all"
                  title={locale === 'en' ? 'Remove photo' : 'Eliminar foto'}
                >
                  <Trash2 size={16} />
                </button>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  {locale === 'en' ? 'Evidence photo attached' : 'Foto adjunta correctamente'}
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isPhotoRequired
                    ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <UploadCloud
                  size={32}
                  className={isPhotoRequired ? 'text-amber-600 mb-2' : 'text-slate-400 mb-2'}
                />
                <p className="text-xs font-bold text-slate-700">
                  {locale === 'en' ? 'Click to upload photo' : 'Haz clic para subir fotografía'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">PNG, JPG o WEBP (máx. 10MB)</p>
              </div>
            )}
          </div>

          {/* Descripción opcional */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              {locale === 'en' ? 'Additional Notes (Optional)' : 'Notas Adicionales (Opcional)'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting || Boolean(successToast)}
              placeholder={
                locale === 'en'
                  ? 'Describe details of what was found upon reception...'
                  : 'Describe detalles de lo ocurrido al recibir la mercadería...'
              }
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              {locale === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              data-testid="submit-incident-btn"
              disabled={isSubmitting || Boolean(successToast)}
              className="w-2/3 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-600/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{locale === 'en' ? 'Submitting...' : 'Enviando...'}</span>
                </>
              ) : (
                <span>
                  {locale === 'en' ? 'Submit Incident Report' : 'Enviar Reporte de Incidencia'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
