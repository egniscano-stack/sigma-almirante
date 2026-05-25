import React, { useState, useMemo } from 'react';
import { 
    Building2, Search, UserPlus, MapPin, DollarSign, FileText, CheckCircle2, Clock, 
    ArrowRight, Loader2, Sparkles, PlusCircle, AlertCircle, Info
} from 'lucide-react';
import { Taxpayer, AdminRequest, User, RequestStatus } from '../types';

interface IngenieriaDashboardProps {
    currentUser: User;
    taxpayers: Taxpayer[];
    adminRequests: AdminRequest[];
    onCreateRequest: (req: AdminRequest) => Promise<void>;
    onRefresh?: () => void;
}

type EngineeringChargeType = 
    | 'PERMISO_CONSTRUCCION' 
    | 'PERMISO_OCUPACION' 
    | 'CERTIFICACION_OCUPACION' 
    | 'EXTRACCION_BALASTRE' 
    | 'ABONO_LOTE' 
    | 'CERTIFICACION_RESIDENCIA'
    | 'APROBACION_PLANOS'
    | 'APROBACION_ANTEPROYECTO'
    | 'MULTA'
    | 'OTROS';

const CHARGE_LABELS: Record<EngineeringChargeType, string> = {
    PERMISO_CONSTRUCCION: 'Permiso de Construcción',
    PERMISO_OCUPACION: 'Permiso de Ocupación',
    CERTIFICACION_OCUPACION: 'Certificación de Ocupación',
    EXTRACCION_BALASTRE: 'Extracción de Balastre',
    ABONO_LOTE: 'Abono a Lote No.',
    CERTIFICACION_RESIDENCIA: 'Certificación de Residencia',
    APROBACION_PLANOS: 'Aprobación de Planos',
    APROBACION_ANTEPROYECTO: 'Aprobación de Anteproyecto',
    MULTA: 'Multa',
    OTROS: 'Otros Impuestos / Tasas'
};

type FineType = 
    | '01_IMPUESTOS_MOROSOS'
    | '02_ADMINISTRATIVAS'
    | '03_LEGAL'
    | '04_JUZGADO_DE_PAZ'
    | '05_MULTAS_INGENIERIA'
    | '06_MAL_ESTACIONADO'
    | '07_RUIDO'
    | '08_PLACAS_VENCIDAS'
    | '09_RECARGOS_MOROSOS';

const FINE_LABELS: Record<FineType, string> = {
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

export const IngenieriaDashboard: React.FC<IngenieriaDashboardProps> = ({
    currentUser,
    taxpayers,
    adminRequests,
    onCreateRequest,
    onRefresh
}) => {
    // Form States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTaxpayer, setSelectedTaxpayer] = useState<Taxpayer | null>(null);
    const [isManualPayer, setIsManualPayer] = useState(false);
    
    // Form Fields
    const [manualName, setManualName] = useState('');
    const [manualDocId, setManualDocId] = useState('');
    const [chargeType, setChargeType] = useState<EngineeringChargeType>('PERMISO_CONSTRUCCION');
    const [location, setLocation] = useState('');
    const [price, setPrice] = useState<number>(0);
    const [description, setDescription] = useState('');
    
    // Dynamic Fields
    const [lotNo, setLotNo] = useState('');
    const [ballastVolume, setBallastVolume] = useState('');
    const [otherDetails, setOtherDetails] = useState('');
    const [fineType, setFineType] = useState<FineType>('05_MULTAS_INGENIERIA');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Filter taxpayers for search
    const filteredTaxpayers = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        return taxpayers.filter(t => 
            t && (
                (t.name && t.name.toLowerCase().includes(query)) || 
                (t.docId && t.docId.toLowerCase().includes(query)) ||
                (t.taxpayerNumber && t.taxpayerNumber.toLowerCase().includes(query))
            )
        ).slice(0, 5);
    }, [searchQuery, taxpayers]);

    // Get engineering requests submitted by current user or all engineering requests
    const recentRequests = useMemo(() => {
        return adminRequests
            .filter(r => r.type === 'INGENIERIA_COBRO')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [adminRequests]);

    const handleSelectTaxpayer = (tp: Taxpayer) => {
        setSelectedTaxpayer(tp);
        setIsManualPayer(false);
        setSearchQuery('');
        // Autofill address if exists
        if (tp.address) {
            setLocation(tp.address);
        }
    };

    const validateForm = () => {
        const errs: Record<string, string> = {};
        
        if (!isManualPayer && !selectedTaxpayer) {
            errs.taxpayer = 'Debe seleccionar un contribuyente o activar el ingreso manual';
        }
        
        if (isManualPayer) {
            if (!manualName.trim()) errs.manualName = 'Nombre completo requerido';
            if (!manualDocId.trim()) errs.manualDocId = 'Cédula o RUC requerido';
        }

        if (!location.trim()) errs.location = 'La ubicación es requerida';
        if (price <= 0) errs.price = 'El precio/monto debe ser mayor a 0';
        if (!description.trim()) errs.description = 'La descripción del trabajo o proyecto es requerida';

        if (chargeType === 'ABONO_LOTE' && !lotNo.trim()) {
            errs.lotNo = 'El número de lote es requerido';
        }
        if (chargeType === 'EXTRACCION_BALASTRE' && !ballastVolume.trim()) {
            errs.ballastVolume = 'El volumen o descripción de extracción es requerido';
        }
        if (chargeType === 'OTROS' && !otherDetails.trim()) {
            errs.otherDetails = 'La descripción detallada es requerida';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMsg(null);

        if (!validateForm()) return;

        setIsSubmitting(true);

        try {
            // Build dynamic description
            let finalDesc = '';
            if (chargeType === 'ABONO_LOTE') {
                finalDesc = `Abono a Lote No: ${lotNo}. Ubicación: ${location}.`;
            } else if (chargeType === 'EXTRACCION_BALASTRE') {
                finalDesc = `Extracción de Balastre: ${ballastVolume}. Ubicación: ${location}.`;
            } else if (chargeType === 'MULTA') {
                finalDesc = `Multa: ${FINE_LABELS[fineType]}. Ubicación: ${location}.`;
            } else if (chargeType === 'OTROS') {
                finalDesc = `${otherDetails}. Ubicación: ${location}.`;
            } else {
                finalDesc = `${CHARGE_LABELS[chargeType]} en ${location}.`;
            }
            if (description.trim()) {
                finalDesc += ` Notas: ${description}`;
            }

            const payerName = isManualPayer ? manualName.toUpperCase() : (selectedTaxpayer?.name || '');
            const payerDoc = isManualPayer ? manualDocId.toUpperCase() : (selectedTaxpayer?.docId || '');

            const request: AdminRequest = {
                id: `ENG-${Date.now()}`,
                type: 'INGENIERIA_COBRO',
                status: 'PENDING',
                requesterName: currentUser.name || currentUser.username,
                taxpayerName: payerName,
                taxpayerId: !isManualPayer && selectedTaxpayer ? selectedTaxpayer.id : undefined,
                description: finalDesc,
                totalDebt: price,
                payload: {
                    engineeringType: chargeType,
                    fineType: chargeType === 'MULTA' ? fineType : undefined,
                    location,
                    price,
                    taxpayerDocId: payerDoc,
                    lotNo: chargeType === 'ABONO_LOTE' ? lotNo : undefined,
                    ballastVolume: chargeType === 'EXTRACCION_BALASTRE' ? ballastVolume : undefined,
                    otherDetails: chargeType === 'OTROS' ? otherDetails : undefined
                },
                createdAt: new Date().toISOString()
            };

            await onCreateRequest(request);

            setSuccessMsg(`¡Cobro por B/. ${price.toFixed(2)} enviado a caja con éxito!`);
            
            // Reset fields
            setSelectedTaxpayer(null);
            setIsManualPayer(false);
            setManualName('');
            setManualDocId('');
            setLocation('');
            setPrice(0);
            setDescription('');
            setLotNo('');
            setBallastVolume('');
            setOtherDetails('');
            setFineType('05_MULTAS_INGENIERIA');
            setErrors({});

            // Play quick success sound if allowed
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
            audio.volume = 0.2;
            audio.play().catch(() => {});

        } catch (error: any) {
            console.error('Error submitting engineering charge:', error);
            alert(`Error al registrar cobro: ${error.message || 'Error desconocido'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-24 space-y-8 animate-fade-in">
            {/* Header section with rich gradient */}
            <div className="bg-gradient-to-r from-sky-900 via-sky-850 to-indigo-950 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-sky-700/30">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-sky-500/20 rounded-2xl border border-sky-400/20 shadow-inner">
                        <Building2 size={36} className="text-sky-300 animate-pulse" />
                    </div>
                    <div>
                        <p className="text-sky-300 text-xs font-black uppercase tracking-[0.2em]">Dirección de Ingeniería Municipal</p>
                        <h2 className="text-3xl font-black tracking-tight mt-0.5">Gestión de Tasas y Permisos</h2>
                    </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 flex flex-col items-end">
                    <span className="text-[10px] text-sky-200 uppercase font-black tracking-widest">Funcionario Activo</span>
                    <span className="font-extrabold text-white text-base mt-0.5">{currentUser.name}</span>
                </div>
            </div>

            {/* Dashboard Form & Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to submit new engineering charge */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <PlusCircle className="text-sky-600" size={20} />
                            Registrar Nuevo Cobro Municipal
                        </h3>

                        {successMsg && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 animate-scale-up">
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={22} />
                                <span className="text-sm font-bold">{successMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Payer selection */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        Contribuyente
                                    </label>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setIsManualPayer(!isManualPayer);
                                            setSelectedTaxpayer(null);
                                            setErrors({});
                                        }}
                                        className="text-xs font-black text-sky-600 hover:text-sky-800 uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                    >
                                        <UserPlus size={14} />
                                        {isManualPayer ? 'Buscar Registrado' : 'Ingresar No Registrado'}
                                    </button>
                                </div>

                                {isManualPayer ? (
                                    /* Manual Input Mode */
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-scale-up">
                                        <div className="col-span-1 md:col-span-2">
                                            <p className="text-[10px] text-amber-600 font-bold mb-3 flex items-center gap-1">
                                                <Info size={12} /> Contribuyente no registrado en el padrón municipal. Se requiere ingreso manual.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre Completo / Razón Social</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={manualName} 
                                                onChange={e => setManualName(e.target.value.toUpperCase())}
                                                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium outline-none focus:border-sky-500" 
                                                placeholder="Ej. JUAN PEREZ"
                                            />
                                            {errors.manualName && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.manualName}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cédula / RUC</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={manualDocId} 
                                                onChange={e => setManualDocId(e.target.value.toUpperCase())}
                                                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium outline-none focus:border-sky-500" 
                                                placeholder="Ej. 1-234-5678"
                                            />
                                            {errors.manualDocId && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.manualDocId}</p>}
                                        </div>
                                    </div>
                                ) : (
                                    /* Search mode */
                                    <div className="space-y-3">
                                        {!selectedTaxpayer ? (
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input 
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:border-sky-500 text-sm font-medium transition-all"
                                                    placeholder="Buscar por RUC/Cédula, nombre o Nº contribuyente..."
                                                />
                                                {errors.taxpayer && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.taxpayer}</p>}

                                                {/* Search results dropdown */}
                                                {filteredTaxpayers.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 mt-1.5 overflow-hidden animate-scale-up">
                                                        {filteredTaxpayers.map(tp => (
                                                            <button
                                                                key={tp.id}
                                                                type="button"
                                                                onClick={() => handleSelectTaxpayer(tp)}
                                                                className="w-full px-5 py-3 hover:bg-sky-50 flex items-center justify-between text-left border-b border-slate-100 last:border-b-0 group transition-all"
                                                            >
                                                                <div>
                                                                    <p className="font-extrabold text-slate-800 text-sm group-hover:text-sky-700 transition-colors uppercase">{tp.name}</p>
                                                                    <p className="text-xs text-slate-500 mt-0.5">Identificación: <span className="font-mono font-bold text-slate-700">{tp.docId}</span> {tp.taxpayerNumber && `• N°: ${tp.taxpayerNumber}`}</p>
                                                                </div>
                                                                <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 group-hover:text-sky-600 transition-all" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Selected taxpayer card */
                                            <div className="bg-sky-50/50 border border-sky-100 p-5 rounded-2xl flex items-center justify-between animate-scale-up">
                                                <div>
                                                    <span className="text-[9px] bg-sky-650 text-white font-black px-2 py-0.5 rounded-md uppercase tracking-wider">Contribuyente Seleccionado</span>
                                                    <h4 className="font-black text-slate-800 text-base mt-2 uppercase">{selectedTaxpayer.name}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5">ID: <span className="font-mono font-bold text-slate-700">{selectedTaxpayer.docId}</span> • N° Contribuyente: <span className="font-mono text-slate-700">{selectedTaxpayer.taxpayerNumber || 'N/A'}</span></p>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setSelectedTaxpayer(null)}
                                                    className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors bg-white hover:bg-red-50 p-2 rounded-xl border border-slate-200/60"
                                                >
                                                    Cambiar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Charge inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tipo de Cobro</label>
                                    <select 
                                        value={chargeType}
                                        onChange={e => {
                                            setChargeType(e.target.value as EngineeringChargeType);
                                            setErrors({});
                                        }}
                                        className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-bold outline-none focus:border-sky-500 cursor-pointer"
                                    >
                                        {Object.entries(CHARGE_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Monto / Precio (B/.)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            value={price > 0 ? price : ''}
                                            onChange={e => setPrice(Number(e.target.value))}
                                            className="w-full pl-10 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-850 text-base font-black outline-none focus:border-sky-500 text-sky-700"
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                    {errors.price && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.price}</p>}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ubicación (Lugar del hecho / Obra)</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text"
                                            value={location}
                                            onChange={e => setLocation(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium outline-none focus:border-sky-500"
                                            placeholder="Ej. Calle Central, Barrio Francés, Lote 12"
                                            required
                                        />
                                    </div>
                                    {errors.location && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.location}</p>}
                                </div>

                                {/* Dynamic fields depending on charge type */}
                                {chargeType === 'ABONO_LOTE' && (
                                    <div className="md:col-span-2 bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl animate-scale-up space-y-2">
                                        <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">Número de Lote Municipal</label>
                                        <input 
                                            type="text"
                                            value={lotNo}
                                            onChange={e => setLotNo(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold outline-none focus:border-sky-500"
                                            placeholder="Ej. Lote No. 24-B"
                                            required
                                        />
                                        {errors.lotNo && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.lotNo}</p>}
                                    </div>
                                )}

                                {chargeType === 'EXTRACCION_BALASTRE' && (
                                    <div className="md:col-span-2 bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl animate-scale-up space-y-2">
                                        <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">Detalles de Extracción (Volumen en m³ / Camiones)</label>
                                        <input 
                                            type="text"
                                            value={ballastVolume}
                                            onChange={e => setBallastVolume(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold outline-none focus:border-sky-500"
                                            placeholder="Ej. 12 Metros Cúbicos (2 Camiones de 6m³)"
                                            required
                                        />
                                        {errors.ballastVolume && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.ballastVolume}</p>}
                                    </div>
                                )}

                                {chargeType === 'MULTA' && (
                                    <div className="md:col-span-2 bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl animate-scale-up space-y-2">
                                        <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">Tipo de Multa</label>
                                        <select 
                                            value={fineType}
                                            onChange={e => setFineType(e.target.value as FineType)}
                                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold outline-none focus:border-sky-500 cursor-pointer"
                                        >
                                            {Object.entries(FINE_LABELS).map(([val, label]) => (
                                                <option key={val} value={val}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {chargeType === 'OTROS' && (
                                    <div className="md:col-span-2 bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl animate-scale-up space-y-2">
                                        <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">Detalle del Impuesto o Tasa cobrada</label>
                                        <textarea 
                                            rows={2}
                                            value={otherDetails}
                                            onChange={e => setOtherDetails(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold outline-none focus:border-sky-500"
                                            placeholder="Ej. Cobro de permiso por instalación de vallas publicitarias temporales."
                                            required
                                        />
                                        {errors.otherDetails && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.otherDetails}</p>}
                                    </div>
                                )}

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descripción del Trabajo / Proyecto (Impreso en Factura)</label>
                                    <textarea 
                                        rows={4}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold outline-none focus:border-sky-500"
                                        placeholder="Describa detalladamente los trabajos, dimensiones o especificaciones del proyecto. Esta información se autocompletará en el sistema de la cajera para que no tenga que escribir casi nada, y se imprimirá en la factura oficial del contribuyente..."
                                        required
                                    />
                                    {errors.description && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.description}</p>}
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-650 to-indigo-650 hover:from-sky-700 hover:to-indigo-700 text-white font-black text-base shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Enviando cobro a caja...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        ENVIAR COBRO A CAJA AHORA
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right side: list of recently submitted charges and sync status */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <Clock className="text-sky-600 animate-pulse" size={18} />
                                Cobros Recientes
                            </h3>
                            {onRefresh && (
                                <button 
                                    onClick={onRefresh}
                                    className="text-xs font-bold text-slate-400 hover:text-sky-600 transition-colors"
                                >
                                    Actualizar
                                </button>
                            )}
                        </div>

                        {recentRequests.length === 0 ? (
                            <div className="text-center py-10 space-y-2">
                                <AlertCircle className="text-slate-300 mx-auto" size={36} />
                                <p className="text-sm font-bold text-slate-400">No se han registrado cobros recientemente.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                                {recentRequests.slice(0, 8).map(req => {
                                    const payload = req.payload || {};
                                    const engType = payload.engineeringType as EngineeringChargeType;
                                    const dateStr = new Date(req.createdAt).toLocaleDateString('es-ES', { 
                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                    });

                                    return (
                                        <div 
                                            key={req.id} 
                                            className={`p-4 rounded-2xl border transition-all hover:scale-[1.01] ${
                                                req.status === 'APPROVED' 
                                                    ? 'bg-emerald-500/5 border-emerald-500/15' 
                                                    : 'bg-amber-500/5 border-amber-500/15'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                                        req.status === 'APPROVED' 
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                    }`}>
                                                        {req.status === 'APPROVED' ? 'Cobrado' : 'Pendiente'}
                                                    </span>
                                                    <h4 className="font-extrabold text-slate-800 text-sm mt-2 uppercase">{req.taxpayerName}</h4>
                                                    <p className="text-xs font-black text-slate-500 mt-1">{CHARGE_LABELS[engType] || 'Cobro de Ingeniería'}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                                        <MapPin size={10} /> {payload.location}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-800 text-base">B/. {req.totalDebt?.toFixed(2)}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold mt-1">{dateStr}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
