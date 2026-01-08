
import React, { useState, useEffect, useMemo } from 'react';
import Layout from './components/Layout';
import InvoiceForm from './components/InvoiceForm';
import InventoryTable from './components/InventoryTable';
import StatsCard from './components/StatsCard';
import { DateRangePicker } from './components/DateRangePicker'; 
import { SingleDatePicker } from './components/SingleDatePicker';
import Toast, { ToastMessage } from './components/Toast'; 
import { Invoice, InventoryBatch, CustomerStat, AgingStats, SupplierStat, RiskAlert } from './types';
import { loadInvoices, loadInventory, saveInvoices, saveInventory, resetData } from './services/storeService';
import { formatCurrency, formatGrams, calculateInventoryValueOnDate, getDateDaysAgo, calculateStockAging, calculateSupplierStats, calculateTurnoverStats, generateId, downloadCSV } from './utils';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  ArrowUpRight, ArrowDownLeft, Scale, Coins, Trash2, TrendingUp, AlertTriangle, 
  History, Percent, Award, Calendar, FileSpreadsheet, FileText, Info,
  AlertOctagon, BadgeAlert, TrendingDown, Hourglass, Factory, Lock, Search, Filter,
  ArrowRightLeft, LineChart, CandlestickChart, Download, Users, ChevronRight, Crown, Briefcase, ChevronUp, ChevronDown,
  Timer, PieChart as PieIcon, BarChart3, Activity, Wallet, FileDown
} from 'lucide-react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart as ReLineChart, Line, AreaChart, Area, ComposedChart, PieChart, Pie
} from 'recharts';

// --- Shared UI Components ---

const Card: React.FC<{ children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode, delay?: number }> = ({ children, className = '', title, action, delay = 0 }) => (
  <div 
    className={`bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden animate-slide-up ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {title && (
      <div className="px-4 md:px-6 py-4 border-b border-slate-50 flex flex-wrap justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10 gap-2">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">{title}</h3>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-4 md:p-6 flex-1 overflow-auto">{children}</div>
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 animate-slide-up">
    <div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mt-1 font-medium">{subtitle}</p>}
    </div>
    {action && <div className="flex gap-2 w-full md:w-auto">{action}</div>}
  </div>
);

const ExportMenu: React.FC<{ onExport: (type: 'CSV' | 'PDF') => void }> = ({ onExport }) => (
    <div className="flex gap-2">
        <button onClick={() => onExport('CSV')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> CSV
        </button>
        <button onClick={() => onExport('PDF')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> PDF
        </button>
    </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [inventory, setInventory] = useState<InventoryBatch[]>([]);
  const [marketRate, setMarketRate] = useState<string>(''); 
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Delete Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [dateRange, setDateRange] = useState({
      start: getDateDaysAgo(30),
      end: new Date().toISOString().split('T')[0]
  });
  const [lockDate, setLockDate] = useState<string | null>(localStorage.getItem('bullion_lock_date') || null);
  const [showLockSettings, setShowLockSettings] = useState(false);

  // Load Data
  useEffect(() => {
    setInvoices(loadInvoices());
    setInventory(loadInventory());
  }, []);

  // Save Data
  useEffect(() => {
    saveInvoices(invoices);
    saveInventory(inventory);
  }, [invoices, inventory]);

  useEffect(() => {
      if(lockDate) localStorage.setItem('bullion_lock_date', lockDate);
      else localStorage.removeItem('bullion_lock_date');
  }, [lockDate]);

  const addToast = (type: 'SUCCESS' | 'ERROR', message: string) => {
      const id = generateId();
      setToasts(prev => [...prev, { id, type, message }]);
  };
  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- DERIVED INTELLIGENCE (GLOBAL) ---
  const filteredInvoices = useMemo(() => {
      const query = searchQuery.toLowerCase();
      return invoices.filter(inv => {
          const matchesDate = inv.date >= dateRange.start && inv.date <= dateRange.end;
          const matchesSearch = !query || inv.partyName.toLowerCase().includes(query);
          return matchesDate && matchesSearch;
      });
  }, [invoices, dateRange, searchQuery]);

  // Inventory filtered by Date AND Search (for Table View)
  const filteredInventory = useMemo(() => {
      const query = searchQuery.toLowerCase();
      return inventory.filter(batch => {
          const matchesDate = batch.date >= dateRange.start && batch.date <= dateRange.end;
          if (!matchesDate) return false;
          if (!query) return true;
          const invoice = invoices.find(inv => inv.id === batch.id);
          return invoice ? invoice.partyName.toLowerCase().includes(query) : false;
      });
  }, [inventory, invoices, dateRange, searchQuery]);

  // Inventory filtered ONLY by Search (for Global Stock Stats)
  const searchFilteredInventory = useMemo(() => {
      const query = searchQuery.toLowerCase();
      if (!query) return inventory;
      return inventory.filter(batch => {
          const invoice = invoices.find(inv => inv.id === batch.id);
          return invoice ? invoice.partyName.toLowerCase().includes(query) : false;
      });
  }, [inventory, invoices, searchQuery]);

  const currentStock = useMemo(() => searchFilteredInventory.reduce((acc, batch) => acc + batch.remainingQuantity, 0), [searchFilteredInventory]);
  const fifoValue = useMemo(() => searchFilteredInventory.reduce((acc, batch) => acc + (batch.remainingQuantity * batch.costPerGram), 0), [searchFilteredInventory]);
  const weightedAvgCost = currentStock > 0 ? fifoValue / currentStock : 0;

  const agingStats: AgingStats = useMemo(() => calculateStockAging(searchFilteredInventory), [searchFilteredInventory]);

  const { customerData, totalProfit, profitMargin, profitTrendData, dailyProfit } = useMemo(() => {
      const customerStats: Record<string, CustomerStat & { avgQtyPerTx?: number, avgSellingPrice?: number, behaviorPattern?: string }> = {};
      let totalRevenueExTax = 0;
      let totalProfitCalc = 0;

      filteredInvoices.forEach(inv => {
          if (!customerStats[inv.partyName]) {
              customerStats[inv.partyName] = { 
                  name: inv.partyName, totalGrams: 0, totalSpend: 0, profitContribution: 0, txCount: 0, avgProfitPerGram: 0
              };
          }
          customerStats[inv.partyName].txCount += 1;

          if (inv.type === 'SALE') {
              customerStats[inv.partyName].totalGrams += inv.quantityGrams;
              // Using taxableAmount (Ex-GST) for total spend analysis as requested
              customerStats[inv.partyName].totalSpend += inv.taxableAmount; 
              customerStats[inv.partyName].profitContribution += (inv.profit || 0);

              totalRevenueExTax += (inv.quantityGrams * inv.ratePerGram);
              totalProfitCalc += (inv.profit || 0);
          }
      });

      const data = Object.values(customerStats)
        .filter(stat => stat.totalSpend > 0)
        .map(stat => {
            const margin = stat.totalSpend > 0 ? (stat.profitContribution / stat.totalSpend) * 100 : 0;
            const avgQty = stat.totalGrams / stat.txCount;
            const avgSell = stat.totalGrams > 0 ? stat.totalSpend / stat.totalGrams : 0;
            const avgProfit = stat.totalGrams > 0 ? stat.profitContribution / stat.totalGrams : 0;
            
            let pattern = "Regular";
            if(avgQty > 100) pattern = "Bulk Buyer";
            else if(stat.txCount > 5) pattern = "Frequent";
            
            if(margin < 0.5) pattern += " (Price Sensitive)";
            else if(margin > 2.0) pattern += " (High Margin)";

            return {
                ...stat,
                margin: margin,
                avgProfitPerGram: avgProfit,
                avgQtyPerTx: avgQty,
                avgSellingPrice: avgSell,
                behaviorPattern: pattern
            };
        })
        .sort((a,b) => b.profitContribution - a.profitContribution);

      const pTrend = [];
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const sales = invoices.filter(inv => inv.type === 'SALE' && inv.date === dateStr); 
          const profit = sales.reduce((acc, inv) => acc + (inv.profit || 0), 0);
          const grams = sales.reduce((acc, inv) => acc + inv.quantityGrams, 0);
          pTrend.push({ 
             date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), 
             profit: profit,
             ppg: grams > 0 ? profit / grams : 0
          });
      }

      return {
          customerData: data,
          totalProfit: totalProfitCalc,
          profitMargin: totalRevenueExTax > 0 ? (totalProfitCalc / totalRevenueExTax) * 100 : 0,
          profitTrendData: pTrend,
          dailyProfit: pTrend
      };
  }, [filteredInvoices, dateRange, invoices]);

  const supplierData: SupplierStat[] = useMemo(() => calculateSupplierStats(filteredInvoices), [filteredInvoices]);
  const turnoverStats = useMemo(() => calculateTurnoverStats(invoices, dateRange.start, dateRange.end), [invoices, dateRange]);
  
  const alerts: RiskAlert[] = useMemo(() => {
    const list: RiskAlert[] = [];
    if (agingStats.buckets['30+'] > 0) {
      list.push({ id: 'old-stock', severity: 'HIGH', context: 'Inventory', message: `${formatGrams(agingStats.buckets['30+'])} of gold is older than 30 days.` });
    }
    const recentSales = invoices.filter(i => i.type === 'SALE').slice(0, 5);
    if (recentSales.length > 0) {
       const recentMargin = recentSales.reduce((acc, i) => acc + (i.profit || 0), 0) / recentSales.reduce((acc, i) => acc + (i.taxableAmount || 0), 0);
       if (recentMargin < 0.005) { 
         list.push({ id: 'low-margin', severity: 'MEDIUM', context: 'Profit', message: 'Recent sales margins are critically low (< 0.5%).' });
       }
    }
    return list;
  }, [agingStats, invoices]);

  // Recalculates entire inventory from scratch based on a list of invoices
  // This ensures FIFO integrity is maintained even after deleting a historical transaction
  const recalculateAllData = (allInvoices: Invoice[]) => {
    // Sort by date ascending for correct FIFO processing
    const sorted = [...allInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let currentInventory: InventoryBatch[] = [];
    const processedInvoices: Invoice[] = [];

    for (const inv of sorted) {
        if (inv.type === 'PURCHASE') {
            const newBatch: InventoryBatch = {
                id: inv.id,
                date: inv.date,
                originalQuantity: inv.quantityGrams,
                remainingQuantity: inv.quantityGrams,
                costPerGram: inv.ratePerGram
            };
            currentInventory.push(newBatch);
            processedInvoices.push(inv);
        } else {
            // SALE Logic
            let remainingToSell = inv.quantityGrams;
            let totalCOGS = 0;
            
            for (const batch of currentInventory) {
                if (remainingToSell <= 0) break;
                if (batch.remainingQuantity > 0) {
                    const take = Math.min(batch.remainingQuantity, remainingToSell);
                    batch.remainingQuantity -= take;
                    remainingToSell -= take;
                    totalCOGS += (take * batch.costPerGram);
                    
                    if (batch.remainingQuantity < 0.0001) {
                         batch.remainingQuantity = 0;
                         batch.closedDate = inv.date;
                    }
                }
            }
            
            // If remainingToSell > 0 here, it means we sold stock we didn't have (FIFO broke).
            // In a strict system we block this, but for recalculation we proceed with best effort.
            
            const profit = (inv.taxableAmount || (inv.quantityGrams * inv.ratePerGram)) - totalCOGS;
            processedInvoices.push({ ...inv, cogs: totalCOGS, profit });
        }
    }
    
    return {
        updatedInvoices: processedInvoices,
        updatedInventory: currentInventory
    };
  };

  const initiateDelete = (id: string) => {
      setDeleteId(id);
      setDeletePassword('');
      setShowDeleteModal(true);
  };

  const confirmDelete = () => {
      if (deletePassword === 'QAZ@789') {
          if (deleteId) {
              const remainingInvoices = invoices.filter(i => i.id !== deleteId);
              const { updatedInvoices, updatedInventory } = recalculateAllData(remainingInvoices);
              
              setInvoices(updatedInvoices);
              setInventory(updatedInventory);
              addToast('SUCCESS', 'Record deleted and data recalculated.');
          }
          setShowDeleteModal(false);
          setDeleteId(null);
          setDeletePassword('');
      } else {
          addToast('ERROR', 'Incorrect Admin Password.');
      }
  };

  const handleAddInvoice = (invoice: Invoice) => {
    if (invoice.type === 'PURCHASE') {
        setInvoices(prev => [invoice, ...prev]); 
        const newBatch: InventoryBatch = { id: invoice.id, date: invoice.date, originalQuantity: invoice.quantityGrams, remainingQuantity: invoice.quantityGrams, costPerGram: invoice.ratePerGram };
        setInventory(prev => [...prev, newBatch].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        addToast('SUCCESS', 'Purchase recorded & Inventory Updated');
    } else {
        // Optimization: For adding a new sale (latest date usually), we can just do incremental update
        // instead of full recalc. However, if user adds a back-dated sale, full recalc is safer.
        // For now, keeping the optimized incremental logic for standard usage, but if date is older than latest invoice, we should recalc.
        
        const latestInvoiceDate = invoices.length > 0 ? invoices[0].date : '';
        if (latestInvoiceDate && invoice.date < latestInvoiceDate) {
             // Back-dated transaction: Use full recalculation
             const newInvoices = [...invoices, invoice];
             const { updatedInvoices, updatedInventory } = recalculateAllData(newInvoices);
             setInvoices(updatedInvoices.reverse()); // Store descending
             setInventory(updatedInventory);
             addToast('SUCCESS', 'Back-dated Sale recorded. History Recalculated.');
             return;
        }

        let remainingToSell = invoice.quantityGrams;
        let totalCOGS = 0;
        const newInventory = JSON.parse(JSON.stringify(inventory)) as InventoryBatch[];

        for (const batch of newInventory) {
            if (remainingToSell <= 0) break;
            if (batch.remainingQuantity > 0) {
                const take = Math.min(batch.remainingQuantity, remainingToSell);
                batch.totalRevenue = (batch.totalRevenue || 0) + (take * invoice.ratePerGram);
                batch.remainingQuantity -= take;
                remainingToSell -= take;
                totalCOGS += (take * batch.costPerGram);
                if (batch.remainingQuantity < 0.0001) { 
                    batch.remainingQuantity = 0;
                    batch.closedDate = invoice.date;
                }
            }
        }
        if (remainingToSell > 0.001) { addToast('ERROR', "FIFO Mismatch - Check Stock"); return; }
        const profit = (invoice.quantityGrams * invoice.ratePerGram) - totalCOGS;
        setInvoices(prev => [{ ...invoice, cogs: totalCOGS, profit }, ...prev]);
        setInventory(newInventory);
        addToast('SUCCESS', 'Sale recorded. FIFO Logic Applied.');
    }
  };

  const handleReset = () => {
      if(window.confirm("Are you sure? This will delete all data. This action cannot be undone.")) {
          resetData(); setInvoices([]); setInventory([]);
          addToast('SUCCESS', 'System Reset Complete');
      }
  }

  // --- EXPORT HANDLERS ---
  
  const generatePDF = (title: string, head: string[][], body: (string | number)[][], summary?: string[]) => {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(title, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
      
      if (summary) {
          summary.forEach((line, i) => doc.text(line, 14, 28 + (i * 5)));
      }

      autoTable(doc, {
          startY: summary ? 30 + (summary.length * 5) : 30,
          head: head,
          body: body,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [209, 151, 38] }
      });
      doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
      addToast('SUCCESS', `${title} downloaded.`);
  };

  const handleInventoryExport = (type: 'CSV' | 'PDF') => {
      const data = inventory.filter(inv => inv.date >= dateRange.start && inv.date <= dateRange.end).map(b => ({
          batchId: b.id,
          date: b.date,
          originalQty: b.originalQuantity,
          remainingQty: b.remainingQuantity,
          costPerGram: b.costPerGram,
          totalValue: b.remainingQuantity * b.costPerGram,
          status: b.remainingQuantity > 0 ? 'Active' : 'Closed'
      }));

      if (type === 'CSV') {
          const headers = ['Batch ID', 'Date', 'Original Qty (g)', 'Remaining Qty (g)', 'Cost (INR/g)', 'Total Value (INR)', 'Status'];
          const csv = [
              headers.join(','),
              ...data.map(r => [r.batchId, r.date, r.originalQty, r.remainingQty, r.costPerGram, r.totalValue, r.status].join(','))
          ].join('\n');
          downloadCSV(csv, `inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
          addToast('SUCCESS', 'Inventory CSV downloaded.');
      } else {
          generatePDF('Inventory Report', 
            [['Batch ID', 'Date', 'Original (g)', 'Remaining (g)', 'Cost/g', 'Value', 'Status']],
            data.map(r => [r.batchId, r.date, formatGrams(r.originalQty), formatGrams(r.remainingQty), formatCurrency(r.costPerGram), formatCurrency(r.totalValue), r.status])
          );
      }
  };

  const handlePriceExport = (type: 'CSV' | 'PDF', purchases: Invoice[]) => {
       if (type === 'CSV') {
           const headers = ['Date', 'Supplier', 'Quantity (g)', 'Rate (INR/g)', 'Total (INR)'];
           const csv = [
               headers.join(','),
               ...purchases.map(p => [p.date, `"${p.partyName}"`, p.quantityGrams, p.ratePerGram, p.quantityGrams * p.ratePerGram].join(','))
           ].join('\n');
           downloadCSV(csv, `price_analysis_purchases_${dateRange.start}_${dateRange.end}.csv`);
           addToast('SUCCESS', 'Price Data CSV downloaded.');
       } else {
           generatePDF('Price Analysis - Purchases', 
             [['Date', 'Supplier', 'Qty (g)', 'Rate (INR/g)', 'Total (INR)']],
             purchases.map(p => [p.date, p.partyName, formatGrams(p.quantityGrams), formatCurrency(p.ratePerGram), formatCurrency(p.quantityGrams * p.ratePerGram)])
           );
       }
  };

  const handleCustomerExport = (type: 'CSV' | 'PDF') => {
       if (type === 'CSV') {
           const headers = ['Customer', 'Frequency', 'Total Grams', 'Revenue (Ex GST)', 'Avg Price', 'Avg Profit/g', 'Pattern'];
           const csv = [
               headers.join(','),
               ...customerData.map(c => [
                   `"${c.name}"`, c.txCount, c.totalGrams, c.totalSpend, c.avgSellingPrice, c.avgProfitPerGram, c.behaviorPattern
               ].join(','))
           ].join('\n');
           downloadCSV(csv, `customer_insights_${dateRange.start}_${dateRange.end}.csv`);
           addToast('SUCCESS', 'Customer Data CSV downloaded.');
       } else {
           generatePDF('Customer Intelligence Report', 
             [['Customer', 'Freq', 'Total Grams', 'Revenue (Ex GST)', 'Avg Price', 'Profit/g', 'Pattern']],
             customerData.map(c => [c.name, c.txCount, formatGrams(c.totalGrams), formatCurrency(c.totalSpend), formatCurrency(c.avgSellingPrice || 0), formatCurrency(c.avgProfitPerGram || 0), c.behaviorPattern || ''])
           );
       }
  };

  const handleSupplierExport = (type: 'CSV' | 'PDF') => {
       if (type === 'CSV') {
           const headers = ['Supplier', 'Transactions', 'Total Volume (g)', 'Avg Rate', 'Min Rate', 'Max Rate', 'Volatility'];
           const csv = [
               headers.join(','),
               ...supplierData.map(s => [
                   `"${s.name}"`, s.txCount, s.totalGramsPurchased, s.avgRate, s.minRate, s.maxRate, s.volatility
               ].join(','))
           ].join('\n');
           downloadCSV(csv, `supplier_insights_${dateRange.start}_${dateRange.end}.csv`);
           addToast('SUCCESS', 'Supplier Data CSV downloaded.');
       } else {
           generatePDF('Supplier Insights Report', 
             [['Supplier', 'Tx Count', 'Vol (g)', 'Avg Rate', 'Min', 'Max', 'Volatility']],
             supplierData.map(s => [s.name, s.txCount, formatGrams(s.totalGramsPurchased), formatCurrency(s.avgRate), formatCurrency(s.minRate), formatCurrency(s.maxRate), formatCurrency(s.volatility)])
           );
       }
  };

  const handleLedgerExport = (type: 'CSV' | 'PDF', monthlyData: any[], totals: any) => {
      if (type === 'CSV') {
          const headers = ['Month', 'Turnover (Ex GST)', 'Profit', 'Margin %', 'Qty Sold'];
          const csv = [
              headers.join(','),
              ...monthlyData.map(m => [
                  m.date.toLocaleDateString('en-IN', {month: 'long', year: 'numeric'}), m.turnover, m.profit, (m.turnover > 0 ? (m.profit/m.turnover)*100 : 0).toFixed(2), m.qty
              ].join(','))
          ].join('\n');
          downloadCSV(csv, `business_ledger_lifetime.csv`);
          addToast('SUCCESS', 'Ledger CSV downloaded.');
      } else {
          generatePDF('Business Performance Ledger', 
            [['Month', 'Turnover (Ex GST)', 'Profit', 'Margin %', 'Qty Sold']],
            monthlyData.map(m => [m.date.toLocaleDateString('en-IN', {month: 'long', year: 'numeric'}), formatCurrency(m.turnover), formatCurrency(m.profit), (m.turnover > 0 ? (m.profit/m.turnover)*100 : 0).toFixed(2) + '%', formatGrams(m.qty)]),
            [
                `Total Turnover (Ex GST): ${formatCurrency(totals.turnover)}`,
                `Total Profit: ${formatCurrency(totals.profit)}`,
                `Overall Margin: ${totals.margin.toFixed(2)}%`,
                `Total Gold Sold: ${formatGrams(totals.qty)}`
            ]
          );
      }
  };

  const handleInvoicesExport = (type: 'CSV' | 'PDF') => {
       const data = [...filteredInvoices].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
       
       if (type === 'CSV') {
           const headers = ['Date', 'Type', 'Party', 'Qty (g)', 'Rate (INR/g)', 'My Cost (INR/g)', 'Taxable (Ex GST)', 'GST (INR)', 'Total (Inc GST)', 'My Total Cost (Ex GST)', 'Profit (Ex GST)'];
           const csv = [
               headers.join(','),
               ...data.map(i => {
                   const myCost = i.type === 'SALE' && i.cogs ? (i.cogs / i.quantityGrams) : 0;
                   const myTotalCost = i.type === 'SALE' ? (i.cogs || 0) : i.taxableAmount;
                   return [
                       i.date, i.type, `"${i.partyName}"`, i.quantityGrams, i.ratePerGram, myCost > 0 ? myCost.toFixed(2) : '-', i.taxableAmount, i.gstAmount, i.totalAmount, myTotalCost, i.profit || 0
                   ].join(',')
               })
           ].join('\n');
           downloadCSV(csv, `transactions_${dateRange.start}_${dateRange.end}.csv`);
           addToast('SUCCESS', 'Transactions CSV downloaded.');
       } else {
           generatePDF('Transaction Report', 
             [['Date', 'Type', 'Party', 'Qty', 'Rate', 'My Cost', 'Taxable', 'GST', 'Total', 'My Total Cost', 'Profit']],
             data.map(i => {
                 const myCost = i.type === 'SALE' && i.cogs ? (i.cogs / i.quantityGrams) : 0;
                 const myTotalCost = i.type === 'SALE' ? (i.cogs || 0) : i.taxableAmount;
                 return [
                     i.date, 
                     i.type.substring(0,1), 
                     i.partyName, 
                     formatGrams(i.quantityGrams), 
                     formatCurrency(i.ratePerGram),
                     myCost > 0 ? formatCurrency(myCost) : '-',
                     formatCurrency(i.taxableAmount), 
                     formatCurrency(i.gstAmount), 
                     formatCurrency(i.totalAmount), 
                     formatCurrency(myTotalCost),
                     i.profit ? formatCurrency(i.profit) : '-'
                 ]
             })
           );
       }
  };

  const renderDateFilter = () => (
      <DateRangePicker startDate={dateRange.start} endDate={dateRange.end} onChange={(start, end) => setDateRange({ start, end })} />
  );

  // --- SUB-VIEWS ---

  const DashboardView = () => {
      // Calculate basic stats
      const totalStock = currentStock; 
      const stockValue = fifoValue; 
      const recentProfit = dailyProfit.reduce((sum, d) => sum + d.profit, 0);

      return (
          <div className="space-y-6 animate-enter">
              <SectionHeader 
                  title="Dashboard" 
                  subtitle="Overview of your inventory and financial health." 
                  action={renderDateFilter()}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard 
                      title="Current Stock" 
                      value={formatGrams(totalStock)} 
                      subValue={`${inventory.length} Batches`} 
                      icon={Coins} 
                      isActive
                  />
                  <StatsCard 
                      title="Inventory Value" 
                      value={formatCurrency(stockValue)} 
                      subValue="FIFO Basis" 
                      icon={Scale} 
                      delayIndex={1}
                  />
                  <StatsCard 
                      title="Net Profit" 
                      value={formatCurrency(recentProfit)} 
                      subValue="Selected Period" 
                      icon={TrendingUp} 
                      delayIndex={2}
                  />
                  <StatsCard 
                      title="Transactions" 
                      value={filteredInvoices.length.toString()} 
                      subValue={`${filteredInvoices.filter(i => i.type === 'SALE').length} Sales`} 
                      icon={ArrowRightLeft} 
                      delayIndex={3}
                  />
              </div>

              {alerts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {alerts.map((alert, idx) => (
                          <div key={idx} className={`p-4 rounded-xl border flex items-start gap-4 ${alert.severity === 'HIGH' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                              <div className={`p-2 rounded-lg ${alert.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                  <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div>
                                  <h4 className="font-bold text-sm uppercase tracking-wide mb-1">{alert.context}: {alert.severity} Risk</h4>
                                  <p className="text-sm">{alert.message}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card title="Profit Trend" className="lg:col-span-2 min-h-[350px]">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={profitTrendData}>
                                    <defs>
                                        <linearGradient id="colorProfitDb" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}}/>
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(v) => `${v/1000}k`}/>
                                    <Tooltip 
                                        contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} 
                                        formatter={(value: number) => [formatCurrency(value), 'Net Profit']}
                                    />
                                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitDb)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                  </Card>

                  <Card title="Quick Actions" className="lg:col-span-1">
                      <div className="space-y-3">
                          <button onClick={() => setActiveTab('invoices')} className="w-full p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-gold-200 hover:shadow-md transition-all flex items-center gap-3 text-left group">
                              <div className="p-3 bg-white rounded-lg shadow-sm group-hover:bg-gold-50 text-gold-600 transition-colors"><FileText className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="font-bold text-slate-900">New Invoice</h4>
                                  <p className="text-xs text-slate-500">Record purchase or sale</p>
                              </div>
                              <ChevronRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-gold-500"/>
                          </button>
                          <button onClick={() => setActiveTab('inventory')} className="w-full p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all flex items-center gap-3 text-left group">
                              <div className="p-3 bg-white rounded-lg shadow-sm group-hover:bg-blue-50 text-blue-600 transition-colors"><ArrowUpRight className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="font-bold text-slate-900">Check Stock</h4>
                                  <p className="text-xs text-slate-500">View inventory batches</p>
                              </div>
                              <ChevronRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-blue-500"/>
                          </button>
                          <button onClick={() => window.print()} className="w-full p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all flex items-center gap-3 text-left group">
                              <div className="p-3 bg-white rounded-lg shadow-sm group-hover:bg-slate-100 text-slate-600 transition-colors"><FileDown className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="font-bold text-slate-900">Print Report</h4>
                                  <p className="text-xs text-slate-500">Export current view</p>
                              </div>
                              <ChevronRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-slate-500"/>
                          </button>
                      </div>
                  </Card>
              </div>
          </div>
      );
  };

  const CustomerInsightsView = () => {
       const COLORS = ['#d19726', '#e4c76d', '#b4761e', '#f5eccb', '#90561a', '#94a3b8'];
       const pieData = customerData.slice(0, 5).map(c => ({ name: c.name, value: c.totalGrams }));
       const others = customerData.slice(5).reduce((acc, c) => acc + c.totalGrams, 0);
       if (others > 0) pieData.push({ name: 'Others', value: others });

       return (
           <div className="space-y-6 animate-enter">
                <SectionHeader 
                    title="Customer Intelligence" 
                    subtitle="Analyze customer behavior and profitability." 
                    action={
                        <div className="flex gap-2 items-center">
                            <ExportMenu onExport={handleCustomerExport} />
                            {renderDateFilter()}
                        </div>
                    }
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customerData.slice(0, 3).map((c, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-slate-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                             <div className="relative z-10 flex justify-between items-start mb-4">
                                 <div>
                                     <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg text-slate-900 truncate max-w-[150px]">{c.name}</h3>
                                        {i === 0 && <Crown className="w-4 h-4 text-gold-500 fill-gold-500" />}
                                     </div>
                                     <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wide">{c.behaviorPattern.split('(')[0]}</span>
                                 </div>
                                 <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shadow-lg">
                                     #{i+1}
                                 </div>
                             </div>
                             <div className="relative z-10 space-y-2">
                                 <div className="flex justify-between text-sm"><span className="text-slate-500">Total Bought</span><span className="font-mono font-bold">{formatGrams(c.totalGrams)}</span></div>
                                 <div className="flex justify-between text-sm"><span className="text-slate-500">Revenue</span><span className="font-mono font-bold text-slate-700">{formatCurrency(c.totalSpend)}</span></div>
                                 <div className="flex justify-between text-sm"><span className="text-slate-500">Profit Contrib.</span><span className="font-mono font-bold text-green-600">{formatCurrency(c.profitContribution)}</span></div>
                             </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     <Card title="Customer Database" className="lg:col-span-2">
                          <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                  <thead className="text-slate-500 bg-slate-50/50">
                                      <tr>
                                          <th className="px-4 py-3">Customer</th>
                                          <th className="px-4 py-3 text-center">Tx Freq</th>
                                          <th className="px-4 py-3 text-right">Volume</th>
                                          <th className="px-4 py-3 text-right">Avg Price</th>
                                          <th className="px-4 py-3 text-right">Margin</th>
                                          <th className="px-4 py-3 text-right">Total Profit</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {customerData.map((c, i) => (
                                          <tr key={i} className="hover:bg-slate-50 border-b border-slate-50">
                                              <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                                              <td className="px-4 py-3 text-center text-slate-500">{c.txCount}</td>
                                              <td className="px-4 py-3 text-right font-mono text-slate-600">{formatGrams(c.totalGrams)}</td>
                                              <td className="px-4 py-3 text-right font-mono text-slate-500">{formatCurrency(c.avgSellingPrice || 0)}</td>
                                              <td className="px-4 py-3 text-right">
                                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.margin && c.margin > 1.5 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                      {c.margin ? c.margin.toFixed(2) : '0.00'}%
                                                  </span>
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono font-bold text-green-600">{formatCurrency(c.profitContribution)}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                     </Card>

                     <Card title="Volume Share" className="min-h-[350px]">
                         <ResponsiveContainer width="100%" height={300}>
                             <PieChart>
                                 <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                     {pieData.map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                     ))}
                                 </Pie>
                                 <Tooltip formatter={(val:number) => formatGrams(val)} contentStyle={{borderRadius: '8px'}} />
                                 <Legend verticalAlign="bottom" height={36}/>
                             </PieChart>
                         </ResponsiveContainer>
                     </Card>
                </div>
           </div>
       );
  };

  const PriceAnalysisView = () => {
      const priceMetrics = useMemo(() => {
          const purchases = filteredInvoices.filter(i => i.type === 'PURCHASE');
          const sales = filteredInvoices.filter(i => i.type === 'SALE');
          
          const trendData = [];
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              const daySales = sales.filter(inv => inv.date === dateStr);
              const totalVal = daySales.reduce((acc, i) => acc + (i.ratePerGram * i.quantityGrams), 0);
              const totalQty = daySales.reduce((acc, i) => acc + i.quantityGrams, 0);
              trendData.push({
                  date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                  avgSellPrice: totalQty > 0 ? totalVal / totalQty : null
              });
          }

          return { trendData, purchases };
      }, [filteredInvoices, dateRange]);

      return (
        <div className="space-y-8 animate-enter">
             <SectionHeader 
                title="Price Intelligence & Spread Analysis" 
                subtitle="Pricing trends, spreads, and supplier consistency." 
                action={
                    <div className="flex gap-2 items-center">
                        <ExportMenu onExport={(t) => handlePriceExport(t, priceMetrics.purchases)} />
                        {renderDateFilter()}
                    </div>
                } 
             />
             
             {/* Charts */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card title="Selling Price Trend (Avg/g)" delay={100} className="min-h-[400px]">
                      <div className="h-full w-full">
                          <ResponsiveContainer>
                              <AreaChart data={priceMetrics.trendData}>
                                  <defs>
                                      <linearGradient id="colorSell" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#d19726" stopOpacity={0.2}/>
                                          <stop offset="95%" stopColor="#d19726" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}}/>
                                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(v) => `₹${v}`}/>
                                  <Tooltip contentStyle={{borderRadius: '12px'}} formatter={(val:number) => [formatCurrency(val), 'Avg Sell Price']}/>
                                  <Area type="monotone" dataKey="avgSellPrice" stroke="#b4761e" fill="url(#colorSell)" />
                              </AreaChart>
                          </ResponsiveContainer>
                      </div>
                 </Card>
                 
                 <Card title="Supplier Cost Consistency" delay={200} className="min-h-[400px]">
                      <div className="overflow-x-auto">
                           <table className="w-full text-sm text-left">
                               <thead className="text-slate-500 bg-slate-50/50">
                                   <tr>
                                       <th className="px-4 py-3">Supplier</th>
                                       <th className="px-4 py-3 text-right">Avg Rate</th>
                                       <th className="px-4 py-3 text-right">Min Rate</th>
                                       <th className="px-4 py-3 text-right">Max Rate</th>
                                       <th className="px-4 py-3 text-right">Volatility (Spread)</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {supplierData.map((s, i) => (
                                       <tr key={i} className="hover:bg-slate-50 border-b border-slate-50">
                                           <td className="px-4 py-3 font-medium">{s.name}</td>
                                           <td className="px-4 py-3 text-right font-mono text-blue-600">{formatCurrency(s.avgRate)}</td>
                                           <td className="px-4 py-3 text-right font-mono text-slate-500">{formatCurrency(s.minRate)}</td>
                                           <td className="px-4 py-3 text-right font-mono text-slate-500">{formatCurrency(s.maxRate)}</td>
                                           <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{formatCurrency(s.volatility)}</td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                      </div>
                 </Card>
             </div>

             {/* Purchase Transaction Table */}
             <Card title="Detailed Purchase Transactions" delay={300}>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="text-slate-500 bg-slate-50/50">
                              <tr>
                                  <th className="px-4 py-3">Date</th>
                                  <th className="px-4 py-3">Supplier</th>
                                  <th className="px-4 py-3 text-right">Qty (g)</th>
                                  <th className="px-4 py-3 text-right">Purchase Rate (₹/g)</th>
                                  <th className="px-4 py-3 text-right">Taxable (Ex-Tax)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {priceMetrics.purchases.length === 0 ? (<tr><td colSpan={5} className="text-center py-8 text-slate-400">No purchases in this period.</td></tr>) : 
                                priceMetrics.purchases.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => (
                                  <tr key={inv.id} className="hover:bg-slate-50 border-b border-slate-50">
                                      <td className="px-4 py-3 text-slate-500">{inv.date}</td>
                                      <td className="px-4 py-3 font-medium">{inv.partyName}</td>
                                      <td className="px-4 py-3 text-right font-mono">{formatGrams(inv.quantityGrams)}</td>
                                      <td className="px-4 py-3 text-right font-mono text-blue-600">{formatCurrency(inv.ratePerGram)}</td>
                                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(inv.taxableAmount)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
             </Card>
        </div>
      );
  };

  const AnalyticsView = () => {
      const realizedProfit = totalProfit; // FIFO profit from closed sales
      const rate = parseFloat(marketRate);
      const hasRate = !isNaN(rate) && rate > 0;
      const unrealizedProfit = hasRate ? (currentStock * rate) - fifoValue : 0;
      
      const pieData = customerData.slice(0, 5).map(c => ({ name: c.name, value: c.totalGrams }));
      const others = customerData.slice(5).reduce((acc, c) => acc + c.totalGrams, 0);
      if (others > 0) pieData.push({ name: 'Others', value: others });
      const COLORS = ['#d19726', '#e4c76d', '#b4761e', '#f5eccb', '#90561a', '#94a3b8'];

      return (
      <div className="space-y-8">
          <SectionHeader 
             title="Analytics & Reports" 
             subtitle="Deep dive into your business performance." 
             action={
                 <div className="flex gap-2 items-center">
                    <ExportMenu onExport={(t) => addToast('SUCCESS', 'For detailed exports, use specific sections or Generate PDF below.')} />
                    {renderDateFilter()}
                 </div>
             } 
          />

          {/* Cash & Turnover Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard title="Inventory Turnover" value={`${turnoverStats.turnoverRatio.toFixed(2)}x`} subValue="Ratio (COGS / Avg Inv)" icon={Activity} isActive />
              <StatsCard title="Avg Days to Sell" value={`${Math.round(turnoverStats.avgDaysToSell)} Days`} subValue="Velocity" icon={Timer} />
              <StatsCard title="Realized Profit" value={formatCurrency(realizedProfit)} subValue="From Sales" icon={Wallet} />
              <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-center">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-gold-500/20 rounded-full blur-3xl -mr-8 -mt-8"></div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Unrealized Profit (Est)</p>
                   <div className="flex items-end gap-2 mb-2">
                       <input 
                          type="number" 
                          placeholder="Mkt Rate..." 
                          value={marketRate} 
                          onChange={(e) => setMarketRate(e.target.value)} 
                          className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-gold-500 outline-none"
                       />
                   </div>
                   <h3 className={`text-2xl font-mono font-bold ${unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                       {hasRate ? formatCurrency(unrealizedProfit) : '---'}
                   </h3>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
               {[
                   { id: 'CUSTOMER', title: 'Customer Report', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                   { id: 'SUPPLIER', title: 'Supplier Report', icon: Factory, color: 'text-blue-600', bg: 'bg-blue-50' },
                   { id: 'CONSOLIDATED', title: 'Full Audit', icon: FileText, color: 'text-gold-600', bg: 'bg-gold-50' }
               ].map((rpt, i) => (
                   <div key={rpt.id} onClick={() => {}} className="group bg-white p-6 rounded-2xl border border-slate-100 shadow-card hover:shadow-lg transition-all cursor-pointer flex items-center gap-5 animate-slide-up" style={{ animationDelay: `${i*100}ms` }}>
                       <div className={`p-4 rounded-xl ${rpt.bg} ${rpt.color} group-hover:scale-110 transition-transform`}>
                           <rpt.icon className="w-6 h-6"/>
                       </div>
                       <div>
                           <h3 className="font-bold text-slate-900 text-lg">{rpt.title}</h3>
                           <p className="text-slate-400 text-sm mt-0.5">Generate PDF</p>
                       </div>
                       <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                           <Download className="w-5 h-5 text-slate-300"/>
                       </div>
                   </div>
               ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card title="Profit Trajectory" className="lg:col-span-2" delay={300}>
                  <div className="h-64 md:h-80 w-full">
                      <ResponsiveContainer>
                          <AreaChart data={profitTrendData}>
                              <defs>
                                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, dy: 10}}/>
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(v) => `${v/1000}k`}/>
                              <Tooltip 
                                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} 
                                  formatter={(value: number) => [formatCurrency(value), 'Net Profit']}
                              />
                              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </Card>

              <Card title="Customer Volume Share" className="lg:col-span-1 min-h-[300px]" delay={400}>
                 <ResponsiveContainer width="100%" height={300}>
                     <PieChart>
                         <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                             {pieData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                         </Pie>
                         <Tooltip formatter={(val:number) => formatGrams(val)} contentStyle={{borderRadius: '8px'}} />
                         <Legend verticalAlign="bottom" height={36}/>
                     </PieChart>
                 </ResponsiveContainer>
              </Card>
          </div>
      </div>
  )};

  const InvoicesView = () => (
      <div className="flex flex-col lg:flex-row gap-6 relative items-start h-full">
          <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 lg:sticky lg:top-0 transition-all">
              <InvoiceForm onAdd={handleAddInvoice} currentStock={currentStock} lockDate={lockDate} />
          </div>
          <div className="flex-1 w-full min-w-0">
              <Card title="Recent Transactions" className="min-h-[600px] h-full flex flex-col" delay={200}
                 action={
                     <div className="flex gap-2 items-center">
                        <ExportMenu onExport={handleInvoicesExport} />
                        {renderDateFilter()}
                     </div>
                 }
              >
                  <div className="overflow-auto flex-1 -mx-6 px-6 relative [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 transition-colors">
                      <table className="w-full text-sm text-left border-separate border-spacing-y-2 min-w-[1000px]">
                          <thead className="text-slate-400 sticky top-0 bg-white/95 backdrop-blur z-10">
                              <tr>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50">Date</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50">Type</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50">Party</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">Qty</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">Rate/g</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">My Cost/g</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">Taxable (Ex GST)</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">GST</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">Total (Inc)</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">My Total Cost (Ex GST)</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-right">Profit</th>
                                  <th className="px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b border-slate-50 text-center">Action</th>
                              </tr>
                          </thead>
                          <tbody>
                              {filteredInvoices.length === 0 ? (
                                  <tr><td colSpan={12} className="px-4 py-20 text-center text-slate-400 italic">No transactions recorded in this period.</td></tr>
                              ) : (
                                  filteredInvoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((inv, i) => {
                                      const myCostPerGram = inv.type === 'SALE' && inv.cogs ? inv.cogs / inv.quantityGrams : null;
                                      return (
                                      <tr key={inv.id} className="group hover:scale-[1.01] transition-transform duration-200">
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-l border-transparent group-hover:border-slate-100 text-slate-500 font-mono text-xs rounded-l-xl">{inv.date}</td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100">
                                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${inv.type === 'PURCHASE' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{inv.type === 'PURCHASE' ? 'In' : 'Out'}</span>
                                          </td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-medium text-slate-900 truncate max-w-[150px]">{inv.partyName}</td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono text-slate-600 text-right">{formatGrams(inv.quantityGrams)}</td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono text-slate-500 text-right">{formatCurrency(inv.ratePerGram).replace('.00','')}</td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono text-slate-500 text-right">
                                              {myCostPerGram ? formatCurrency(myCostPerGram).replace('.00','') : '-'}
                                          </td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono font-medium text-slate-900 text-right">{formatCurrency(inv.taxableAmount)}</td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono text-slate-500 text-right">{formatCurrency(inv.gstAmount)}</td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono text-slate-400 text-right">{formatCurrency(inv.totalAmount)}</td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono font-medium text-slate-700 text-right">
                                              {formatCurrency(inv.type === 'SALE' ? (inv.cogs || 0) : inv.taxableAmount)}
                                          </td>
                                          <td className={`px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 font-mono font-bold text-right ${(inv.profit || 0) > 0 ? 'text-green-600' : (inv.profit || 0) < 0 ? 'text-red-600' : 'text-slate-300'}`}>
                                              {inv.type === 'SALE' ? formatCurrency(inv.profit || 0) : '-'}
                                          </td>
                                          <td className="px-4 py-3 bg-slate-50/50 group-hover:bg-white border-y border-r border-transparent group-hover:border-slate-100 rounded-r-xl text-center">
                                              <button onClick={() => initiateDelete(inv.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                  <Trash2 className="w-4 h-4"/>
                                              </button>
                                          </td>
                                      </tr>
                                  )})
                              )}
                          </tbody>
                      </table>
                  </div>
              </Card>
          </div>
      </div>
  );

  const SupplierInsightsView = () => {
    // Prepare Chart Data
    const { volumeData, valueData } = useMemo(() => {
        const sortedByVol = [...supplierData].sort((a,b) => b.totalGramsPurchased - a.totalGramsPurchased);
        const sortedByVal = [...supplierData].sort((a,b) => (b.totalGramsPurchased * b.avgRate) - (a.totalGramsPurchased * a.avgRate));

        const generatePie = (data: typeof supplierData, metric: 'vol' | 'val') => {
            const mapped = data.map(s => ({
                name: s.name,
                value: metric === 'vol' ? s.totalGramsPurchased : (s.totalGramsPurchased * s.avgRate)
            }));
            const top = mapped.slice(0, 5);
            const others = mapped.slice(5).reduce((acc, curr) => acc + curr.value, 0);
            if(others > 0) top.push({ name: 'Others', value: others });
            return top;
        };

        return {
            volumeData: generatePie(sortedByVol, 'vol'),
            valueData: generatePie(sortedByVal, 'val')
        };
    }, [supplierData]);

    const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#6366f1', '#94a3b8'];

    return (
      <div className="space-y-6 animate-enter">
        <SectionHeader 
             title="Supplier Performance" 
             subtitle="Track procurement costs and volatility." 
             action={
                 <div className="flex gap-2 items-center">
                    <ExportMenu onExport={handleSupplierExport} />
                    {renderDateFilter()}
                 </div>
             }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {supplierData.slice(0, 4).map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 flex flex-col justify-between">
                     <div className="flex justify-between items-start mb-4">
                         <div>
                             <h3 className="font-bold text-lg text-slate-900">{s.name}</h3>
                             <p className="text-xs text-slate-500 uppercase tracking-wide">Primary Supplier</p>
                         </div>
                         <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Factory className="w-5 h-5"/></div>
                     </div>
                     <div className="space-y-3">
                         <div className="flex justify-between text-sm"><span className="text-slate-500">Total Volume</span><span className="font-mono font-bold">{formatGrams(s.totalGramsPurchased)}</span></div>
                         <div className="flex justify-between text-sm"><span className="text-slate-500">Avg Rate</span><span className="font-mono font-bold text-blue-600">{formatCurrency(s.avgRate)}</span></div>
                         <div className="flex justify-between text-sm"><span className="text-slate-500">Volatility</span><span className="font-mono font-bold text-amber-600">± {formatCurrency(s.volatility)}</span></div>
                     </div>
                </div>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <Card title="Volume Dependency (Grams)" delay={300} className="min-h-[350px]">
                <ResponsiveContainer width="100%" height={300}>
                     <PieChart>
                         <Pie data={volumeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                             {volumeData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                         </Pie>
                         <Tooltip formatter={(val:number) => formatGrams(val)} contentStyle={{borderRadius: '8px'}} />
                         <Legend verticalAlign="bottom" height={36}/>
                     </PieChart>
                 </ResponsiveContainer>
             </Card>
             <Card title="Capital Allocation (Cost)" delay={400} className="min-h-[350px]">
                <ResponsiveContainer width="100%" height={300}>
                     <PieChart>
                         <Pie data={valueData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                             {valueData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                         </Pie>
                         <Tooltip formatter={(val:number) => formatCurrency(val)} contentStyle={{borderRadius: '8px'}} />
                         <Legend verticalAlign="bottom" height={36}/>
                     </PieChart>
                 </ResponsiveContainer>
             </Card>
        </div>

        <Card title="Procurement History">
            {/* Reusing the table from Price Analysis mostly, but focused on stats */}
             <table className="w-full text-sm text-left">
                <thead className="text-slate-500 bg-slate-50/50">
                    <tr>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3 text-center">Tx Count</th>
                        <th className="px-4 py-3 text-right">Volume (g)</th>
                        <th className="px-4 py-3 text-right">Avg Rate</th>
                        <th className="px-4 py-3 text-right">Min Rate</th>
                        <th className="px-4 py-3 text-right">Max Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {supplierData.map((s, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-800">{s.name}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{s.txCount}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatGrams(s.totalGramsPurchased)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(s.avgRate)}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">{formatCurrency(s.minRate)}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">{formatCurrency(s.maxRate)}</td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </Card>
      </div>
    );
  };

  const BusinessLedgerView = () => {
      // Calculate monthly ledger
      const { monthlyData, totals } = useMemo(() => {
          const stats: Record<string, { turnover: number, profit: number, tax: number, qty: number }> = {};
          let totalTurnover = 0;
          let totalProfit = 0;
          let totalQty = 0;

          invoices.filter(i => i.type === 'SALE').forEach(inv => {
              const d = new Date(inv.date);
              const key = `${d.getFullYear()}-${d.getMonth()}`; // YYYY-M
              if (!stats[key]) stats[key] = { turnover: 0, profit: 0, tax: 0, qty: 0 };
              
              stats[key].turnover += inv.taxableAmount; // Changed to Taxable Amount (Ex-GST)
              stats[key].profit += (inv.profit || 0);
              stats[key].tax += inv.gstAmount;
              stats[key].qty += inv.quantityGrams;

              totalTurnover += inv.taxableAmount; // Changed to Taxable Amount (Ex-GST)
              totalProfit += (inv.profit || 0);
              totalQty += inv.quantityGrams;
          });

          const monthly = Object.entries(stats).map(([key, val]) => {
              const [y, m] = key.split('-');
              return {
                  date: new Date(parseInt(y), parseInt(m), 1),
                  ...val
              };
          }).sort((a,b) => b.date.getTime() - a.date.getTime());

          return { 
              monthlyData: monthly, 
              totals: { turnover: totalTurnover, profit: totalProfit, qty: totalQty, margin: totalTurnover > 0 ? (totalProfit/totalTurnover)*100 : 0 }
          };
      }, [invoices]);

      return (
          <div className="space-y-6 animate-enter">
              <SectionHeader 
                   title="Business Ledger" 
                   subtitle="Monthly financial breakdown and performance." 
                   action={<ExportMenu onExport={(t) => handleLedgerExport(t, monthlyData, totals)} />}
              />

              <div className="bg-slate-900 rounded-2xl p-8 text-white flex flex-col md:flex-row justify-between items-center shadow-2xl shadow-slate-900/20 mb-6">
                  <div className="text-center md:text-left mb-6 md:mb-0">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Lifetime Turnover (Ex GST)</p>
                      <h2 className="text-4xl md:text-5xl font-mono font-bold text-white mb-1">{formatCurrency(totals.turnover)}</h2>
                      <p className="text-gold-400 font-medium">Net Profit: {formatCurrency(totals.profit)} ({totals.margin.toFixed(2)}%)</p>
                  </div>
                  <div className="flex gap-8 border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8">
                       <div>
                           <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total Gold Sold</p>
                           <p className="text-2xl font-mono font-bold">{formatGrams(totals.qty)}</p>
                       </div>
                       <div>
                           <p className="text-slate-500 text-xs font-bold uppercase mb-1">Active Batches</p>
                           <p className="text-2xl font-mono font-bold">{inventory.filter(b => b.remainingQuantity > 0).length}</p>
                       </div>
                  </div>
              </div>

              <Card title="Monthly Breakdown">
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="text-slate-500 bg-slate-50/50">
                              <tr>
                                  <th className="px-4 py-3">Month</th>
                                  <th className="px-4 py-3 text-right">Turnover (Ex GST)</th>
                                  <th className="px-4 py-3 text-right">GST Collected</th>
                                  <th className="px-4 py-3 text-right">Net Profit</th>
                                  <th className="px-4 py-3 text-right">Margin %</th>
                                  <th className="px-4 py-3 text-right">Qty Sold</th>
                              </tr>
                          </thead>
                          <tbody>
                              {monthlyData.map((m, i) => (
                                  <tr key={i} className="hover:bg-slate-50 border-b border-slate-50">
                                      <td className="px-4 py-3 font-bold text-slate-800">{m.date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td>
                                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurrency(m.turnover)}</td>
                                      <td className="px-4 py-3 text-right font-mono text-slate-500">{formatCurrency(m.tax)}</td>
                                      <td className="px-4 py-3 text-right font-mono text-green-600 font-bold">{formatCurrency(m.profit)}</td>
                                      <td className="px-4 py-3 text-right font-mono">
                                          <span className={`px-2 py-1 rounded text-xs font-bold ${m.turnover > 0 && (m.profit/m.turnover) > 0.01 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                              {(m.turnover > 0 ? (m.profit/m.turnover)*100 : 0).toFixed(2)}%
                                          </span>
                                      </td>
                                      <td className="px-4 py-3 text-right font-mono text-slate-600">{formatGrams(m.qty)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </Card>
          </div>
      );
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} searchQuery={searchQuery} onSearch={setSearchQuery}>
        <Toast toasts={toasts} removeToast={removeToast} />
        
        {/* Delete Modal */}
        {showDeleteModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 animate-slide-up">
                    <div className="flex flex-col items-center text-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                            <Lock className="w-6 h-6"/>
                        </div>
                        <div>
                             <h3 className="text-lg font-bold text-slate-900">Secure Deletion</h3>
                             <p className="text-xs text-slate-500 mt-1">Enter admin password to permanently delete this record.</p>
                        </div>
                    </div>
                    <input 
                        type="password" 
                        placeholder="Admin Password" 
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center mb-4 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                    />
                    <div className="flex gap-3">
                        <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors text-sm">Cancel</button>
                        <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 text-sm">Delete Record</button>
                    </div>
                </div>
            </div>
        )}

        <div className="min-h-full pb-10">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'invoices' && <InvoicesView />}
            {activeTab === 'inventory' && (
                <div className="animate-slide-up">
                    <SectionHeader 
                        title="Inventory Management" 
                        action={
                            <div className="flex gap-2 items-center">
                                <ExportMenu onExport={handleInventoryExport} />
                                {renderDateFilter()}
                            </div>
                        }
                    />
                    <InventoryTable batches={filteredInventory}/>
                </div>
            )}
            {activeTab === 'analytics' && <AnalyticsView />}
            {activeTab === 'price-analysis' && <PriceAnalysisView />}
            {activeTab === 'customer-insights' && <CustomerInsightsView />}
            {activeTab === 'supplier-insights' && <SupplierInsightsView />}
            {activeTab === 'business-ledger' && <BusinessLedgerView />}
        </div>
    </Layout>
  );
}

export default App;
