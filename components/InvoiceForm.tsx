
import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Invoice, TransactionType } from '../types';
import { generateId, parseInvoiceOCR } from '../utils';
import { CheckCircle, AlertTriangle, ScanLine, Calculator, RefreshCw, ArrowRightLeft, Lock, Loader2, Sparkles, X, UploadCloud, FileText } from 'lucide-react';
import { SingleDatePicker } from './SingleDatePicker';

interface InvoiceFormProps {
  onAdd: (invoice: Invoice) => void;
  currentStock: number;
  lockDate: string | null;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ onAdd, currentStock, lockDate }) => {
  const [mode, setMode] = useState<'MANUAL' | 'UPLOAD'>('MANUAL');
  const [ocrText, setOcrText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'PURCHASE' as TransactionType,
    partyName: '',
    quantityGrams: '',
    ratePerGram: '',
    gstRate: '3',
  });

  const [error, setError] = useState('');

  const getTaxableTotal = () => {
      const qty = parseFloat(formData.quantityGrams);
      const rate = parseFloat(formData.ratePerGram);
      if (!isNaN(qty) && !isNaN(rate)) return (qty * rate).toFixed(2);
      return '';
  };

  const handleTotalChange = (value: string) => {
      const total = parseFloat(value);
      const qty = parseFloat(formData.quantityGrams);
      if (!isNaN(total) && !isNaN(qty) && qty > 0) {
          setFormData(prev => ({...prev, ratePerGram: (total / qty).toString()}));
      } else if (value === '') {
           setFormData(prev => ({...prev, ratePerGram: ''}));
      }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setOcrText(''); // Clear text if file is selected
    }
  };

  const handleOcrProcess = async () => {
      if (!ocrText.trim() && !selectedFile) return;
      setIsProcessing(true);
      setError('');

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let parts = [];

          // Schema definition for structured output
          const responseSchema = {
            type: Type.OBJECT,
            properties: {
                date: { type: Type.STRING, description: "Invoice Date in YYYY-MM-DD format" },
                type: { type: Type.STRING, enum: ["PURCHASE", "SALE"], description: "Transaction type based on invoice context" },
                partyName: { type: Type.STRING, description: "Name of the Supplier or Customer" },
                quantityGrams: { type: Type.NUMBER, description: "Total weight of gold in grams" },
                ratePerGram: { type: Type.NUMBER, description: "Price per gram of gold" },
                gstRate: { type: Type.NUMBER, description: "GST Percentage (e.g. 3)" }
            },
            required: ["date", "type", "partyName", "quantityGrams", "ratePerGram"]
          };

          if (selectedFile) {
              // Multimodal Request (PDF/Image)
              const base64Data = await fileToBase64(selectedFile);
              
              // Determine mime type reliably
              let mimeType = selectedFile.type;
              if (!mimeType && selectedFile.name.toLowerCase().endsWith('.pdf')) {
                  mimeType = 'application/pdf';
              }

              parts = [
                  {
                      inlineData: {
                          mimeType: mimeType || 'application/pdf', 
                          data: base64Data
                      }
                  },
                  {
                      text: "Analyze this invoice document. Extract the following details: Date, Party Name, Transaction Type (Sale/Purchase), Quantity (Grams), Rate (Price/Gram), and GST %. If there are multiple items, sum the gold quantity. If Rate is not explicit, calculate it as TaxableValue / Quantity."
                  }
              ];
          } else {
              // Text-only Request
              parts = [
                  {
                      text: `Extract invoice details from this text. Purchase or Sale? Party Name? Date? Total Grams? Rate? GST Rate? Text: ${ocrText}`
                  }
              ];
          }

          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', 
            contents: { parts: parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
          });

          // Clean response text (remove markdown code blocks if present)
          const cleanText = response.text ? response.text.replace(/```json|```/g, '').trim() : "{}";
          const data = JSON.parse(cleanText);
          
          if (data && (data.partyName || data.quantityGrams)) {
               setFormData({
                  date: data.date || new Date().toISOString().split('T')[0],
                  type: (data.type as TransactionType) || 'PURCHASE',
                  partyName: data.partyName || '',
                  quantityGrams: data.quantityGrams?.toString() || '',
                  ratePerGram: data.ratePerGram?.toString() || '',
                  gstRate: data.gstRate?.toString() || '3',
              });
              setMode('MANUAL'); // Switch back to manual for verification
              setSelectedFile(null); // Clear file after processing
              return;
          }
          throw new Error("Could not extract valid data");

      } catch (err: any) {
          console.error(err);
          // Fallback for text-only legacy parser if Gemini fails (only works for text input)
          if (!selectedFile && ocrText) {
              const result = parseInvoiceOCR(ocrText);
              if (result) {
                  setFormData({
                      ...formData,
                      date: result.date || formData.date,
                      partyName: result.partyName || formData.partyName,
                      quantityGrams: result.quantity > 0 ? result.quantity.toString() : '',
                      ratePerGram: result.rate > 0 ? result.rate.toString() : '',
                      gstRate: result.gstRate ? result.gstRate.toString() : formData.gstRate,
                      type: result.isSale ? 'SALE' : 'PURCHASE'
                  });
                  setMode('MANUAL'); 
              } else {
                  setError('Auto-extraction failed. Please enter details manually.');
              }
          } else {
              setError(`Processing failed: ${err.message || "Unknown error"}. Try manual entry.`);
          }
      } finally { 
          setIsProcessing(false); 
      }
  };

  const calculateTotals = () => {
    const qty = parseFloat(formData.quantityGrams) || 0;
    const rate = parseFloat(formData.ratePerGram) || 0;
    const gst = parseFloat(formData.gstRate) || 0;
    const taxable = qty * rate;
    const gstAmt = taxable * (gst / 100);
    return { taxable, gstAmt, total: taxable + gstAmt };
  };

  const { taxable, gstAmt, total } = calculateTotals();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (lockDate && formData.date <= lockDate) { setError(`Date Locked! Cannot add before ${lockDate}.`); return; }
    if (!formData.partyName || !formData.quantityGrams || !formData.ratePerGram) { setError('Fill all required fields.'); return; }
    const qty = parseFloat(formData.quantityGrams);
    if (formData.type === 'SALE' && qty > currentStock) { setError(`Insufficient Inventory! Avail: ${currentStock.toFixed(3)}g`); return; }

    onAdd({
        id: generateId(), date: formData.date, type: formData.type, partyName: formData.partyName,
        quantityGrams: qty, ratePerGram: parseFloat(formData.ratePerGram), gstRate: parseFloat(formData.gstRate),
        gstAmount: gstAmt, taxableAmount: taxable, totalAmount: total
    });
    setFormData({ date: new Date().toISOString().split('T')[0], type: 'PURCHASE', partyName: '', quantityGrams: '', ratePerGram: '', gstRate: '3' });
    setOcrText('');
    setSelectedFile(null);
  };

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300";
  const labelClass = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider";

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex flex-col animate-slide-up sticky top-0">
        {/* Header Toggle */}
        <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-gold-100 to-gold-50 text-gold-700 rounded-lg"><Calculator className="w-4 h-4"/></div>
                <span className="hidden sm:inline">Transaction Entry</span>
                <span className="sm:hidden">Entry</span>
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-xl scale-90 origin-right">
                {['MANUAL', 'UPLOAD'].map(m => (
                    <button key={m} onClick={() => setMode(m as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{m === 'MANUAL' ? 'Manual' : 'AI Scan'}</button>
                ))}
            </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
            {error && <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 animate-fade-in"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>}
            
            {mode === 'UPLOAD' ? (
                <div className="space-y-4 animate-fade-in">
                    <input 
                        type="file" 
                        accept="application/pdf,image/*" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                    />
                    
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer relative group overflow-hidden min-h-[250px]
                            ${selectedFile ? 'border-gold-400 bg-gold-50/20' : 'border-slate-200 hover:bg-slate-50 hover:border-gold-400'}`}
                    >
                        {selectedFile ? (
                            <div className="flex flex-col items-center text-center z-10 animate-fade-in">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gold-200 flex items-center justify-center mb-3 text-gold-600">
                                    {selectedFile.type.includes('pdf') ? <FileText className="w-6 h-6" /> : <ScanLine className="w-6 h-6" />}
                                </div>
                                <p className="font-bold text-slate-900 text-sm mb-1">{selectedFile.name}</p>
                                <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} 
                                    className="mt-3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 hover:border-red-100 transition-colors"
                                >
                                    Remove File
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400 group-hover:scale-110 transition-transform group-hover:text-gold-500 group-hover:bg-gold-50">
                                    <UploadCloud className="w-6 h-6" />
                                </div>
                                <p className="font-medium text-slate-900 text-center text-sm">Click to Upload PDF Invoice</p>
                                <p className="text-xs text-slate-400 mt-1">or paste extracted text below</p>
                            </>
                        )}

                        {/* Fallback Text Area for Manual Paste if no file */}
                        {!selectedFile && (
                            <textarea 
                                className="absolute inset-x-0 bottom-0 h-1/3 opacity-0 group-hover:opacity-100 transition-opacity p-4 text-xs font-mono bg-white/90 border-t border-slate-200 focus:opacity-100 focus:bg-white outline-none resize-none" 
                                placeholder="Alternatively, paste text content here..."
                                value={ocrText}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setOcrText(e.target.value)} 
                            />
                        )}
                    </div>

                    <button 
                        onClick={handleOcrProcess} 
                        disabled={(!ocrText && !selectedFile) || isProcessing} 
                        className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 text-sm"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-gold-400"/> : <Sparkles className="w-4 h-4 text-gold-400"/>} 
                        {selectedFile ? 'Process Document' : 'Process Text'}
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
                    <div className="flex gap-4">
                        <div className="flex-1">
                             <label className={labelClass}>Type</label>
                             <div className="flex bg-slate-100 rounded-xl p-1">
                                 <button type="button" onClick={() => setFormData({...formData, type: 'PURCHASE'})} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.type === 'PURCHASE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>BUY</button>
                                 <button type="button" onClick={() => setFormData({...formData, type: 'SALE'})} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.type === 'SALE' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>SELL</button>
                             </div>
                        </div>
                        <div className="flex-[1.5]">
                            <label className={labelClass}>Date</label>
                            <SingleDatePicker 
                                value={formData.date} 
                                onChange={(d) => setFormData({...formData, date: d})} 
                                className={inputClass} 
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>{formData.type === 'PURCHASE' ? 'Supplier Name' : 'Customer Name'}</label>
                        <input type="text" placeholder="Enter Name..." value={formData.partyName} onChange={(e) => setFormData({...formData, partyName: e.target.value})} className={inputClass} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                             <label className={labelClass}>Grams</label>
                             <input type="number" step="0.001" placeholder="0.000" value={formData.quantityGrams} onChange={(e) => setFormData({...formData, quantityGrams: e.target.value})} className={`${inputClass} font-mono px-2`} />
                        </div>
                        <div className="col-span-1">
                             <label className={labelClass}>Rate</label>
                             <input type="number" step="0.01" placeholder="0.00" value={formData.ratePerGram} onChange={(e) => setFormData({...formData, ratePerGram: e.target.value})} className={`${inputClass} font-mono px-2`} />
                        </div>
                        <div className="col-span-1">
                             <label className={labelClass}>GST %</label>
                             <input type="number" step="0.1" value={formData.gstRate} onChange={(e) => setFormData({...formData, gstRate: e.target.value})} className={`${inputClass} font-mono px-2`} />
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <label className={labelClass}>Taxable Total (Auto-Calc Rate)</label>
                        <input type="number" value={getTaxableTotal()} onChange={(e) => handleTotalChange(e.target.value)} disabled={!parseFloat(formData.quantityGrams)} className={`${inputClass} font-mono ${!parseFloat(formData.quantityGrams) ? 'bg-slate-100' : 'bg-gold-50/30 border-gold-200 text-gold-900'}`} />
                    </div>

                    <div className="mt-4 bg-slate-900 rounded-xl p-5 text-white relative overflow-hidden shadow-lg">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <div className="relative z-10 space-y-1">
                            <div className="flex justify-between text-xs text-slate-400"><span>Taxable</span><span className="font-mono text-slate-200">{taxable.toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}</span></div>
                            <div className="flex justify-between text-xs text-slate-400"><span>GST</span><span className="font-mono text-slate-200">{gstAmt.toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}</span></div>
                            <div className="my-2 border-t border-slate-700"></div>
                            <div className="flex justify-between items-center"><span className="font-bold text-gold-400 uppercase tracking-widest text-[10px]">Net Payable</span><span className="font-mono text-xl font-bold">{total.toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}</span></div>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-sm"><CheckCircle className="w-4 h-4" /> Confirm Transaction</button>
                </form>
            )}
        </div>
    </div>
  );
};
export default InvoiceForm;
