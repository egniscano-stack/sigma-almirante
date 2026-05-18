
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const DATA_FILENAME = 'sigma_local_data.json';
const SYNC_QUEUE_FILENAME = 'sigma_sync_queue.json';

export interface LocalData {
    taxpayers: any[];
    transactions: any[];
    agenda: any[];
    adminRequests: any[];
    users: any[];
    config: any | null;
    lastSync: string | null;
}

const initialData: LocalData = {
    taxpayers: [],
    transactions: [],
    agenda: [],
    adminRequests: [],
    users: [],
    config: null,
    lastSync: null
};

export const localStore = {
    /**
     * Saves the entire data object to a local file
     */
    saveData: async (data: LocalData) => {
        const json = JSON.stringify(data, null, 2);
        
        // 1. Electron handling
        if ((window as any).electronAPI) {
            await (window as any).electronAPI.backup.save('sigma_data', data);
            return;
        }

        // 2. Capacitor handling
        if (Capacitor.isNativePlatform()) {
            try {
                await Filesystem.writeFile({
                    path: DATA_FILENAME,
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
        localStorage.setItem('sigma_local_data', json);
    },

    /**
     * Loads data from local file
     */
    loadData: async (): Promise<LocalData> => {
        let data: LocalData | null = null;

        // 1. Electron handling
        if ((window as any).electronAPI) {
            const res = await (window as any).electronAPI.backup.load('sigma_data');
            data = res.data;
        } else if (Capacitor.isNativePlatform()) {
            // 2. Capacitor handling
            try {
                const res = await Filesystem.readFile({
                    path: DATA_FILENAME,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });
                data = JSON.parse(res.data as string);
            } catch (e) {
                data = null;
            }
        } else {
            // 3. Fallback to localStorage
            const stored = localStorage.getItem('sigma_local_data');
            data = stored ? JSON.parse(stored) : null;
        }

        // If data exists and has taxpayers, return it
        if (data && data.taxpayers && data.taxpayers.length > 0) {
            return data;
        }

        // Otherwise, attempt to load from bundled initial_seed.json
        try {
            console.log("[SIGMA localStore] No local database or empty. Loading bundled initial_seed.json...");
            const response = await fetch('./initial_seed.json');
            if (response.ok) {
                const seed = await response.json();
                if (seed && seed.taxpayers && seed.taxpayers.length > 0) {
                    console.log(`[SIGMA localStore] Bundled seed loaded successfully with ${seed.taxpayers.length} taxpayers! Saving locally...`);
                    // Save seed locally so it's permanently stored and editable
                    const finalData = { ...initialData, ...seed };
                    await localStore.saveData(finalData);
                    return finalData;
                }
            }
        } catch (e) {
            console.warn("[SIGMA localStore] Bundled seed file not available, falling back to empty database:", e);
        }

        return data || initialData;
    },

    /**
     * Manages the sync queue (pending changes to push to Supabase)
     */
    saveSyncQueue: async (queue: any[]) => {
        const json = JSON.stringify(queue);
        if ((window as any).electronAPI) {
            await (window as any).electronAPI.backup.save('sync_queue', queue);
            return;
        }
        if (Capacitor.isNativePlatform()) {
            await Filesystem.writeFile({
                path: SYNC_QUEUE_FILENAME,
                data: json,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });
            return;
        }
        localStorage.setItem('sigma_sync_queue', json);
    },

    loadSyncQueue: async (): Promise<any[]> => {
        if ((window as any).electronAPI) {
            const res = await (window as any).electronAPI.backup.load('sync_queue');
            return res.data || [];
        }
        if (Capacitor.isNativePlatform()) {
            try {
                const res = await Filesystem.readFile({
                    path: SYNC_QUEUE_FILENAME,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });
                return JSON.parse(res.data as string);
            } catch (e) {
                return [];
            }
        }
        const stored = localStorage.getItem('sigma_sync_queue');
        return stored ? JSON.parse(stored) : [];
    }
};
