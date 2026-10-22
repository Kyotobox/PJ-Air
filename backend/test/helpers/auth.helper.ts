import { signJwt } from '../../src/auth/crypto.util';

export function createTestJwt(user: { id: string; email?: string; role: string }): string {
  return signJwt({
    id: user.id,
    email: user.email || `${user.id}@test.com`,
    role: user.role,
  });
}

export function getAdminAuthHeaders(id: string = 'admin-e2e') {
  return {
    Authorization: `Bearer ${createTestJwt({ id, email: 'admin@test.com', role: 'admin' })}`,
  };
}

export function getClientAuthHeaders(id: string = 'client-e2e') {
  return {
    Authorization: `Bearer ${createTestJwt({ id, email: `${id}@test.com`, role: 'client' })}`,
  };
}

export function getDeliveryAuthHeaders(id: string = 'delivery-e2e') {
  return {
    Authorization: `Bearer ${createTestJwt({ id, email: `${id}@test.com`, role: 'delivery' })}`,
  };
}
