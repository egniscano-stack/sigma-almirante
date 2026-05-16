
import { Network } from '@capacitor/network';
import { supabase } from './supabaseClient';
import { localStore, LocalData } from './localStore';
import { remoteDb } from './db';

export type SyncActionType = 
    | 'CREATE_TAXPAYER' | 'UPDATE_TAXPAYER' | 'DELETE_TAXPAYER'
    | 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION'
    | 'CREATE_AGENDA' | 'UPDATE_AGENDA'
    | 'CREATE_ADMIN_REQUEST' | 'UPDATE_ADMIN_REQUEST';

export interface SyncAction {
    id: string;
    type: SyncActionType;
    data: any;
    timestamp: string;
}

class SyncService {
    private queue: SyncAction[] = [];
    private isSyncing = false;
    private networkStatus: 'online' | 'offline' = 'online';

    constructor() {
        this.init();
    }

    async init() {
        const localData = await localStore.loadData();
        this.queue = await localStore.loadSyncQueue();
        
        // --- SEEDING DEFAULT USERS ON FIRST INSTALL ---
        if (!localData.users || localData.users.length === 0) {
            console.log("Seeding default users for first install...");
            const defaultUsers = [
                { username: 'admin', name: 'Administrador Principal', password: 'admin123', role: 'ADMIN' },
                { username: 'registro', name: 'Oficial de Registro', password: '123', role: 'REGISTRO' },
                { username: 'caja', name: 'Cajero Municipal', password: '123', role: 'CAJERO' }
            ];
            localData.users = defaultUsers;
            await localStore.saveData(localData);
        }

        // Initialize status using both Capacitor and navigator.onLine as fallback
        const updateStatus = async () => {
            try {
                const status = await Network.getStatus();
                this.networkStatus = status.connected ? 'online' : 'offline';
            } catch (e) {
                this.networkStatus = navigator.onLine ? 'online' : 'offline';
            }
        };

        await updateStatus();

        Network.addListener('networkStatusChange', (status) => {
            this.networkStatus = status.connected ? 'online' : 'offline';
            if (this.networkStatus === 'online') {
                this.sync();
            }
        });

        // Fallback for non-native environments
        window.addEventListener('online', () => {
            this.networkStatus = 'online';
            this.sync();
        });
        window.addEventListener('offline', () => {
            this.networkStatus = 'offline';
        });

        // Trigger initial sync if online
        if (this.networkStatus === 'online') {
            this.sync();
        }

        // Periodic sync attempt if online
        setInterval(() => {
            if (this.networkStatus === 'online' && !this.isSyncing) {
                this.sync();
            }
        }, 60000); // Every minute
    }

    async addAction(type: SyncActionType, data: any) {
        const action: SyncAction = {
            id: crypto.randomUUID(),
            type,
            data,
            timestamp: new Date().toISOString()
        };
        this.queue.push(action);
        await localStore.saveSyncQueue(this.queue);
        
        if (this.networkStatus === 'online') {
            this.sync();
        }
    }

    async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        console.log("Starting synchronization...");

        try {
            // 1. Push pending changes
            const itemsProcessed = await this.flushQueue();

            // 2. Pull latest data from server
            await this.pullFromServer();
            
            console.log("Synchronization completed successfully.");
            
            // ONLY notify if we actually pushed something to the server
            if (itemsProcessed > 0) {
                window.dispatchEvent(new CustomEvent('sigma_sync_success'));
            }
        } catch (error: any) {
            console.error("Synchronization failed:", error);
            // Don't rethrow to avoid crashing the caller, but maybe trigger a toast
            window.dispatchEvent(new CustomEvent('sigma_sync_error', { detail: error }));
        } finally {
            this.isSyncing = false;
        }
    }

    private async flushQueue(): Promise<number> {
        const remainingQueue: SyncAction[] = [];
        let processedCount = 0;
        
        for (const action of this.queue) {
            try {
                // --- PRE-PROCESS: Handle base64 images before pushing to DB ---
                if (action.type === 'CREATE_TAXPAYER' || action.type === 'UPDATE_TAXPAYER') {
                    const docs = action.data.documents || {};
                    let hasPendingUploads = false;
                    
                    for (const [key, value] of Object.entries(docs)) {
                        if (typeof value === 'string' && value.startsWith('base64:')) {
                            try {
                                const [path, base64Data] = value.replace('base64:', '').split('|');
                                // Convert base64 to File
                                const res = await fetch(base64Data);
                                const blob = await res.blob();
                                const file = new File([blob], path.split('/').pop() || 'upload.png', { type: blob.type });
                                
                                // Upload to storage
                                const url = await remoteDb.uploadTaxpayerDocument(file, path);
                                action.data.documents[key] = url;
                                hasPendingUploads = true;
                            } catch (uploadError) {
                                console.error(`[SIGMA Sync] Failed to process base64 upload for ${key}:`, uploadError);
                            }
                        }
                    }
                    
                    if (hasPendingUploads) {
                        // Resave the queue with updated URLs just in case the next step fails
                        await localStore.saveSyncQueue(this.queue);
                    }
                }

                switch (action.type) {
                    case 'CREATE_TAXPAYER':
                        await remoteDb.createTaxpayer(action.data);
                        break;
                    case 'UPDATE_TAXPAYER':
                        await remoteDb.updateTaxpayer(action.data);
                        break;
                    case 'DELETE_TAXPAYER':
                        await remoteDb.deleteTaxpayer(action.data);
                        break;
                    case 'CREATE_TRANSACTION':
                        await remoteDb.createTransaction(action.data);
                        break;
                    case 'UPDATE_TRANSACTION':
                        await remoteDb.updateTransaction(action.data);
                        break;
                    case 'CREATE_AGENDA':
                        await remoteDb.createAgendaItem(action.data);
                        break;
                    case 'UPDATE_AGENDA':
                        await remoteDb.updateAgendaItem(action.data);
                        break;
                    case 'CREATE_ADMIN_REQUEST':
                        await remoteDb.createAdminRequest(action.data);
                        break;
                    case 'UPDATE_ADMIN_REQUEST':
                        await remoteDb.updateAdminRequest(action.data);
                        break;
                }
                processedCount++;
            } catch (e: any) {
                console.error(`Failed to flush action ${action.id}:`, e);
                
                // If it's a schema error (PGRST204), don't keep it in the queue 
                // to prevent infinite lag loops, but log it clearly.
                if (e.code === 'PGRST204') {
                    console.warn(`[SIGMA Sync] Skipping action ${action.id} due to missing DB column: ${e.message}`);
                } else {
                    remainingQueue.push(action);
                }
            }
        }

        this.queue = remainingQueue;
        await localStore.saveSyncQueue(this.queue);
        return processedCount;
    }

    private async pullFromServer() {
        console.log("Pulling latest data from server...");
        try {
            const [taxpayers, transactions, agenda, adminRequests, users, config] = await Promise.all([
                remoteDb.getTaxpayers().catch(e => { console.error("Pull Taxpayers failed:", e); return null; }),
                remoteDb.getTransactions().catch(e => { console.error("Pull Transactions failed:", e); return null; }),
                remoteDb.getAgenda().catch(e => { console.error("Pull Agenda failed:", e); return null; }),
                remoteDb.getAdminRequests().catch(e => { console.error("Pull AdminRequests failed:", e); return null; }),
                remoteDb.getAppUsers().catch(e => { console.error("Pull Users failed:", e); return null; }),
                remoteDb.getConfig().catch(e => { console.error("Pull Config failed:", e); return null; })
            ]);

            const currentLocal = await localStore.loadData();
            
            const localData: LocalData = {
                taxpayers: taxpayers || currentLocal.taxpayers,
                transactions: transactions || currentLocal.transactions,
                agenda: agenda || currentLocal.agenda,
                adminRequests: adminRequests || currentLocal.adminRequests,
                users: users || currentLocal.users,
                config: config || currentLocal.config,
                lastSync: new Date().toISOString()
            };

            await localStore.saveData(localData);
            
            // Trigger a custom event to notify components that data has changed
            window.dispatchEvent(new CustomEvent('sigma_data_updated', { detail: localData }));
        } catch (error) {
            console.error("Critical error in pullFromServer:", error);
            throw error;
        }
    }

    async getLocalData(): Promise<LocalData> {
        return await localStore.loadData();
    }

    getQueueSize(): number {
        return this.queue.length;
    }

    getNetworkStatus() {
        return this.networkStatus;
    }
}

export const syncService = new SyncService();
