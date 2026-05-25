import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    Building2, FileText, User, MapPin,
    CheckCircle, Printer, Download, ArrowLeft, X, Check,
    Banknote, BadgeCheck, Shield, Receipt, ShieldAlert
} from 'lucide-react';
import { MunicipalityInfo, TaxType, AdminRequest } from '../types';

interface ConstructionTaxProps {
    currentUserName: string;
    municipalityInfo: MunicipalityInfo;
    adminRequests: AdminRequest[];
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

const isCaja1User = (name: string) => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    return lower === 'caja 1' || lower === 'caja1' || lower === 'danuris sanchez';
};

const resolveTellerName = (name: string) => {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    if (lower === 'caja 1' || lower === 'caja1') {
        return 'Danuris Sanchez';
    }
    return name;
};

const fineLabels: Record<string, string> = {
    '01_IMPUESTOS_MOROSOS': '01 - Impuestos Morosos',
    '02_ADMINISTRATIVAS': '02 - Administrativas',
    '03_LEGAL': '03 - Legal',
    '04_JUZGADO_DE_PAZ': '04 - Multas impuestas por Juzgado de Paz',
    '05_MULTAS_INGENIERIA': '05 - Multas de Ingeniería',
    '06_MAL_ESTACIONADO': '06 - Multas por mal Estacionados o estacionados en Aceras',
    '07_RUIDO': '07 - Multas por ruido',
    '08_PLACAS_VENCIDAS': '08 - Multas por Placas vencidas',
    '09_RECARGOS_MOROSOS': '09 - Recargos sobre Impuestos Morosos'
};

const chargeLabels: Record<string, string> = {
    PERMISO_CONSTRUCCION: 'Permiso de Construcción',
    PERMISO_OCUPACION: 'Permiso de Ocupación',
    CERTIFICACION_OCUPACION: 'Certificación de Ocupación',
    EXTRACCION_BALASTRE: 'Extracción de Balastre',
    ABONO_LOTE: 'Abono a Lote No.',
    CERTIFICACION_RESIDENCIA: 'Certificación de Residencia',
    APROBACION_PLANOS: 'Aprobación de Planos',
    APROBACION_ANTEPROYECTO: 'Aprobación de Anteproyecto',
    MULTA: 'Multa',
    OTROS: 'Otros Impuestos'
};

const getChargeTitle = (selectedReqId: string | null, adminRequests: AdminRequest[]) => {
    if (!selectedReqId) return 'Impuesto de Construcción';
    const req = adminRequests.find(r => r.id === selectedReqId);
    if (!req) return 'Impuesto de Construcción';
    const payload = req.payload || {};
    const engType = payload.engineeringType;
    if (engType === 'MULTA' && payload.fineType) {
        return `Multa: ${fineLabels[payload.fineType] || payload.fineType}`;
    }
    return chargeLabels[engType] || 'Cobro de Ingeniería';
};

const getChargeSubtitle = (selectedReqId: string | null, adminRequests: AdminRequest[]) => {
    if (!selectedReqId) return 'Pago Único por Permiso de Obra';
    const req = adminRequests.find(r => r.id === selectedReqId);
    if (!req) return 'Pago Único por Permiso de Obra';
    const payload = req.payload || {};
    const engType = payload.engineeringType;
    if (engType === 'MULTA') return 'Recaudación de Multa Municipal';
    return 'Ingreso por Tasa / Permiso Municipal';
};

export const ConstructionTax: React.FC<ConstructionTaxProps> = ({ currentUserName, municipalityInfo, adminRequests = [], onBack, onPayment }) => {
    const [step, setStep] = useState<'form' | 'preview' | 'invoice'>('form');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [invoice, setInvoice] = useState<ConstructionInvoice | null>(null);
    const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
    const [invoiceTab, setInvoiceTab] = useState<'ticket' | 'document'>('ticket');
    
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
        setSelectedReqId(null);
        setInvoiceTab('ticket');
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

        const chargeTitle = getChargeTitle(selectedReqId, adminRequests);

        const newInvoice: ConstructionInvoice = {
            invoiceId,
            issuedAt: new Date().toISOString(),
            data: { ...formData },
            amount: formData.amount,
            taxType: chargeTitle.toUpperCase(),
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
          description: `${chargeTitle}: ${formData.fullName} - ${formData.description || 'Sin descripción'}`,
          metadata: { 
            manualPayer: formData.fullName,
            manualDocId: formData.docId,
            manualAddress: formData.address,
            isManualConstruction: true,
            engineeringRequestId: selectedReqId || undefined
          }
        });

        setInvoice(newInvoice);
        setStep('invoice');
    };

    const handlePrint = () => {
        const printEl = document.getElementById('construction-invoice-print');
        if (!printEl) {
            window.print();
            return;
        }

        // Create temporary container
        const tempContainer = document.createElement('div');
        tempContainer.id = 'construction-print-temp-container';
        
        // Clone the element to preserve styles
        const clone = printEl.cloneNode(true) as HTMLElement;
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);

        // Determine layout dimensions based on step and selected tab
        let pageSize = 'letter portrait';
        let pageMargin = '12mm';
        let containerWidth = '100%';

        if (step === 'invoice' && invoiceTab === 'ticket') {
            pageSize = '80mm portrait';
            pageMargin = '0';
            containerWidth = '80mm';
        }

        // Create temporary style element
        const tempStyle = document.createElement('style');
        tempStyle.id = 'construction-print-temp-style';
        tempStyle.innerHTML = `
            @media print {
                /* Hide everything directly under body except our temp container */
                body > *:not(#construction-print-temp-container) {
                    display: none !important;
                }
                
                @page {
                    size: ${pageSize};
                    margin: ${pageMargin};
                }
                
                body {
                    background-color: white !important;
                    color: black !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    visibility: visible !important;
                }
                
                #construction-print-temp-container {
                    display: block !important;
                    visibility: visible !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: ${containerWidth} !important;
                    max-width: ${containerWidth} !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    opacity: 100 !important;
                }
                
                #construction-print-temp-container * {
                    visibility: visible !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .no-print {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(tempStyle);

        // Trigger print dialog
        window.print();

        // Cleanup
        setTimeout(() => {
            tempContainer.remove();
            tempStyle.remove();
        }, 150);
    };

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
            
            const fileName = invoice 
                ? `Recibo_${invoice.taxType.replace(/[^a-zA-Z0-9]/g, '_')}_${invoice.data.docId}_${invoice.invoiceId}.pdf`
                : `Borrador_${formData.docId || 'Contribuyente'}_${Date.now()}.pdf`;
            pdf.save(fileName);
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

        const previewInvoiceId = `CT-${Date.now()}`;
        const previewVerificationCode = `CONST-${Date.now().toString(36).toUpperCase()}-${(formData.docId || '0000').slice(-4).toUpperCase()}`;
        const previewQrUrl = `https://almirante.gob.pa/verify/construction/${previewInvoiceId}?code=${previewVerificationCode}`;

        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center py-2 px-4 animate-scale-up">
                <style>{`
                    @media print {
                        @page { 
                            size: letter portrait; 
                            margin: 10mm; 
                        }
                        body { visibility: hidden !important; background: white !important; }
                        #construction-invoice-print, #construction-invoice-print * { visibility: visible !important; }
                        #construction-invoice-print { 
                            position: absolute !important; left: 0 !important; top: 0 !important; 
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important; padding: 4mm 8mm !important; box-shadow: none !important; border: none !important; 
                            opacity: 100 !important;
                            min-height: 0 !important;
                            max-height: none !important;
                            height: auto !important;
                        }
                        .no-print { display: none !important; visibility: hidden !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>

                <div className="w-full max-w-2xl flex flex-col lg:flex-row justify-between items-center mb-4 gap-3 bg-slate-800 p-4 rounded-2xl border border-white/10 shadow-xl no-print">
                    <h2 className="text-white font-bold text-base flex items-center gap-2">
                        <ShieldAlert className="text-amber-500 animate-pulse animate-bounce" size={20} />
                        Borrador de {getChargeTitle(selectedReqId, adminRequests)}
                    </h2>
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
                        <button onClick={handlePrint} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95">
                            <Printer size={14} /> Imprimir Borrador
                        </button>
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-650 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95">
                            <Download size={14} /> {isGeneratingPdf ? 'Generando...' : 'PDF Borrador'}
                        </button>
                        <button onClick={handleConfirmPayment} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95">
                            <Check size={14} /> Confirmar y Cobrar
                        </button>
                        <button onClick={() => setStep('form')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 border border-slate-700">
                            <ArrowLeft size={14} /> Corregir
                        </button>
                    </div>
                </div>

                {/* Draft Warning Alert */}
                <div className="w-full max-w-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs py-3 px-5 rounded-2xl mb-6 text-center leading-relaxed no-print">
                    ⚠️ <strong>ESTADO: BORRADOR PRELIMINAR.</strong> Por favor, verifique detalladamente todos los campos del contribuyente e importe a cobrar. Al hacer clic en "Confirmar y Cobrar" se registrará de forma oficial en el sistema.
                </div>

                {/* Visual Draft Certificate */}
                <div id="construction-invoice-print" className="bg-white w-full max-w-[816px] flex flex-col relative mx-auto my-0 text-slate-850 p-8 py-6 select-text text-left border-4 border-dashed border-amber-500/40" style={{ fontFamily: 'Inter, system-ui, sans-serif', minHeight: '840px', maxHeight: '840px' }}>
                    
                    {/* === HEADER === */}
                    <div className="flex justify-between items-center mb-3 w-full">
                        {/* Left: Shield logo */}
                        <div className="w-40 flex flex-col items-start select-none text-left">
                            <img src={`${import.meta.env.BASE_URL}logo-municipio.png`} className="h-[115px] w-auto object-contain" alt="Escudo Municipal" />
                            <p className="font-extrabold text-slate-900 text-[7px] uppercase tracking-wider mt-1.5 leading-none">Municipio de Almirante</p>
                            <p className="text-slate-400 font-medium text-[5px] uppercase tracking-widest mt-0.5 leading-normal">Trabajo, Unidad, Superación<br/>y Salubridad</p>
                        </div>
                        
                        {/* Center: Municipal details */}
                        <div className="flex-1 text-center pt-1 flex flex-col items-center">
                            <h1 className="font-extrabold text-slate-900 text-xs uppercase tracking-widest leading-none">República de Panamá</h1>
                            <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider mt-1.5 leading-none">Municipio de Almirante</h2>
                            <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-[0.12em] leading-none">Provincia de Bocas del Toro</p>
                            <p className="text-[8px] font-semibold text-slate-450 uppercase tracking-widest leading-none mt-1">RUC: 1-22-333 DV 44</p>
                            
                            <div className="mt-3 inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 text-[9px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                                <Building2 size={10} className="text-amber-600" /> Ingeniería Municipal
                            </div>
                        </div>
                        
                        {/* Right: Receipt info */}
                        <div className="w-40 flex flex-col items-end pt-1 select-none">
                            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-right w-full">
                                <p className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Nº RECIBO</p>
                                <p className="font-mono font-extrabold text-slate-800 text-xs tracking-widest mt-0.5">
                                    {previewInvoiceId}
                                </p>
                                <div className="border-t border-slate-100 my-1.5"></div>
                                <p className="text-[9px] text-slate-500 font-bold leading-none">{formattedDate}</p>
                                <p className="text-[8px] text-slate-400 font-semibold mt-1 leading-none">{formattedTime} hrs</p>
                            </div>
                        </div>
                    </div>

                    {/* Separator line */}
                    <div className="border-b border-slate-200 my-2" />

                    {/* === TITLE BAR === */}
                    <div className="flex justify-between items-end my-3">
                        <div className="text-left">
                            <h2 className="text-slate-800 font-extrabold text-xl uppercase tracking-tight leading-none">
                                {getChargeTitle(selectedReqId, adminRequests)}
                            </h2>
                            <p className="text-amber-800 text-[10px] font-bold uppercase tracking-widest mt-1">
                                {getChargeSubtitle(selectedReqId, adminRequests)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-400 text-[8px] font-extrabold uppercase tracking-widest">Total a Pagar</p>
                            <p className="text-slate-800 font-black text-3xl mt-0.5">B/. {formatCurrency(formData.amount)}</p>
                        </div>
                    </div>

                    {/* === TAXPAYER DATA === */}
                    <div className="my-3 text-left">
                        <div className="mb-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Datos del Contribuyente</p>
                            <div className="border-b border-slate-200" />
                        </div>
                        
                        <div className="space-y-3.5">
                            <div>
                                <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Nombre Completo / Razón Social</p>
                                <p className="font-extrabold text-slate-900 text-base uppercase leading-tight">{formData.fullName || 'NO ESPECIFICADO'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                                <div>
                                    <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Identificación (Cédula / RUC)</p>
                                    <p className="font-mono font-bold text-slate-700 text-sm">{formData.docId || 'NO ESPECIFICADO'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Tipo de Proyecto</p>
                                    <p className="font-bold text-slate-700 text-sm">{formData.projectType}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Ubicación de la Obra</p>
                                <p className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                                    <span className="text-amber-600 text-xs">📍</span> {formData.address || 'NO ESPECIFICADA'}
                                </p>
                            </div>

                            <div>
                                <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Descripción de los Trabajos</p>
                                <p className="text-slate-700 text-xs font-bold leading-relaxed mt-0.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                                    {formData.description || 'No especificada'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* === QR + VALIDATION === */}
                    <div className="my-3.5 bg-amber-50/20 border border-amber-250/60 rounded-2xl p-4.5 py-4 flex items-center gap-6 text-left">
                        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-amber-100 select-none">
                            <QRCodeSVG value={previewQrUrl} size={90} level="H" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-amber-900 font-extrabold text-xs uppercase tracking-wide flex items-center gap-2">
                                <span className="text-amber-600 text-sm">🛡️</span> Validación de Ingeniería
                            </h4>
                            <p className="text-amber-800 text-[9px] mt-1 leading-relaxed font-semibold">
                                {getChargeTitle(selectedReqId, adminRequests).toUpperCase().includes('MULTA')
                                    ? 'Este recibo es el comprobante oficial del pago de la multa municipal. Conservar para cualquier trámite o solvencia ante las autoridades.'
                                    : 'Este recibo es el comprobante oficial de pago del impuesto de construcción. Debe mantenerse en el sitio de la obra para inspección de las autoridades municipales.'}
                            </p>
                            <div className="mt-3 inline-block bg-amber-600 text-white font-mono text-[8px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                ID: {previewVerificationCode}
                            </div>
                        </div>
                    </div>

                    {/* === FOOTER SIGNATURES === */}
                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end text-left min-h-[90px] w-full select-none">
                        {/* Left Column: Cajero / Recaudador */}
                        <div className="relative flex flex-col justify-end w-52 min-h-[85px]">
                            <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-1">Cajero / Recaudador</p>
                            <div className="relative h-16 flex items-center mb-1">
                                {isCaja1User(currentUserName) && (
                                    <img 
                                        src={`${import.meta.env.BASE_URL}firma-cajera-caja1.png`} 
                                        alt="Firma Cajera" 
                                        className="absolute -bottom-6 left-4 h-20 w-auto object-contain opacity-95 select-none pointer-events-none z-10" 
                                    />
                                )}
                            </div>
                            <div className="border-b border-slate-300 w-full mb-1"></div>
                            <p className="text-slate-800 font-bold text-xs uppercase">{resolveTellerName(currentUserName)}</p>
                        </div>

                        {/* Center Column: Sello de Ingeniería */}
                        <div className="relative flex flex-col justify-end w-44 min-h-[85px] text-center select-none">
                            <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-1">Sello de Ingeniería</p>
                            <div className="h-16 mb-1"></div> {/* Blank space for physical stamping */}
                        </div>

                        {/* Right Column: Ingeniero Municipal */}
                        <div className="relative flex flex-col justify-end w-52 min-h-[85px] text-right">
                            <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-1">Ingeniero Municipal</p>
                            <div className="h-16 mb-1"></div> {/* Blank space for physical signature */}
                            <div className="border-b border-slate-300 w-full mb-1"></div>
                            <p className="text-slate-800 font-bold text-xs uppercase">Ing. Joseph Camarena</p>
                            <p className="text-slate-450 font-bold text-[8px] uppercase tracking-wider mt-0.5">Ingeniería y Obras Municipales</p>
                        </div>
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
                <style>{`
                    @media print {
                        @page { 
                            size: ${invoiceTab === 'ticket' ? '80mm portrait' : 'letter portrait'}; 
                            margin: ${invoiceTab === 'ticket' ? '0' : '10mm'}; 
                        }
                        body { visibility: hidden !important; background: white !important; }
                        #construction-invoice-print, #construction-invoice-print * { visibility: visible !important; }
                        #construction-invoice-print { 
                            position: absolute !important; left: 0 !important; top: 0 !important; 
                            width: ${invoiceTab === 'ticket' ? '80mm' : '100%'} !important;
                            max-width: ${invoiceTab === 'ticket' ? '80mm' : '100%'} !important;
                            margin: 0 !important; padding: ${invoiceTab === 'ticket' ? '0' : '4mm 8mm'} !important; box-shadow: none !important; border: none !important; 
                            border-radius: 0 !important;
                            min-height: 0 !important;
                            max-height: none !important;
                            height: auto !important;
                        }
                        .no-print { display: none !important; visibility: hidden !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>
                {/* Control bar / Tabs */}
                <div className="w-full max-w-2xl flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 no-print bg-slate-800 p-3 rounded-2xl border border-white/10 shadow-xl">
                    <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-700/50 w-full sm:w-auto">
                        <button 
                            onClick={() => setInvoiceTab('ticket')}
                            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                invoiceTab === 'ticket' 
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Receipt size={14} /> 1. Factura de Caja (Ticket)
                        </button>
                        <button 
                            onClick={() => setInvoiceTab('document')}
                            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                invoiceTab === 'document' 
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <FileText size={14} /> 2. {invoice.taxType.toUpperCase().includes('MULTA') ? 'Documento de Multa' : 'Documento de Permiso'}
                        </button>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <button onClick={handlePrint} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95">
                            <Printer size={14} /> Imprimir
                        </button>
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95">
                            <Download size={14} /> {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
                        </button>
                        <button onClick={handleReset} className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95">
                            <ArrowLeft size={14} /> Finalizar
                        </button>
                    </div>
                </div>

                {/* Tab content */}
                {invoiceTab === 'ticket' ? (
                    <div className="flex flex-col gap-6 items-center w-full">
                        {/* Compact Thermal Receipt (80mm) */}
                    <div id="construction-invoice-print" className="bg-white shadow-2xl w-full max-w-[320px] rounded-2xl overflow-hidden flex flex-col relative mx-auto my-0 text-slate-800 p-5 border border-slate-200 animate-scale-up">
                        {/* Status Badge */}
                        <div className="absolute top-4 right-4 z-10 no-print">
                            <span className="px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 text-[8px] font-black tracking-tight uppercase shadow-sm">
                                ● PAGADO
                            </span>
                        </div>

                        {/* Centered Logo */}
                        <div className="flex justify-center mb-1">
                            <img
                                src={`${import.meta.env.BASE_URL}logo-municipio.png`}
                                alt="Escudo Municipal"
                                className="h-20 w-auto object-contain"
                            />
                        </div>

                        {/* Municipal Header */}
                        <div className="border-b border-dashed border-slate-350 pb-2 mb-2 text-center">
                            <h1 className="text-xs font-black uppercase text-slate-900 leading-tight">Municipio de Almirante</h1>
                            <p className="text-[8px] text-slate-500 font-bold uppercase leading-tight">Bocas del Toro, República de Panamá</p>
                            <p className="text-[9px] text-slate-700 font-black uppercase mt-0.5">RUC: 1-22-333 DV 44</p>
                            <p className="text-[8px] text-indigo-700 font-black uppercase tracking-wider mt-1 bg-indigo-50 border border-indigo-100 rounded py-0.5">Ingeniería Municipal</p>
                        </div>

                        {/* Receipt Info */}
                        <div className="mb-2 text-center">
                            <h2 className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Recibo de Caja</h2>
                            <p className="font-mono text-xs font-black text-slate-900">Nº {invoice.invoiceId}</p>
                            <p className="text-[8px] text-slate-400 font-bold mt-0.5">{formattedDate} | {formattedTime} hrs</p>
                        </div>

                        {/* Taxpayer Info */}
                        <div className="bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100 text-left">
                            <p className="text-[8px] font-bold text-slate-400 uppercase">Contribuyente:</p>
                            <p className="font-black text-[10px] text-slate-900 leading-tight uppercase mt-0.5">{invoice.data.fullName}</p>
                            <p className="text-[8px] font-mono text-slate-600 font-bold mt-0.5">ID/RUC: {invoice.data.docId}</p>
                            <p className="text-[8px] text-slate-500 font-medium leading-tight mt-0.5">Dir: {invoice.data.address}</p>
                            <p className="text-[8px] text-slate-500 font-medium leading-tight mt-0.5">Proyecto: {invoice.data.projectType}</p>
                        </div>

                        {/* Transaction Detail */}
                        <div className="border-b border-dashed border-slate-350 pb-2 mb-2">
                            <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase mb-1">
                                <span>Concepto / Permiso</span>
                                <span>Monto</span>
                            </div>
                            <div className="flex justify-between items-start gap-2">
                                <div className="text-left">
                                    <p className="text-[9px] font-black text-slate-800 leading-tight uppercase">{invoice.taxType}</p>
                                    <p className="text-[8px] text-slate-500 mt-1">{invoice.data.description || 'Sin detalles'}</p>
                                </div>
                                <p className="font-black text-[10px] text-slate-900 whitespace-nowrap">B/. {formatCurrency(invoice.amount)}</p>
                            </div>
                        </div>

                        {/* Total Box */}
                        <div className="flex justify-between items-center py-2 border-b-2 border-slate-900 mb-3 bg-slate-50 rounded px-2">
                            <span className="text-[9px] font-black text-slate-900 uppercase">Total Pagado:</span>
                            <span className="text-xs font-black text-slate-900">B/. {formatCurrency(invoice.amount)}</span>
                        </div>

                        {/* Signatures & Legal */}
                        <div className="space-y-3 text-center">
                            <div className="flex flex-col items-center relative min-h-[56px] justify-end">
                                {isCaja1User(invoice.tellerName) && (
                                    <img 
                                        src={`${import.meta.env.BASE_URL}firma-cajera-caja1.png`} 
                                        alt="Firma" 
                                        className="h-14 w-auto object-contain -mb-5 relative z-10 select-none pointer-events-none" 
                                    />
                                )}
                                <div className="border-b border-slate-350 w-24 mb-1 relative z-0"></div>
                                <p className="text-[8px] font-black text-slate-650 uppercase">Cajero: {resolveTellerName(invoice.tellerName)}</p>
                            </div>
                            <p className="text-[7px] text-slate-400 leading-tight">
                                Este recibo de caja es el comprobante oficial de pago municipal. Verifique sus datos.
                            </p>
                            <div>
                                <p className="text-[6px] font-mono text-slate-300 uppercase tracking-widest leading-none">SIGMA DIGITAL • MUNICIPIO DE ALMIRANTE</p>
                            </div>
                        </div>
                    </div>

                    {/* Shortcut button - Only visible on screen */}
                    <div className="w-full max-w-[320px] no-print">
                        <button
                            onClick={() => setInvoiceTab('document')}
                            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-amber-400"
                        >
                            <FileText size={16} />
                            Generar {invoice.taxType.toUpperCase().includes('MULTA') ? 'Documento de Multa' : 'Documento de Permiso'} ➔
                        </button>
                    </div>
                </div>
            ) : (
                    /* ===== DOCUMENT A4 – Matching original IMG_1226.jpg design ===== */
                    <div id="construction-invoice-print" className="bg-white w-full max-w-[816px] flex flex-col relative mx-auto my-0 text-slate-850 p-8 py-6 select-text text-left" style={{ fontFamily: 'Inter, system-ui, sans-serif', minHeight: '840px', maxHeight: '840px' }}>
                        
                        {/* === HEADER === */}
                        <div className="flex justify-between items-center mb-3 w-full">
                            {/* Left: Shield logo */}
                            <div className="w-40 flex flex-col items-start select-none text-left">
                                <img src={`${import.meta.env.BASE_URL}logo-municipio.png`} className="h-[115px] w-auto object-contain" alt="Escudo Municipal" />
                                <p className="font-extrabold text-slate-900 text-[7px] uppercase tracking-wider mt-1.5 leading-none">Municipio de Almirante</p>
                                <p className="text-slate-400 font-medium text-[5px] uppercase tracking-widest mt-0.5 leading-normal">Trabajo, Unidad, Superación<br/>y Salubridad</p>
                            </div>
                            
                            {/* Center: Municipal details */}
                            <div className="flex-1 text-center pt-1 flex flex-col items-center">
                                <h1 className="font-extrabold text-slate-900 text-xs uppercase tracking-widest leading-none">República de Panamá</h1>
                                <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider mt-1.5 leading-none">Municipio de Almirante</h2>
                                <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-[0.12em] leading-none">Provincia de Bocas del Toro</p>
                                <p className="text-[8px] font-semibold text-slate-450 uppercase tracking-widest leading-none mt-1">RUC: 1-22-333 DV 44</p>
                                
                                <div className="mt-3 inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 text-[9px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                                    <Building2 size={10} className="text-amber-600" /> Ingeniería Municipal
                                </div>
                            </div>
                            
                            {/* Right: Receipt info */}
                            <div className="w-40 flex flex-col items-end pt-1 select-none">
                                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-right w-full">
                                    <p className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Recibo de Pago</p>
                                    <p className="font-mono font-extrabold text-slate-800 text-xs tracking-widest mt-0.5">
                                        CT-{invoice.invoiceId.startsWith('CT-') ? invoice.invoiceId.slice(3) : invoice.invoiceId}
                                    </p>
                                    <div className="border-t border-slate-100 my-1.5"></div>
                                    <p className="text-[9px] text-slate-500 font-bold leading-none">{formattedDate}</p>
                                    <p className="text-[8px] text-slate-400 font-semibold mt-1 leading-none">{formattedTime} hrs</p>
                                </div>
                            </div>
                        </div>

                        {/* Separator line */}
                        <div className="border-b border-slate-200 my-2" />

                        {/* === TITLE BAR === */}
                        <div className="flex justify-between items-end my-3">
                            <div className="text-left">
                                <h2 className="text-slate-800 font-extrabold text-xl uppercase tracking-tight leading-none">
                                    {invoice.taxType}
                                </h2>
                                <p className="text-amber-800 text-[10px] font-bold uppercase tracking-widest mt-1">
                                    {invoice.taxType.toUpperCase().includes('MULTA') 
                                        ? 'Recaudación de Multa Municipal' 
                                        : 'Pago Único por Permiso de Obra'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-[8px] font-extrabold uppercase tracking-widest">Total Cancelado</p>
                                <p className="text-slate-800 font-black text-3xl mt-0.5">B/. {formatCurrency(invoice.amount)}</p>
                            </div>
                        </div>

                        {/* === TAXPAYER DATA === */}
                        <div className="my-3 text-left">
                            <div className="mb-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Datos del Contribuyente</p>
                                <div className="border-b border-slate-200" />
                            </div>
                            
                            <div className="space-y-3.5">
                                <div>
                                    <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Nombre Completo / Razón Social</p>
                                    <p className="font-extrabold text-slate-900 text-base uppercase leading-tight">{invoice.data.fullName}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                                    <div>
                                        <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Identificación (Cédula / RUC)</p>
                                        <p className="font-mono font-bold text-slate-700 text-sm">{invoice.data.docId}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Tipo de Proyecto</p>
                                        <p className="font-bold text-slate-700 text-sm">{invoice.data.projectType}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Ubicación de la Obra</p>
                                    <p className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                                        <span className="text-amber-600 text-xs">📍</span> {invoice.data.address}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5">Descripción de los Trabajos</p>
                                    <p className="text-slate-700 text-xs font-bold leading-relaxed mt-0.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                                        {invoice.data.description || 'No especificada'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* === QR + VALIDATION === */}
                        <div className="my-3.5 bg-amber-50/20 border border-amber-250/60 rounded-2xl p-4.5 py-4 flex items-center gap-6 text-left">
                            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-amber-100 select-none">
                                <QRCodeSVG value={invoice.qrUrl} size={90} level="H" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-amber-900 font-extrabold text-xs uppercase tracking-wide flex items-center gap-2">
                                    <span className="text-amber-600 text-sm">🛡️</span> Validación de Ingeniería
                                </h4>
                                <p className="text-amber-800 text-[9px] mt-1 leading-relaxed font-semibold">
                                    {invoice.taxType.toUpperCase().includes('MULTA')
                                        ? 'Este recibo es el comprobante oficial del pago de la multa municipal. Conservar para cualquier trámite o solvencia ante las autoridades.'
                                        : 'Este recibo es el comprobante oficial de pago del impuesto de construcción. Debe mantenerse en el sitio de la obra para inspección de las autoridades municipales.'}
                                </p>
                                <div className="mt-3 inline-block bg-amber-600 text-white font-mono text-[8px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                    ID: {invoice.verificationCode}
                                </div>
                            </div>
                        </div>

                        {/* === FOOTER SIGNATURES === */}
                        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end text-left min-h-[90px] w-full select-none">
                            {/* Left Column: Cajero / Recaudador */}
                            <div className="relative flex flex-col justify-end w-52 min-h-[85px]">
                                <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-1">Cajero / Recaudador</p>
                                <div className="relative h-16 flex items-center mb-1">
                                    {isCaja1User(invoice.tellerName) && (
                                        <img 
                                            src={`${import.meta.env.BASE_URL}firma-cajera-caja1.png`} 
                                            alt="Firma Cajera" 
                                            className="absolute -bottom-6 left-4 h-20 w-auto object-contain opacity-95 select-none pointer-events-none z-10" 
                                        />
                                    )}
                                </div>
                                <div className="border-b border-slate-300 w-full mb-1"></div>
                                <p className="text-slate-800 font-bold text-xs uppercase">{resolveTellerName(invoice.tellerName)}</p>
                            </div>

                            {/* Center Column: Sello de Ingeniería */}
                            <div className="relative flex flex-col justify-end w-44 min-h-[85px] text-center select-none">
                                <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-1">Sello de Ingeniería</p>
                                <div className="h-16 mb-1"></div> {/* Blank space for physical stamping */}
                            </div>

                            {/* Right Column: Ingeniero Municipal */}
                            <div className="relative flex flex-col justify-end w-52 min-h-[85px] text-right">
                                <p className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-1">Ingeniero Municipal</p>
                                <div className="h-16 mb-1"></div> {/* Blank space for physical signature */}
                                <div className="border-b border-slate-300 w-full mb-1"></div>
                                <p className="text-slate-800 font-bold text-xs uppercase">Ing. Joseph Camarena</p>
                                <p className="text-slate-450 font-bold text-[8px] uppercase tracking-wider mt-0.5">Ingeniería y Obras Municipales</p>
                            </div>
                        </div>

                        {/* Sub-footer message */}
                        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center text-[7px] text-slate-400 font-semibold uppercase tracking-wider">
                            <p>Generado por SIGMA Digital • Municipio de Almirante, Bocas del Toro.</p>
                            <p>Verificación: almirante.gob.pa/verify</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const pendingCharges = adminRequests.filter(
        r => r.type === 'INGENIERIA_COBRO' && r.status === 'PENDING'
    );
    const hasPending = pendingCharges.length > 0;

    const handleSelectRequest = (req: AdminRequest) => {
        setSelectedReqId(req.id);
        const payload = req.payload || {};
        setFormData({
            fullName: req.taxpayerName,
            docId: payload.taxpayerDocId || '',
            address: payload.location || '',
            amount: req.totalDebt || 0,
            description: req.description || '',
            projectType: payload.engineeringType === 'PERMISO_CONSTRUCCION' ? 'Residencial' : 'Otros'
        });
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"><ArrowLeft size={20} /></button>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <span className="p-2 bg-amber-100 rounded-xl text-amber-600"><Building2 size={24} /></span>
                        Cobro de Construcción
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Gestión de impuestos por obras, remodelaciones y permisos de ingeniería municipal.</p>
                </div>
            </div>

            {selectedReqId && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between animate-scale-up">
                    <div className="flex items-center gap-3 text-amber-800">
                        <Shield size={20} className="text-amber-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider">Cobro de Ingeniería Cargado</p>
                            <p className="text-sm font-black mt-0.5">Contribuyente: {formData.fullName} • Monto: B/. {formatCurrency(formData.amount)}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleReset}
                        className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors bg-white hover:bg-red-50 px-3 py-2 rounded-xl border border-slate-200"
                    >
                        Descartar
                    </button>
                </div>
            )}

            <div className={hasPending ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "max-w-3xl mx-auto"}>
                <div className={hasPending ? "lg:col-span-2" : ""}>
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-br from-slate-850 to-slate-950 p-8 text-white bg-slate-900">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-amber-500 p-3 rounded-2xl shadow-lg shadow-amber-500/20"><Banknote size={32} /></div>
                                    <div>
                                        <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">{selectedReqId ? 'Cobro Sincronizado' : 'Módulo de Recaudación'}</p>
                                        <h3 className="text-2xl font-black">{selectedReqId ? 'Ingeniería Municipal' : 'Ingreso Manual'}</h3>
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

                {hasPending && (
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 space-y-6">
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <Building2 className="text-amber-500 animate-pulse" size={18} />
                                Cobros Pendientes de Ingeniería
                            </h3>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                                {pendingCharges.map(req => {
                                    const payload = req.payload || {};
                                    const engType = payload.engineeringType || '';
                                    return (
                                        <button
                                            key={req.id}
                                            onClick={() => handleSelectRequest(req)}
                                            className={`w-full p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all hover:scale-[1.02] ${
                                                selectedReqId === req.id 
                                                    ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5' 
                                                    : 'bg-slate-50 hover:bg-amber-50/30 border-slate-200 hover:border-amber-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <span className="text-[9px] bg-amber-100 border border-amber-200 text-amber-800 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                    {engType === 'MULTA' && payload.fineType
                                                        ? `Multa: ${fineLabels[payload.fineType] || payload.fineType}`
                                                        : (chargeLabels[engType] || 'Cobro Ingeniería')}
                                                </span>
                                                <span className="font-extrabold text-slate-850 text-sm">B/. {req.totalDebt?.toFixed(2)}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 text-xs uppercase mt-1">{req.taxpayerName}</h4>
                                            <p className="text-[10px] text-slate-505 text-slate-500 font-medium line-clamp-2">{req.description}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
