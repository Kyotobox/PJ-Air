import { API_URL } from '@/lib/config';


async function handleResponse(response: Response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing JSON response', e);
    }
  }

  if (response.status === 401 && !response.url.includes('/auth/login')) {
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
    throw new Error((data as any).message || 'Error en la petición');
  }
  return data;
}

function getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
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
  return headers;
}

export const api = {
  async post(path: string, body: any = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
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
