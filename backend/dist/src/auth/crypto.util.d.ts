export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, storedValue: string): boolean;
export declare function signJwt(payload: any, expiresInSeconds?: number): string;
export declare function verifyJwt(token: string): any;
