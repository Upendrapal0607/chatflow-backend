import fs from 'fs';
import path from 'path';
import { App, cert, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import config from '../config';

export interface FirestoreClient {
    db: Firestore;
    ping: () => Promise<boolean>;
}

let firebaseApp: App | null = null;
let firestoreInstance: Firestore | null = null;

const parseServiceAccountJson = (rawValue: string): ServiceAccount => {
    const trimmed = rawValue.trim();
    const jsonString = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
    return JSON.parse(jsonString) as ServiceAccount;
};

const loadServiceAccount = (): ServiceAccount | null => {
    if (config.firebase.serviceAccountPath) {
        const resolvedPath = path.resolve(config.firebase.serviceAccountPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Firebase service account file not found at: ${resolvedPath}`);
        }
        const raw = fs.readFileSync(resolvedPath, 'utf8');
        return JSON.parse(raw) as ServiceAccount;
    }

    if (config.firebase.serviceAccountJson) {
        return parseServiceAccountJson(config.firebase.serviceAccountJson);
    }

    if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
        return {
            projectId: config.firebase.projectId,
            clientEmail: config.firebase.clientEmail,
            privateKey: config.firebase.privateKey,
        };
    }

    return null;
};

export const getFirebaseApp = (): App => {
    if (firebaseApp) {
        return firebaseApp;
    }

    const existing = getApps();
    if (existing.length > 0 && existing[0]) {
        firebaseApp = existing[0];
        return firebaseApp;
    }

    if (config.firebase.emulatorHost) {
        process.env.FIRESTORE_EMULATOR_HOST = config.firebase.emulatorHost;
        firebaseApp = initializeApp({
            projectId: config.firebase.projectId ?? 'chatflow-local',
        });
        return firebaseApp;
    }

    const serviceAccount = loadServiceAccount();
    if (serviceAccount) {
        firebaseApp = initializeApp({
            credential: cert(serviceAccount),
            projectId: config.firebase.projectId ?? serviceAccount.projectId,
        });
        return firebaseApp;
    }

    firebaseApp = initializeApp(
        config.firebase.projectId ? { projectId: config.firebase.projectId } : undefined,
    );
    return firebaseApp;
};

export const getFirestoreDb = (): Firestore => {
    if (!firestoreInstance) {
        firestoreInstance = getFirestore(getFirebaseApp());
        firestoreInstance.settings({ ignoreUndefinedProperties: true });
    }
    return firestoreInstance;
};

export const makeFirestore = (): FirestoreClient => {
    const db = getFirestoreDb();
    return {
        db,
        ping: async (): Promise<boolean> => {
            await db.listCollections();
            return true;
        },
    };
};

export const disconnectFirestore = async (): Promise<void> => {
    if (firestoreInstance) {
        await firestoreInstance.terminate();
        firestoreInstance = null;
    }
};
