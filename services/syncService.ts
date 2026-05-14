
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
            await this.flushQueue();

            // 2. Pull latest data from server
            await this.pullFromServer();
            
            console.log("Synchronization completed successfully.");
        } catch (error) {
            console.error("Synchronization failed:", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async flushQueue() {
        const remainingQueue: SyncAction[] = [];
        
        for (const action of this.queue) {
            try {
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
            } catch (e) {
                console.error(`Failed to flush action ${action.id}:`, e);
                remainingQueue.push(action);
            }
        }

        this.queue = remainingQueue;
        await localStore.saveSyncQueue(this.queue);
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
