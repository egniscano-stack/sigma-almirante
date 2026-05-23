import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    Building2, FileText, User, MapPin,
    CheckCircle, Printer, Download, ArrowLeft, X, Check,
    Banknote, BadgeCheck, Shield, Receipt, ShieldAlert
} from 'lucide-react';
import { MunicipalityInfo, TaxType } from '../types';

interface ConstructionTaxProps {
    currentUserName: string;
    municipalityInfo: MunicipalityInfo;
    onBack: () => void;
    onPayment: (data: any) => void;
}

interface ConstructionData {
    fullName: string;
    docId: string;
    address: string;
    amount: number;
    description: string;
    projectType: string;
}

interface ConstructionInvoice {
    invoiceId: string;
    issuedAt: string;
    data: ConstructionData;
    amount: number;
    taxType: string;
    tellerName: string;
    verificationCode: string;
    qrUrl: string;
}

// Helper to format currency with thousands separator (1,000.00)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export const ConstructionTax: React.FC<ConstructionTaxProps> = ({ currentUserName, municipalityInfo, onBack, onPayment }) => {
    const [step, setStep] = useState<'form' | 'preview' | 'invoice'>('form');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [invoice, setInvoice] = useState<ConstructionInvoice | null>(null);
    
    const [formData, setFormData] = useState<ConstructionData>({
        fullName: '',
        docId: '',
        address: '',
        amount: 0,
        description: '',
        projectType: 'Residencial',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const setField = (field: keyof ConstructionData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const inputCls = (field: string) => `w-full p-4 rounded-xl border-2 ${errors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-amber-500 bg-slate-50'} transition-all text-slate-800 outline-none font-medium`;

    const handleReset = () => {
        setFormData({
            fullName: '',
            docId: '',
            address: '',
            amount: 0,
            description: '',
            projectType: 'Residencial',
        });
        setInvoice(null);
        setStep('form');
        setErrors({});
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!formData.fullName.trim()) errs.fullName = 'Nombre completo requerido';
        if (!formData.docId.trim()) errs.docId = 'Cédula o RUC requerido';
        if (!formData.address.trim()) errs.address = 'Dirección requerida';
        if (formData.amount <= 0) errs.amount = 'El monto debe ser mayor a 0';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handlePreview = () => {
        if (!validate()) return;
        setStep('preview');
    };

    const handleConfirmPayment = () => {
        const verificationCode = `CONST-${Date.now().toString(36).toUpperCase()}-${formData.docId.slice(-4).toUpperCase()}`;
        const invoiceId = `CT-${Date.now()}`;
        const qrUrl = `https://almirante.gob.pa/verify/construction/${invoiceId}?code=${verificationCode}`;

        const newInvoice: ConstructionInvoice = {
            invoiceId,
            issuedAt: new Date().toISOString(),
            data: { ...formData },
            amount: formData.amount,
            taxType: 'IMPUESTO DE CONSTRUCCIÓN MUNICIPAL',
            tellerName: currentUserName,
            verificationCode,
            qrUrl,
        };

        // Also register the payment in the main system
        onPayment({
          taxType: TaxType.CONSTRUCCION,
          taxpayerId: null, // Manual payment without registered taxpayer
          amount: formData.amount,
          paymentMethod: 'EFECTIVO',
          description: `Impuesto Construcción: ${formData.fullName} - ${formData.description || 'Sin descripción'}`,
          metadata: { 
            manualPayer: formData.fullName,
            manualDocId: formData.docId,
            manualAddress: formData.address,
            isManualConstruction: true
          }
        });

        setInvoice(newInvoice);
        setStep('invoice');
    };

    const handlePrint = () => window.print();

    const handleDownloadPDF = async () => {
        const element = document.getElementById('construction-invoice-print');
        if (!element) return;
        setIsGeneratingPdf(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                ignoreElements: (el) => el.classList.contains('no-print'),
                backgroundColor: '#ffffff',
                useCORS: true,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`Impuesto_Construccion_${invoice?.data.docId}_${invoice?.invoiceId}.pdf`);
        } catch (e) {
            console.error('Error generating PDF:', e);
            alert('Error al generar el PDF.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (step === 'preview') {
        const previewDate = new Date();
        const formattedDate = previewDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = previewDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center py-2 px-4 animate-scale-up">
                <div className="w-full max-w-2xl flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <ShieldAlert className="text-amber-500 animate-pulse" />
                        Vista Previa: Borrador de Impuesto de Construcción
                    </h2>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button onClick={handleConfirmPayment} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95">
                            <Check size={16} /> Confirmar y Cobrar
                        </button>
                        <button onClick={() => setStep('form')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95">
                            <ArrowLeft size={16} /> Corregir Datos
                        </button>
                    </div>
                </div>

                {/* Draft Warning Alert */}
                <div className="w-full max-w-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs py-3 px-5 rounded-2xl mb-6 text-center leading-relaxed">
                    ⚠️ <strong>ESTADO: BORRADOR PRELIMINAR.</strong> Por favor, verifique detalladamente todos los campos del contribuyente e importe a cobrar. Al hacer clic en "Confirmar y Cobrar" se registrará de forma oficial en el sistema.
                </div>

                {/* Visual Draft Certificate */}
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden mt-0 opacity-90 border-4 border-dashed border-amber-500/40 relative">
                    <div className="absolute inset-0 bg-amber-500/[0.02] pointer-events-none" />
                    <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-500" />
                    
                    <div className="px-4 pt-2 pb-3 border-b-2 border-slate-200 bg-slate-50/50">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <img src={`${import.meta.env.BASE_URL}logo-municipio.png`} className="h-40 w-auto object-contain -ml-4 grayscale opacity-60" alt="Logo" />
                                <div>
                                    <h1 className="font-extrabold text-slate-800 text-base uppercase leading-none tracking-tight">Municipio de Almirante</h1>
                                    <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Ingeniería Municipal • RUC: 1-22-333 DV 44</p>
                                    <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                                        VISTA PREVIA
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="inline-block bg-slate-800 text-white px-3 py-1.5 rounded-xl">
                                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest leading-none">Nº RECIBO</p>
                                    <p className="font-mono font-extrabold text-amber-400 text-xs tracking-wider mt-1">CT-BORRADOR</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{formattedDate}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-600 to-orange-700 px-8 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Building2 className="text-white animate-pulse" size={24} />
                            <div>
                                <h2 className="text-white font-extrabold text-lg uppercase tracking-wide">Impuesto de Construcción</h2>
                                <p className="text-amber-100 text-[10px] font-medium uppercase tracking-widest">Borrador de Liquidación</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-amber-100 text-xs font-bold">TOTAL A PAGAR</p>
                            <p className="text-white font-extrabold text-3xl">B/. {formatCurrency(formData.amount)}</p>
                        </div>
                    </div>

                    <div className="px-8 py-6 grid grid-cols-2 gap-x-8 gap-y-6">
                        <div className="col-span-2">
                            <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3 border-b border-slate-100 pb-1">Datos del Contribuyente</h3>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Nombre Completo / Razón Social</p>
                            <p className="font-extrabold text-slate-900 text-lg uppercase">{formData.fullName || 'NO ESPECIFICADO'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Identificación (Cédula / RUC)</p>
                            <p className="font-mono font-bold text-slate-700 text-base">{formData.docId || 'NO ESPECIFICADO'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Tipo de Proyecto</p>
                            <p className="font-bold text-slate-700 text-base">{formData.projectType}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Ubicación de la Obra</p>
                            <p className="text-slate-700 text-sm font-medium flex items-center gap-1"><MapPin size={12} className="text-amber-600" /> {formData.address || 'NO ESPECIFICADA'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Descripción de los Trabajos</p>
                            <p className="text-slate-700 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">{formData.description || 'No especificada'}</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 px-8 py-5 border-t border-slate-100 flex justify-between items-center">
                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Cajero / Recaudador</p>
                            <p className="text-slate-700 font-bold text-xs">{currentUserName}</p>
                        </div>
                        <p className="text-[8px] text-slate-400 text-right">Vista previa de liquidación • SIGMA Digital</p>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'invoice' && invoice) {
        const issuedDate = new Date(invoice.issuedAt);
        const formattedDate = issuedDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = issuedDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center py-2 px-4">
                <div className="w-full max-w-2xl flex justify-between items-center mb-4 no-print">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <BadgeCheck className="text-amber-400" />
                        Factura de Construcción Lista
                    </h2>
                    <div className="flex gap-3">
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg">
                            <Printer size={16} /> Imprimir
                        </button>
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg">
                            <Download size={16} /> {isGeneratingPdf ? 'Generando...' : 'PDF'}
                        </button>
                        <button onClick={handleReset} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">
                            <ArrowLeft size={16} /> Nuevo
                        </button>
                    </div>
                </div>

                <div id="construction-invoice-print" className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden mt-0">
                    <div className="h-2 bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700" />
                    <div className="px-4 pt-2 pb-3 border-b-2 border-slate-200 bg-slate-50/50">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <img src={`${import.meta.env.BASE_URL}logo-municipio.png`} className="h-64 w-auto object-contain -ml-8" alt="Logo Municipio" />
                                <div>
                                    <h1 className="font-extrabold text-slate-800 text-base uppercase leading-none tracking-tight">Municipio de Almirante</h1>
                                    <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Provincia de Bocas del Toro, República de Panamá</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RUC: 1-22-333 DV 44</p>
                                    <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider">
                                        <Building2 size={12} /> Ingeniería Municipal
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="inline-block bg-slate-900 text-white px-4 py-2 rounded-xl">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Recibo de Pago</p>
                                    <p className="font-mono font-extrabold text-amber-400 text-base tracking-wider">{invoice.invoiceId}</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{formattedDate}</p>
                                <p className="text-xs text-slate-400">{formattedTime} hrs</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-700 to-orange-800 px-8 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Building2 className="text-white" size={24} />
                            <div>
                                <h2 className="text-white font-extrabold text-lg uppercase tracking-wide">Impuesto de Construcción</h2>
                                <p className="text-amber-100 text-[10px] font-medium uppercase tracking-widest">Pago Único por Permiso de Obra</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-amber-100 text-xs font-bold">TOTAL CANCELADO</p>
                            <p className="text-white font-extrabold text-3xl">B/. {formatCurrency(invoice.amount)}</p>
                        </div>
                    </div>

                    <div className="px-8 py-6 grid grid-cols-2 gap-x-8 gap-y-6">
                        <div className="col-span-2">
                            <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3 border-b border-slate-100 pb-1">Datos del Contribuyente</h3>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Nombre Completo / Razón Social</p>
                            <p className="font-extrabold text-slate-900 text-lg uppercase">{invoice.data.fullName}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Identificación (Cédula / RUC)</p>
                            <p className="font-mono font-bold text-slate-700 text-base">{invoice.data.docId}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Tipo de Proyecto</p>
                            <p className="font-bold text-slate-700 text-base">{invoice.data.projectType}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Ubicación de la Obra</p>
                            <p className="text-slate-700 text-sm font-medium flex items-center gap-1"><MapPin size={12} className="text-amber-600" /> {invoice.data.address}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Descripción de los Trabajos</p>
                            <p className="text-slate-700 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">{invoice.data.description || 'No especificada'}</p>
                        </div>

                        <div className="col-span-2 mt-4 bg-amber-50 rounded-2xl p-6 border border-amber-100 flex items-center gap-8">
                            <div className="bg-white p-2 rounded-xl shadow-sm border border-amber-100">
                                <QRCodeSVG value={invoice.qrUrl} size={120} level="H" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-amber-800 font-extrabold text-base uppercase tracking-wide flex items-center gap-2">
                                    <Shield size={20} className="text-amber-600" /> Validación de Ingeniería
                                </h4>
                                <p className="text-amber-700 text-[11px] mt-2 leading-relaxed">Este recibo es el comprobante oficial de pago del impuesto de construcción. Debe mantenerse en el sitio de la obra para inspección de las autoridades municipales.</p>
                                <div className="mt-4 inline-block bg-amber-600 text-white font-mono text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest">ID: {invoice.verificationCode}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex justify-between items-end">
                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-1">Cajero / Recaudador</p>
                            <p className="text-slate-700 font-bold text-sm">{invoice.tellerName}</p>
                        </div>
                        <p className="text-[8px] text-slate-400 text-right leading-relaxed max-w-[250px]">Generado por SIGMA Digital • Municipio de Almirante, Bocas del Toro.<br/>Verifique este documento en: <span className="font-mono font-bold">almirante.gob.pa/verify</span></p>
                    </div>
                    <div className="h-2 bg-gradient-to-r from-amber-600 to-orange-800" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-20 animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"><ArrowLeft size={20} /></button>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <span className="p-2 bg-amber-100 rounded-xl text-amber-600"><Building2 size={24} /></span>
                        Cobro de Construcción
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Gestión manual de impuestos por obras y remodelaciones.</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-br from-slate-800 to-slate-950 p-8 text-white">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-amber-500 p-3 rounded-2xl shadow-lg shadow-amber-500/20"><Banknote size={32} /></div>
                            <div>
                                <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Módulo de Recaudación</p>
                                <h3 className="text-2xl font-black">Ingreso Manual</h3>
                            </div>
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Total a Recaudar</p>
                            <p className="text-4xl font-black text-amber-400">B/. {formatCurrency(formData.amount)}</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Nombre Completo / Razón Social</label>
                            <input type="text" value={formData.fullName ?? ''} onChange={e => setField('fullName', e.target.value.toUpperCase())} className={inputCls('fullName')} placeholder="Ej: JUAN PEREZ o CONSTRUCTORA S.A." />
                            {errors.fullName && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.fullName}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Identificación (Cédula / RUC)</label>
                            <input type="text" value={formData.docId ?? ''} onChange={e => setField('docId', e.target.value.toUpperCase())} className={inputCls('docId')} placeholder="0-000-0000" />
                            {errors.docId && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.docId}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Tipo de Proyecto</label>
                            <select 
                                value={formData.projectType ?? ''} 
                                onChange={e => setField('projectType', e.target.value)} 
                                className={inputCls('projectType')}
                            >
                                <option value="Residencial">Residencial</option>
                                <option value="Comercial">Comercial</option>
                                <option value="Industrial">Industrial</option>
                                <option value="Otros">Otros</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Monto del Impuesto (B/.)</label>
                            <input type="number" inputMode="decimal" step="0.01" value={formData.amount > 0 ? formData.amount : ''} onChange={e => setField('amount', Number(e.target.value))} className={`${inputCls('amount')} text-2xl font-black text-amber-600`} placeholder="0.00" />
                            {errors.amount && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.amount}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Ubicación de la Obra</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input type="text" value={formData.address ?? ''} onChange={e => setField('address', e.target.value)} className={`${inputCls('address')} pl-12`} placeholder="Ej: Calle Principal, Almirante..." />
                            </div>
                            {errors.address && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.address}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Descripción del Proyecto</label>
                            <textarea rows={3} value={formData.description ?? ''} onChange={e => setField('description', e.target.value)} className={inputCls('description')} placeholder="Breve descripción de los trabajos a realizar..." />
                        </div>
                    </div>

                    <button onClick={handlePreview} className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-xl shadow-slate-200">
                        <Receipt size={24} /> VER VISTA PREVIA Y CONFIRMAR COBRO
                    </button>
                </div>
            </div>
        </div>
    );
};
