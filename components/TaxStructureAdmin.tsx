import React, { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, Search, ChevronDown, ChevronUp, Download, Upload, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import taxStructureRaw from '../data/taxStructure.json';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TaxRate {
  PEQUENO: number | string;
  MEDIANO: number | string;
  GRANDE: number | string;
}

interface TaxEntry {
  code: string;
  activity: string;
  rates: TaxRate;
}

// ─── Local Storage key ───────────────────────────────────────────────────────
const STORAGE_KEY = 'sigma_custom_tax_structure';

function loadStructure(): TaxEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return taxStructureRaw as TaxEntry[];
}

function saveStructure(data: TaxEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── Component ──────────────────────────────────────────────────────────────
export const TaxStructureAdmin: React.FC = () => {
  const [entries, setEntries] = useState<TaxEntry[]>(loadStructure);
  const [search, setSearch] = useState('');
  const [editingEntry, setEditingEntry] = useState<TaxEntry | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyEntry: TaxEntry = {
    code: '',
    activity: '',
    rates: { PEQUENO: 0, MEDIANO: 0, GRANDE: 0 }
  };
  const [newEntry, setNewEntry] = useState<TaxEntry>(emptyEntry);

  // Filtered & sorted
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries
      .filter(e =>
        e.code.toLowerCase().includes(q) ||
        e.activity.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const cmp = a.code.localeCompare(b.code);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [entries, search, sortDir]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const flashSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const persistAndFlash = (updated: TaxEntry[]) => {
    setEntries(updated);
    saveStructure(updated);
    flashSave();
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const handleAdd = () => {
    if (!newEntry.code.trim() || !newEntry.activity.trim()) {
      alert('El código y la actividad son obligatorios.');
      return;
    }
    if (entries.some(e => e.code === newEntry.code.trim())) {
      alert('Ya existe un código con ese número.');
      return;
    }
    const updated = [...entries, { ...newEntry, code: newEntry.code.trim(), activity: newEntry.activity.trim() }];
    persistAndFlash(updated);
    setNewEntry(emptyEntry);
    setIsAdding(false);
  };

  const handleEdit = (entry: TaxEntry) => {
    setEditingEntry({ ...entry, rates: { ...entry.rates } });
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;
    const updated = entries.map(e => e.code === editingEntry.code ? editingEntry : e);
    persistAndFlash(updated);
    setEditingEntry(null);
  };

  const handleDelete = (code: string) => {
    const updated = entries.filter(e => e.code !== code);
    persistAndFlash(updated);
    setDeleteConfirm(null);
  };

  const handleRestore = () => {
    if (!confirm('¿Está seguro de restaurar la estructura original? Se perderán todos los cambios personalizados.')) return;
    const original = taxStructureRaw as TaxEntry[];
    setEntries(original);
    saveStructure(original);
    flashSave();
  };

  // ── Export / Import ───────────────────────────────────────────────────────

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taxStructure_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as TaxEntry[];
        if (!Array.isArray(parsed)) throw new Error('Formato inválido');
        persistAndFlash(parsed);
        alert(`Se importaron ${parsed.length} actividades correctamente.`);
      } catch {
        alert('El archivo JSON no tiene el formato correcto.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Rate display helper ───────────────────────────────────────────────────

  const formatRate = (val: number | string | any) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val);
    if (isNaN(num)) {
      // It's a descriptive string
      const s = String(val);
      return s.length > 28 ? s.substring(0, 28) + '…' : s;
    }
    return num === 0 ? '—' : `B/. ${num.toFixed(2)}`;
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Estructura Tributaria</h3>
          <p className="text-sm text-slate-500">{entries.length} actividades registradas · Los cambios se guardan automáticamente</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {savedNotice && (
            <span className="flex items-center gap-1 text-emerald-700 text-xs font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full animate-fade-in">
              <CheckCircle size={12} /> Guardado
            </span>
          )}

          <label className="cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all shadow-sm">
            <Upload size={14} /> Importar JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={14} /> Exportar
          </button>

          <button
            onClick={handleRestore}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg hover:bg-amber-100 transition-all shadow-sm"
          >
            <RefreshCw size={14} /> Restaurar Original
          </button>

          <button
            onClick={() => { setIsAdding(true); setNewEntry(emptyEntry); }}
            className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
          >
            <Plus size={14} /> Nueva Actividad
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código o actividad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all bg-white"
          />
        </div>
        <button
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all"
        >
          {sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Código
        </button>
      </div>

      {/* ── Add New Entry Form ── */}
      {isAdding && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 animate-fade-in">
          <h4 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
            <Plus size={16} /> Nueva Actividad Tributaria
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase">Código</label>
              <input
                type="text"
                placeholder="Ej. 11.25.01"
                value={newEntry.code}
                onChange={e => setNewEntry(p => ({ ...p, code: e.target.value }))}
                className="w-full p-2.5 border border-indigo-200 rounded-xl text-sm font-mono bg-white focus:ring-2 focus:ring-indigo-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase">Actividad</label>
              <input
                type="text"
                placeholder="Descripción de la actividad"
                value={newEntry.activity}
                onChange={e => setNewEntry(p => ({ ...p, activity: e.target.value }))}
                className="w-full p-2.5 border border-indigo-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-300 outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {(['PEQUENO', 'MEDIANO', 'GRANDE'] as const).map(size => (
              <div key={size}>
                <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase">{size === 'PEQUENO' ? 'Pequeño' : size === 'MEDIANO' ? 'Mediano' : 'Grande'} (B/.)</label>
                <input
                  type="text"
                  placeholder="0.00 o descripción"
                  value={newEntry.rates[size]}
                  onChange={e => {
                    const val = e.target.value;
                    const parsed = parseFloat(val);
                    setNewEntry(p => ({ ...p, rates: { ...p.rates, [size]: isNaN(parsed) ? val : parsed } }));
                  }}
                  className="w-full p-2.5 border border-indigo-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-300 outline-none"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsAdding(false)} className="flex-1 py-2.5 border border-slate-200 bg-white text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleAdd} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 flex items-center justify-center gap-2">
              <Save size={14} /> Agregar Actividad
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 bg-slate-50 border-b border-slate-200 px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="col-span-2">Código</div>
          <div className="col-span-4">Actividad</div>
          <div className="col-span-2 text-center">Pequeño</div>
          <div className="col-span-2 text-center">Mediano</div>
          <div className="col-span-1 text-center">Grande</div>
          <div className="col-span-1 text-center">Acción</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Search size={32} className="mx-auto mb-2 opacity-30" />
              <p>No se encontraron actividades</p>
            </div>
          ) : (
            filtered.map(entry => (
              <div key={entry.code}>
                {/* ── Normal row ── */}
                {editingEntry?.code !== entry.code ? (
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 transition-colors group">
                    <div className="col-span-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{entry.code}</span>
                    </div>
                    <div className="col-span-4 text-sm text-slate-700 leading-snug">{entry.activity}</div>
                    <div className="col-span-2 text-center text-sm text-slate-600">{formatRate(entry.rates.PEQUENO)}</div>
                    <div className="col-span-2 text-center text-sm text-slate-600">{formatRate(entry.rates.MEDIANO)}</div>
                    <div className="col-span-1 text-center text-sm text-slate-600">{formatRate(entry.rates.GRANDE)}</div>
                    <div className="col-span-1 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(entry.code)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Delete confirm inline */}
                    {deleteConfirm === entry.code && (
                      <div className="col-span-12 mt-2 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2 text-red-700 text-sm">
                          <AlertTriangle size={16} />
                          <span>¿Eliminar <strong>{entry.code}</strong>?</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-50">Cancelar</button>
                          <button onClick={() => handleDelete(entry.code)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700">Eliminar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Edit row ── */
                  <div className="px-4 py-4 bg-amber-50 border-l-4 border-amber-400 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-bold text-amber-700 mb-1">CÓDIGO</label>
                        <input
                          type="text"
                          value={editingEntry.code}
                          disabled
                          className="w-full p-2.5 border border-amber-200 rounded-xl text-sm font-mono bg-amber-100 text-amber-800 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-amber-700 mb-1">ACTIVIDAD</label>
                        <input
                          type="text"
                          value={editingEntry.activity}
                          onChange={e => setEditingEntry(p => p ? ({ ...p, activity: e.target.value }) : p)}
                          className="w-full p-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {(['PEQUENO', 'MEDIANO', 'GRANDE'] as const).map(size => (
                        <div key={size}>
                          <label className="block text-xs font-bold text-amber-700 mb-1 uppercase">{size === 'PEQUENO' ? 'Pequeño' : size === 'MEDIANO' ? 'Mediano' : 'Grande'} (B/.)</label>
                          <input
                            type="text"
                            value={editingEntry.rates[size]}
                            onChange={e => {
                              const val = e.target.value;
                              const parsed = parseFloat(val);
                              setEditingEntry(p => p ? ({ ...p, rates: { ...p.rates, [size]: isNaN(parsed) ? val : parsed } }) : p);
                            }}
                            className="w-full p-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setEditingEntry(null)} className="flex-1 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 flex items-center justify-center gap-1.5">
                        <X size={14} /> Cancelar
                      </button>
                      <button onClick={handleSaveEdit} className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 flex items-center justify-center gap-1.5 shadow-sm shadow-amber-200">
                        <Save size={14} /> Guardar Cambios
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Table footer summary */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Mostrando {filtered.length} de {entries.length} actividades</span>
          <span>Almacenado localmente en este navegador</span>
        </div>
      </div>
    </div>
  );
};
