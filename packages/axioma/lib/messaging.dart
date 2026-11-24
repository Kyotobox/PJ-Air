/// messaging: Entry Point Granular para el Dominio de Mensajería Omnicanal (§39).
///
/// Modela sobre canónico omnicanal, adaptadores de mensajería (WhatsApp, Telegram, Discord),
/// sanitización de identidades/teléfonos y verificación criptográfica de webhooks.
library;

// Messaging Models & Channels
export 'src/messaging/whatsapp_models.dart';
export 'src/messaging/broadcast_campaign_dto.dart';
export 'src/messaging/broadcast_campaign_validator.dart';
export 'src/messaging/whatsapp_offer_dto.dart';
export 'src/messaging/phone_sanitizer.dart';
export 'src/messaging/telegram_models.dart';
export 'src/messaging/discord_models.dart';
export 'src/messaging/omnichannel_envelope.dart';
export 'src/messaging/turn0_intent_router.dart';
export 'src/messaging/intent_signature.dart';
export 'src/messaging/channel_sender.dart';

// Messaging Adapters
export 'src/messaging/adapters/whatsapp_envelope_adapter.dart';
export 'src/messaging/adapters/telegram_envelope_adapter.dart';
export 'src/messaging/adapters/discord_envelope_adapter.dart';

// Webhook Security & Crypto Verifier
export 'src/crypto/webhook_hmac_verifier.dart';
export 'src/security/security_exceptions.dart';
export 'src/security/webhook_signature_validator.dart';
export 'src/security/prompt_sanitizer.dart';
