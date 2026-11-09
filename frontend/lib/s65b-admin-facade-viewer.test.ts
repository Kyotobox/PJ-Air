import { describe, it, expect } from 'vitest';

export interface TestAddress { 
    id: string; 
    address: string; 
    city: string; 
    state?: string; 
    zip_code?: string; 
    country?: string; 
    is_default?: boolean; 
    lat?: number;
    lng?: number;
    delivery_photos_json?: string;
}

export interface TestUserRecord {
    id: string;
    email: string;
    role: string;
    business_address?: string;
    facade_image_url?: string;
    company_name?: string;
    addresses?: TestAddress[];
}

export function extractClientFacade(user: TestUserRecord | null): string | null {
    if (!user) return null;
    if (user.addresses && Array.isArray(user.addresses)) {
        for (const addr of user.addresses) {
            if (addr.delivery_photos_json) {
                try {
                    const photos = JSON.parse(addr.delivery_photos_json);
                    if (Array.isArray(photos) && photos.length > 0 && typeof photos[0] === 'string' && photos[0].trim()) {
                        return photos[0].trim();
                    }
                } catch {}
            }
        }
    }
    if (user.facade_image_url && typeof user.facade_image_url === 'string' && user.facade_image_url.trim()) {
        return user.facade_image_url.trim();
    }
    return null;
}

export function extractAddressPhoto(addr: TestAddress | null): string | null {
    if (!addr?.delivery_photos_json) return null;
    try {
        const photos = JSON.parse(addr.delivery_photos_json);
        if (Array.isArray(photos) && photos.length > 0 && typeof photos[0] === 'string' && photos[0].trim()) {
            return photos[0].trim();
        }
    } catch {}
    return null;
}

export function resolveImageUrl(url: string | null, apiUrl: string = 'https://testing.jhoanes.com'): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${apiUrl || ''}${cleanUrl}`;
}

export function getGoogleMapsSearchUrl(addr?: TestAddress | null, fallbackAddress?: string | null): string {
    if (addr && typeof addr.lat === 'number' && typeof addr.lng === 'number' && !isNaN(addr.lat) && !isNaN(addr.lng)) {
        return `https://www.google.com/maps/search/?api=1&query=${addr.lat},${addr.lng}`;
    }
    const query = addr?.address || fallbackAddress || '';
    if (query) {
        const fullQuery = addr?.city ? `${query}, ${addr.city}` : query;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;
    }
    return 'https://www.google.com/maps';
}

describe('Sprint S65B Admin Facade Viewer & GPS Logic', () => {
    describe('extractClientFacade', () => {
        it('extracts facade photo url from address delivery_photos_json (Happy Path)', () => {
            const user: TestUserRecord = {
                id: 'u1',
                email: 'client@bakery.com',
                role: 'client',
                addresses: [
                    {
                        id: 'a1',
                        address: '74-12 Metropolitan Ave',
                        city: 'Middle Village',
                        is_default: true,
                        delivery_photos_json: JSON.stringify(['https://cdn.example.com/facade-1.jpg']),
                    }
                ]
            };
            expect(extractClientFacade(user)).toBe('https://cdn.example.com/facade-1.jpg');
        });

        it('falls back to user.facade_image_url if addresses have no photo (Happy Path)', () => {
            const user: TestUserRecord = {
                id: 'u2',
                email: 'client2@bakery.com',
                role: 'client',
                facade_image_url: '/uploads/addresses/facade-direct.jpg',
                addresses: [
                    {
                        id: 'a2',
                        address: '100 Main St',
                        city: 'New York',
                    }
                ]
            };
            expect(extractClientFacade(user)).toBe('/uploads/addresses/facade-direct.jpg');
        });

        it('handles malformed JSON in delivery_photos_json gracefully without crashing (Sad Path)', () => {
            const user: TestUserRecord = {
                id: 'u3',
                email: 'client3@bakery.com',
                role: 'client',
                addresses: [
                    {
                        id: 'a3',
                        address: '200 Main St',
                        city: 'Brooklyn',
                        delivery_photos_json: '{invalid-json',
                    }
                ]
            };
            expect(extractClientFacade(user)).toBeNull();
        });

        it('returns null when user is null or has no photos (Boundary Path)', () => {
            expect(extractClientFacade(null)).toBeNull();
            expect(extractClientFacade({ id: 'u4', email: 'empty@bakery.com', role: 'client' })).toBeNull();
        });
    });

    describe('getGoogleMapsSearchUrl', () => {
        it('builds GPS-accurate URL when lat and lng are available (Happy Path)', () => {
            const addr: TestAddress = {
                id: 'a1',
                address: '74-12 Metropolitan Ave',
                city: 'Middle Village',
                lat: 40.7135,
                lng: -73.8821,
            };
            const url = getGoogleMapsSearchUrl(addr);
            expect(url).toBe('https://www.google.com/maps/search/?api=1&query=40.7135,-73.8821');
        });

        it('builds address text search URL when coordinates are missing (Fallback Path)', () => {
            const addr: TestAddress = {
                id: 'a2',
                address: '74-12 Metropolitan Ave',
                city: 'Middle Village',
            };
            const url = getGoogleMapsSearchUrl(addr);
            expect(url).toBe('https://www.google.com/maps/search/?api=1&query=74-12%20Metropolitan%20Ave%2C%20Middle%20Village');
        });

        it('returns base Google Maps URL when no address or fallback is provided (Sad Path)', () => {
            expect(getGoogleMapsSearchUrl(null, null)).toBe('https://www.google.com/maps');
        });
    });

    describe('resolveImageUrl', () => {
        it('leaves remote URLs intact', () => {
            expect(resolveImageUrl('https://storage.googleapis.com/img.jpg')).toBe('https://storage.googleapis.com/img.jpg');
        });

        it('leaves data URLs intact', () => {
            expect(resolveImageUrl('data:image/jpeg;base64,abc123')).toBe('data:image/jpeg;base64,abc123');
        });

        it('prepends API_URL to relative paths', () => {
            expect(resolveImageUrl('/uploads/addresses/facade.jpg', 'https://api.jhoanes.com')).toBe('https://api.jhoanes.com/uploads/addresses/facade.jpg');
            expect(resolveImageUrl('uploads/addresses/facade.jpg', 'https://api.jhoanes.com')).toBe('https://api.jhoanes.com/uploads/addresses/facade.jpg');
        });

        it('returns empty string for null or empty input', () => {
            expect(resolveImageUrl(null)).toBe('');
            expect(resolveImageUrl('')).toBe('');
        });
    });
});
