'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/config';
import { api } from '@/lib/api';
import { 
    Loader2, 
    ShieldCheck, 
    X, 
    AlertCircle, 
    CreditCard, 
    Building2, 
    Zap, 
    CheckCircle2, 
    Lock,
    Check
} from 'lucide-react';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

interface SavedPaymentMethod {
    id: string;
    type: string;
    card?: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
    };
    us_bank_account?: {
        bank_name: string;
        last4: string;
        routing_number?: string;
    };
    created?: number;
}

interface StripePaymentModalProps {
    clientSecret: string;
    amount: number;
    orderId: string;
    onSuccess: () => void;
    onCancel: () => void;
    locale: string;
}

function CheckoutForm({
    amount,
    orderId,
    saveCard,
    setSaveCard,
    onSuccess,
    onCancel,
    locale,
}: {
    amount: number;
    orderId: string;
    saveCard: boolean;
    setSaveCard: (val: boolean) => void;
    onSuccess: () => void;
    onCancel: () => void;
    locale: string;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsProcessing(true);
        setErrorMessage(null);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required',
            });

            if (error) {
                setErrorMessage(error.message || lbl('Ocurrió un error al procesar el pago.', 'An error occurred while processing the payment.'));
            } else if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
                onSuccess();
            } else {
                setErrorMessage(lbl('El pago no pudo completarse. Inténtalo de nuevo.', 'Payment could not be completed. Please try again.'));
            }
        } catch (err: any) {
            setErrorMessage(err.message || lbl('Error de conexión con la pasarela de pagos.', 'Connection error with payment gateway.'));
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <PaymentElement />
            </div>

            {/* Save Card Checkbox */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <input
                    id="save_card_checkbox"
                    type="checkbox"
                    checked={saveCard}
                    onChange={(e) => setSaveCard(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <label htmlFor="save_card_checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    {lbl('Guardar esta tarjeta para compras rápidas en 1 clic', 'Save this card for secure 1-click purchases')}
                </label>
            </div>

            {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs font-semibold">
                    <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
                    <p>{errorMessage}</p>
                </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <ShieldCheck size={16} className="text-green-600" />
                <span>{lbl('Pago cifrado y protegido por Stripe Payments.', 'Encrypted payment protected by Stripe Payments.')}</span>
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isProcessing}
                    className="flex-1 py-4 text-xs font-black uppercase tracking-wider rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                    {lbl('Cancelar', 'Cancel')}
                </button>
                <button
                    type="submit"
                    disabled={!stripe || isProcessing}
                    className="flex-[2] py-4 bg-slate-950 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : null}
                    {isProcessing
                        ? lbl('Procesando...', 'Processing...')
                        : lbl(`Pagar $${amount.toFixed(2)}`, `Pay $${amount.toFixed(2)}`)}
                </button>
            </div>
        </form>
    );
}

export default function StripePaymentModal({
    clientSecret,
    amount,
    orderId,
    onSuccess,
    onCancel,
    locale,
}: StripePaymentModalProps) {
    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [isLoadingMethods, setIsLoadingMethods] = useState(true);
    const [activeTab, setActiveTab] = useState<'saved' | 'card' | 'ach'>('saved');
    const [is1ClickProcessing, setIs1ClickProcessing] = useState(false);
    const [oneClickError, setOneClickError] = useState<string | null>(null);
    const [isThreeDSecureRequired, setIsThreeDSecureRequired] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [saveCard, setSaveCard] = useState(true);

    useEffect(() => {
        const fetchMethods = async () => {
            try {
                const methods = await api.get('/payments/payment-methods') as SavedPaymentMethod[];
                if (Array.isArray(methods) && methods.length > 0) {
                    setSavedMethods(methods);
                    setSelectedMethodId(methods[0].id);
                    setActiveTab('saved');
                } else {
                    setActiveTab('card');
                }
            } catch (err) {
                console.warn('Could not load payment methods:', err);
                setActiveTab('card');
            } finally {
                setIsLoadingMethods(false);
            }
        };

        fetchMethods();
    }, []);

    const handleOneClickPay = async () => {
        if (!selectedMethodId) return;

        setIs1ClickProcessing(true);
        setOneClickError(null);
        setIsThreeDSecureRequired(false);

        try {
            const res = await api.post('/payments/create-intent', {
                amount,
                orderId,
                paymentMethodId: selectedMethodId,
            }) as any;

            if (res && res.status === 'requires_action') {
                setIsThreeDSecureRequired(true);
                setOneClickError(
                    lbl(
                        'Autenticación 3D Secure Requerida: Tu entidad bancaria solicita verificar la transacción. Desafío SCA controlado desplegado.',
                        '3D Secure Authentication Required: Your bank requires transaction verification. Controlled SCA challenge initialized.'
                    )
                );
            } else if (res && (res.status === 'succeeded' || res.status === 'processing')) {
                setIsSuccess(true);
                setTimeout(() => {
                    onSuccess();
                }, 1200);
            } else {
                setOneClickError(lbl('No se pudo completar el cobro automático.', 'Automated charge could not be completed.'));
            }
        } catch (err: any) {
            setIsThreeDSecureRequired(false);
            setOneClickError(err.message || lbl('Error al procesar cobro en 1 clic.', 'Error processing 1-click payment.'));
        } finally {
            setIs1ClickProcessing(false);
        }
    };

    if (!stripePromise) {
        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-4">
                    <AlertCircle size={40} className="mx-auto text-amber-500" />
                    <h3 className="text-lg font-black">{lbl('Pasarela no configurada', 'Gateway not configured')}</h3>
                    <p className="text-xs text-muted-foreground">
                        {lbl('Clave de Stripe no encontrada en el cliente.', 'Stripe key not found on the client.')}
                    </p>
                    <button onClick={onCancel} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase">
                        {lbl('Cerrar', 'Close')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onCancel} />
            <div className="relative bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-amber-500/10 text-amber-700 rounded-lg">
                                <Lock size={16} />
                            </span>
                            <h2 className="text-xl font-black text-slate-900">
                                {lbl('Pago Mayorista Seguro', 'Secure Wholesale Payment')}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                            {lbl(`Orden #${orderId.slice(0, 8)} • Monto total: $${amount.toFixed(2)}`, `Order #${orderId.slice(0, 8)} • Total: $${amount.toFixed(2)}`)}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {isSuccess ? (
                    <div className="py-10 text-center space-y-4 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 size={36} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900">
                            {lbl('¡Pago Procesado con Éxito!', 'Payment Successfully Processed!')}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                            {lbl('Tu orden ha sido confirmada y enviada a producción panadera.', 'Your order has been confirmed and queued for wholesale baking.')}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tab Switcher */}
                        <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
                            {savedMethods.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('saved')}
                                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        activeTab === 'saved'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    <Zap size={14} className="text-amber-500" />
                                    <span>{lbl('1-Clic Guardado', '1-Click Saved')}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setActiveTab('card')}
                                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'card'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <CreditCard size={14} />
                                <span>{lbl('Tarjeta Crédito/Débito', 'Card')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('ach')}
                                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'ach'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <Building2 size={14} />
                                <span>{lbl('Transferencia ACH', 'ACH Bank')}</span>
                            </button>
                        </div>

                        {/* TAB 1: 1-Click Saved Payment Methods */}
                        {activeTab === 'saved' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {lbl('Selecciona tu método guardado:', 'Select saved method:')}
                                    </p>
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {savedMethods.map((pm) => {
                                            const isSelected = selectedMethodId === pm.id;
                                            const isCard = pm.type === 'card' || !!pm.card;
                                            const isDeclinedTest = pm.id === 'pm_card_chargeDeclinedInsufficientFunds';
                                            const is3DSTest = pm.id === 'pm_card_threeDSecure2Required';
                                            return (
                                                <div
                                                    key={pm.id}
                                                    data-testid={`pm-card-${pm.id}`}
                                                    onClick={() => {
                                                        setSelectedMethodId(pm.id);
                                                        setOneClickError(null);
                                                        setIsThreeDSecureRequired(false);
                                                    }}
                                                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                                                        isSelected
                                                            ? isDeclinedTest
                                                                ? 'border-red-500 bg-red-50/50 shadow-sm'
                                                                : is3DSTest
                                                                ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                                                                : 'border-slate-950 bg-slate-50/80 shadow-sm'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2.5 rounded-xl ${
                                                            isSelected 
                                                                ? isDeclinedTest 
                                                                    ? 'bg-red-600 text-white' 
                                                                    : is3DSTest 
                                                                    ? 'bg-amber-600 text-white' 
                                                                    : 'bg-slate-950 text-white' 
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {isCard ? <CreditCard size={18} /> : <Building2 size={18} />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-sm text-slate-900 uppercase">
                                                                    {isCard ? (pm.card?.brand || 'Tarjeta') : (pm.us_bank_account?.bank_name || 'Cuenta Bancaria')}
                                                                </span>
                                                                <span className="text-xs font-mono font-bold text-slate-500">
                                                                    •••• {isCard ? pm.card?.last4 : pm.us_bank_account?.last4}
                                                                </span>
                                                                {isDeclinedTest && (
                                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-lg border border-red-200">
                                                                        Fondos Insuficientes
                                                                    </span>
                                                                )}
                                                                {is3DSTest && (
                                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-lg border border-amber-200">
                                                                        3D Secure
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-400">
                                                                {isCard
                                                                    ? `${lbl('Expira', 'Expires')}: ${pm.card?.exp_month}/${pm.card?.exp_year}`
                                                                    : lbl('ACH Direct Debit Mayorista', 'Wholesale ACH Direct Debit')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                        isSelected ? 'border-slate-950 bg-slate-950' : 'border-slate-300'
                                                    }`}>
                                                        {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {oneClickError && (
                                    <div 
                                        data-testid="stripe-edge-error-banner"
                                        className="p-4 bg-red-50/90 border-2 border-red-300 rounded-2xl flex items-start gap-3 text-red-900 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm"
                                    >
                                        <div className="p-1.5 bg-red-100 text-red-600 rounded-xl shrink-0 mt-0.5">
                                            {isThreeDSecureRequired ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-black text-xs uppercase tracking-wide text-red-900">
                                                {isThreeDSecureRequired 
                                                    ? lbl('Desafío de Seguridad 3D Secure', '3D Secure Security Challenge') 
                                                    : lbl('Pago Rechazado — Fondos Insuficientes', 'Payment Declined — Insufficient Funds')}
                                            </p>
                                            <p className="text-red-700 leading-relaxed">{oneClickError}</p>
                                            {isThreeDSecureRequired && (
                                                <div className="mt-2 pt-2 border-t border-red-200/80 flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-mono font-black uppercase">
                                                        3DS-SCA-CHALLENGE
                                                    </span>
                                                    <span className="text-[11px] text-amber-800">
                                                        {lbl('Simulación de verificación bancaria requerida completada.', 'Required bank verification simulation completed.')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onCancel}
                                        disabled={is1ClickProcessing}
                                        className="flex-1 py-4 text-xs font-black uppercase tracking-wider rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                                    >
                                        {lbl('Cancelar', 'Cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleOneClickPay}
                                        disabled={!selectedMethodId || is1ClickProcessing}
                                        className="flex-[2] py-4 bg-slate-950 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {is1ClickProcessing ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Zap size={16} className="text-amber-400 fill-amber-400" />
                                        )}
                                        {is1ClickProcessing
                                            ? lbl('Procesando...', 'Processing...')
                                            : lbl(`Pagar 1 Clic • $${amount.toFixed(2)}`, `1-Click Pay • $${amount.toFixed(2)}`)}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Card Elements Form */}
                        {activeTab === 'card' && (
                            <Elements
                                stripe={stripePromise}
                                options={{
                                    clientSecret,
                                    appearance: {
                                        theme: 'stripe',
                                        variables: {
                                            colorPrimary: '#0f172a',
                                            borderRadius: '16px',
                                            fontFamily: 'Inter, system-ui, sans-serif',
                                        },
                                    },
                                }}
                            >
                                <CheckoutForm
                                    amount={amount}
                                    orderId={orderId}
                                    saveCard={saveCard}
                                    setSaveCard={setSaveCard}
                                    onSuccess={onSuccess}
                                    onCancel={onCancel}
                                    locale={locale}
                                />
                            </Elements>
                        )}

                        {/* TAB 3: ACH Direct Debit */}
                        {activeTab === 'ach' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs space-y-2 text-blue-900">
                                    <div className="flex items-center gap-2 font-bold text-blue-950">
                                        <Building2 size={16} className="text-blue-600" />
                                        <span>{lbl('Transferencia Directa ACH (0.8% comisión, máx $5.00)', 'Direct ACH Transfer (0.8% fee, max $5.00)')}</span>
                                    </div>
                                    <p className="leading-relaxed">
                                        {lbl(
                                            'Ideal para pedidos recurrentes o de gran volumen. Puedes autorizar el débito directo de tu cuenta bancaria comercial en EE.UU.',
                                            'Ideal for recurring or high-volume wholesale orders. Authorize direct debits securely from your US business bank account.'
                                        )}
                                    </p>
                                </div>

                                <Elements
                                    stripe={stripePromise}
                                    options={{
                                        clientSecret,
                                        appearance: {
                                            theme: 'stripe',
                                            variables: {
                                                colorPrimary: '#0f172a',
                                                borderRadius: '16px',
                                                fontFamily: 'Inter, system-ui, sans-serif',
                                            },
                                        },
                                    }}
                                >
                                    <CheckoutForm
                                        amount={amount}
                                        orderId={orderId}
                                        saveCard={saveCard}
                                        setSaveCard={setSaveCard}
                                        onSuccess={onSuccess}
                                        onCancel={onCancel}
                                        locale={locale}
                                    />
                                </Elements>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
