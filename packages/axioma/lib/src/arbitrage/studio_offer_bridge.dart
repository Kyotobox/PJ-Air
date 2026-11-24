// 🎯 Adaptador de Levita Studio para Ofertas de Arbitraje
// Doctrinas: §4 Zero Mocks, §6 Sad Paths, §39 Pure Dart Core, §45 Offline-First.

import '../contracts/creative_studio_contracts.dart';
import '../render/creative_render_job_dto.dart';
import 'arbitrage_contracts.dart';

/// Puente entre productos de arbitraje y el motor de renderizado gráfico de Levita Studio.
abstract final class StudioOfferBridge {
  /// Genera un trabajo de renderizado publicitario (CreativeRenderJobDTO) a partir de un producto.
  static CreativeRenderJobDTO createRenderJob({
    required ArbitrageProductDTO product,
    String brandSlug = 'levita_market',
    TargetAdFormat targetFormat = TargetAdFormat.feedSquare1x1,
    String? inputPhotoPath,
    String? customBadge,
  }) {
    final archetype = inputPhotoPath != null && inputPhotoPath.trim().isNotEmpty
        ? 'packshot_hero'
        : 'vector_typography';

    final badge =
        customBadge ?? 'GARANTÍA ${product.warrantyPeriod.toUpperCase()}';
    final headline =
        '${product.title} • \$${product.retailPriceUsd.toStringAsFixed(2)} USD';
    final jobId = 'JOB_${product.sku}_${DateTime.now().millisecondsSinceEpoch}';

    return CreativeRenderJobDTO(
      jobId: jobId,
      tenantId: brandSlug,
      archetype: archetype,
      headline: headline,
      subheadline: badge,
      badgeLabel: badge,
      targetFormat: targetFormat,
      productImageUrl: inputPhotoPath,
      outputFormat: targetFormat == TargetAdFormat.storyReel9x16
          ? 'mp4'
          : 'png',
      status: RenderJobStatus.queued,
    );
  }

  /// Genera una plantilla SVG pura y responsive a costo $0.00 para la oferta.
  static String generateSvgMarkup({
    required ArbitrageProductDTO product,
    required double bcvRate,
    String brandName = 'LEVITA MARKET',
    String primaryHex = '#6366F1', // Indigo elegante
    String bgHex = '#0F172A', // Slate oscuro
    int width = 1080,
    int height = 1080,
  }) {
    if (bcvRate <= 0) {
      throw const ArbitrageContractException(
        'bcvRate debe ser mayor a cero',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'bcvRate',
      );
    }

    final vesPrice = (product.retailPriceUsd * bcvRate).toStringAsFixed(2);
    final usdPrice = product.retailPriceUsd.toStringAsFixed(2);
    final title = product.title.toUpperCase();
    final warranty = product.warrantyPeriod.toUpperCase();

    return '''<svg width="$width" height="$height" viewBox="0 0 $width $height" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="$bgHex" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="$primaryHex" />
      <stop offset="100%" stop-color="#8B5CF6" />
    </linearGradient>
  </defs>

  <!-- Fondo Premium -->
  <rect width="$width" height="$height" fill="url(#bgGrad)" />

  <!-- Badge Superior de Marca -->
  <rect x="80" y="80" width="320" height="56" rx="28" fill="#1E293B" stroke="#334155" stroke-width="2" />
  <text x="240" y="116" font-family="system-ui, sans-serif" font-size="22" font-weight="800" fill="#F8FAFC" text-anchor="middle" letter-spacing="3">$brandName</text>

  <!-- Insignia de Garantía -->
  <rect x="680" y="80" width="320" height="56" rx="28" fill="#10B981" />
  <text x="840" y="116" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🛡️ $warranty</text>

  <!-- Título del Producto -->
  <text x="540" y="380" font-family="system-ui, sans-serif" font-size="64" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="-1">
    $title
  </text>
  <text x="540" y="440" font-family="system-ui, sans-serif" font-size="32" font-weight="500" fill="#94A3B8" text-anchor="middle">
    CUENTA PRIVADA • ENTREGA DIGITAL INMEDIATA
  </text>

  <!-- Caja de Precio Destacada -->
  <rect x="240" y="520" width="600" height="280" rx="40" fill="url(#cardGrad)" filter="drop-shadow(0px 20px 40px rgba(99, 102, 241, 0.4))" />
  <text x="540" y="640" font-family="system-ui, sans-serif" font-size="110" font-weight="900" fill="#FFFFFF" text-anchor="middle">
    \$$usdPrice
  </text>
  <text x="540" y="730" font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="#E0E7FF" text-anchor="middle">
    ≈ Bs. $vesPrice (Tasa BCV)
  </text>

  <!-- Barra de Llamado a la Acción Inferior -->
  <rect x="80" y="920" width="920" height="80" rx="40" fill="#22C55E" />
  <text x="540" y="970" font-family="system-ui, sans-serif" font-size="28" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
    👉 ESCRIBE AL WHATSAPP PARA ACTIVAR TU ACCESO HOY
  </text>
</svg>''';
  }
}
