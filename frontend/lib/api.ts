import { API_URL } from '@/lib/config';


async function handleResponse(response: Response) {
  const text = await response.text();
  let data: any = null;
  if (text && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing JSON response', e);
      data = null;
    }
  }

  if (response.status === 401 && !(response.url && response.url.includes('/auth/login'))) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('local_session');
      document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'session_role=; path=/; max-age=0; SameSite=Lax';
      const currentPath = window.location.pathname;
      if (currentPath !== '/auth/login' && currentPath !== '/auth/register') {
        window.location.href = '/auth/login';
      }
    }
    throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
  }

  if (!response.ok) {
    throw new Error((data as any)?.message || 'Error en la petición');
  }
  return data;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const savedSession = localStorage.getItem('local_session');
  if (savedSession) {
    try {
      const { session } = JSON.parse(savedSession);
      if (session?.access_token) return session.access_token;
    } catch (_) {}
  }
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

function getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  async post(path: string, body: any = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async upload(path: string, formData: FormData) {
    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
    return handleResponse(response);
  },

  async put(path: string, body: any = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async patch(path: string, body: any = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async get(path: string) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async download(path: string, defaultFilename: string = 'reporte.xlsx') {
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('local_session');
      if (savedSession) {
        try {
          const { session } = JSON.parse(savedSession);
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        } catch (e) {}
      }
    }
    const response = await fetch(`${API_URL}${path}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Error al descargar el archivo');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async delete(path: string) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      const text = await response.text();
      let data = { message: '' };
      try {
        data = text ? JSON.parse(text) : { message: '' };
      } catch (e) {}
      throw new Error(data.message || 'Error en la petición');
    }
    return true;
  }
};
