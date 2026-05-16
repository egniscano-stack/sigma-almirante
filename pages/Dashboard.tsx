import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Transaction, Taxpayer, TaxConfig, TaxType, CommercialCategory } from '../types';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, AlertCircle, 
  CheckCircle, Clock, ChevronRight, Filter, Search, 
  Download, Briefcase, Calendar, RefreshCw, FileText 
} from 'lucide-react';
import taxStructure from '../data/taxStructure.json';
import { calculateTaxpayerDebt } from '../services/debtLogic';

interface DashboardProps {
  transactions: Transaction[];
  taxpayers: Taxpayer[];
  config: TaxConfig;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC<DashboardProps> = ({ transactions, taxpayers, config, onRefresh, isLoading }) => {
  const [timeFilter, setTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH'>('MONTH');

  // 1. FILTER TRANSACTIONS
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return transactions.filter(t => {
      const tDate = new Date(t.date + 'T' + t.time); // Combinar fecha y hora para precisión
      if (timeFilter === 'DAY') return tDate >= startOfDay;
      if (timeFilter === 'WEEK') return new Date(t.date) >= startOfWeek;
      if (timeFilter === 'MONTH') return new Date(t.date) >= startOfMonth;
      return true;
    });
  }, [transactions, timeFilter]);

  // 2. CALCULATE KPI METRICS
  const totalRevenue = filteredTransactions
    .filter(t => t.status === 'PAGADO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const transactionCount = filteredTransactions.length;

  // 3. DEBT & DELINQUENCY CALCULATION (Dinero por Cobrar & Contribuyentes Morosos)
  // 3. DEBT & DELINQUENCY CALCULATION (Dinero por Cobrar & Contribuyentes Morosos)
  const debtStats = useMemo(() => {
    let totalDebtAmount = 0;
    let delinquentCount = 0;

    taxpayers.forEach(t => {
      const activeStatuses = ['ACTIVO', 'MOROSO'];
      if (activeStatuses.includes(t.status)) {
        const { total } = calculateTaxpayerDebt(t, transactions, config);
        if (total > 0) {
          totalDebtAmount += total;
          delinquentCount++;
        }
      }
    });

    return { amount: totalDebtAmount, count: delinquentCount };
  }, [taxpayers, transactions, config]);


  // 4. CHART DATA PREPARATION
  const chartData = useMemo(() => {
    // Group by Date within filter
    const grouped: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      const dateKey = t.date; // YYYY-MM-DD
      grouped[dateKey] = (grouped[dateKey] || 0) + t.amount;
    });

    // Fill missing days if needed or just show available data sorted
    return Object.keys(grouped).sort().map(date => ({
      name: new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      total: grouped[date]
    }));
  }, [filteredTransactions]);

  const pieData = [
    { name: 'Comercio', value: filteredTransactions.filter(t => t.taxType === TaxType.COMERCIO).reduce((a, b) => a + b.amount, 0) },
    { name: 'Vehículos', value: filteredTransactions.filter(t => t.taxType === TaxType.VEHICULO).reduce((a, b) => a + b.amount, 0) },
    { name: 'Basura', value: filteredTransactions.filter(t => t.taxType === TaxType.BASURA).reduce((a, b) => a + b.amount, 0) },
    { name: 'Obras', value: filteredTransactions.filter(t => t.taxType === TaxType.CONSTRUCCION).reduce((a, b) => a + b.amount, 0) },
  ].filter(i => i.value > 0);

  const StatCard = ({ title, value, subtext, icon: Icon, color, trend }: any) => (
    <div className="group relative bg-white bg-opacity-80 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40 flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.08)] hover:-translate-y-1 transition-all duration-300 overflow-hidden h-full">
      {/* Decorative Glow */}
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-5 blur-3xl transition-opacity group-hover:opacity-20 ${color.split(' ')[0]}`}></div>
      
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-xl ${color} bg-opacity-10 shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={28} className={color.replace('bg-', 'text-')} />
        </div>
        {trend && (
          <span className="text-[10px] font-black text-emerald-600 flex items-center bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 px-3 py-1.5 rounded-full uppercase tracking-tighter">
            <TrendingUp size={12} className="mr-1" /> {trend}
          </span>
        )}
      </div>
      
      <div className="relative z-10">
        <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{value}</h3>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wide opacity-80">{title}</p>
        <div className="flex items-center mt-3 pt-3 border-t border-slate-100/50">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subtext}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 pb-24 animate-fade-in px-2">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-[120px]"></div>
      </div>

      {/* Header & Filter */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tighter text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-600">
            Panel de Control
          </h2>
          <p className="text-slate-500 font-medium text-lg">Inteligencia Operativa y Financiera</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-xl flex gap-1">
            {['DAY', 'WEEK', 'MONTH'].map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter as any)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 tracking-widest uppercase ${timeFilter === filter
                  ? 'bg-indigo-600 text-white shadow-[0_10px_20px_-5px_rgba(79,_70,_229,_0.4)]'
                  : 'text-slate-500 hover:bg-slate-100'
                  }`}
              >
                {filter === 'DAY' ? 'Hoy' : filter === 'WEEK' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="group flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-xs shadow-2xl transition-all duration-500 active:scale-95"
              >
                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-700" /> 
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            )}
            <button
              onClick={() => {
                new Notification('SIGMA AI', { body: 'Sistema de notificaciones activo.', icon: '/sigma-logo-final.png' });
              }}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
              title="Test Notificación"
            >
              <AlertCircle size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Recaudación Total"
          value={`B/. ${(totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtext={`Periodo actual`}
          icon={DollarSign}
          color="bg-indigo-500"
          trend="+12.5%"
        />
        <StatCard
          title="Transacciones"
          value={transactionCount.toLocaleString()}
          subtext="Total operaciones"
          icon={FileText}
          color="bg-blue-500"
        />
        <StatCard
          title="Contribuyentes Activos"
          value={taxpayers.filter(t => t.taxpayerNumber && t.commercialCategory !== 'VIGENCIA EXPIRADA' && t.status === 'ACTIVO').length.toLocaleString()}
          subtext={`${taxpayers.filter(t => t.commercialCategory === 'VIGENCIA EXPIRADA').length} en Vigencia Expirada (Sin Número)`}
          icon={Users}
          color="bg-amber-500"
        />
        <StatCard
          title="Deuda Estimada"
          value={`B/. ${(debtStats?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtext={`${debtStats.count.toLocaleString()} contribuyentes morosos`}
          icon={AlertCircle}
          color="bg-rose-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-white lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Tendencia de Ingresos</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Flujo de caja temporal</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartData.length > 0 ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => `B/.${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '20px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                      padding: '20px'
                    }}
                    formatter={(value: number) => [`B/. ${value.toFixed(2)}`, 'Recaudación']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#6366f1" 
                    strokeWidth={5} 
                    fillOpacity={1} 
                    fill="url(#dashboardRevenue)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-xs">Sin actividad registrada</div>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tax Distribution */}
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 text-white overflow-hidden relative group">
          {/* Animated background pulse */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
          
          <h3 className="text-xl font-black tracking-tight mb-8 relative z-10">Distribución</h3>
          
          <div className="h-64 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  animationBegin={500}
                  animationDuration={1500}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total</span>
               <span className="text-2xl font-black">B/.</span>
            </div>
          </div>
          
          <div className="space-y-4 mt-8 relative z-10">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center group/item hover:translate-x-1 transition-transform">
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-300 font-bold text-xs uppercase tracking-wider group-hover/item:text-white transition-colors">{item.name}</span>
                </div>
                <span className="font-black text-sm">B/. {(item.value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Actividad Reciente</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Últimas 10 transacciones</p>
          </div>
          <button className="bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all duration-300">
            Ver Todo
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-400">
              <tr>
                <th className="px-8 py-5">Identificador</th>
                <th className="px-8 py-5">Contribuyente</th>
                <th className="px-8 py-5">Concepto</th>
                <th className="px-8 py-5 text-right">Monto</th>
                <th className="px-8 py-5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredTransactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-8 py-6 font-mono text-xs text-slate-400">#{tx.id.slice(-8).toUpperCase()}</td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                       <span className="font-black text-slate-800">{taxpayers.find(t => t.id === tx.taxpayerId)?.name || 'Contribuyente Gral.'}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase">{tx.date} • {tx.time}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-slate-500 font-medium">{tx.description}</td>
                  <td className="px-8 py-6 text-right">
                    <span className="font-black text-slate-900 text-lg">B/. {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                      tx.status === 'PAGADO' 
                        ? 'bg-emerald-500 text-white' 
                        : tx.status === 'ANULADO'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-400 text-slate-900'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};