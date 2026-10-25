import * as admin from 'firebase-admin';

let isFirebaseAdminInitialized = false;

export function getFirebaseAdmin(): typeof admin | null {
  if (isFirebaseAdminInitialized) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      isFirebaseAdminInitialized = true;
      return admin;
    } catch (e) {
      console.warn('Could not initialize Firebase Admin:', e);
      return null;
    }
  } else if (projectId) {
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId,
        });
      }
      isFirebaseAdminInitialized = true;
      return admin;
    } catch (e) {
      console.warn('Could not initialize Firebase Admin with projectId:', e);
      return null;
    }
  }
  return null;
}
