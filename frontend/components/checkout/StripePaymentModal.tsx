'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/config';
import { Loader2, ShieldCheck, X, AlertCircle } from 'lucide-react';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

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
    onSuccess,
    onCancel,
    locale,
}: {
    amount: number;
    orderId: string;
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
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
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
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <PaymentElement />
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
                    className="flex-[2] py-4 bg-slate-950 hover:bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">
                            {lbl('Completar Pago Seguro', 'Complete Secure Payment')}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {lbl(`Orden #${orderId.slice(0, 8)} • Total a pagar: $${amount.toFixed(2)}`, `Order #${orderId.slice(0, 8)} • Total: $${amount.toFixed(2)}`)}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <X size={18} />
                    </button>
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
                        onSuccess={onSuccess}
                        onCancel={onCancel}
                        locale={locale}
                    />
                </Elements>
            </div>
        </div>
    );
}
