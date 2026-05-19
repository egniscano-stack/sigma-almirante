import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Taxpayer, TaxpayerType, CommercialCategory, Transaction, VehicleInfo, TaxpayerStatus, UserRole, Corregimiento, AdminRequest, RequestStatus, TaxConfig } from '../types';
import { db } from '../services/db';
import { Search, UserPlus, Briefcase, User, MapPin, Store, History, X, FileText, Car, Hammer, Trash2, CheckSquare, Plus, AlertCircle, MoreVertical, ShieldAlert, Ban, CheckCircle, Edit, Upload, Image as ImageIcon, Shield, Calculator, Settings, ChevronDown, CreditCard, ChevronRight } from 'lucide-react';
import { AntivirusScanner } from '../components/AntivirusScanner';
import { FileScanResult } from '../services/antivirus';
import { getSession } from '../services/security';
import { calculateTaxpayerDebt } from '../services/debtLogic';

import taxStructure from '../data/taxStructure.json';

const MUNICIPAL_ACTIVITIES = [
  'ABARROTERIA', 'ALMACEN', 'BARBERIA', 'BARES', 'BASURA2026', 'BUHONERIA', 
  'FARMACIA', 'FERRETERIA', 'FUMIGADORA', 'GASOLINERA', 'LAVA AUTO', 'LEGUMBRERIA', 
  'OTROS', 'PARQUEO', 'PLACA', 'RESTAURANTE', 'ROPA AMERICANA', 'SUPERMERCADOS', 
  'TALLER', 'TAXI MAR', 'VIGENCIA EXPIRADA'
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

interface TaxpayersProps {
  taxpayers: Taxpayer[];
  transactions: Transaction[]; // Receive transactions to filter history
  onAdd: (tp: Taxpayer) => void;
  onUpdate: (tp: Taxpayer) => void;
  onDelete: (id: string) => void;
  userRole: UserRole;
  onCreateRequest: (req: AdminRequest) => void;
  onRefresh?: () => void;
  config: TaxConfig;
  confirmModal: any;
  setConfirmModal: (modal: any) => void;
}

export const Taxpayers: React.FC<TaxpayersProps> = ({ 
  taxpayers, 
  transactions, 
  onAdd, 
  onUpdate, 
  onDelete, 
  userRole, 
  onCreateRequest, 
  onRefresh,
  config,
  confirmModal,
  setConfirmModal
}) => {
  const session = getSession();
  const uname = session?.username.toLowerCase() || '';
  const isPlacaStation = uname.includes('placa');
  const isCaja1 = uname.includes('caja 1') || uname === 'caja1';
  const isNormalCaja = (uname.includes('caja') || session?.role === 'CAJERO') && !isPlacaStation;
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'ALCALDE';

  const [showModal, setShowModal] = useState(false);
  const [viewTaxpayer, setViewTaxpayer] = useState<Taxpayer | null>(null);
  const [historyTaxpayer, setHistoryTaxpayer] = useState<Taxpayer | null>(null);
  const [showDebtBreakdown, setShowDebtBreakdown] = useState(false);
  const [taxSearchTerm, setTaxSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Taxpayer[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showYearlyAmountInput, setShowYearlyAmountInput] = useState(false);
  const [showLastPaymentInput, setShowLastPaymentInput] = useState(false);

  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');

  // --- New Taxpayer Form State (Now Main View) ---
  const getInitialFormState = (): Partial<Taxpayer> => ({
    type: isPlacaStation ? TaxpayerType.PLACA : TaxpayerType.NATURAL_1,
    status: TaxpayerStatus.ACTIVO,
    name: '',
    docId: '',
    address: '',
    phone: '',
    email: '',
    hasCommercialActivity: false,
    commercialCategory: CommercialCategory.NONE,
    commercialName: '',
    hasConstruction: false,
    hasGarbageService: !isPlacaStation,
    vehicles: [],
    magnitude: 'PEQUEÑO',
    selectedTaxCodes: [],
    selectedRates: {},
    rotuloAmount: 0,
    garbageAmount: 0,
    yearlyAmount: 0,
    lastPaymentMonth: '',
    balance: 0
  });

  const [newTp, setNewTp] = useState<Partial<Taxpayer>>(getInitialFormState());
  const [files, setFiles] = useState<Record<string, File>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Antivirus State
  const [showAntivirusScan, setShowAntivirusScan] = useState(false);
  const [scanResults, setScanResults] = useState<Record<string, FileScanResult> | null>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);

  const handleFileChange = (key: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [key]: file }));
    } else {
      setFiles(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Load Taxpayer into Form for Editing
  const handleEditInit = (tp: Taxpayer) => {
    const freshTp = taxpayers.find(t => t.id === tp.id) || tp;
    setNewTp(freshTp);
    setIsEditing(true);
    setEditingId(tp.id);
    setSearchTerm('');
    setIsSearching(false);
    
    // Auto-expand Placa settings if values exist
    if (freshTp.yearlyAmount && freshTp.yearlyAmount > 0) {
      setShowYearlyAmountInput(true);
    } else {
      setShowYearlyAmountInput(false);
    }
    if (freshTp.lastPaymentMonth) {
      setShowLastPaymentInput(true);
    } else {
      setShowLastPaymentInput(false);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to form
  };

  // Helper to calculate months of arrears based on start date
  const calculateMonthsArrears = (startDateStr?: string) => {
    if (!startDateStr) return 0; // Return 0 if no start date is set (Zero by default policy)
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return 0;
    const now = new Date();
    
    const yearsDiff = now.getFullYear() - start.getFullYear();
    const monthsDiff = now.getMonth() - start.getMonth();
    
    let totalMonths = yearsDiff * 12 + monthsDiff;
    totalMonths += 1; // Inclusive counting (e.g. same month = 1)
    return Math.max(0, totalMonths);
  };

  // Helper to get formatted inscription link text
  const getInscriptionLinkText = (dateStr?: string) => {
    if (!dateStr) return '⚠️ Defina la Fecha de Inscripción arriba para vincular el cobro.';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      const monthName = d.toLocaleString('es-ES', { month: 'long' });
      const year = d.getFullYear();
      return `Ligado a ${monthName.toUpperCase()} de ${year} (Mes y Año de Inscripción).`;
    } catch (e) {
      return 'Fecha de inscripción no válida.';
    }
  };

  // Helper to get the first unpaid period text (month after last payment)
  const getNextUnpaidPeriodText = (lastPaymentStr?: string) => {
    if (!lastPaymentStr) return '';
    try {
      const [year, month] = lastPaymentStr.split('-').map(Number);
      const d = new Date(year, month, 1); // Handles month overflow automatically
      const monthName = d.toLocaleString('es-ES', { month: 'long' });
      const nextYear = d.getFullYear();
      return `El cobro iniciará en ${monthName.toUpperCase()} de ${nextYear}.`;
    } catch (e) {
      return '';
    }
  };

  // Auto-generate taxpayer number for new records
  React.useEffect(() => {
    if (!isEditing && taxpayers.length > 0 && !newTp.taxpayerNumber) {
      const maNumbers = taxpayers
        .map(t => t.taxpayerNumber)
        .filter(n => n?.startsWith('2026-MA-'))
        .map(n => parseInt(n!.replace('2026-MA-', '')))
        .filter(n => !isNaN(n));
      
      const maxNumber = maNumbers.length > 0 ? Math.max(...maNumbers) : 0;
      const nextNumber = `2026-MA-${(maxNumber + 1).toString().padStart(2, '0')}`;
      
      setNewTp(prev => ({ ...prev, taxpayerNumber: nextNumber }));
    }
  }, [taxpayers, isEditing, newTp.taxpayerNumber]);

  // Recalculate balance when magnitude, selected codes, or dates change
  React.useEffect(() => {
    const newSelectedRates = { ...(newTp.selectedRates || {}) };
    let changed = false;
    let monthlyTotal = 0;

    (newTp.selectedTaxCodes || []).forEach(code => {
      const struct = (taxStructure as any[]).find(s => s.code === code);
      if (struct) {
        const magnitudeRates = newTp.magnitude === 'GRANDE' ? struct.rates.GRANDE :
                             newTp.magnitude === 'MEDIANO' ? struct.rates.MEDIANO : struct.rates.PEQUENO;
        
        if (Array.isArray(magnitudeRates)) {
          if (newSelectedRates[code] === undefined || !magnitudeRates.includes(newSelectedRates[code])) {
            newSelectedRates[code] = magnitudeRates[0];
            changed = true;
          }
          monthlyTotal += newSelectedRates[code];
        } else if (typeof magnitudeRates === 'number') {
          if (newSelectedRates[code] !== magnitudeRates) {
            newSelectedRates[code] = magnitudeRates;
            changed = true;
          }
          monthlyTotal += magnitudeRates;
        }
      }
    });

    // Add manual adjustments (monthly)
    monthlyTotal += (newTp.rotuloAmount || 0);
    monthlyTotal += (newTp.garbageAmount || 0);

    // Calculate arrears using unified logic
    const { total } = calculateTaxpayerDebt(newTp as Taxpayer, transactions, config);

    if (changed || total !== newTp.balance) {
      setNewTp(prev => ({
        ...prev,
        selectedRates: newSelectedRates,
        balance: total
      }));
    }
  }, [newTp.magnitude, newTp.selectedTaxCodes, newTp.rotuloAmount, newTp.garbageAmount, newTp.businessStartDate, newTp.paymentStartDate, newTp.yearlyAmount, newTp.lastPaymentMonth, isEditing, transactions, config]);

  const handleCancelEdit = () => {
    setNewTp(getInitialFormState());
    setIsEditing(false);
    setEditingId(null);
    setEditReason('');
    setShowYearlyAmountInput(false);
    setShowLastPaymentInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting taxpayer form...', newTp);

    // Proceed directly to submission (Antivirus scan removed by user request)
    await submitTaxpayerData({ ...newTp }, files);
  };


  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const submitTaxpayerData = async (taxpayerFormData: Partial<Taxpayer>, filesToUpload: Record<string, File>) => {
    console.log('Starting taxpayer data submission...', taxpayerFormData);
    setIsUploading(true);
    try {
      // Upload Files
      const uploadedDocs: Record<string, string> = { ...taxpayerFormData.documents };
      const docIdSafe = taxpayerFormData.docId?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';

      for (const [key, file] of Object.entries(filesToUpload)) {
        const ext = file.name.split('.').pop();
        const path = `taxpayers/${docIdSafe}/${key}_${Date.now()}.${ext}`;
        try {
          // Attempt immediate upload
          const url = await db.uploadTaxpayerDocument(file, path);
          uploadedDocs[key] = url;
        } catch (err: any) {
          console.warn(`[Offline Mode] Could not upload ${key} immediately, saving base64 for later sync:`, err);
          // SAVE AS BASE64 FOR OFFLINE SYNC
          const base64 = await fileToBase64(file);
          // We prefix it so SyncService knows it needs to be uploaded before pushing to DB
          uploadedDocs[key] = `base64:${path}|${base64}`;
        }
      }

      const taxpayerData = {
        ...taxpayerFormData,
        documents: uploadedDocs
      };

      const session = getSession();
      const currentUserIdent = session ? `${session.name} (${session.username})` : 'Usuario Desconocido';

      // Ensure audit fields are in both top-level and documents for maximum compatibility
      const finalTaxpayerData = {
        ...taxpayerData,
        lastEditedBy: currentUserIdent,
        documents: {
          ...(taxpayerData.documents || {}),
          lastEditedBy: currentUserIdent
        }
      };

      if (isEditing && editingId) {
        // Direct update - bypass request during update phase
        await onUpdate({
          ...finalTaxpayerData,
          id: editingId
        } as Taxpayer);
        
        alert(`Cambios guardados por ${currentUserIdent}`);
        handleCancelEdit();
        setFiles({});
        setEditReason('');
      } else {
        const finalStatus = (taxpayerData.balance && taxpayerData.balance > 0) ? TaxpayerStatus.MOROSO : taxpayerData.status;

        // Add createdBy for new records
        const newTaxpayerData = {
          ...finalTaxpayerData,
          createdBy: currentUserIdent,
          documents: {
            ...(finalTaxpayerData.documents || {}),
            createdBy: currentUserIdent
          }
        };

        // Generate sequential number based on existing active taxpayers (Format: 2026-MA-XXX)
        const prefix = `2026-MA-`;
        const activeNumbers = taxpayers
          .filter(t => t.taxpayerNumber?.startsWith(prefix))
          .map(t => {
            const parts = t.taxpayerNumber!.split('-');
            return parseInt(parts[parts.length - 1]) || 0;
          });
        
        const nextNum = Math.max(0, ...activeNumbers) + 1;
        const newTaxpayerNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;

        const tempId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString();
        
        await onAdd({
          ...newTaxpayerData,
          id: tempId,
          status: finalStatus,
          taxpayerNumber: newTaxpayerNumber,
          createdAt: new Date().toISOString().split('T')[0]
        } as Taxpayer);

        console.log('onAdd completed successfully');

        setNewTp(getInitialFormState());
        setShowYearlyAmountInput(false);
        setShowLastPaymentInput(false);
        setFiles({});
        
        // Show success modal with a small delay to ensure form reset doesn't flicker it
        setTimeout(() => {
          setConfirmModal({
            show: true,
            title: 'Registro Exitoso',
            message: `El contribuyente ${taxpayerData.name} ha sido registrado con el número ${newTaxpayerNumber}.`,
            confirmText: 'Entendido',
            onConfirm: () => setConfirmModal((prev: any) => ({ ...prev, show: false })),
            type: 'SUCCESS'
          });
        }, 100);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error: any) {
      console.error('CRITICAL ERROR in submitTaxpayerData:', error);
      const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
      alert(`⚠️ ERROR AL REGISTRAR:\n\n${errorMsg}\n\nPor favor, verifique que los campos sean correctos y que el contribuyente no exista ya.`);
    } finally {
      setIsUploading(false);
    }
  };

  // Activity Counts for Filter
  const activityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    taxpayers.forEach(tp => {
      // 1. Count specific commercial categories (TALLER, SUPERMERCADO, etc.)
      if (tp.commercialCategory) {
        counts[tp.commercialCategory] = (counts[tp.commercialCategory] || 0) + 1;
      }
      // 2. Count tax codes from taxStructure.json
      (tp.selectedTaxCodes || []).forEach(code => {
        counts[code] = (counts[code] || 0) + 1;
      });
      // 3. Count by Municipal Import Source (New)
      if (tp.documents?.import_source) {
        const source = tp.documents.import_source.replace('.xlsx', '').toUpperCase().trim();
        counts[source] = (counts[source] || 0) + 1;
      }
    });
    return counts;
  }, [taxpayers]);

  // The 19 official activity categories from Almirante
  const mainCategories = [
    'ABARROTERIA', 'ALMACEN', 'BARBERIA', 'BARES', 'BASURA2026', 'BUHONERIA', 
    'FARMACIA', 'FERRETERIA', 'FUMIGADORA', 'GASOLINERA', 'LAVA AUTO', 'LEGUMBRERIA', 
    'OTROS', 'PARQUEO', 'RESTAURANTE', 'ROPA AMERICANA', 'SUPERMERCADOS', 
    'TALLER', 'TAXI MAR', 'VIGENCIA EXPIRADA'
  ];

  // Filtered Activities for Modal
  const filteredActivities = React.useMemo(() => {
    return (taxStructure as any[]).filter(item => 
      item.activity.toLowerCase().includes(activitySearch.toLowerCase()) ||
      item.code.includes(activitySearch)
    );
  }, [activitySearch]);

  // ... (rest of component functions)





  // Search Effect
  React.useEffect(() => {
    if ((searchTerm.length > 0 || selectedActivity !== 'ALL') && !isEditing && !viewTaxpayer && !historyTaxpayer) {
      setIsSearching(true);
      const results = taxpayers.filter(t => {
        const matchesTerm = searchTerm.length === 0 || 
          (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.docId || '').includes(searchTerm) ||
          (t.taxpayerNumber || '').includes(searchTerm) ||
          (t.documents?.import_source || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const normalizeText = (text: string) => 
          (text || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        const matchesActivity = selectedActivity === 'ALL' || 
          (selectedActivity === 'PLACA' && (t.vehicles?.length || 0) > 0) ||
          (t.selectedTaxCodes || []).includes(selectedActivity) ||
          t.commercialCategory === selectedActivity ||
          (t.documents?.import_source && (
            normalizeText(t.documents.import_source).includes(normalizeText(selectedActivity)) ||
            normalizeText(selectedActivity).includes(normalizeText(t.documents.import_source).replace('.XLSX', ''))
          )) ||
          t.documents?.municipal_code === selectedActivity;
          
        return matchesTerm && matchesActivity;
      }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      setSearchResults(results.slice(0, 500)); 
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [searchTerm, taxpayers, selectedActivity]);





  const getCategoryLabel = (cat?: CommercialCategory) => {
    switch (cat) {
      case CommercialCategory.CLASE_A: return 'Clase A (Alto)';
      case CommercialCategory.CLASE_B: return 'Clase B (Medio)';
      case CommercialCategory.CLASE_C: return 'Clase C (Bajo)';
      case CommercialCategory.FUMIGADORA: return 'Fumigadora';
      default: return 'N/A';
    }
  };

  const handleStatusChange = (tp: Taxpayer, newStatus: TaxpayerStatus) => {
    onUpdate({ ...tp, status: newStatus });
    setOpenActionMenuId(null);
  };

  const getStatusColor = (status: TaxpayerStatus) => {
    switch (status) {
      case TaxpayerStatus.ACTIVO: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case TaxpayerStatus.SUSPENDIDO: return 'bg-amber-100 text-amber-800 border-amber-200';
      case TaxpayerStatus.BLOQUEADO: return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Filter history for selected taxpayer
  const taxpayerHistory = historyTaxpayer
    ? transactions.filter(t => t.taxpayerId === historyTaxpayer.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  
  const totalPaidHistory = taxpayerHistory.reduce((sum, t) => sum + (t.status === 'PAGADO' ? t.amount : 0), 0);

  return (
      <div id="taxpayers-root" className="space-y-6 pb-20 relative min-h-screen bg-slate-50 -m-4 sm:-m-8 p-4 sm:p-8">
      {/* --- MODALS AT TOP FOR BETTER VISIBILITY --- */}
      {/* --- HISTORY MODAL --- */}
      {historyTaxpayer && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-start justify-center z-[100] p-4 pt-10 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden border border-white/20">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500 rounded-xl">
                   <History size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Historial de Transacciones</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Auditoría de Pagos y Recaudación</p>
                </div>
              </div>
              <button onClick={() => setHistoryTaxpayer(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body Info */}
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{historyTaxpayer.name}</h2>
                  <p className="text-sm font-bold text-slate-500 mt-1">ID: <span className="font-mono text-indigo-600">{historyTaxpayer.docId}</span></p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-[200px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acumulado Histórico</p>
                  <p className="text-3xl font-black text-emerald-600 tracking-tighter">B/. {formatCurrency(totalPaidHistory)}</p>
                </div>
              </div>
            </div>

            {/* Transaction Table */}
            <div className="flex-1 overflow-y-auto p-8">
              {taxpayerHistory.length > 0 ? (
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="pb-4 px-4">Fecha / Hora</th>
                      <th className="pb-4 px-4">Concepto Detallado</th>
                      <th className="pb-4 px-4 text-right">Monto Neto</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {taxpayerHistory.map((t) => (
                      <tr key={t.id} className="group bg-slate-50 hover:bg-indigo-50/50 transition-all">
                        <td className="py-4 px-4 rounded-l-2xl border-l-4 border-indigo-500">
                          <div className="font-bold text-slate-900">{t.date}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{t.time}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-black text-slate-700 uppercase text-xs">{t.description || t.taxType}</span>
                          {t.metadata?.isConsolidated && t.metadata?.originalItems && (
                            <div className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3 py-1">
                              {t.metadata.originalItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-[9px] font-bold text-slate-500">
                                  <span className="uppercase opacity-70">{item.label}</span>
                                  <span className="text-slate-900">B/. {formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right rounded-r-2xl">
                          <span className="text-lg font-black text-slate-900 tracking-tighter">B/. {formatCurrency(t.amount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-20 text-slate-300">
                  <FileText size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="font-black text-xs uppercase tracking-widest opacity-40">No se encontraron transacciones</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => setHistoryTaxpayer(null)}
                className="px-8 py-3 bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW DETAILS (FICHA) MODAL --- */}
      {viewTaxpayer && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-start justify-center z-[100] p-4 pt-10 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl flex flex-col max-h-[85vh] overflow-hidden border border-white/20">
            {/* Header */}
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-indigo-500 rounded-2xl shadow-lg">
                   <User size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Ficha de Identidad</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Información Maestra del Contribuyente</p>
                </div>
              </div>
              <button onClick={() => setViewTaxpayer(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            {/* Content handled below in original location, but we move it here for visibility */}
            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
               {/* Ficha Content Re-rendered here for true Modal Behavior */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-3">Identidad & Estatus</h3>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</p>
                        <p className="text-xl font-black text-slate-900 tracking-tight">{viewTaxpayer.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Identificación</p>
                          <p className="text-base font-mono font-bold text-indigo-600">{viewTaxpayer.docId} {viewTaxpayer.dv ? `DV-${viewTaxpayer.dv}` : ''}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">N° Contribuyente</p>
                          <p className="text-base font-mono font-bold text-slate-700 bg-slate-100 px-2 rounded-lg">{viewTaxpayer.taxpayerNumber || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 pt-2">
                         <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(viewTaxpayer.status)}`}>
                           {viewTaxpayer.status}
                         </span>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desde: {viewTaxpayer.businessStartDate || viewTaxpayer.createdAt}</span>
                      </div>
                      
                      {/* Audit Trail */}
                      <div className="pt-6 border-t border-slate-100 mt-6 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Registrado por:</p>
                          <p className="text-[11px] font-bold text-slate-600">{viewTaxpayer.createdBy || 'Sistema (Legacy)'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Última Edición:</p>
                          <p className="text-[11px] font-bold text-slate-600">{viewTaxpayer.lastEditedBy || 'No editado'}</p>
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-3">Ubicación & Contacto</h3>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección Registrada</p>
                        <p className="text-base font-bold text-slate-700 leading-relaxed">{viewTaxpayer.address}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Corregimiento</p>
                        <p className="text-base font-black text-indigo-700 uppercase tracking-tight">{viewTaxpayer.corregimiento || 'No registrado'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6 pt-2">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</p>
                          <p className="text-sm font-bold text-slate-700">{viewTaxpayer.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                          <p className="text-sm font-bold text-slate-700 truncate">{viewTaxpayer.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="md:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-8 border-b border-white/5 pb-4 flex justify-between items-center">
                      <span>Servicios & Activos Vinculados</span>
                      <span className="text-white bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
                        {((viewTaxpayer.vehicles || []).length > 0 && (viewTaxpayer.selectedTaxCodes || []).length === 0) ? 'Total Anual' : 'Carga Tributaria Vigente'}
                      </span>
                    </h3>
                    <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5">
                            <th className="px-6 py-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest">Código / Cant.</th>
                            <th className="px-6 py-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest">Descripción del Activo o Servicio</th>
                            <th className="px-6 py-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {(isAdmin || isPlacaStation) ? (viewTaxpayer.vehicles || []).map((v, idx) => (
                            <tr key={`v-${idx}-${v.plate || ''}`} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded">
                                  PLACA
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors uppercase">
                                  Impuesto Circulación {v.plate}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {v.brand || v.model || 'Marca no especificada'}{v.year ? ` (${v.year})` : ''}
                                  {v.vehicleType ? ` | Tipo: ${v.vehicleType}` : ''}
                                  {v.plateType ? ` | Placa: ${v.plateType}` : ''}
                                  {v.color ? ` | Color: ${v.color}` : ''}
                                  {v.motorSerial ? ` | Motor: ${v.motorSerial}` : ''}
                                  {v.chassisSerial ? ` | Chasis (VIN): ${v.chassisSerial}` : ''}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-base font-black text-indigo-400 tabular-nums">B/. {formatCurrency((v as any).yearlyAmount || (v as any).yearly_amount || 0)}</div>
                                <div className="text-[9px] text-indigo-300/50 font-black uppercase">Anual</div>
                              </td>
                            </tr>
                          )) : null}

                          {viewTaxpayer.type === TaxpayerType.PLACA && viewTaxpayer.yearlyAmount ? (
                            <tr className="hover:bg-white/5 transition-colors group border-b border-white/5">
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/20 px-2 py-1 rounded">
                                  TARIFA ANUAL
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors uppercase">
                                  Impuesto de Placa Configurado
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {viewTaxpayer.businessStartDate 
                                    ? `Vinculado al mes de ${new Date(viewTaxpayer.businessStartDate + 'T00:00:00').toLocaleString('es-ES', { month: 'long' }).toUpperCase()} de inscripción` 
                                    : 'Impuesto Anual de Circulación'}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-base font-black text-amber-400 tabular-nums">B/. {formatCurrency(viewTaxpayer.yearlyAmount || 0)}</div>
                                <div className="text-[9px] text-amber-300/50 font-black uppercase">Anual</div>
                              </td>
                            </tr>
                          ) : null}

                          {viewTaxpayer.type === TaxpayerType.PLACA && viewTaxpayer.lastPaymentMonth ? (
                            <tr className="hover:bg-white/5 transition-colors group border-b border-white/5">
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                                  ÚLTIMO PAGO
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors uppercase">
                                  Mes del Último Pago Registrado
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {(() => {
                                    const [year, month] = viewTaxpayer.lastPaymentMonth.split('-').map(Number);
                                    const d = new Date(year, month - 1, 1);
                                    return `Registrado hasta ${d.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}`;
                                  })()}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-sm font-black text-emerald-400 uppercase">
                                  {viewTaxpayer.balance === 0 ? 'Paz y Salvo' : `Deuda: B/. ${formatCurrency(viewTaxpayer.balance)}`}
                                </div>
                                <div className="text-[9px] text-emerald-300/50 font-black uppercase">Historial</div>
                              </td>
                            </tr>
                          ) : null}

                          {(isAdmin || isNormalCaja) ? (viewTaxpayer.selectedTaxCodes || []).map((code, idx) => {
                            const struct = (taxStructure as any[]).find(s => s.code === code);
                            const rate = viewTaxpayer.selectedRates?.[code];
                            let finalRate = rate;
                            if (typeof finalRate !== 'number' && struct) {
                               const magnitudeRates = viewTaxpayer.magnitude === 'GRANDE' ? struct.rates.GRANDE : viewTaxpayer.magnitude === 'MEDIANO' ? struct.rates.MEDIANO : struct.rates.PEQUENO;
                               finalRate = typeof magnitudeRates === 'number' ? magnitudeRates : magnitudeRates[0];
                            }
                            return (
                              <tr key={`code-${code}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                                    {code}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors uppercase">
                                    {struct?.activity || 'Actividad Comercial'}
                                  </p>
                                  <p className="text-[10px] text-slate-400">Negocio / Establecimiento</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="text-base font-black text-emerald-400 tabular-nums">B/. {formatCurrency(finalRate || 0)}</div>
                                  <div className="text-[9px] text-emerald-300/50 font-black uppercase">Mensual</div>
                                </td>
                              </tr>
                            );
                          }) : null}

                          {(isAdmin || isNormalCaja) && (viewTaxpayer.rotuloAmount || 0) > 0 ? (
                            <tr className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-300 bg-red-500/20 px-2 py-1 rounded">
                                  RÓTULO
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors uppercase">
                                  Impuesto de Letreros y Rótulos
                                </p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-base font-black text-red-400 tabular-nums">B/. {formatCurrency(viewTaxpayer.rotuloAmount!)}</div>
                                <div className="text-[9px] text-red-300/50 font-black uppercase">Mensual</div>
                              </td>
                            </tr>
                          ) : null}

                          {(isAdmin || isNormalCaja) && (viewTaxpayer.garbageAmount || 0) > 0 ? (
                            <tr className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                                  ASEO
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors uppercase">
                                  Servicio de Recolección de Basura
                                </p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-base font-black text-emerald-400 tabular-nums">B/. {formatCurrency(viewTaxpayer.garbageAmount!)}</div>
                                <div className="text-[9px] text-emerald-300/50 font-black uppercase">Mensual</div>
                              </td>
                            </tr>
                          ) : null}

                          <tr className="bg-white/10 border-t border-white/20">
                            <td className="px-6 py-5 text-indigo-300">
                                <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/30 px-2 py-1 rounded">
                                  TOTAL ACTIVOS: {
                                     (isAdmin || isPlacaStation ? (viewTaxpayer.vehicles?.length || 0) : 0) + 
                                     (isAdmin || isNormalCaja ? (viewTaxpayer.selectedTaxCodes?.length || 0) + ((viewTaxpayer.garbageAmount || 0) > 0 ? 1 : 0) : 0)
                                  }
                                </span>
                            </td>
                            <td className="px-6 py-5 text-right text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                                Resumen de Carga {isPlacaStation ? 'Anual' : 'Mensual'}
                            </td>
                            <td className="px-6 py-5 text-right">
                              <span className="text-xl font-black text-white tabular-nums drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                                B/. {formatCurrency(
                                  (isAdmin || isPlacaStation ? (viewTaxpayer.yearlyAmount || 0) : 0) + 
                                  (isAdmin || isNormalCaja ? (
                                     ((viewTaxpayer.selectedTaxCodes || []).reduce((acc, code) => {
                                         const struct = (taxStructure as any[]).find(s => s.code === code);
                                         if (!struct) return acc;
                                         const rate = viewTaxpayer.selectedRates?.[code];
                                         if (typeof rate === 'number') return acc + rate;
                                         const magnitudeRates = viewTaxpayer.magnitude === 'GRANDE' ? struct.rates.GRANDE : viewTaxpayer.magnitude === 'MEDIANO' ? struct.rates.MEDIANO : struct.rates.PEQUENO;
                                         return acc + (typeof magnitudeRates === 'number' ? magnitudeRates : (magnitudeRates[0] || 0));
                                       }, 0)) + (viewTaxpayer.rotuloAmount || 0) + (viewTaxpayer.garbageAmount || 0)
                                  ) : 0)
                                )}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                 </div>

                 {/* 4. Digital Documents (New Integration) */}
                 {viewTaxpayer.documents && Object.keys(viewTaxpayer.documents).length > 0 && (
                   <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                     <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                       <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                         <FileText size={20} />
                       </div>
                       <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Expediente Digital & Documentación</h3>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                       {Object.entries(viewTaxpayer.documents)
                          .filter(([key]) => {
                            if (isAdmin) return true;
                            const placaDocs = ['vehicle_docs', 'vehicle_registry', 'vehicle_inspection', 'transfer_card', 'plate_photo'];
                            if (isPlacaStation) {
                              // Solo ver fotos básicas y cosas de placas
                              return ['taxpayer_photo', 'id_card', 'residence_sketch', 'import_source'].includes(key) || placaDocs.includes(key);
                            }
                            if (isNormalCaja) {
                              // Ver todo EXCEPTO cosas de placas
                              return !placaDocs.includes(key);
                            }
                            return true;
                          })
                          .map(([key, url]) => {
                          const isImage = typeof url === 'string' && (key.includes('photo') || key.includes('sketch') || key.includes('store') || !!url.match(/\.(jpg|jpeg|png|gif|webp)$/i));

                         return (
                           <a
                             key={key}
                             href={url}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="group block relative p-2 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-300 hover:bg-white hover:shadow-xl transition-all"
                           >
                             <div className="aspect-square w-full bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 mb-3 transition-colors overflow-hidden relative">
                               {isImage ? (
                                 <img 
                                   src={url} 
                                   alt={key} 
                                   className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                   onError={(e) => {
                                     (e.target as any).src = 'https://via.placeholder.com/150?text=Error';
                                   }}
                                 />
                               ) : (
                                 <FileText size={32} />
                                )}
                                <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <Search className="text-white" size={24} />
                                </div>
                             </div>
                             <div className="px-2 pb-2">
                               <p className="text-[10px] font-black text-slate-900 group-hover:text-indigo-700 uppercase tracking-tighter leading-tight text-center">
                                 {{
                                   taxpayer_photo: 'Foto Perfil',
                                   id_card: 'Cédula / ID',
                                   public_registry: 'Reg. Público',
                                   operation_notice: 'Aviso Op.',
                                   store_photo: 'Fachada Neg.',
                                   residence_sketch: 'Croquis Ubic.',
                                   vehicle_docs: 'Docs. Vehículo'
                                 }[key] || key.replace(/_/g, ' ')}
                               </p>
                             </div>
                           </a>
                         );
                       })}
                     </div>
                   </div>
                 )}
               </div>
            </div>

            <div className="p-8 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <button
                  onClick={() => setShowDebtBreakdown(!showDebtBreakdown)}
                  className="flex items-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shrink-0"
                >
                  <Calculator size={18} />
                  {showDebtBreakdown ? 'Ocultar Deuda' : 'Desglose de Deuda'}
                </button>
                <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
                <button
                  onClick={() => {
                    setConfirmModal({
                      show: true,
                      title: '¿Eliminar Contribuyente?',
                      message: `¿Estás seguro de que deseas eliminar permanentemente a ${viewTaxpayer.name}? Esta acción no se puede deshacer.`,
                      confirmText: 'Sí, Eliminar',
                      cancelText: 'Cancelar',
                      type: 'DANGER',
                      onConfirm: () => {
                        onDelete(viewTaxpayer.id!);
                        setViewTaxpayer(null);
                        setConfirmModal(prev => ({ ...prev, show: false }));
                      }
                    });
                  }}
                  className="flex items-center gap-2 px-6 py-4 bg-red-50 text-red-700 hover:bg-red-100 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shrink-0"
                >
                  <Trash2 size={18} />
                  Eliminar
                </button>
                <button
                  onClick={async () => {
                    const updated = { ...viewTaxpayer, status: 'ACTIVO' as any };
                    await onUpdate(updated);
                    setViewTaxpayer(updated);
                  }}
                  className={`flex items-center gap-2 px-6 py-4 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shrink-0 ${viewTaxpayer.status === 'ACTIVO' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                >
                  <CheckCircle size={18} />
                  Activo
                </button>
                <button
                  onClick={async () => {
                    const updated = { ...viewTaxpayer, status: 'SUSPENDIDO' as any };
                    await onUpdate(updated);
                    setViewTaxpayer(updated);
                  }}
                  className={`flex items-center gap-2 px-6 py-4 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shrink-0 ${viewTaxpayer.status === 'SUSPENDIDO' ? 'bg-amber-500 text-white shadow-lg' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                >
                  <Ban size={18} />
                  Suspendido
                </button>
              </div>

              <button
                onClick={() => setViewTaxpayer(null)}
                className="px-10 py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl active:scale-95 shrink-0"
              >
                Cerrar Ficha
              </button>
            </div>

            {/* --- DEBT BREAKDOWN SLIDE-OVER / SECTION --- */}
            {showDebtBreakdown && viewTaxpayer && (
              <div className="border-t border-slate-200 bg-slate-50 p-10 animate-fade-in-up">
                <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Estructura Tributaria Mensual</h3>
                      <p className="text-slate-500 text-sm font-bold mt-1">Configure las actividades y magnitud para el cobro automatizado</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                      {(['PEQUEÑO', 'MEDIANO', 'GRANDE'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={async () => {
                            const updated = { ...viewTaxpayer, magnitude: m };
                            
                            // Recalculate balance
                             const newSelectedRates = { ...(updated.selectedRates || {}) };
                             
                             let total = 0;
                             (updated.selectedTaxCodes || []).forEach(code => {
                               const struct = (taxStructure as any[]).find(s => s.code === code);
                               if (struct) {
                                 const magnitudeRates = m === 'GRANDE' ? struct.rates.GRANDE :
                                                      m === 'MEDIANO' ? struct.rates.MEDIANO : struct.rates.PEQUENO;
                                 
                                 if (Array.isArray(magnitudeRates)) {
                                   if (newSelectedRates[code] === undefined || !magnitudeRates.includes(newSelectedRates[code])) {
                                     newSelectedRates[code] = magnitudeRates[0];
                                   }
                                   if (typeof newSelectedRates[code] === 'number') {
                                     total += newSelectedRates[code];
                                   }
                                 } else if (typeof magnitudeRates === 'number') {
                                   newSelectedRates[code] = magnitudeRates;
                                   total += magnitudeRates;
                                 }
                               }
                             });
                             updated.selectedRates = newSelectedRates;
                             updated.balance = total + (updated.rotuloAmount || 0) + (updated.garbageAmount || 0);
                            
                            await onUpdate(updated);
                            setViewTaxpayer(updated);
                          }}
                          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewTaxpayer.magnitude === m
                            ? 'bg-red-600 text-white shadow-lg'
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                            }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2">
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          placeholder="Buscar actividad por nombre o código..."
                          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.5rem] shadow-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black"
                          value={taxSearchTerm}
                          onChange={(e) => setTaxSearchTerm(e.target.value)}
                        />
                      </div>

                      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cuota ({viewTaxpayer.magnitude})</th>
                              <th className="px-6 py-4 text-right"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {taxStructure
                                .filter(item =>
                                  (item.code || '').toLowerCase().includes(taxSearchTerm.toLowerCase()) ||
                                  (item.activity || '').toLowerCase().includes(taxSearchTerm.toLowerCase())
                                )
                                .map((item) => {
                                  const isSelected = viewTaxpayer.selectedTaxCodes?.includes(item.code);

                                  return (
                                    <tr key={item.code} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                      <td className="px-6 py-4 font-mono font-black text-indigo-600 text-sm">{item.code}</td>
                                      <td className="px-6 py-4">
                                        <span className="block font-bold text-slate-700 text-sm">{item.activity}</span>
                                        {isSelected && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">&bull; Seleccionado</span>}
                                      </td>
                                    <td className="px-6 py-4 text-right font-black text-slate-900">
                                      {(() => {
                                        const magnitudeRates = viewTaxpayer.magnitude === 'GRANDE' ? item.rates.GRANDE :
                                                             viewTaxpayer.magnitude === 'MEDIANO' ? item.rates.MEDIANO : item.rates.PEQUENO;
                                        
                                        if (Array.isArray(magnitudeRates)) {
                                          const currentRate = viewTaxpayer.selectedRates?.[item.code] || magnitudeRates[0];
                                          return (
                                            <div className="flex flex-col items-end gap-1">
                                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Multi-regimen</span>
                                              {isSelected ? (
                                                <select 
                                                  className="text-xs p-1 border rounded bg-white text-black font-bold"
                                                  value={currentRate}
                                                  onChange={async (e) => {
                                                    const val = parseFloat(e.target.value);
                                                    const updated = {
                                                      ...viewTaxpayer,
                                                      selectedRates: {
                                                        ...(viewTaxpayer.selectedRates || {}),
                                                        [item.code]: val
                                                      }
                                                    };
                                                    
                                                    // Recalculate balance
                                                    let newTotal = 0;
                                                    (updated.selectedTaxCodes || []).forEach(c => {
                                                      const s = (taxStructure as any[]).find(st => st.code === c);
                                                      if (s) {
                                                        const mRates = updated.magnitude === 'GRANDE' ? s.rates.GRANDE :
                                                                       updated.magnitude === 'MEDIANO' ? s.rates.MEDIANO : s.rates.PEQUENO;
                                                        if (Array.isArray(mRates)) {
                                                          const rate = updated.selectedRates?.[c] || mRates[0];
                                                          if (typeof rate === 'number') newTotal += rate;
                                                        } else if (typeof mRates === 'number') {
                                                          newTotal += mRates;
                                                        }
                                                      }
                                                    });
                                                    updated.balance = newTotal + (updated.rotuloAmount || 0) + (updated.garbageAmount || 0);
                                                    
                                                    await onUpdate(updated);
                                                    setViewTaxpayer(updated);
                                                  }}
                                                >
                                                  {magnitudeRates.map((r: number, i: number) => (
                                                    <option key={i} value={r}>Opción {i+1}: B/. {formatCurrency(r)}</option>
                                                  ))}
                                                </select>
                                              ) : (
                                                <span className="text-sm">B/. {formatCurrency(magnitudeRates[0])}+</span>
                                              )}
                                            </div>
                                          );
                                        } else if (typeof magnitudeRates === 'number') {
                                          return `B/. ${formatCurrency(magnitudeRates)}`;
                                        } else {
                                          return magnitudeRates;
                                        }
                                      })()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <button
                                        onClick={async () => {
                                          const current = viewTaxpayer.selectedTaxCodes || [];
                                          const updatedCodes = isSelected
                                            ? current.filter(c => c !== item.code)
                                            : [...current, item.code];
                                          
                                          const updated = { ...viewTaxpayer, selectedTaxCodes: updatedCodes };
                                          
                                          let total = 0;
                                          const newSelectedRates = { ...(updated.selectedRates || {}) };

                                          updatedCodes.forEach(code => {
                                            const struct = (taxStructure as any[]).find(s => s.code === code);
                                            if (struct) {
                                              const magnitudeRates = updated.magnitude === 'GRANDE' ? struct.rates.GRANDE :
                                                                   updated.magnitude === 'MEDIANO' ? struct.rates.MEDIANO : struct.rates.PEQUENO;
                                              
                                              if (Array.isArray(magnitudeRates)) {
                                                if (newSelectedRates[code] === undefined || !magnitudeRates.includes(newSelectedRates[code])) {
                                                  newSelectedRates[code] = magnitudeRates[0];
                                                }
                                                total += newSelectedRates[code];
                                              } else if (typeof magnitudeRates === 'number') {
                                                newSelectedRates[code] = magnitudeRates;
                                                total += magnitudeRates;
                                              }
                                            }
                                          });
                                          updated.selectedRates = newSelectedRates;
                                          updated.balance = total + (updated.rotuloAmount || 0) + (updated.garbageAmount || 0);
                                          
                                          await onUpdate(updated);
                                          setViewTaxpayer(updated);
                                        }}
                                        className={`p-2 rounded-xl transition-all ${isSelected ? 'bg-red-500 text-white shadow-lg rotate-0' : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600'}`}
                                      >
                                        <CheckSquare size={18} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px] -mr-16 -mt-16"></div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">Resumen Mensual Estimado</h4>
                        
                        <div className="space-y-4 mb-8">
                          <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                            <span className="text-slate-400">Actividades Seleccionadas</span>
                            <span className="font-black">{viewTaxpayer.selectedTaxCodes?.length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                            <span className="text-slate-400">Impuesto Rótulo</span>
                            <input 
                              type="number" 
                              inputMode="decimal"
                              className="w-20 bg-transparent border-b border-indigo-500/30 text-right font-black text-indigo-400 focus:border-indigo-400 outline-none" 
                              value={viewTaxpayer.rotuloAmount ?? ''}
                              onChange={async (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const session = getSession();
                                const currentUserIdent = session ? `${session.name} (${session.username})` : 'Usuario Desconocido';
                                const updated = { ...viewTaxpayer, rotuloAmount: val, lastEditedBy: currentUserIdent };
                                
                                // Recalculate balance
                                let newTotal = 0;
                                (updated.selectedTaxCodes || []).forEach(c => {
                                  const s = (taxStructure as any[]).find(st => st.code === c);
                                  if (s) {
                                    const mRates = updated.magnitude === 'GRANDE' ? s.rates.GRANDE :
                                                   updated.magnitude === 'MEDIANO' ? s.rates.MEDIANO : s.rates.PEQUENO;
                                    if (Array.isArray(mRates)) {
                                      const rate = updated.selectedRates?.[c] || mRates[0];
                                      if (typeof rate === 'number') newTotal += rate;
                                    } else if (typeof mRates === 'number') {
                                      newTotal += mRates;
                                    }
                                  }
                                });
                                newTotal += val + (updated.garbageAmount || 0);
                                updated.balance = newTotal;
                                
                                await onUpdate(updated);
                                setViewTaxpayer(updated);
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Servicio Basura</span>
                            <input 
                              type="number" 
                              inputMode="decimal"
                              className="w-20 bg-transparent border-b border-emerald-500/30 text-right font-black text-emerald-400 focus:border-emerald-400 outline-none" 
                              value={viewTaxpayer.garbageAmount ?? ''}
                              onChange={async (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const session = getSession();
                                const currentUserIdent = session ? `${session.name} (${session.username})` : 'Usuario Desconocido';
                                const updated = { ...viewTaxpayer, garbageAmount: val, lastEditedBy: currentUserIdent };
                                
                                // Recalculate balance
                                let newTotal = 0;
                                (updated.selectedTaxCodes || []).forEach(c => {
                                  const s = (taxStructure as any[]).find(st => st.code === c);
                                  if (s) {
                                    const mRates = updated.magnitude === 'GRANDE' ? s.rates.GRANDE :
                                                   updated.magnitude === 'MEDIANO' ? s.rates.MEDIANO : s.rates.PEQUENO;
                                    if (Array.isArray(mRates)) {
                                      const rate = updated.selectedRates?.[c] || mRates[0];
                                      if (typeof rate === 'number') newTotal += rate;
                                    } else if (typeof mRates === 'number') {
                                      newTotal += mRates;
                                    }
                                  }
                                });
                                newTotal += val + (updated.rotuloAmount || 0);
                                updated.balance = newTotal;
                                
                                await onUpdate(updated);
                                setViewTaxpayer(updated);
                              }}
                            />
                          </div>
                        </div>

                        <div className="pt-6 border-t border-white/10">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total a Recaudar</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black tabular-nums">B/. {formatCurrency(viewTaxpayer.balance || 0)}</span>
                            <span className="text-[10px] font-black text-indigo-400 uppercase">/ Mes</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl">
                         <div className="flex gap-3">
                            <AlertCircle className="text-amber-600 shrink-0" size={20} />
                            <div>
                               <p className="text-xs font-bold text-amber-900 leading-tight">Nota de Facturación</p>
                               <p className="text-[10px] text-amber-800/70 mt-1">Los cambios en la estructura tributaria se verán reflejados en el próximo ciclo de facturación mensual.</p>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TOP SEARCH BAR (Sticky) --- */}
      <div id="taxpayer-top" className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200 -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 mb-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4 relative">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por Nombre, RUC o Cédula..."
              className="w-full pl-12 pr-10 py-3 border border-slate-300 rounded-full shadow-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-lg transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm.length > 0 && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowActivityDropdown(!showActivityDropdown)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 whitespace-nowrap border ${
                selectedActivity !== 'ALL' 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-200' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Briefcase size={18} />
              {selectedActivity === 'ALL' ? 'Filtrar Actividad' : selectedActivity}
              <ChevronDown size={16} className={`transition-transform ${showActivityDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showActivityDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActivityDropdown(false)}></div>
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fade-in max-h-[70vh] overflow-y-auto">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Seleccionar Actividad
                  </div>
                  <button
                    onClick={() => {
                      setSelectedActivity('ALL');
                      setShowActivityDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors border-b border-slate-50 ${selectedActivity === 'ALL' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}
                  >
                    TODAS LAS ACTIVIDADES
                  </button>
                  {MUNICIPAL_ACTIVITIES.map(act => (
                    <button
                      key={act}
                      onClick={() => {
                        setSelectedActivity(act);
                        setShowActivityDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors border-b border-slate-50 ${selectedActivity === act ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Persistent Record Counter (Floating) */}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 animate-in slide-in-from-right duration-500 pointer-events-auto">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl font-black">
            {taxpayers.length}
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Cargado</div>
            <div className="text-sm font-black uppercase tracking-widest text-indigo-400">Registros en Sistema</div>
          </div>
        </div>
      </div>

        {/* Search Results Overlay */}
        {isSearching && (
          <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70]" onClick={() => {
              setIsSearching(false);
              setSearchTerm('');
              setSelectedActivity('ALL');
            }}></div>
            <div className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-4xl bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/20 overflow-hidden animate-in fade-in zoom-in-95 duration-300 z-[80] ring-1 ring-black/5">
              <div className="bg-slate-900 px-10 py-8 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex items-center gap-6">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40 rotate-3">
                    <Search size={32} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-2xl tracking-tight uppercase">Resultados del Catastro</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {searchResults.length} Registros
                      </span>
                      {selectedActivity !== 'ALL' && (
                        <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {selectedActivity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsSearching(false);
                    setSearchTerm('');
                    setSelectedActivity('ALL');
                  }}
                  className="relative z-10 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto bg-slate-50/50">
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 divide-y divide-slate-200/60">
                    {searchResults.map((tp, idx) => (
                      <div
                        key={`search-${tp.id}-${tp.taxpayerNumber || ''}-${idx}`}
                        onClick={() => {
                          setHistoryTaxpayer(tp);
                          setSearchTerm('');
                          setSelectedActivity('ALL');
                          setIsSearching(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="group relative flex items-center justify-between p-8 hover:bg-white transition-all cursor-pointer border-l-8 border-transparent hover:border-indigo-600"
                      >
                        <div className="flex items-center gap-6">
                          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl font-black shadow-xl transition-transform group-hover:scale-110 ${
                            tp.status === 'ACTIVO' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {tp.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 text-xl group-hover:text-indigo-700 transition-colors uppercase tracking-tight leading-tight">{tp.name}</div>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                                <CreditCard size={14} className="text-slate-400" />
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{tp.docId}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                                <FileText size={14} className="text-slate-400" />
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{tp.taxpayerNumber}</span>
                              </div>
                              {tp.documents?.import_source && (
                                <div className="flex items-center gap-2">
                                  <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                    {tp.documents.import_source.replace('.xlsx', '')}
                                  </span>
                                </div>
                              )}
                              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                tp.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 
                                tp.status === 'SUSPENDIDO' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {tp.status}
                              </div>
                            </div>
                            
                            {/* Service Indicators (General) */}
                            <div className="flex items-center gap-3 mt-3">
                              {tp.vehicles && tp.vehicles.length > 0 && (
                                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                                  <Car size={10} className="stroke-[3]" />
                                  <span className="text-[9px] font-black uppercase">Placas ({tp.vehicles.length})</span>
                                </div>
                              )}
                              {tp.selectedTaxCodes && tp.selectedTaxCodes.length > 0 && (
                                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                                  <Store size={10} className="stroke-[3]" />
                                  <span className="text-[9px] font-black uppercase">Comercio</span>
                                </div>
                              )}
                              {tp.hasGarbageService && (
                                <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100">
                                  <Trash2 size={10} className="stroke-[3]" />
                                  <span className="text-[9px] font-black uppercase">Aseo</span>
                                </div>
                              )}
                              {(isAdmin || isCaja1) && tp.hasConstruction && (
                                <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2 py-0.5 rounded-md border border-red-100">
                                  <Hammer size={10} className="stroke-[3]" />
                                  <span className="text-[9px] font-black uppercase">Construcción</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditInit(tp);
                              setSearchTerm('');
                              setSelectedActivity('ALL');
                              setIsSearching(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/10"
                            title="Editar"
                          >
                            <Edit size={20} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const freshTp = taxpayers.find(t => t.id === tp.id) || tp;
                              setViewTaxpayer(freshTp);
                              setSearchTerm('');
                              setSelectedActivity('ALL');
                              setIsSearching(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-lg shadow-indigo-500/10"
                            title="Ver Ficha"
                          >
                            <ChevronRight size={24} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                show: true,
                                title: '¿Eliminar Registro?',
                                message: `¿Confirma que desea eliminar a ${tp.name}?`,
                                confirmText: 'Eliminar',
                                cancelText: 'Cancelar',
                                type: 'DANGER',
                                onConfirm: () => {
                                  onDelete(tp.id!);
                                  setConfirmModal(prev => ({ ...prev, show: false }));
                                }
                              });
                            }}
                            className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
                            title="Eliminar"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 text-center">
                    <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search size={48} className="text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase">Sin resultados</h3>
                    <p className="text-slate-500 font-bold mt-2 max-w-xs mx-auto">
                      No encontramos registros con esos criterios en el Catastro 2026.
                    </p>
                    <p className="text-slate-400 text-[10px] mt-4 font-black uppercase tracking-widest">
                      Total Registros Cargados: {taxpayers.length}
                    </p>
                    <div className="flex flex-col gap-3 mt-8">
                      <button 
                        onClick={() => onRefresh ? onRefresh() : window.location.reload()}
                        className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95"
                      >
                        Sincronizar Base de Datos
                      </button>
                      <button 
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedActivity('ALL');
                        }}
                        className="px-10 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                      >
                        Limpiar Filtros
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-white px-10 py-6 border-t border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  Conexión Directa con Tesorería
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  SIGMA v0.0.8 - Almirante
                </div>
              </div>
            </div>
          </>
        )}

      {/* --- MAIN CONTENT: NEW RECORD FORM --- */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 text-white p-6 md:p-8 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <UserPlus size={120} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg backdrop-blur ${isEditing ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {isEditing ? <Edit size={24} /> : <UserPlus size={24} />}
              </div>
              <span className={`${isEditing ? 'text-amber-400' : 'text-emerald-400'} font-bold tracking-wider text-sm uppercase`}>
                {isEditing ? 'Modo Edición' : 'Nuevo Registro'}
              </span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{isEditing ? 'Editar Contribuyente' : 'Ficha de Contribuyente'}</h2>
            <p className="text-slate-400 text-lg">
              {isEditing ? 'Modifique los datos necesarios. Los cambios se guardarán al finalizar.' : 'Ingrese los datos para registrar un nuevo contribuyente.'}
            </p>
            {isEditing && newTp.taxpayerNumber && (
              <div className="mt-4 inline-flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-4 py-2">
                <div className="flex flex-col">
                  <span className="text-xs uppercase font-bold text-slate-300">N° Contribuyente</span>
                  <span className="text-xl font-mono font-bold text-white tracking-widest">{newTp.taxpayerNumber}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* The Form Content (Reused from Modal) */}
        <div className="p-6 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Same Sections as before, but without modal styling constraints */}

            {/* SECTION 1: TYPE SELECTOR */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(isAdmin || isNormalCaja) && (
                <button
                  type="button"
                  onClick={() => setNewTp({ ...newTp, type: TaxpayerType.NATURAL_1, hasCommercialActivity: false })}
                  className={`py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.NATURAL_1
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                    }`}
                >
                  <User size={32} className="mb-2" />
                  <span className="text-sm">Natural 1 (Personal)</span>
                </button>
              )}
              {(isAdmin || isNormalCaja) && (
                <button
                  type="button"
                  onClick={() => setNewTp({ ...newTp, type: TaxpayerType.NATURAL_2, hasCommercialActivity: true })}
                  className={`py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.NATURAL_2
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                    }`}
                >
                  <Store size={32} className="mb-2" />
                  <span className="text-sm">Natural 2 (Comercio)</span>
                </button>
              )}
              {(isAdmin || isNormalCaja) && (
                <button
                  type="button"
                  onClick={() => setNewTp({ ...newTp, type: TaxpayerType.JURIDICA, hasCommercialActivity: true })}
                  className={`py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.JURIDICA
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                    }`}
                >
                  <Briefcase size={32} className="mb-2" />
                  <span className="text-sm">Jurídica</span>
                </button>
              )}
              {(isAdmin || isPlacaStation) && (
                <button
                  type="button"
                  onClick={() => setNewTp({ ...newTp, type: TaxpayerType.PLACA, hasCommercialActivity: false })}
                  className={`py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.PLACA
                    ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                    }`}
                >
                  <Car size={32} className="mb-2" />
                  <span className="text-sm">Placa (Vehículo)</span>
                </button>
              )}
            </div>

            {/* SECTION 2: GENERAL DATA */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-200 pb-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3 text-slate-600 font-bold text-sm">1</div>
                Datos Generales
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo / Razón Social</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.name ?? ''} onChange={e => setNewTp({ ...newTp, name: e.target.value })} placeholder="Ej. Juan Pérez o Inversiones del Caribe S.A." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Identificación (Cédula / RUC)</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.docId ?? ''} onChange={e => setNewTp({ ...newTp, docId: e.target.value })} placeholder={newTp.type === TaxpayerType.JURIDICA ? '15569-88-99' : '8-888-888'} />
                </div>

                {newTp.type === TaxpayerType.JURIDICA && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Dígito Verificador (DV)</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                      value={newTp.dv || ''} onChange={e => setNewTp({ ...newTp, dv: e.target.value })} placeholder="00" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Dirección Física</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.address ?? ''} onChange={e => setNewTp({ ...newTp, address: e.target.value })} placeholder="Provincia, Distrito, Casa..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Corregimiento</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                    value={newTp.corregimiento || ''}
                    onChange={e => setNewTp({ ...newTp, corregimiento: e.target.value as Corregimiento })}
                  >
                    <option value="">Seleccionar Corregimiento...</option>
                    {Object.values(Corregimiento).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.phone ?? ''} onChange={e => setNewTp({ ...newTp, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input type="email" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.email ?? ''} onChange={e => setNewTp({ ...newTp, email: e.target.value })} />
                </div>
                {newTp.type !== TaxpayerType.PLACA && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Inicio de Negocio (Aviso de Operaciones)</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                      value={newTp.businessStartDate || ''} onChange={e => setNewTp({ ...newTp, businessStartDate: e.target.value })} />
                    <p className="text-xs text-slate-500 mt-1">Determina automáticamente los meses de atraso.</p>
                  </div>
                )}

                {newTp.type === TaxpayerType.PLACA && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Número de Placa</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                        value={newTp.vehicles?.[0]?.plate || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].plate = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. AB1234"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Fecha de Inscripción</label>
                      <input type="date" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                        value={newTp.businessStartDate || ''} onChange={e => setNewTp({ ...newTp, businessStartDate: e.target.value })} />
                      <p className="text-xs text-slate-500 mt-1">Define el mes de pago anual correspondiente.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Marca del Auto</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                        value={newTp.vehicles?.[0]?.brand || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].brand = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. Toyota"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Año del Vehículo</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                        value={newTp.vehicles?.[0]?.year || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].year = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. 2024"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Vehículo</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                        value={newTp.vehicles?.[0]?.vehicleType || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].vehicleType = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. Sedán, Pick-up, SUV"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Placa</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                        value={newTp.vehicles?.[0]?.plateType || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].plateType = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. Particular, Comercial"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Color</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base bg-white"
                        value={newTp.vehicles?.[0]?.color || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].color = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. Blanco"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Número de Motor</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base font-mono bg-white"
                        value={newTp.vehicles?.[0]?.motorSerial || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].motorSerial = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. 2TR-FE123456"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 mb-1">Número de Chasis (VIN)</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base font-mono bg-white"
                        value={newTp.vehicles?.[0]?.chassisSerial || ''} 
                        onChange={e => {
                          const v = [...(newTp.vehicles || [])];
                          if (!v[0]) v[0] = { plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false };
                          v[0].chassisSerial = e.target.value;
                          setNewTp({ ...newTp, vehicles: v });
                        }} 
                        placeholder="Ej. JTE234567890"
                      />
                    </div>

                    {/* DYNAMIC PLATE TAX & PAYMENT CONFIGURATION */}
                    <div className="md:col-span-2 mt-4 bg-slate-100 p-5 rounded-2xl border border-slate-200 shadow-sm">
                      <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="p-1 bg-amber-500 text-white rounded-lg text-[10px]">⚙️</span>
                        Configuración Fiscal de Placa
                      </h5>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Button or input for Yearly Amount */}
                        {!showYearlyAmountInput && !newTp.yearlyAmount ? (
                          <button
                            type="button"
                            onClick={() => setShowYearlyAmountInput(true)}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all font-semibold text-sm bg-white hover:shadow-sm active:scale-95"
                          >
                            <span className="text-lg font-black">+</span> Agregar Monto de Pago Anual
                          </button>
                        ) : (
                          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:border-indigo-200">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-xs font-bold text-slate-700">Monto de Pago Anual</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowYearlyAmountInput(false);
                                  setNewTp({ ...newTp, yearlyAmount: 0 });
                                }}
                                className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-slate-400 font-bold text-sm">B/.</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                className="w-full p-2 border border-slate-300 rounded-lg text-right font-black text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white"
                                value={newTp.yearlyAmount || ''}
                                onChange={(e) => setNewTp({ ...newTp, yearlyAmount: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 block italic leading-tight bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {getInscriptionLinkText(newTp.businessStartDate)}
                            </span>
                          </div>
                        )}

                        {/* Button or input for Last Payment Month */}
                        {!showLastPaymentInput && !newTp.lastPaymentMonth ? (
                          <button
                            type="button"
                            onClick={() => setShowLastPaymentInput(true)}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all font-semibold text-sm bg-white hover:shadow-sm active:scale-95"
                          >
                            <span className="text-lg font-black">+</span> Agregar Mes del Último Pago
                          </button>
                        ) : (
                          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:border-indigo-200">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-xs font-bold text-slate-700">Mes del Último Pago</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowLastPaymentInput(false);
                                  setNewTp({ ...newTp, lastPaymentMonth: '' });
                                }}
                                className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                            <input
                              type="month"
                              className="w-full p-2 mb-2 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all bg-white text-sm"
                              value={newTp.lastPaymentMonth || ''}
                              onChange={(e) => setNewTp({ ...newTp, lastPaymentMonth: e.target.value })}
                            />
                            {newTp.lastPaymentMonth && (
                              <div className="mt-2 flex flex-col gap-1.5">
                                <span className="text-[10px] text-slate-500 block italic leading-tight">
                                  {getNextUnpaidPeriodText(newTp.lastPaymentMonth)}
                                </span>
                                {newTp.balance === 0 ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    PAZ Y SALVO (Deuda: B/. 0.00)
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    DEUDA: B/. {formatCurrency(newTp.balance || 0)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {isEditing && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Migración: Iniciar cobro desde</label>
                    <input type="date" className="w-full border border-amber-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-amber-100 focus:border-amber-500 transition-all text-black text-base bg-amber-50"
                      value={newTp.paymentStartDate || ''} onChange={e => setNewTp({ ...newTp, paymentStartDate: e.target.value })} />
                    <p className="text-xs text-amber-600 mt-1">Si se establece, se usará esta fecha para calcular la deuda.</p>
                  </div>
                )}
                </div>
              </div>

            {newTp.type !== TaxpayerType.PLACA && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-3 uppercase tracking-widest">
                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center mr-3 text-white font-bold text-sm">2</div>
                  Servicios y Estructura Tributaria
                </h4>

              <div className="space-y-6">
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <label className="block text-[10px] font-black text-red-900 uppercase tracking-[0.2em] mb-2">Magnitud del Contribuyente</label>
                      <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-red-100 shadow-inner">
                        {(['PEQUEÑO', 'MEDIANO', 'GRANDE'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setNewTp({ ...newTp, magnitude: m })}
                            className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${newTp.magnitude === m
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-slate-400 hover:bg-slate-50'
                              }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 max-w-md">
                      <label className="block text-[10px] font-black text-red-900 uppercase tracking-[0.2em] mb-2">Buscador de Actividades</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          placeholder="Buscar código o actividad..."
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-red-100 rounded-xl text-sm focus:ring-2 focus:ring-red-500 transition-all text-black"
                          value={taxSearchTerm}
                          onChange={(e) => setTaxSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Activity Selector */}
                    <div className="lg:col-span-2">
                      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-red-100 text-red-900 font-black uppercase tracking-widest text-[9px]">
                              <tr>
                                <th className="p-3 pl-5">Código</th>
                                <th className="p-3">Actividad Económica</th>
                                <th className="p-3 pr-5 text-right">Añadir</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-red-50">
                              {taxStructure
                                .filter(item =>
                                  (item.code || '').toLowerCase().includes(taxSearchTerm.toLowerCase()) ||
                                  (item.activity || '').toLowerCase().includes(taxSearchTerm.toLowerCase())
                                )
                                .map((item) => {
                                  const isSelected = newTp.selectedTaxCodes?.includes(item.code);
                                  return (
                                    <tr key={item.code} className={`transition-colors ${isSelected ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}>
                                      <td className="p-3 pl-5 font-mono font-bold text-red-600">{item.code}</td>
                                      <td className="p-3 font-medium text-slate-700">
                                        <div className="font-bold">{item.activity}</div>
                                        {isSelected && (
                                          <div className="mt-2 animate-fade-in">
                                            {(() => {
                                              const magnitudeRates = newTp.magnitude === 'GRANDE' ? item.rates.GRANDE :
                                                                   newTp.magnitude === 'MEDIANO' ? item.rates.MEDIANO : item.rates.PEQUENO;
                                              
                                              if (Array.isArray(magnitudeRates)) {
                                                return (
                                                  <select 
                                                    className="w-full text-[10px] p-2 border border-red-200 rounded-lg bg-white text-black font-bold shadow-sm"
                                                    value={newTp.selectedRates?.[item.code] || magnitudeRates[0]}
                                                    onChange={(e) => {
                                                      const val = parseFloat(e.target.value);
                                                      setNewTp(prev => ({
                                                        ...prev,
                                                        selectedRates: {
                                                          ...(prev.selectedRates || {}),
                                                          [item.code]: val
                                                        }
                                                      }));
                                                    }}
                                                  >
                                                    {magnitudeRates.map((r: number, i: number) => (
                                                      <option key={i} value={r}>Tarifa {i + 1}: B/. {formatCurrency(r)}</option>
                                                    ))}
                                                  </select>
                                                );
                                              } else if (typeof magnitudeRates === 'number') {
                                                return <div className="text-[10px] font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full inline-block">B/. {formatCurrency(magnitudeRates)}</div>;
                                              } else {
                                                return <div className="text-[10px] font-bold text-slate-400 italic">{magnitudeRates}</div>;
                                              }
                                            })()}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-3 pr-5 text-right">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const current = newTp.selectedTaxCodes || [];
                                            const updated = isSelected
                                              ? current.filter(c => c !== item.code)
                                              : [...current, item.code];
                                            setNewTp({ ...newTp, selectedTaxCodes: updated });
                                          }}
                                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600'}`}
                                        >
                                          <CheckSquare size={16} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Summary & Manual Adjustments */}
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
                        <h5 className="text-[10px] font-black text-red-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Settings size={14} /> {newTp.type === TaxpayerType.PLACA ? 'Ajustes Anuales' : 'Ajustes Mensuales'}
                        </h5>
                        <div className="space-y-4">
                          {newTp.type === TaxpayerType.PLACA ? (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Costo de Placa Anual</label>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300 font-bold">B/.</span>
                                <input 
                                  type="number" inputMode="decimal"
                                  className="w-full p-2 border border-slate-100 rounded-lg text-right font-black text-slate-800 focus:border-red-500 outline-none transition-all bg-white"
                                  value={newTp.yearlyAmount || ''}
                                  onChange={(e) => setNewTp({ ...newTp, yearlyAmount: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00"
                                />
                              </div>
                              <p className="text-[9px] text-slate-400 mt-2 italic">Este monto se cobrará una vez al año según la fecha de inscripción.</p>
                            </div>
                          ) : (
                            <>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Impuesto Rótulo</label>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300 font-bold">B/.</span>
                                  <input 
                                    type="number" inputMode="decimal"
                                    className="w-full p-2 border border-slate-100 rounded-lg text-right font-black text-slate-800 focus:border-red-500 outline-none transition-all"
                                    value={newTp.rotuloAmount ?? ''}
                                    onChange={(e) => setNewTp({ ...newTp, rotuloAmount: parseFloat(e.target.value) || 0 })}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Servicio Basura</label>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300 font-bold">B/.</span>
                                  <input 
                                    type="number" inputMode="decimal"
                                    className="w-full p-2 border border-slate-100 rounded-lg text-right font-black text-slate-800 focus:border-red-500 outline-none transition-all"
                                    value={newTp.garbageAmount ?? ''}
                                    onChange={(e) => setNewTp({ ...newTp, garbageAmount: parseFloat(e.target.value) || 0 })}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {(isAdmin || isCaja1) && (
                          <div className="mt-6 pt-6 border-t border-red-100">
                            <label className="flex items-center gap-4 cursor-pointer group">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${newTp.hasConstruction ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-slate-300 border-2 border-slate-100 group-hover:border-red-200'}`}>
                                <CheckSquare size={18} />
                              </div>
                              <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={newTp.hasConstruction || false}
                                onChange={e => setNewTp({ ...newTp, hasConstruction: e.target.checked })}
                              />
                              <div>
                                <span className="block text-sm font-black text-red-900 uppercase tracking-widest">Activar Permiso de Construcción</span>
                                <p className="text-[9px] text-red-600/70 font-bold leading-relaxed">Habilita el seguimiento de obras y remodelaciones. <br/>Opción restringida a Caja Principal y Admin.</p>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border-t-4 border-red-600">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-white/10 rounded-lg text-red-500">
                            <Calculator size={20} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Resumen Mensual</span>
                        </div>
                        
                        <div className="space-y-3 mb-6 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar text-white">
                          {(newTp.selectedTaxCodes || []).map(code => {
                            const act = taxStructure.find(s => s.code === code);
                            const rates = newTp.magnitude === 'GRANDE' ? act?.rates.GRANDE :
                                         newTp.magnitude === 'MEDIANO' ? act?.rates.MEDIANO : act?.rates.PEQUENO;
                            const amount = Array.isArray(rates) ? (newTp.selectedRates?.[code] || rates[0]) : (typeof rates === 'number' ? rates : 0);
                            
                            return (
                              <div key={code} className="flex justify-between text-[11px] border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                  <span className="text-red-400 font-black text-[9px] uppercase tracking-tighter">{code}</span>
                                  <span className="text-white/60 truncate mr-2">{act?.activity}</span>
                                </div>
                                <span className="font-bold text-red-400 shrink-0 self-center">B/. {formatCurrency(amount)}</span>
                              </div>
                            );
                          })}
                          {newTp.rotuloAmount > 0 && (
                             <div className="flex justify-between text-[11px] border-b border-white/5 pb-2">
                               <span className="text-white/60 truncate">Impuesto Rótulo</span>
                               <span className="font-bold text-red-400 shrink-0">B/. {formatCurrency(newTp.rotuloAmount)}</span>
                             </div>
                          )}
                          {newTp.garbageAmount > 0 && (
                             <div className="flex justify-between text-[11px] border-b border-white/5 pb-2">
                               <span className="text-white/60 truncate">Servicio Basura</span>
                               <span className="font-bold text-red-400 shrink-0">B/. {formatCurrency(newTp.garbageAmount)}</span>
                             </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-white/10">
                          <div className="flex justify-between items-end">
                            <div>
                              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tasa Mensual</span>
                              <span className="text-2xl font-black text-white">
                                B/. {formatCurrency(
                                  (newTp.selectedTaxCodes || []).reduce((acc, code) => {
                                    const act = taxStructure.find(s => s.code === code);
                                    const rates = newTp.magnitude === 'GRANDE' ? act?.rates.GRANDE :
                                                 newTp.magnitude === 'MEDIANO' ? act?.rates.MEDIANO : act?.rates.PEQUENO;
                                    const amount = Array.isArray(rates) ? (newTp.selectedRates?.[code] || rates[0]) : (typeof rates === 'number' ? rates : 0);
                                    return acc + amount;
                                  }, 0) + (newTp.rotuloAmount || 0) + (newTp.garbageAmount || 0)
                                )}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[9px] font-bold text-red-500 uppercase tracking-widest mb-1">
                                Deuda Total ({calculateMonthsArrears(isEditing ? (newTp.paymentStartDate || newTp.businessStartDate) : newTp.businessStartDate)} meses)
                              </span>
                              <span className="text-3xl font-black text-red-500">B/. {formatCurrency(newTp.balance || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* SECTION 4: DOCUMENTS (New) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-200 pb-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3 text-slate-600 font-bold text-sm">3</div>
                Documentación y Adjuntos
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Standard Photo */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} className="text-indigo-500" /> Foto de Contribuyente
                  </label>
                  <input type="file" accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={e => handleFileChange('taxpayer_photo', e.target.files?.[0] || null)}
                  />
                  {newTp.documents?.['taxpayer_photo'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                </div>

                {/* Standard ID */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-indigo-500" /> Foto de Cédula
                  </label>
                  <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={e => handleFileChange('id_card', e.target.files?.[0] || null)}
                  />
                  {newTp.documents?.['id_card'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                </div>

                {/* Residential Map (Natural 1 & 2) - Hidden for Placa Station if not Admin */}
                {(isAdmin || !isPlacaStation) && (newTp.type === TaxpayerType.NATURAL_1 || newTp.type === TaxpayerType.NATURAL_2) && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <MapPin size={16} className="text-emerald-500" /> Croquis Dirección (Residencial)
                    </label>
                    <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      onChange={e => handleFileChange('residential_map', e.target.files?.[0] || null)}
                    />
                    {newTp.documents?.['residential_map'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                  </div>
                )}

                {/* Natural 2 / Commercial Specifics - Hidden for Placa Station */}
                {(isAdmin || !isPlacaStation) && newTp.type === TaxpayerType.NATURAL_2 && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-blue-500" /> Aviso de Operaciones
                      </label>
                      <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('operation_permit', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['operation_permit'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <ImageIcon size={16} className="text-blue-500" /> Foto Frontal Comercio
                      </label>
                      <input type="file" accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('shop_front_photo', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['shop_front_photo'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                  </>
                )}

                {/* Placa Specifics - Hidden for Normal Caja */}
                {(isAdmin || isPlacaStation) && newTp.type === TaxpayerType.PLACA && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Car size={16} className="text-amber-500" /> Registro Único Vehicular
                      </label>
                      <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('vehicle_registry', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['vehicle_registry'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <CheckSquare size={16} className="text-amber-500" /> Revisado Vehicular
                      </label>
                      <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('vehicle_inspection', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['vehicle_inspection'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <CreditCard size={16} className="text-amber-500" /> Tarjeta de Traspaso
                      </label>
                      <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('transfer_card', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['transfer_card'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                  </>
                )}

                {/* Jurídica Specifics */}
                {newTp.type === TaxpayerType.JURIDICA && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" /> Registro Público (S.A.)
                      </label>
                      <input type="file" accept=".pdf,image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('public_registry', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['public_registry'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <MapPin size={16} className="text-emerald-500" /> Croquis Dirección (Residencial)
                      </label>
                      <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('residential_map', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['residential_map'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <ImageIcon size={16} className="text-blue-500" /> Foto Frontal Comercio
                      </label>
                      <input type="file" accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('shop_front_photo', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['shop_front_photo'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" /> Aviso de Operaciones
                      </label>
                      <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('operation_permit', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['operation_permit'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-slate-100">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-3 mr-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  disabled={isUploading}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={isUploading}
                className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transform transition-all active:scale-95 flex items-center ${isEditing
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'}`}
              >
                {isUploading ? (
                  <>
                    <Upload className="animate-bounce mr-2" size={20} />
                    Subiendo Archivos...
                  </>
                ) : (
                  <>
                    {isEditing ? <CheckCircle className="mr-2" size={20} /> : <CheckSquare className="mr-2" size={20} />}
                    {isEditing ? 'Guardar Cambios' : 'Registrar Contribuyente'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* --- RECENT REGISTRY TABLE (NEW) --- */}
      {!isSearching && (
        <div className="max-w-6xl mx-auto mt-12 mb-20 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                <History size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Registro Municipal (A-Z)</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Listado completo de contribuyentes cargados</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">
                 {taxpayers.length} Registros Totales
               </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-8 py-5">Nombre / Razón Social</th>
                  <th className="px-6 py-5">Identificación</th>
                  <th className="px-6 py-5">Dirección</th>
                  <th className="px-6 py-5">Categoría</th>
                  <th className="px-8 py-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taxpayers.length > 0 ? (
                  taxpayers.slice(0, 100).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map((tp, idx) => (
                    <tr key={`tp-${tp.id}-${tp.taxpayerNumber || ''}-${idx}`} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{tp.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">{tp.taxpayerNumber}</div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold text-slate-600 font-mono">{tp.docId || 'S/D'}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                          <MapPin size={12} className="text-slate-300" />
                          <span className="truncate max-w-[200px]">{tp.address}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          tp.documents?.import_source ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {tp.documents?.import_source ? tp.documents.import_source.replace('.xlsx', '') : 'MANUAL'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => setViewTaxpayer(tp)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver Detalles">
                              <Search size={18} />
                           </button>
                           <button onClick={() => handleEditInit(tp)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                              <Edit size={18} />
                           </button>
                           <button 
                             onClick={() => {
                               setConfirmModal({
                                 show: true,
                                 title: '¿Eliminar Contribuyente?',
                                 message: `¿Desea eliminar a ${tp.name} de la lista?`,
                                 confirmText: 'Eliminar',
                                 cancelText: 'Cancelar',
                                 type: 'DANGER',
                                 onConfirm: () => {
                                   onDelete(tp.id!);
                                   setConfirmModal(prev => ({ ...prev, show: false }));
                                 }
                               });
                             }} 
                             className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                             title="Eliminar"
                           >
                              <Trash2 size={18} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-300">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border-4 border-slate-100">
                          <User size={40} className="opacity-20" />
                        </div>
                        <p className="font-black uppercase tracking-widest text-sm">No hay contribuyentes cargados</p>
                        <p className="text-xs font-bold">Inicia una carga desde Excel o utiliza el formulario superior</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {taxpayers.length > 100 && (
              <div className="p-6 bg-slate-50 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100">
                Mostrando los primeros 100 de {taxpayers.length} registros. Usa el buscador superior para ver otros.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ACTIVITY FILTER MODAL --- */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-[110] p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-white/20">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
                  <Briefcase size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Filtro por Actividad Comercial</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Seleccione una categoría para ver contribuyentes</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFilterModal(false)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar actividad o código..."
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold transition-all"
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-slate-50/30">
              <button
                onClick={() => {
                  setSelectedActivity('ALL');
                  setShowFilterModal(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                  selectedActivity === 'ALL' 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' 
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                <span className="font-black text-xs uppercase tracking-widest">Todas las Actividades</span>
                <span className="text-xs font-bold px-3 py-1 bg-white/20 rounded-full">{taxpayers.length}</span>
              </button>

              {/* Main Categories (User Requested) */}
              {activitySearch === '' && (
                <>
                  <div className="px-2 pt-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Principales Actividades (Almirante)
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {mainCategories.map(cat => {
                      const count = activityCounts[cat] || 0;
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedActivity(cat);
                            setShowFilterModal(false);
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border text-left ${
                            selectedActivity === cat 
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' 
                              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-black text-sm leading-tight uppercase">{cat}</span>
                          </div>
                          <span className={`text-xs font-black px-4 py-2 rounded-xl border ${
                            selectedActivity === cat
                              ? 'bg-white/20 border-white/30 text-white'
                              : count > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-300'
                          }`}>
                            {count} <span className="text-[8px] ml-1 opacity-60 uppercase">Contrib.</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-2 pt-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 mt-4">
                    Estructura Tributaria Detallada
                  </div>
                </>
              )}

              {filteredActivities.map((item: any) => {
                const count = activityCounts[item.code] || 0;
                // Only show codes that have at least one taxpayer, or if searching
                if (count === 0 && activitySearch === '') return null;

                return (
                  <button
                    key={item.code}
                    onClick={() => {
                      setSelectedActivity(item.code);
                      setShowFilterModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border text-left ${
                      selectedActivity === item.code 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' 
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{item.code}</span>
                      <span className="font-bold text-sm leading-tight">{item.activity}</span>
                    </div>
                    <span className={`text-xs font-black px-4 py-2 rounded-xl border ${
                      selectedActivity === item.code
                        ? 'bg-white/20 border-white/30 text-white'
                        : count > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-300'
                    }`}>
                      {count} <span className="text-[8px] ml-1 opacity-60 uppercase">Contrib.</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
