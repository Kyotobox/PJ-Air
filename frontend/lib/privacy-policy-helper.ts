/**
 * Jhoanes Bakery & Coffee LLC — B2B Wholesale Privacy Policy Helper
 * S84B Compliance Specification
 */

export interface LegalIdentity {
  companyName: string;
  address: string;
  cityStateZip: string;
  primaryEmail: string;
  ordersEmail: string;
  jurisdiction: string;
}

export interface TrackingTechConfig {
  metaPixelId: string;
  provider: string;
  platforms: string[];
  cookieNoticeEn: string;
  cookieNoticeEs: string;
  optOutUrl: string;
}

export interface ServiceProcessor {
  name: string;
  role: string;
  purposeEn: string;
  purposeEs: string;
  securityStandard: string;
}

export interface PrivacySection {
  id: string;
  iconName: string;
  titleEn: string;
  titleEs: string;
  contentEn: string[];
  contentEs: string[];
  subsections?: {
    subtitleEn: string;
    subtitleEs: string;
    detailsEn: string[];
    detailsEs: string[];
  }[];
}

export const JHOANES_LEGAL_IDENTITY: LegalIdentity = {
  companyName: 'Jhoanes Bakery & Coffee LLC',
  address: '33-04 Broadway',
  cityStateZip: 'Astoria, NY 11106',
  primaryEmail: 'info@jhoanes.com',
  ordersEmail: 'orders@jhoanes.com',
  jurisdiction: 'State of New York, United States',
};

export const META_PIXEL_CONFIG: TrackingTechConfig = {
  metaPixelId: '2166007261006109',
  provider: 'Meta Platforms, Inc.',
  platforms: ['Facebook', 'Instagram'],
  cookieNoticeEn: 'We use Meta Pixel (ID 2166007261006109) to measure ad conversion and deliver relevant B2B wholesale marketing.',
  cookieNoticeEs: 'Utilizamos Meta Pixel (ID 2166007261006109) para medir conversiones publicitarias y presentar ofertas mayoristas B2B relevantes.',
  optOutUrl: 'https://www.facebook.com/adpreferences',
};

export const THIRD_PARTY_PROCESSORS: ServiceProcessor[] = [
  {
    name: 'Stripe, Inc.',
    role: 'Payment Processor & Merchant Gateway',
    purposeEn: 'Encrypted credit/debit card processing and ACH electronic bank transfers for wholesale orders.',
    purposeEs: 'Procesamiento encriptado de tarjetas de crédito/débito y transferencias bancarias ACH para pedidos mayoristas.',
    securityStandard: 'PCI-DSS Level 1 Certified & End-to-end tokenization',
  },
  {
    name: 'Twilio, Inc.',
    role: 'Telecommunications & SMS Gateway',
    purposeEn: 'Automated transactional SMS alerts, two-factor authentication, and delivery dispatch updates.',
    purposeEs: 'Alertas SMS transaccionales automatizadas, autenticación de dos pasos y actualizaciones de despacho.',
    securityStandard: 'SOC 2 Type II & Encrypted telecom transit',
  },
];

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'controller',
    iconName: 'Building2',
    titleEn: '1. Data Controller & Legal Entity',
    titleEs: '1. Responsable del Tratamiento e Identificación Legal',
    contentEn: [
      `${JHOANES_LEGAL_IDENTITY.companyName} ("Jhoanes Bakery", "we", "us", or "our") acts as the data controller for personal and commercial data gathered through our wholesale platform (app.jhoanes.com).`,
      `Physical Headquarters: ${JHOANES_LEGAL_IDENTITY.address}, ${JHOANES_LEGAL_IDENTITY.cityStateZip}.`,
      `Official Inquiries: ${JHOANES_LEGAL_IDENTITY.primaryEmail} | Wholesale Orders: ${JHOANES_LEGAL_IDENTITY.ordersEmail}.`,
      `Governing Jurisdiction: ${JHOANES_LEGAL_IDENTITY.jurisdiction}.`,
    ],
    contentEs: [
      `${JHOANES_LEGAL_IDENTITY.companyName} ("Jhoanes Bakery", "nosotros" o "nuestro") actúa como responsable del tratamiento de los datos personales y comerciales recolectados en nuestra plataforma mayorista (app.jhoanes.com).`,
      `Sede Física Comercial: ${JHOANES_LEGAL_IDENTITY.address}, ${JHOANES_LEGAL_IDENTITY.cityStateZip}.`,
      `Consultas Oficiales: ${JHOANES_LEGAL_IDENTITY.primaryEmail} | Pedidos Mayoristas: ${JHOANES_LEGAL_IDENTITY.ordersEmail}.`,
      `Jurisdicción Legal: ${JHOANES_LEGAL_IDENTITY.jurisdiction}.`,
    ],
  },
  {
    id: 'purposes',
    iconName: 'FileText',
    titleEn: '2. Purposes of B2B Data Collection',
    titleEs: '2. Finalidades de la Recopilación de Datos B2B',
    contentEn: [
      'We exclusively collect and process information necessary to maintain commercial business-to-business (B2B) relationships and fulfill wholesale bakery orders:',
    ],
    contentEs: [
      'Recopilamos y procesamos exclusivamente la información necesaria para mantener relaciones comerciales business-to-business (B2B) y satisfacer pedidos de panadería mayorista:',
    ],
    subsections: [
      {
        subtitleEn: 'Wholesale Commercial Accounts (B2B)',
        subtitleEs: 'Cuentas Comerciales Mayoristas (B2B)',
        detailsEn: [
          'Verification of business credentials, commercial establishment addresses, creditworthiness, and authorized buyer identities.',
          'Maintenance of wholesale account tiers, recurring order schedules, and volume-based pricing profiles.',
        ],
        detailsEs: [
          'Verificación de credenciales comerciales, dirección física de establecimientos, líneas de crédito y compradores autorizados.',
          'Mantenimiento de categorías mayoristas, calendario de órdenes recurrentes y perfiles de precios por volumen.',
        ],
      },
      {
        subtitleEn: 'Bakery Production & Tri-State Logistics (NY/NJ)',
        subtitleEs: 'Producción de Panadería y Logística Tri-Estatal (NY/NJ)',
        detailsEn: [
          'Scheduling artisan bakery batches according to strict delivery cut-off timelines (12:00 PM cutoff for next-day dispatch).',
          'Route optimization and physical delivery dispatch throughout the New York and New Jersey metropolitan areas.',
        ],
        detailsEs: [
          'Programación de horneado artesanal según cortes de pedidos estrictos (12:00 PM para despacho al día siguiente).',
          'Optimización de rutas y despacho físico de entregas en el área metropolitana de Nueva York y Nueva Jersey.',
        ],
      },
      {
        subtitleEn: 'NYS DTF Form ST-120 Tax Exemption Compliance',
        subtitleEs: 'Documentación Fiscal de Exención ST-120 (NYS DTF)',
        detailsEn: [
          'Collection, digital verification, and statutory retention of New York State Resale Certificates (Form ST-120).',
          'Ensuring full compliance with New York State Department of Taxation and Finance regulations governing wholesale sales tax exemptions.',
        ],
        detailsEs: [
          'Recolección, validación digital y conservación reglamentaria del Certificado de Reventa del Estado de Nueva York (Formulario ST-120).',
          'Cumplimiento riguroso con las normativas fiscales del Departamento de Impuestos y Finanzas de Nueva York (NYS DTF).',
        ],
      },
      {
        subtitleEn: 'Operational & Billing Communications',
        subtitleEs: 'Comunicaciones Operativas y Facturación',
        detailsEn: [
          'Automated electronic invoices, packing slips, payment receipts, statement balances, and delivery notifications.',
        ],
        detailsEs: [
          'Emisión electrónica de facturas, notas de entrega, recibos de pago, estados de cuenta y avisos de transporte.',
        ],
      },
    ],
  },
  {
    id: 'tracking',
    iconName: 'Eye',
    titleEn: '3. Tracking Technologies & Meta Pixel Disclosure',
    titleEs: '3. Tecnologías de Rastreo y Divulgación de Meta Pixel',
    contentEn: [
      `Our web application utilizes tracking technologies and digital analytics tools provided by ${META_PIXEL_CONFIG.provider}, specifically the Meta Pixel (Pixel ID: ${META_PIXEL_CONFIG.metaPixelId}).`,
      'This technology collects aggregate usage metrics and user interaction events (such as ViewContent, CompleteRegistration, and Purchase) to measure the effectiveness of our commercial marketing campaigns on Facebook and Instagram.',
      'User Rights & Advertising Opt-Out: We respect your autonomy. You may disable tracking cookies via your web browser settings. Furthermore, you can opt out of Meta interest-based advertising by visiting Meta Ad Preferences (https://www.facebook.com/adpreferences) or through the Digital Advertising Alliance Consumer Choice tool at https://optout.aboutads.info/.',
    ],
    contentEs: [
      `Nuestra plataforma web utiliza tecnologías de rastreo y analítica provistas por ${META_PIXEL_CONFIG.provider}, específicamente el Meta Pixel (Pixel ID: ${META_PIXEL_CONFIG.metaPixelId}).`,
      'Esta tecnología recopila métricas de uso y eventos de interacción estándar (tales como ViewContent, CompleteRegistration y Purchase) para medir el rendimiento de nuestras campañas comerciales en Facebook e Instagram.',
      'Gestión de Cookies y Exclusión Publicitaria: Respetamos su privacidad. Puede desactivar cookies de rastreo en la configuración de su navegador web. Asimismo, puede optar por no recibir publicidad dirigida visitando Preferencias de Anuncios de Meta (https://www.facebook.com/adpreferences) o mediante el portal de la Digital Advertising Alliance en https://optout.aboutads.info/.',
    ],
  },
  {
    id: 'processors',
    iconName: 'CreditCard',
    titleEn: '4. Third-Party Service Providers & Processors',
    titleEs: '4. Proveedores de Servicios y Pasarelas de Pago',
    contentEn: [
      'We partner with reputable infrastructure providers who process data strictly under our contractual instructions:',
      '• Stripe, Inc.: Handles credit card, debit card, and ACH electronic transfers under Level 1 PCI-DSS certification. Jhoanes Bakery does not store raw credit card numbers or banking secrets.',
      '• Twilio, Inc.: Facilitates automated operational SMS delivery notices and security verification codes directly to authorized business representatives.',
    ],
    contentEs: [
      'Colaboramos con proveedores de infraestructura tecnológica de primer nivel que operan estrictamente bajo directivas contractuales:',
      '• Stripe, Inc.: Gestiona el cobro seguro con tarjeta de crédito/débito y transferencias electrónicas ACH bajo certificación bancaria PCI-DSS Nivel 1. Jhoanes Bakery no almacena datos confidenciales de tarjetas.',
      '• Twilio, Inc.: Provee el canal de telecomunicaciones para notificaciones transaccionales vía SMS y códigos de autenticación a los teléfonos comerciales registrados.',
    ],
  },
  {
    id: 'rights',
    iconName: 'ShieldCheck',
    titleEn: '5. Data Retention & Privacy Rights (NY SHIELD / ARCO)',
    titleEs: '5. Conservación de Datos y Derechos de Privacidad (NY SHIELD / ARCO)',
    contentEn: [
      'Statutory Retention: Commercial account records, invoices, and NYS DTF Form ST-120 resale certificates are retained for a minimum of three (3) years pursuant to New York Tax Law and commercial audit statutes.',
      'ARCO Rights & State Protections: In accordance with the NY SHIELD Act and international ARCO principles (Access, Rectification, Cancellation, and Opposition), wholesale partners and their representatives have the right to inspect, correct, or request deletion of their business contact records.',
      'Zero Data Sale Commitment: Jhoanes Bakery & Coffee LLC does NOT sell, rent, trade, or monetize commercial or personal data under any circumstances.',
      'To exercise any privacy rights or request data audits, contact our compliance team directly at info@jhoanes.com or orders@jhoanes.com.',
    ],
    contentEs: [
      'Plazos de Conservación: Los registros de cuentas comerciales, facturas y certificados ST-120 del NYS DTF se conservan por un período mínimo de tres (3) años en estricto apego a las leyes fiscales del Estado de Nueva York.',
      'Derechos ARCO y Leyes de Nueva York (NY SHIELD Act): Los socios mayoristas y representantes autorizados pueden ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición respecto a su información comercial registrada.',
      'Compromiso de No Venta de Datos: Jhoanes Bakery & Coffee LLC NO vende, alquila, comercializa ni monetiza datos comerciales o personales bajo ninguna circunstancia.',
      'Para ejercer cualquiera de sus derechos o solicitar aclaraciones, comuníquese con nuestro equipo a info@jhoanes.com o orders@jhoanes.com.',
    ],
  },
];

/**
 * Validates privacy section existence or throws error (Sad Path certification)
 */
export function validatePrivacySection(sectionId: string): PrivacySection {
  const section = PRIVACY_SECTIONS.find(s => s.id === sectionId);
  if (!section) {
    throw new Error(`Invalid privacy policy section identifier: "${sectionId}". Valid sections are: ${PRIVACY_SECTIONS.map(s => s.id).join(', ')}`);
  }
  return section;
}

/**
 * Validates that all mandatory compliance entities are present
 */
export function verifyComplianceSanityCheck(): {
  hasLegalIdentity: boolean;
  hasMetaPixel: boolean;
  hasStripe: boolean;
  hasTwilio: boolean;
  hasSt120: boolean;
  hasArco: boolean;
} {
  const pixelOk = META_PIXEL_CONFIG.metaPixelId === '2166007261006109';
  const identityOk = JHOANES_LEGAL_IDENTITY.companyName.includes('Jhoanes Bakery & Coffee LLC') &&
    JHOANES_LEGAL_IDENTITY.address.includes('33-04 Broadway') &&
    JHOANES_LEGAL_IDENTITY.primaryEmail === 'info@jhoanes.com';
  
  const hasStripe = THIRD_PARTY_PROCESSORS.some(p => p.name.includes('Stripe'));
  const hasTwilio = THIRD_PARTY_PROCESSORS.some(p => p.name.includes('Twilio'));
  
  const hasSt120 = PRIVACY_SECTIONS.some(s => 
    s.subsections?.some(sub => sub.subtitleEn.includes('ST-120'))
  );
  const hasArco = PRIVACY_SECTIONS.some(s => s.id === 'rights');

  return {
    hasLegalIdentity: identityOk,
    hasMetaPixel: pixelOk,
    hasStripe,
    hasTwilio,
    hasSt120,
    hasArco,
  };
}
