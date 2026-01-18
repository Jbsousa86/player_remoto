import { db } from './firebase';
import {
    doc,
    onSnapshot,
    updateDoc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    deleteDoc
} from 'firebase/firestore';

export const syncService = {
    subscribeToScreen: (screenId, callback) => {
        const docRef = doc(db, 'screens', screenId);
        return onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                callback(doc.data());
            } else {
                callback(null);
            }
        });
    },

    updatePlaylist: async (screenId, playlist) => {
        const docRef = doc(db, 'screens', screenId);
        await updateDoc(docRef, { playlist });
    },

    subscribeToScreens: (callback) => {
        const q = collection(db, 'screens');
        return onSnapshot(q, (querySnapshot) => {
            const screens = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(screens);
        });
    },

    getScreens: async () => {
        const querySnapshot = await getDocs(collection(db, 'screens'));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    registerScreen: async (screenId, name) => {
        const docRef = doc(db, 'screens', screenId);
        await setDoc(docRef, { name, playlist: [], lastSeen: Date.now(), orientation: 'landscape' }, { merge: true });
        return screenId;
    },

    updateHeartbeat: async (screenId) => {
        const docRef = doc(db, 'screens', screenId);
        await updateDoc(docRef, { lastSeen: Date.now() });
    },

    sendReloadCommand: async (screenId) => {
        const docRef = doc(db, 'screens', screenId);
        await updateDoc(docRef, {
            command: {
                type: 'RELOAD',
                timestamp: Date.now()
            }
        });
    },

    updateScreen: async (screenId, data) => {
        const docRef = doc(db, 'screens', screenId);
        await updateDoc(docRef, data);
    },

    deleteScreen: async (screenId) => {
        const docRef = doc(db, 'screens', screenId);
        await deleteDoc(docRef);
    }
};
