import 'server-only';

import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function readServiceAccount(variableName: string): ServiceAccount {
  const encoded = process.env[variableName];
  if (!encoded) {
    throw new Error(`Missing server environment variable: ${variableName}`);
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ServiceAccount;
  } catch {
    throw new Error(`${variableName} must contain a Base64-encoded service-account JSON file.`);
  }
}

function getOrCreateAdminApp(name: string, variableName: string, storageBucket?: string): App {
  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;

  const serviceAccount = readServiceAccount(variableName);
  return initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
      ...(storageBucket ? { storageBucket } : {}),
    },
    name,
  );
}

export function getMrGymAdminServices() {
  const app = getOrCreateAdminApp('mr-gym-admin-server', 'MRGYM_SERVICE_ACCOUNT_BASE64');
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

export function getDotsProfileBucket() {
  const bucketName = process.env.DOTS_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('Missing server environment variable: DOTS_STORAGE_BUCKET');
  }

  const app = getOrCreateAdminApp('dots-storage-server', 'DOTS_SERVICE_ACCOUNT_BASE64', bucketName);
  return getStorage(app).bucket(bucketName);
}
