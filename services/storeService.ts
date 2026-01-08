import { Invoice, InventoryBatch } from '../types';

const STORAGE_KEYS = {
  INVOICES: 'bullion_invoices',
  INVENTORY: 'bullion_inventory',
};

export const loadInvoices = (): Invoice[] => {
  const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
  return data ? JSON.parse(data) : [];
};

export const loadInventory = (): InventoryBatch[] => {
  const data = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  return data ? JSON.parse(data) : [];
};

export const saveInvoices = (invoices: Invoice[]) => {
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
};

export const saveInventory = (inventory: InventoryBatch[]) => {
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
};

export const resetData = () => {
    localStorage.removeItem(STORAGE_KEYS.INVOICES);
    localStorage.removeItem(STORAGE_KEYS.INVENTORY);
}