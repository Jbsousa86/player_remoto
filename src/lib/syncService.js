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

export const DEFAULT_TICKER = {
    text: 'Bem-vindo ao Totem Digital! {{hora}} • {{data}}',
    isActive: true
};

export const DEFAULT_RSS_URL = 'https://g1.globo.com/rss/g1/';

const DEFAULT_RSS_ITEM = {
    id: `default-news-${Date.now()}`,
    type: 'news',
    url: DEFAULT_RSS_URL,
    duration: 20,
    fitMode: 'cover',
    isActive: true,
    order: 1
};

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
        await setDoc(docRef, { 
            name, 
            playlist: [DEFAULT_RSS_ITEM], 
            lastSeen: Date.now(), 
            orientation: 'landscape', 
            isMuted: true,
            isPlaying: true,
            volume: 100,
            ticker: DEFAULT_TICKER
        }, { merge: true });
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
