import React, { useState, useRef } from 'react';
import { TaxConfig, MunicipalityInfo, User, UserRole, Taxpayer, Transaction, TaxpayerStatus } from '../types';
import { Save, Shield, DollarSign, Building, UserPlus, X, Database, Globe, Download, Upload, Server, FileSpreadsheet, RefreshCw, Power, Trash2, BookOpen } from 'lucide-react';
import { GovScraper } from './GovScraper';
import { TaxStructureAdmin } from '../components/TaxStructureAdmin';

interface SettingsProps {
  config: TaxConfig;
  onUpdateConfig: (newConfig: TaxConfig) => void;
  municipalityInfo: MunicipalityInfo;
  onUpdateMunicipalityInfo: (info: MunicipalityInfo) => void;
  users: User[];
  onUpdateUser: (user: User) => void;
  onCreateUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
  onSimulateScraping: () => void;
  onBackup: () => void;
  onImport: (file: File) => void;
  onImportTaxpayer: (taxpayer: Taxpayer) => void;
  taxpayers: Taxpayer[];
  transactions: Transaction[];
  onUpdateTaxpayer: (tp: Taxpayer) => void;
  currentUserName: string;
  onHardReset: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  config, onUpdateConfig, municipalityInfo, onUpdateMunicipalityInfo, users, onCreateUser, onUpdateUser, onDeleteUser, onSimulateScraping, onBackup, onImport,
  onImportTaxpayer, taxpayers, transactions, onUpdateTaxpayer, currentUserName, onHardReset
}) => {
  const [localConfig, setLocalConfig] = useState<TaxConfig>(config || { 
    plateCost: 0, constructionRatePerSqm: 0, garbageResidentialRate: 0, garbageCommercialRate: 0, 
    commercialBaseRate: 0, liquorLicenseRate: 0, advertisementRate: 0, commercialRates: {} as any 
  });
  const [localMuniInfo, setLocalMuniInfo] = useState<MunicipalityInfo>(municipalityInfo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User Creation State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState<User>({
    username: '',
    name: '',
    password: '',
    role: 'CAJERO'
  });

  // Change Password State
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // ETL Simulation State
  const [scrapingLoading, setScrapingLoading] = useState(false);

  const handleConfigChange = (key: keyof TaxConfig, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const handleMuniChange = (key: keyof MunicipalityInfo, value: string) => {
    setLocalMuniInfo(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveAll = () => {
    onUpdateConfig(localConfig);
    onUpdateMunicipalityInfo(localMuniInfo);
    alert('Configuración y datos institucionales actualizados correctamente.');
  };

  const submitNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (users.some(u => u.username === newUser.username)) {
      alert('El nombre de usuario ya existe.');
      return;
    }
    onCreateUser({ ...newUser, status: 'ACTIVO' });
    setShowUserModal(false);
    setNewUser({ username: '', name: '', password: '', role: 'CAJERO' }); // Reset
    alert(`Usuario ${newUser.username} creado exitosamente.`);
  };

  const openPwdModal = (user: User) => {
    setUserToEdit(user);
    setNewPassword('');
    setShowPwdModal(true);
  };

  const submitChangePwd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit || !newPassword) return;

    onUpdateUser({ ...userToEdit, password: newPassword });
    setShowPwdModal(false);
    setUserToEdit(null);
    alert("Contraseña actualizada correctamente.");
  };

  const executeScraping = () => {
    setScrapingLoading(true);
    // Simulate network delay for scraping
    setTimeout(() => {
      onSimulateScraping();
      setScrapingLoading(false);
      alert("Proceso ETL completado: Datos extraídos y cargados correctamente.");
    }, 2000);
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleUpdateDefaulters = () => {
    if (!confirm("Esta acción verificará a todos los contribuyentes sin historial de pago y los marcará como 'MOROSO'. ¿Continuar?")) return;

    let updatedCount = 0;

    // Find taxpayers with no transactions
    // Optimization: Create a Set of IDs from transactions
    const taxpayerIdsWithTransactions = new Set(transactions.map(t => t.taxpayerId));

    taxpayers.forEach(tp => {
      // If not in transaction list AND status is not already MOROSO (or other finalized status if any)
      if (!taxpayerIdsWithTransactions.has(tp.id) && tp.status === TaxpayerStatus.ACTIVO) {
        const updatedTp = { ...tp, status: TaxpayerStatus.MOROSO };
        onUpdateTaxpayer(updatedTp);
        updatedCount++;
      }
    });

    alert(`Proceso completado. ${updatedCount} contribuyentes marcados como Morosos.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
    // Reset value so we can select same file again if needed
    if (e.target) e.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configuración del Sistema</h2>
          <p className="text-slate-500">Panel de Administrador - Alcaldía</p>
        </div>
        <button
          onClick={handleSaveAll}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg flex items-center hover:bg-emerald-700 shadow-md font-bold transition-transform active:scale-95"
        >
          <Save size={20} className="mr-2" />
          Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ... Municipality and Rates Config (unchanged) ... */}

        {/* --- Municipality Info Section --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <div className="flex items-center mb-6 text-slate-800 border-b pb-2">
            <Building className="mr-2 text-indigo-600" />
            <h3 className="text-lg font-bold">Información Institucional (Encabezado Factura)</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Nombre de la Entidad</label>
              <input
                type="text"
                value={localMuniInfo.name}
                onChange={(e) => handleMuniChange('name', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Provincia / Región</label>
              <input
                type="text"
                value={localMuniInfo.province}
                onChange={(e) => handleMuniChange('province', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">RUC</label>
                <input
                  type="text"
                  value={localMuniInfo.ruc}
                  onChange={(e) => handleMuniChange('ruc', e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Teléfono</label>
                <input
                  type="text"
                  value={localMuniInfo.phone}
                  onChange={(e) => handleMuniChange('phone', e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Correo Electrónico</label>
              <input
                type="text"
                value={localMuniInfo.email}
                onChange={(e) => handleMuniChange('email', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Dirección Física</label>
              <input
                type="text"
                value={localMuniInfo.address}
                onChange={(e) => handleMuniChange('address', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
          </div>
        </div>



        {/* --- DATA MANAGEMENT SECTION (New) --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6 border-b pb-2">
            <div className="flex items-center text-slate-800">
              <Database className="mr-2 text-blue-600" />
              <h3 className="text-lg font-bold">Gestión de Datos y Base de Datos</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Database Actions */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 flex items-center">
                <FileSpreadsheet size={18} className="mr-2 text-emerald-600" /> Respaldo y Mantenimiento
              </h4>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-500">Estado del Servicio:</span>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                    Activo
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Descargue respaldos, importe datos o ejecute diagnósticos de morosidad.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={onBackup}
                    className="w-full flex items-center justify-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold transition-colors"
                  >
                    <Download size={18} className="mr-2" />
                    Descargar Respaldo (Excel)
                  </button>

                  <button
                    onClick={triggerImport}
                    className="w-full flex items-center justify-center bg-white text-slate-700 border border-slate-300 py-2 rounded-lg hover:bg-slate-50 font-bold transition-colors"
                  >
                    <Upload size={18} className="mr-2" />
                    Importar Datos (Excel)
                  </button>

                  <button
                    onClick={handleUpdateDefaulters}
                    className="w-full flex items-center justify-center bg-amber-100 text-amber-800 border border-amber-200 py-2 rounded-lg hover:bg-amber-200 font-bold transition-colors"
                  >
                    <RefreshCw size={18} className="mr-2" />
                    Actualizar Morosidad (Sin Pagos)
                  </button>

                  <button
                    onClick={onHardReset}
                    className="w-full flex items-center justify-center bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg hover:bg-red-600 hover:text-white font-bold transition-all mt-4"
                  >
                    <Shield size={18} className="mr-2" />
                    REINICIO MAESTRO (Borrar Todo)
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </div>

            {/* ETL / Scraping Actions */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 flex items-center">
                <Globe size={18} className="mr-2" /> Web Scraping (Gob.pa)
              </h4>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-400 mb-4">
                  Extraccion automatica desde <strong>panamaemprende.gob.pa</strong> para detectar negocios con Aviso de Operaciones en el Distrito de Almirante que no estan en el padron municipal. Ver panel completo abajo.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={executeScraping}
                    disabled={scrapingLoading}
                    className={`w-full flex items-center justify-center py-2 rounded-lg font-bold border transition-colors ${scrapingLoading
                      ? 'bg-slate-200 text-slate-500 border-slate-300'
                      : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                      }`}
                  >
                    {scrapingLoading ? (
                      <>Procesando ETL...</>
                    ) : (
                      <>
                        <Globe size={18} className="mr-2" />
                        Sincronizar Web (Scraping)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- ESTRUCTURA TRIBUTARIA ADMIN PANEL --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center mb-6 border-b pb-3">
            <BookOpen className="mr-2 text-indigo-600" size={20} />
            <div>
              <h3 className="text-lg font-bold text-slate-800">Administración de Estructura Tributaria</h3>
              <p className="text-xs text-slate-500">Edite, agregue o elimine códigos, actividades y tarifas (Pequeño / Mediano / Grande)</p>
            </div>
          </div>
          <TaxStructureAdmin />
        </div>

        {/* --- PANAMA EMPRENDE FULL SCRAPER PANEL --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center mb-6 border-b pb-3">
            <Globe className="mr-2 text-indigo-600" size={20} />
            <div>
              <h3 className="text-lg font-bold text-slate-800">Scraping Panama Emprende</h3>
              <p className="text-xs text-slate-500">Deteccion de negocios con Aviso de Operaciones no inscritos en el municipio</p>
            </div>
          </div>
          <GovScraper
            taxpayers={taxpayers}
            onImportTaxpayer={onImportTaxpayer}
            currentUserName={currentUserName}
          />
        </div>

        {/* --- User Roles Management --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6 border-b pb-2">
            <div className="flex items-center text-slate-800">
              <Shield className="mr-2 text-amber-600" />
              <h3 className="text-lg font-bold">Gestión de Usuarios</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u, idx) => (
              <div key={idx} className={`p-4 rounded-lg flex justify-between items-center border transition-all group hover:ring-2 hover:ring-indigo-100 ${
                u.status === 'SUSPENDIDO' 
                  ? 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-75' 
                  : 'bg-slate-50 border-slate-100 text-slate-800'
              }`}>
                <div className="flex items-center">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                    u.status === 'SUSPENDIDO' ? 'bg-slate-400' :
                    u.role === 'ADMIN' ? 'bg-indigo-600' :
                    u.role === 'CONTABILIDAD' ? 'bg-teal-600' :
                    u.role === 'PLANILLA' ? 'bg-violet-600' : 'bg-emerald-600'
                    }`}>
                    {u.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-bold ${u.status === 'SUSPENDIDO' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{u.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        u.status === 'SUSPENDIDO' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {u.status === 'SUSPENDIDO' ? 'Suspendido' : 'Activo'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Usuario: {u.username} • <span className={
                      u.role === 'ADMIN' ? 'text-indigo-600 font-medium' :
                      u.role === 'CONTABILIDAD' ? 'text-teal-600 font-medium' :
                      u.role === 'PLANILLA' ? 'text-violet-600 font-medium' : 'text-emerald-600 font-medium'
                    }>{u.role}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {/* Reset Password */}
                  <button
                    onClick={() => openPwdModal(u)}
                    className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-full transition-colors"
                    title="Cambiar Contraseña"
                  >
                    <Shield size={14} />
                  </button>
                  
                  {/* Suspend / Activate */}
                  <button
                    onClick={() => {
                      const newStatus = u.status === 'SUSPENDIDO' ? 'ACTIVO' : 'SUSPENDIDO';
                      const confirmMsg = newStatus === 'SUSPENDIDO' 
                        ? `¿Está seguro de SUSPENDER las credenciales de ${u.name}? No podrá iniciar sesión.`
                        : `¿Está seguro de ACTIVAR las credenciales de ${u.name}?`;
                      if (confirm(confirmMsg)) {
                        onUpdateUser({ ...u, status: newStatus });
                      }
                    }}
                    className={`p-1.5 rounded-full transition-colors ${
                      u.status === 'SUSPENDIDO' 
                        ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' 
                        : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
                    }`}
                    title={u.status === 'SUSPENDIDO' ? 'Activar Cuenta' : 'Suspender Cuenta'}
                  >
                    <Power size={14} />
                  </button>

                  {/* Delete User */}
                  {u.role !== 'ADMIN' && (
                    <button
                      onClick={() => {
                        if (confirm(`⚠️ ¿Está seguro de ELIMINAR permanentemente la cuenta de ${u.name}? Esta acción no se puede deshacer.`)) {
                          onDeleteUser(u.username);
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                      title="Eliminar Usuario"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowUserModal(true)}
              className="p-4 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer"
            >
              <UserPlus size={24} className="mb-2" />
              <span className="font-bold text-sm">Crear Nuevo Usuario</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- ADD USER MODAL --- */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Registrar Nuevo Usuario</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={submitNewUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nombre Completo del Empleado</label>
                <input
                  required
                  type="text"
                  className="w-full mt-1 p-2 border rounded-lg text-black"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Rol / Cargo</label>
                <select
                  className="w-full mt-1 p-2 border rounded-lg bg-white text-black"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                >
                  <option value="CAJERO">Cajero (Cobros)</option>
                  <option value="REGISTRO">Oficial de Registro (Trámites)</option>
                  <option value="ADMIN">Administrador (Total)</option>
                  <option value="AUDITOR">Auditor (Solo Lectura)</option>
                  <option value="ALCALDE">Alcalde (Dashboard Ejecutivo)</option>
                  <option value="SECRETARIA">Secretaría (Compromisos)</option>
                  <option value="CONTRIBUYENTE">Contribuyente (Acceso Portal)</option>
                  <option value="CONTABILIDAD">Contabilidad (Dashboard Contable)</option>
                  <option value="PLANILLA">Planilla y RRHH (Dashboard Nómina)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Usuario (Login)</label>
                  <input
                    required
                    type="text"
                    className="w-full mt-1 p-2 border rounded-lg text-black"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Ej. jperez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                  <input
                    required
                    type="text"
                    className="w-full mt-1 p-2 border rounded-lg text-black"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="******"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CHANGE PASSWORD MODAL --- */}
      {showPwdModal && userToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-in border-t-8 border-indigo-600">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Cambiar Contraseña</h3>
            <p className="text-slate-600 text-sm mb-4">
              Actualizar credenciales para: <span className="font-bold text-indigo-600">{userToEdit.username}</span>
            </p>

            <form onSubmit={submitChangePwd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nueva Contraseña</label>
                <input
                  required
                  type="text"
                  autoFocus
                  className="w-full mt-1 p-2 border rounded-lg text-black bg-slate-50"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};