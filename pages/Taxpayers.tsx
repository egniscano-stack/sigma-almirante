import React, { useState } from 'react';
import { Taxpayer, TaxpayerType, CommercialCategory, Transaction, VehicleInfo, TaxpayerStatus, UserRole, Corregimiento, AdminRequest, RequestStatus } from '../types';
import { db } from '../services/db';
import { Search, UserPlus, Briefcase, User, MapPin, Store, History, X, FileText, Car, Hammer, Trash2, CheckSquare, Plus, AlertCircle, MoreVertical, ShieldAlert, Ban, CheckCircle, Edit, Upload, Image as ImageIcon, Shield } from 'lucide-react';
import { AntivirusScanner } from '../components/AntivirusScanner';
import { FileScanResult } from '../services/antivirus';
import { getSession } from '../services/security';

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
}

export const Taxpayers: React.FC<TaxpayersProps> = ({ taxpayers, transactions, onAdd, onUpdate, onDelete, userRole, onCreateRequest }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Taxpayer[]>([]);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // History Modal State
  const [historyTaxpayer, setHistoryTaxpayer] = useState<Taxpayer | null>(null);
  const [viewTaxpayer, setViewTaxpayer] = useState<Taxpayer | null>(null); // State for viewing full details
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');

  // --- New Taxpayer Form State (Now Main View) ---
  // Initial empty state
  const initialFormState: Partial<Taxpayer> = {
    type: TaxpayerType.NATURAL,
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
    hasGarbageService: true, // Default true usually
    vehicles: []
  };

  const [newTp, setNewTp] = useState<Partial<Taxpayer>>(initialFormState);
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

  // Temporary state for adding a vehicle inside the modal
  const [tempVehicle, setTempVehicle] = useState<Partial<VehicleInfo>>({
    plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false
  });
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  // Load Taxpayer into Form for Editing
  const handleEditInit = (tp: Taxpayer) => {
    setNewTp(tp);
    setIsEditing(true);
    setEditingId(tp.id);
    setSearchTerm('');
    setIsSearching(false);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to form
  };

  const handleCancelEdit = () => {
    setNewTp(initialFormState);
    setIsEditing(false);
    setEditingId(null);
    setEditReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If there are files to upload, run antivirus scan FIRST
    if (Object.keys(files).length > 0) {
      // Store form data for after scan
      setPendingSubmitData({ ...newTp });
      setShowAntivirusScan(true);
      return; // Wait for scan to complete
    }

    // No files - proceed directly
    await submitTaxpayerData({ ...newTp }, {});
  };

  // Called after antivirus scan completes
  const handleScanComplete = async (allClean: boolean, results: Record<string, FileScanResult>) => {
    setShowAntivirusScan(false);
    setScanResults(results);

    if (!allClean) {
      // BLOCK upload - alert user
      const infectedFiles = Object.entries(results)
        .filter(([, r]) => r.status !== 'CLEAN')
        .map(([key]) => key)
        .join(', ');
      alert(`🚨 ALERTA DE SEGURIDAD\n\nSe detectaron archivos sospechosos o infectados:\n${infectedFiles}\n\nLos archivos han sido BLOQUEADOS. No se realizará la carga al servidor.\n\nPor favor revise los archivos y consulte con el administrador del sistema.`);
      setFiles({});
      setPendingSubmitData(null);
      return;
    }

    // All clean - proceed with upload
    if (pendingSubmitData) {
      await submitTaxpayerData(pendingSubmitData, files);
      setPendingSubmitData(null);
    }
  };

  const submitTaxpayerData = async (taxpayerFormData: Partial<Taxpayer>, filesToUpload: Record<string, File>) => {
    setIsUploading(true);
    try {
      // Upload Files First
      const uploadedDocs: Record<string, string> = { ...taxpayerFormData.documents };

      // Define base path
      const docIdSafe = taxpayerFormData.docId?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';

      for (const [key, file] of Object.entries(filesToUpload)) {
        const ext = file.name.split('.').pop();
        const path = `taxpayers/${docIdSafe}/${key}_${Date.now()}.${ext}`;
        try {
          const url = await db.uploadTaxpayerDocument(file, path);
          uploadedDocs[key] = url;
        } catch (err) {
          console.error(`Failed to upload ${key}:`, err);
          alert(`Error subiendo ${key}. Intente de nuevo.`);
          setIsUploading(false);
          return;
        }
      }

      const taxpayerData = {
        ...taxpayerFormData,
        documents: uploadedDocs
      };

      if (isEditing && editingId) {
        if (!editReason || editReason.trim().length < 5) {
          alert('Por favor, ingrese un motivo válido para la edición (mínimo 5 caracteres).');
          setIsUploading(false);
          return;
        }

        const request: AdminRequest = {
          id: `REQ-${Date.now()}`,
          type: 'UPDATE_TAXPAYER',
          status: 'PENDING',
          requesterName: 'Cajero/Usuario',
          taxpayerName: taxpayerData.name || 'Desconocido',
          description: editReason,
          taxpayerId: editingId,
          payload: taxpayerData as Taxpayer,
          createdAt: new Date().toISOString()
        };

        await onCreateRequest(request);
        alert('Solicitud de edición enviada al Administrador.');
        handleCancelEdit();
        setFiles({});
        setEditReason('');
      } else {
        const finalStatus = (taxpayerData.balance && taxpayerData.balance > 0) ? TaxpayerStatus.MOROSO : taxpayerData.status;

        onAdd({
          ...taxpayerData,
          id: Date.now().toString(),
          status: finalStatus,
          taxpayerNumber: `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: new Date().toISOString().split('T')[0]
        } as Taxpayer);

        setNewTp(initialFormState);
        setFiles({});
        alert(finalStatus === TaxpayerStatus.MOROSO
          ? 'Contribuyente registrado como MOROSO debido al saldo inicial.'
          : 'Contribuyente registrado exitosamente.'
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error: any) {
      console.error('Error saving taxpayer:', error);
      alert(`Ocurrió un error al guardar: ${error.message || JSON.stringify(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  // ... (rest of component functions)





  // Search Effect
  React.useEffect(() => {
    if (searchTerm.length > 2) {
      setIsSearching(true);
      const results = taxpayers.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.docId.includes(searchTerm) ||
        (t.taxpayerNumber && t.taxpayerNumber.includes(searchTerm))
      );
      setSearchResults(results.slice(0, 5)); // Limit to 5 results
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [searchTerm, taxpayers]);

  const handleAddVehicle = () => {
    if (!tempVehicle.plate || !tempVehicle.brand) {
      alert("Placa y Marca son obligatorios");
      return;
    }
    const vehicle: VehicleInfo = {
      plate: tempVehicle.plate!,
      brand: tempVehicle.brand!,
      model: tempVehicle.model || '',
      year: tempVehicle.year || '',
      color: tempVehicle.color || '',
      motorSerial: tempVehicle.motorSerial || '',
      chassisSerial: tempVehicle.chassisSerial || '',
      hasTransferDocuments: tempVehicle.hasTransferDocuments || false
    };

    setNewTp({
      ...newTp,
      vehicles: [...(newTp.vehicles || []), vehicle]
    });

    // Reset vehicle form
    setTempVehicle({ plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false });
    setShowVehicleForm(false);
  };

  const removeVehicle = (plate: string) => {
    setNewTp({
      ...newTp,
      vehicles: newTp.vehicles?.filter(v => v.plate !== plate)
    });
  };



  const getCategoryLabel = (cat?: CommercialCategory) => {
    switch (cat) {
      case CommercialCategory.CLASE_A: return 'Clase A (Alto)';
      case CommercialCategory.CLASE_B: return 'Clase B (Medio)';
      case CommercialCategory.CLASE_C: return 'Clase C (Bajo)';
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

  const totalPaidHistory = taxpayerHistory.reduce((acc, t) => acc + t.amount, 0);

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
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desde: {viewTaxpayer.createdAt}</span>
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
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-8 border-b border-white/5 pb-4">Servicios & Activos Vinculados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className={`p-6 rounded-2xl border ${viewTaxpayer.hasCommercialActivity ? 'bg-white/5 border-indigo-500/30' : 'bg-white/5 border-transparent opacity-30'}`}>
                          <Store className="text-indigo-400 mb-4" size={28} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Actividad Comercial</p>
                          <p className="font-bold text-sm truncate">{viewTaxpayer.commercialName || 'Inactivo'}</p>
                       </div>
                       <div className={`p-6 rounded-2xl border ${viewTaxpayer.hasGarbageService ? 'bg-white/5 border-emerald-500/30' : 'bg-white/5 border-transparent opacity-30'}`}>
                          <Trash2 className="text-emerald-400 mb-4" size={28} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Recolección Basura</p>
                          <p className="font-bold text-sm">{viewTaxpayer.hasGarbageService ? 'Vigente' : 'Inactivo'}</p>
                       </div>
                       <div className="p-6 rounded-2xl bg-white/5 border border-blue-500/30">
                          <Car className="text-blue-400 mb-4" size={28} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vehículos</p>
                          <p className="font-bold text-sm">{viewTaxpayer.vehicles?.length || 0} Registrados</p>
                       </div>
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
                       {Object.entries(viewTaxpayer.documents).map(([key, url]) => (
                         <a
                           key={key}
                           href={url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="group block p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-center"
                         >
                           <div className="w-12 h-12 mx-auto bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 mb-3 transition-colors">
                             {key.includes('photo') || key.includes('sketch') || key.includes('store') ? <ImageIcon size={24} /> : <FileText size={24} />}
                           </div>
                           <p className="text-[10px] font-black text-slate-600 group-hover:text-indigo-800 uppercase tracking-tighter leading-tight">
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
                           <div className="mt-2 text-[8px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Ver Archivo &rarr;</div>
                         </a>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
            </div>

            <div className="p-8 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewTaxpayer(null)}
                className="px-10 py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl active:scale-95"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TOP SEARCH BAR (Sticky) --- */}
      <div id="taxpayer-top" className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200 -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 mb-6">
        <div className="max-w-4xl mx-auto relative">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar contribuyente existente (RUC, Cédula, Nombre)..."
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-full shadow-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-lg transition-all"
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

          {/* Search Dropdown */}
          {isSearching && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in z-50">
              {searchResults.length > 0 ? (
                <>
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                    Resultados Encontrados
                  </div>
                  <ul>
                    {searchResults.map(tp => (
                      <li key={tp.id}>
                        <button
                          onClick={() => {
                            setHistoryTaxpayer(tp);
                            setSearchTerm('');
                            setIsSearching(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            document.documentElement.scrollTop = 0;
                            document.body.scrollTop = 0;
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <div className="font-bold text-slate-800 group-hover:text-indigo-700">{tp.name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span className="font-mono bg-slate-100 px-1 rounded">{tp.docId}</span>
                              <span>• {tp.taxpayerNumber}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditInit(tp);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                document.documentElement.scrollTop = 0;
                                document.body.scrollTop = 0;
                              }}
                              className="text-slate-400 hover:text-indigo-600 flex items-center group/edit"
                              title="Editar Contribuyente"
                            >
                              <Edit size={16} className="mr-1" />
                              <span className="text-xs font-bold underline decoration-transparent group-hover/edit:decoration-indigo-600 transition-all">Editar</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewTaxpayer(tp);
                                setSearchTerm('');
                                setIsSearching(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                document.documentElement.scrollTop = 0;
                                document.body.scrollTop = 0;
                              }}
                              className="text-slate-400 hover:text-blue-600 flex items-center group/view mr-2"
                              title="Ver Ficha Completa"
                            >
                              <FileText size={16} className="mr-1" />
                              <span className="text-xs font-bold underline decoration-transparent group-hover/view:decoration-blue-600 transition-all">Ficha</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistoryTaxpayer(tp);
                                setSearchTerm('');
                                setIsSearching(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                document.documentElement.scrollTop = 0;
                                document.body.scrollTop = 0;
                              }}
                              className="text-slate-400 hover:text-indigo-500 flex items-center"
                            >
                              <span className="text-xs mr-2 font-medium">Historial</span>
                              <History size={16} />
                            </button>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="p-8 text-center bg-white">
                  <AlertCircle size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-slate-600 font-bold">No se encontraron contribuyentes</p>
                  <p className="text-xs text-slate-400 mt-1">Intente con otro nombre, RUC o cédula</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
              {isEditing ? 'Modifique los datos y solicite aprobación.' : 'Ingrese los datos para registrar un nuevo contribuyente.'}
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
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setNewTp({ ...newTp, type: TaxpayerType.NATURAL })}
                className={`flex-1 py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.NATURAL
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                  }`}
              >
                <User size={32} className="mb-2" />
                <span className="text-lg">Persona Natural</span>
              </button>
              <button
                type="button"
                onClick={() => setNewTp({ ...newTp, type: TaxpayerType.JURIDICA, hasCommercialActivity: true })}
                className={`flex-1 py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.JURIDICA
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                  }`}
              >
                <Briefcase size={32} className="mb-2" />
                <span className="text-lg">Persona Jurídica</span>
              </button>
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
                    value={newTp.name} onChange={e => setNewTp({ ...newTp, name: e.target.value })} placeholder="Ej. Juan Pérez o Inversiones del Caribe S.A." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Identificación (Cédula / RUC)</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.docId} onChange={e => setNewTp({ ...newTp, docId: e.target.value })} placeholder={newTp.type === TaxpayerType.NATURAL ? '8-888-888' : '15569-88-99'} />
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
                    value={newTp.address} onChange={e => setNewTp({ ...newTp, address: e.target.value })} placeholder="Provincia, Distrito, Casa..." />
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
                    value={newTp.phone} onChange={e => setNewTp({ ...newTp, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input type="email" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.email} onChange={e => setNewTp({ ...newTp, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Saldo / Deuda Inicial (B/.)</label>
                  <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all text-black text-base"
                    placeholder="0.00"
                    value={newTp.balance || ''}
                    onChange={e => setNewTp({
                      ...newTp,
                      balance: parseFloat(e.target.value),
                      // Auto-set status to MOROSO if balance > 0
                      // status: parseFloat(e.target.value) > 0 ? TaxpayerStatus.MOROSO : newTp.status 
                    })}
                  />
                  <p className="text-xs text-slate-400 mt-1">Si ingresa un monto, el contribuyente será registrado como MOROSO automáticamente si corresponde.</p>
                </div>
              </div>
            </div>

            {/* SECTION 3: SERVICES */}
            <div className="bg-white rounded-2xl">
              <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3 text-slate-600 font-bold text-sm">2</div>
                Servicios y Activos
              </h4>

              <div className="space-y-8">
                {/* 3.1 COMMERCIAL ACTIVITY & OTHERS */}
                {/* Reusing logic but slightly restyled */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <label className="flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-6 h-6 text-indigo-600 rounded focus:ring-indigo-500"
                          checked={newTp.hasCommercialActivity}
                          onChange={(e) => setNewTp({ ...newTp, hasCommercialActivity: e.target.checked })}
                        />
                        <div className="ml-3">
                          <span className="block font-bold text-indigo-900 text-lg">Actividad Comercial</span>
                          <span className="text-indigo-600/70 text-sm">Negocios, tiendas, industrias</span>
                        </div>
                      </label>
                      <Store className="text-indigo-400 w-8 h-8" />
                    </div>

                    {newTp.hasCommercialActivity && (
                      <div className="pl-0 md:pl-9 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in mt-4 border-t border-indigo-200/50 pt-4">
                        <div>
                          <label className="block text-xs font-bold text-indigo-800/60 uppercase mb-1">Nombre Comercial</label>
                          <input type="text" className="w-full p-3 border border-indigo-200 rounded-lg text-black bg-white focus:ring-2 focus:ring-indigo-500"
                            value={newTp.commercialName} onChange={e => setNewTp({ ...newTp, commercialName: e.target.value })} placeholder="Ej. Mini Super El Chino" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-indigo-800/60 uppercase mb-1">Categoría</label>
                          <select
                            className="w-full p-3 border border-indigo-200 rounded-lg bg-white text-black"
                            value={newTp.commercialCategory}
                            onChange={e => setNewTp({ ...newTp, commercialCategory: e.target.value as CommercialCategory })}
                          >
                            <option value={CommercialCategory.NONE}>Seleccionar...</option>
                            <option value={CommercialCategory.CLASE_A}>Clase A (Bancos, Supermercados)</option>
                            <option value={CommercialCategory.CLASE_B}>Clase B (Tiendas, Farmacias)</option>
                            <option value={CommercialCategory.CLASE_C}>Clase C (Kioscos, Buhonería)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Construction */}
                  <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 flex items-center justify-between hover:bg-amber-100/50 transition-colors">
                    <label className="flex items-center cursor-pointer select-none w-full">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                        checked={newTp.hasConstruction}
                        onChange={(e) => setNewTp({ ...newTp, hasConstruction: e.target.checked })}
                      />
                      <div className="ml-3">
                        <span className="block font-bold text-amber-900">Permisos Construcción</span>
                        <span className="text-sm text-amber-700/60">Obras civiles activas</span>
                      </div>
                    </label>
                    <Hammer className="text-amber-400 w-6 h-6" />
                  </div>

                  {/* Garbage */}
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 flex items-center justify-between hover:bg-emerald-100/50 transition-colors">
                    <label className="flex items-center cursor-pointer select-none w-full">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                        checked={newTp.hasGarbageService}
                        onChange={(e) => setNewTp({ ...newTp, hasGarbageService: e.target.checked })}
                      />
                      <div className="ml-3">
                        <span className="block font-bold text-emerald-900">Recolección Basura</span>
                        <span className="text-sm text-emerald-700/60">Servicio activo</span>
                      </div>
                    </label>
                    <Trash2 className="text-emerald-400 w-6 h-6" />
                  </div>
                </div>

                {/* 3.2 VEHICLES */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mt-6 relative">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-200/50 rounded-lg text-blue-600">
                        <Car size={24} />
                      </div>
                      <div>
                        <h5 className="font-bold text-blue-900 text-lg">Parque Vehicular</h5>
                        <p className="text-blue-700/60 text-sm">Gestionar vehículos y traspasos</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowVehicleForm(!showVehicleForm)}
                      className="mt-3 sm:mt-0 px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg font-bold shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center"
                    >
                      {showVehicleForm ? <X size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
                      {showVehicleForm ? 'Cancelar' : 'Agregar Vehículo'}
                    </button>
                  </div>

                  {/* List of added vehicles */}
                  {newTp.vehicles && newTp.vehicles.length > 0 ? (
                    <div className="space-y-3 mb-6">
                      {newTp.vehicles.map((v, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                <Car size={20} />
                              </div>
                              <div>
                                <h6 className="font-bold text-slate-800 text-lg">{v.brand} {v.model}</h6>
                                <p className="text-slate-500 text-sm">Año: {v.year} • Color: {v.color}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="block font-mono font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mb-1">{v.plate}</span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                            <div className="flex gap-2">
                              {/* These buttons are placeholders in 'Creation Mode' mostly, but functional logic remains */}
                              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">VIN: {v.chassisSerial}</span>
                            </div>
                            <button type="button" onClick={() => removeVehicle(v.plate)} className="text-red-500 hover:text-red-700 flex items-center text-sm font-bold bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors">
                              <Trash2 size={16} className="mr-2" /> Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !showVehicleForm && (
                      <div className="text-center py-8 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 text-blue-400 mb-4">
                        <Car size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No hay vehículos registrados.</p>
                      </div>
                    )
                  )}

                  {/* Add Vehicle Sub-Form */}
                  {showVehicleForm && (
                    <div className="bg-white p-6 rounded-xl border-2 border-blue-400 shadow-xl animate-fade-in relative z-10">
                      <h5 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Nuevo Vehículo</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <input type="text" placeholder="Placa (Req)" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.plate} onChange={e => setTempVehicle({ ...tempVehicle, plate: e.target.value.toUpperCase() })} />
                        <input type="text" placeholder="Marca (Req)" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.brand} onChange={e => setTempVehicle({ ...tempVehicle, brand: e.target.value })} />
                        <input type="text" placeholder="Modelo" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.model} onChange={e => setTempVehicle({ ...tempVehicle, model: e.target.value })} />
                        <input type="text" placeholder="Año" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.year} onChange={e => setTempVehicle({ ...tempVehicle, year: e.target.value })} />
                        <input type="text" placeholder="Color" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.color} onChange={e => setTempVehicle({ ...tempVehicle, color: e.target.value })} />
                        <input type="text" placeholder="Serial Motor" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.motorSerial} onChange={e => setTempVehicle({ ...tempVehicle, motorSerial: e.target.value })} />
                        <input type="text" placeholder="Serial Chasis/VIN" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors md:col-span-2" value={tempVehicle.chassisSerial} onChange={e => setTempVehicle({ ...tempVehicle, chassisSerial: e.target.value })} />
                      </div>

                      <label className="flex items-center cursor-pointer mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          checked={tempVehicle.hasTransferDocuments}
                          onChange={(e) => setTempVehicle({ ...tempVehicle, hasTransferDocuments: e.target.checked })}
                        />
                        <span className="ml-3 text-slate-700 font-medium">Documentación de Propiedad / Traspaso en Regla</span>
                      </label>

                      <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setShowVehicleForm(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button>
                        <button type="button" onClick={handleAddVehicle} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transform active:scale-95 transition-all">Agregar Vehículo</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 4: DOCUMENTS (New) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-200 pb-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3 text-slate-600 font-bold text-sm">3</div>
                Documentación y Adjuntos
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Common Documents */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} className="text-indigo-500" /> Foto de Contribuyente
                  </label>
                  <input type="file" accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={e => handleFileChange('taxpayer_photo', e.target.files?.[0] || null)}
                  />
                  {newTp.documents?.['taxpayer_photo'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-indigo-500" /> Foto de Cédula
                  </label>
                  <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={e => handleFileChange('id_card', e.target.files?.[0] || null)}
                  />
                  {newTp.documents?.['id_card'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                </div>

                {/* Juridica */}
                {newTp.type === TaxpayerType.JURIDICA && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm md:col-span-2 lg:col-span-3 lg:w-1/3">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-indigo-500" /> Registro Público (S.A.)
                    </label>
                    <input type="file" accept=".pdf,image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      onChange={e => handleFileChange('public_registry', e.target.files?.[0] || null)}
                    />
                    {newTp.documents?.['public_registry'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                  </div>
                )}

                {/* Commercial */}
                {newTp.hasCommercialActivity && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm ring-1 ring-indigo-50">
                      <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Store size={16} className="text-indigo-500" /> Aviso de Operaciones
                      </label>
                      <input type="file" accept=".pdf,image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('operation_notice', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['operation_notice'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm ring-1 ring-indigo-50">
                      <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <ImageIcon size={16} className="text-indigo-500" /> Foto Frontal Comercio
                      </label>
                      <input type="file" accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => handleFileChange('store_photo', e.target.files?.[0] || null)}
                      />
                      {newTp.documents?.['store_photo'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                    </div>
                  </>
                )}

                {/* Garbage */}
                {newTp.hasGarbageService && (
                  <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm ring-1 ring-emerald-50">
                    <label className="block text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
                      <MapPin size={16} className="text-emerald-500" /> Croquis Dirección (Residencial)
                    </label>
                    <input type="file" accept="image/*,.pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      onChange={e => handleFileChange('residence_sketch', e.target.files?.[0] || null)}
                    />
                    {newTp.documents?.['residence_sketch'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                  </div>
                )}

                {/* Vehicles */}
                {(newTp.vehicles && newTp.vehicles.length > 0) && (
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm ring-1 ring-blue-50 md:col-span-2">
                    <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <Car size={16} className="text-blue-500" /> Traspaso / Registro Único Vehicular
                    </label>
                    <input type="file" accept="image/*,.pdf" multiple className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      onChange={e => handleFileChange('vehicle_docs', e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Puede subir uno o varios documentos para los vehículos.</p>
                    {newTp.documents?.['vehicle_docs'] && <span className="text-xs text-green-600 font-bold mt-1 block">✔ Ya cargado</span>}
                  </div>
                )}
              </div>
            </div>
            
            {/* SECTION 5: EDIT REASON (Only in Edit Mode) */}
            {isEditing && (
              <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 mt-6 animate-fade-in">
                <h4 className="text-lg font-bold text-amber-800 mb-4 flex items-center">
                  <ShieldAlert size={20} className="mr-2" /> Justificación de la Edición
                </h4>
                <p className="text-sm text-amber-700 mb-3 font-medium">
                  Este cambio requiere aprobación del administrador. Explique el motivo de la modificación:
                </p>
                <textarea
                  required
                  className="w-full border-2 border-amber-200 rounded-xl p-4 focus:ring-4 focus:ring-amber-100 focus:border-amber-500 transition-all text-black text-base min-h-[100px]"
                  placeholder="Ej: Se corrige el nombre según cédula física adjunta..."
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                />
              </div>
            )}

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
                    <CheckCircle className="mr-2" size={20} />
                    {isEditing ? 'Guardar Cambios' : 'Registrar Contribuyente'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};