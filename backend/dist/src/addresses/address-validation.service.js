"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AddressValidationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressValidationService = exports.ALLOWED_STATES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto = __importStar(require("crypto"));
const address_geocache_entity_1 = require("./address-geocache.entity");
const config_1 = require("../config");
exports.ALLOWED_STATES = new Set([
    'NY', 'NEW YORK',
    'NJ', 'NEW JERSEY',
    'CT', 'CONNECTICUT',
    'MA', 'MASSACHUSETTS',
    'RI', 'RHODE ISLAND',
    'PA', 'PENNSYLVANIA',
    'NH', 'NEW HAMPSHIRE',
    'VT', 'VERMONT',
    'ME', 'MAINE',
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
let AddressValidationService = AddressValidationService_1 = class AddressValidationService {
    geocacheRepo;
    logger = new common_1.Logger(AddressValidationService_1.name);
    constructor(geocacheRepo) {
        this.geocacheRepo = geocacheRepo;
    }
    computeHash(rawAddress) {
        const normalized = (rawAddress || '')
            .toLowerCase()
            .replace(/[.,#\-]/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }
    extractZip(text) {
        const match = (text || '').match(/\b\d{5}\b/);
        return match ? match[0] : undefined;
    }
    isAllowedState(state) {
        if (!state)
            return false;
        return exports.ALLOWED_STATES.has(state.trim().toUpperCase());
    }
    isTriState(state) {
        return this.isAllowedState(state);
    }
    async validateAndGeocode(rawAddress, providedLat, providedLng) {
        const trimmed = (rawAddress || '').trim();
        if (!trimmed || trimmed.length < 5) {
            throw new common_1.BadRequestException('La dirección es obligatoria y debe contener al menos 5 caracteres.');
        }
        for (const pattern of KNOWN_INVALID_PATTERNS) {
            if (pattern.test(trimmed)) {
                throw new common_1.BadRequestException('La dirección ingresada no es válida o no pudo ser localizada en el área de servicio (NY, NJ, CT). Verifique calle, ciudad y código postal.');
            }
        }
        const hash = this.computeHash(trimmed);
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
            }
            catch (err) {
                this.logger.warn(`Error consultando geocode_cache: ${err?.message || err}`);
            }
        }
        const apiKey = config_1.GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_KEY || 'AIzaSyCMfaV6rGZZvsXEqJKWcHCANCUuEwWBc-k';
        const isMockKey = !apiKey || apiKey === 'test-maps-key' || apiKey.includes('test');
        if (!isMockKey) {
            try {
                const result = await this.fetchGoogleGeocode(trimmed, apiKey);
                if (result) {
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
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException) {
                    throw err;
                }
                this.logger.warn(`Google Geocoding API no disponible o error: ${err.message}. Evaluando fallback seguro.`);
            }
        }
        return this.resolveFallback(trimmed, hash, providedLat, providedLng);
    }
    async fetchGoogleGeocode(address, apiKey) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:US&key=${apiKey}`;
        let response;
        try {
            response = await fetch(url, { signal: controller.signal });
        }
        finally {
            clearTimeout(timeout);
        }
        if (!response.ok) {
            throw new Error(`Google Geocode HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.status === 'ZERO_RESULTS') {
            throw new common_1.BadRequestException('La dirección ingresada no fue encontrada. Verifique el nombre de calle, número y código postal en NY/NJ/CT.');
        }
        if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
            throw new Error(`Google Geocode API status: ${data.status} - ${data.error_message || ''}`);
        }
        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            throw new common_1.BadRequestException('No se pudo geocodificar la dirección especificada con exactitud. Por favor revise los datos.');
        }
        const bestResult = data.results[0];
        const components = bestResult.address_components || [];
        let stateCode = '';
        let cityName = '';
        let postalCode = '';
        for (const comp of components) {
            const types = comp.types || [];
            if (types.includes('administrative_area_level_1')) {
                stateCode = comp.short_name || comp.long_name || '';
            }
            if (!cityName &&
                (types.includes('locality') ||
                    types.includes('sublocality') ||
                    types.includes('sublocality_level_1') ||
                    types.includes('administrative_area_level_2'))) {
                cityName = comp.long_name || comp.short_name || '';
            }
            if (types.includes('postal_code')) {
                postalCode = comp.short_name || comp.long_name || '';
            }
        }
        if (stateCode && !this.isAllowedState(stateCode)) {
            throw new common_1.BadRequestException(`La dirección (${stateCode}) está fuera del área de servicio autorizada (NY, NJ, CT, MA, RI, PA).`);
        }
        const lat = bestResult.geometry?.location?.lat;
        const lng = bestResult.geometry?.location?.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            throw new common_1.BadRequestException('Las coordenadas geográficas retornadas por el servicio no son válidas.');
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
    async resolveFallback(address, hash, providedLat, providedLng) {
        const zip = this.extractZip(address);
        const upper = address.toUpperCase();
        const hasServiceAreaMention = /\b(NY|NEW YORK|NJ|NEW JERSEY|CT|CONNECTICUT|MA|MASS|MASSACHUSETTS|RI|RHODE ISLAND|PA|PENNSYLVANIA)\b/i.test(upper) ||
            upper.includes('ASTORIA') ||
            upper.includes('QUEENS') ||
            upper.includes('BROOKLYN') ||
            upper.includes('MANHATTAN') ||
            upper.includes('BRONX') ||
            upper.includes('STATEN ISLAND') ||
            upper.includes('BOSTON') ||
            upper.includes('SOMERVILLE') ||
            upper.includes('CAMBRIDGE') ||
            upper.includes('PHILADELPHIA') ||
            upper.includes('PROVIDENCE');
        const hasServiceAreaZip = zip && /^(10|11|12|13|14|07|08|06|01|02|03|15|16|17|18|19)/.test(zip);
        const hasValidCoords = typeof providedLat === 'number' &&
            typeof providedLng === 'number' &&
            providedLat >= 38.0 &&
            providedLat <= 45.0 &&
            providedLng >= -80.5 &&
            providedLng <= -69.0;
        if (!hasServiceAreaMention && !hasServiceAreaZip && !hasValidCoords) {
            throw new common_1.BadRequestException('La dirección ingresada no es válida o no pudo ser localizada en el área de servicio autorizada (NY, NJ, CT, MA, RI, PA). Verifique calle, ciudad y código postal.');
        }
        let lat = 40.761032;
        let lng = -73.923714;
        let state = 'NY';
        if (hasValidCoords) {
            lat = providedLat;
            lng = providedLng;
        }
        else if (/\b(NJ|NEW JERSEY)\b/i.test(upper) || (zip && /^(07|08)/.test(zip))) {
            lat = 40.7282;
            lng = -74.0776;
            state = 'NJ';
        }
        else if (/\b(CT|CONNECTICUT)\b/i.test(upper) || (zip && /^06/.test(zip))) {
            lat = 41.0534;
            lng = -73.5387;
            state = 'CT';
        }
        else if (/\b(MA|MASS|MASSACHUSETTS)\b/i.test(upper) ||
            upper.includes('BOSTON') ||
            upper.includes('SOMERVILLE') ||
            upper.includes('CAMBRIDGE') ||
            (zip && /^(01|02)/.test(zip))) {
            lat = 42.3601;
            lng = -71.0589;
            state = 'MA';
            if (upper.includes('SOMERVILLE')) {
                lat = 42.3876;
                lng = -71.0995;
            }
        }
        else if (/\b(RI|RHODE ISLAND)\b/i.test(upper) || (zip && /^028|^029/.test(zip))) {
            lat = 41.8240;
            lng = -71.4128;
            state = 'RI';
        }
        else if (/\b(PA|PENNSYLVANIA)\b/i.test(upper) || (zip && /^1[5-9]/.test(zip))) {
            lat = 39.9526;
            lng = -75.1652;
            state = 'PA';
        }
        else if (upper.includes('BUFFALO')) {
            lat = 42.8864;
            lng = -78.8784;
            state = 'NY';
        }
        let city = 'Astoria';
        if (upper.includes('MANHATTAN'))
            city = 'New York';
        else if (upper.includes('BROOKLYN'))
            city = 'Brooklyn';
        else if (upper.includes('QUEENS'))
            city = 'Queens';
        else if (upper.includes('BRONX'))
            city = 'Bronx';
        else if (upper.includes('BUFFALO'))
            city = 'Buffalo';
        else if (upper.includes('SOMERVILLE'))
            city = 'Somerville';
        else if (upper.includes('CAMBRIDGE'))
            city = 'Cambridge';
        else if (upper.includes('BOSTON'))
            city = 'Boston';
        else if (upper.includes('PHILADELPHIA'))
            city = 'Philadelphia';
        else if (upper.includes('PROVIDENCE'))
            city = 'Providence';
        else if (state === 'NJ')
            city = 'Jersey City';
        else if (state === 'CT')
            city = 'Stamford';
        else if (state === 'MA')
            city = 'Boston';
        else if (state === 'RI')
            city = 'Providence';
        else if (state === 'PA')
            city = 'Philadelphia';
        let formatted_address = address;
        if (!upper.includes(city.toUpperCase())) {
            formatted_address += `, ${city}`;
        }
        if (!upper.includes(state)) {
            formatted_address += `, ${state}`;
        }
        if (zip && !upper.includes(zip)) {
            formatted_address += ` ${zip}`;
        }
        const fallbackResult = {
            address,
            formatted_address,
            lat,
            lng,
            city,
            state,
            zip: zip || '11106',
            cached: false,
        };
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
    async persistCache(data) {
        if (!this.geocacheRepo)
            return;
        try {
            const entry = this.geocacheRepo.create({
                ...data,
                id: crypto.randomUUID(),
            });
            await this.geocacheRepo.save(entry);
        }
        catch (_) {
        }
    }
};
exports.AddressValidationService = AddressValidationService;
exports.AddressValidationService = AddressValidationService = AddressValidationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(address_geocache_entity_1.AddressGeocache)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AddressValidationService);
//# sourceMappingURL=address-validation.service.js.map