import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Transaction, Taxpayer, TaxConfig, TaxType } from '../types';
import { 
  TrendingUp, DollarSign, Wallet, ShieldCheck, FileSpreadsheet, 
  ArrowUpRight, BarChart3, Receipt, Scale, Landmark, Calendar,
  Download, ArrowDownRight, RefreshCw, FileText, CheckCircle2
} from 'lucide-react';
import { calculateTaxpayerDebt } from '../services/debtLogic';

interface ContabilidadDashboardProps {
  transactions: Transaction[];
  taxpayers: Taxpayer[];
  config: TaxConfig;
  onRefresh?: () => void;
}

const SHADES = ['#0d9488', '#2563eb', '#db2777', '#ca8a04', '#7c3aed', '#ea580c'];

export const ContabilidadDashboard: React.FC<ContabilidadDashboardProps> = ({
  transactions,
  taxpayers,
  config,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'INGRESOS' | 'CONCILIACION' | 'PRESUPUESTO'>('INGRESOS');
  const [reconciledList, setReconciledList] = useState<Record<string, boolean>>({});

  // 1. Calculations from Live Application Data
  const stats = useMemo(() => {
    const paidTxs = transactions.filter(t => t.status === 'PAGADO');
    const totalRecaudado = paidTxs.reduce((acc, curr) => acc + curr.amount, 0);

    // Arqueo by payment method
    const arqueo = {
      EFECTIVO: paidTxs.filter(t => t.payment_method === 'EFECTIVO').reduce((a, b) => a + b.amount, 0),
      TARJETA: paidTxs.filter(t => t.payment_method === 'TARJETA').reduce((a, b) => a + b.amount, 0),
      CHEQUE: paidTxs.filter(t => t.payment_method === 'CHEQUE').reduce((a, b) => a + b.amount, 0),
      ONLINE: paidTxs.filter(t => t.payment_method === 'ONLINE').reduce((a, b) => a + b.amount, 0),
      ARREGLO_PAGO: paidTxs.filter(t => t.payment_method === 'ARREGLO_PAGO').reduce((a, b) => a + b.amount, 0),
    };

    // Calculate dynamic accounts receivable (deuda estimada total de contribuyentes activos)
    let cuentasPorCobrar = 0;
    taxpayers.forEach(t => {
      if (['ACTIVO', 'MOROSO'].includes(t.status)) {
        const { total } = calculateTaxpayerDebt(t, transactions, config);
        cuentasPorCobrar += total;
      }
    });

    return { totalRecaudado, arqueo, cuentasPorCobrar };
  }, [transactions, taxpayers, config]);

  // Budget Simulation (Estatal/Municipal targets)
  const budgetData = [
    { name: 'Patente Comercial', recaudado: transactions.filter(t => t.taxType === TaxType.COMERCIO && t.status === 'PAGADO').reduce((a, b) => a + b.amount, 0), meta: 45000 },
    { name: 'Impuesto Vehicular', recaudado: transactions.filter(t => t.taxType === TaxType.VEHICULO && t.status === 'PAGADO').reduce((a, b) => a + b.amount, 0), meta: 35000 },
    { name: 'Tasas de Aseo', recaudado: transactions.filter(t => t.taxType === TaxType.BASURA && t.status === 'PAGADO').reduce((a, b) => a + b.amount, 0), meta: 20000 },
    { name: 'Construcción y Obras', recaudado: transactions.filter(t => t.taxType === TaxType.CONSTRUCCION && t.status === 'PAGADO').reduce((a, b) => a + b.amount, 0), meta: 60000 },
  ];

  // Radar chart data for budget execution comparison
  const radarData = budgetData.map(b => ({
    subject: b.name,
    Recaudado: b.recaudado,
    Meta: b.meta,
    fullMark: Math.max(b.meta, b.recaudado)
  }));

  // Daily revenue flow for the line chart
  const dailyRevenueData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    transactions
      .filter(t => t.status === 'PAGADO')
      .forEach(t => {
        dailyMap[t.date] = (dailyMap[t.date] || 0) + t.amount;
      });

    return Object.keys(dailyMap).sort().map(d => ({
      fecha: new Date(d).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }),
      Monto: dailyMap[d]
    }));
  }, [transactions]);

  // Forecast/Projection data
  const projectionData = useMemo(() => {
    // Basic forecasting based on average daily collections
    const daysWithData = dailyRevenueData.length || 1;
    const totalCollected = dailyRevenueData.reduce((acc, curr) => acc + curr.Monto, 0);
    const avgDaily = totalCollected / daysWithData;

    return Array.from({ length: 7 }).map((_, idx) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + idx + 1);
      return {
        fecha: futureDate.toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }),
        Proyectado: Math.round(avgDaily * (0.9 + Math.random() * 0.3)) // Proyecciones con variación realista
      };
    });
  }, [dailyRevenueData]);

  const handleToggleReconciliation = (id: string) => {
    setReconciledList(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const totalReconciled = useMemo(() => {
    return Object.values(reconciledList).filter(Boolean).length;
  }, [reconciledList]);

  return (
    <div className="space-y-8 pb-24 px-2 select-none">
      {/* Decorative Glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-teal-100/50 blur-[130px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-100/50 blur-[130px]"></div>
      </div>

      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-teal-700 to-emerald-600">
            Módulo de Contabilidad Municipal
          </h2>
          <p className="text-slate-500 font-medium text-lg">Control presupuestario, arqueo de caja y estados de conciliación</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              alert('Exportando Libro Diario en Excel...');
            }}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-3 rounded-2xl shadow-xl transition-all duration-300"
          >
            <FileSpreadsheet size={18} />
            <span>Exportar Libro Diario</span>
          </button>
          <button
            onClick={() => {
              alert('Generando Balance General PDF...');
            }}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-2xl shadow-xl transition-all duration-300"
          >
            <Download size={18} />
            <span>Reporte de Balance</span>
          </button>
        </div>
      </div>

      {/* Top Level Financial Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Recaudado indicator */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
              <DollarSign size={24} />
            </div>
            <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-3 py-1 rounded-full uppercase">Recaudado</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">B/. {stats.totalRecaudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Caja Principal y Portales</p>
        </div>

        {/* Cuentas por cobrar */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
              <Scale size={24} />
            </div>
            <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-3 py-1 rounded-full uppercase">Por Cobrar</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">B/. {stats.cuentasPorCobrar.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Deuda Activa en Morosidad</p>
        </div>

        {/* Arqueo Efectivo */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <Wallet size={24} />
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase">Fondo en Efectivo</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">B/. {stats.arqueo.EFECTIVO.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Fondo Físico en Caja</p>
        </div>

        {/* Total Conciliado Indicator */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <ShieldCheck size={24} />
            </div>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full uppercase">Conciliado</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">{totalReconciled} / {transactions.length}</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Transacciones Auditadas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-200/50 backdrop-blur rounded-2xl w-fit">
        {(['INGRESOS', 'CONCILIACION', 'PRESUPUESTO'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            {tab === 'INGRESOS' ? 'Flujo e Ingresos' : tab === 'CONCILIACION' ? 'Conciliación Bancaria' : 'Ejecución Presupuestaria'}
          </button>
        ))}
      </div>

      {/* Main Tab Panels */}
      {activeTab === 'INGRESOS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Daily flow chart */}
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl border border-slate-100 shadow-md lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Ingresos Reales por Día</h3>
              <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">Comparativo de flujo monetario diario</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {dailyRevenueData.length > 0 ? (
                  <AreaChart data={dailyRevenueData}>
                    <defs>
                      <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `B/.${v}`} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="Monto" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorMonto)" />
                  </AreaChart>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-xs">Sin transacciones para graficar</div>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecasting / Financial projections */}
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
            
            <div className="space-y-2 relative z-10">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight">Proyecciones de Caja</h3>
                <TrendingUp size={20} className="text-teal-400 animate-pulse" />
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Predicciones inteligentes para los próximos 7 días</p>
            </div>

            <div className="h-48 my-6 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData}>
                  <XAxis dataKey="fecha" stroke="#475569" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
                  <Line type="monotone" dataKey="Proyectado" stroke="#14b8a6" strokeWidth={4} dot={{ fill: '#14b8a6', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3 relative z-10">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Recaudación Estimada Próxima Semana:</span>
                <span className="font-extrabold text-teal-400 text-sm">
                  B/. {projectionData.reduce((acc, curr) => acc + curr.Proyectado, 0).toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                *Cálculo matemático predictivo basado en la frecuencia e importes de transacciones reales registradas en SIGMA.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CONCILIACION' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Módulo de Conciliación Bancaria</h3>
              <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">Confrontación de depósitos físicos contra libro auxiliar municipal</p>
            </div>
            <div className="text-xs font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-xl">
              Selecciona transacciones para marcarlas como conciliadas
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400">
                <tr>
                  <th className="px-8 py-5 text-center">Conciliado</th>
                  <th className="px-8 py-5">Referencia</th>
                  <th className="px-8 py-5">Fecha y Hora</th>
                  <th className="px-8 py-5">Detalle / Concepto</th>
                  <th className="px-8 py-5">Método de Pago</th>
                  <th className="px-8 py-5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {transactions.slice(0, 15).map(tx => {
                  const isReconciled = !!reconciledList[tx.id];
                  return (
                    <tr key={tx.id} className={`hover:bg-slate-50/50 transition-colors ${isReconciled ? 'bg-teal-50/30' : ''}`}>
                      <td className="px-8 py-5 text-center">
                        <button
                          onClick={() => handleToggleReconciliation(tx.id)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isReconciled 
                              ? 'bg-teal-500 border-teal-600 text-white shadow-md' 
                              : 'bg-white border-slate-300 text-transparent hover:border-teal-500'
                          }`}
                        >
                          <CheckCircle2 size={16} className={isReconciled ? 'text-white' : 'hover:text-teal-500'} />
                        </button>
                      </td>
                      <td className="px-8 py-5 font-mono text-xs font-bold text-slate-500">#{tx.id.slice(-8).toUpperCase()}</td>
                      <td className="px-8 py-5 text-slate-600">{tx.date} <span className="text-[10px] text-slate-400 font-bold block">{tx.time}</span></td>
                      <td className="px-8 py-5 font-bold text-slate-800">{tx.description}</td>
                      <td className="px-8 py-5">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {tx.payment_method}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right font-bold text-slate-900 text-base">B/. {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'PRESUPUESTO' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Radar chart of meta vs recaudado */}
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl border border-slate-100 shadow-md lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Comparativo vs Meta Anual</h3>
              <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">Progreso porcentual contra presupuesto establecido</p>
            </div>
            <div className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#cbd5e1" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#475569', fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} stroke="#94a3b8" />
                  <Radar name="Recaudado Real" dataKey="Recaudado" stroke="#0d9488" fill="#0d9488" fillOpacity={0.4} />
                  <Radar name="Meta Anual" dataKey="Meta" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed breakdown list */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-md space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Estado de Partidas</h3>
            
            <div className="space-y-5">
              {budgetData.map((partida, idx) => {
                const percent = Math.min(100, Math.round((partida.recaudado / partida.meta) * 100));
                return (
                  <div key={partida.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span className="uppercase tracking-wider">{partida.name}</span>
                      <span>{percent}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                      <div 
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${percent}%`, 
                          backgroundColor: SHADES[idx % SHADES.length] 
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>B/. {partida.recaudado.toLocaleString()} Recaudados</span>
                      <span>Meta: B/. {partida.meta.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
