import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { META_PIXEL_ID, trackMetaEvent } from './MetaPixel';

describe('MetaPixel analytics helper and standard events', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  it('exposes the certified Meta Pixel ID (2166007261006109)', () => {
    expect(META_PIXEL_ID).toBe('2166007261006109');
  });

  it('safely handles missing window.fbq without throwing exceptions (sad path / SSR)', () => {
    // fbq is undefined
    delete (window as any).fbq;
    expect(() => {
      trackMetaEvent('PageView');
      trackMetaEvent('ViewContent', { content_name: 'Catalog' });
    }).not.toThrow();
  });

  it('safely handles undefined global window without throwing exceptions (SSR sad path)', () => {
    const prevWindow = global.window;
    try {
      // simulate SSR by removing window from global
      delete (global as any).window;
      expect(() => {
        trackMetaEvent('PageView');
      }).not.toThrow();
    } finally {
      (global as any).window = prevWindow;
    }
  });

  it('calls window.fbq track with standard ViewContent event and payload', () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;

    trackMetaEvent('ViewContent', { content_name: 'Wholesale Catalog', content_category: 'Bakery' });

    expect(mockFbq).toHaveBeenCalledTimes(1);
    expect(mockFbq).toHaveBeenCalledWith('track', 'ViewContent', {
      content_name: 'Wholesale Catalog',
      content_category: 'Bakery',
    });
  });

  it('calls window.fbq track with standard CompleteRegistration event and payload', () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;

    trackMetaEvent('CompleteRegistration', { status: 'success', content_name: 'Wholesale Registration' });

    expect(mockFbq).toHaveBeenCalledTimes(1);
    expect(mockFbq).toHaveBeenCalledWith('track', 'CompleteRegistration', {
      status: 'success',
      content_name: 'Wholesale Registration',
    });
  });

  it('calls window.fbq track with standard Purchase event and payload', () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;

    trackMetaEvent('Purchase', {
      value: 245.5,
      currency: 'USD',
      content_type: 'product',
      order_id: 'ord-9988',
    });

    expect(mockFbq).toHaveBeenCalledTimes(1);
    expect(mockFbq).toHaveBeenCalledWith('track', 'Purchase', {
      value: 245.5,
      currency: 'USD',
      content_type: 'product',
      order_id: 'ord-9988',
    });
  });
});
