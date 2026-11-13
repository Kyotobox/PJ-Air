'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import {
  ShieldCheck,
  Building2,
  FileText,
  Eye,
  CreditCard,
  MessageSquare,
  Lock,
  ArrowLeft,
  Mail,
  MapPin,
  CheckCircle2,
  ExternalLink,
  Scale,
  Sparkles,
  Truck,
  Receipt,
  AlertCircle
} from 'lucide-react';
import {
  JHOANES_LEGAL_IDENTITY,
  META_PIXEL_CONFIG,
  THIRD_PARTY_PROCESSORS,
  PRIVACY_SECTIONS
} from '@/lib/privacy-policy-helper';

export default function PrivacyPage() {
  const { locale } = useLanguage();
  const isEn = locale === 'en';

  return (
    <div className="min-h-screen bg-[#faf8f5] text-foreground">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Navigation & Controls Bar */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#5c3a21] transition-colors"
          >
            <ArrowLeft size={16} />
            {isEn ? 'Back to Catalog' : 'Volver al Catálogo'}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="pill" />
            <Link
              href="/terms"
              className="text-xs font-bold text-muted-foreground hover:text-[#5c3a21] underline underline-offset-4 transition-colors"
            >
              {isEn ? 'View Commercial Terms →' : 'Ver Términos Comerciales →'}
            </Link>
          </div>
        </div>

        {/* Main Document Card */}
        <div className="bg-white rounded-[2.5rem] border border-border/60 shadow-xl p-8 sm:p-14 relative overflow-hidden">
          {/* Top Brand Accent Bar */}
          <div
            className="h-2.5 w-full absolute top-0 left-0"
            style={{ background: 'linear-gradient(90deg, #5c3a21 0%, #8B4513 50%, #b45309 100%)' }}
          />

          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md text-white"
                style={{ backgroundColor: '#5c3a21' }}
              >
                <ShieldCheck size={36} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: '#5c3a21' }}
                  >
                    Jhoanes Wholesale
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    • B2B Governance
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black font-serif text-foreground tracking-tight">
                  {isEn ? 'Wholesale Privacy Policy' : 'Política de Privacidad Mayorista B2B'}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
                  {isEn
                    ? 'Official Data Protection, Tracking Technologies & Statutory Privacy Rights'
                    : 'Protección Oficial de Datos, Tecnologías de Rastreo y Derechos Estatutarios de Privacidad'}
                </p>
              </div>
            </div>

            <div className="self-start sm:self-center bg-[#faf8f5] border border-border/70 rounded-2xl px-4 py-3 text-right">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                {isEn ? 'Effective Date' : 'Fecha de Vigencia'}
              </span>
              <span className="text-xs font-bold text-foreground">
                {isEn ? 'November 2026 (v2.0)' : 'Noviembre 2026 (v2.0)'}
              </span>
            </div>
          </div>

          <hr className="border-border/60 my-6" />

          {/* Summary Callout */}
          <div className="mb-10 p-5 rounded-2xl bg-[#faf8f5] border border-[#5c3a21]/20 flex items-start gap-3">
            <Sparkles size={20} className="text-[#5c3a21] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              {isEn ? (
                <>
                  This Privacy Policy applies to all commercial buyers, restaurants, bakeries, supermarkets, and B2B clients interacting with{' '}
                  <strong className="text-foreground">app.jhoanes.com</strong>. We are committed to transparency, data protection under New York and Federal laws, and the strict confidentiality of your business records.
                </>
              ) : (
                <>
                  Esta Política de Privacidad rige para todos los compradores comerciales, restaurantes, panaderías, supermercados y clientes B2B que utilicen{' '}
                  <strong className="text-foreground">app.jhoanes.com</strong>. Garantizamos transparencia, protección rigurosa bajo las leyes de Nueva York y los Estados Unidos, y confidencialidad absoluta de su información empresarial.
                </>
              )}
            </p>
          </div>

          {/* SECTION 1: Legal Controller */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[#5c3a21]/10 text-[#5c3a21]">
                <Building2 size={20} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-foreground">
                {isEn ? '1. Data Controller & Legal Entity' : '1. Responsable del Tratamiento e Identificación Legal'}
              </h2>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-border/80 shadow-sm space-y-3 text-sm leading-relaxed text-foreground/85">
              <p>
                {isEn ? (
                  <>
                    The legal entity responsible for the collection, governance, and safeguarding of wholesale customer data is{' '}
                    <strong className="text-foreground">{JHOANES_LEGAL_IDENTITY.companyName}</strong>, a limited liability company organized under the laws of the{' '}
                    <strong>{JHOANES_LEGAL_IDENTITY.jurisdiction}</strong>.
                  </>
                ) : (
                  <>
                    La entidad jurídica responsable de la recopilación, custodia y protección de los datos de clientes mayoristas es{' '}
                    <strong className="text-foreground">{JHOANES_LEGAL_IDENTITY.companyName}</strong>, sociedad de responsabilidad limitada constituida bajo las leyes del{' '}
                    <strong>{JHOANES_LEGAL_IDENTITY.jurisdiction}</strong>.
                  </>
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f5] border border-border/50">
                  <MapPin size={18} className="text-[#5c3a21] shrink-0" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                      {isEn ? 'Physical Headquarters' : 'Sede Física Comercial'}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {JHOANES_LEGAL_IDENTITY.address}, {JHOANES_LEGAL_IDENTITY.cityStateZip}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f5] border border-border/50">
                  <Mail size={18} className="text-[#5c3a21] shrink-0" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                      {isEn ? 'Official Inquiries & Orders' : 'Consultas Oficiales y Pedidos'}
                    </span>
                    <div className="text-xs font-bold text-foreground flex flex-wrap gap-2">
                      <a href={`mailto:${JHOANES_LEGAL_IDENTITY.primaryEmail}`} className="text-[#5c3a21] hover:underline">
                        {JHOANES_LEGAL_IDENTITY.primaryEmail}
                      </a>
                      <span>•</span>
                      <a href={`mailto:${JHOANES_LEGAL_IDENTITY.ordersEmail}`} className="text-[#5c3a21] hover:underline">
                        {JHOANES_LEGAL_IDENTITY.ordersEmail}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Purposes of B2B Collection */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[#5c3a21]/10 text-[#5c3a21]">
                <FileText size={20} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-foreground">
                {isEn ? '2. Purpose of B2B Data Collection' : '2. Finalidad de la Recopilación de Datos Mayoristas B2B'}
              </h2>
            </div>

            <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
              {isEn
                ? 'We strictly gather and process corporate and transactional information necessary to establish commercial wholesale accounts, produce fresh bakery batches, and fulfill delivery logistics:'
                : 'Recopilamos y procesamos estrictamente la información empresarial y transaccional indispensable para aperturar cuentas mayoristas, elaborar lotes frescos de panadería y gestionar la logística de despacho:'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Purpose 1: B2B Accounts */}
              <div className="p-5 rounded-2xl bg-white border border-border/80 shadow-sm hover:border-[#5c3a21]/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#5c3a21]/10 text-[#5c3a21] flex items-center justify-center font-black text-xs">
                    01
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isEn ? 'Commercial Wholesale B2B Accounts' : 'Cuentas Mayoristas Comerciales B2B'}
                  </h3>
                </div>
                <p className="text-xs text-foreground/75 leading-relaxed">
                  {isEn
                    ? 'Business entity validation, commercial trade name (DBA), establishment address, buyer credentials, credit terms eligibility, and volume price assignment.'
                    : 'Validación de la entidad comercial, nombre de fantasía (DBA), dirección física del establecimiento, compradores autorizados y asignación de precios por escala.'}
                </p>
              </div>

              {/* Purpose 2: Bakery Production & Logistics */}
              <div className="p-5 rounded-2xl bg-white border border-border/80 shadow-sm hover:border-[#5c3a21]/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#5c3a21]/10 text-[#5c3a21] flex items-center justify-center font-black text-xs">
                    <Truck size={15} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isEn ? 'Bakery Production & Tri-State Logistics' : 'Producción y Logística Tri-Estatal (NY/NJ)'}
                  </h3>
                </div>
                <p className="text-xs text-foreground/75 leading-relaxed">
                  {isEn
                    ? 'Daily fresh bakery batch scheduling according to the 12:00 PM cutoff, packaging, manifest preparation, route optimization, and direct dispatch across New York and New Jersey.'
                    : 'Programación de horneado diario según el corte de las 12:00 PM, empaque, manifiestos de carga, optimización de rutas y despacho en Nueva York y Nueva Jersey.'}
                </p>
              </div>

              {/* Purpose 3: NYS DTF Form ST-120 */}
              <div className="p-5 rounded-2xl bg-white border border-border/80 shadow-sm hover:border-[#5c3a21]/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#5c3a21]/10 text-[#5c3a21] flex items-center justify-center font-black text-xs">
                    <Receipt size={15} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isEn ? 'NYS DTF Form ST-120 Tax Exemption' : 'Exención Fiscal ST-120 (NYS DTF)'}
                  </h3>
                </div>
                <p className="text-xs text-foreground/75 leading-relaxed">
                  {isEn
                    ? 'Verification and statutory digital retention of New York Resale Certificates (NYS DTF Form ST-120) certifying valid wholesale sales tax exemptions pursuant to NY Tax Law.'
                    : 'Verificación y archivo digital reglamentario de Certificados de Reventa (Formulario ST-120 de NYS DTF) que respaldan la exención legítima del impuesto sobre ventas.'}
                </p>
              </div>

              {/* Purpose 4: Operational Communications */}
              <div className="p-5 rounded-2xl bg-white border border-border/80 shadow-sm hover:border-[#5c3a21]/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#5c3a21]/10 text-[#5c3a21] flex items-center justify-center font-black text-xs">
                    <MessageSquare size={15} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isEn ? 'Operational & Billing Communications' : 'Comunicaciones Operativas y Facturación'}
                  </h3>
                </div>
                <p className="text-xs text-foreground/75 leading-relaxed">
                  {isEn
                    ? 'Delivery status alerts, driver arrival notifications, automated invoice generation, accounting statements, credit limit alerts, and critical order cutoff notices.'
                    : 'Notificaciones sobre el estado del pedido, avisos de entrega, emisión digital de facturas, estados contables y alertas críticas sobre horarios de horneado.'}
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 3: Meta Pixel & Tracking Technologies */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[#5c3a21]/10 text-[#5c3a21]">
                <Eye size={20} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-foreground">
                {isEn ? '3. Tracking Technologies & Meta Pixel Disclosure' : '3. Tecnologías de Rastreo y Divulgación de Meta Pixel'}
              </h2>
            </div>

            <div className="p-6 rounded-2xl bg-[#faf8f5] border border-[#5c3a21]/30 relative overflow-hidden space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={22} className="text-[#5c3a21] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isEn ? 'Explicit Meta Pixel Integration Notice' : 'Declaración Explícita de Integración con Meta Pixel'}
                  </h3>
                  <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                    {isEn ? (
                      <>
                        Our web application operates analytics and conversion measurement tools provided by{' '}
                        <strong>{META_PIXEL_CONFIG.provider}</strong>, specifically incorporating Meta Pixel ID:{' '}
                        <code className="bg-white px-2 py-0.5 rounded border border-border/80 font-mono font-bold text-[#5c3a21]">
                          {META_PIXEL_CONFIG.metaPixelId}
                        </code>
                        .
                      </>
                    ) : (
                      <>
                        Nuestra plataforma web incorpora herramientas de medición y análisis proporcionadas por{' '}
                        <strong>{META_PIXEL_CONFIG.provider}</strong>, operando bajo el identificador oficial de Meta Pixel ID:{' '}
                        <code className="bg-white px-2 py-0.5 rounded border border-border/80 font-mono font-bold text-[#5c3a21]">
                          {META_PIXEL_CONFIG.metaPixelId}
                        </code>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 space-y-2 text-xs text-foreground/80 leading-relaxed">
                <p>
                  <strong>{isEn ? 'Ad Conversion & Measurement:' : 'Medición de Conversión Publicitaria:'}</strong>{' '}
                  {isEn
                    ? 'The Pixel records standard interaction signals (such as ViewContent, CompleteRegistration, and Purchase) to analyze traffic originating from Facebook and Instagram campaigns, optimize advertising relevance, and measure commercial conversion efficiency.'
                    : 'El Pixel registra eventos de interacción estándar (tales como ViewContent, CompleteRegistration y Purchase) para medir el rendimiento de anuncios provenientes de Facebook e Instagram, optimizar presupuestos publicitarios y evaluar la conversión de clientes mayoristas.'}
                </p>
                <p>
                  <strong>{isEn ? 'Cookie Controls & Opt-Out Rights:' : 'Control de Cookies y Derechos de Exclusión:'}</strong>{' '}
                  {isEn
                    ? 'You have the unequivocal right to control or refuse tracking cookies. You may modify your browser preferences to reject third-party cookies or utilize universal opt-out mechanisms:'
                    : 'Usted tiene el derecho inalienable de administrar y rechazar cookies de rastreo. Puede configurar su navegador para bloquear cookies de terceros o ejercer su derecho de exclusión en:'}
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={META_PIXEL_CONFIG.optOutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-border/80 text-[11px] font-bold text-[#5c3a21] hover:bg-[#5c3a21] hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} /> Meta Ad Preferences
                  </a>
                  <a
                    href="https://optout.aboutads.info/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-border/80 text-[11px] font-bold text-[#5c3a21] hover:bg-[#5c3a21] hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} /> Digital Advertising Alliance (DAA)
                  </a>
                  <a
                    href="https://optout.networkadvertising.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-border/80 text-[11px] font-bold text-[#5c3a21] hover:bg-[#5c3a21] hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} /> Network Advertising Initiative (NAI)
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: Third-Party Service Providers */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[#5c3a21]/10 text-[#5c3a21]">
                <CreditCard size={20} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-foreground">
                {isEn ? '4. Third-Party Service Providers & Processors' : '4. Proveedores de Servicios y Pasarelas'}
              </h2>
            </div>

            <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
              {isEn
                ? 'We partner with enterprise-grade infrastructure providers who process data strictly under our security instructions and confidentiality agreements:'
                : 'Trabajamos con proveedores de infraestructura tecnológica de primer nivel que procesan datos exclusivamente bajo estrictas directivas de seguridad y confidencialidad:'}
            </p>

            <div className="space-y-3">
              {THIRD_PARTY_PROCESSORS.map((processor) => (
                <div
                  key={processor.name}
                  className="p-5 rounded-2xl bg-white border border-border/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{processor.name}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {processor.role}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/75 leading-relaxed">
                      {isEn ? processor.purposeEn : processor.purposeEs}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                      {isEn ? 'Security Standard' : 'Estándar de Seguridad'}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 flex items-center sm:justify-end gap-1">
                      <CheckCircle2 size={13} /> {processor.securityStandard}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5: Data Retention & ARCO / NY SHIELD Rights */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[#5c3a21]/10 text-[#5c3a21]">
                <Scale size={20} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-foreground">
                {isEn ? '5. Data Retention & Privacy Rights (NY SHIELD / ARCO)' : '5. Conservación de Datos y Derechos de Privacidad (NY SHIELD / ARCO)'}
              </h2>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-border/80 shadow-sm space-y-4 text-sm leading-relaxed text-foreground/85">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#5c3a21] mb-1">
                  {isEn ? 'Statutory Retention Schedules (NYS DTF)' : 'Plazos Legales de Conservación (NYS DTF)'}
                </h3>
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                  {isEn
                    ? 'Commercial order transactions, delivery manifests, and New York State Resale Certificates (Form ST-120) are preserved for a mandatory minimum period of three (3) years pursuant to New York State Department of Taxation and Finance regulations and auditing standards.'
                    : 'Las transacciones comerciales, notas de entrega y Certificados de Reventa de Nueva York (Formulario ST-120) se conservan por un plazo obligatorio mínimo de tres (3) años, en estricto cumplimiento con las normativas fiscales del NYS DTF y auditorías comerciales.'}
                </p>
              </div>

              <div className="border-t border-border/60 pt-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#5c3a21] mb-1">
                  {isEn ? 'ARCO & US State Privacy Protections' : 'Derechos ARCO y Leyes de Privacidad de Nueva York'}
                </h3>
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                  {isEn
                    ? 'Under the New York SHIELD Act and internationally recognized ARCO principles, commercial clients and authorized representatives hold the right to Access, Rectify, Cancel, or Oppose the processing of their contact data, as well as request a copy of their stored commercial profile.'
                    : 'Bajo la ley NY SHIELD Act y los principios ARCO (Acceso, Rectificación, Cancelación y Oposición), los clientes mayoristas y representantes comerciales tienen el derecho de acceder, corregir, actualizar o solicitar la supresión de sus datos de contacto y expediente comercial.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-foreground/90 leading-relaxed">
                <strong>{isEn ? 'Zero Data Sale Commitment:' : 'Compromiso de No Comercialización:'}</strong>{' '}
                {isEn
                  ? 'Jhoanes Bakery & Coffee LLC never sells, leases, trades, or commercializes wholesale customer information to third-party data brokers or external marketing lists.'
                  : 'Jhoanes Bakery & Coffee LLC bajo ningún motivo vende, alquila, transfiere o comercializa la información de sus clientes mayoristas con intermediarios de datos o terceros.'}
              </div>

              <div className="pt-2 text-xs text-muted-foreground">
                {isEn ? (
                  <>
                    To exercise your privacy rights, request data updates, or submit compliance inquiries, email our legal and operations team at{' '}
                    <a href={`mailto:${JHOANES_LEGAL_IDENTITY.primaryEmail}`} className="text-[#5c3a21] font-bold underline">
                      {JHOANES_LEGAL_IDENTITY.primaryEmail}
                    </a>{' '}
                    or{' '}
                    <a href={`mailto:${JHOANES_LEGAL_IDENTITY.ordersEmail}`} className="text-[#5c3a21] font-bold underline">
                      {JHOANES_LEGAL_IDENTITY.ordersEmail}
                    </a>
                    .
                  </>
                ) : (
                  <>
                    Para ejercer sus derechos de privacidad, actualizar sus datos o enviar consultas legales, escriba a nuestro equipo en{' '}
                    <a href={`mailto:${JHOANES_LEGAL_IDENTITY.primaryEmail}`} className="text-[#5c3a21] font-bold underline">
                      {JHOANES_LEGAL_IDENTITY.primaryEmail}
                    </a>{' '}
                    o{' '}
                    <a href={`mailto:${JHOANES_LEGAL_IDENTITY.ordersEmail}`} className="text-[#5c3a21] font-bold underline">
                      {JHOANES_LEGAL_IDENTITY.ordersEmail}
                    </a>
                    .
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Bottom Legal Actions Footer */}
          <div className="pt-6 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 rounded-full text-white font-black text-xs uppercase tracking-widest text-center shadow-lg transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: '#5c3a21' }}
            >
              {isEn ? 'Return to Wholesale Portal' : 'Regresar al Portal Mayorista'}
            </Link>

            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
              <Link href="/terms" className="hover:text-[#5c3a21] transition-colors underline underline-offset-4">
                {isEn ? 'Commercial Terms & Conditions' : 'Términos y Condiciones Comerciales'}
              </Link>
              <span>•</span>
              <a
                href={`mailto:${JHOANES_LEGAL_IDENTITY.primaryEmail}`}
                className="hover:text-[#5c3a21] transition-colors"
              >
                {isEn ? 'Contact Legal Support' : 'Soporte Legal'}
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
