import { describe, it, expect } from 'vitest';
import {
    parseAddressDetails,
    isDistantAddress,
    calculateDistanceMiles,
    passiveGeocodeOrFallback,
    ASTORIA_HQ,
} from '@/components/auth/RegisterForm';

describe('TASK-99-01: Soporte de direcciones distantes y fallback manual tolerante en RegisterForm', () => {
    describe('parseAddressDetails - Extracción y Normalización de Direcciones', () => {
        it('debe parsear correctamente una dirección local de NYC con calle, ciudad, estado y código postal', () => {
            const raw = '31-00 47th Ave, Long Island City, NY 11101, USA';
            const result = parseAddressDetails(raw);

            expect(result.street).toBe('31-00 47th Ave');
            expect(result.city).toBe('Long Island City');
            expect(result.state).toBe('NY');
            expect(result.zip).toBe('11101');
            expect(result.isDistant).toBe(false);
        });

        it('debe parsear una dirección foránea/distante en Florida y marcarla como distante', () => {
            const raw = '1200 S Ocean Dr, Hollywood, FL 33019';
            const result = parseAddressDetails(raw);

            expect(result.street).toBe('1200 S Ocean Dr');
            expect(result.city).toBe('Hollywood');
            expect(result.state).toBe('FL');
            expect(result.zip).toBe('33019');
            expect(result.isDistant).toBe(true);
        });

        it('debe parsear una dirección foránea/distante en California y marcarla como distante', () => {
            const raw = '500 West Temple St, Los Angeles, CA 90012, USA';
            const result = parseAddressDetails(raw);

            expect(result.street).toBe('500 West Temple St');
            expect(result.city).toBe('Los Angeles');
            expect(result.state).toBe('CA');
            expect(result.zip).toBe('90012');
            expect(result.isDistant).toBe(true);
        });

        it('debe parsear una dirección foránea/distante en Texas y marcarla como distante', () => {
            const raw = '700 Main St, Dallas, TX 75202';
            const result = parseAddressDetails(raw);

            expect(result.street).toBe('700 Main St');
            expect(result.city).toBe('Dallas');
            expect(result.state).toBe('TX');
            expect(result.zip).toBe('75202');
            expect(result.isDistant).toBe(true);
        });

        // ── SAD PATH MANDATORIO (§6) ──
        it('SAD PATH: debe lanzar excepción cuando el string de dirección es nulo, vacío o puros espacios', () => {
            expect(() => parseAddressDetails('')).toThrow('Address string is required for parsing');
            expect(() => parseAddressDetails('   ')).toThrow('Address string is required for parsing');
            expect(() => parseAddressDetails(null as any)).toThrow('Address string is required for parsing');
            expect(() => parseAddressDetails(undefined as any)).toThrow('Address string is required for parsing');
        });

        it('debe tolerar direcciones sin comas sin lanzar error imprevisto', () => {
            const raw = '123 Broadway 11106';
            const result = parseAddressDetails(raw);
            expect(result.street).toBe('123 Broadway 11106');
            expect(result.zip).toBe('11106');
            expect(result.isDistant).toBe(false);
        });
    });

    describe('isDistantAddress y calculateDistanceMiles - Cálculo de Radio de Cobertura', () => {
        it('debe identificar ubicación dentro del radio local de 30 millas desde Astoria HQ', () => {
            // Ubicación cercana en Queens (ej. 40.7500, -73.9300)
            const isDistant = isDistantAddress({
                lat: 40.7500,
                lng: -73.9300,
            });
            expect(isDistant).toBe(false);
        });

        it('debe identificar ubicación distante por coordenadas (> 30 millas desde Astoria)', () => {
            // Buffalo, NY (~290 millas en línea recta)
            const isDistant = isDistantAddress({
                lat: 42.8864,
                lng: -78.8784,
            });
            expect(isDistant).toBe(true);
        });

        it('debe identificar ubicación distante por estado foráneo o código postal', () => {
            expect(isDistantAddress({ state: 'FL', zip: '33019' })).toBe(true);
            expect(isDistantAddress({ state: 'CA', zip: '90210' })).toBe(true);
            expect(isDistantAddress({ address: '123 Ocean Dr, Miami Beach, FL' })).toBe(true);
        });

        it('debe calcular correctamente la distancia en millas con factor terrestre', () => {
            const distAstoriaToAstoria = calculateDistanceMiles(
                ASTORIA_HQ.lat,
                ASTORIA_HQ.lng,
                ASTORIA_HQ.lat,
                ASTORIA_HQ.lng
            );
            expect(distAstoriaToAstoria).toBe(0);

            // Distancia a Buffalo (~290 millas haversine directas)
            const distToBuffalo = calculateDistanceMiles(
                ASTORIA_HQ.lat,
                ASTORIA_HQ.lng,
                42.8864,
                -78.8784
            );
            expect(distToBuffalo).toBeGreaterThan(250);
        });
    });

    describe('passiveGeocodeOrFallback - Tolerancia Pasiva y Cero Bloqueos', () => {
        it('debe resolver coordenadas cuando el Geocoder responde con éxito', async () => {
            const mockGeocoder = {
                geocode: (req: any, callback: any) => {
                    callback(
                        [
                            {
                                formatted_address: '1200 S Ocean Dr, Hollywood, FL 33019, USA',
                                geometry: {
                                    location: {
                                        lat: () => 25.9984,
                                        lng: () => -80.1189,
                                    },
                                },
                                address_components: [
                                    { long_name: 'Hollywood', types: ['locality'] },
                                    { long_name: '33019', types: ['postal_code'] },
                                ],
                            },
                        ],
                        'OK'
                    );
                },
            };

            const result = await passiveGeocodeOrFallback('1200 S Ocean Dr, Hollywood, FL 33019', mockGeocoder);
            expect(result.lat).toBe(25.9984);
            expect(result.lng).toBe(-80.1189);
            expect(result.city).toBe('Hollywood');
            expect(result.zip).toBe('33019');
            expect(result.isManualFallback).toBe(false);
        });

        it('debe aplicar fallback tolerante pasivo si el Geocoder falla o responde ZERO_RESULTS sin lanzar error', async () => {
            const failingGeocoder = {
                geocode: (req: any, callback: any) => {
                    callback(null, 'ZERO_RESULTS');
                },
            };

            const result = await passiveGeocodeOrFallback('700 Main St, Dallas, TX 75202', failingGeocoder);
            expect(result.lat).toBeNull();
            expect(result.lng).toBeNull();
            expect(result.city).toBe('Dallas');
            expect(result.zip).toBe('75202');
            expect(result.isManualFallback).toBe(true);
        });

        it('debe aplicar resolución pasiva si no hay Geocoder disponible (offline-first / adblocker)', async () => {
            const result = await passiveGeocodeOrFallback('123 Ocean Dr, Miami, FL 33139', undefined);
            expect(result.lat).toBeNull();
            expect(result.lng).toBeNull();
            expect(result.city).toBe('Miami');
            expect(result.zip).toBe('33139');
            expect(result.isManualFallback).toBe(true);
        });

        // ── SAD PATH MANDATORIO (§6) ──
        it('SAD PATH: debe rechazar cuando el query de dirección es vacío o nulo', async () => {
            await expect(passiveGeocodeOrFallback('')).rejects.toThrow('Address query cannot be empty');
            await expect(passiveGeocodeOrFallback('   ')).rejects.toThrow('Address query cannot be empty');
            await expect(passiveGeocodeOrFallback(null as any)).rejects.toThrow('Address query cannot be empty');
        });
    });
});
