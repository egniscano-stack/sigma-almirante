
import { supabase } from './supabaseClient';
import { Taxpayer, Transaction, User, TaxConfig, TaxpayerType, TaxpayerStatus, CommercialCategory, PaymentMethod, UserRole, TaxType, VehicleInfo, AgendaItem, Corregimiento, AdminRequest, ChatMessage } from '../types';
import { localStore } from './localStore';
import { syncService } from './syncService';

// --- DATA MAPPING HELPERS (Snake_case DB <-> CamelCase App) ---

export const mapTaxpayerFromDB = (data: any): Taxpayer => ({
    id: data.id,
    taxpayerNumber: data.taxpayer_number,
    type: data.type as TaxpayerType,
    status: data.status as TaxpayerStatus,
    docId: data.doc_id,
    dv: data.dv,
    name: data.name,
    address: data.address,
    corregimiento: data.corregimiento as Corregimiento,
    phone: data.phone,
    email: data.email,
    hasCommercialActivity: data.has_commercial_activity,
    commercialCategory: data.commercial_category as CommercialCategory,
    commercialName: data.commercial_name,
    balance: Number(data.balance) || 0,
    hasConstruction: data.has_construction,
    hasGarbageService: data.has_garbage_service,
    vehicles: data.vehicles || [],
    createdAt: data.created_at,
    documents: data.documents || {},
    magnitude: data.magnitude,
    selectedTaxCodes: data.selected_tax_codes || [],
    selectedRates: data.documents?.selectedRates || data.selected_rates || {},
    previousYearsDebt: Number(data.documents?.previousYearsDebt) || 0,
    rotuloAmount: Number(data.rotulo_amount) || 0,
    garbageAmount: Number(data.garbage_amount) || 0,
    businessStartDate: data.business_start_date || data.documents?.businessStartDate,
    paymentStartDate: data.payment_start_date || data.documents?.paymentStartDate,
    yearlyAmount: Number(data.yearly_amount) || 0,
    lastPaymentMonth: data.documents?.lastPaymentMonth || '',
    createdBy: data.created_by || data.documents?.createdBy,
    lastEditedBy: data.last_edited_by || data.documents?.lastEditedBy,
    paymentArrangement: data.documents?.paymentArrangement || undefined
});

const mapTaxpayerToDB = (data: Taxpayer) => ({
    id: data.id, // Optional for insert if generated
    taxpayer_number: data.taxpayerNumber,
    type: data.type,
    status: data.status,
    doc_id: data.docId,
    dv: data.dv,
    name: data.name,
    address: data.address,
    corregimiento: data.corregimiento,
    phone: data.phone,
    email: data.email,
    has_commercial_activity: data.hasCommercialActivity,
    commercial_category: data.commercialCategory,
    commercial_name: data.commercialName,
    balance: data.balance || 0,
    has_construction: data.hasConstruction,
    has_garbage_service: data.hasGarbageService,
    documents: {
      ...(data.documents || {}),
      businessStartDate: data.businessStartDate || null,
      paymentStartDate: data.paymentStartDate || null,
      selectedRates: data.selectedRates || {},
      previousYearsDebt: data.previousYearsDebt || 0,
      lastPaymentMonth: data.lastPaymentMonth || null,
      createdBy: data.createdBy || (data.documents as any)?.createdBy || null,
      lastEditedBy: data.lastEditedBy || (data.documents as any)?.lastEditedBy || null,
      paymentArrangement: data.paymentArrangement || null
    },
    magnitude: data.magnitude,
    selected_tax_codes: data.selectedTaxCodes || [],
    rotulo_amount: data.rotuloAmount || 0,
    garbage_amount: data.garbageAmount || 0,
    business_start_date: data.businessStartDate || null,
    payment_start_date: data.paymentStartDate || null,
    yearly_amount: data.yearlyAmount || 0,
    vehicles: data.vehicles || []
});

export const mapTransactionFromDB = (data: any): Transaction => ({
    id: data.id,
    taxpayerId: data.taxpayer_id,
    taxType: data.tax_type as TaxType,
    amount: Number(data.amount) || 0,
    date: data.date,
    time: data.time,
    description: data.description,
    status: data.status,
    paymentMethod: data.payment_method as PaymentMethod,
    tellerName: data.teller_name,
    metadata: data.metadata,
});

const mapTransactionToDB = (data: Transaction) => ({
    id: data.id,
    taxpayer_id: data.taxpayerId,
    tax_type: data.taxType,
    amount: data.amount,
    date: data.date,
    time: data.time,
    description: data.description,
    status: data.status,
    payment_method: data.paymentMethod,
    teller_name: data.tellerName,
    metadata: data.metadata
});

// --- AGENDA MAPPINGS ---

const mapAgendaItemFromDB = (data: any): AgendaItem => ({
    id: data.id,
    title: data.title,
    description: data.description,
    startDate: data.start_date,
    startTime: data.start_time,
    endDate: data.end_date,
    endTime: data.end_time,
    type: data.type,
    status: data.status,
    location: data.location,
    createdBy: data.created_by,
    isImportant: data.is_important,
    rejectionReason: data.rejection_reason
});

const mapAgendaItemToDB = (data: AgendaItem) => ({
    id: data.id,
    title: data.title,
    description: data.description,
    start_date: data.startDate,
    start_time: data.startTime,
    end_date: data.endDate,
    end_time: data.endTime,
    type: data.type,
    status: data.status,
    location: data.location,
    created_by: data.createdBy,
    is_important: data.isImportant,
    rejection_reason: data.rejectionReason
});


// --- ADMIN REQUEST MAPPINGS ---
const mapAdminRequestFromDB = (data: any): AdminRequest => ({
    id: data.id,
    type: data.type,
    status: data.status,
    requesterName: data.requester_name,
    taxpayerName: data.taxpayer_name,
    description: data.description,
    transactionId: data.transaction_id,
    payload: data.payload,
    totalDebt: Number(data.total_debt) || 0,
    taxpayerId: data.taxpayer_id || data.payload?.id, // Use dedicated column or fallback to payload
    responseNote: data.response_note,
    approvedAmount: Number(data.approved_amount) || 0,
    approvedTotalDebt: Number(data.approved_total_debt) || 0,
    installments: data.installments,
    createdAt: data.created_at
});

const mapAdminRequestToDB = (data: AdminRequest) => ({
    id: data.id,
    type: data.type,
    status: data.status,
    requester_name: data.requesterName,
    taxpayer_name: data.taxpayerName,
    taxpayer_id: data.taxpayerId,
    description: data.description,
    transaction_id: data.transactionId,
    payload: data.payload,
    total_debt: data.totalDebt,
    response_note: data.responseNote,
    approved_amount: data.approvedAmount,
    approved_total_debt: data.approvedTotalDebt,
    installments: data.installments,
    // created_at is default now()
});

// --- RAW DB ACCESS (For Sync Service Only) ---
export const remoteDb = {
    getTaxpayers: async (): Promise<Taxpayer[]> => {
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let finished = false;

        while (!finished) {
            const { data, error, count } = await supabase
                .from('taxpayers')
                .select('*', { count: 'exact' })
                .range(from, to);

            if (error) {
                console.error("Error fetching taxpayers:", error);
                throw error;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (count && allData.length >= count) {
                    finished = true;
                } else {
                    from += 1000;
                    to += 1000;
                }
            } else {
                finished = true;
            }
        }
        return allData.map(mapTaxpayerFromDB);
    },

    createTaxpayer: async (taxpayer: Taxpayer) => {
        const dbData = mapTaxpayerToDB(taxpayer);
        const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (!dbData.id || !isUUID(dbData.id)) {
            delete (dbData as any).id;
        }

        const { data, error } = await supabase.from('taxpayers').insert(dbData).select().single();
        if (error) throw error;
        return mapTaxpayerFromDB(data);
    },

    updateTaxpayer: async (taxpayer: Taxpayer) => {
        const dbData = mapTaxpayerToDB(taxpayer);
        const idToUpdate = dbData.id;
        delete (dbData as any).id;
        const { data, error } = await supabase.from('taxpayers').update(dbData).eq('id', idToUpdate).select().single();
        if (error) throw error;
        return mapTaxpayerFromDB(data);
    },

    deleteTaxpayer: async (id: string) => {
        const { error } = await supabase.from('taxpayers').delete().eq('id', id);
        if (error) throw error;
    },

    getTransactions: async (): Promise<Transaction[]> => {
        const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(mapTransactionFromDB);
    },

    createTransaction: async (tx: Transaction) => {
        const dbData = mapTransactionToDB(tx);
        const { data, error } = await supabase.from('transactions').insert(dbData).select().single();
        if (error) throw error;
        return mapTransactionFromDB(data);
    },

    updateTransaction: async (tx: Transaction) => {
        const dbData = mapTransactionToDB(tx);
        const { data, error } = await supabase.from('transactions').update(dbData).eq('id', tx.id).select().single();
        if (error) throw error;
        return mapTransactionFromDB(data);
    },

    getAgenda: async (): Promise<AgendaItem[]> => {
        const { data, error } = await supabase.from('agenda_items').select('*').order('start_date', { ascending: true });
        if (error) return [];
        return data.map(mapAgendaItemFromDB);
    },

    createAgendaItem: async (item: AgendaItem) => {
        const dbData = mapAgendaItemToDB(item);
        delete (dbData as any).id;
        const { data, error } = await supabase.from('agenda_items').insert(dbData).select().single();
        if (error) throw error;
        return mapAgendaItemFromDB(data);
    },

    updateAgendaItem: async (item: AgendaItem) => {
        const dbData = mapAgendaItemToDB(item);
        const { data, error } = await supabase.from('agenda_items').update(dbData).eq('id', item.id).select().single();
        if (error) throw error;
        return mapAgendaItemFromDB(data);
    },

    getAdminRequests: async (): Promise<AdminRequest[]> => {
        const { data, error } = await supabase.from('admin_requests').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data.map(mapAdminRequestFromDB);
    },

    createAdminRequest: async (req: AdminRequest) => {
        const dbData = mapAdminRequestToDB(req);
        const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (!dbData.id || !isUUID(dbData.id)) {
            delete (dbData as any).id;
        }
        const { data, error } = await supabase.from('admin_requests').insert(dbData).select().single();
        if (error) throw error;
        return mapAdminRequestFromDB(data);
    },

    updateAdminRequest: async (req: AdminRequest) => {
        const dbData = mapAdminRequestToDB(req);
        const { data, error } = await supabase.from('admin_requests').update(dbData).eq('id', req.id).select().single();
        if (error) throw error;
        return mapAdminRequestFromDB(data);
    },

    getConfig: async () => {
        const { data, error } = await supabase.from('system_config').select('config').limit(1).single();
        if (error) return null;
        return data.config as TaxConfig;
    },

    updateConfig: async (config: TaxConfig) => {
        const { error } = await supabase.from('system_config').upsert({ id: 1, config });
        if (error) throw error;
    },

    mapUserFromDB: (u: any): User => {
        const user = { ...u } as User;
        user.status = 'ACTIVO';
        
        if (user.name && user.name.endsWith(' [SUSPENDIDO]')) {
            user.name = user.name.replace(' [SUSPENDIDO]', '');
            user.status = 'SUSPENDIDO';
        }
        
        if (user.name && user.name.endsWith(' [CONTABILIDAD]')) {
            user.name = user.name.replace(' [CONTABILIDAD]', '');
            user.role = 'CONTABILIDAD';
        } else if (user.name && user.name.endsWith(' [PLANILLA]')) {
            user.name = user.name.replace(' [PLANILLA]', '');
            user.role = 'PLANILLA';
        } else if (user.username.toLowerCase() === 'contabilidad') {
            user.role = 'CONTABILIDAD';
        } else if (user.username.toLowerCase() === 'planilla') {
            user.role = 'PLANILLA';
        }
        return user;
    },

    mapUserToDB: (u: User): User => {
        const dbUser = { ...u };
        
        // Handle role mapping
        if (dbUser.role === 'CONTABILIDAD') {
            dbUser.name = `${dbUser.name} [CONTABILIDAD]`;
            dbUser.role = 'AUDITOR';
        } else if (dbUser.role === 'PLANILLA') {
            dbUser.name = `${dbUser.name} [PLANILLA]`;
            dbUser.role = 'SECRETARIA';
        }
        
        // Handle status mapping
        if (dbUser.status === 'SUSPENDIDO') {
            dbUser.name = `${dbUser.name} [SUSPENDIDO]`;
        }
        
        // Delete status field before database operation since status is stored inside the name column
        delete dbUser.status;
        
        return dbUser;
    },

    getAppUsers: async (): Promise<User[]> => {
        const { data, error } = await supabase.from('app_users').select('*');
        if (error) throw error;
        return (data || []).map(remoteDb.mapUserFromDB);
    },

    createAppUser: async (user: User) => {
        const dbUser = remoteDb.mapUserToDB(user);
        const { data, error } = await supabase.from('app_users').insert(dbUser).select().single();
        if (error) throw error;
        return remoteDb.mapUserFromDB(data);
    },

    updateAppUser: async (user: User) => {
        const dbUser = remoteDb.mapUserToDB(user);
        const { data, error } = await supabase.from('app_users').update(dbUser).eq('username', user.username).select().single();
        if (error) throw error;
        return remoteDb.mapUserFromDB(data);
    },

    deleteAppUser: async (username: string) => {
        const { error } = await supabase.from('app_users').delete().eq('username', username);
        if (error) throw error;
    }
};

// --- OFFLINE-FIRST DB LAYER ---
export const db = {
    // TAXPAYERS
    getTaxpayers: async (): Promise<Taxpayer[]> => {
        const local = await localStore.loadData();
        return local.taxpayers || [];
    },

    createTaxpayer: async (taxpayer: Taxpayer) => {
        const local = await localStore.loadData();
        const newTp = { ...taxpayer, id: taxpayer.id || crypto.randomUUID() };
        local.taxpayers.push(newTp);
        await localStore.saveData(local);
        
        await syncService.addAction('CREATE_TAXPAYER', newTp);
        return newTp;
    },

    updateTaxpayer: async (taxpayer: Taxpayer) => {
        const local = await localStore.loadData();
        const index = local.taxpayers.findIndex(t => t.id === taxpayer.id);
        if (index !== -1) {
            local.taxpayers[index] = taxpayer;
            await localStore.saveData(local);
        }
        await syncService.addAction('UPDATE_TAXPAYER', taxpayer);
        return taxpayer;
    },

    deleteTaxpayer: async (id: string) => {
        const local = await localStore.loadData();
        local.taxpayers = local.taxpayers.filter(t => t.id !== id);
        await localStore.saveData(local);
        await syncService.addAction('DELETE_TAXPAYER', id);
    },

    getNextTaxpayerNumber: async (): Promise<string> => {
        const local = await localStore.loadData();
        const numbers = (local.taxpayers || [])
            .map(d => {
                const parts = (d.taxpayerNumber || '').split('-');
                return parts.length > 1 ? parseInt(parts[1]) : 0;
            })
            .filter(n => !isNaN(n));
        
        const max = numbers.length > 0 ? Math.max(...numbers) : 0;
        return `2026-${max + 1}`;
    },

    // TRANSACTIONS
    getTransactions: async (): Promise<Transaction[]> => {
        const local = await localStore.loadData();
        return local.transactions || [];
    },

    createTransaction: async (tx: Transaction) => {
        const local = await localStore.loadData();
        const newTx = { ...tx, id: tx.id || crypto.randomUUID() };
        local.transactions.unshift(newTx);
        await localStore.saveData(local);
        await syncService.addAction('CREATE_TRANSACTION', newTx);
        return newTx;
    },

    updateTransaction: async (tx: Transaction) => {
        const local = await localStore.loadData();
        const index = local.transactions.findIndex(t => t.id === tx.id);
        if (index !== -1) {
            local.transactions[index] = tx;
            await localStore.saveData(local);
        }
        await syncService.addAction('UPDATE_TRANSACTION', tx);
        return tx;
    },

    // AGENDA
    getAgenda: async (): Promise<AgendaItem[]> => {
        const local = await localStore.loadData();
        return local.agenda || [];
    },

    createAgendaItem: async (item: AgendaItem) => {
        const local = await localStore.loadData();
        const newItem = { ...item, id: item.id || crypto.randomUUID() };
        local.agenda.push(newItem);
        await localStore.saveData(local);
        await syncService.addAction('CREATE_AGENDA', newItem);
        return newItem;
    },

    updateAgendaItem: async (item: AgendaItem) => {
        const local = await localStore.loadData();
        const index = local.agenda.findIndex(a => a.id === item.id);
        if (index !== -1) {
            local.agenda[index] = item;
            await localStore.saveData(local);
        }
        await syncService.addAction('UPDATE_AGENDA', item);
        return item;
    },

    // ADMIN REQUESTS
    getAdminRequests: async (): Promise<AdminRequest[]> => {
        const local = await localStore.loadData();
        return local.adminRequests || [];
    },

    createAdminRequest: async (req: AdminRequest) => {
        const local = await localStore.loadData();
        const newReq = { ...req, id: req.id || crypto.randomUUID() };
        local.adminRequests.unshift(newReq);
        await localStore.saveData(local);
        await syncService.addAction('CREATE_ADMIN_REQUEST', newReq);
        return newReq;
    },

    updateAdminRequest: async (req: AdminRequest) => {
        const local = await localStore.loadData();
        const index = local.adminRequests.findIndex(r => r.id === req.id);
        if (index !== -1) {
            local.adminRequests[index] = req;
            await localStore.saveData(local);
        }
        await syncService.addAction('UPDATE_ADMIN_REQUEST', req);
        return req;
    },

    // CONFIG
    getConfig: async (): Promise<TaxConfig | null> => {
        const local = await localStore.loadData();
        return local.config;
    },

    updateConfig: async (config: TaxConfig) => {
        const local = await localStore.loadData();
        local.config = config;
        await localStore.saveData(local);
        // Special case for config: attempt to update remotely, but don't fail offline
        try {
            await remoteDb.updateConfig(config);
        } catch (e) {
            console.warn("Could not sync config to Supabase (offline), will remain saved locally:", e);
        }
    },

    // --- OTHER METHODS STAY SAME (Remote Only) ---
    uploadTaxpayerDocument: async (file: File, path: string) => {
        // Documents require internet to upload to storage
        const { data, error } = await supabase.storage.from('taxpayer-documents').upload(path, file, { upsert: true });
        if (error) throw error;
        return supabase.storage.from('taxpayer-documents').getPublicUrl(path).data.publicUrl;
    },

    getAppUsers: async (): Promise<User[]> => {
        const local = await localStore.loadData();
        return local.users || [];
    },

    createAppUser: async (user: User) => {
        const local = await localStore.loadData();
        local.users = local.users.filter(u => u.username !== user.username);
        local.users.push(user);
        await localStore.saveData(local);
        
        await syncService.addAction('CREATE_USER', user);
        return user;
    },

    updateAppUser: async (user: User) => {
        const local = await localStore.loadData();
        const index = local.users.findIndex(u => u.username === user.username);
        if (index !== -1) {
            local.users[index] = user;
            await localStore.saveData(local);
        }
        await syncService.addAction('UPDATE_USER', user);
        return user;
    },

    deleteAppUser: async (username: string) => {
        const local = await localStore.loadData();
        local.users = local.users.filter(u => u.username !== username);
        await localStore.saveData(local);
        await syncService.addAction('DELETE_USER', username);
    },

    getReportStats: async () => {
        return db.getTransactions();
    },

    getMessages: async (): Promise<ChatMessage[]> => {
        const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(100);
        if (error) return [];
        return data as ChatMessage[];
    },

    sendMessage: async (msg: Omit<ChatMessage, 'id' | 'created_at' | 'is_read'>) => {
        const { data, error } = await supabase.from('chat_messages').insert(msg).select().single();
        if (error) throw error;
        return data as ChatMessage;
    },

    markMessagesAsRead: async (currentUserKv: string, senderKv: string | null) => {
        if (senderKv) {
            await supabase.from('chat_messages').update({ is_read: true }).eq('recipient_username', currentUserKv).eq('sender_username', senderKv).eq('is_read', false);
        }
    },

    markGeneralChatRead: async (username: string) => {
        await supabase.from('app_users').update({ last_read_general_chat: new Date().toISOString() }).eq('username', username);
    },

    subscribeToChanges: (onTaxpayerChange: any, onTransactionChange: any, onAgendaChange?: any, onAdminRequestChange?: any, onChatChange?: any) => {
        const taxpayersSubscription = supabase.channel('public:taxpayers').on('postgres_changes', { event: '*', schema: 'public', table: 'taxpayers' }, onTaxpayerChange).subscribe();
        const transactionsSubscription = supabase.channel('public:transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, onTransactionChange).subscribe();
        let agendaSubscription: any = null;
        if (onAgendaChange) agendaSubscription = supabase.channel('public:agenda_items').on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_items' }, onAgendaChange).subscribe();
        let adminReqSubscription: any = null;
        if (onAdminRequestChange) adminReqSubscription = supabase.channel('public:admin_requests').on('postgres_changes', { event: '*', schema: 'public', table: 'admin_requests' }, onAdminRequestChange).subscribe();
        let chatSubscription: any = null;
        if (onChatChange) chatSubscription = supabase.channel('public:chat_messages').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, onChatChange).subscribe();

        return () => {
            supabase.removeChannel(taxpayersSubscription);
            supabase.removeChannel(transactionsSubscription);
            if (agendaSubscription) supabase.removeChannel(agendaSubscription);
            if (adminReqSubscription) supabase.removeChannel(adminReqSubscription);
            if (chatSubscription) supabase.removeChannel(chatSubscription);
        };
    }
};
