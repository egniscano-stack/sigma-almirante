import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Taxpayer, TaxConfig, TaxType, CommercialCategory, PaymentMethod, Transaction, User, MunicipalityInfo, AdminRequest, RequestType, RequestStatus } from '../types';
import { Car, Building2, Trash2, Store, CreditCard, Search, Banknote, Printer, CheckCircle, XCircle, X, ArrowLeft, Save, User as UserIcon, MapPin, Download, AlertCircle, Lock, History, RefreshCw, Bell, ShieldAlert, ChevronDown, ChevronUp, Receipt, Shield } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import taxStructure from '../data/taxStructure.json';
import { calculateTaxpayerDebt, DebtItem } from '../services/debtLogic';

interface TaxCollectionProps {
  taxpayers: Taxpayer[];
  transactions: Transaction[];
  config: TaxConfig;
  onPayment: (data: any) => Transaction;
  currentUser: User;
  municipalityInfo: MunicipalityInfo;
  initialTaxpayer?: Taxpayer | null; // Optional prop to pre-fill

  // New props for Requests
  adminRequests?: AdminRequest[];
  onCreateRequest?: (req: AdminRequest) => void;
  onArchiveRequest?: (id: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onDirectAdminAuth?: (password: string, req: AdminRequest) => Promise<boolean>;
}


// Helper to format currency with thousands separator (1,000.00)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

const isCaja1User = (name: string) => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    return lower === 'caja 1' || lower === 'caja1' || lower === 'danuris sanchez';
};

const resolveTellerName = (name: string) => {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    if (lower === 'caja 1' || lower === 'caja1') {
        return 'Danuris Sanchez';
    }
    return name;
};

const fineLabels: Record<string, string> = {
    '01_IMPUESTOS_MOROSOS': '01 - Impuestos Morosos',
    '02_ADMINISTRATIVAS': '02 - Administrativas',
    '03_LEGAL': '03 - Legal',
    '04_JUZGADO_DE_PAZ': '04 - Multas impuestas por Juzgado de Paz',
    '05_MULTAS_INGENIERIA': '05 - Multas de Ingeniería',
    '06_MAL_ESTACIONADO': '06 - Multas por mal Estacionados o estacionados en Aceras',
    '07_RUIDO': '07 - Multas por ruido',
    '08_PLACAS_VENCIDAS': '08 - Multas por Placas vencidas',
    '09_RECARGOS_MOROSOS': '09 - Recargos sobre Impuestos Morosos'
};

const chargeLabels: Record<string, string> = {
    PERMISO_CONSTRUCCION: 'Permiso de Construcción',
    PERMISO_OCUPACION: 'Permiso de Ocupación',
    CERTIFICACION_OCUPACION: 'Certificación de Ocupación',
    EXTRACCION_BALASTRE: 'Extracción de Balastre',
    ABONO_LOTE: 'Abono a Lote No.',
    CERTIFICACION_RESIDENCIA: 'Certificación de Residencia',
    APROBACION_PLANOS: 'Aprobación de Planos',
    APROBACION_ANTEPROYECTO: 'Aprobación de Anteproyecto',
    MULTA: 'Multa',
    OTROS: 'Otros Impuestos'
};

const getChargeTitle = (selectedReqId: string | null | undefined, adminRequests: AdminRequest[]) => {
    if (!selectedReqId) return 'Impuesto de Construcción';
    const req = adminRequests.find(r => r.id === selectedReqId);
    if (!req) return 'Impuesto de Construcción';
    const payload = req.payload || {};
    const engType = payload.engineeringType;
    if (engType === 'MULTA' && payload.fineType) {
        return `Multa: ${fineLabels[payload.fineType] || payload.fineType}`;
    }
    return chargeLabels[engType] || 'Cobro de Ingeniería';
};

const getChargeSubtitle = (selectedReqId: string | null | undefined, adminRequests: AdminRequest[]) => {
    if (!selectedReqId) return 'Pago Único por Permiso de Obra';
    const req = adminRequests.find(r => r.id === selectedReqId);
    if (!req) return 'Pago Único por Permiso de Obra';
    const payload = req.payload || {};
    const engType = payload.engineeringType;
    if (engType === 'MULTA') return 'Recaudación de Multa Municipal';
    return 'Ingreso por Tasa / Permiso Municipal';
};

const renderRateInfo = (rate: any): string => {
  if (Array.isArray(rate)) {
    return rate.map(r => `B/. ${formatCurrency(r)}`).join(', ');
  } else if (typeof rate === 'number') {
    return rate > 0 ? `B/. ${formatCurrency(rate)}` : 'N/A';
  } else if (typeof rate === 'string') {
    return rate;
  }
  return 'N/A';
};


export const TaxCollection: React.FC<TaxCollectionProps> = ({ taxpayers, transactions, config, onPayment, currentUser, municipalityInfo, initialTaxpayer, adminRequests = [], onCreateRequest, onArchiveRequest, onRefresh, onDirectAdminAuth, isLoading }) => {
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const activeTaxpayer = taxpayers.find(t => t.id === selectedTaxpayerId);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);

  // Specific Form States
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showPazSalvo, setShowPazSalvo] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingTransactions, setClosingTransactions] = useState<Transaction[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Preview Modal States
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [draftPaymentData, setDraftPaymentData] = useState<any>(null);

  const updateDraftField = (field: string, value: any) => {
    setDraftPaymentData((prev: any) => ({ ...prev, [field]: value }));
  };

  const triggerPaymentPreview = (paymentData: any) => {
    setDraftPaymentData(paymentData);
    setShowPreviewModal(true);
  };

  const getPaymentMethodLabel = (method: string) => {
    if (!method) return 'Efectivo';
    const m = method.toUpperCase();
    if (m === 'EFECTIVO') return 'Efectivo';
    if (m.includes('TARJETA')) return 'Tarjeta';
    if (m.includes('ONLINE') || m.includes('YAPPY') || m.includes('TRANSFERENCIA') || m.includes('ACH')) return 'Online';
    return 'Efectivo';
  };

  // Request Management State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newRequestType, setNewRequestType] = useState<RequestType>('VOID_TRANSACTION');
  const [newRequestDesc, setNewRequestDesc] = useState('');
  const [newRequestAmount, setNewRequestAmount] = useState(0); // For Arrangement Debt
  const [requestTargetId, setRequestTargetId] = useState(''); // Transaction ID for void

  // Logic to load Approved Arrangement
  const [loadedArrangement, setLoadedArrangement] = useState<AdminRequest | null>(null);

  // Offline Admin Auth
  const [offlineAdminPassword, setOfflineAdminPassword] = useState('');

  // History Filter for Cashier
  const [historyFilterDate, setHistoryFilterDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
  const [showRequestsDropdown, setShowRequestsDropdown] = useState(false);

  // Centralized notifications now handled in App.tsx to avoid Admin/Cashier confusion
  const prevRequestsRef = useRef<AdminRequest[]>([]);

  // --- DIRECT CHARGE FORM STATES ---
  const [showDirectChargeModal, setShowDirectChargeModal] = useState(false);
  const [isManualPayer, setIsManualPayer] = useState(false);
  const [directSelectedTaxpayerId, setDirectSelectedTaxpayerId] = useState('');
  const [directManualName, setDirectManualName] = useState('');
  const [directManualDocId, setDirectManualDocId] = useState('');
  const [directManualAddress, setDirectManualAddress] = useState('');
  const [directManualPhone, setDirectManualPhone] = useState('');
  const [directChargeType, setDirectChargeType] = useState<'COMERCIO' | 'EVENTO'>('COMERCIO');
  const [directEventDays, setDirectEventDays] = useState<number | ''>('');
  const [directTaxCode, setDirectTaxCode] = useState('');
  const [directTaxActivityName, setDirectTaxActivityName] = useState('');
  const [directAmount, setDirectAmount] = useState('');
  const [directPaymentMethod, setDirectPaymentMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);
  
  // Autocomplete taxpayer search in modal
  const [directSearchTerm, setDirectSearchTerm] = useState('');
  const [directShowDropdown, setDirectShowDropdown] = useState(false);
  
  // Autocomplete code search in modal
  const [directCodeSearchTerm, setDirectCodeSearchTerm] = useState('');
  const [directCodeShowDropdown, setDirectCodeShowDropdown] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const directSearchContainerRef = useRef<HTMLDivElement>(null);
  const directCodeContainerRef = useRef<HTMLDivElement>(null);

  const directFilteredTaxpayers = useMemo(() => {
    if (!directSearchTerm) return [];
    return taxpayers.filter(t =>
      t.name.toLowerCase().includes(directSearchTerm.toLowerCase()) ||
      t.docId.includes(directSearchTerm) ||
      t.taxpayerNumber?.includes(directSearchTerm)
    );
  }, [directSearchTerm, taxpayers]);

  const directFilteredTaxCodes = useMemo(() => {
    if (!directCodeSearchTerm) return [];
    return (taxStructure as any[]).filter(item => 
      item.code.toLowerCase().includes(directCodeSearchTerm.toLowerCase()) ||
      item.activity.toLowerCase().includes(directCodeSearchTerm.toLowerCase())
    ).slice(0, 10);
  }, [directCodeSearchTerm]);

  const directSelectedTaxpayer = taxpayers.find(t => t.id === directSelectedTaxpayerId);

  const handleProcessDirectCharge = async () => {
    // Validations
    let payerName = '';
    let payerDocId = '';
    let payerAddress = '';
    let payerPhone = '';

    if (isManualPayer) {
      if (!directManualName.trim()) {
        alert("Por favor, ingrese el nombre del pagador.");
        return;
      }
      if (!directManualDocId.trim()) {
        alert("Por favor, ingrese la cédula o RUC del pagador.");
        return;
      }
      payerName = directManualName.trim();
      payerDocId = directManualDocId.trim();
      payerAddress = directManualAddress.trim() || 'N/A';
      payerPhone = directManualPhone.trim() || 'N/A';
    } else {
      if (!directSelectedTaxpayerId) {
        alert("Por favor, seleccione un contribuyente.");
        return;
      }
      if (!directSelectedTaxpayer) {
        alert("Contribuyente seleccionado inválido.");
        return;
      }
      payerName = directSelectedTaxpayer.name;
      payerDocId = directSelectedTaxpayer.docId;
      payerAddress = directSelectedTaxpayer.address || 'N/A';
      payerPhone = directSelectedTaxpayer.phone || 'N/A';
    }

    if (!directTaxCode.trim()) {
      alert("Por favor, ingrese o seleccione un código tributario.");
      return;
    }

    const amountNum = parseFloat(directAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Por favor, ingrese un monto a cobrar válido mayor a 0.");
      return;
    }

    // Build description based on charge type
    let chargeTypeLabel = '';
    if (directChargeType === 'COMERCIO') {
      chargeTypeLabel = 'ACTIVIDAD COMERCIAL';
    } else {
      const daysNum = parseInt(String(directEventDays));
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        alert("Por favor, ingrese la duración del evento en días (1 a 90).");
        return;
      }
      chargeTypeLabel = `EVENTO ESPECIAL (${daysNum} DÍA${daysNum > 1 ? 'S' : ''}${daysNum === 90 ? ' - RENOVABLE' : ''})`;
    }

    const description = `COBRO DIRECTO - ${chargeTypeLabel} (CÓD: ${directTaxCode.trim()}${directTaxActivityName ? ` - ${directTaxActivityName}` : ''})`;

    triggerPaymentPreview({
      taxType: TaxType.COMERCIO,
      taxpayerId: isManualPayer ? undefined : directSelectedTaxpayerId,
      amount: amountNum,
      paymentMethod: directPaymentMethod,
      description: description,
      metadata: {
        isDirectCharge: true,
        chargeType: directChargeType,
        eventDays: directChargeType === 'EVENTO' ? parseInt(String(directEventDays)) : undefined,
        taxCode: directTaxCode.trim(),
        taxActivity: directTaxActivityName,
        manualPayer: isManualPayer ? payerName : undefined,
        manualPayerDoc: isManualPayer ? payerDocId : undefined,
        manualPayerAddress: isManualPayer ? payerAddress : undefined,
        manualPayerPhone: isManualPayer ? payerPhone : undefined,
        registeredPayer: !isManualPayer ? {
          id: directSelectedTaxpayer.id,
          name: directSelectedTaxpayer.name,
          docId: directSelectedTaxpayer.docId,
          address: directSelectedTaxpayer.address,
          phone: directSelectedTaxpayer.phone
        } : undefined
      }
    });

    setShowDirectChargeModal(false);

    // Reset Form
    setIsManualPayer(false);
    setDirectSelectedTaxpayerId('');
    setDirectManualName('');
    setDirectManualDocId('');
    setDirectManualAddress('');
    setDirectManualPhone('');
    setDirectChargeType('COMERCIO');
    setDirectEventDays(1);
    setDirectTaxCode('');
    setDirectTaxActivityName('');
    setDirectAmount('');
    setDirectSearchTerm('');
    setDirectCodeSearchTerm('');
  };

  // Pre-fill from props if available
  useEffect(() => {
    if (initialTaxpayer) {
      setSelectedTaxpayerId(initialTaxpayer.id);
    }
  }, [initialTaxpayer]);

  // --- DEBT CALCULATION LOGIC (Consolidated View) ---
  const taxpayerDebts = useMemo(() => {
    if (!activeTaxpayer) return [];
    const { items } = calculateTaxpayerDebt(activeTaxpayer, transactions, config);
    return items;
  }, [activeTaxpayer, transactions, config]);

  const handlePayDebtItem = (debt: any) => {
    triggerPaymentPreview({
      taxType: (debt.type === 'DEUDA_HISTORICA' || debt.type === 'DEUDA_ARRAS') ? TaxType.COMERCIO : debt.type, // Fallback tax type
      taxpayerId: selectedTaxpayerId,
      amount: debt.amount,
      paymentMethod: paymentMethod,
      description: debt.description,
      metadata: debt.metadata
    });
  };

  const handlePayAllDebts = () => {
    if (!activeTaxpayer || taxpayerDebts.length === 0) return;

    const totalAmount = taxpayerDebts.reduce((acc, d) => acc + (d.amount || 0), 0);
    const summaryDesc = `Pago Total de Deudas Pendientes (${taxpayerDebts.length} conceptos)`;

    triggerPaymentPreview({
      taxType: TaxType.COMERCIO, // Use a general type for consolidated
      taxpayerId: selectedTaxpayerId,
      amount: totalAmount,
      paymentMethod: paymentMethod,
      description: summaryDesc,
      metadata: { 
        isConsolidated: true, 
        itemsCount: taxpayerDebts.length,
        originalItems: taxpayerDebts.map(d => ({ label: d.label, amount: d.amount }))
      }
    });
  };

  const filteredTaxpayers = searchTerm.length > 0
    ? taxpayers.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.docId.includes(searchTerm) ||
      t.taxpayerNumber?.includes(searchTerm)
    )
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (directSearchContainerRef.current && !directSearchContainerRef.current.contains(event.target as Node)) {
        setDirectShowDropdown(false);
      }
      if (directCodeContainerRef.current && !directCodeContainerRef.current.contains(event.target as Node)) {
        setDirectCodeShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTaxpayer = (tp: Taxpayer) => {
    setSelectedTaxpayerId(tp.id);
    setSearchTerm(''); // Clear search to hide dropdown
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedTaxpayerId('');
    setSearchTerm('');
  };

  const handleFinishCollection = () => {
    setShowInvoice(false);

    // Check if it was a Paz y Salvo transaction
    if (lastTransaction?.metadata?.isPazSalvo) {
      setShowPazSalvo(true);
      // Don't clear taxpayer yet as we need it for the certificate
    } else {
      // Normal Reset
      setSearchTerm('');
      setSelectedTaxpayerId('');
      setPaymentMethod(PaymentMethod.EFECTIVO);
    }
  };

  const printInvoice = () => {
    window.print();
  };

  const downloadPDF = async () => {
    const element = document.getElementById('invoice-modal-content');
    if (!element) return;

    setIsGeneratingPdf(true);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        ignoreElements: (el) => el.classList.contains('no-print'),
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Scale to fit nicely with margins if needed, but centering usually works
      let finalHeight = imgHeight;
      let finalWidth = pdfWidth;

      // Ensure it fits vertically as well
      if (imgHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = (imgProps.width * pdfHeight) / imgProps.height;
      }

      // Add small margin (e.g. 10mm) logic if you want, 
      // but fitting to width in Landscape usually minimizes nicely
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save(`Recibo_${lastTransaction?.id}.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error al generar el PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDailyClosing = () => {
    try {
      console.log("Iniciando Cierre del Día...", { today: new Date().toLocaleDateString('en-CA'), user: currentUser.name });
      const today = new Date().toLocaleDateString('en-CA');
      const myTxs = transactions.filter(t => 
        t.date === today && 
        t.tellerName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );

      if (myTxs.length === 0) {
        alert("No hay transacciones registradas hoy para su usuario (" + currentUser.name + ").");
        return;
      }

      setClosingTransactions(myTxs);
      setShowClosingModal(true);
    } catch (err) {
      console.error("Error preparing daily closing:", err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">

      {/* --- PREVIEW INVOICE MODAL (VISTA PREVIA ANTES DE CONFIRMAR) --- */}
      {showPreviewModal && draftPaymentData && (
        (() => {
          const payerName = draftPaymentData.metadata?.manualPayer 
            || draftPaymentData.metadata?.registeredPayer?.name 
            || taxpayers.find(tp => tp.id === draftPaymentData.taxpayerId)?.name 
            || activeTaxpayer?.name 
            || 'Pagador Eventual';

          const payerDocId = draftPaymentData.metadata?.manualPayerDoc 
            || draftPaymentData.metadata?.registeredPayer?.docId 
            || taxpayers.find(tp => tp.id === draftPaymentData.taxpayerId)?.docId 
            || activeTaxpayer?.docId 
            || 'N/A';

          return (
            <div className="fixed inset-0 bg-slate-955/80 flex items-center justify-center z-[110] p-4 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white shadow-2xl w-full max-w-[340px] rounded-2xl overflow-hidden flex flex-col relative border border-slate-200 my-8 animate-scale-up">
                
                {/* Draft Badge Banner */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-center py-2.5 px-4 font-black uppercase text-[10px] tracking-widest shadow-sm flex items-center justify-center gap-1.5">
                  <ShieldAlert size={14} className="animate-pulse" />
                  <span>Vista Previa: Borrador</span>
                </div>

                <div className="p-4 text-center">
                  <p className="text-[10px] text-amber-600 font-extrabold uppercase bg-amber-50 rounded-lg py-1.5 px-3 border border-amber-100 mb-4 tracking-wider leading-relaxed">
                    Revise la información y corrija cualquier error antes de confirmar el cobro oficial.
                  </p>

                  {/* Centered Logo */}
                  <div className="flex justify-center mb-1.5">
                    <img
                      src={`${import.meta.env.BASE_URL}logo-municipio.png`}
                      alt="Escudo Municipal"
                      className="h-16 object-contain grayscale opacity-60"
                    />
                  </div>

                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider text-center">Municipio de Almirante</h3>
                  <p className="text-[8px] text-slate-400 font-bold uppercase border-b border-dashed border-slate-200 pb-2 mb-3 text-center">Tesorería Municipal</p>

                  {/* Taxpayer Card */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-left mb-4 space-y-1">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Contribuyente:</p>
                    <p className="font-extrabold text-[11px] text-slate-900 leading-tight uppercase">{payerName}</p>
                    <p className="text-[9px] font-mono font-bold text-slate-600">CÉDULA/RUC: {payerDocId}</p>
                    {(() => {
                      const resolvedTp = taxpayers.find(tp => tp.id === draftPaymentData.taxpayerId)
                        || (draftPaymentData.metadata?.registeredPayer ? taxpayers.find(tp => tp.id === draftPaymentData.metadata.registeredPayer.id) : null)
                        || activeTaxpayer;
                      return resolvedTp?.taxpayerNumber ? (
                        <p className="text-[9px] font-mono font-bold text-indigo-600">Nº CONTRIBUYENTE: {resolvedTp.taxpayerNumber}</p>
                      ) : null;
                    })()}

                    {/* Direct Charge Details in Preview */}
                    {draftPaymentData.metadata?.isDirectCharge && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[8px] text-slate-600 space-y-0.5 font-mono">
                        <p className="font-bold text-[8px] text-emerald-700 uppercase tracking-wider">Detalles de Cobro Directo:</p>
                        <p><span className="font-bold">Tipo:</span> {
                          draftPaymentData.metadata.chargeType === 'COMERCIO' ? 'ACTIVIDAD COMERCIAL' :
                          draftPaymentData.metadata.chargeType === 'EVENTO' ? `EVENTO ESPECIAL (${draftPaymentData.metadata.eventDays || 1} DÍA${(draftPaymentData.metadata.eventDays || 1) > 1 ? 'S' : ''}${draftPaymentData.metadata.eventDays === 90 ? ' - RENOVABLE' : ''})` : 'OTRO'
                        }</p>
                        <p><span className="font-bold">Código:</span> {draftPaymentData.metadata.taxCode}</p>
                        {draftPaymentData.metadata.taxActivity && <p><span className="font-bold">Actividad:</span> {draftPaymentData.metadata.taxActivity}</p>}
                      </div>
                    )}

                    {/* Detalles de Códigos Tributarios para Contribuyentes Registrados (Preview) */}
                    {(() => {
                      const resolvedTp = taxpayers.find(tp => tp.id === draftPaymentData.taxpayerId)
                        || (draftPaymentData.metadata?.registeredPayer ? taxpayers.find(tp => tp.id === draftPaymentData.metadata.registeredPayer.id) : null)
                        || activeTaxpayer;
                      if (!draftPaymentData.metadata?.isDirectCharge && draftPaymentData.taxType === 'COMERCIO' && resolvedTp && resolvedTp.selectedTaxCodes && resolvedTp.selectedTaxCodes.length > 0) {
                        return (
                          <div className="mt-2 pt-2 border-t border-slate-200 text-[8px] text-slate-600 space-y-0.5 font-mono">
                            <p className="font-bold text-[8px] text-indigo-700 uppercase tracking-wider">Actividades / Códigos Comerciales:</p>
                            {resolvedTp.selectedTaxCodes.map((code: any, idx: number) => {
                              const struct = (taxStructure as any[]).find(s => s.code === code);
                              const rate = resolvedTp.selectedRates?.[code] || 0;
                              return (
                                <div key={idx} className="bg-white p-1 rounded border border-slate-100 mt-1">
                                  <p className="font-bold text-slate-900 leading-snug">{code} — {struct?.activity || 'Actividad Comercial'}</p>
                                  <p className="text-[7px]">Tarifa Mensual: B/. {formatCurrency(rate)}</p>
                                </div>
                              );
                            })}
                            {(resolvedTp.rotuloAmount || 0) > 0 && (
                              <p className="text-slate-600"><span className="font-bold">Impuesto Rótulo:</span> B/. {formatCurrency(resolvedTp.rotuloAmount)}</p>
                            )}
                            {(resolvedTp.garbageAmount || 0) > 0 && (
                              <p className="text-slate-600"><span className="font-bold">Tasa Aseo:</span> B/. {formatCurrency(resolvedTp.garbageAmount)}</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* EDITABLE FIELDS */}
                  <div className="text-left space-y-3.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100 mb-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider -mb-1">Datos Editables del Cobro:</p>
                    
                    {/* 1. Payment Method Dropdown */}
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Método de Pago</label>
                      <div className="relative">
                        <select
                          value={draftPaymentData.paymentMethod}
                          onChange={(e) => updateDraftField('paymentMethod', e.target.value)}
                          className="w-full bg-white text-xs font-bold text-slate-800 p-2.5 rounded-lg border-2 border-slate-200 focus:border-orange-500 outline-none transition-colors"
                        >
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="TARJETA">Tarjeta</option>
                          <option value="ONLINE">Online (Yappy/ACH)</option>
                        </select>
                      </div>
                    </div>

                    {/* 2. Editable Description */}
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Concepto / Descripción</label>
                      <textarea
                        rows={2}
                        value={draftPaymentData.description}
                        onChange={(e) => updateDraftField('description', e.target.value.toUpperCase())}
                        className="w-full bg-white text-xs font-bold text-slate-800 p-2.5 rounded-lg border-2 border-slate-200 focus:border-orange-500 outline-none transition-colors leading-tight resize-none"
                      />
                    </div>

                    {/* 3. Editable Amount */}
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Monto del Cobro (B/.)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        value={draftPaymentData.amount || ''}
                        onChange={(e) => updateDraftField('amount', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white text-sm font-black text-orange-600 p-2.5 rounded-lg border-2 border-slate-200 focus:border-orange-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex justify-between items-center mb-5">
                    <span className="text-[10px] font-black text-orange-800 uppercase">Monto Final a Cobrar:</span>
                    <span className="text-base font-black text-orange-700">B/. {formatCurrency(draftPaymentData.amount)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const tx = await onPayment(draftPaymentData);
                          setLastTransaction(tx);
                          setShowPreviewModal(false);
                          setShowInvoice(true);
                        } catch (e) {
                          alert("Error al procesar el pago.");
                        }
                      }}
                      disabled={draftPaymentData.amount <= 0}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle size={15} /> Confirmar y Procesar Cobro
                    </button>
                    <button
                      onClick={() => setShowPreviewModal(false)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-95"
                    >
                      Cancelar / Regresar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* --- PAZ Y SALVO MODAL --- */}
      {showPazSalvo && activeTaxpayer && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto pt-10 no-print">
          <style>
            {`
              @media print {
                @page { size: letter portrait; margin: 0; }
                body { visibility: hidden; background: white !important; }
                #paz-salvo-certificate, #paz-salvo-certificate * { visibility: visible !important; }
                #paz-salvo-certificate { 
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 215.9mm !important;
                    height: 279.4mm !important;
                    margin: 0 !important;
                    padding: 15mm !important;
                    box-shadow: none !important;
                    border: none !important;
                    background: white !important;
                    display: flex !important;
                    flex-direction: column !important;
                }
                .no-print { display: none !important; visibility: hidden !important; }
              }
            `}
          </style>
          
          <div className="flex flex-col items-center gap-6 max-w-[215.9mm] w-full">
            {/* Document Container */}
            <div id="paz-salvo-certificate" className="bg-white w-[215.9mm] h-[279.4mm] p-8 shadow-2xl relative text-slate-900 font-serif mx-auto origin-top flex flex-col justify-between shrink-0 no-print:rounded-lg">
                {/* Watermark - Municipal Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none overflow-hidden">
                  <img src={`${import.meta.env.BASE_URL}logo-municipio.png`} alt="Watermark" className="w-[120%] object-contain" />
                </div>
                
                {/* Certificate Header - Centered Style */}
                <div className="w-full flex flex-col items-center border-b-2 border-emerald-800 pb-4 mb-4 relative z-20">
                  <img 
                    src={`${import.meta.env.BASE_URL}logo-municipio.png?v=${Date.now()}`} 
                    alt="Logo Municipio Almirante" 
                    className="h-40 w-auto mb-2 relative z-30" 
                    style={{ 
                      display: 'block',
                      imageRendering: 'auto'
                    }}
                  />
                  <div className="text-center">
                    <h1 className="text-xl font-bold uppercase tracking-[0.2em] text-slate-900 leading-none mb-1">República de Panamá</h1>
                    <h2 className="text-lg font-bold text-emerald-800 uppercase tracking-widest leading-tight">Municipio de Almirante</h2>
                    <p className="text-[11px] font-bold text-slate-600 mt-2 uppercase tracking-[0.05em] flex items-center justify-center gap-2">
                      <span style={{ fontVariantNumeric: 'lining-nums' }}>RUC: 1-22-333 DV 44</span>
                      <span className="text-emerald-800 text-lg leading-none">•</span>
                      <span>Tesorería Municipal</span>
                    </p>
                  </div>
                </div>

                <div className="relative z-10 flex-1 flex flex-col items-center">
                  <h2 className="text-3xl font-black uppercase mb-8 tracking-[0.3em] text-slate-900 border-b-4 border-emerald-500 pb-2">Paz y Salvo</h2>
                  
                  <div className="w-full text-justify leading-relaxed px-8 space-y-4 text-base">
                    <p className="font-bold text-lg">A QUIEN CONCIERNA:</p>
                    
                    <p className="indent-12">
                      La Tesorería Municipal de Almirante, en uso de sus facultades legales, hace constar que el contribuyente:
                    </p>

                    <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl shadow-inner my-4">
                      <div className="grid grid-cols-2 gap-8 text-center">
                        <div className="text-left border-r border-slate-300 pr-4">
                          <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-wider">Nombre / Razón Social</p>
                          <p className="text-xl font-black text-slate-900 leading-tight uppercase">{activeTaxpayer.name}</p>
                        </div>
                        <div className="text-right pl-4">
                          <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-wider">Cédula / RUC</p>
                          <p className="text-xl font-mono font-black text-slate-900 leading-tight">{activeTaxpayer.docId}</p>
                        </div>
                      </div>
                      <div className="border-t-2 border-slate-200 mt-2 pt-2 flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-bold tracking-widest uppercase">Registro Nº {activeTaxpayer.taxpayerNumber}</span>
                        <div className={`flex items-center gap-3 px-4 py-1 rounded-full border ${activeTaxpayer.status === 'ACTIVO' ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200'}`}>
                          <div className={`h-2 w-2 rounded-full ${activeTaxpayer.status === 'ACTIVO' ? 'bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                          <span className={`text-xs font-black uppercase tracking-widest ${activeTaxpayer.status === 'ACTIVO' ? 'text-emerald-800' : 'text-red-800'}`}>Estado: {activeTaxpayer.status}</span>
                        </div>
                      </div>
                    </div>

                    <p className="indent-12">
                      Se encuentra legalmente <strong>PAZ Y SALVO</strong> con el Tesoro Municipal de Almirante por concepto de Impuestos, Tasas, Derechos y Contribuciones Municipales, según los registros que reposan en esta institución hasta la fecha de emisión del presente documento.
                    </p>

                    <p className="text-sm text-right mt-12 italic text-slate-500">
                      Válido por 30 días calendario a partir de su emisión.<br />
                      Dado en el distrito de Almirante, el {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
                    </p>
                  </div>
                </div>

                {/* Footer / Signatures / QR */}
                <div className="w-full mt-8 pt-8 border-t-2 border-slate-200 relative z-10 flex justify-between items-center px-8">
                  <div className="text-center w-32">
                    <div className="mb-2 mx-auto flex items-center justify-center">
                      <QRCodeSVG 
                        value={`https://almirante.gob.pa/valida/${activeTaxpayer.id}`} 
                        size={120} 
                        level="H" 
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-[8px] font-bold text-slate-600 tracking-widest uppercase leading-tight">Documento Validado Digitalmente<br />{`SIGMA-${activeTaxpayer.taxpayerNumber}`}</p>
                  </div>

                  <div className="text-center flex-1 px-8">
                    {/* Empty spacer or room for future text */}
                  </div>

                  <div className="text-center w-64">
                    <div className="relative mb-1 h-16 flex items-center justify-center">
                      <img 
                        src={`${import.meta.env.BASE_URL}logo-municipio.png`} 
                        className="absolute h-14 opacity-10 grayscale" 
                        alt="Sello"
                      />
                      <span className="font-script text-3xl text-blue-900 opacity-60 rotate-[-12deg] relative z-10 select-none">Tesorero Municipal</span>
                    </div>
                    <div className="border-t-2 border-slate-900 w-full mb-1"></div>
                    <p className="font-black text-xs uppercase tracking-widest text-slate-900">Tesorero Municipal</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Autoridad Competente</p>
                  </div>
                </div>

                <div className="absolute inset-0 border-[1mm] border-slate-100 pointer-events-none"></div>
            </div>

            {/* Action Buttons - Attached to document */}
            <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-row gap-4 no-print w-full shadow-2xl mb-12">
              <button
                onClick={async () => {
                  const element = document.getElementById('paz-salvo-certificate');
                  if (!element) return;
                  setIsGeneratingPdf(true);
                  try {
                    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'letter');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
                    pdf.save(`Paz_y_Salvo_${activeTaxpayer.docId}.pdf`);
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }}
                disabled={isGeneratingPdf}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                <Download size={18} /> <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}</span>
              </button>
              <button 
                onClick={async () => {
                  const element = document.getElementById('paz-salvo-certificate');
                  if (!element) return;
                  setIsGeneratingPdf(true);
                  try {
                    const canvas = await html2canvas(element, { 
                      scale: 3, 
                      useCORS: true, 
                      backgroundColor: '#ffffff'
                    });
                    const dataUrl = canvas.toDataURL('image/png');
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Imprimir Paz y Salvo</title>
                            <style>
                              @page { size: letter portrait; margin: 0; }
                              body { margin: 0; display: flex; justify-content: center; background: white; }
                              img { width: 215.9mm; height: 279.4mm; object-fit: contain; }
                            </style>
                          </head>
                          <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
                            <img src="${dataUrl}" />
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }} 
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                <Printer size={18} /> <span>{isGeneratingPdf ? '...' : 'Imprimir'}</span>
              </button>
              <button 
                onClick={() => setShowPazSalvo(false)} 
                className="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                <X size={18} /> <span>Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CIERRE DE CAJA PREVIEW MODAL --- */}
      {showClosingModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto pt-10 no-print">
          <div className="flex flex-col items-center gap-6 max-w-[215.9mm] w-full">
            {/* Report Content */}
            <div id="closing-report-content" className="bg-white w-full min-h-[279.4mm] shadow-2xl p-12 flex flex-col font-sans relative">
              <div className="flex justify-between items-center border-b-2 border-slate-900 pb-6 mb-8 gap-4">
                {/* Left: Info */}
                <div className="w-1/3 text-left">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">Información de Cierre</p>
                  <p className="text-xs text-slate-800 font-bold">FECHA: {new Date().toLocaleDateString('es-ES')}</p>
                  <p className="text-xs text-slate-800 font-bold uppercase">CAJERO: {resolveTellerName(currentUser?.name)}</p>
                </div>

                {/* Center: Logo & Titles */}
                <div className="w-1/3 flex flex-col items-center text-center">
                  <img src={`${import.meta.env.BASE_URL}logo-municipio.png`} alt="Logo" className="h-40 w-auto mb-2" />
                  <h1 className="text-lg font-black uppercase text-slate-900">Cierre de Caja</h1>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Tesorería Municipal de Almirante</p>
                </div>

                {/* Right: Total Box */}
                <div className="w-1/3 flex justify-end">
                  <div className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg text-right min-w-[180px]">
                    <p className="text-[9px] uppercase font-bold opacity-70 mb-1">Total Recaudado Hoy</p>
                    <p className="text-2xl font-black">B/. {formatCurrency(closingTransactions.reduce((acc, t) => acc + t.amount, 0))}</p>
                  </div>
                </div>
              </div>

              <table className="w-full text-left mb-12">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-500">Hora</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-500">Contribuyente</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-500">Concepto</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-500 text-center">Estado</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-500 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {closingTransactions.map(t => (
                    <tr key={t.id} className="text-xs border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-4 px-4 text-slate-600">{t.time}</td>
                      <td className="py-4 px-4 font-bold text-slate-800 uppercase">
                        {taxpayers.find(tp => tp.id === t.taxpayerId)?.name || t.metadata?.manualPayer || 'S/N'}
                      </td>
                      <td className="py-4 px-4 text-slate-500">
                        <div className="flex flex-col">
                          <span className="text-slate-700 font-bold uppercase">{t.description || t.taxType}</span>
                          {t.metadata?.isConsolidated && t.metadata?.originalItems && (
                            <div className="mt-1 mb-1 border-l-2 border-indigo-100 pl-3 py-1 space-y-1 bg-slate-50/50 rounded-r-lg">
                              {t.metadata.originalItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-[10px] text-slate-500">
                                  <span className="uppercase">{item.label}</span>
                                  <span className="font-bold text-slate-600">B/. {formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {t.metadata?.isDirectCharge && (
                            <div className="mt-1 mb-1 border-l-2 border-emerald-200 pl-3 py-1 space-y-0.5 bg-slate-50/50 rounded-r-lg text-[9px] font-mono text-slate-600">
                              <p className="font-bold text-[8px] text-emerald-700 uppercase tracking-wider">Detalles de Cobro Directo:</p>
                              <p><span className="font-bold">Tipo:</span> {
                                t.metadata.chargeType === 'COMERCIO' ? 'ACTIVIDAD COMERCIAL' :
                                t.metadata.chargeType === 'EVENTO' ? `EVENTO ESPECIAL (${t.metadata.eventDays || 1} DÍA${(t.metadata.eventDays || 1) > 1 ? 'S' : ''}${t.metadata.eventDays === 90 ? ' - RENOVABLE' : ''})` : 'OTRO'
                              }</p>
                              <p><span className="font-bold">Código:</span> {t.metadata.taxCode}</p>
                              {t.metadata.taxActivity && <p><span className="font-bold">Actividad:</span> {t.metadata.taxActivity}</p>}
                            </div>
                          )}
                          {(() => {
                            const tp = taxpayers.find(tp => tp.id === t.taxpayerId);
                            if (!t.metadata?.isDirectCharge && t.taxType === 'COMERCIO' && tp && tp.selectedTaxCodes && tp.selectedTaxCodes.length > 0) {
                              return (
                                <div className="mt-1 mb-1 border-l-2 border-indigo-200 pl-3 py-1 space-y-0.5 bg-slate-50/50 rounded-r-lg text-[9px] font-mono text-slate-600">
                                  <p className="font-bold text-[8px] text-indigo-700 uppercase tracking-wider">Actividades / Códigos Comerciales:</p>
                                  {tp.selectedTaxCodes.map((code: any, idx: number) => {
                                    const struct = (taxStructure as any[]).find(s => s.code === code);
                                    const rate = tp.selectedRates?.[code] || 0;
                                    return (
                                      <p key={idx}>
                                        <span className="font-bold">{code}</span> — {struct?.activity || 'Actividad'} (B/. {formatCurrency(rate)})
                                      </p>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5">PAGO EN: {getPaymentMethodLabel(t.paymentMethod).toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                          t.status === 'ANULADO' 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {t.status === 'ANULADO' ? 'ANULADO' : 'PAGADO'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-slate-900">
                        B/. {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-auto pt-20 flex justify-around">
                <div className="text-center relative">
                  {isCaja1User(currentUser?.name) && (
                    <img 
                      src={`${import.meta.env.BASE_URL}firma-cajera-caja1.png`} 
                      alt="Firma" 
                      className="absolute -top-9 left-1/2 -translate-x-1/2 h-14 w-auto object-contain select-none pointer-events-none z-10" 
                    />
                  )}
                  <div className="border-t border-slate-400 w-48 mb-2 relative z-0"></div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Firma del Cajero</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">({resolveTellerName(currentUser?.name)})</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-400 w-48 mb-2"></div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Firma de Auditoría</p>
                </div>
              </div>
              
              <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-[9px] text-slate-300 font-mono tracking-widest uppercase">SIGMA Digital - Municipio de Almirante</p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="bg-slate-800/95 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-row gap-4 no-print w-full shadow-2xl mb-20">
              <button
                onClick={async () => {
                  const element = document.getElementById('closing-report-content');
                  if (!element) return;
                  setIsGeneratingPdf(true);
                  try {
                    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'letter');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
                    pdf.save(`Cierre_Caja_${currentUser?.username}_${new Date().toLocaleDateString('en-CA')}.pdf`);
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }}
                disabled={isGeneratingPdf}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                <Download size={18} /> <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}</span>
              </button>
              <button 
                onClick={async () => {
                  const element = document.getElementById('closing-report-content');
                  if (!element) return;
                  setIsGeneratingPdf(true);
                  try {
                    const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                    const dataUrl = canvas.toDataURL('image/png');
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Cierre de Caja</title>
                            <style>
                              @page { size: letter portrait; margin: 0; }
                              body { margin: 0; display: flex; justify-content: center; }
                              img { width: 215.9mm; height: auto; }
                            </style>
                          </head>
                          <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
                            <img src="${dataUrl}" />
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                <Printer size={18} /> <span>Imprimir</span>
              </button>
              <button 
                onClick={() => setShowClosingModal(false)} 
                className="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                <X size={18} /> <span>Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- INVOICE MODAL (COMPACT & OPTIMIZED) --- */}
      {showInvoice && lastTransaction && (
        (() => {
          const payerName = lastTransaction.metadata?.manualPayer 
            || lastTransaction.metadata?.registeredPayer?.name 
            || taxpayers.find(tp => tp.id === lastTransaction.taxpayerId)?.name 
            || activeTaxpayer?.name 
            || 'Pagador Eventual';

          const payerDocId = lastTransaction.metadata?.manualPayerDoc 
            || lastTransaction.metadata?.registeredPayer?.docId 
            || taxpayers.find(tp => tp.id === lastTransaction.taxpayerId)?.docId 
            || activeTaxpayer?.docId 
            || 'N/A';

          const payerAddress = lastTransaction.metadata?.manualPayerAddress 
            || lastTransaction.metadata?.registeredPayer?.address 
            || taxpayers.find(tp => tp.id === lastTransaction.taxpayerId)?.address 
            || activeTaxpayer?.address 
            || 'N/A';

          const payerPhone = lastTransaction.metadata?.manualPayerPhone 
            || lastTransaction.metadata?.registeredPayer?.phone 
            || taxpayers.find(tp => tp.id === lastTransaction.taxpayerId)?.phone 
            || activeTaxpayer?.phone 
            || 'N/A';

          const resolvedTaxpayer = taxpayers.find(tp => tp.id === lastTransaction.taxpayerId) 
            || (lastTransaction.metadata?.registeredPayer ? taxpayers.find(tp => tp.id === lastTransaction.metadata.registeredPayer.id) : null) 
            || activeTaxpayer;

          const isConstructionTx = lastTransaction && (lastTransaction.metadata?.isManualConstruction === true || lastTransaction.taxType === 'CONSTRUCCION' || lastTransaction.taxType?.toUpperCase() === 'CONSTRUCCION');

          const matchingRequest = adminRequests.find(r => r.id === lastTransaction.metadata?.engineeringRequestId);
          const projectType = matchingRequest?.payload?.projectType 
            || lastTransaction.metadata?.projectType 
          return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
              <style>{`
                    @media print {
                        @page { size: portrait; margin: 0; }
                        body * { visibility: hidden; }
                        #invoice-modal-content, #invoice-modal-content * { visibility: visible; }
                        #invoice-modal-content { 
                            position: absolute; left: 0; top: 0; 
                            width: 80mm;
                            margin: 0; padding: 0; box-shadow: none; border: none; 
                        }
                        .no-print { display: none !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>

              <div id="invoice-modal-content" className="bg-white shadow-2xl w-full max-w-[320px] rounded-lg overflow-hidden flex flex-col relative animate-scale-up">
                
                {/* Status Badge - Floating Corner */}
                <div className="absolute top-4 right-4 z-10 no-print">
                  <span className={`px-2 py-1 rounded border-2 text-[8px] font-black tracking-tighter uppercase shadow-sm ${
                    lastTransaction.status === 'ANULADO' 
                      ? 'bg-red-50 text-red-600 border-red-200' 
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    {lastTransaction.status === 'ANULADO' ? '● ANULADO' : '● PAGADO'}
                  </span>
                </div>

                {/* Invoice Header - Thermal Optimized (80mm) */}
                <div className="bg-white p-2 text-center overflow-hidden">
                  {/* Centered Logo */}
                  <div className="flex justify-center mb-1">
                    <img
                      src={`${import.meta.env.BASE_URL}logo-municipio.png`}
                      alt="Escudo Municipal"
                      className="h-24 object-contain"
                    />
                  </div>

                  {/* Municipal Header - Compact & Centered */}
                  <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
                    <h1 className="text-sm font-extrabold uppercase text-slate-900 leading-tight">Municipio de Almirante</h1>
                    <p className="text-[9px] text-slate-600 font-medium uppercase leading-tight">República de Panamá</p>
                    <p className="text-[10px] text-slate-700 font-bold uppercase">RUC: 1-22-333 DV 44</p>
                    <p className="text-[9px] text-slate-500 uppercase">Tesorería Municipal</p>
                  </div>

                  {/* Receipt Info */}
                  <div className="mb-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recibo de Caja</h2>
                    <p className="font-mono text-sm font-black text-slate-900">Nº {lastTransaction.id}</p>
                    <p className="text-[9px] text-slate-500 font-medium">{lastTransaction.date} | {lastTransaction.time}</p>
                  </div>

                  {/* Taxpayer Info - Compact */}
                  <div className="bg-slate-50 p-2 rounded mb-3 border border-slate-100 text-left">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Contribuyente:</p>
                    <p className="font-bold text-[11px] text-slate-900 leading-tight uppercase">{payerName}</p>
                    <p className="text-[9px] font-mono text-slate-600 font-medium">CÉDULA/RUC: {payerDocId}</p>
                    {resolvedTaxpayer?.taxpayerNumber && (
                      <p className="text-[9px] font-mono text-indigo-700 font-extrabold">Nº CONTRIBUYENTE: {resolvedTaxpayer.taxpayerNumber}</p>
                    )}
                    {payerAddress !== 'N/A' && <p className="text-[9px] text-slate-500 font-medium leading-tight mt-0.5">DIR: {payerAddress}</p>}
                    {payerPhone !== 'N/A' && <p className="text-[9px] text-slate-500 font-medium leading-tight mt-0.5">TEL: {payerPhone}</p>}

                    {/* Direct Charge Details */}
                    {lastTransaction.metadata?.isDirectCharge && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[8px] text-slate-600 space-y-0.5 font-mono">
                        <p className="font-bold text-[8px] text-emerald-700 uppercase tracking-wider">Detalles de Cobro Directo:</p>
                        <p><span className="font-bold">Tipo:</span> {
                          lastTransaction.metadata.chargeType === 'COMERCIO' ? 'ACTIVIDAD COMERCIAL' :
                          lastTransaction.metadata.chargeType === 'EVENTO' ? `EVENTO ESPECIAL (${lastTransaction.metadata.eventDays || 1} DÍA${(lastTransaction.metadata.eventDays || 1) > 1 ? 'S' : ''}${lastTransaction.metadata.eventDays === 90 ? ' - RENOVABLE' : ''})` : 'OTRO'
                        }</p>
                        <p><span className="font-bold">Código:</span> {lastTransaction.metadata.taxCode}</p>
                        {lastTransaction.metadata.taxActivity && <p><span className="font-bold">Actividad:</span> {lastTransaction.metadata.taxActivity}</p>}
                      </div>
                    )}

                    {/* Detalles de Códigos Tributarios para Contribuyentes Registrados */}
                    {!lastTransaction.metadata?.isDirectCharge && lastTransaction.taxType === 'COMERCIO' && resolvedTaxpayer && resolvedTaxpayer.selectedTaxCodes && resolvedTaxpayer.selectedTaxCodes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[8px] text-slate-600 space-y-0.5 font-mono">
                        <p className="font-bold text-[8px] text-indigo-700 uppercase tracking-wider">Actividades / Códigos Comerciales:</p>
                        {resolvedTaxpayer.selectedTaxCodes.map((code: any, idx: number) => {
                          const struct = (taxStructure as any[]).find(s => s.code === code);
                          const rate = resolvedTaxpayer.selectedRates?.[code] || 0;
                          return (
                            <div key={idx} className="bg-white p-1 rounded border border-slate-100 mt-1">
                              <p className="font-bold text-slate-900 leading-snug">{code} — {struct?.activity || 'Actividad Comercial'}</p>
                              <p className="text-[7px]">Tarifa Mensual: B/. {formatCurrency(rate)}</p>
                            </div>
                          );
                        })}
                        {(resolvedTaxpayer.rotuloAmount || 0) > 0 && (
                          <p className="text-slate-600"><span className="font-bold">Impuesto Rótulo:</span> B/. {formatCurrency(resolvedTaxpayer.rotuloAmount)}</p>
                        )}
                        {(resolvedTaxpayer.garbageAmount || 0) > 0 && (
                          <p className="text-slate-600"><span className="font-bold">Tasa Aseo:</span> B/. {formatCurrency(resolvedTaxpayer.garbageAmount)}</p>
                        )}
                      </div>
                    )}

                    {/* Vehículos Vinculados (Generales completas del vehículo) */}
                    {resolvedTaxpayer && resolvedTaxpayer.vehicles && resolvedTaxpayer.vehicles.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[8px] text-slate-600 space-y-0.5">
                        <p className="font-bold text-[8px] text-indigo-700 uppercase tracking-wider">Detalles de Placa / Vehículo:</p>
                        {resolvedTaxpayer.vehicles.map((v, idx) => (
                          <div key={idx} className="bg-white p-1.5 rounded border border-slate-100 mt-1 space-y-0.5 font-mono">
                            <p className="font-bold text-slate-900">PLACA: {v.plate || 'Pendiente'}</p>
                            <p><span className="font-bold">Marca:</span> {v.brand || 'N/A'}</p>
                            {v.year && <p><span className="font-bold">Año:</span> {v.year}</p>}
                            {v.vehicleType && <p><span className="font-bold">Tipo:</span> {v.vehicleType}</p>}
                            {v.plateType && <p><span className="font-bold">Tipo Placa:</span> {v.plateType}</p>}
                            {v.color && <p><span className="font-bold">Color:</span> {v.color}</p>}
                            {v.motorSerial && <p><span className="font-bold">Motor:</span> {v.motorSerial}</p>}
                            {v.chassisSerial && <p><span className="font-bold">Chasis (VIN):</span> {v.chassisSerial}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Transaction Detail & Breakdown */}
                  <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase mb-1">
                      <span>Concepto</span>
                      <span>Monto</span>
                    </div>
                    
                    {lastTransaction.metadata?.isConsolidated ? (
                      <div className="space-y-1">
                        {(lastTransaction.metadata.originalItems || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-start text-left">
                            <p className="text-[9px] font-bold text-slate-800 leading-tight uppercase max-w-[180px]">{item.label}</p>
                            <p className="text-[9px] font-bold text-slate-900">{formatCurrency(item.amount)}</p>
                          </div>
                        ))}
                        <p className="text-[8px] text-slate-500 italic mt-2 text-left">Método: {getPaymentMethodLabel(lastTransaction.paymentMethod)}</p>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-left">
                          <p className="text-[10px] font-extrabold text-slate-800 leading-tight uppercase">{lastTransaction.description}</p>
                          {lastTransaction.metadata?.plateNumber && <p className="text-[8px] text-slate-500 mt-0.5">Placa: {lastTransaction.metadata.plateNumber}</p>}
                          <p className="text-[8px] text-slate-500 italic">Método: {getPaymentMethodLabel(lastTransaction.paymentMethod)}</p>
                        </div>
                        <p className="font-black text-xs text-slate-900 whitespace-nowrap">B/. {formatCurrency(lastTransaction.amount)}</p>
                      </div>
                    )}
                  </div>

                  {/* Total Box */}
                  <div className="flex justify-between items-center py-2 px-1 border-b-2 border-slate-900 mb-4">
                    <span className="text-[10px] font-black text-slate-900 uppercase">Total Pagado:</span>
                    <span className="text-sm font-black text-slate-900">B/. {formatCurrency(lastTransaction.amount)}</span>
                  </div>

                  {/* Signatures & Legal */}
                  <div className="space-y-4 text-center">
                    <div className="flex flex-col items-center relative min-h-[56px] justify-end">
                      {isCaja1User(lastTransaction.tellerName) && (
                        <img 
                          src={`${import.meta.env.BASE_URL}firma-cajera-caja1.png`} 
                          alt="Firma" 
                          className="h-14 w-auto object-contain -mb-5 relative z-10 select-none pointer-events-none" 
                        />
                      )}
                      <div className="border-b border-slate-300 w-24 mb-1 relative z-0"></div>
                      <p className="text-[8px] font-bold text-slate-650 uppercase">Cajero: {resolveTellerName(lastTransaction.tellerName)}</p>
                    </div>
                    <p className="text-[8px] text-slate-400 italic leading-tight px-4">
                      Comprobante oficial de pago. Verifique sus datos antes de retirarse.
                    </p>
                    <div className="pt-2">
                        <p className="text-[7px] font-mono text-slate-300 uppercase tracking-widest">SIGMA - MUNICIPIO DE ALMIRANTE</p>
                    </div>
                  </div>
                </div>

                {/* Action Bar (Hidden in Print) - Uniform Buttons */}
                <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-row gap-2 no-print w-full">
                  <button
                    onClick={downloadPDF}
                    disabled={isGeneratingPdf}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-bold text-[10px] shadow-sm transition-all"
                    title="Descargar PDF"
                  >
                    <Download size={14} /> <span>{isGeneratingPdf ? '...' : 'PDF'}</span>
                  </button>
                  <button 
                    onClick={printInvoice} 
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-bold text-[10px] shadow-sm transition-all"
                    title="Imprimir Recibo"
                  >
                    <Printer size={14} /> <span>Imprimir</span>
                  </button>
                  <button 
                    onClick={handleFinishCollection} 
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md font-bold text-[10px] shadow-sm transition-all"
                    title="Regresar a Caja"
                  >
                    <ArrowLeft size={14} /> <span>Finalizar</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* --- HEADER --- */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Caja Principal</h2>
          <p className="text-slate-500 text-sm">Procesamiento de pagos y emisión de recibos.</p>
        </div>
        <div className="flex items-center gap-3 relative">
          
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all ${
                isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="Forzar actualización desde el servidor"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isLoading ? 'Refrescando...' : 'Refrescar'}</span>
            </button>
          )}

          {/* Admin Requests Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRequestsDropdown(!showRequestsDropdown)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs transition-all border ${
                (adminRequests || []).filter(r => r.status === 'APPROVED').length > 0 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse' 
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Bell size={16} />
              <span className="hidden md:inline">Solicitudes</span>
              { (adminRequests || []).filter(r => r.status !== 'ARCHIVED').length > 0 && (
                <span className="bg-red-500 text-white text-[10px] h-4 w-4 flex items-center justify-center rounded-full">
                  {(adminRequests || []).filter(r => r.status !== 'ARCHIVED').length}
                </span>
              )}
            </button>

            {showRequestsDropdown && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] animate-scale-up">
                <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                  <h4 className="font-bold text-xs flex items-center gap-2">
                    <Banknote size={14} /> Historial de Solicitudes
                  </h4>
                  <button onClick={() => setShowRequestsDropdown(false)}><X size={14} /></button>
                </div>
                <div className="max-h-96 overflow-y-auto p-2 bg-slate-50 space-y-2">
                  {(adminRequests || []).filter(r => r.status !== 'ARCHIVED').length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      No hay solicitudes pendientes.
                    </div>
                  ) : (
                    [...(adminRequests || [])].filter(r => r.status !== 'ARCHIVED').reverse().map(req => (
                      <div key={req.id} className={`p-3 rounded-lg border text-xs shadow-sm relative group ${
                        req.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' :
                        req.status === 'REJECTED' ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'
                      }`}>
                        {req.status !== 'PENDING' && (
                          <button
                            onClick={() => onArchiveRequest && onArchiveRequest(req.id)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 bg-white/50 rounded-full p-1"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <div className="flex justify-between items-start mb-1 pr-4">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            req.type === 'VOID_TRANSACTION' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {req.type === 'VOID_TRANSACTION' ? 'Anulación' : 'Arreglo'}
                          </span>
                          <span className={`text-[9px] font-bold ${
                            req.status === 'APPROVED' ? 'text-emerald-600' :
                            req.status === 'REJECTED' ? 'text-red-600' : 'text-amber-500'
                          }`}>
                            {req.status === 'PENDING' ? 'ESPERANDO' : req.status}
                          </span>
                        </div>
                        <p className="font-bold text-slate-700 truncate">{req.taxpayerName}</p>
                        {req.status === 'APPROVED' && (
                          <div className="mt-2">
                            <p className="text-[10px] text-emerald-700 mb-1 font-medium">{req.responseNote || 'Aprobado'}</p>
                            <button
                              onClick={() => {
                                setLoadedArrangement(req);
                                  if (req.taxpayerId) {
                                    setSelectedTaxpayerId(req.taxpayerId);
                                  } else {
                                    const tp = taxpayers.find(t => t.name === req.taxpayerName);
                                    if (tp) setSelectedTaxpayerId(tp.id);
                                  }
                                
                                if (req.type === 'PAYMENT_ARRANGEMENT') {
                                  setPaymentMethod(PaymentMethod.ARREGLO_PAGO as any);
                                } else if (req.type === 'VOID_TRANSACTION' && req.transactionId) {
                                  // Find original transaction
                                  const origTx = transactions.find(tx => tx.id === req.transactionId);
                                  if (origTx) {
                                    setPaymentMethod(origTx.paymentMethod);
                                    alert(`TRANSACCIÓN CARGADA PARA CORRECCIÓN\n-------------------------\nContribuyente: ${req.taxpayerName}\nConcepto: ${origTx.description}\nPor favor, procese el nuevo cobro desde la lista de deudas.`);
                                  }
                                }
                                
                                if (onArchiveRequest) onArchiveRequest(req.id);
                                setShowRequestsDropdown(false);
                              }}
                              className="w-full bg-emerald-600 text-white text-[10px] font-bold py-1.5 rounded hover:bg-emerald-700"
                            >
                              CARGAR ACCIÓN
                            </button>
                          </div>
                        )}
                        {req.status === 'REJECTED' && (
                          <p className="mt-1 text-[10px] text-red-600 italic">"{req.responseNote}"</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowDirectChargeModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <CreditCard size={16} />
            <span>Cobrar Directamente</span>
          </button>

          <button
            onClick={handleDailyClosing}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-900 transition-colors shadow-sm"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Cierre del Día</span>
          </button>
        </div>
      </div>

      {/* --- SEARCH --- */}
      <div className="relative z-20" ref={searchContainerRef}>
        {!activeTaxpayer ? (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              autoFocus
              className="block w-full pl-10 pr-3 py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-lg shadow-sm"
              placeholder="Buscar Contribuyente (Nombre o Cédula)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />

            {showDropdown && searchTerm.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto z-50">
                {filteredTaxpayers.length > 0 ? (
                  filteredTaxpayers.map((tp, idx) => (
                    <div
                      key={`coll-${tp.id}-${tp.taxpayerNumber || ''}-${idx}`}
                      onClick={() => handleSelectTaxpayer(tp)}
                      className="p-4 hover:bg-emerald-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-slate-800">{tp.name}</p>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold">#{tp.taxpayerNumber || 'N/A'}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">ID: {tp.docId}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-bold">No se encontraron resultados</p>
                    <p className="text-xs text-slate-400 mt-1">Verifique el nombre o número de cédula/RUC</p>
                  </div>
                )}
              </div>
            )}
          </div>
          ) : (
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 text-white shadow-lg flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-2 rounded-full"><UserIcon size={24} className="text-emerald-400" /></div>
              <div>
                <h3 className="font-bold text-lg leading-none">{activeTaxpayer.name}</h3>
                <p className="text-xs text-slate-300 mt-1 font-mono">
                  <span className="text-emerald-400 font-bold mr-2">#{activeTaxpayer.taxpayerNumber || 'N/A'}</span>
                  ID: {activeTaxpayer.docId}
                </p>
              </div>
            </div>
            <button onClick={handleClearSelection} className="bg-white/10 hover:bg-white/20 p-2 rounded text-white"><X size={20} /></button>
          </div>
        )}

        {/* --- DEBT SUMMARY AND ALERTS (PAZ Y SALVO BLOCK) --- */}
        {activeTaxpayer && (
          <div className="mt-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border ${taxpayerDebts.filter(d => d.isPastDue !== false).length > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <p className="text-xs uppercase font-bold opacity-70 mb-1">Estado de Cuenta</p>
              <div className="flex items-center gap-2">
                {taxpayerDebts.filter(d => d.isPastDue !== false).length > 0 ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                <span className="font-bold text-lg">
                  {activeTaxpayer.paymentArrangement && activeTaxpayer.paymentArrangement.estado === 'ACTIVO' ? (
                    taxpayerDebts.filter(d => d.isPastDue !== false).length > 0 ? 'Convenio Atrasado' : 'Convenio Al Día'
                  ) : (
                    taxpayerDebts.length > 0 ? `${taxpayerDebts.length} Deuda(s) Pendiente(s)` : 'Paz y Salvo'
                  )}
                </span>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-end p-4 gap-3">
              <button
                onClick={() => setShowRequestModal(true)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-3 rounded-lg font-bold text-xs border border-slate-300 transition-all active:scale-95"
              >
                Solicitar Autorización
              </button>
              {taxpayerDebts.filter(d => d.isPastDue !== false).length === 0 ? (
                <button
                  onClick={() => {
                    triggerPaymentPreview({
                      taxType: TaxType.COMERCIO,
                      taxpayerId: activeTaxpayer.id,
                      amount: 3.00,
                      paymentMethod: PaymentMethod.EFECTIVO,
                      description: 'TRAMITE: CERTIFICADO PAZ Y SALVO MUNICIPAL',
                      metadata: { isPazSalvo: true }
                    });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <CheckCircle size={20} /> Generar Paz y Salvo (B/. 3.00)
                </button>
              ) : (
                <div className="flex items-center gap-2 text-red-500 bg-white px-4 py-2 rounded-lg border border-red-100 shadow-sm">
                  <Lock size={16} />
                  <span className="font-bold text-sm">
                    {activeTaxpayer.paymentArrangement && activeTaxpayer.paymentArrangement.estado === 'ACTIVO' 
                      ? 'Paz y Salvo Bloqueado: Debe cuota del convenio o impuestos actuales'
                      : 'Paz y Salvo Bloqueado: Contribuyente Moroso'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- DEBTS LIST (SEPARATE PAYMENTS) --- */}
      {
        activeTaxpayer && taxpayerDebts.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-6 animate-fade-in relative z-10">
            <div className="bg-red-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertCircle size={20} /> 
                {taxpayerDebts.filter(d => d.type !== 'DEUDA_ARRAS').length} Mes(es) Pendiente(s)
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-white/20 px-2 py-1 rounded font-mono">Total Adeudado: B/. {formatCurrency(taxpayerDebts.reduce((acc, d) => acc + (d.amount || 0), 0))}</span>
                {taxpayerDebts.length > 1 && (
                  <button
                    onClick={handlePayAllDebts}
                    className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Cobrar Totalidad
                  </button>
                )}
              </div>
            </div>
            <div className="p-0">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Concepto</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                    <th className="px-6 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxpayerDebts.map((debt) => (
                    <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{debt.label}</p>
                        <p className="text-xs text-slate-500">{debt.description}</p>
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-red-600">
                        B/. {formatCurrency(debt.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handlePayDebtItem(debt)}
                          className="bg-slate-900 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
                        >
                          Pagar Item
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* --- REQUEST AUTHORIZATION MODAL --- */}
      {
        showRequestModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-scale-up">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Solicitar Autorización Administrativa</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Solicitud</label>
                  <select
                    className="w-full border rounded p-2"
                    value={newRequestType ?? ''}
                    onChange={(e) => setNewRequestType(e.target.value as RequestType)}
                  >
                    <option value="VOID_TRANSACTION">Anulación / Descobro (Solicitar)</option>
                    <option value="PAYMENT_ARRANGEMENT">Arreglo de Pago (Solicitar)</option>
                    <option value="UPDATE_TAXPAYER">Editar Datos de Contribuyente (Solicitar)</option>
                  </select>
                </div>

                {newRequestType === 'UPDATE_TAXPAYER' && (
                  <div className="bg-amber-50 p-3 rounded border border-amber-200 text-xs text-amber-800 mb-2">
                    <p className="font-bold flex items-center gap-1"><AlertCircle size={14} /> Importante</p>
                    <p>Al solicitar edición, el Administrador podrá permitirle modificar datos sensibles como nombre, categoría comercial o saldos.</p>
                  </div>
                )}

                {newRequestType === 'VOID_TRANSACTION' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">ID de Transacción (Recibo)</label>
                    <input
                      type="text"
                      className="w-full border rounded p-2"
                      placeholder="Ej. TX-123456"
                      value={requestTargetId ?? ''}
                      onChange={(e) => setRequestTargetId(e.target.value)}
                    />
                  </div>
                )}

                {newRequestType === 'PAYMENT_ARRANGEMENT' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Monto Total de la Deuda</label>
                    <input
                      type="number" inputMode="decimal"
                      className="w-full border rounded p-2"
                      placeholder="0.00"
                      value={newRequestAmount === 0 ? '' : newRequestAmount}
                      onChange={(e) => setNewRequestAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Motivo / Descripción</label>
                  <textarea
                    className="w-full border rounded p-2 h-24"
                    placeholder="Explique la razón de la solicitud..."
                    value={newRequestDesc ?? ''}
                    onChange={(e) => setNewRequestDesc(e.target.value)}
                  />
                </div>

                {onDirectAdminAuth && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Autorización Presencial (Opcional)</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        className="flex-1 border border-slate-300 rounded p-2 text-sm bg-slate-50 focus:bg-white"
                        placeholder="PIN/Clave del Administrador"
                        value={offlineAdminPassword ?? ''}
                        onChange={(e) => setOfflineAdminPassword(e.target.value)}
                      />
                      <button
                        onClick={async () => {
                          if (!offlineAdminPassword) {
                            alert("Ingrese la clave del administrador.");
                            return;
                          }
                          
                          let finalTaxpayerName = activeTaxpayer?.name || 'Desconocido';
                          let finalTaxpayerId = selectedTaxpayerId;

                          if (finalTaxpayerName === 'Desconocido' && requestTargetId) {
                            const tx = transactions.find(t => t.id === requestTargetId);
                            if (tx) {
                              const tp = taxpayers.find(tp => tp.id === tx.taxpayerId);
                              if (tp) {
                                finalTaxpayerName = tp.name;
                                finalTaxpayerId = tp.id;
                              }
                            }
                          }

                          const req: AdminRequest = {
                            id: `REQ-${Date.now()}`,
                            type: newRequestType,
                            status: 'APPROVED', // Will be overridden in backend but useful for context
                            requesterName: currentUser?.name || 'Cajero',
                            taxpayerName: finalTaxpayerName,
                            description: newRequestDesc || 'Autorizado presencialmente',
                            transactionId: requestTargetId,
                            taxpayerId: finalTaxpayerId, 
                            totalDebt: newRequestType === 'PAYMENT_ARRANGEMENT' ? newRequestAmount : undefined,
                            createdAt: new Date().toISOString()
                          };

                          const success = await onDirectAdminAuth(offlineAdminPassword, req);
                          if (success) {
                            setShowRequestModal(false);
                            setNewRequestDesc('');
                            setNewRequestAmount(0);
                            setRequestTargetId('');
                            setOfflineAdminPassword('');
                          } else {
                            alert("Credenciales de administrador incorrectas.");
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded text-sm transition-colors flex items-center gap-2"
                      >
                        <Lock size={14} /> Autorizar
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => {
                      setShowRequestModal(false);
                      setOfflineAdminPassword('');
                    }}
                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (onCreateRequest) {
                        let finalTaxpayerName = activeTaxpayer?.name || 'Desconocido';
                        let finalTaxpayerId = selectedTaxpayerId;

                        // If no active taxpayer is selected, try to find it via the transaction ID
                        if (finalTaxpayerName === 'Desconocido' && requestTargetId) {
                          const tx = transactions.find(t => t.id === requestTargetId);
                          if (tx) {
                            const tp = taxpayers.find(tp => tp.id === tx.taxpayerId);
                            if (tp) {
                              finalTaxpayerName = tp.name;
                              finalTaxpayerId = tp.id;
                            }
                          }
                        }

                        const req: AdminRequest = {
                          id: `REQ-${Date.now()}`,
                          type: newRequestType,
                          status: 'PENDING',
                          requesterName: currentUser?.name || 'Cajero',
                          taxpayerName: finalTaxpayerName,
                          description: newRequestDesc,
                          transactionId: requestTargetId,
                          taxpayerId: finalTaxpayerId, 
                          totalDebt: newRequestType === 'PAYMENT_ARRANGEMENT' ? newRequestAmount : undefined,
                          createdAt: new Date().toISOString()
                        };
                        onCreateRequest(req);
                        setShowRequestModal(false);
                        setNewRequestDesc('');
                        setNewRequestAmount(0);
                        setRequestTargetId('');
                        alert("Solicitud enviada exitosamente al Administrador. Recibirá una notificación cuando sea procesada.");
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    Enviar Solicitud
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* --- CASHIER NOTIFICATIONS / REQUEST STATUS --- */}

      {/* --- RECENT TRANSACTIONS (FOR VOID/REFERENCE) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6 transition-all duration-300">
        <div 
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none hover:bg-slate-100/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>Transacciones {historyFilterDate === new Date().toLocaleDateString('en-CA') ? '(Hoy)' : `(${historyFilterDate})`}</span>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-black tracking-wider uppercase">
                {(transactions || []).filter(t => t.tellerName === currentUser?.name && t.date === historyFilterDate && !t.id.startsWith('VOID-')).length} Cobros
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold whitespace-nowrap uppercase tracking-widest text-[9px]">Ver Fecha:</span>
              <input 
                type="date" 
                value={historyFilterDate}
                onChange={(e) => setHistoryFilterDate(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700 bg-white"
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsHistoryExpanded(!isHistoryExpanded);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all"
              aria-label={isHistoryExpanded ? 'Collapse' : 'Expand'}
            >
              {isHistoryExpanded ? <ChevronUp size={20} className="text-slate-600" /> : <ChevronDown size={20} className="text-slate-600" />}
            </button>
          </div>
        </div>

        {isHistoryExpanded && (
          <div className="overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-6 py-3">Hora</th>
                  <th className="px-6 py-3">Contribuyente</th>
                  <th className="px-6 py-3">Concepto</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(transactions || [])
                  .filter(t => t.tellerName === currentUser?.name && t.date === historyFilterDate && !t.id.startsWith('VOID-'))
                  .sort((a, b) => b.time.localeCompare(a.time)) // Newest first
                  .slice(0, 15)
                  .map(tx => (
                    <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${tx.status === 'ANULADO' ? 'bg-red-50/30 opacity-80' : ''}`}>
                      <td className="px-6 py-4 font-mono text-xs">{tx.time}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {taxpayers.find(tp => tp.id === tx.taxpayerId)?.name || tx.metadata?.manualPayer || 'Desconocido'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex flex-col max-w-[300px]">
                          <span className="font-bold text-slate-800 uppercase text-xs">{tx.description}</span>
                          {tx.metadata?.isConsolidated && tx.metadata?.originalItems && (
                            <div className="mt-2 border-l-2 border-indigo-200 pl-3 py-1 space-y-1 bg-indigo-50/30 rounded-r-lg">
                              {tx.metadata.originalItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-[10px] text-slate-600">
                                  <span className="uppercase truncate pr-2">{item.label}</span>
                                  <span className="font-black whitespace-nowrap">B/. {formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {tx.metadata?.isDirectCharge && (
                            <div className="mt-2 border-l-2 border-emerald-200 pl-3 py-1 space-y-0.5 bg-emerald-50/30 rounded-r-lg text-[10px] font-mono text-slate-600">
                              <p className="font-bold text-[9px] text-emerald-700 uppercase tracking-wider">Detalles de Cobro Directo:</p>
                              <p><span className="font-bold">Tipo:</span> {
                                tx.metadata.chargeType === 'COMERCIO' ? 'ACTIVIDAD COMERCIAL' :
                                tx.metadata.chargeType === 'EVENTO' ? `EVENTO ESPECIAL (${tx.metadata.eventDays || 1} DÍA${(tx.metadata.eventDays || 1) > 1 ? 'S' : ''}${tx.metadata.eventDays === 90 ? ' - RENOVABLE' : ''})` : 'OTRO'
                              }</p>
                              <p><span className="font-bold">Código:</span> {tx.metadata.taxCode}</p>
                              {tx.metadata.taxActivity && <p><span className="font-bold">Actividad:</span> {tx.metadata.taxActivity}</p>}
                            </div>
                          )}
                          {(() => {
                            const tp = taxpayers.find(tp => tp.id === tx.taxpayerId);
                            if (!tx.metadata?.isDirectCharge && tx.taxType === 'COMERCIO' && tp && tp.selectedTaxCodes && tp.selectedTaxCodes.length > 0) {
                              return (
                                <div className="mt-2 border-l-2 border-indigo-200 pl-3 py-1 space-y-0.5 bg-indigo-50/30 rounded-r-lg text-[10px] font-mono text-slate-600">
                                  <p className="font-bold text-[9px] text-indigo-700 uppercase tracking-wider">Actividades / Códigos Comerciales:</p>
                                  {tp.selectedTaxCodes.map((code: any, idx: number) => {
                                    const struct = (taxStructure as any[]).find(s => s.code === code);
                                    const rate = tp.selectedRates?.[code] || 0;
                                    return (
                                      <p key={idx}>
                                        <span className="font-bold">{code}</span> — {struct?.activity || 'Actividad'} (B/. {formatCurrency(rate)})
                                      </p>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <span className="text-[9px] font-bold text-slate-400 mt-1">MÉTODO: {getPaymentMethodLabel(tx.paymentMethod).toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-tight border-2 shadow-sm ${
                          tx.status === 'ANULADO' 
                            ? 'bg-red-50 text-red-600 border-red-200' 
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}>
                          {tx.status === 'ANULADO' ? 'ANULADO' : 'PAGADO'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        B/. {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tx.status !== 'ANULADO' && (
                          <button
                            onClick={() => {
                              setRequestTargetId(tx.id);
                              setNewRequestType('VOID_TRANSACTION');
                              setNewRequestDesc(`Solicito anulación del recibo ${tx.id} por error en el cobro.`);
                              setShowRequestModal(true);
                            }}
                            className="text-red-600 hover:text-red-700 font-bold text-xs bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {(transactions || []).filter(t => t.tellerName === currentUser?.name && t.date === historyFilterDate).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">No se encontraron transacciones para esta fecha.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- DIRECT CHARGE MODAL --- */}
      {showDirectChargeModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto pt-10">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up my-8">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider">Cobrar Directamente</h3>
                <p className="text-xs text-slate-400">Registrar cobros eventuales y actividades comerciales rápidamente.</p>
              </div>
              <button 
                onClick={() => {
                  setShowDirectChargeModal(false);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* 1. Tipo de Pagador Selector (Tabs) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de Pagador</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualPayer(false);
                      setDirectManualName('');
                      setDirectManualDocId('');
                      setDirectManualAddress('');
                      setDirectManualPhone('');
                    }}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                      !isManualPayer 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Contribuyente Registrado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualPayer(true);
                      setDirectSelectedTaxpayerId('');
                      setDirectSearchTerm('');
                    }}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                      isManualPayer 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Pagador Eventual (Manual)
                  </button>
                </div>
              </div>

              {/* 2. Payer Details Input based on choice */}
              {!isManualPayer ? (
                <div className="relative" ref={directSearchContainerRef}>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Buscar Contribuyente</label>
                  {!directSelectedTaxpayer ? (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Escriba nombre, RUC o Cédula..."
                        value={directSearchTerm}
                        onChange={(e) => {
                          setDirectSearchTerm(e.target.value);
                          setDirectShowDropdown(true);
                        }}
                        onFocus={() => setDirectShowDropdown(true)}
                      />

                      {directShowDropdown && directSearchTerm.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-50">
                          {directFilteredTaxpayers.length > 0 ? (
                            directFilteredTaxpayers.map((tp) => (
                              <div
                                key={`direct-tp-${tp.id}`}
                                onClick={() => {
                                  setDirectSelectedTaxpayerId(tp.id);
                                  setDirectSearchTerm('');
                                  setDirectShowDropdown(false);
                                }}
                                className="p-3 hover:bg-emerald-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 text-xs"
                              >
                                <div className="flex justify-between items-center">
                                  <p className="font-bold text-slate-800">{tp.name}</p>
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold">#{tp.taxpayerNumber || 'N/A'}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono">ID: {tp.docId}</p>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-slate-400 text-xs italic">
                              No se encontraron contribuyentes.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-900 text-white rounded-xl p-3.5 flex justify-between items-center shadow-inner">
                      <div>
                        <p className="font-bold text-sm uppercase">{directSelectedTaxpayer.name}</p>
                        <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                          ID: {directSelectedTaxpayer.docId} | Reg: #{directSelectedTaxpayer.taxpayerNumber || 'N/A'}
                        </p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setDirectSelectedTaxpayerId('')}
                        className="bg-white/10 hover:bg-white/20 p-1.5 rounded transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Ej. Juan Pérez"
                      value={directManualName}
                      onChange={(e) => setDirectManualName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula / RUC *</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Ej. 1-234-5678 o RUC..."
                      value={directManualDocId}
                      onChange={(e) => setDirectManualDocId(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Residencial / Comercial</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Ej. Calle 3ra, Almirante"
                      value={directManualAddress}
                      onChange={(e) => setDirectManualAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Ej. 6677-8899"
                      value={directManualPhone}
                      onChange={(e) => setDirectManualPhone(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* 3. Tipo de Registro Selector Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de Registro / Cobro</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div 
                    onClick={() => setDirectChargeType('COMERCIO')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      directChargeType === 'COMERCIO' 
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Store size={16} className={directChargeType === 'COMERCIO' ? 'text-emerald-600' : 'text-slate-400'} />
                      <p className="font-bold text-xs text-slate-800">Actividad Comercial</p>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">Establecimientos permanentes en el distrito.</p>
                  </div>

                  <div 
                    onClick={() => setDirectChargeType('EVENTO')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      directChargeType === 'EVENTO' 
                        ? 'border-amber-500 bg-amber-50/50 shadow-md' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard size={16} className={directChargeType === 'EVENTO' ? 'text-amber-600' : 'text-slate-400'} />
                      <p className="font-bold text-xs text-slate-800">Evento Especial</p>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">Permiso temporal de 1 a 90 días renovables.</p>
                  </div>
                </div>

                {/* Manual Days Input — only shown when EVENTO is selected */}
                {directChargeType === 'EVENTO' && (
                  <div className="mt-3 bg-amber-50/60 border border-amber-200 rounded-xl p-4 animate-in fade-in">
                    <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Duración del Evento (Días)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="90"
                        placeholder="Ej. 5"
                        className="w-24 p-2.5 border border-amber-300 rounded-lg font-black text-sm text-center focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all bg-white text-slate-900 shadow-sm"
                        value={directEventDays}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          if (valStr === '') {
                            setDirectEventDays('');
                            return;
                          }
                          let val = parseInt(valStr);
                          if (isNaN(val)) {
                            setDirectEventDays('');
                            return;
                          }
                          if (val < 1) val = 1;
                          if (val > 90) val = 90;
                          setDirectEventDays(val);
                        }}
                      />
                      <span className="text-xs font-bold text-amber-700">día{(directEventDays || 0) > 1 ? 's' : ''}</span>
                      {directEventDays === 90 && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Renovable</span>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1.5 italic">Máximo permitido: 90 días. Al llegar a 90 días el permiso es renovable.</p>
                  </div>
                )}
              </div>

              {/* 4. Servicios y Estructura Tributaria */}
              <div className="space-y-4">
                <div className="relative" ref={directCodeContainerRef}>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Asignar Código Tributario</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Buscar por código tributario o actividad..."
                      value={directCodeSearchTerm}
                      onChange={(e) => {
                        setDirectCodeSearchTerm(e.target.value);
                        setDirectCodeShowDropdown(true);
                      }}
                      onFocus={() => setDirectCodeShowDropdown(true)}
                    />

                    {directCodeShowDropdown && directCodeSearchTerm.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-50">
                        {directFilteredTaxCodes.length > 0 ? (
                          directFilteredTaxCodes.map((item) => (
                            <div
                              key={`direct-code-${item.code}`}
                              onClick={() => {
                                setDirectTaxCode(item.code);
                                setDirectTaxActivityName(item.activity);
                                setDirectCodeSearchTerm(`${item.code} - ${item.activity}`);
                                setDirectCodeShowDropdown(false);
                              }}
                              className="p-3 hover:bg-emerald-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 text-xs"
                            >
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="font-mono font-bold text-emerald-600">{item.code}</span>
                              </div>
                              <p className="text-[11px] font-bold text-slate-800 uppercase line-clamp-1">{item.activity}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-400 text-xs italic">
                            No se encontraron códigos tributarios.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Display Reference Pricing Ranges & Activity Info if Code is selected */}
                {directTaxCode && (
                  (() => {
                    const struct = (taxStructure as any[]).find(s => s.code === directTaxCode);
                    if (!struct) return null;

                    return (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="border-b border-slate-200 pb-2">
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Actividad Tributaria Seleccionada</p>
                          <p className="font-mono text-xs font-bold text-slate-900 mt-1">{struct.code} — <span className="uppercase font-sans font-black text-[11px]">{struct.activity}</span></p>
                        </div>

                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Rangos Tarifarios de Referencia (Acuerdo Municipal)</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-sm">
                              <span className="block text-slate-400 font-bold uppercase text-[8px] tracking-wider mb-0.5">Pequeño</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">{renderRateInfo(struct.rates.PEQUENO)}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-sm">
                              <span className="block text-slate-400 font-bold uppercase text-[8px] tracking-wider mb-0.5">Mediano</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">{renderRateInfo(struct.rates.MEDIANO)}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-sm">
                              <span className="block text-slate-400 font-bold uppercase text-[8px] tracking-wider mb-0.5">Grande</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">{renderRateInfo(struct.rates.GRANDE)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Establecer Monto Evaluado a Cobrar *</label>
                          <div className="flex items-center gap-2 max-w-xs">
                            <span className="text-slate-400 font-black text-sm">B/.</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full p-2.5 border border-slate-300 rounded-lg font-black text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all bg-white text-slate-900 shadow-sm"
                              placeholder="0.00"
                              value={directAmount}
                              onChange={(e) => setDirectAmount(e.target.value)}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 italic">
                            Ingrese el monto evaluado según los rangos tarifarios de referencia mostrados.
                          </p>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* 5. Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: PaymentMethod.EFECTIVO, label: 'Efectivo', icon: Banknote },
                    { id: PaymentMethod.TARJETA, label: 'Tarjeta', icon: CreditCard },
                    { id: PaymentMethod.ONLINE, label: 'ACH / Yappy / Online', icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = directPaymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDirectPaymentMethod(m.id)}
                        className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1.5 font-bold text-xs transition-all ${
                          isSelected 
                            ? 'bg-slate-900 border-slate-900 text-white shadow' 
                            : 'border-slate-200 hover:bg-slate-50 text-slate-600 bg-white'
                        }`}
                      >
                        <Icon size={16} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDirectChargeModal(false);
                  setIsManualPayer(false);
                  setDirectSelectedTaxpayerId('');
                  setDirectManualName('');
                  setDirectManualDocId('');
                  setDirectManualAddress('');
                  setDirectManualPhone('');
                  setDirectChargeType('COMERCIO');
                  setDirectEventDays(1);
                  setDirectTaxCode('');
                  setDirectTaxActivityName('');
                  setDirectAmount('');
                  setDirectSearchTerm('');
                  setDirectCodeSearchTerm('');
                }}
                className="bg-white hover:bg-slate-100 text-slate-700 font-bold py-2.5 px-4 rounded-xl border border-slate-200 text-xs transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessDirectCharge}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-emerald-100"
              >
                Procesar Cobro Directo
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  );
};