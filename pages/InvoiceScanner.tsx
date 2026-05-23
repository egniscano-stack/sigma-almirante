import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js'; // Local OCR V5+
import { Transaction, ExtractedInvoiceData, TaxType, PaymentMethod, TaxpayerType, TaxpayerStatus } from '../types';
import { Camera, Upload, CheckCircle, AlertTriangle, Loader2, FileText, X, Save, VideoOff, SwitchCamera, Scan, Eye, EyeOff } from 'lucide-react';
import { db } from '../services/db';

interface InvoiceScannerProps {
  onScanComplete?: (tx: Transaction) => void;
}

type CaptureMode = 'idle' | 'camera' | 'preview';

export const InvoiceScanner: React.FC<InvoiceScannerProps> = ({ onScanComplete }) => {
  const [image, setImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ExtractedInvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera state
  const [captureMode, setCaptureMode] = useState<CaptureMode>('idle');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Form State for editing
  const [formData, setFormData] = useState({
    date: '',
    taxpayerName: '',
    docId: '',
    receiptNumber: '',
    paymentMethod: '',
    concept: '',
    amount: 0
  });

  // Check camera availability on mount
  useEffect(() => {
    const checkCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(d => d.kind === 'videoinput');
        setCameraAvailable(hasCamera);
      }
    };
    checkCamera().catch(() => setCameraAvailable(false));
  }, []);

  // Bind stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (data) {
      setFormData({
        date: data.date || '',
        taxpayerName: data.taxpayerName || '',
        docId: data.docId || '',
        receiptNumber: data.receiptNumber || '',
        paymentMethod: data.paymentMethod || 'EFECTIVO',
        concept: data.concept || '',
        amount: data.amount || 0
      });
    }
  }, [data]);

  // ─── Camera Functions ───────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraLoading(true);
    setError(null);
    try {
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasCameraPermission(true);
      setCaptureMode('camera');
    } catch (err: any) {
      console.error('Camera error:', err);
      setHasCameraPermission(false);
      if (err.name === 'NotAllowedError') {
        setError('Acceso a cámara denegado. Por favor permita el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara en el dispositivo.');
        setCameraAvailable(false);
      } else {
        setError(`Error al acceder a la cámara: ${err.message}`);
      }
    } finally {
      setCameraLoading(false);
    }
  }, [facingMode, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCaptureMode('idle');
  }, [stream]);

  const flipCamera = useCallback(async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    // Small delay to allow state to settle
    setTimeout(async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        setStream(mediaStream);
      } catch (err: any) {
        setError('No se pudo cambiar de cámara.');
      }
    }, 100);
  }, [facingMode, stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Stop camera and show preview
    stopCamera();
    setImage(dataUrl);
    setFileType('image/jpeg');
    setFileName('camara_captura.jpg');
    setData(null);
    setCaptureMode('preview');
  }, [stopCamera]);

  // ─── File Upload ────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (file.type === 'application/pdf') {
        alert('El scanner local solo soporta IMÁGENES (JPG, PNG).\nPor favor convierta su PDF a imagen o tome una foto directa.');
        e.target.value = '';
        return;
      }

      setFileType(file.type);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setData(null);
        setError(null);
        setCaptureMode('preview');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setImage(null);
    setFileName('');
    setData(null);
    setError(null);
    setOcrProgress(0);
    setCaptureMode('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
    stopCamera();
  };

  // ─── OCR Logic ──────────────────────────────────────────────────────────────

  const extractDataFromText = (text: string): ExtractedInvoiceData => {
    console.log('OCR Text:', text);
    const result: ExtractedInvoiceData = {
      date: '',
      amount: 0,
      taxpayerName: '',
      docId: '',
      taxpayerNumber: '',
      concept: '',
      confidence: 0.8
    };

    const lines = text.split('\n');

    // 1. DATE
    const isoDateRegex = /(\d{4})-(\d{2})-(\d{2})/;
    const isoMatch = text.match(isoDateRegex);
    if (isoMatch) {
      result.date = isoMatch[0];
    } else {
      const dateRegex = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/;
      const dateMatch = text.match(dateRegex);
      if (dateMatch) {
        let [_, d, m, y] = dateMatch;
        if (y.length === 2) y = `20${y}`;
        const pad = (n: string) => n.length === 1 ? `0${n}` : n;
        result.date = `${y}-${pad(m)}-${pad(d)}`;
      }
    }

    // 2. NAME
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/RECIBIMOS DE:/i)) {
        const parts = line.split(/RECIBIMOS DE:/i);
        if (parts[1] && parts[1].trim().length > 2) {
          result.taxpayerName = parts[1].trim();
        } else if (lines[i + 1]) {
          result.taxpayerName = lines[i + 1].trim();
        }
        break;
      }
    }

    // 3. ID
    const idRegex = /(?:ID|RUC|CEDULA)[:.]?\s*([\d-]{5,20})/i;
    const idMatch = text.match(idRegex);
    if (idMatch) result.docId = idMatch[1];

    const taxNumRegex = /Contribuyente\s*(?:No\.?|N°)?[:.]?\s*(\w+)/i;
    const taxNumMatch = text.match(taxNumRegex);
    if (taxNumMatch) {
      result.taxpayerNumber = taxNumMatch[1];
    } else {
      result.taxpayerNumber = result.docId;
    }

    // 4. AMOUNT
    const totalRegex = /TOTAL\s*PAGADO\s*B\/\.?\s*([\d,]+\.?\d{2})/i;
    const totalMatch = text.match(totalRegex);
    if (totalMatch) {
      result.amount = parseFloat(totalMatch[1].replace(/,/g, ''));
    } else {
      const moneyMatches = [...text.matchAll(/B\/\.?\s*([\d,]+\.?\d{2})/g)];
      if (moneyMatches.length > 0) {
        const amt = parseFloat(moneyMatches[moneyMatches.length - 1][1].replace(/,/g, ''));
        result.amount = amt;
      }
    }

    // 5. CONCEPT
    const conceptIndex = lines.findIndex(l => l.match(/CONCEPTO/i));
    if (conceptIndex !== -1 && lines[conceptIndex + 1]) {
      let possibleConcept = lines[conceptIndex + 1];
      possibleConcept = possibleConcept.replace(/B\/\.?\s*[\d,.]+/g, '').trim();
      result.concept = possibleConcept;
    } else {
      const lower = text.toLowerCase();
      if (lower.includes('placa')) result.concept = 'Impuesto de Circulación Vehicular';
      else if (lower.includes('basura')) result.concept = 'Tasa de Aseo';
      else if (lower.includes('const') || lower.includes('obra') || lower.includes('permiso')) result.concept = 'Permiso de Construcción';
      else result.concept = 'Pago General (Detectado)';
    }

    // 6. RECEIPT NUMBER
    const rxRegex = /#TX-\d+/;
    const rxMatch = text.match(rxRegex);
    if (rxMatch) result.receiptNumber = rxMatch[0];

    // 7. PAYMENT METHOD
    const methodRegex = /M(?:e|é)todo:\s*(\w+)/i;
    const methodMatch = text.match(methodRegex);
    if (methodMatch) result.paymentMethod = methodMatch[1].toUpperCase();

    return result;
  };

  const handleAnalyze = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);
    setData(null);
    setOcrProgress(0);

    let worker: any = null;

    try {
      console.log('Initializing Worker...');
      worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      console.log('Worker Ready. Recognizing...');
      const ret = await worker.recognize(image);
      console.log('OCR Result:', ret);

      const extracted = extractDataFromText(ret.data.text);
      setData(extracted);

      await worker.terminate();

    } catch (err: any) {
      console.error('OCR Error Details:', err);
      let msg = err.message || JSON.stringify(err);
      if (!msg || msg === '{}') msg = 'Incompatible con el navegador o falta Worker';
      setError(`Fallo OCR: ${msg}. Intente recargar la página.`);
      if (worker) {
        try { await worker.terminate(); } catch (e) { }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const taxpayers = await db.getTaxpayers();
      let taxpayer = taxpayers.find(t => t.docId === formData.docId || t.taxpayerNumber === formData.docId);

      if (!taxpayer) {
        const newTaxpayer = {
          id: '',
          taxpayerNumber: formData.taxpayerName || `AUTO-${Math.floor(Math.random() * 99999)}`,
          type: formData.docId.includes('-') ? TaxpayerType.NATURAL : TaxpayerType.JURIDICA,
          status: TaxpayerStatus.ACTIVO,
          docId: formData.docId || `UNKNOWN-${Date.now()}`,
          name: formData.taxpayerName || 'Contribuyente Desconocido',
          address: 'Dirección no registrada (Importado IA)',
          phone: '',
          email: '',
          hasCommercialActivity: false,
          hasConstruction: false,
          hasGarbageService: false,
          createdAt: new Date().toISOString()
        };
        try {
          taxpayer = await db.createTaxpayer(newTaxpayer);
        } catch (e) {
          throw new Error('Error al registrar el contribuyente nuevo. Verifique que el ID no exista ya.');
        }
      }

      let taxType = TaxType.COMERCIO;
      const conceptLower = formData.concept.toLowerCase();
      if (conceptLower.includes('placa') || conceptLower.includes('vehic')) taxType = TaxType.VEHICULO;
      if (conceptLower.includes('basura') || conceptLower.includes('aseo')) taxType = TaxType.BASURA;
      if (conceptLower.includes('cons') || conceptLower.includes('obra')) taxType = TaxType.CONSTRUCCION;

      const newTx = await db.createTransaction({
        id: `HIST-${Date.now()}`,
        taxpayerId: taxpayer!.id,
        taxType: taxType,
        amount: formData.amount,
        date: formData.date || new Date().toISOString().split('T')[0],
        time: '12:00',
        description: `IMPORTADO IA: ${formData.concept}`,
        status: 'PAGADO',
        paymentMethod: PaymentMethod.EFECTIVO,
        tellerName: 'SISTEMA IA',
        metadata: { originalFileName: fileName }
      });

      if (onScanComplete) {
        onScanComplete(newTx);
      }

      alert('¡Documento guardado y digitalizado correctamente!');
      handleClear();

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error al guardar en la base de datos');
    } finally {
      setSaving(false);
    }
  };

  const triggerInput = () => fileInputRef.current?.click();

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Scan className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Digitalizador IA</h2>
            <p className="text-slate-500 text-sm">OCR local con Tesseract · No requiere internet</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ─── Left: Capture Panel ─── */}
        <div className="space-y-4">

          {/* Camera live view */}
          {captureMode === 'camera' && (
            <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border-4 border-indigo-500 aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Camera overlay grid for alignment */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/10" />
                  ))}
                </div>
                {/* Corner markers */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full font-medium">
                  Apunte a la factura
                </div>
              </div>

              {/* Camera Controls Overlay */}
              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6 px-4">
                {/* Flip camera */}
                <button
                  onClick={flipCamera}
                  className="bg-white/20 backdrop-blur text-white p-3 rounded-full hover:bg-white/30 transition-all border border-white/30"
                  title="Cambiar cámara"
                >
                  <SwitchCamera size={20} />
                </button>

                {/* Capture button */}
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 bg-white rounded-full border-4 border-indigo-500 flex items-center justify-center shadow-2xl hover:scale-95 active:scale-90 transition-all"
                  title="Capturar foto"
                >
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
                    <Camera size={24} className="text-white" />
                  </div>
                </button>

                {/* Cancel */}
                <button
                  onClick={stopCamera}
                  className="bg-red-500/80 backdrop-blur text-white p-3 rounded-full hover:bg-red-600 transition-all border border-red-400"
                  title="Cancelar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Image Preview / Upload Zone */}
          {captureMode !== 'camera' && (
            <div
              onClick={captureMode === 'idle' ? triggerInput : undefined}
              className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                image
                  ? 'border-indigo-400 bg-indigo-50 h-80'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 h-72'
              }`}
            >
              {image ? (
                <div className="w-full h-full flex items-center justify-center p-3 relative">
                  <img src={image} alt="Preview" className="h-full w-full object-contain rounded-xl shadow-md" />
                  <button
                    onClick={handleClear}
                    className="absolute top-3 right-3 bg-white rounded-full p-1.5 shadow-lg hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors border border-slate-200"
                  >
                    <X size={18} />
                  </button>
                  <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {fileName || 'captura.jpg'}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload size={36} className="text-indigo-500" />
                  </div>
                  <p className="text-slate-700 font-semibold text-lg">Subir Documento</p>
                  <p className="text-slate-400 text-sm mt-1">Haga clic para seleccionar imagen (JPG, PNG)</p>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />
            </div>
          )}

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Camera button */}
            {cameraAvailable && captureMode === 'idle' && (
              <button
                onClick={startCamera}
                disabled={cameraLoading}
                className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center text-white transition-all bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-indigo-200 active:scale-98"
              >
                {cameraLoading ? (
                  <><Loader2 className="animate-spin mr-2" size={18} /> Iniciando cámara...</>
                ) : (
                  <><Camera className="mr-2" size={18} /> Usar Cámara del Dispositivo</>
                )}
              </button>
            )}

            {/* Not available notice */}
            {!cameraAvailable && (
              <div className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium flex items-center justify-center border border-slate-200">
                <VideoOff size={16} className="mr-2" />
                Cámara no disponible en este dispositivo
              </div>
            )}

            {/* OCR Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={!image || loading}
              className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center text-white transition-all ${
                loading || !image
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 active:scale-98'
              }`}
            >
              {loading ? (
                <><Loader2 className="animate-spin mr-2" size={18} /> Analizando... {ocrProgress > 0 ? `${ocrProgress}%` : ''}</>
              ) : (
                <><Scan className="mr-2" size={18} /> Analizar con IA (OCR)</>
              )}
            </button>

            {/* Progress bar */}
            {loading && ocrProgress > 0 && (
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Instructions */}
          {captureMode === 'idle' && !image && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
              <p className="text-blue-800 font-semibold text-sm mb-2">💡 Instrucciones de uso:</p>
              <ul className="text-blue-700 text-xs space-y-1 list-disc list-inside">
                <li>Use la cámara del dispositivo para capturar una factura directamente</li>
                <li>O suba una imagen JPG/PNG desde su dispositivo</li>
                <li>La IA extraerá automáticamente nombre, monto, fecha y concepto</li>
                <li>Puede editar los datos antes de guardar</li>
              </ul>
            </div>
          )}
        </div>

        {/* ─── Right: Results Panel ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
            <div className="h-7 w-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FileText size={14} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Datos Extraídos</h3>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start mb-5 border border-red-100">
              <AlertTriangle className="mr-2 flex-shrink-0 mt-0.5" size={18} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {!data && !loading && !error && (
            <div className="text-center py-16 text-slate-300">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                <Scan size={36} className="text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium">Capture o suba una imagen</p>
              <p className="text-slate-300 text-sm mt-1">y presione "Analizar con IA"</p>
            </div>
          )}

          {loading && (
            <div className="space-y-4 animate-pulse py-4">
              <div className="text-center mb-6">
                <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={40} />
                <p className="text-slate-600 font-semibold">Procesando imagen con OCR...</p>
                <p className="text-slate-400 text-sm">{ocrProgress > 0 ? `${ocrProgress}% completado` : 'Inicializando motor OCR'}</p>
              </div>
              <div className="h-4 bg-slate-100 rounded-full w-3/4 mx-auto" />
              <div className="h-4 bg-slate-100 rounded-full w-1/2 mx-auto" />
              <div className="h-10 bg-slate-100 rounded-xl w-full" />
            </div>
          )}

          {data && (
            <form className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 mb-4">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                <p className="text-emerald-700 text-sm font-semibold">Datos extraídos. Verifique y corrija si es necesario.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha</label>
                  <input
                    type="text"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-black font-medium focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recibo #</label>
                  <input
                    type="text"
                    value={formData.receiptNumber}
                    onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-black font-medium focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recibimos de</label>
                <input
                  type="text"
                  value={formData.taxpayerName}
                  onChange={(e) => setFormData({ ...formData, taxpayerName: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-black font-medium focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ID (Cédula/RUC)</label>
                <input
                  type="text"
                  value={formData.docId}
                  onChange={(e) => setFormData({ ...formData, docId: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-black font-medium focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Concepto</label>
                <input
                  type="text"
                  value={formData.concept}
                  onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-black font-medium focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto (B/.)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={formData.amount === 0 ? '' : formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-emerald-200 bg-emerald-50 rounded-xl font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-300 outline-none transition-all text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Método Pago</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-black font-medium focus:ring-2 focus:ring-indigo-300 outline-none transition-all bg-white"
                  >
                    <option value="EFECTIVO">EFECTIVO</option>
                    <option value="ACH">ACH</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="TARJETA">TARJETA</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 bg-white border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 font-semibold transition-all"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2.5 rounded-xl hover:from-emerald-700 hover:to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-200 font-bold transition-all active:scale-98"
                >
                  {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                  {saving ? 'Guardando...' : 'Guardar en Base de Datos'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};