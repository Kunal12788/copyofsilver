
import React, { useState } from 'react';
import { InventoryBatch } from '../types';
import { formatCurrency, formatGrams } from '../utils';
import { Archive, Layers, PackageCheck, PackageOpen, Calculator, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface InventoryTableProps {
  batches: InventoryBatch[];
}

const InventoryTable: React.FC<InventoryTableProps> = ({ batches }) => {
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [marketRate, setMarketRate] = useState<string>('');

  const activeBatches = batches.filter(b => b.remainingQuantity > 0);
  const historyBatches = batches.filter(b => b.remainingQuantity === 0);
  const displayedHistoryBatches = [...historyBatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalStock = activeBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);
  const totalValue = activeBatches.reduce((acc, b) => acc + (b.remainingQuantity * b.costPerGram), 0);
  const avgCost = totalStock > 0 ? totalValue / totalStock : 0;
  
  const totalHistoryStock = historyBatches.reduce((acc, b) => acc + b.originalQuantity, 0);
  const totalHistoryValue = historyBatches.reduce((acc, b) => acc + (b.originalQuantity * b.costPerGram), 0);
  const avgHistoryCost = totalHistoryStock > 0 ? totalHistoryValue / totalHistoryStock : 0;

  const rate = parseFloat(marketRate);
  const hasRate = !isNaN(rate) && rate > 0;
  const estimatedSalesValue = hasRate ? totalStock * rate : 0;
  const potentialProfit = hasRate ? estimatedSalesValue - totalValue : 0;
  const roiPercentage = (hasRate && totalValue > 0) ? (potentialProfit / totalValue) * 100 : 0;

  const StatBox = ({ label, value, sub, active = false }: any) => (
      <div className={`p-6 rounded-2xl border transition-all duration-300 ${active ? 'bg-slate-900 text-white border-slate-800 shadow-xl' : 'bg-white text-slate-900 border-slate-100 shadow-card hover:shadow-lg'}`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${active ? 'text-gold-500' : 'text-slate-400'}`}>{label}</p>
          <p className="text-3xl font-mono font-bold tracking-tight">{value}</p>
          {sub && <p className={`text-xs mt-2 ${active ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>}
      </div>
  );

  return (
    <div className="space-y-8 animate-slide-up">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatBox label={viewMode === 'ACTIVE' ? "Total Stock" : "Volume Sold"} value={viewMode === 'ACTIVE' ? formatGrams(totalStock) : formatGrams(totalHistoryStock)} sub={viewMode === 'HISTORY' ? 'Lifetime volume' : undefined} active />
            <StatBox label={viewMode === 'ACTIVE' ? "FIFO Valuation" : "Hist. Cost Basis"} value={viewMode === 'ACTIVE' ? formatCurrency(totalValue) : formatCurrency(totalHistoryValue)} />
            <StatBox label="Avg. Cost / Gram" value={viewMode === 'ACTIVE' ? formatCurrency(avgCost) : formatCurrency(avgHistoryCost)} />
       </div>

      {viewMode === 'ACTIVE' && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-1 shadow-xl shadow-slate-900/10">
             <div className="bg-slate-900/50 backdrop-blur rounded-xl p-6 flex flex-col lg:flex-row items-center gap-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none animate-pulse-slow"></div>
                 <div className="flex-1 w-full z-10">
                     <div className="flex items-center gap-2 mb-2 text-gold-400 font-bold text-lg"><Calculator className="w-5 h-5" /> Valuation Simulator</div>
                     <p className="text-slate-400 text-sm mb-4">Enter market price for liquidation estimates.</p>
                     <input type="number" value={marketRate} onChange={(e) => setMarketRate(e.target.value)} placeholder="Current Rate (₹/g)" className="w-full max-w-xs bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:border-gold-500 outline-none font-mono text-lg" />
                 </div>
                 {hasRate && (
                      <div className="flex-[2] w-full grid grid-cols-1 sm:grid-cols-3 gap-4 border-t lg:border-t-0 lg:border-l border-slate-700/50 pt-4 lg:pt-0 lg:pl-8 z-10">
                          {[
                              { l: 'Est. Revenue', v: formatCurrency(estimatedSalesValue), c: 'text-white' },
                              { l: 'Unrealized P/L', v: formatCurrency(potentialProfit), c: potentialProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                              { l: 'Proj. ROI', v: `${roiPercentage.toFixed(2)}%`, c: roiPercentage >= 0 ? 'text-green-400' : 'text-red-400' }
                          ].map((i, idx) => (
                              <div key={idx} className="bg-slate-800/50 lg:bg-transparent p-3 rounded-lg lg:p-0">
                                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">{i.l}</p>
                                  <p className={`text-xl font-mono font-bold ${i.c}`}>{i.v}</p>
                              </div>
                          ))}
                      </div>
                 )}
             </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-white/50 backdrop-blur sticky top-0 z-10">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                {viewMode === 'ACTIVE' ? <PackageOpen className="w-5 h-5 text-gold-600"/> : <PackageCheck className="w-5 h-5 text-slate-400"/>}
                <span className="hidden sm:inline">{viewMode === 'ACTIVE' ? 'Live Inventory (FIFO)' : 'Sold Batches'}</span>
                <span className="sm:hidden">{viewMode === 'ACTIVE' ? 'Live' : 'Sold'}</span>
            </h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                {['ACTIVE', 'HISTORY'].map((m) => (
                    <button key={m} onClick={() => setViewMode(m as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{m}</button>
                ))}
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-y-1 px-4 pb-4 min-w-[700px]">
            <thead className="text-slate-400">
              <tr>{['Batch Date', 'Original Qty', 'Remaining', 'Cost / Gram', 'Total Value', 'Status'].map(h => <th key={h} className="px-4 py-3 font-semibold uppercase text-xs tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody>
              {viewMode === 'ACTIVE' && activeBatches.map((batch) => (
                    <tr key={batch.id} className="group hover:scale-[1.005] transition-transform duration-200">
                        <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white group-hover:shadow-sm rounded-l-xl border-y border-l border-transparent group-hover:border-slate-100 font-mono text-slate-600">{batch.date}</td>
                        <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white group-hover:shadow-sm border-y border-transparent group-hover:border-slate-100 text-slate-500">{formatGrams(batch.originalQuantity)}</td>
                        <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white group-hover:shadow-sm border-y border-transparent group-hover:border-slate-100 font-bold text-slate-900">{formatGrams(batch.remainingQuantity)}</td>
                        <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white group-hover:shadow-sm border-y border-transparent group-hover:border-slate-100 font-mono text-slate-500">{formatCurrency(batch.costPerGram)}</td>
                        <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white group-hover:shadow-sm border-y border-transparent group-hover:border-slate-100 font-mono font-medium text-slate-900">{formatCurrency(batch.remainingQuantity * batch.costPerGram)}</td>
                        <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white group-hover:shadow-sm rounded-r-xl border-y border-r border-transparent group-hover:border-slate-100"><span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded border border-green-100">Active</span></td>
                    </tr>
                ))}
                {viewMode === 'HISTORY' && displayedHistoryBatches.map((batch) => (
                    <tr key={batch.id} className="opacity-70 hover:opacity-100 transition-opacity">
                         <td className="px-4 py-3 font-mono text-slate-500">{batch.date}</td>
                         <td className="px-4 py-3 text-slate-500">{formatGrams(batch.originalQuantity)}</td>
                         <td className="px-4 py-3 font-bold text-slate-300">0.000 g</td>
                         <td className="px-4 py-3 font-mono text-slate-400">{formatCurrency(batch.costPerGram)}</td>
                         <td className="px-4 py-3 font-mono text-slate-400">{formatCurrency(batch.originalQuantity * batch.costPerGram)}</td>
                         <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded">Sold</span></td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default InventoryTable;
