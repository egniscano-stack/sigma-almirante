
// Enums for standardizing tax types
export enum TaxType {
  VEHICULO = 'VEHICULO',
  CONSTRUCCION = 'CONSTRUCCION',
  BASURA = 'BASURA',
  COMERCIO = 'COMERCIO',
  PAZ_Y_SALVO = 'PAZ Y SALVO',
  CONSOLIDADO = 'CONSOLIDADO',
}

export enum TaxpayerType {
  NATURAL_1 = 'NATURAL_1',
  NATURAL_2 = 'NATURAL_2',
  JURIDICA = 'JURIDICA',
  PLACA = 'PLACA',
}

export enum TaxpayerStatus {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  BLOQUEADO = 'BLOQUEADO',
  MOROSO = 'MOROSO',
}

export enum CommercialCategory {
  NONE = 'NONE',
  CLASE_A = 'CLASE_A', // Banks, Supermarkets (High)
  CLASE_B = 'CLASE_B', // Stores, Pharmacies (Medium)
  CLASE_C = 'CLASE_C', // Small Kiosks (Low)
}

export enum PaymentMethod {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  CHEQUE = 'CHEQUE',
  ONLINE = 'ONLINE', // Payment via Portal
  ARREGLO_PAGO = 'ARREGLO_PAGO', // New for Special Arrangement
}

export interface VehicleInfo {
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  motorSerial: string;
  chassisSerial: string;
  hasTransferDocuments: boolean; // Documentacion de traspaso
  yearlyAmount?: number; // Monto de placa individual
}

// Corregimientos defined by requirements
export enum Corregimiento {
  ALMIRANTE_CABECERA = 'Almirante (Cabecera)',
  BARRIO_FRANCES = 'Barrio Francés',
  BARRIADA_GUAYMI = 'Barriada Guaymí',
  VALLE_RISCO = 'Valle de Riscó',
  VALLE_AGUAS_ARRIBA = 'Valle de Aguas Arriba',
  NANCE_RISCO = 'Nance de Riscó',
  BAJO_CULUBRE = 'Bajo Culubre',
  CEIBA = 'Ceiba',
  CAUCHERO = 'Cauchero',
  MIRAFLORES = 'Miraflores',
}

export interface Taxpayer {
  id: string;
  taxpayerNumber: string; // Unique Auto-Generated Number (e.g., 2024-0001)
  type: TaxpayerType;
  status: TaxpayerStatus; // ACTIVO, SUSPENDIDO, BLOQUEADO

  // Identification
  docId: string; // Cédula or RUC
  dv?: string; // Digito Verificador (only for RUC)
  name: string; // Full Name or Razón Social

  // Contact & Location
  address: string;
  corregimiento?: Corregimiento;
  phone: string;
  email: string;

  // Services & Assets Flags
  hasCommercialActivity: boolean; // Available for both Natural & Juridica
  commercialCategory?: string;
  commercialName?: string; // Nombre del establecimiento

  // Economic Status
  balance?: number; // Monto por cobrar (Deuda)

  hasConstruction: boolean; // Active construction permit
  hasGarbageService: boolean; // Active garbage collection

  // Assets
  vehicles?: VehicleInfo[]; // List of registered vehicles
  createdAt?: string;
  documents?: Record<string, string>; // Key: Doc Type, Value: URL

  // New Tax Structure Fields
  magnitude?: 'PEQUEÑO' | 'MEDIANO' | 'GRANDE';
  selectedTaxCodes?: string[];
  selectedRates?: Record<string, number>; // Maps tax code to specific selected rate
   rotuloAmount?: number;
   garbageAmount?: number;
   yearlyAmount?: number;
  
  // Migration & Start Dates
  businessStartDate?: string; // Fecha de inicio de operaciones
  paymentStartDate?: string; // Fecha desde donde inician los pagos en el sistema
  createdBy?: string; // Usuario que creó el registro
  lastEditedBy?: string; // Último usuario que editó el registro
  previousYearsDebt?: number;
}

export interface Transaction {
  id: string;
  taxpayerId: string | null;
  taxType: TaxType;
  amount: number;
  date: string;
  time: string;
  description: string;
  status: 'PAGADO' | 'PENDIENTE' | 'ANULADO';
  paymentMethod: PaymentMethod;
  tellerName: string;
  metadata?: Record<string, any>; // Can store arrangement details here
}

export interface TaxConfig {
  plateCost: number;
  constructionRatePerSqm: number;
  garbageResidentialRate: number;
  garbageCommercialRate: number;
  commercialBaseRate: number;
  liquorLicenseRate: number; // New
  advertisementRate: number; // New
  // Dynamic commercial rates
  commercialRates: {
    [key in CommercialCategory]: number;
  };
}

export interface MunicipalityInfo {
  name: string;
  province: string;
  ruc: string;
  phone: string;
  email: string;
  address: string;
}

// AI Analysis Result Interface
export interface ExtractedInvoiceData {
  date?: string;
  amount?: number;
  taxpayerName?: string;
  concept?: string;
  docId?: string;
  taxpayerNumber?: string; // New: Number of Taxpayer
  receiptNumber?: string; // New: Receipt Number
  paymentMethod?: string;
  confidence: number;
}

// Authentication Types
export type UserRole = 'ADMIN' | 'CAJERO' | 'CONTRIBUYENTE' | 'AUDITOR' | 'REGISTRO' | 'ALCALDE' | 'SECRETARIA';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  password?: string; // Included for demo purposes to allow creating users
  last_read_general_chat?: string; // ISO Timestamp
}

// --- ADMIN REQUESTS (For Void / Arrangement / Taxpayer Edit) ---
export type RequestType = 'VOID_TRANSACTION' | 'PAYMENT_ARRANGEMENT' | 'UPDATE_TAXPAYER';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface AdminRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requesterName: string;
  taxpayerName: string; // Context

  description: string; // Reason

  // For VOID
  transactionId?: string;

  // For ARRANGEMENT
  totalDebt?: number;

  // For UPDATE_TAXPAYER
  taxpayerId?: string;
  payload?: Partial<Taxpayer>; // New data proposed

  // Admin Response
  responseNote?: string;
  approvedAmount?: number; // The amount to pay NOW
  approvedTotalDebt?: number; // Total agreed debt
  installments?: number; // Number of payments

  createdAt: string;
}

// --- AGENDA Items ---
export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO Date "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endDate?: string;
  endTime?: string;
  type: 'EVENTO' | 'REUNION' | 'TRAMITE' | 'VISITA';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  location?: string;
  createdBy: string; // User ID or Name
  isImportant: boolean;
  rejectionReason?: string;
}

// --- CHAT SYSTEM ---
export interface ChatMessage {
  id: string;
  sender_username: string;
  sender_name: string;
  recipient_username?: string | null; // Null for public channel
  content: string;
  attachment_url?: string;
  attachment_type?: 'image' | 'file';
  created_at: string;
  is_read: boolean;
}

declare global {
  interface Window {
    electronAPI?: {
      backup: {
        save: (key: string, data: any) => Promise<{success: boolean, path?: string, error?: string}>;
        load: (key: string) => Promise<{success: boolean, data?: any, error?: string}>;
      }
    }
  }
}
