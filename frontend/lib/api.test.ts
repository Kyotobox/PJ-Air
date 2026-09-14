import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Fake global fetch — replaced per-test via mockResolvedValueOnce
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to build a minimal Response-like object
function makeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined || body === '' ? '' : JSON.stringify(body)),
  };
}

// ---------------------------------------------------------------------------
// api.get()
// ---------------------------------------------------------------------------
describe('api.get()', () => {
  beforeEach(() => mockFetch.mockClear());

  it('returns parsed JSON on a 200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { name: 'Cookie Croissant' }));
    const result = await api.get('/products/1');
    expect(result).toEqual({ name: 'Cookie Croissant' });
  });

  it('calls the correct URL (API_URL + path)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get('/products');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/products'),
      expect.any(Object),
    );
  });

  it('throws an Error with the server message on a non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(404, { message: 'Not found' }));
    await expect(api.get('/products/999')).rejects.toThrow('Not found');
  });

  it('throws a fallback message when error body has no message field', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, {}));
    await expect(api.get('/crash')).rejects.toThrow('Error en la petición');
  });

  it('handles an empty body (204-style) without crashing', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, ''));
    const result = await api.get('/healthz');
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// api.post()
// ---------------------------------------------------------------------------
describe('api.post()', () => {
  beforeEach(() => mockFetch.mockClear());

  it('sends Content-Type: application/json', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(201, { id: 1 }));
    await api.post('/auth/login', { email: 'a@b.com', password: '123' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('serialises the body to JSON', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(201, {}));
    await api.post('/auth/login', { email: 'a@b.com' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.com' }));
  });
});

// ---------------------------------------------------------------------------
// api.delete()
// ---------------------------------------------------------------------------
describe('api.delete()', () => {
  beforeEach(() => mockFetch.mockClear());

  it('returns true on a successful deletion', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' });
    const result = await api.delete('/products/1');
    expect(result).toBe(true);
  });

  it('throws on a non-ok deletion response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(403, { message: 'Forbidden' }));
    await expect(api.delete('/products/1')).rejects.toThrow('Forbidden');
  });
});
