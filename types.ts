
export type TransactionType = 'PURCHASE' | 'SALE';

export interface Invoice {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  type: TransactionType;
  partyName: string; // Supplier or Customer
  quantityGrams: number;
  ratePerGram: number;
  gstRate: number; // Percentage (e.g., 3)
  gstAmount: number;
  taxableAmount: number; // Qty * Rate
  totalAmount: number; // Taxable + GST
  
  // Specific to Sales (Calculated via FIFO)
  cogs?: number; // Cost of Goods Sold
  profit?: number; // Total Amount (Excl GST) - COGS
}

export interface InventoryBatch {
  id: string; // Usually links to the Purchase Invoice ID
  date: string; // Purchase Date
  originalQuantity: number;
  remainingQuantity: number;
  costPerGram: number;
  closedDate?: string; // Date when remainingQuantity hit 0
  totalRevenue?: number; // Total revenue generated from this batch
}

export interface DailyStockSnapshot {
  date: string;
  quantity: number;
  value: number;
}

export interface CustomerStat {
  name: string;
  totalGrams: number;
  totalSpend: number;
  profitContribution: number;
  txCount: number; // Total transactions (buy + sell)
  avgProfitPerGram?: number;
  margin?: number;
}

export interface AgingStats {
  buckets: Record<string, number>;
  weightedAvgDays: number;
}

export interface SupplierStat {
  name: string;
  totalGramsPurchased: number;
  avgRate: number;
  minRate: number;
  maxRate: number;
  volatility: number; // Standard deviation or spread
  txCount: number;
}

export interface RiskAlert {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  context: string;
  message: string;
}

export interface TurnoverStats {
  turnoverRatio: number;
  avgDaysToSell: number;
  avgInventoryValue: number;
  totalCOGS: number;
}
