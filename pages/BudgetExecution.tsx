import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, DollarSign, Wallet, FileSpreadsheet, Scale, 
  Landmark, Calendar, Download, RefreshCw, FileText, 
  CheckCircle2, Search, Edit3, Check, X, Eye, ArrowUpRight, BarChart3, Plus, ArrowRight
} from 'lucide-react';
import { Transaction, Taxpayer, TaxConfig, TaxType } from '../types';
import budgetAllMonthsRaw from '../data/budget_execution_all_months.json';

// Cast the imported raw json to a typed structure
interface RawBudgetItem {
  codigo: string;
  detalle: string;
  presupuestoLey: number;
  ajustes: number;
  presupuestoModificado: number;
  saldoALaFecha: number;
  ingresosAlMes: number;
  ingresosAlTrimestre: number;
  ingresosALaFecha: number;
  saldo: number;
}

const budgetAllMonths = budgetAllMonthsRaw as Record<string, RawBudgetItem[]>;

interface BudgetExecutionProps {
  transactions: Transaction[];
  taxpayers: Taxpayer[];
  config: TaxConfig;
  onRefresh?: () => void;
}

// Spanish Month mappings
const MONTHS = [
  { name: 'ENERO 2026', label: 'Enero' },
  { name: 'FEBRERO 2026', label: 'Febrero' },
  { name: 'MARZO 2026', label: 'Marzo' },
  { name: 'ABRIL 2026', label: 'Abril' },
  { name: 'MAYO 2026', label: 'Mayo (Proyección)' },
  { name: 'JUNIO 2026', label: 'Junio (Proyección)' },
  { name: 'JULIO 2026', label: 'Julio (Proyección)' },
  { name: 'AGOSTO 2026', label: 'Agosto (Proyección)' },
  { name: 'SEPTIEMBRE 2026', label: 'Septiembre (Proyección)' },
  { name: 'OCTUBRE 2026', label: 'Octubre (Proyección)' },
  { name: 'NOVIEMBRE 2026', label: 'Noviembre (Proyección)' },
  { name: 'DICIEMBRE 2026', label: 'Diciembre (Proyección)' }
];

// Main Categories Mapping for Filters
const CATEGORIES = [
  { id: 'ALL', label: 'Todas las Partidas' },
  { id: '1.1.2.5.', label: 'Actividades Comerciales' },
  { id: '1.1.2.6.', label: 'Actividades Industriales' },
  { id: '1.1.2.8.', label: 'Impuestos Indirectos' },
  { id: '1.2.1.', label: 'Rentas de Activos & Ventas' },
  { id: '1.2.4.', label: 'Tasas y Derechos' },
  { id: '1.2.6.', label: 'Ingresos Varios' },
  { id: 'OTHER', label: 'Otros Recusos' }
];

/**
 * Robust logic to map a transaction dynamically to a budget line item code
 */
export const mapTransactionToBudgetCode = (tx: Transaction, taxpayers: Taxpayer[]): string => {
  // 1. BASURA -> 1.2.1.4.02 (ASEO Y RECOLECCIÒN DE BASURA)
  if (tx.taxType === TaxType.BASURA) {
    return '1.2.1.4.02';
  }

  // 2. CONSTRUCCION -> 1.1.2.8.04 (EDIFICACIONES Y REEDIFICACIONES)
  if (tx.taxType === TaxType.CONSTRUCCION) {
    return '1.1.2.8.04';
  }

  // 3. VEHICULO -> CIRCULACION DE VEHICULOS or PLACAS
  if (tx.taxType === TaxType.VEHICULO) {
    const desc = tx.description ? tx.description.toUpperCase() : '';
    if (desc.includes('PLACA') || desc.includes('METALICA')) {
      return '1.2.1.3.08'; // PLACAS (VENTAS DE BIENES)
    }
    if (desc.includes('COMERCIAL') || desc.includes('TRANSPORTE') || desc.includes('BUS')) {
      return '1.1.2.8.12'; // CIRCULACION DE VEHICULOS COMERCIALES
    }
    return '1.1.2.8.11'; // CIRCULACION DE VEHICULOS PARTICULARES
  }

  // 4. PAZ Y SALVO -> REFRENDO or EXPEDICION
  if (tx.taxType === TaxType.PAZ_Y_SALVO || (tx.description && tx.description.toUpperCase().includes('PAZ Y SALVO'))) {
    return '1.2.4.2.21'; // REFRENDO DE DOCUMENTOS
  }

  // 5. COMERCIO -> Match standard commercial activity codes
  if (tx.taxType === TaxType.COMERCIO || (tx.description && tx.description.toUpperCase().includes('COMER'))) {
    // Find taxpayer
    const tp = taxpayers.find(t => t.id === tx.taxpayerId);
    if (tp && tp.selectedTaxCodes && tp.selectedTaxCodes.length > 0) {
      // e.g. "11.25.05"
      const commCode = tp.selectedTaxCodes.find(c => c.startsWith('11.'));
      if (commCode) {
        // Convert to budget sheet code:
        // "11.25.xx" -> "1.1.2.5.xx"
        // "11.26.xx" -> "1.1.2.6.xx"
        if (commCode.startsWith('11.25.')) {
          return '1.1.2.5.' + commCode.slice(6);
        }
        if (commCode.startsWith('11.26.')) {
          return '1.1.2.6.' + commCode.slice(6);
        }
      }
    }

    // Fallback descriptions
    const desc = tx.description ? tx.description.toUpperCase() : '';
    if (desc.includes('LICOR') || desc.includes('BEBIDA') || desc.includes('ALCOHOL')) {
      return '1.1.2.5.06'; // ESTABLEC. DE VTAS DE LICOR AL MENOR
    }
    if (desc.includes('ROTULO') || desc.includes('ANUNCIO') || desc.includes('AVISO')) {
      return '1.1.2.5.30'; // ROTULOS ANUNCIOS Y AVISO
    }
    if (desc.includes('FUMIGA')) {
      return '1.1.2.5.65'; // SERVICIOS DE FUMIGACION
    }
    if (desc.includes('HOTEL') || desc.includes('HOSPEDA')) {
      return '1.1.2.5.43'; // HOTELES Y MOTELES
    }
    if (desc.includes('DISCO') || desc.includes('BAILE')) {
      return '1.1.2.5.23'; // DISCOTECAS
    }
    if (desc.includes('BANCO') || desc.includes('CAMBIO')) {
      return '1.1.2.5.25'; // BANCOS (if in budget, let's map generic to retail)
    }

    return '1.1.2.5.05'; // ESTABL. DE VTAS . AL POR MENOR (Default)
  }

  // 6. Generic Text Match Fallbacks
  const desc = tx.description ? tx.description.toUpperCase() : '';
  if (desc.includes('MULTA') || desc.includes('RECARGO') || desc.includes('INTERE')) {
    return '1.2.6.0.01'; // MULTAS, RECARGOS E INTERESES
  }
  if (desc.includes('VIGENCIA') || desc.includes('EXPIRADA') || desc.includes('DEUDA')) {
    return '1.2.6.0.10'; // VIGENCIAS EXPIRADA
  }
  if (desc.includes('CARNET')) {
    return '1.2.4.2.23'; // EXPEDICION DE CARNET
  }
  if (desc.includes('EXTRACCION') || desc.includes('ARENA')) {
    return '1.2.4.1.09'; // EXTRACCIÒN DE ARENA
  }
  if (desc.includes('PIQUERA')) {
    return '1.2.4.1.25'; // SERVICIOS DE PIQUERA
  }

  return '1.2.6.0.99'; // OTROS INGRESOS VARIOS (Default global)
};

export const BudgetExecution: React.FC<BudgetExecutionProps> = ({
  transactions,
  taxpayers,
  config,
  onRefresh
}) => {
  // States
  const [selectedMonth, setSelectedMonth] = useState<string>('ENERO 2026');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Custom Adjustments (edited by user dynamically, key: budget_code, val: adjustment_amount)
  const [customAdjustments, setCustomAdjustments] = useState<Record<string, number>>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Selected Budget Line for Detail Modal/Slide-over
  const [selectedDetailCode, setSelectedDetailCode] = useState<string | null>(null);

  // 1. Fetch base budget rows for the selected month
  const baseBudgetRows = useMemo(() => {
    // If the month sheet exists in Excel, load it.
    // Otherwise, load ENERO 2026 as base structure and reset values to 0.
    const monthSheetName = selectedMonth;
    if (budgetAllMonths[monthSheetName]) {
      return budgetAllMonths[monthSheetName].map(item => ({ ...item }));
    } else {
      const base = budgetAllMonths['ENERO 2026'] || [];
      return base.map(item => ({
        ...item,
        ingresosAlMes: 0,
        ingresosAlTrimestre: 0,
        ingresosALaFecha: 0,
        saldo: item.presupuestoLey // Reset to initial ley
      }));
    }
  }, [selectedMonth]);

  // 2. Compute dynamic actuals by matching live transactions
  const processedBudgetRows = useMemo(() => {
    // Get month details
    const monthIndex = MONTHS.findIndex(m => m.name === selectedMonth);
    const monthNum = monthIndex !== -1 ? monthIndex + 1 : 1; // 1-indexed

    // Filter paid transactions for year 2026
    const paid2026Txs = transactions.filter(t => {
      if (t.status !== 'PAGADO') return false;
      const txDate = new Date(t.date);
      // Make sure the transaction is in 2026
      return txDate.getFullYear() === 2026;
    });

    // Map each transaction to its mapped budget code and group them
    const monthlyTotals: Record<string, number> = {};
    const quarterlyTotals: Record<string, number> = {};
    const ytdTotals: Record<string, number> = {};
    
    // Track details per code for audit modal
    const codeTxsMap: Record<string, Transaction[]> = {};

    paid2026Txs.forEach(tx => {
      const txDate = new Date(tx.date);
      const txMonth = txDate.getMonth() + 1; // 1-indexed
      const code = mapTransactionToBudgetCode(tx, taxpayers);

      // Initialize audit list
      if (!codeTxsMap[code]) codeTxsMap[code] = [];
      
      // Accumulate YTD (up to current selected month)
      if (txMonth <= monthNum) {
        ytdTotals[code] = (ytdTotals[code] || 0) + tx.amount;
        codeTxsMap[code].push(tx);
      }

      // Accumulate Monthly (exactly matches selected month)
      if (txMonth === monthNum) {
        monthlyTotals[code] = (monthlyTotals[code] || 0) + tx.amount;
      }

      // Accumulate Quarterly (same quarter as selected month)
      const currentQuarter = Math.ceil(monthNum / 3);
      const txQuarter = Math.ceil(txMonth / 3);
      if (txQuarter === currentQuarter && txMonth <= monthNum) {
        quarterlyTotals[code] = (quarterlyTotals[code] || 0) + tx.amount;
      }
    });

    // Compile ultimate budget lines incorporating live database transactions
    return baseBudgetRows.map(row => {
      const code = row.codigo;

      // Check if there are live transactions for this code
      const liveMonthly = monthlyTotals[code] || 0;
      const liveQuarterly = quarterlyTotals[code] || 0;
      const liveYtd = ytdTotals[code] || 0;

      // Determine the final values:
      // If we have live transactions, we sum them.
      // If we don't have live transactions, we fallback to the Excel sheet's numbers
      // to keep a realistic demonstration, but prioritising live transactions!
      const finalMonthly = liveMonthly > 0 ? liveMonthly : row.ingresosAlMes;
      const finalYtd = liveYtd > 0 ? liveYtd : row.ingresosALaFecha;
      const finalQuarterly = liveQuarterly > 0 ? liveQuarterly : (row.ingresosAlTrimestre || 0);

      // Layer custom Adjustments edited by the user
      const userAdjustment = customAdjustments[code] !== undefined ? customAdjustments[code] : row.ajustes;
      const finalModifiedBudget = row.presupuestoLey + userAdjustment;
      
      const finalSaldo = finalModifiedBudget - finalYtd;
      const execRate = finalModifiedBudget > 0 ? Math.min(150, Math.round((finalYtd / finalModifiedBudget) * 100)) : 0;

      return {
        ...row,
        ajustes: userAdjustment,
        presupuestoModificado: finalModifiedBudget,
        ingresosAlMes: finalMonthly,
        ingresosAlTrimestre: finalQuarterly,
        ingresosALaFecha: finalYtd,
        saldo: finalSaldo,
        execRate
      };
    });
  }, [baseBudgetRows, transactions, taxpayers, selectedMonth, customAdjustments]);

  // 3. Audit details for the selected budget row modal
  const selectedDetailTransactions = useMemo(() => {
    if (!selectedDetailCode) return [];
    const monthIndex = MONTHS.findIndex(m => m.name === selectedMonth);
    const monthNum = monthIndex !== -1 ? monthIndex + 1 : 1;

    return transactions.filter(t => {
      if (t.status !== 'PAGADO') return false;
      const date = new Date(t.date);
      if (date.getFullYear() !== 2026) return false;
      
      const txMonth = date.getMonth() + 1;
      if (txMonth > monthNum) return false; // YTD limit

      const code = mapTransactionToBudgetCode(t, taxpayers);
      return code === selectedDetailCode;
    });
  }, [selectedDetailCode, transactions, taxpayers, selectedMonth]);

  // 4. Summaries and KPI computations
  const kpis = useMemo(() => {
    let totalLey = 0;
    let totalAjustes = 0;
    let totalModificado = 0;
    let totalMes = 0;
    let totalYtd = 0;

    processedBudgetRows.forEach(row => {
      // Sum only terminal detail codes (nodes that have 2 levels or subcodes like "1.1.2.5.01" rather than headers like "1.1.2.5.")
      // A quick check is if the code is a header (ends with a dot like "1.1.2.5.")
      const isHeader = row.codigo.endsWith('.');
      if (!isHeader) {
        totalLey += row.presupuestoLey;
        totalAjustes += row.ajustes;
        totalModificado += row.presupuestoModificado;
        totalMes += row.ingresosAlMes;
        totalYtd += row.ingresosALaFecha;
      }
    });

    const executionPercentage = totalModificado > 0 ? Math.round((totalYtd / totalModificado) * 100) : 0;
    const remainingBalance = totalModificado - totalYtd;

    return {
      totalLey,
      totalAjustes,
      totalModificado,
      totalMes,
      totalYtd,
      executionPercentage,
      remainingBalance
    };
  }, [processedBudgetRows]);

  // 5. Apply filters & Search queries
  const filteredRows = useMemo(() => {
    return processedBudgetRows.filter(row => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'OTHER') {
          // Items that don't belong to standard major groups
          const belongsToMajor = ['1.1.2.5.', '1.1.2.6.', '1.1.2.8.', '1.2.1.', '1.2.4.', '1.2.6.'].some(cat => row.codigo.startsWith(cat));
          if (belongsToMajor) return false;
        } else {
          // Standard major groups
          if (!row.codigo.startsWith(selectedCategory)) return false;
        }
      }

      // Search term filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const codeMatches = row.codigo.toLowerCase().includes(query);
        const detailMatches = row.detalle.toLowerCase().includes(query);
        if (!codeMatches && !detailMatches) return false;
      }

      return true;
    });
  }, [processedBudgetRows, selectedCategory, searchTerm]);

  // Adjustments Editing Handlers
  const startEdit = (code: string, currentVal: number) => {
    setEditingCode(code);
    setEditValue(currentVal.toString());
  };

  const saveEdit = (code: string) => {
    const numericVal = parseFloat(editValue);
    if (!isNaN(numericVal)) {
      setCustomAdjustments(prev => ({
        ...prev,
        [code]: numericVal
      }));
    }
    setEditingCode(null);
  };

  const cancelEdit = () => {
    setEditingCode(null);
  };

  return (
    <div className="space-y-8 pb-24 px-2 select-none">
      {/* Dynamic Glow background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-emerald-100/50 blur-[130px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-teal-100/50 blur-[130px]"></div>
      </div>

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-600">
            Ejecución Presupuestaria de Ingresos
          </h2>
          <p className="text-slate-500 font-medium text-lg">
            Control dinámico de rentas del Municipio de Almirante - Vigencia Fiscal 2026
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-2xl shadow-xl transition-all duration-300 active:scale-95 text-sm"
            >
              <RefreshCw size={16} />
              <span>Sincronizar Cajas</span>
            </button>
          )}
          <button
            onClick={() => {
              alert('Exportando Ejecución Presupuestaria en Formato Excel Oficial...');
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-2xl shadow-xl transition-all duration-300 active:scale-95 text-sm"
          >
            <FileSpreadsheet size={16} />
            <span>Exportar Excel Oficial</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI: Presupuesto Modificado */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <Landmark size={24} />
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase">Meta Modificada</span>
          </div>
          <h3 className="text-2xl font-black text-slate-950">
            B/. {kpis.totalModificado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Presupuesto Ley + Ajustes
          </p>
        </div>

        {/* KPI: Recaudado Mensual */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
              <DollarSign size={24} />
            </div>
            <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-3 py-1 rounded-full uppercase">Recaudado del Mes</span>
          </div>
          <h3 className="text-2xl font-black text-slate-950">
            B/. {kpis.totalMes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Cobrado en Cajas o Portales
          </p>
        </div>

        {/* KPI: Recaudado YTD Accumulado */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full uppercase">Recaudado YTD</span>
          </div>
          <h3 className="text-2xl font-black text-slate-950">
            B/. {kpis.totalYtd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full" 
                style={{ width: `${kpis.executionPercentage}%` }} 
              />
            </div>
            <span className="text-[10px] font-bold text-indigo-600">{kpis.executionPercentage}%</span>
          </div>
        </div>

        {/* KPI: Saldo por Recaudar */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
              <Scale size={24} />
            </div>
            <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-3 py-1 rounded-full uppercase">Saldo Pendiente</span>
          </div>
          <h3 className="text-2xl font-black text-slate-950">
            B/. {kpis.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Balance Restante de Meta
          </p>
        </div>
      </div>

      {/* Filters and Month selector panel */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-100 shadow-md flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          {/* Month Selector dropdown */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <Calendar size={18} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Mes del Presupuesto</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-extrabold text-slate-900 border-none outline-none cursor-pointer focus:ring-0 w-full"
              >
                {MONTHS.map(m => (
                  <option key={m.name} value={m.name} className="font-sans font-semibold text-slate-800">
                    {m.label} 2026
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search bar & Category select */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
            
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar código o detalle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Refresh indicators */}
            <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl flex items-center gap-2 font-bold justify-center">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>
              <span>Sincronizado en Vivo</span>
            </div>

          </div>
        </div>

        {/* Category Pills Filters */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-all uppercase ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Budget Grid Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-center">Detalles</th>
                <th className="px-4 py-5">Código</th>
                <th className="px-6 py-5">Detalle / Partida</th>
                <th className="px-4 py-5 text-right">Presupuesto Ley</th>
                <th className="px-4 py-5 text-center w-28">Ajustes</th>
                <th className="px-4 py-5 text-right">Modificado</th>
                <th className="px-4 py-5 text-right text-teal-600 bg-teal-50/20 font-black">Recaudado Mes</th>
                <th className="px-4 py-5 text-right">Recaudado Trimestre</th>
                <th className="px-4 py-5 text-right text-indigo-600 bg-indigo-50/20 font-black">YTD Acumulado</th>
                <th className="px-4 py-5 text-right">Saldo Restante</th>
                <th className="px-6 py-5 text-center">% Ejec.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRows.length > 0 ? (
                filteredRows.map(row => {
                  const isHeader = row.codigo.endsWith('.');
                  const isEditing = editingCode === row.codigo;

                  return (
                    <tr 
                      key={row.codigo} 
                      className={`transition-colors hover:bg-slate-50/50 ${
                        isHeader 
                          ? 'bg-slate-50/60 font-extrabold text-slate-900 border-y border-slate-200/50' 
                          : 'text-slate-700'
                      }`}
                    >
                      {/* 1. Action eye icon to see child list if not a header */}
                      <td className="px-6 py-4 text-center">
                        {!isHeader && (
                          <button
                            onClick={() => setSelectedDetailCode(row.codigo)}
                            title="Ver desglose de pagos en cajas para este código"
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm active:scale-90"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                      </td>

                      {/* 2. Budget Code */}
                      <td className={`px-4 py-4 font-mono text-xs ${isHeader ? 'font-black text-slate-900' : 'text-slate-500 font-bold'}`}>
                        {row.codigo}
                      </td>

                      {/* 3. Detail name */}
                      <td className={`px-6 py-4 max-w-xs truncate ${isHeader ? 'tracking-wide' : 'font-medium'}`}>
                        {row.detalle}
                      </td>

                      {/* 4. Presupuesto Ley */}
                      <td className="px-4 py-4 text-right font-bold text-slate-900">
                        {row.presupuestoLey > 0 ? `B/. ${row.presupuestoLey.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* 5. Ajustes (Interactive edit) */}
                      <td className="px-4 py-4 text-center">
                        {isHeader ? (
                          <span className="font-bold text-slate-800">
                            {row.ajustes !== 0 ? `B/. ${row.ajustes.toLocaleString('en-US')}` : '-'}
                          </span>
                        ) : isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-20 px-2 py-1 text-xs border border-emerald-500 rounded bg-white text-slate-800 font-bold outline-none text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(row.codigo);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            <button
                              onClick={() => saveEdit(row.codigo)}
                              className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 bg-rose-500 text-white rounded hover:bg-rose-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 justify-center group/edit">
                            <span className={`font-medium ${row.ajustes > 0 ? 'text-emerald-600 font-bold' : row.ajustes < 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                              {row.ajustes !== 0 ? `B/. ${row.ajustes.toLocaleString()}` : '0.00'}
                            </span>
                            <button
                              onClick={() => startEdit(row.codigo, row.ajustes)}
                              className="p-1 opacity-0 group-hover/edit:opacity-100 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-all"
                              title="Editar ajuste"
                            >
                              <Edit3 size={11} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 6. Presupuesto Modificado */}
                      <td className="px-4 py-4 text-right font-black text-slate-900">
                        {row.presupuestoModificado > 0 ? `B/. ${row.presupuestoModificado.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* 7. Ingresos al Mes */}
                      <td className="px-4 py-4 text-right text-teal-600 font-bold bg-teal-50/10">
                        {row.ingresosAlMes > 0 ? `B/. ${row.ingresosAlMes.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* 8. Ingresos al Trimestre */}
                      <td className="px-4 py-4 text-right text-slate-600">
                        {row.ingresosAlTrimestre > 0 ? `B/. ${row.ingresosAlTrimestre.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* 9. Ingresos a la Fecha YTD */}
                      <td className="px-4 py-4 text-right text-indigo-600 font-black bg-indigo-50/10">
                        {row.ingresosALaFecha > 0 ? `B/. ${row.ingresosALaFecha.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* 10. Saldo Restante */}
                      <td className="px-4 py-4 text-right font-semibold text-slate-700">
                        {row.saldo !== 0 ? `B/. ${row.saldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* 11. Ejecucion Rate bar */}
                      <td className="px-6 py-4 text-center">
                        {row.presupuestoModificado > 0 ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-black text-slate-800">{row.execRate}%</span>
                            <div className="w-16 bg-slate-100 rounded-full h-1 overflow-hidden border border-slate-200/50">
                              <div 
                                className={`h-full rounded-full ${row.execRate >= 100 ? 'bg-emerald-500' : row.execRate >= 50 ? 'bg-indigo-500' : row.execRate > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                                style={{ width: `${Math.min(100, row.execRate)}%` }} 
                              />
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    Ninguna partida presupuestaria coincide con los filtros especificados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Slide-over / Modal panel */}
      {selectedDetailCode && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Overlay background */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSelectedDetailCode(null)}
          />

          {/* Slider Panel container */}
          <div className="relative w-full max-w-2xl bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 transform transition-transform duration-300 animate-slide-in">
            {/* Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black tracking-widest bg-emerald-500/25 text-emerald-400 px-3 py-1 rounded-full uppercase">
                  Auditoría de Caja y Recaudación
                </span>
                <h3 className="text-xl font-bold mt-2">Partida {selectedDetailCode}</h3>
                <p className="text-slate-400 text-xs mt-1">
                  {processedBudgetRows.find(r => r.codigo === selectedDetailCode)?.detalle}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDetailCode(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Stat card */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Total Recaudado en SIGMA (2026 YTD)</span>
                  <span className="text-3xl font-black text-emerald-400 mt-1 block">
                    B/. {selectedDetailTransactions.reduce((a, b) => a + b.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                  <DollarSign size={28} />
                </div>
              </div>

              {/* Transactions list */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Recibos de Pago Conciliados</h4>
                
                {selectedDetailTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDetailTransactions.map(tx => {
                      const tpName = taxpayers.find(t => t.id === tx.taxpayerId)?.name || 'Cobro General de Caja';
                      return (
                        <div 
                          key={tx.id} 
                          className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors flex justify-between items-center gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{tpName}</span>
                              <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                                #{tx.id.slice(-6).toUpperCase()}
                              </span>
                            </div>
                            <p className="text-slate-400 text-xs">{tx.description || 'Sin concepto de pago'}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              <span>{tx.date} • {tx.time}</span>
                              <span>•</span>
                              <span>Método: {tx.paymentMethod}</span>
                              <span>•</span>
                              <span>Cajero: {tx.tellerName}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-emerald-400">
                              B/. {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">CONCILIADO</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                    <FileText className="mx-auto text-slate-700 mb-3" size={32} />
                    <p className="text-slate-500 font-semibold text-sm">Sin transacciones registradas en cajas para esta partida</p>
                    <p className="text-slate-600 text-xs mt-1 px-8 leading-relaxed">
                      La recaudación que se muestra en la tabla se deriva de las cifras históricas consolidadas del libro de ingresos provisto por el municipio.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-950 border-t border-slate-800 text-center">
              <button 
                onClick={() => setSelectedDetailCode(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
