import React, { useMemo, useState } from 'react';
import { Taxpayer, Transaction, TaxType } from '../types';
import { Search, Filter, Download, FileText, CheckCircle, AlertCircle, Clock, Trash2, ChevronDown, ChevronRight, Edit, History, ArrowRight, Calendar, Car, Store, RefreshCw } from 'lucide-react';
import { calculateTaxpayerDebt } from '../services/debtLogic';
import taxStructureRaw from '../data/taxStructure.json';

interface DebtsProps {
  taxpayers: Taxpayer[];
  transactions: Transaction[];
  onGoToPay: (taxpayer: Taxpayer) => void;
  userRole?: string;
  config: any; // Add config to detect rates
  onRefresh?: () => void;
  isLoading?: boolean;
}

interface PendingSummary {
  taxpayer: Taxpayer;
  debtCount: number;
  isOverdue: boolean;
  earliestDueDate: string;
  totalAmount: number;
}

export const Debts: React.FC<DebtsProps> = ({ taxpayers, transactions, onGoToPay, userRole, config, onRefresh, isLoading }) => {
  const taxStructure = config?.customTaxStructure && config.customTaxStructure.length > 0
    ? [
        ...config.customTaxStructure,
        ...taxStructureRaw.filter((raw: any) => !config.customTaxStructure.some((custom: any) => custom.code === raw.code))
      ]
    : taxStructureRaw;
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'PENDING' | 'HISTORY'>('PENDING'); // PENDING or HISTORY

  // History Filters
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'PLACA' | 'COMERCIO' | 'ASEO'>('ALL');

  // --- LOGIC 1: CALCULATE PENDING DEBTS (CURRENT) ---
  const pendingSummaries = useMemo(() => {
    return taxpayers.map(tp => {
      const { items, total } = calculateTaxpayerDebt(tp, transactions, config);
      
      if (items.length === 0) return null;

      const isOverdue = items.some(d => {
        if (d.type === 'DEUDA_ARRAS') return true;
        if (d.metadata?.month && d.metadata?.year) {
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();
          if (d.metadata.year < currentYear) return true;
          if (d.metadata.year === currentYear && d.metadata.month < currentMonth) return true;
          if (d.metadata.year === currentYear && d.metadata.month === currentMonth && now.getDate() > 15) return true;
        }
        return false;
      });

      // Find earliest date
      let earliest = '9999-12-31';
      items.forEach(d => {
        if (d.metadata?.month && d.metadata?.year) {
          const dateStr = `${d.metadata.year}-${d.metadata.month.toString().padStart(2, '0')}-01`;
          if (dateStr < earliest) earliest = dateStr;
        }
      });

      return {
        taxpayer: tp,
        debtCount: items.length,
        isOverdue,
        earliestDueDate: earliest === '9999-12-31' ? 'Saldo Anterior' : earliest,
        totalAmount: total
      };
    }).filter((item): item is PendingSummary => item !== null);
  }, [taxpayers, transactions, config]);

  // --- FILTERING LOGIC ---
  const filteredSummaries = pendingSummaries.filter(item => {
    const matchesSearch = item.taxpayer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.taxpayer.docId.includes(searchTerm);
    
    if (!matchesSearch) return false;

    if (activityFilter === 'ALL') return true;
    
    const { items } = calculateTaxpayerDebt(item.taxpayer, transactions, config);
    if (activityFilter === 'PLACA') return items.some(d => d.type === TaxType.VEHICULO);
    if (activityFilter === 'COMERCIO') return items.some(d => d.type === TaxType.COMERCIO);
    if (activityFilter === 'ASEO') return items.some(d => d.type === TaxType.BASURA);
    
    return true;
  });

  const filteredHistory = transactions.filter(t => {
    const matchSearch = searchTerm === '' ||
      taxpayers.find(tp => tp.id === t.taxpayerId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.includes(searchTerm);

    const tDate = new Date(t.date);
    const matchDate = (tDate.getMonth() + 1 === historyMonth) && (tDate.getFullYear() === historyYear);

    return matchSearch && matchDate;
  });

  return (
    <div className="space-y-6 pb-20 animate-fade-in">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestión de Cobros</h2>
          <p className="text-slate-500 text-sm">Control de obligaciones y verificaciones</p>
        </div>

        {/* VIEW TOGGLE */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('PENDING')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${viewMode === 'PENDING' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <AlertCircle size={16} className="mr-2" /> Deudas Actuales
          </button>
          <button
            onClick={() => setViewMode('HISTORY')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${viewMode === 'HISTORY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <History size={16} className="mr-2" /> Historial / Reclamos
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar contribuyente por nombre, cédula o ID..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm md:text-base outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value as any)}
            className="p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-bold text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todas las Actividades</option>
            <option value="PLACA">Solo Placas</option>
            <option value="COMERCIO">Solo Comercio</option>
            <option value="ASEO">Solo Aseo</option>
          </select>

          {viewMode === 'HISTORY' && (
            <div className="flex gap-2">
              <select
                value={historyMonth}
                onChange={(e) => setHistoryMonth(parseInt(e.target.value))}
                className="p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' })}</option>
                ))}
              </select>
              <select
                value={historyYear}
                onChange={(e) => setHistoryYear(parseInt(e.target.value))}
                className="p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                {[2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT: VIEW 1 - PENDING DEBTS */}
      {viewMode === 'PENDING' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
          {isLoading ? (
             <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                <RefreshCw size={48} className="text-emerald-500 animate-spin opacity-50" />
                <p className="text-slate-500 font-bold animate-pulse">Sincronizando deudas...</p>
             </div>
          ) : filteredSummaries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Contribuyente</th>
                    <th className="px-6 py-4 font-semibold">Concepto / Deuda</th>
                    <th className="px-6 py-4 font-semibold text-center">Estado</th>
                    <th className="px-6 py-4 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSummaries.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{item.taxpayer.name}</div>
                        <div className="text-xs text-slate-500 font-mono">ID: {item.taxpayer.docId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex flex-col items-center justify-center bg-slate-50 w-10 h-10 rounded-lg border border-slate-200 mr-3">
                             <span className="text-lg font-black text-slate-800 leading-none">{item.debtCount}</span>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-slate-700 leading-tight">Concepto(s)</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Pendiente(s)</p>
                          </div>
                        </div>
                        <div className="text-[10px] text-red-500 font-bold mt-1">
                          Total: B/. {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(item.totalAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.isOverdue ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle size={12} className="mr-1" /> Moroso
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Calendar size={12} className="mr-1" /> Por Vencer
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">Más antiguo: {item.earliestDueDate}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {userRole !== 'AUDITOR' && (
                          <button
                            onClick={() => onGoToPay(item.taxpayer)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center transition-all active:scale-95 shadow-sm"
                          >
                            Ir a Caja <ArrowRight size={14} className="ml-1" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
              <div className="bg-emerald-50 p-4 rounded-full mb-4">
                <CheckCircle size={48} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">¡Al día!</h3>
              <p className="max-w-md mt-2 text-sm">No se encontraron deudas pendientes con los filtros aplicados.</p>
            </div>
          )}
        </div>
      )}

      {/* CONTENT: VIEW 2 - HISTORY / CLAIMS */}
      {viewMode === 'HISTORY' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-blue-50 border-b border-blue-100">
            <h3 className="text-sm font-bold text-blue-800 flex items-center">
              <FileText size={16} className="mr-2" /> Facturas y Pagos Registrados ({filteredHistory.length})
            </h3>
          </div>
          {filteredHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Recibo #</th>
                    <th className="px-6 py-3">Contribuyente</th>
                    <th className="px-6 py-3">Descripción</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                    <th className="px-6 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredHistory.map((tx, idx) => (
                    <tr key={`${tx.id}-${idx}`} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-500">{tx.date}</td>
                      <td className="px-6 py-4 font-mono text-slate-600">{tx.id}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {taxpayers.find(t => t.id === tx.taxpayerId)?.name || 'Desconocido'}
                      </td>
                      <td className="px-6 py-4">{tx.description}</td>
                      <td className="px-6 py-4 text-right font-bold">B/. {tx.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">
              <History size={48} className="mx-auto mb-4 opacity-20" />
              <p>No se encontraron registros para el periodo seleccionado.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};