import { describe, it, expect } from 'vitest';

// ── Address component parsing logic (as used in RegisterForm onPlaceChanged) ──
export function parsePlaceResult(place: {
    formatted_address?: string;
    name?: string;
    geometry?: { location?: { lat: () => number; lng: () => number } };
    address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
}) {
    if (!place || typeof place !== 'object') {
        throw new Error('Invalid place object');
    }

    let lat: number | null = null;
    let lng: number | null = null;
    if (place.geometry?.location) {
        lat = place.geometry.location.lat();
        lng = place.geometry.location.lng();
    }

    let city = '';
    let postalCode = '';
    if (place.address_components && Array.isArray(place.address_components)) {
        for (const comp of place.address_components) {
            if (comp.types.includes('locality')) {
                city = comp.long_name;
            } else if (!city && comp.types.includes('sublocality_level_1')) {
                city = comp.long_name;
            } else if (!city && comp.types.includes('neighborhood')) {
                city = comp.long_name;
            }
            if (comp.types.includes('postal_code')) {
                postalCode = comp.long_name;
            }
        }
    }

    const formattedAddress = place.formatted_address || place.name || '';
    if (!formattedAddress) {
        throw new Error('Place must have either formatted_address or name');
    }

    return {
        formattedAddress,
        city,
        postalCode,
        lat,
        lng,
    };
}

// ── Facade file validation logic ──
export function validateFacadeFile(file: { type: string; size: number }) {
    if (!file) {
        throw new Error('No file provided');
    }
    if (!file.type || !file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
    }
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
        throw new Error('The image size must be under 10MB');
    }
    return true;
}

// ── Image source resolver ──
export function resolveImageUrl(value: string | null | undefined, apiUrl: string = 'http://localhost:3001'): string {
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
        return value;
    }
    return `${apiUrl}${value.startsWith('/') ? '' : '/'}${value}`;
}

describe('Sprint S65A - Register Places & Facade Logic', () => {
    describe('parsePlaceResult (Happy & Sad Paths)', () => {
        it('should correctly parse a complete Google Place result', () => {
            const mockPlace = {
                formatted_address: '31-00 47th Ave, Long Island City, NY 11101, USA',
                geometry: {
                    location: {
                        lat: () => 40.7484,
                        lng: () => -73.9413,
                    },
                },
                address_components: [
                    { long_name: '31-00', short_name: '31-00', types: ['street_number'] },
                    { long_name: '47th Avenue', short_name: '47th Ave', types: ['route'] },
                    { long_name: 'Long Island City', short_name: 'LIC', types: ['locality', 'political'] },
                    { long_name: '11101', short_name: '11101', types: ['postal_code'] },
                ],
            };

            const result = parsePlaceResult(mockPlace);
            expect(result.formattedAddress).toBe('31-00 47th Ave, Long Island City, NY 11101, USA');
            expect(result.city).toBe('Long Island City');
            expect(result.postalCode).toBe('11101');
            expect(result.lat).toBe(40.7484);
            expect(result.lng).toBe(-73.9413);
        });

        it('should fallback to name when formatted_address is absent', () => {
            const mockPlace = {
                name: 'C-Town Supermarket Astoria',
                geometry: {
                    location: {
                        lat: () => 40.7628,
                        lng: () => -73.9262,
                    },
                },
                address_components: [
                    { long_name: 'Astoria', short_name: 'Astoria', types: ['neighborhood'] },
                    { long_name: '11102', short_name: '11102', types: ['postal_code'] },
                ],
            };

            const result = parsePlaceResult(mockPlace);
            expect(result.formattedAddress).toBe('C-Town Supermarket Astoria');
            expect(result.city).toBe('Astoria');
            expect(result.postalCode).toBe('11102');
            expect(result.lat).toBe(40.7628);
            expect(result.lng).toBe(-73.9262);
        });

        it('sad path: should throw when place is empty or lacks both address and name', () => {
            expect(() => parsePlaceResult(null as any)).toThrow('Invalid place object');
            expect(() => parsePlaceResult({} as any)).toThrow('Place must have either formatted_address or name');
        });
    });

    describe('validateFacadeFile (Happy & Sad Paths)', () => {
        it('should accept valid jpeg/png image under 10MB', () => {
            expect(validateFacadeFile({ type: 'image/jpeg', size: 1024 * 500 })).toBe(true);
            expect(validateFacadeFile({ type: 'image/png', size: 2 * 1024 * 1024 })).toBe(true);
        });

        it('sad path: should throw when file is not an image (e.g. PDF)', () => {
            expect(() => validateFacadeFile({ type: 'application/pdf', size: 1024 })).toThrow('Only image files are allowed');
        });

        it('sad path: should throw when image exceeds 10MB size limit', () => {
            expect(() => validateFacadeFile({ type: 'image/jpeg', size: 15 * 1024 * 1024 })).toThrow('The image size must be under 10MB');
        });

        it('sad path: should throw when file is null/undefined', () => {
            expect(() => validateFacadeFile(null as any)).toThrow('No file provided');
        });
    });

    describe('resolveImageUrl (Happy & Edge Cases)', () => {
        it('should keep full URLs untouched', () => {
            expect(resolveImageUrl('https://example.com/facade.jpg')).toBe('https://example.com/facade.jpg');
            expect(resolveImageUrl('http://cdn.org/img.png')).toBe('http://cdn.org/img.png');
        });

        it('should keep data URLs untouched', () => {
            const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...';
            expect(resolveImageUrl(dataUrl)).toBe(dataUrl);
        });

        it('should prepend apiUrl for relative uploaded paths', () => {
            expect(resolveImageUrl('/uploads/addresses/facade-123.jpg', 'http://localhost:3001'))
                .toBe('http://localhost:3001/uploads/addresses/facade-123.jpg');
        });

        it('should return empty string for null or empty input', () => {
            expect(resolveImageUrl(null)).toBe('');
            expect(resolveImageUrl('')).toBe('');
        });
    });
});
