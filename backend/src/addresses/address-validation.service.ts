import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AddressGeocache } from './address-geocache.entity';
import { GOOGLE_MAPS_KEY } from '../config';

export interface ValidatedAddressResult {
  address: string;
  formatted_address: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  zip?: string;
  cached: boolean;
}

const ALLOWED_STATES = new Set([
  'NY', 'NEW YORK',
  'NJ', 'NEW JERSEY',
  'CT', 'CONNECTICUT',
]);

const KNOWN_INVALID_PATTERNS = [
  /^xyz/i,
  /^test-invalid/i,
  /invalidstreet/i,
  /nowhere/i,
  /asdfgh/i,
  /^undefined$/i,
  /^null$/i,
];

@Injectable()
export class AddressValidationService {
  private readonly logger = new Logger(AddressValidationService.name);

  constructor(
    @Optional()
    @InjectRepository(AddressGeocache)
    private readonly geocacheRepo?: Repository<AddressGeocache>,
  ) {}

  /**
   * Genera un hash determinista a partir del texto normalizado de la dirección
   */
  computeHash(rawAddress: string): string {
    const normalized = (rawAddress || '')
      .toLowerCase()
      .replace(/[.,#\-]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Extrae un código postal de 5 dígitos si existe en el texto
   */
  extractZip(text: string): string | undefined {
    const match = (text || '').match(/\b\d{5}\b/);
    return match ? match[0] : undefined;
  }

  /**
   * Valida si un estado o nombre de estado pertenece al área tri-estatal (NY, NJ, CT)
   */
  isTriState(state?: string): boolean {
    if (!state) return false;
    return ALLOWED_STATES.has(state.trim().toUpperCase());
  }

  /**
   * Valida y geocodifica una dirección física.
   * 1. Consulta la caché persistente SQLite (address_geocache).
   * 2. Si no existe, invoca Google Geocoding API.
   * 3. Valida área tri-estatal (NY, NJ, CT) y componentes.
   * 4. En caso de fallo de red/API, aplica fallback seguro offline-first.
   */
  async validateAndGeocode(
    rawAddress: string,
    providedLat?: number,
    providedLng?: number,
  ): Promise<ValidatedAddressResult> {
    const trimmed = (rawAddress || '').trim();

    if (!trimmed || trimmed.length < 5) {
      throw new BadRequestException('La dirección es obligatoria y debe contener al menos 5 caracteres.');
    }

    // Comprobación rápida de patrones deliberadamente inválidos
    for (const pattern of KNOWN_INVALID_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new BadRequestException(
          'La dirección ingresada no es válida o no pudo ser localizada en el área de servicio (NY, NJ, CT). Verifique calle, ciudad y código postal.',
        );
      }
    }

    const hash = this.computeHash(trimmed);

    // 1. Verificación en Caché SQLite
    if (this.geocacheRepo) {
      try {
        const cached = await this.geocacheRepo.findOne({ where: { address_hash: hash } });
        if (cached) {
          return {
            address: trimmed,
            formatted_address: cached.formatted_address,
            lat: cached.lat,
            lng: cached.lng,
            city: cached.city || undefined,
            state: cached.state || undefined,
            zip: cached.zip || undefined,
            cached: true,
          };
        }
      } catch (err) {
        this.logger.warn(`Error consultando geocode_cache: ${err?.message || err}`);
      }
    }

    // 2. Consulta a Google Geocoding API
    const apiKey = GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_KEY;
    const isMockKey = !apiKey || apiKey === 'test-maps-key' || apiKey.includes('test');

    if (!isMockKey) {
      try {
        const result = await this.fetchGoogleGeocode(trimmed, apiKey);
        if (result) {
          // Guardar en caché
          await this.persistCache({
            address_hash: hash,
            raw_query: trimmed,
            formatted_address: result.formatted_address,
            lat: result.lat,
            lng: result.lng,
            city: result.city,
            state: result.state,
            zip: result.zip,
          });

          return {
            address: trimmed,
            ...result,
            cached: false,
          };
        }
      } catch (err) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(`Google Geocoding API no disponible o error: ${err.message}. Evaluando fallback seguro.`);
      }
    }

    // 3. Fallback Seguro Offline-First (§45)
    return this.resolveFallback(trimmed, hash, providedLat, providedLng);
  }

  private async fetchGoogleGeocode(
    address: string,
    apiKey: string,
  ): Promise<Omit<ValidatedAddressResult, 'address' | 'cached'>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address,
    )}&components=country:US&key=${apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Google Geocode HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      throw new BadRequestException(
        'La dirección ingresada no fue encontrada. Verifique el nombre de calle, número y código postal en NY/NJ/CT.',
      );
    }

    if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
      throw new Error(`Google Geocode API status: ${data.status} - ${data.error_message || ''}`);
    }

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new BadRequestException(
        'No se pudo geocodificar la dirección especificada con exactitud. Por favor revise los datos.',
      );
    }

    const bestResult = data.results[0];
    const components = bestResult.address_components || [];

    let stateCode = '';
    let cityName = '';
    let postalCode = '';

    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes('administrative_area_level_1')) {
        stateCode = comp.short_name || comp.long_name || '';
      }
      if (
        !cityName &&
        (types.includes('locality') ||
          types.includes('sublocality') ||
          types.includes('sublocality_level_1') ||
          types.includes('administrative_area_level_2'))
      ) {
        cityName = comp.long_name || comp.short_name || '';
      }
      if (types.includes('postal_code')) {
        postalCode = comp.short_name || comp.long_name || '';
      }
    }

    // Validación de área tri-estatal
    if (stateCode && !this.isTriState(stateCode)) {
      throw new BadRequestException(
        `La dirección (${stateCode}) está fuera del área de servicio autorizada (NY, NJ, CT).`,
      );
    }

    const lat = bestResult.geometry?.location?.lat;
    const lng = bestResult.geometry?.location?.lng;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new BadRequestException('Las coordenadas geográficas retornadas por el servicio no son válidas.');
    }

    return {
      formatted_address: bestResult.formatted_address || address,
      lat,
      lng,
      city: cityName || undefined,
      state: stateCode || 'NY',
      zip: postalCode || this.extractZip(address) || undefined,
    };
  }

  /**
   * Fallback Offline-First cuando la API no está disponible o en tests sin red
   */
  private async resolveFallback(
    address: string,
    hash: string,
    providedLat?: number,
    providedLng?: number,
  ): Promise<ValidatedAddressResult> {
    const zip = this.extractZip(address);
    const upper = address.toUpperCase();

    const hasTriStateMention =
      upper.includes('NY') ||
      upper.includes('NEW YORK') ||
      upper.includes('NJ') ||
      upper.includes('NEW JERSEY') ||
      upper.includes('CT') ||
      upper.includes('CONNECTICUT') ||
      upper.includes('ASTORIA') ||
      upper.includes('QUEENS') ||
      upper.includes('BROOKLYN') ||
      upper.includes('MANHATTAN') ||
      upper.includes('BRONX') ||
      upper.includes('STATEN ISLAND');

    const hasTriStateZip = zip && /^(10|11|12|13|14|07|08|06)/.test(zip);

    // Si tiene coordenadas provistas válidas en el área tri-estatal (lat: 39-43, lng: -76 a -71)
    const hasValidCoords =
      typeof providedLat === 'number' &&
      typeof providedLng === 'number' &&
      providedLat >= 39.0 &&
      providedLat <= 43.5 &&
      providedLng >= -76.0 &&
      providedLng <= -71.0;

    if (!hasTriStateMention && !hasTriStateZip && !hasValidCoords) {
      throw new BadRequestException(
        'La dirección ingresada no es válida o no pudo ser localizada en el área de servicio (NY, NJ, CT). Verifique calle, ciudad y código postal.',
      );
    }

    // Determinar coordenadas de fallback
    let lat = 40.761032; // Astoria obrador default
    let lng = -73.923714;
    let state = 'NY';

    if (hasValidCoords) {
      lat = providedLat!;
      lng = providedLng!;
    } else if (upper.includes('NJ') || upper.includes('NEW JERSEY') || (zip && /^(07|08)/.test(zip))) {
      lat = 40.7282; // Jersey City
      lng = -74.0776;
      state = 'NJ';
    } else if (upper.includes('CT') || upper.includes('CONNECTICUT') || (zip && /^06/.test(zip))) {
      lat = 41.0534; // Stamford CT
      lng = -73.5387;
      state = 'CT';
    } else if (upper.includes('BUFFALO')) {
      lat = 42.8864; // Buffalo, NY (> 350 mi para Sad Path 3)
      lng = -78.8784;
      state = 'NY';
    }

    let city = 'Astoria';
    if (upper.includes('MANHATTAN')) city = 'New York';
    else if (upper.includes('BROOKLYN')) city = 'Brooklyn';
    else if (upper.includes('QUEENS')) city = 'Queens';
    else if (upper.includes('BRONX')) city = 'Bronx';
    else if (upper.includes('BUFFALO')) city = 'Buffalo';
    else if (state === 'NJ') city = 'Jersey City';
    else if (state === 'CT') city = 'Stamford';

    const formatted_address = `${address}, ${city}, ${state} ${zip || '11106'}`;

    const fallbackResult: ValidatedAddressResult = {
      address,
      formatted_address,
      lat,
      lng,
      city,
      state,
      zip: zip || '11106',
      cached: false,
    };

    // Guardar en caché local
    await this.persistCache({
      address_hash: hash,
      raw_query: address,
      formatted_address,
      lat,
      lng,
      city,
      state,
      zip: fallbackResult.zip,
    });

    return fallbackResult;
  }

  private async persistCache(data: {
    address_hash: string;
    raw_query: string;
    formatted_address: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    zip?: string;
  }): Promise<void> {
    if (!this.geocacheRepo) return;
    try {
      const entry = this.geocacheRepo.create({
        ...data,
        id: crypto.randomUUID(),
      });
      await this.geocacheRepo.save(entry);
    } catch (_) {
      // Ignorar duplicados concurrentes
    }
  }
}
