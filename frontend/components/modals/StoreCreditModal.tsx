'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Loader2,
  Trash2,
  ExternalLink,
  Package,
  ZoomIn,
  ShieldCheck,
  Tag,
  DollarSign,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import {
  formatVoucherCode,
  calculateCompensationAmount,
  calculateMaxAllowedCompensation,
  validateStoreCreditIssuance,
  formatStoreCreditBalance,
  StoreCreditIncident,
} from '@/lib/store-credit-helper';
import { INCIDENT_REASONS } from '@/lib/incident-validation';

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
    image?: string;
    price?: number;
  };
}

export interface StoreCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Modo 1: Revisión y aprobación de una incidencia existente
  incident?: StoreCreditIncident | null;
  // Modo 2: Emisión nueva de Store Credit para una orden
  orderId?: string;
  orderNumber?: string;
  userId?: string;
  userName?: string;
  orderTotal?: number;
  alreadyCreditedAmount?: number;
  items?: OrderItemOption[];
  // Modo 3: Emisión directa a cliente
  currentClientBalance?: number;
  onSuccess?: (result: {
    incident?: any;
    newBalance?: number;
    amountCredited: number;
    message?: string;
  }) => void;
}

export default function StoreCreditModal({
  isOpen,
  onClose,
  incident,
  orderId,
  orderNumber,
  userId,
  userName,
  orderTotal,
  alreadyCreditedAmount = 0,
  items = [],
  currentClientBalance = 0,
  onSuccess,
}: StoreCreditModalProps) {
  // Estado local para creación/emisión
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [useCustomAmount, setUseCustomAmount] = useState<boolean>(false);
  const [reasonCategory, setReasonCategory] = useState<string>('transit_damage');
  const [description, setDescription] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<boolean>(false);

  // Estados de proceso y feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Determinar si estamos en modo revisión de incidencia existente
  const isReviewMode = Boolean(incident && incident.id);

  // Inicializar estado cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setZoomPhoto(false);

    if (incident) {
      // Modo revisión
      setSelectedProductId(incident.product_id);
      setQuantity(incident.quantity);
      setCustomAmount(String(incident.amount));
      setReasonCategory(incident.reason_category || 'transit_damage');
      setDescription(incident.description || '');
      setPhotoPreview(incident.photo_url || null);
    } else {
      // Modo emisión
      if (items && items.length > 0) {
        const first = items[0];
        const pId = Number(first.product_id ?? first.productId ?? first.product?.id);
        setSelectedProductId(!isNaN(pId) ? pId : '');
        setQuantity(1);
      } else {
        setSelectedProductId('');
        setQuantity(1);
      }
      setUseCustomAmount(false);
      setCustomAmount('');
      setReasonCategory(INCIDENT_REASONS[0]?.id || 'transit_damage');
      setDescription('');
      setPhotoPreview(null);
    }
  }, [isOpen, incident, items]);

  // Ítem seleccionado en la orden
  const selectedItem = useMemo(() => {
    if (!items || items.length === 0) return null;
    return items.find((item) => {
      const pId = Number(item.product_id ?? item.productId ?? item.product?.id);
      return pId === Number(selectedProductId);
    }) || null;
  }, [items, selectedProductId]);

  const maxQuantity = selectedItem ? Number(selectedItem.quantity) || 1 : 100;
  const unitPrice = selectedItem
    ? Number(selectedItem.price_at_time ?? selectedItem.product?.price ?? 0)
    : 0;

  // Monto compensatorio calculado automáticamente
  const autoAmount = useMemo(() => {
    if (isReviewMode && incident) {
      return Number(incident.amount) || 0;
    }
    if (selectedItem && unitPrice > 0) {
      try {
        return calculateCompensationAmount(quantity, unitPrice);
      } catch {
        return 0;
      }
    }
    return 0;
  }, [isReviewMode, incident, selectedItem, unitPrice, quantity]);

  const activeAmount = useCustomAmount && customAmount !== '' ? parseFloat(customAmount) || 0 : autoAmount;

  const maxAllowedComp = useMemo(() => {
    if (orderTotal !== undefined && orderTotal !== null) {
      return calculateMaxAllowedCompensation(orderTotal, alreadyCreditedAmount);
    }
    return 999999;
  }, [orderTotal, alreadyCreditedAmount]);

  if (!isOpen) return null;

  // Manejo de carga de foto
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('El archivo seleccionado debe ser una imagen válida (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage('Error al leer la imagen de evidencia');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Resolver URL de foto para visualización
  const resolveEvidenceUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const cleanApi = API_URL ? API_URL.replace(/\/+$/, '') : '';
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${cleanApi}${cleanPath}`;
  };

  const currentPhotoDisplay = resolveEvidenceUrl(photoPreview || incident?.photo_url);

  // Aprobación o Emisión
  const handleApproveOrIssue = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (isReviewMode && incident) {
        // MODO A: Aprobación de incidencia existente
        // Llama a PATCH /orders/incidents/:id/approve
        const approvedIncident = (await api.patch(
          `/orders/incidents/${incident.id}/approve`,
          {},
        )) as any;

        const creditedAmt = Number(approvedIncident.amount || incident.amount || 0);
        setSuccessMessage(`✅ Incidencia ${incident.voucher_code} aprobada. Se acreditaron $${creditedAmt.toFixed(2)} al saldo.`);

        if (onSuccess) {
          onSuccess({
            incident: approvedIncident,
            amountCredited: creditedAmt,
            message: `Store Credit ${incident.voucher_code} acreditado con éxito`,
          });
        }

        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // MODO B: Emisión de saldo a favor para una orden
        if (!orderId && !userId) {
          throw new Error('Se requiere el ID de la orden o del cliente para emitir el saldo a favor');
        }

        const prodId = Number(selectedProductId);
        if (orderId && isNaN(prodId)) {
          throw new Error('Debe seleccionar el producto afectado de la orden');
        }

        const finalAmount = Math.round((activeAmount + Number.EPSILON) * 100) / 100;
        if (finalAmount <= 0) {
          throw new Error('El monto compensatorio debe ser mayor a $0.00');
        }

        if (orderTotal !== undefined && finalAmount > maxAllowedComp) {
          throw new Error(
            `El monto ($${finalAmount.toFixed(2)}) supera el saldo compensable máximo ($${maxAllowedComp.toFixed(2)})`,
          );
        }

        if (orderId) {
          // 1. Crear incidencia de Store Credit en backend
          const createdIncident = (await api.post(`/orders/${orderId}/incidents`, {
            order_id: orderId,
            user_id: userId,
            product_id: prodId,
            quantity: quantity > 0 ? quantity : 1,
            amount: finalAmount,
            reason_category: reasonCategory,
            description: description.trim() || 'Emisión administrativa de saldo a favor',
            photo_url: photoPreview || null,
          })) as any;

          // 2. Aprobar inmediatamente la incidencia para acreditar atómicamente a user.credit_balance
          let finalApproved = createdIncident;
          if (createdIncident && createdIncident.id && createdIncident.status !== 'approved') {
            finalApproved = await api.patch(`/orders/incidents/${createdIncident.id}/approve`, {});
          }

          const voucherCode = finalApproved.voucher_code || createdIncident.voucher_code || 'SC-EMITIDO';
          setSuccessMessage(
            `✅ Saldo a favor emitido exitosamente [${voucherCode}] por $${finalAmount.toFixed(2)}`,
          );

          if (onSuccess) {
            onSuccess({
              incident: finalApproved,
              amountCredited: finalAmount,
              message: `Store Credit ${voucherCode} emitido y acreditado`,
            });
          }

          setTimeout(() => {
            onClose();
          }, 1200);
        } else if (userId) {
          // Emisión directa a cliente sin orden específica
          const newBal = Math.round(((Number(currentClientBalance) || 0) + finalAmount + Number.EPSILON) * 100) / 100;
          await api.patch(`/users/${userId}`, {
            credit_balance: newBal,
          });

          setSuccessMessage(`✅ Saldo acreditado directamente. Nuevo balance: $${newBal.toFixed(2)}`);

          if (onSuccess) {
            onSuccess({
              newBalance: newBal,
              amountCredited: finalAmount,
              message: `Saldo a favor acreditado al cliente`,
            });
          }

          setTimeout(() => {
            onClose();
          }, 1200);
        }
      }
    } catch (err: any) {
      console.error('Error al emitir/aprobar saldo a favor:', err);
      setErrorMessage(err.message || 'Error al procesar la emisión de saldo a favor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyApproved = isReviewMode && incident?.status === 'approved';

  return (
    <div
      data-testid="store-credit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <CreditCard size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white tracking-tight">
                  {isReviewMode ? 'Revisión de Incidencia y Saldo' : 'Emitir Saldo a Favor (Store Credit)'}
                </h3>
                {incident?.voucher_code && (
                  <span
                    data-testid="modal-voucher-code-badge"
                    className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-300 border border-amber-400/40"
                  >
                    {incident.voucher_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {orderNumber || orderId ? `Orden #${(orderNumber || orderId)!.slice(0, 8)}` : ''}
                {userName ? ` • Cliente: ${userName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-store-credit-modal-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          {/* Mensajes de Alerta */}
          {errorMessage && (
            <div
              data-testid="store-credit-error-alert"
              className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs font-semibold"
            >
              <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              data-testid="store-credit-success-alert"
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-xs font-semibold"
            >
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Banner de Estado si ya está aprobado */}
          {isAlreadyApproved && (
            <div
              data-testid="already-approved-banner"
              className="p-4 bg-emerald-500/10 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider">Incidencia Aprobada</p>
                  <p className="text-[11px] text-emerald-700">
                    Monto compensado: <strong className="font-black">${Number(incident?.amount).toFixed(2)}</strong> acreditado a `user.credit_balance`
                    {incident?.reviewed_by ? ` (Revisado por: ${incident.reviewed_by})` : ''}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                ACREDITADO
              </span>
            </div>
          )}

          {/* Sección 1: Evidencia Fotográfica (Chofer / Cliente) */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Evidencia Fotográfica de Entrega</span>
              {currentPhotoDisplay && (
                <span className="text-[10px] text-blue-600 font-bold lowercase flex items-center gap-1">
                  <ShieldCheck size={12} /> Foto verificable
                </span>
              )}
            </label>

            {currentPhotoDisplay ? (
              <div
                data-testid="photo-evidence-container"
                className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 group"
              >
                <img
                  src={currentPhotoDisplay}
                  alt="Evidencia fotográfica de incidencia"
                  className="w-full max-h-56 object-contain rounded-2xl transition-all"
                />
                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    data-testid="zoom-photo-btn"
                    onClick={() => setZoomPhoto(true)}
                    className="p-2.5 bg-white text-slate-800 rounded-xl shadow-lg hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95"
                  >
                    <ZoomIn size={14} /> Ampliar Foto
                  </button>
                  <a
                    href={currentPhotoDisplay}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-white text-blue-600 rounded-xl shadow-lg hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95"
                  >
                    <ExternalLink size={14} /> Abrir Externa
                  </a>
                  {!isReviewMode && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="p-2.5 bg-rose-600 text-white rounded-xl shadow-lg hover:bg-rose-700 text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95"
                    >
                      <Trash2 size={14} /> Quitar
                    </button>
                  )}
                </div>
              </div>
            ) : !isReviewMode ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/40 rounded-2xl text-center cursor-pointer transition-all"
              >
                <UploadCloud size={28} className="mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-700">Subir foto de evidencia (chofer / cliente)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Formatos JPG, PNG, WebP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium italic">
                Sin fotografía adjunta registrada en esta incidencia.
              </div>
            )}
          </div>

          {/* Modal de Zoom de Foto */}
          {zoomPhoto && currentPhotoDisplay && (
            <div
              className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
              onClick={() => setZoomPhoto(false)}
            >
              <div className="relative max-w-4xl max-h-[90vh]">
                <img
                  src={currentPhotoDisplay}
                  alt="Zoom evidencia fotográfica"
                  className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                />
                <button
                  type="button"
                  onClick={() => setZoomPhoto(false)}
                  className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Sección 2: Selector de Producto y Cantidad */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Package size={14} className="text-slate-400" />
                <span>Producto Afectado</span>
              </label>
              {isReviewMode ? (
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 font-bold text-slate-800 text-xs">
                  {incident?.product_name || `Producto ID #${incident?.product_id}`}
                </div>
              ) : items && items.length > 0 ? (
                <select
                  data-testid="product-select"
                  value={selectedProductId}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSelectedProductId(isNaN(val) ? '' : val);
                    setQuantity(1);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  <option value="">Seleccione un producto...</option>
                  {items.map((item) => {
                    const pId = Number(item.product_id ?? item.productId ?? item.product?.id);
                    const name = item.product?.name || `Producto #${pId}`;
                    const price = Number(item.price_at_time ?? item.product?.price ?? 0);
                    return (
                      <option key={pId} value={pId}>
                        {name} — {item.quantity} un. (${price.toFixed(2)} c/u)
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="number"
                  placeholder="ID del Producto"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value) || '')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Cantidad ({isReviewMode ? 'Afectada' : `Máx: ${maxQuantity}`})
              </label>
              {isReviewMode ? (
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 font-black text-slate-800 text-xs text-center">
                  {incident?.quantity} un.
                </div>
              ) : (
                <input
                  type="number"
                  data-testid="quantity-input"
                  min={1}
                  max={maxQuantity}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val)) setQuantity(1);
                    else if (val > maxQuantity) setQuantity(maxQuantity);
                    else if (val < 1) setQuantity(1);
                    else setQuantity(val);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 text-xs text-center focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              )}
            </div>
          </div>

          {/* Sección 3: Motivo de Incidencia */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Tag size={14} className="text-slate-400" />
              <span>Motivo de la Incidencia</span>
            </label>
            {isReviewMode ? (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium text-slate-800">
                {incident?.reason_category === 'missing_kitchen' && 'Faltante en entrega (Cocina)'}
                {incident?.reason_category === 'transit_damage' && 'Producto quebrado / aplastado en transporte'}
                {incident?.reason_category === 'quality_defect' && 'Problema de calidad / horneado'}
                {incident?.reason_category === 'wrong_item' && 'Producto incorrecto entregado'}
                {!['missing_kitchen', 'transit_damage', 'quality_defect', 'wrong_item'].includes(incident?.reason_category || '') &&
                  (incident?.reason_category || 'Otro motivo administrativo')}
              </div>
            ) : (
              <select
                data-testid="reason-category-select"
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
              >
                {INCIDENT_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} — {r.description}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sección 4: Monto Compensatorio Calculado Automáticamente */}
          <div
            data-testid="calculated-amount-section"
            className="p-5 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border border-amber-200/80 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-sm">
                  <DollarSign size={18} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Monto Compensatorio a Acreditar
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Calculado automáticamente:{' '}
                    <span className="font-bold">
                      {quantity} un. × ${unitPrice.toFixed(2)}
                    </span>
                    {orderTotal ? ` (Tope orden: $${maxAllowedComp.toFixed(2)})` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span
                  data-testid="display-compensation-amount"
                  className="text-2xl font-black text-slate-900 tracking-tight"
                >
                  {formatStoreCreditBalance(activeAmount)}
                </span>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  Store Credit (SC)
                </p>
              </div>
            </div>

            {!isReviewMode && (
              <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-semibold text-[11px]">
                  <input
                    type="checkbox"
                    checked={useCustomAmount}
                    onChange={(e) => setUseCustomAmount(e.target.checked)}
                    className="w-4 h-4 rounded-md text-amber-600 border-slate-300 focus:ring-amber-500"
                  />
                  <span>Ajustar monto manualmente</span>
                </label>
                {useCustomAmount && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={maxAllowedComp}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={autoAmount.toFixed(2)}
                      className="w-28 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right outline-hidden"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sección 5: Descripción / Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" />
              <span>Notas Administrativas / Descripción</span>
            </label>
            {isReviewMode ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium italic">
                {incident?.description || 'Sin notas adicionales provistas.'}
              </div>
            ) : (
              <textarea
                data-testid="incident-description-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle o justificación de la compensación comercial..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            )}
          </div>
        </div>

        {/* Pie del Modal con Acciones */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-wider border border-slate-200 transition-colors disabled:opacity-50"
          >
            {isAlreadyApproved ? 'Cerrar' : 'Cancelar'}
          </button>

          {!isAlreadyApproved && (
            <button
              type="button"
              data-testid="approve-and-credit-btn"
              onClick={handleApproveOrIssue}
              disabled={isSubmitting || activeAmount <= 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Aprobar y Acreditar Saldo a Favor</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
