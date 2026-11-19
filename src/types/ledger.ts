export interface ExpenseColumn {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface CountryCurrency {
  id: string;
  name: string;
  code: string;
  rate: number;
  isBase?: boolean;
}

export interface TradeItem {
  id: string;
  originCountry: string;
  productName: string;
  lotRef?: string;
  shipmentDate?: string;
  purchaseAmountPkr: number;
  quantityKg: number;
  expenses: Record<string, number>;
}

export interface CalculatedItemMetrics {
  tons: number;
  baseRatePerKg: number;
  totalExpensePerKg: number;
  landedRatePerKg: number;
  landedRatePerTon: number;
  finalTotalAmountPkr: number;
}

export interface CountryConversionMetrics {
  ratePerKg: number;
  ratePerTon: number;
  finalTotal: number;
}

export interface LedgerState {
  items: TradeItem[];
  expenseColumns: ExpenseColumn[];
  countries: CountryCurrency[];
}

export type SortField = 'default' | 'product' | 'quantity' | 'landedRate' | 'finalTotal';
export type SortDirection = 'asc' | 'desc';

export type UndoSnapshot =
  | {
      type: 'item';
      label: string;
      item: TradeItem;
      index: number;
    }
  | {
      type: 'expense';
      label: string;
      column: ExpenseColumn;
      index: number;
      valuesByItemId: Record<string, number>;
    }
  | {
      type: 'country';
      label: string;
      country: CountryCurrency;
      index: number;
    }
  | {
      type: 'reset';
      label: string;
      previousState: LedgerState;
    };
