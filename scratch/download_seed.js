import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://nxssrsjcwenxfukdsfoa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3Nyc2pjd2VueGZ1a2RzZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzg0MjIsImV4cCI6MjA5NDQxNDQyMn0.ketneNoqaakdx8hE53MSE1dmXghyhToDcoGo6u6kneY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function safeFetch(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.warn(`[Advertencia] Error consultando tabla '${tableName}':`, error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn(`[Advertencia] Error de conexión consultando tabla '${tableName}':`, err.message);
    return [];
  }
}

async function download() {
  console.log("Iniciando descarga de datos de Supabase con tolerancia a fallos...");

  // 1. Fetch taxpayers
  console.log("Descargando contribuyentes...");
  const taxpayersRaw = await safeFetch('taxpayers');
  const taxpayers = taxpayersRaw.map(data => ({
    id: data.id,
    taxpayerNumber: data.taxpayer_number,
    type: data.type,
    status: data.status,
    docId: data.doc_id,
    dv: data.dv,
    name: data.name,
    address: data.address,
    corregimiento: data.corregimiento,
    phone: data.phone,
    email: data.email,
    hasCommercialActivity: data.has_commercial_activity,
    commercialCategory: data.commercial_category,
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
    lastEditedBy: data.last_edited_by || data.documents?.lastEditedBy
  }));
  console.log(`Contribuyentes descargados: ${taxpayers.length}`);

  // 2. Fetch transactions
  console.log("Descargando transacciones...");
  const transactionsRaw = await safeFetch('transactions');
  const transactions = transactionsRaw.map(data => ({
    id: data.id,
    taxpayerId: data.taxpayer_id,
    taxType: data.tax_type,
    amount: Number(data.amount) || 0,
    date: data.date,
    time: data.time,
    description: data.description,
    status: data.status,
    paymentMethod: data.payment_method,
    tellerName: data.teller_name,
    metadata: data.metadata
  }));
  console.log(`Transacciones descargadas: ${transactions.length}`);

  // 3. Fetch agenda
  console.log("Descargando agenda (agenda_items)...");
  const agendaRaw = await safeFetch('agenda_items');
  const agenda = agendaRaw.map(data => ({
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
  }));
  console.log(`Eventos de agenda descargados: ${agenda.length}`);

  // 4. Fetch admin requests
  console.log("Descargando solicitudes de administrador...");
  const reqsRaw = await safeFetch('admin_requests');
  const adminRequests = reqsRaw.map(data => ({
    id: data.id,
    type: data.type,
    status: data.status,
    requesterName: data.requester_name,
    taxpayerName: data.taxpayer_name,
    description: data.description,
    transactionId: data.transaction_id,
    payload: data.payload,
    totalDebt: Number(data.total_debt) || 0,
    taxpayerId: data.taxpayer_id || data.payload?.id,
    responseNote: data.response_note,
    approvedAmount: Number(data.approved_amount) || 0,
    approvedTotalDebt: Number(data.approved_total_debt) || 0,
    installments: data.installments,
    createdAt: data.created_at
  }));
  console.log(`Solicitudes descargadas: ${adminRequests.length}`);

  // 5. Fetch app users
  console.log("Descargando usuarios...");
  const usersRaw = await safeFetch('app_users');
  const users = usersRaw.map(u => {
    const user = {
      username: u.username,
      name: u.name,
      password: u.password,
      role: u.role,
      status: 'ACTIVO'
    };
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
    } else if (user.name && user.name.endsWith(' [REGISTRO]')) {
      user.name = user.name.replace(' [REGISTRO]', '');
      user.role = 'REGISTRO';
    } else if (user.name && user.name.endsWith(' [CAJERO]')) {
      user.name = user.name.replace(' [CAJERO]', '');
      user.role = 'CAJERO';
    } else if (user.name && user.name.endsWith(' [ADMIN]')) {
      user.name = user.name.replace(' [ADMIN]', '');
      user.role = 'ADMIN';
    }
    return user;
  });
  console.log(`Usuarios descargados: ${users.length}`);

  // 6. Fetch system config
  console.log("Descargando configuración del sistema...");
  let config = null;
  try {
    const { data: configRaw, error: cErr } = await supabase.from('system_config').select('*').eq('id', 1).single();
    if (!cErr && configRaw) {
      config = configRaw.config;
    }
  } catch (err) {
    console.warn("No se pudo obtener la configuración del sistema:", err.message);
  }
  console.log("Configuración descargada:", config ? "Sí" : "No (usando por defecto)");

  // 7. Write to public/initial_seed.json
  const seedPath = path.join(process.cwd(), 'public/initial_seed.json');
  const seedData = {
    taxpayers,
    transactions,
    agenda,
    adminRequests,
    users,
    config,
    lastSync: new Date().toISOString()
  };

  // Create public directory if not exists
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2));
  console.log(`¡Semilla local guardada con éxito en ${seedPath}!`);
}

download().catch(e => {
  console.error("Error descargando los datos de Supabase:", e);
  process.exit(1);
});
