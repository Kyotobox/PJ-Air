'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Smartphone, CheckCircle2, X, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { sendOtpSms, confirmOtpCode, OtpConfirmation, formatPhoneNumber } from '@/lib/firebase';
import { useLanguage } from '@/context/LanguageContext';

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  title?: string;
  description?: string;
  onVerified: (verifiedData: { phone: string; idToken?: string; verificationCode?: string }) => Promise<void> | void;
}

export const PhoneVerificationModal = ({
  isOpen,
  onClose,
  phoneNumber,
  title,
  description,
  onVerified,
}: PhoneVerificationModalProps) => {
  const { locale } = useLanguage();
  const [code, setCode] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<OtpConfirmation | null>(null);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Send SMS when modal opens
  useEffect(() => {
    if (isOpen && phoneNumber) {
      handleSendCode();
    } else {
      setCode('');
      setError('');
      setConfirmationResult(null);
    }
  }, [isOpen, phoneNumber]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendCode = async () => {
    setIsSendingSms(true);
    setError('');
    try {
      const confirmation = await sendOtpSms(phoneNumber);
      setConfirmationResult(confirmation);
      setResendCooldown(30);
    } catch (err: any) {
      console.error('Error dispatching SMS:', err);
      setError(
        locale === 'en'
          ? 'Failed to send SMS code. Please try again.'
          : 'Error al enviar código SMS. Por favor intenta de nuevo.'
      );
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setError(locale === 'en' ? 'Please enter the 6-digit code' : 'Ingresa el código de 6 dígitos');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      let idToken: string | undefined;

      if (confirmationResult) {
        try {
          const res = await confirmOtpCode(confirmationResult, cleanCode);
          idToken = res.idToken;
        } catch (confirmErr: any) {
          // If code is test code 123456 or confirmationResult fails
          if (cleanCode === '123456') {
            idToken = 'mock-valid-firebase-token';
          } else {
            throw confirmErr;
          }
        }
      } else {
        if (cleanCode === '123456') {
          idToken = 'mock-valid-firebase-token';
        } else {
          throw new Error('Invalid or expired verification code');
        }
      }

      await onVerified({
        phone: phoneNumber,
        idToken,
        verificationCode: cleanCode,
      });

      onClose();
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(
        err.message ||
          (locale === 'en' ? 'Invalid or expired verification code' : 'Código de verificación inválido o expirado')
      );
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div id="recaptcha-container" className="hidden"></div>
      <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-border/60 text-center animate-scale-up">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-5">
          <ShieldCheck size={34} />
        </div>

        {/* Title & Description */}
        <h3 className="text-2xl font-black font-serif tracking-tight text-foreground mb-2">
          {title || (locale === 'en' ? 'Verify Phone Number' : 'Verificación Telefónica')}
        </h3>
        <p className="text-xs text-muted-foreground font-medium mb-6 leading-relaxed">
          {description ||
            (locale === 'en'
              ? `We sent a 6-digit SMS verification code to ${formatPhoneNumber(phoneNumber)}`
              : `Enviamos un código SMS de 6 dígitos a ${formatPhoneNumber(phoneNumber)}`)}
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2 justify-center">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block text-left ml-1">
              {locale === 'en' ? '6-Digit SMS Code' : 'Código SMS de 6 dígitos'}
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(val);
                }}
                className="w-full text-center text-3xl font-mono font-black tracking-[0.5em] py-3 px-4 rounded-2xl border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none bg-muted/20"
              />
            </div>
          </div>

          <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-[11px] text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold">
              <Smartphone size={16} />
              <span>{formatPhoneNumber(phoneNumber)}</span>
            </div>
            <button
              type="button"
              disabled={isSendingSms || resendCooldown > 0}
              onClick={handleSendCode}
              className="text-xs font-bold text-primary hover:underline disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              {isSendingSms ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {resendCooldown > 0
                ? `${resendCooldown}s`
                : locale === 'en'
                ? 'Resend'
                : 'Reenviar'}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold border border-border text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            >
              {locale === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={isVerifying || code.trim().length !== 6}
              className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-white jhoanes-gradient hover:opacity-95 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
            >
              {isVerifying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>{locale === 'en' ? 'Verify & Save' : 'Verificar y Guardar'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Testing hint */}
        <p className="mt-5 text-[10px] text-muted-foreground/70 font-medium">
          {locale === 'en' ? 'Test mode: Use code 123456' : 'Modo de prueba: Usa el código 123456'}
        </p>
      </div>
    </div>
  );
};
