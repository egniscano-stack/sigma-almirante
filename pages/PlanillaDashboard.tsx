import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Transaction, Taxpayer, TaxConfig } from '../types';
import { 
  Users, DollarSign, Calendar, Clock, Landmark, UserPlus, 
  CheckCircle, XCircle, Search, Download, Briefcase, Calculator,
  TrendingUp, Activity, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface PlanillaDashboardProps {
  transactions: Transaction[];
  taxpayers: Taxpayer[];
  config: TaxConfig;
}

const COLORS_PLANILLA = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#14b8a6'];

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  departamento: 'Administración' | 'Tesoreria' | 'Aseo y Recolección' | 'Obras Públicas' | 'Seguridad';
  salario: number;
  tipoPago: 'ACH' | 'CHEQUE';
  fechaIngreso: string;
}

const EMPLEADOS_INICIALES: Empleado[] = [
  { id: '1', nombre: 'Egnis Cano Rodrigues', cedula: '1-715-1888', cargo: 'Director de Informática', departamento: 'Administración', salario: 2200.00, tipoPago: 'ACH', fechaIngreso: '2023-02-15' },
  { id: '2', nombre: 'María Santos Bocas', cedula: '1-85-2342', cargo: 'Tesorera Municipal', departamento: 'Tesoreria', salario: 2500.00, tipoPago: 'ACH', fechaIngreso: '2022-01-10' },
  { id: '3', nombre: 'Juan Castillo Robinson', cedula: '1-99-983', cargo: 'Supervisor de Aseo', departamento: 'Aseo y Recolección', salario: 950.00, tipoPago: 'CHEQUE', fechaIngreso: '2024-05-01' },
  { id: '4', nombre: 'Demetrio Ábrego', cedula: '1-702-832', cargo: 'Oficial de Obras Públicas', departamento: 'Obras Públicas', salario: 1100.00, tipoPago: 'ACH', fechaIngreso: '2021-08-20' },
  { id: '5', nombre: 'Elizabeth Robinson', cedula: '1-104-589', cargo: 'Cajera Principal', departamento: 'Tesoreria', salario: 1200.00, tipoPago: 'ACH', fechaIngreso: '2023-06-01' },
  { id: '6', nombre: 'Pedro Samudio Almirante', cedula: '1-82-491', cargo: 'Agente de Seguridad', departamento: 'Seguridad', salario: 850.00, tipoPago: 'CHEQUE', fechaIngreso: '2024-01-15' },
];

interface SolicitudVacacion {
  id: string;
  empleadoNombre: string;
  dias: number;
  fechaInicio: string;
  tipo: 'VACACIONES' | 'PERMISO' | 'INCAPACIDAD';
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
}

const SOLICITUDES_INICIALES: SolicitudVacacion[] = [
  { id: '1', empleadoNombre: 'Demetrio Ábrego', dias: 15, fechaInicio: '2026-06-01', tipo: 'VACACIONES', status: 'PENDIENTE' },
  { id: '2', empleadoNombre: 'Egnis Cano Rodrigues', dias: 3, fechaInicio: '2026-05-25', tipo: 'PERMISO', status: 'PENDIENTE' },
  { id: '3', empleadoNombre: 'Juan Castillo Robinson', dias: 5, fechaInicio: '2026-05-18', tipo: 'INCAPACIDAD', status: 'APROBADO' },
];

export const PlanillaDashboard: React.FC<PlanillaDashboardProps> = ({
  transactions,
  taxpayers,
  config
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'NÓMINA' | 'COLABORADORES' | 'VACACIONES'>('NÓMINA');
  const [empleados, setEmpleados] = useState<Empleado[]>(EMPLEADOS_INICIALES);
  const [solicitudes, setSolicitudes] = useState<SolicitudVacacion[]>(SOLICITUDES_INICIALES);
  const [searchQuery, setSearchQuery] = useState('');
  
  // States for adding a new employee
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newCedula, setNewCedula] = useState('');
  const [newCargo, setNewCargo] = useState('');
  const [newDepto, setNewDepto] = useState<'Administración' | 'Tesoreria' | 'Aseo y Recolección' | 'Obras Públicas' | 'Seguridad'>('Administración');
  const [newSalario, setNewSalario] = useState('');

  // 1. DYNAMIC CALCULATIONS LINKED TO REAL MUNICIPAL REVENUE
  const revenueTotal = useMemo(() => {
    return transactions
      .filter(t => t.status === 'PAGADO')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [transactions]);

  const totalPayrollCost = useMemo(() => {
    return empleados.reduce((acc, curr) => acc + curr.salario, 0);
  }, [empleados]);

  // Regla Fiscal Panameña: Payroll cost compared to collected municipal tax revenue
  const payrollToRevenueRatio = useMemo(() => {
    if (revenueTotal === 0) return 0;
    return Math.round((totalPayrollCost / revenueTotal) * 100);
  }, [totalPayrollCost, revenueTotal]);

  // Panamanian labor calculations
  // Seguro Social (worker: 9.75%, employer: 12.25%)
  // Seguro Educativo (worker: 1.25%, employer: 1.50%)
  const payrollTaxCalculations = useMemo(() => {
    const workerSS = totalPayrollCost * 0.0975;
    const workerSE = totalPayrollCost * 0.0125;
    const netSalary = totalPayrollCost - workerSS - workerSE;

    const employerSS = totalPayrollCost * 0.1225;
    const employerSE = totalPayrollCost * 0.0150;
    const totalCostToMunicipality = totalPayrollCost + employerSS + employerSE;

    return { workerSS, workerSE, netSalary, employerSS, employerSE, totalCostToMunicipality };
  }, [totalPayrollCost]);

  // 2. CHART DATA
  const deptData = useMemo(() => {
    const deptTotals: Record<string, number> = {};
    empleados.forEach(e => {
      deptTotals[e.departamento] = (deptTotals[e.departamento] || 0) + e.salario;
    });

    return Object.keys(deptTotals).map(dept => ({
      name: dept,
      value: deptTotals[dept]
    }));
  }, [empleados]);

  const filteredEmpleados = useMemo(() => {
    if (!searchQuery) return empleados;
    return empleados.filter(e => 
      e.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.cedula.includes(searchQuery) ||
      e.cargo.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [empleados, searchQuery]);

  const handleActionSolicitud = (id: string, status: 'APROBADO' | 'RECHAZADO') => {
    setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre || !newCedula || !newCargo || !newSalario) {
      alert('Por favor complete todos los campos.');
      return;
    }

    const newEmp: Empleado = {
      id: (empleados.length + 1).toString(),
      nombre: newNombre,
      cedula: newCedula,
      cargo: newCargo,
      departamento: newDepto,
      salario: parseFloat(newSalario),
      tipoPago: 'ACH',
      fechaIngreso: new Date().toISOString().split('T')[0]
    };

    setEmpleados([...empleados, newEmp]);
    setShowAddModal(false);
    
    // Clear Form
    setNewNombre('');
    setNewCedula('');
    setNewCargo('');
    setNewSalario('');
  };

  return (
    <div className="space-y-8 pb-24 px-2 select-none">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-100/50 blur-[130px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-purple-100/50 blur-[130px]"></div>
      </div>

      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-600">
            Módulo de Planilla y Recursos Humanos
          </h2>
          <p className="text-slate-500 font-medium text-lg">Carga de personal, cálculo de Seguro Social y retenciones laborales</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-2xl shadow-xl transition-all duration-300 transform active:scale-95"
        >
          <UserPlus size={18} />
          <span>Registrar Colaborador</span>
        </button>
      </div>

      {/* Top Level HR Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Colaboradores count */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Users size={24} />
            </div>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full uppercase">Funcionarios</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">{empleados.length} Activos</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Colaboradores Municipales</p>
        </div>

        {/* Gasto Nomina */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
              <DollarSign size={24} />
            </div>
            <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-3 py-1 rounded-full uppercase">Nómina Base</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">B/. {totalPayrollCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Costo Mensual Acumulado</p>
        </div>

        {/* Carga del patrono */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
              <Calculator size={24} />
            </div>
            <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-3 py-1 rounded-full uppercase">Costo Total Patronal</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">B/. {payrollTaxCalculations.totalCostToMunicipality.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Nómina + Seguro Social/SE</p>
        </div>

        {/* Solicitudes de vacaciones */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-pink-50 rounded-xl text-pink-600">
              <Calendar size={24} />
            </div>
            <span className="text-[10px] font-bold bg-pink-100 text-pink-800 px-3 py-1 rounded-full uppercase">Vacaciones</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">{solicitudes.filter(s => s.status === 'PENDIENTE').length} Pendientes</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Solicitudes por Evaluar</p>
        </div>
      </div>

      {/* Fiscal Health Gauge Alert Card */}
      <div className="bg-white/90 backdrop-blur border border-slate-100 rounded-3xl p-6 shadow-md flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex gap-4 items-center">
          <div className={`p-4 rounded-2xl ${payrollToRevenueRatio > 40 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <Activity size={32} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">Regla Fiscal de Gasto Municipal</h3>
              {payrollToRevenueRatio > 40 ? (
                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                  <ShieldAlert size={12} /> Alerta Presupuestaria
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                  <CheckCircle size={12} /> Óptimo
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
              De acuerdo a la ley de administración presupuestaria municipal, la planilla total no debe exceder el **40%** de los ingresos corrientes recaudados. Actualmente la planilla municipal representa el **{payrollToRevenueRatio}%** de la recaudación corriente total (B/. {revenueTotal.toLocaleString()}).
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200/50 rounded-2xl min-w-[150px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ratio Nómina/Recaudado</span>
          <span className={`text-4xl font-extrabold ${payrollToRevenueRatio > 40 ? 'text-rose-600' : 'text-emerald-600'}`}>{payrollToRevenueRatio}%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-200/50 backdrop-blur rounded-2xl w-fit">
        {(['NÓMINA', 'COLABORADORES', 'VACACIONES'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeSubTab === tab
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            {tab === 'NÓMINA' ? 'Desglose de Nómina' : tab === 'COLABORADORES' ? 'Registro de Personal' : 'Permisos y Vacaciones'}
          </button>
        ))}
      </div>

      {/* Sub Tabs Panel */}
      {activeSubTab === 'NÓMINA' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payroll Cost by Department */}
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl border border-slate-100 shadow-md lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Salarios por Departamento</h3>
              <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">Carga financiera mensual distribuida</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `B/.${v}`} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]}>
                    {deptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_PLANILLA[index % COLORS_PLANILLA.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tax & Social Security Calculation Card */}
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>

            <div className="space-y-4 relative z-10">
              <h3 className="text-xl font-bold tracking-tight">Retenciones de Ley (Panamá)</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                Calculadora integrada de Seguro Social (9.75% empleado, 12.25% patrono) y Seguro Educativo (1.25% empleado, 1.50% patrono).
              </p>
            </div>

            <div className="space-y-4 my-8 relative z-10">
              {/* Salario Bruto */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase">Nómina Bruta</span>
                <span className="font-extrabold text-base text-slate-100">B/. {totalPayrollCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Workers deductions */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Deducciones Empleado</p>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Seguro Social (9.75%)</span>
                  <span>- B/. {payrollTaxCalculations.workerSS.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Seguro Educativo (1.25%)</span>
                  <span>- B/. {payrollTaxCalculations.workerSE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-400 pt-2 border-t border-slate-800">
                  <span>Nómina Neta a Pagar</span>
                  <span>B/. {payrollTaxCalculations.netSalary.toFixed(2)}</span>
                </div>
              </div>

              {/* Employer Contributions */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Aportes Municipio (Patrono)</p>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Aporte S.S. (12.25%)</span>
                  <span>+ B/. {payrollTaxCalculations.employerSS.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Aporte S.E. (1.50%)</span>
                  <span>+ B/. {payrollTaxCalculations.employerSE.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 text-center relative z-10">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block leading-relaxed">
                Municipio de Almirante • Caja de Seguro Social de Panamá
              </span>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'COLABORADORES' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
          {/* Controls */}
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Registro General de Colaboradores</h3>
              <p className="text-slate-400 text-xs uppercase tracking-widest">Fichas técnicas y salarios municipales</p>
            </div>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre, cargo, cédula..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 outline-none text-sm transition-all focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400">
                <tr>
                  <th className="px-8 py-5">Nombre Completo</th>
                  <th className="px-8 py-5">Cédula</th>
                  <th className="px-8 py-5">Cargo / Función</th>
                  <th className="px-8 py-5">Departamento</th>
                  <th className="px-8 py-5">Ingreso</th>
                  <th className="px-8 py-5 text-right">Salario Bruto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEmpleados.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-800">{emp.nombre}</td>
                    <td className="px-8 py-5 font-mono text-xs text-slate-500">{emp.cedula}</td>
                    <td className="px-8 py-5 text-slate-600">{emp.cargo}</td>
                    <td className="px-8 py-5">
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-600 uppercase">
                        {emp.departamento}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-slate-400 text-xs font-bold">{emp.fechaIngreso}</td>
                    <td className="px-8 py-5 text-right font-bold text-slate-900 text-base">B/. {emp.salario.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'VACACIONES' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-xl font-bold text-slate-900">Solicitudes de Permisos y Vacaciones</h3>
            <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">Evaluación de ausencias y control de incidencias</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400">
                <tr>
                  <th className="px-8 py-5">Funcionario</th>
                  <th className="px-8 py-5">Tipo Solicitud</th>
                  <th className="px-8 py-5">Días</th>
                  <th className="px-8 py-5">Fecha Inicio</th>
                  <th className="px-8 py-5">Estado</th>
                  <th className="px-8 py-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {solicitudes.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-800">{s.empleadoNombre}</td>
                    <td className="px-8 py-5">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        s.tipo === 'VACACIONES' ? 'bg-indigo-50 text-indigo-700' :
                        s.tipo === 'PERMISO' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {s.tipo}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-bold text-slate-700">{s.dias} Días</td>
                    <td className="px-8 py-5 text-slate-500 font-medium">{s.fechaInicio}</td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        s.status === 'PENDIENTE' ? 'bg-amber-400 text-slate-900' :
                        s.status === 'APROBADO' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center flex justify-center gap-2">
                      {s.status === 'PENDIENTE' ? (
                        <>
                          <button
                            onClick={() => handleActionSolicitud(s.id, 'APROBADO')}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-xl shadow-md transition-all active:scale-95"
                            title="Aprobar"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => handleActionSolicitud(s.id, 'RECHAZADO')}
                            className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-xl shadow-md transition-all active:scale-95"
                            title="Rechazar"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Procesada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up border border-slate-100">
            <div className="bg-indigo-600 p-6 text-white text-center">
              <h3 className="text-xl font-bold">Registrar Colaborador Municipal</h3>
              <p className="text-indigo-200 text-xs mt-1">Crea una nueva ficha técnica de personal</p>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={newNombre}
                  onChange={e => setNewNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cédula</label>
                <input
                  type="text"
                  required
                  value={newCedula}
                  onChange={e => setNewCedula(e.target.value)}
                  placeholder="Ej. 1-123-456"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cargo</label>
                <input
                  type="text"
                  required
                  value={newCargo}
                  onChange={e => setNewCargo(e.target.value)}
                  placeholder="Ej. Inspector Municipal"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Departamento</label>
                  <select
                    value={newDepto}
                    onChange={e => setNewDepto(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm focus:border-indigo-500 transition-all"
                  >
                    <option value="Administración">Administración</option>
                    <option value="Tesoreria">Tesorería</option>
                    <option value="Aseo y Recolección">Aseo y Recolección</option>
                    <option value="Obras Públicas">Obras Públicas</option>
                    <option value="Seguridad">Seguridad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Salario Bruto</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newSalario}
                    onChange={e => setNewSalario(e.target.value)}
                    placeholder="B/. 850.00"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
