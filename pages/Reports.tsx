import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { Transaction, TaxType, User, Taxpayer, Corregimiento, TaxConfig, CommercialCategory } from '../types';
import { Download, FileText, TrendingUp, Calendar, Filter, User as UserIcon, Printer, PieChart as PieChartIcon, Map as MapIcon, X, Clock } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import taxStructureRaw from '../data/taxStructure.json';

// Helper to format currency with thousands separator (1,000.00)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

interface ReportsProps {
  transactions: Transaction[];
  users: User[];
  currentUser: User;
  taxpayers: Taxpayer[];
  config: TaxConfig;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Reports: React.FC<ReportsProps> = ({ transactions, users, currentUser, taxpayers, config }) => {
  const taxStructure = config?.customTaxStructure || taxStructureRaw;
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [selectedTeller, setSelectedTeller] = React.useState('ALL');
  const [showPreviewModal, setShowPreviewModal] = React.useState(false);
  const [previewType, setPreviewType] = React.useState<'ARQUEO' | 'GENERAL' | null>(null);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // New Report Filters
  const [reportSubFilter, setReportSubFilter] = React.useState<'TODOS' | 'CORREGIMIENTO' | 'ACTIVIDAD'>('TODOS');
  const [filterCorregimiento, setFilterCorregimiento] = React.useState<Corregimiento | 'ALL'>('ALL');
  const [filterActivity, setFilterActivity] = React.useState<TaxType | 'ALL'>('ALL');

  const getPaymentMethodLabel = (method: string) => {
    if (!method) return 'Efectivo';
    const m = method.toUpperCase();
    if (m === 'EFECTIVO') return 'Efectivo';
    if (m.includes('TARJETA')) return 'Tarjeta';
    if (m.includes('ONLINE') || m.includes('YAPPY') || m.includes('TRANSFERENCIA') || m.includes('ACH')) return 'Online';
    return 'Efectivo';
  };

  // --- Data Processing ---
  const stats = useMemo(() => {
    // 1. Filter Data based on UI State
    const filtered = transactions.reduce((acc: Transaction[], t) => {
      const matchDate = t.date >= startDate && t.date <= endDate;
      const matchTeller = selectedTeller === 'ALL' || t.tellerName === selectedTeller;
      
      if (!matchDate || !matchTeller) return acc;

      // Activity filtering: Extract ONLY the relevant portion of consolidated payments
      if (reportSubFilter === 'ACTIVIDAD' && filterActivity !== 'ALL') {
        const searchTerms = filterActivity.toUpperCase();
        
        // Match by formal type OR if the description contains the name (useful for Paz y Salvo)
        if (t.taxType === filterActivity || t.description?.toUpperCase().includes(searchTerms)) {
          acc.push(t);
        } else if (t.metadata?.isConsolidated && t.metadata?.originalItems) {
          const matchingItems = t.metadata.originalItems.filter((item: any) => 
            item.type === filterActivity || item.label?.toUpperCase().includes(filterActivity.toUpperCase())
          );
          
          if (matchingItems.length > 0) {
            const partialAmount = matchingItems.reduce((sum: number, item: any) => sum + item.amount, 0);
            acc.push({
              ...t,
              amount: partialAmount,
              taxType: filterActivity, // Ensure the virtual tx matches the filter type for labels
              description: `${t.description} (PARTE ${filterActivity})`,
              metadata: { ...t.metadata, isConsolidated: false, originalItems: matchingItems }
            });
          }
        }
        return acc;
      }

      // Corregimiento filtering
      if (reportSubFilter === 'CORREGIMIENTO' && filterCorregimiento !== 'ALL') {
        const tp = taxpayers.find(tp => tp.id === t.taxpayerId);
        if (tp?.corregimiento === filterCorregimiento) acc.push(t);
        return acc;
      }

      // Global Case
      acc.push(t);
      return acc;
    }, []);

    const workingSet = filtered;

    const totalRevenue = workingSet.reduce((acc, t) => acc + t.amount, 0); // Voids are negative, so they subtract automatically
    const avgTicket = totalRevenue / (workingSet.filter(t => t.status === 'PAGADO').length || 1);
    const paidTransactions = workingSet.filter(t => t.status === 'PAGADO').length;

    // Group by Tax Type (COMERCIOS, PLACAS, CONSTRUCCIÓN, EVENTOS ESPECIALES)
    let comercios = 0;
    let placas = 0;
    let construccion = 0;
    let eventos = 0;

    workingSet.forEach(t => {
      if (t.status !== 'PAGADO') return;
      const amount = t.amount;
      if (t.metadata?.chargeType === 'EVENTO' || t.description?.includes('EVENTO ESPECIAL')) {
        eventos += amount;
      } else if (t.taxType === 'VEHICULO') {
        placas += amount;
      } else if (t.taxType === 'CONSTRUCCION') {
        construccion += amount;
      } else {
        comercios += amount;
      }
    });

    const byTypeData = [
      { name: 'COMERCIOS', value: comercios },
      { name: 'PLACAS', value: placas },
      { name: 'CONSTRUCCIÓN', value: construccion },
      { name: 'EVENTOS ESPECIALES', value: eventos }
    ].filter(v => v.value > 0); 

    // Group by Date 
    const byDateMap = new Map<string, number>();
    const sortedTx = [...workingSet].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTx.forEach(t => {
      const current = byDateMap.get(t.date) || 0;
      byDateMap.set(t.date, current + t.amount);
    });

    const byDateData = Array.from(byDateMap.entries()).map(([date, amount]) => ({ date, amount }));

    return { totalRevenue, avgTicket, paidTransactions, byTypeData, byDateData, filteredTransactions: filtered };
  }, [transactions, startDate, endDate, selectedTeller, reportSubFilter, filterCorregimiento, filterActivity]);

  // --- Handlers ---
  const handleExportCSV = () => {
    const headers = ['ID Transacción', 'Fecha', 'Hora', 'Tipo Impuesto', 'Contribuyente ID', 'Descripción', 'Estado', 'Monto', 'Cajero'];
    const rows = stats.filteredTransactions.map(t => [
      t.id,
      t.date,
      t.time,
      t.taxType,
      t.taxpayerId,
      `"${t.description}"`, // Quote to handle commas
      t.status,
      formatCurrency(t.amount),
      t.tellerName
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_ingresos_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintClosing = () => {
    const filteredForReport = stats.filteredTransactions;
    setPreviewType('ARQUEO');
    setPreviewData({
      transactions: filteredForReport,
      total: filteredForReport.reduce((acc, t) => acc + t.amount, 0),
      startDate,
      endDate,
      teller: selectedTeller === 'ALL' ? 'TODOS' : selectedTeller
    });
    setShowPreviewModal(true);
  };

  const handleGenerateGeneralReport = () => {
    if (reportSubFilter === 'ACTIVIDAD') {
      // Activity reports are better as transaction lists
      setPreviewType('ARQUEO');
      setPreviewData({
        transactions: stats.filteredTransactions,
        total: stats.filteredTransactions.reduce((acc, t) => acc + t.amount, 0),
        startDate,
        endDate,
        teller: selectedTeller === 'ALL' ? 'TODOS' : selectedTeller,
        filterLabel: filterActivity === 'ALL' ? 'TODAS LAS ACTIVIDADES' : `IMPUESTO: ${filterActivity}`,
        customTitle: filterActivity === 'ALL' ? 'Informe de Recaudación por Actividad' : `Informe Detallado: ${filterActivity}`
      });
      setShowPreviewModal(true);
      return;
    }

    // Corregimiento / Global Reports use the Statistics view
    const corregimientosToProcess = reportSubFilter === 'CORREGIMIENTO' && filterCorregimiento !== 'ALL'
      ? [filterCorregimiento as Corregimiento]
      : Object.values(Corregimiento);

    const corregimientoStats = corregimientosToProcess.map(corregimiento => {
      const taxpayersInZone = taxpayers.filter(tp => tp.corregimiento === corregimiento);
      const taxpayerIds = new Set(taxpayersInZone.map(tp => tp.id));

      const income = stats.filteredTransactions
        .filter(t => taxpayerIds.has(t.taxpayerId))
        .reduce((sum, t) => sum + t.amount, 0);

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      let zoneTotalDebt = 0;
      let zoneDelinquentsCount = 0;

      taxpayersInZone.forEach(t => {
        let tpDebt = t.balance || 0;
        if (t.hasCommercialActivity && (t.status === 'ACTIVO' || t.status === 'MOROSO')) {
          const hasPaid = transactions.some(tx =>
            tx.taxpayerId === t.id &&
            tx.taxType === TaxType.COMERCIO &&
            new Date(tx.date).getMonth() + 1 === currentMonth &&
            new Date(tx.date).getFullYear() === currentYear
          );
          if (!hasPaid) tpDebt += config.commercialBaseRate;
        }

        if (t.hasGarbageService && (t.status === 'ACTIVO' || t.status === 'MOROSO')) {
          const hasPaid = transactions.some(tx =>
            tx.taxpayerId === t.id &&
            tx.taxType === TaxType.BASURA &&
            new Date(tx.date).getMonth() + 1 === currentMonth &&
            new Date(tx.date).getFullYear() === currentYear
          );
          if (!hasPaid) tpDebt += config.garbageResidentialRate;
        }

        zoneTotalDebt += tpDebt;
        if (tpDebt > 0) zoneDelinquentsCount++;
      });

      return {
        name: corregimiento,
        count: taxpayersInZone.length,
        income,
        debt: zoneTotalDebt,
        delinquents: zoneDelinquentsCount
      };
    }).filter(c => c.income > 0 || c.debt > 0 || c.count > 0).sort((a, b) => b.income - a.income);

    const totalIncome = corregimientoStats.reduce((sum, c) => sum + c.income, 0);
    const totalDebt = corregimientoStats.reduce((sum, c) => sum + c.debt, 0);

    setPreviewType('GENERAL');
    setPreviewData({
      corregimientos: corregimientoStats,
      totalIncome,
      totalDebt,
      startDate,
      endDate,
      filterLabel: reportSubFilter === 'CORREGIMIENTO' ? (filterCorregimiento === 'ALL' ? 'TODOS LOS CORREGIMIENTOS' : `CORREGIMIENTO: ${filterCorregimiento}`) : 'RESUMEN GLOBAL'
    });
    setShowPreviewModal(true);
  };

  return (
    <div className="space-y-10 pb-24 animate-fade-in px-2 relative">
      {/* Futuristic Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute top-[5%] right-[-5%] w-[45%] h-[45%] rounded-full bg-indigo-100/40 blur-[140px]"></div>
        <div className="absolute top-[40%] left-[-10%] w-[35%] h-[35%] rounded-full bg-blue-100/30 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-emerald-50/40 blur-[130px]"></div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tighter text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-700">
            Reportes Financieros
          </h2>
          <p className="text-slate-500 font-medium text-lg">Análisis detallado de recaudación y auditoría</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleGenerateGeneralReport}
            className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_15px_30px_-5px_rgba(79,_70,_229,_0.4)] transition-all duration-300 active:scale-95"
            title="Análisis detallado de recaudación"
          >
            <FileText size={18} className="group-hover:scale-110 transition-transform" />
            Informe General PDF
          </button>
        </div>
      </div>

      {/* Control Bar - Glass Container */}
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
              <Calendar size={12} className="mr-2" /> Fecha Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/50 border border-slate-200/60 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-inner"
            />
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
              <Calendar size={12} className="mr-2" /> Fecha Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/50 border border-slate-200/60 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-inner"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
              <UserIcon size={12} className="mr-2" /> Cajero Responsable
            </label>
            <select
              value={selectedTeller}
              onChange={(e) => setSelectedTeller(e.target.value)}
              className="w-full px-4 py-3 bg-white/50 border border-slate-200/60 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-inner appearance-none"
            >
              <option value="ALL">TODOS LOS CAJEROS</option>
              {users.filter(u => u.role === 'CAJERO' || u.role === 'ADMIN').map(u => (
                <option key={u.username} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePrintClosing}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95"
            >
              <Printer size={16} /> Arqueo PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center bg-white border border-slate-200 text-slate-600 p-3.5 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              title="Exportar CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Dynamic Filters Section */}
        <div className="mt-8 pt-8 border-t border-slate-100/60 flex flex-col xl:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-indigo-50/50 p-1 rounded-2xl flex gap-1 border border-indigo-100/50">
              {['TODOS', 'CORREGIMIENTO', 'ACTIVIDAD'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setReportSubFilter(filter as any)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-300 ${reportSubFilter === filter
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'text-indigo-400 hover:text-indigo-600'
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {reportSubFilter === 'CORREGIMIENTO' && (
              <select
                value={filterCorregimiento}
                onChange={(e) => setFilterCorregimiento(e.target.value as any)}
                className="px-4 py-2 border border-indigo-200 bg-white/50 rounded-xl focus:ring-4 focus:ring-indigo-500/10 font-bold text-xs text-indigo-700 shadow-sm"
              >
                <option value="ALL">TODOS LOS CORREGIMIENTOS</option>
                {Object.values(Corregimiento).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {reportSubFilter === 'ACTIVIDAD' && (
              <select
                value={filterActivity}
                onChange={(e) => setFilterActivity(e.target.value as any)}
                className="px-4 py-2 border border-indigo-200 bg-white/50 rounded-xl focus:ring-4 focus:ring-indigo-500/10 font-bold text-xs text-indigo-700 shadow-sm"
              >
                <option value="ALL">TODOS LOS IMPUESTOS</option>
                {Object.values(TaxType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>

          <div className="flex items-center gap-4 bg-slate-900 text-white px-8 py-3 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.15)] border-b-4 border-indigo-500 group">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 group-hover:text-indigo-300 transition-colors">Total Seleccionado</p>
              <p className="text-2xl font-black tracking-tighter">B/. {formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="p-2 bg-white/10 rounded-xl text-indigo-400">
               <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: 'Ingresos Totales', value: `B/. ${formatCurrency(stats.totalRevenue)}`, icon: TrendingUp, color: 'bg-emerald-500', label: 'Monto Neto' },
          { title: 'Tickets Pagados', value: stats.paidTransactions, icon: FileText, color: 'bg-indigo-500', label: 'Transacciones' },
          { title: 'Promedio Cobro', value: `B/. ${formatCurrency(stats.avgTicket)}`, icon: MapIcon, color: 'bg-blue-500', label: 'Por Contribuyente' },
        ].map((stat, idx) => (
          <div key={idx} className="group relative bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/40 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
            <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-5 blur-3xl ${stat.color}`}></div>
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className={`p-4 rounded-2xl ${stat.color} bg-opacity-10 text-slate-700 border border-white/50 group-hover:scale-110 transition-transform`}>
                <stat.icon size={28} className={stat.color.replace('bg-', 'text-')} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">{stat.label}</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{stat.value}</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em] opacity-70">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-[0_8px_40px_rgba(0,0,0,0.03)] border border-white">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Tendencia Temporal</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> Histórico de Recaudación
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.byDateData}>
                <defs>
                  <linearGradient id="colorReport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(val) => `B/.${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                />
                <Tooltip
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 30px 60px -12px rgba(0,0,0,0.25)',
                    padding: '24px'
                  }}
                  formatter={(value: number) => [`B/. ${formatCurrency(value)}`, 'Ingresos']}
                  labelStyle={{ fontWeight: 'black', color: '#1e293b', marginBottom: '8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  strokeWidth={6}
                  fillOpacity={1}
                  fill="url(#colorReport)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl border border-slate-800 relative overflow-hidden text-white group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] -mr-40 -mt-40 transition-transform group-hover:scale-110"></div>
          
          <div className="flex justify-between items-center mb-10 relative z-10">
            <h3 className="text-xl font-black tracking-tight">Distribución por Tipo</h3>
            <div className="p-3 bg-white/5 rounded-2xl">
              <PieChartIcon size={20} className="text-indigo-400" />
            </div>
          </div>
          
          <div className="h-72 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={100}
                  paddingAngle={10}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {stats.byTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.05)" strokeWidth={3} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '16px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Total</span>
               <span className="text-3xl font-black">B/.</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-8 relative z-10">
            {stats.byTypeData.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-glow" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.name}</span>
                </div>
                <span className="font-black text-sm">B/. {formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-white overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Registro Maestro de Ingresos</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Detalle cronológico de auditoría</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-5 py-2 bg-indigo-50 text-indigo-700 rounded-full font-black text-[10px] uppercase tracking-widest border border-indigo-100">
               {stats.filteredTransactions.length} Resultados
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-slate-50/50 text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-10 py-6 border-b border-slate-100">Transacción</th>
                <th className="px-10 py-6 border-b border-slate-100">Contribuyente / Concepto</th>
                <th className="px-10 py-6 border-b border-slate-100">Referencia / Tipo</th>
                <th className="px-10 py-6 border-b border-slate-100 text-right">Monto Neto</th>
                <th className="px-10 py-6 border-b border-slate-100 text-center">Estatus Operativo</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.filteredTransactions.map((t) => (
                <tr key={t.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="px-10 py-8 border-b border-slate-50">
                    <div className="flex flex-col">
                       <span className="font-mono text-[10px] font-black text-slate-400 mb-1 tracking-tighter">#{t.id.slice(-10).toUpperCase()}</span>
                       <span className="font-bold text-slate-500 flex items-center gap-2">
                         <Clock size={12} /> {t.time}
                       </span>
                    </div>
                  </td>
                  <td className="px-10 py-8 border-b border-slate-50">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 text-base mb-1 tracking-tight">
                        {taxpayers.find(tp => tp.id === t.taxpayerId)?.name || t.metadata?.manualPayer || 'Contribuyente Gral.'}
                      </span>
                      <span className="text-xs font-medium text-slate-500 italic opacity-80">{t.description}</span>
                      {t.metadata?.isConsolidated && t.metadata?.originalItems && (
                        <div className="mt-2 space-y-1.5 border-l-2 border-indigo-200/50 pl-3 py-1 bg-indigo-50/30 rounded-r-xl">
                          {t.metadata.originalItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[9px] font-bold text-slate-500 tracking-tight">
                              <span className="uppercase opacity-70">{item.label}</span>
                              <span className="text-indigo-600">B/. {formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {t.metadata?.isDirectCharge && (
                        <div className="mt-2 border-l-2 border-emerald-200/50 pl-3 py-1 bg-emerald-50/30 rounded-r-xl text-[10px] font-mono text-slate-600 space-y-0.5 max-w-sm">
                          <p className="font-bold text-[9px] text-emerald-700 uppercase tracking-wider">Detalles de Cobro Directo:</p>
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
                            <div className="mt-2 border-l-2 border-indigo-200/50 pl-3 py-1 bg-indigo-50/30 rounded-r-xl text-[10px] font-mono text-slate-600 space-y-0.5 max-w-sm">
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
                    </div>
                  </td>
                   <td className="px-10 py-8 border-b border-slate-50">
                    <div className="flex flex-col">
                      {(() => {
                        let label = 'COMERCIO';
                        let styleClass = 'bg-blue-50 text-blue-600 border border-blue-100';
                        
                        if (t.taxType === TaxType.VEHICULO) {
                          label = 'PLACA';
                          styleClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                        } else if (t.taxType === TaxType.CONSTRUCCION) {
                          label = 'CONSTRUCCIÓN';
                          styleClass = 'bg-amber-50 text-amber-600 border border-amber-100';
                        } else if (t.metadata?.chargeType === 'EVENTO' || t.description?.includes('EVENTO ESPECIAL')) {
                          label = 'EVENTO ESPECIAL';
                          styleClass = 'bg-purple-50 text-purple-600 border border-purple-100';
                        } else if (t.taxType === TaxType.BASURA) {
                          label = 'COMERCIO (ASEO)';
                          styleClass = 'bg-blue-50 text-blue-600 border border-blue-100';
                        } else if (t.taxType === TaxType.PAZ_Y_SALVO) {
                          label = 'PAZ Y SALVO';
                          styleClass = 'bg-indigo-50 text-indigo-600 border border-indigo-100';
                        }

                        return (
                          <span className={`text-[10px] font-black uppercase tracking-widest mb-2 px-3 py-1 rounded-lg w-fit ${styleClass}`}>
                            {label}
                          </span>
                        );
                      })()}
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={12} /> {t.date}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-8 border-b border-slate-50 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-slate-900 tracking-tighter mb-1">B/. {formatCurrency(t.amount)}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neto Pagado</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 border-b border-slate-50 text-center">
                    <span className={`inline-flex items-center px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                      t.status === 'PAGADO' 
                        ? 'bg-emerald-500 text-white border-emerald-400' 
                        : t.status === 'ANULADO'
                          ? 'bg-rose-500 text-white border-rose-400'
                          : 'bg-amber-400 text-slate-900 border-amber-300'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.filteredTransactions.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-slate-300">
               <FileText size={64} className="mb-4 opacity-20" />
               <p className="font-black text-xs uppercase tracking-[0.3em] opacity-40">Sin registros encontrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" onClick={() => setShowPreviewModal(false)}></div>
          <div className="relative bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[3rem] shadow-2xl flex flex-col animate-modal-in border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Vista Previa del Documento</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Generación de Reporte Institucional</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 rounded-2xl transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 bg-slate-100/50">
              <div id="report-preview-content" className="bg-white p-12 shadow-2xl mx-auto w-[215.9mm] min-h-[279.4mm] relative">
                {/* PDF Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                  <div className="w-1/3 text-left">
                    <p className="font-bold text-xs">REPÚBLICA DE PANAMÁ</p>
                    <p className="font-bold text-xs">PROVINCIA DE BOCAS DEL TORO</p>
                    <p className="font-black text-sm text-indigo-700">TESORERÍA MUNICIPAL DE ALMIRANTE</p>
                  </div>
                  <div className="w-1/3 flex justify-center">
                    <img src="/sigma-logo-final.png" alt="Logo" className="h-28 object-contain" />
                  </div>
                  <div className="w-1/3 text-right">
                    <p className="font-bold text-xs">FECHA: {new Date().toLocaleDateString()}</p>
                    <p className="font-bold text-xs uppercase">CAJERO: {selectedTeller === 'ALL' ? 'SISTEMA CENTRAL' : selectedTeller}</p>
                    <p className="font-black text-sm text-indigo-700">ESTADO: FINALIZADO</p>
                  </div>
                </div>

                <div className="text-center mb-10">
                   <h1 className="text-2xl font-black tracking-tight text-slate-900">
                     {previewType === 'ARQUEO' ? (previewData?.customTitle || 'INFORME DE ARQUEO DE CAJA') : 'INFORME GENERAL DE RECAUDACIÓN'}
                   </h1>
                   <div className="inline-flex items-center px-4 py-1.5 bg-indigo-50 rounded-full text-indigo-700 text-[10px] font-black uppercase tracking-widest mt-3 border border-indigo-100">
                     Período: {previewData?.startDate} al {previewData?.endDate}
                   </div>
                   {previewData?.filterLabel && (
                     <div className="block mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Filtro: {previewData.filterLabel}
                     </div>
                   )}
                </div>

                {previewType === 'ARQUEO' ? (
                  <table className="w-full text-xs mb-8 border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black uppercase tracking-widest">
                        <th className="p-3 text-left border border-slate-900">Ref.</th>
                        <th className="p-3 text-left border border-slate-900">Contribuyente</th>
                        <th className="p-3 text-left border border-slate-900">Tipo</th>
                        <th className="p-3 text-left border border-slate-900">Pago</th>
                        <th className="p-3 text-right border border-slate-900">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      {previewData.transactions.map((t: any) => (
                        <tr key={t.id} className="border-b border-slate-200">
                          <td className="p-3 border border-slate-200 font-mono text-[9px]">#{t.id.slice(-8).toUpperCase()}</td>
                          <td className="p-3 border border-slate-200">
                            <p className="font-bold">{taxpayers.find(tp => tp.id === t.taxpayerId)?.name || t.metadata?.manualPayer || 'C. Gral.'}</p>
                            <p className="text-[9px] text-slate-500 italic mt-0.5">{t.description}</p>
                            {t.metadata?.isConsolidated && t.metadata?.originalItems && (
                              <div className="mt-1 border-t border-slate-100 pt-1">
                                {t.metadata.originalItems.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-[8px] text-slate-500 leading-tight">
                                    <span className="uppercase">{item.label}</span>
                                    <span className="font-bold">B/. {formatCurrency(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {t.metadata?.isDirectCharge && (
                              <div className="mt-1 border-t border-slate-100 pt-1 text-[8px] text-slate-600 font-mono space-y-0.5">
                                <p className="font-bold text-emerald-700 uppercase">Detalles de Cobro Directo:</p>
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
                                  <div className="mt-1 border-t border-slate-100 pt-1 text-[8px] text-slate-600 font-mono space-y-0.5">
                                    <p className="font-bold text-indigo-700 uppercase">Actividades / Códigos Comerciales:</p>
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
                          </td>
                          <td className="p-3 border border-slate-200 text-[9px] uppercase">{t.taxType}</td>
                          <td className="p-3 border border-slate-200 text-center font-bold text-[9px] uppercase">{t.paymentMethod || 'Efectivo'}</td>
                          <td className="p-3 border border-slate-200 text-right font-black">B/. {formatCurrency(t.amount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-indigo-50 font-black">
                        <td colSpan={4} className="p-4 text-right border border-indigo-100 uppercase tracking-widest">Total Recaudado</td>
                        <td className="p-4 text-right border border-indigo-100 text-lg">B/. {formatCurrency(previewData.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-xs mb-8 border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black uppercase tracking-widest">
                        <th className="p-3 text-left border border-slate-900">Corregimiento / Área</th>
                        <th className="p-3 text-center border border-slate-900">Contribuyentes</th>
                        <th className="p-3 text-right border border-slate-900">Recaudado</th>
                        <th className="p-3 text-right border border-slate-900">Deuda Pendiente</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      {previewData.corregimientos.map((c: any) => (
                        <tr key={c.name} className="border-b border-slate-200">
                          <td className="p-3 border border-slate-200 font-bold uppercase">{c.name}</td>
                          <td className="p-3 border border-slate-200 text-center">{c.count}</td>
                          <td className="p-3 border border-slate-200 text-right font-black">B/. {formatCurrency(c.income)}</td>
                          <td className="p-3 border border-slate-200 text-right text-rose-600">B/. {formatCurrency(c.debt)}</td>
                        </tr>
                      ))}
                      <tr className="bg-indigo-50 font-black">
                        <td colSpan={2} className="p-4 text-right border border-indigo-100 uppercase tracking-widest">Balance Consolidado</td>
                        <td className="p-4 text-right border border-indigo-100 text-base">B/. {formatCurrency(previewData.totalIncome)}</td>
                        <td className="p-4 text-right border border-indigo-100 text-base text-rose-700">B/. {formatCurrency(previewData.totalDebt)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                <div className="mt-20 flex justify-around">
                  <div className="w-64 text-center">
                    <div className="border-t-2 border-slate-900 pt-3">
                      <p className="font-black text-xs uppercase">{selectedTeller === 'ALL' ? 'SISTEMA CENTRAL' : selectedTeller}</p>
                      <p className="text-[10px] font-bold text-slate-500">FIRMA DEL RESPONSABLE</p>
                    </div>
                  </div>
                  <div className="w-64 text-center">
                    <div className="border-t-2 border-slate-900 pt-3">
                      <p className="font-black text-xs uppercase">CONTROL INTERNO</p>
                      <p className="text-[10px] font-bold text-slate-500">FISCALIZACIÓN / AUDITORÍA</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-4">
              <button 
                onClick={async () => {
                  const element = document.getElementById('report-preview-content');
                  if (!element) return;
                  setIsGenerating(true);
                  try {
                    const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                    const dataUrl = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'letter');
                    const imgProps = pdf.getImageProperties(dataUrl);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save(`reporte_sigma_${new Date().getTime()}.pdf`);
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50"
              >
                <Download size={18} /> <span>{isGenerating ? 'PROCESANDO...' : 'DESCARGAR PDF'}</span>
              </button>
              <button 
                onClick={async () => {
                  const element = document.getElementById('report-preview-content');
                  if (!element) return;
                  setIsGenerating(true);
                  try {
                    const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                    const dataUrl = canvas.toDataURL('image/png');
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Reporte SIGMA</title>
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
                    setIsGenerating(false);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
              >
                <Printer size={18} /> <span>IMPRIMIR</span>
              </button>
              <button 
                onClick={() => setShowPreviewModal(false)} 
                className="flex-1 flex items-center justify-center gap-3 bg-slate-100 hover:bg-slate-200 text-slate-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
              >
                <X size={18} /> <span>CERRAR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};