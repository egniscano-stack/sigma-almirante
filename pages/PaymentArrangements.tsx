import React, { useState, useMemo } from 'react';
import { 
  Search, User, MapPin, DollarSign, Calendar, AlertCircle, 
  CheckCircle, ArrowRight, TrendingUp, Receipt, ShieldCheck, 
  Clock, Sparkles, Scale, RefreshCw, XCircle
} from 'lucide-react';
import { Taxpayer, Transaction, TaxConfig, PaymentArrangement } from '../types';
import { calculateTaxpayerDebt } from '../services/debtLogic';

interface PaymentArrangementsProps {
  taxpayers: Taxpayer[];
  transactions: Transaction[];
  config: TaxConfig;
  onUpdateTaxpayer: (taxpayer: Taxpayer) => Promise<Taxpayer>;
}

export const PaymentArrangements: React.FC<PaymentArrangementsProps> = ({
  taxpayers,
  transactions,
  config,
  onUpdateTaxpayer
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState<string | null>(null);
  const [abonoInput, setAbonoInput] = useState<string>('0');
  const [cuotasInput, setCuotasInput] = useState<number>(12);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. FILTER TAXPAYERS BY SEARCH QUERY
  const filteredTaxpayers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return taxpayers.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.docId.toLowerCase().includes(query) ||
      (t.taxpayerNumber && t.taxpayerNumber.toLowerCase().includes(query))
    );
  }, [taxpayers, searchQuery]);

  // 2. SELECTED TAXPAYER OBJECT
  const selectedTaxpayer = useMemo(() => {
    return taxpayers.find(t => t.id === selectedTaxpayerId) || null;
  }, [taxpayers, selectedTaxpayerId]);

  // 3. LIVE MOROSIDAD (DEBT) CALCULATION FOR SELECTED TAXPAYER
  const liveDebt = useMemo(() => {
    if (!selectedTaxpayer) return { total: 0, items: [] };
    // Compute debt normally using debt logic
    return calculateTaxpayerDebt(selectedTaxpayer, transactions, config);
  }, [selectedTaxpayer, transactions, config]);

  // 4. COMPUTATIONS FOR THE NEW CONVENIO
  const totalAdeudado = liveDebt.total;
  const abono = parseFloat(abonoInput) || 0;
  const balanceRestante = Math.max(0, totalAdeudado - abono);
  const montoCuota = cuotasInput > 0 ? balanceRestante / cuotasInput : 0;

  // 5. HANDLE CREATING ARREGLO DE PAGO
  const handleCreateArrangement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaxpayer) return;

    if (totalAdeudado <= 0) {
      setErrorMessage('El contribuyente no presenta morosidad para refinanciar.');
      return;
    }

    if (abono < 0) {
      setErrorMessage('El monto de abono inicial no puede ser negativo.');
      return;
    }

    if (abono > totalAdeudado) {
      setErrorMessage('El abono inicial no puede ser mayor que la deuda total.');
      return;
    }

    if (cuotasInput < 1 || cuotasInput > 48) {
      setErrorMessage('La cantidad de cuotas debe estar entre 1 y 48 meses.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const newArrangement: PaymentArrangement = {
        id: crypto.randomUUID(),
        totalDebt: totalAdeudado,
        abono: abono,
        balanceRestante: balanceRestante,
        cuotasTotales: cuotasInput,
        cuotasPagadas: 0,
        montoCuota: montoCuota,
        fechaCreacion: new Date().toISOString().split('T')[0],
        estado: 'ACTIVO',
        // Mark down payment as paid immediately if they input 0, or false if it needs to be collected
        abonoPagado: abono === 0
      };

      const updatedTaxpayer = {
        ...selectedTaxpayer,
        paymentArrangement: newArrangement,
        // Optional: transition status if desired
        status: selectedTaxpayer.status === 'MOROSO' ? 'ACTIVO' : selectedTaxpayer.status
      };

      await onUpdateTaxpayer(updatedTaxpayer);

      setSuccessMessage(`Arreglo de Pago generado exitosamente para ${selectedTaxpayer.name}.`);
      setAbonoInput('0');
      setCuotasInput(12);
    } catch (err: any) {
      console.error('Error creating payment arrangement:', err);
      setErrorMessage('Ocurrió un error al guardar el Arreglo de Pago. Intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // 6. CANCEL ACTIVE ARRANGEMENT
  const handleCancelArrangement = async () => {
    if (!selectedTaxpayer || !selectedTaxpayer.paymentArrangement) return;
    if (!window.confirm('¿Está seguro de que desea rescindir este Arreglo de Pago? Se reactivarán todas las morosidades pendientes.')) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedTaxpayer = {
        ...selectedTaxpayer,
        paymentArrangement: undefined // Remove arrangement
      };

      await onUpdateTaxpayer(updatedTaxpayer);
      setSuccessMessage(`El convenio de pago de ${selectedTaxpayer.name} ha sido cancelado.`);
    } catch (err: any) {
      console.error('Error cancelling payment arrangement:', err);
      setErrorMessage('Ocurrió un error al cancelar el Arreglo de Pago.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10 pb-24 px-2 animate-fade-in">
      {/* Background blobs for premium glassmorphism */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[20%] left-[-10%] w-[45%] h-[45%] rounded-full bg-emerald-100/50 blur-[130px]"></div>
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-50/50 blur-[120px]"></div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full text-xs font-black uppercase tracking-widest mb-2">
            <Scale size={14} /> Módulo Administrativo
          </div>
          <h2 className="text-4xl font-black tracking-tighter text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-emerald-600">
            Arreglos de Pago
          </h2>
          <p className="text-slate-500 font-medium text-lg">Financiación y Refinanciación de Deudas Municipales</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Search & Select Taxpayer */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white bg-opacity-80 backdrop-blur-md p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40">
            <h3 className="text-lg font-black text-slate-800 tracking-tight mb-4 flex items-center gap-2">
              <Search size={18} className="text-emerald-500" />
              Buscar Contribuyente
            </h3>
            
            <div className="relative mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre, Cédula / RUC, o Placa..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold transition-all text-sm"
              />
              <Search size={18} className="absolute left-4 top-3.5 text-slate-400" />
            </div>

            {/* Results list */}
            {filteredTaxpayers.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredTaxpayers.map((t) => {
                  const isSelected = t.id === selectedTaxpayerId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTaxpayerId(t.id);
                        setSuccessMessage(null);
                        setErrorMessage(null);
                        // Reset abono
                        setAbonoInput('0');
                      }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                          : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className={`font-black text-xs uppercase tracking-wider ${isSelected ? 'text-white' : 'text-slate-800 group-hover:text-emerald-600'}`}>
                          {t.name}
                        </p>
                        <p className={`text-[10px] font-mono ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          RUC/Cédula: {t.docId} {t.taxpayerNumber ? `• Nº ${t.taxpayerNumber}` : ''}
                        </p>
                      </div>
                      <ArrowRight size={16} className={`transition-transform duration-300 ${isSelected ? 'translate-x-1 text-white' : 'text-slate-300 group-hover:translate-x-1 group-hover:text-emerald-500'}`} />
                    </button>
                  );
                })}
              </div>
            ) : searchQuery.trim() ? (
              <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">
                Sin resultados encontrados
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
                  <User size={20} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest max-w-[200px] mx-auto">
                  Ingrese un término para buscar
                </p>
              </div>
            )}
          </div>

          {/* Selected Taxpayer Overview */}
          {selectedTaxpayer && (
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all"></div>
              
              <div>
                <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-1">Contribuyente Seleccionado</h4>
                <h3 className="text-xl font-black tracking-tight">{selectedTaxpayer.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">ID: {selectedTaxpayer.docId}</p>
              </div>

              <div className="space-y-3 text-xs pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Número Municipio</span>
                  <span className="font-bold text-slate-100">{selectedTaxpayer.taxpayerNumber || 'No Asignado'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Corregimiento</span>
                  <span className="font-bold text-slate-100 flex items-center gap-1">
                    <MapPin size={12} className="text-emerald-400" />
                    {selectedTaxpayer.corregimiento || 'No Definido'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Estado</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    selectedTaxpayer.status === 'MOROSO' 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-emerald-500 text-white'
                  }`}>
                    {selectedTaxpayer.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE & RIGHT COLUMN: Active Agreement OR Live Debt & Creation Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Notifications */}
          {successMessage && (
            <div className="bg-emerald-500 border border-emerald-400 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-emerald-500/10">
              <CheckCircle size={20} className="shrink-0 animate-bounce" />
              <p className="text-sm font-black">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-500 border border-rose-400 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-rose-500/10">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-black">{errorMessage}</p>
            </div>
          )}

          {!selectedTaxpayer ? (
            <div className="bg-white bg-opacity-60 backdrop-blur-md border border-dashed border-slate-200 p-20 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-emerald-500">
                <Receipt size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Gestión de Convenios</h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                Seleccione un contribuyente en el panel lateral para generar un nuevo Arreglo de Pago o administrar su acuerdo activo.
              </p>
            </div>
          ) : selectedTaxpayer.paymentArrangement ? (
            /* TAXPAYER ALREADY HAS AN ACTIVE PAYMENT ARRANGEMENT */
            <div className="space-y-6">
              <div className="bg-white bg-opacity-80 backdrop-blur-md p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40 space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5">
                      <ShieldCheck size={12} /> Convenio Vigente
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Arreglo de Pago Activo</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Código Convenio: {selectedTaxpayer.paymentArrangement.id.slice(-8).toUpperCase()}</p>
                  </div>
                  
                  <div className="px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm animate-pulse">
                    {selectedTaxpayer.paymentArrangement.estado}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Progreso de Cuotas</span>
                    <span className="font-black text-slate-800">
                      {selectedTaxpayer.paymentArrangement.cuotasPagadas} de {selectedTaxpayer.paymentArrangement.cuotasTotales} Meses
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/50">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-indigo-600 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${(selectedTaxpayer.paymentArrangement.cuotasPagadas / selectedTaxpayer.paymentArrangement.cuotasTotales) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Arrangement numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Deuda Consolidada</span>
                    <p className="text-2xl font-black text-slate-800">
                      B/. {selectedTaxpayer.paymentArrangement.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Abono Inicial</span>
                    <p className="text-2xl font-black text-slate-800">
                      B/. {selectedTaxpayer.paymentArrangement.abono.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      {selectedTaxpayer.paymentArrangement.abonoPagado ? (
                        <span className="block text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">✓ Cobrado en Caja</span>
                      ) : (
                        <span className="block text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">⌛ Pendiente Pago</span>
                      )}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Cuota Mensual</span>
                    <p className="text-2xl font-black text-emerald-600">
                      B/. {selectedTaxpayer.paymentArrangement.montoCuota.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-xs space-y-2 text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-bold">Fecha de Firma:</span>
                    <span className="font-black text-slate-800">{selectedTaxpayer.paymentArrangement.fechaCreacion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Balance Pendiente por Financiar:</span>
                    <span className="font-black text-slate-800">B/. {selectedTaxpayer.paymentArrangement.balanceRestante.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Cuotas Restantes:</span>
                    <span className="font-black text-slate-800">
                      {selectedTaxpayer.paymentArrangement.cuotasTotales - selectedTaxpayer.paymentArrangement.cuotasPagadas} cuotas
                    </span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <p className="text-xs font-medium text-slate-400">
                    Las cuotas del arreglo se suman automáticamente al cobro en caja del contribuyente.
                  </p>
                  <button
                    onClick={handleCancelArrangement}
                    disabled={isSaving}
                    className="group bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-md shadow-red-500/10 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    <span>Rescindir Convenio</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAXPAYER HAS NO ARRANGEMENT YET: SHOW LIVE DEBTS AND ARRANGEMENT FORM */
            <div className="space-y-8">
              
              {/* Deuda Consolidada Preview */}
              <div className="bg-white bg-opacity-80 backdrop-blur-md p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Morosidad Consolidada</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Rubros que se incluirán en el convenio</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-black text-rose-500">
                      B/. {totalAdeudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Moroso</span>
                  </div>
                </div>

                {liveDebt.items.length > 0 ? (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {liveDebt.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-black text-slate-800">{item.label}</span>
                          <p className="text-[10px] font-medium text-slate-400">{item.description}</p>
                        </div>
                        <span className="font-black text-slate-900">
                          B/. {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-widest">
                    El contribuyente está al día, no hay deudas para refinanciar.
                  </div>
                )}
              </div>

              {/* Form to generate new Payment Arrangement */}
              {totalAdeudado > 0 && (
                <form onSubmit={handleCreateArrangement} className="bg-white bg-opacity-80 backdrop-blur-md p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40 space-y-8">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight pb-4 border-b border-slate-100 flex items-center gap-2">
                    <Sparkles size={20} className="text-emerald-500" />
                    Generar Convenio de Pago
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Input Down Payment (Abono) */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Abono Inicial (Down Payment)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={totalAdeudado}
                          value={abonoInput}
                          onChange={(e) => setAbonoInput(e.target.value)}
                          placeholder="Monto de abono inicial..."
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold transition-all text-sm"
                        />
                        <DollarSign size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Depósito que el contribuyente pagará inmediatamente en caja para activar el convenio.
                      </p>
                    </div>

                    {/* Input Number of Installments (Cuotas) */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Cantidad de Cuotas (Meses)</label>
                      <div className="relative">
                        <select
                          value={cuotasInput}
                          onChange={(e) => setCuotasInput(parseInt(e.target.value))}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold transition-all text-sm appearance-none"
                        >
                          {[2, 3, 4, 6, 8, 10, 12, 18, 24, 30, 36, 48].map((c) => (
                            <option key={c} value={c}>{c} Meses ({c} Cuotas)</option>
                          ))}
                        </select>
                        <Calendar size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        El número de meses acordados para cancelar el saldo refinanciado.
                      </p>
                    </div>
                  </div>

                  {/* Financing breakdown visualization */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Resumen Financiero del Convenio</h4>
                    
                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span className="font-bold">Monto Total de Morosidad:</span>
                        <span className="font-mono font-black text-slate-800">
                          B/. {totalAdeudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="font-bold">Abono Inicial Pactado:</span>
                        <span className="font-mono font-black text-rose-500">
                          - B/. {abono.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2.5 border-t border-slate-200 text-slate-800">
                        <span className="font-bold">Balance Neto a Financiar:</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          B/. {balanceRestante.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pt-3.5 border-t border-slate-200 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                        <div className="space-y-0.5">
                          <span className="font-black text-emerald-800 text-sm uppercase tracking-wider block">Cuota Mensual Resultante</span>
                          <span className="text-[10px] text-emerald-600 font-medium block">
                            Sumada automáticamente a las actividades recurrentes
                          </span>
                        </div>
                        <span className="font-mono font-black text-2xl text-emerald-600">
                          B/. {montoCuota.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="group bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Guardando Convenio...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
                          <span>Generar Convenio de Pago</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
