
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const DATA_FILENAME = 'sigma_local_data.json';
const SYNC_QUEUE_FILENAME = 'sigma_sync_queue.json';

const TEST_DATA_FILENAME = 'sigma_test_local_data.json';
const TEST_SYNC_QUEUE_FILENAME = 'sigma_test_sync_queue.json';

export interface LocalData {
    taxpayers: any[];
    transactions: any[];
    agenda: any[];
    adminRequests: any[];
    users: any[];
    config: any | null;
    lastSync: string | null;
    chatMessages?: any[]; // To support offline chat testing
}

const initialData: LocalData = {
    taxpayers: [],
    transactions: [],
    agenda: [],
    adminRequests: [],
    users: [],
    config: null,
    lastSync: null,
    chatMessages: []
};

const hasCredentials = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const storedTestMode = localStorage.getItem('sigma_test_mode');
let _isTestMode = storedTestMode !== null ? storedTestMode === 'true' : !hasCredentials;

const getFilename = (isTest: boolean) => isTest ? TEST_DATA_FILENAME : DATA_FILENAME;
const getSyncQueueFilename = (isTest: boolean) => isTest ? TEST_SYNC_QUEUE_FILENAME : SYNC_QUEUE_FILENAME;
const getStorageKey = (isTest: boolean) => isTest ? 'sigma_test_local_data' : 'sigma_local_data';
const getSyncQueueStorageKey = (isTest: boolean) => isTest ? 'sigma_test_sync_queue' : 'sigma_sync_queue';

export const localStore = {
    isTestMode: () => _isTestMode,
    
    setTestMode: async (active: boolean) => {
        _isTestMode = active;
        localStorage.setItem('sigma_test_mode', String(active));
        
        // If enabling test mode, check if test data exists. If not, copy production data!
        if (active) {
            const testDataExists = await localStore.hasTestData();
            if (!testDataExists) {
                console.log("[localStore] Initializing Test Mode database with a copy of production database.");
                const prodData = await localStore.loadDataRaw(false);
                await localStore.saveDataRaw(prodData, true);
                
                // Start with an empty sync queue for test mode
                await localStore.saveSyncQueueRaw([], true);
            }
        }
    },

    hasTestData: async (): Promise<boolean> => {
        if ((window as any).electronAPI) {
            const res = await (window as any).electronAPI.backup.load('sigma_test_data');
            return !!(res && res.data && res.data.taxpayers && res.data.taxpayers.length > 0);
        }
        if (Capacitor.isNativePlatform()) {
            try {
                const res = await Filesystem.readFile({
                    path: TEST_DATA_FILENAME,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });
                const d = JSON.parse(res.data as string);
                return !!(d && d.taxpayers && d.taxpayers.length > 0);
            } catch (e) {
                return false;
            }
        }
        const stored = localStorage.getItem('sigma_test_local_data');
        if (!stored) return false;
        try {
            const d = JSON.parse(stored);
            return !!(d && d.taxpayers && d.taxpayers.length > 0);
        } catch (e) {
            return false;
        }
    },

    saveData: async (data: LocalData) => {
        return localStore.saveDataRaw(data, _isTestMode);
    },

    loadData: async (): Promise<LocalData> => {
        return localStore.loadDataRaw(_isTestMode);
    },

    saveSyncQueue: async (queue: any[]) => {
        return localStore.saveSyncQueueRaw(queue, _isTestMode);
    },

    loadSyncQueue: async (): Promise<any[]> => {
        return localStore.loadSyncQueueRaw(_isTestMode);
    },

    /**
     * Saves the entire data object to a local file (internal raw)
     */
    saveDataRaw: async (data: LocalData, isTest: boolean) => {
        const json = JSON.stringify(data, null, 2);
        const filename = getFilename(isTest);
        const storageKey = getStorageKey(isTest);
        
        // 1. Electron handling
        if ((window as any).electronAPI) {
            await (window as any).electronAPI.backup.save(isTest ? 'sigma_test_data' : 'sigma_data', data);
            return;
        }

        // 2. Capacitor handling
        if (Capacitor.isNativePlatform()) {
            try {
                await Filesystem.writeFile({
                    path: filename,
                    data: json,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8,
                    recursive: true
                });
                return;
            } catch (e) {
                console.error("Error saving to Filesystem:", e);
            }
        }

        // 3. Fallback to localStorage
        localStorage.setItem(storageKey, json);
    },

    /**
     * Loads data from local file (internal raw)
     */
    loadDataRaw: async (isTest: boolean): Promise<LocalData> => {
        let data: LocalData | null = null;
        const filename = getFilename(isTest);
        const storageKey = getStorageKey(isTest);

        // 1. Electron handling
        if ((window as any).electronAPI) {
            const res = await (window as any).electronAPI.backup.load(isTest ? 'sigma_test_data' : 'sigma_data');
            data = res.data;
        } else if (Capacitor.isNativePlatform()) {
            // 2. Capacitor handling
            try {
                const res = await Filesystem.readFile({
                    path: filename,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });
                data = JSON.parse(res.data as string);
            } catch (e) {
                data = null;
            }
        } else {
            // 3. Fallback to localStorage
            const stored = localStorage.getItem(storageKey);
            data = stored ? JSON.parse(stored) : null;
        }

        // If data exists and has taxpayers, return it
        if (data && data.taxpayers && data.taxpayers.length > 0) {
            return data;
        }

        // Load the initial seed when no data is present
        try {
            console.log(`[SIGMA localStore] No local database or empty. Loading bundled initial_seed.json (isTest=${isTest})...`);
            const response = await fetch('./initial_seed.json');
            if (response.ok) {
                const seed = await response.json();
                if (seed && seed.taxpayers && seed.taxpayers.length > 0) {
                    console.log(`[SIGMA localStore] Bundled seed loaded successfully with ${seed.taxpayers.length} taxpayers! Saving locally...`);
                    const finalData = { ...initialData, ...seed };
                    await localStore.saveDataRaw(finalData, isTest);
                    return finalData;
                }
            }
        } catch (e) {
            console.warn("[SIGMA localStore] Bundled seed file not available, falling back to empty database:", e);
        }

        return data || initialData;
    },

    /**
     * Manages the sync queue (pending changes to push to Supabase) (internal raw)
     */
    saveSyncQueueRaw: async (queue: any[], isTest: boolean) => {
        const json = JSON.stringify(queue);
        const filename = getSyncQueueFilename(isTest);
        const storageKey = getSyncQueueStorageKey(isTest);

        if ((window as any).electronAPI) {
            await (window as any).electronAPI.backup.save(isTest ? 'sync_test_queue' : 'sync_queue', queue);
            return;
        }
        if (Capacitor.isNativePlatform()) {
            await Filesystem.writeFile({
                path: filename,
                data: json,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });
            return;
        }
        localStorage.setItem(storageKey, json);
    },

    loadSyncQueueRaw: async (isTest: boolean): Promise<any[]> => {
        const filename = getSyncQueueFilename(isTest);
        const storageKey = getSyncQueueStorageKey(isTest);

        if ((window as any).electronAPI) {
            const res = await (window as any).electronAPI.backup.load(isTest ? 'sync_test_queue' : 'sync_queue');
            return res.data || [];
        }
        if (Capacitor.isNativePlatform()) {
            try {
                const res = await Filesystem.readFile({
                    path: filename,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });
                return JSON.parse(res.data as string);
            } catch (e) {
                return [];
            }
        }
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : [];
    }
};
