import {
  CalculatedItemMetrics,
  CountryConversionMetrics,
  CountryCurrency,
  ExpenseColumn,
  LedgerState,
  TradeItem,
} from '../types/ledger';

export const STORAGE_KEY = 'commodity_costing_ledger_v2';

export const DEFAULT_EXPENSE_COLUMNS: ExpenseColumn[] = [
  { id: 'labour', name: 'Labour', isDefault: true },
  { id: 'transport', name: 'Transport', isDefault: true },
  { id: 'port', name: 'Port', isDefault: true },
];

export const DEFAULT_COUNTRIES: CountryCurrency[] = [
  { id: 'pakistan', name: 'Pakistan', code: 'PKR', rate: 1, isBase: true },
  { id: 'india', name: 'India', code: 'INR', rate: 2.954, isBase: false },
  { id: 'oman', name: 'Oman', code: 'OMR', rate: 0.00138, isBase: false },
  { id: 'iran', name: 'Iran', code: 'IRR', rate: 970, isBase: false },
  { id: 'afghanistan', name: 'Afghanistan', code: 'AFN', rate: 0.25, isBase: false },
];

export function getInitialLedgerState(): LedgerState {
  return {
    items: [],
    expenseColumns: DEFAULT_EXPENSE_COLUMNS.map((col) => ({ ...col })),
    countries: DEFAULT_COUNTRIES.map((country) => ({ ...country })),
  };
}

export function loadLedgerState(): LedgerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getInitialLedgerState();
    }
    const parsed = JSON.parse(raw) as Partial<LedgerState>;
    if (
      !parsed ||
      !Array.isArray(parsed.items) ||
      !Array.isArray(parsed.expenseColumns) ||
      !Array.isArray(parsed.countries) ||
      parsed.countries.length === 0
    ) {
      return getInitialLedgerState();
    }

    return {
      items: parsed.items,
      expenseColumns:
        parsed.expenseColumns.length > 0
          ? parsed.expenseColumns
          : DEFAULT_EXPENSE_COLUMNS.map((c) => ({ ...c })),
      countries: parsed.countries,
    };
  } catch {
    return getInitialLedgerState();
  }
}

export function saveLedgerState(state: LedgerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function calculateItemMetrics(
  item: TradeItem,
  expenseColumns: ExpenseColumn[]
): CalculatedItemMetrics {
  const safeQty = item.quantityKg > 0 && Number.isFinite(item.quantityKg) ? item.quantityKg : 0;
  const safePurchase =
    item.purchaseAmountPkr >= 0 && Number.isFinite(item.purchaseAmountPkr)
      ? item.purchaseAmountPkr
      : 0;

  const tons = safeQty / 1000;
  const baseRatePerKg = safeQty > 0 ? safePurchase / safeQty : 0;

  const totalExpensePerKg = expenseColumns.reduce((sum, col) => {
    const val = item.expenses[col.id];
    return sum + (typeof val === 'number' && Number.isFinite(val) ? val : 0);
  }, 0);

  const landedRatePerKg = safeQty > 0 ? baseRatePerKg + totalExpensePerKg : 0;
  const landedRatePerTon = landedRatePerKg * 1000;
  const finalTotalAmountPkr = landedRatePerKg * safeQty;

  return {
    tons,
    baseRatePerKg,
    totalExpensePerKg,
    landedRatePerKg,
    landedRatePerTon,
    finalTotalAmountPkr,
  };
}

export function calculateCountryConversion(
  metrics: CalculatedItemMetrics,
  rate: number
): CountryConversionMetrics {
  const safeRate = rate >= 0 && Number.isFinite(rate) ? rate : 0;
  return {
    ratePerKg: metrics.landedRatePerKg * safeRate,
    ratePerTon: metrics.landedRatePerTon * safeRate,
    finalTotal: metrics.finalTotalAmountPkr * safeRate,
  };
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactTotal(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 1e-6;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatRatePerKg(value: number, currencyRate: number): string {
  if (!Number.isFinite(value)) return '0.00';
  const decimals = currencyRate > 0 && currencyRate < 0.05 ? 4 : 2;
  return formatNumber(value, decimals);
}

export function formatRatePerTon(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  const rounded = Math.round(value * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 1e-6;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatTons(tons: number): string {
  if (!Number.isFinite(tons)) return '0 Tons';
  const rounded = Math.round(tons * 1000) / 1000;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(rounded);
  return `${formatted} ${rounded === 1 ? 'Ton' : 'Tons'}`;
}

export function formatCountryQuote(
  item: TradeItem,
  metrics: CalculatedItemMetrics,
  country: CountryCurrency
): string {
  const converted = calculateCountryConversion(metrics, country.rate);
  const metaParts: string[] = [];
  if (item.lotRef?.trim()) metaParts.push(`Ref: ${item.lotRef.trim()}`);
  if (item.shipmentDate?.trim()) metaParts.push(item.shipmentDate.trim());

  const headerLine = `${item.productName || 'Commodity'} (${item.originCountry || 'Origin'}) · ${formatTons(metrics.tons)} (${formatCompactTotal(item.quantityKg)} kg)`;
  const metaLine = metaParts.length > 0 ? `\n${metaParts.join(' · ')}` : '';
  const rateLine = `\n${country.name} (${country.code}): ${formatRatePerKg(converted.ratePerKg, country.rate)} ${country.code}/kg · ${formatRatePerTon(converted.ratePerTon)} ${country.code}/Ton · Total ${formatCompactTotal(converted.finalTotal)} ${country.code}`;

  return `${headerLine}${metaLine}${rateLine}`;
}

export function formatMultiCountryQuote(
  item: TradeItem,
  metrics: CalculatedItemMetrics,
  countries: CountryCurrency[]
): string {
  const metaParts: string[] = [];
  if (item.lotRef?.trim()) metaParts.push(`Ref: ${item.lotRef.trim()}`);
  if (item.shipmentDate?.trim()) metaParts.push(item.shipmentDate.trim());

  const headerLine = `${item.productName || 'Commodity'} (${item.originCountry || 'Origin'}) · ${formatTons(metrics.tons)} (${formatCompactTotal(item.quantityKg)} kg)`;
  const metaLine = metaParts.length > 0 ? `\n${metaParts.join(' · ')}` : '';
  const lines = countries.map((country) => {
    const converted = calculateCountryConversion(metrics, country.rate);
    return `${country.name} (${country.code}): ${formatRatePerKg(converted.ratePerKg, country.rate)}/kg · ${formatRatePerTon(converted.ratePerTon)}/Ton · Total ${formatCompactTotal(converted.finalTotal)} ${country.code}`;
  });

  return `${headerLine}${metaLine}\n${lines.join('\n')}`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportLedgerToCsv(
  items: TradeItem[],
  expenseColumns: ExpenseColumn[],
  countries: CountryCurrency[]
): void {
  const headers: string[] = [
    'Product Name',
    'Origin Country',
    'Lot / Ref',
    'Shipment Date',
    'Purchase Amount (PKR)',
    'Quantity (Kg)',
    'Quantity (Tons)',
    ...expenseColumns.map((c) => `${c.name} (PKR/kg)`),
    'Base Rate / Kg (PKR)',
    ...countries.flatMap((c) => [
      `${c.name} Rate (per 1 PKR)`,
      `${c.name} (${c.code}) Rate / Kg`,
      `${c.name} (${c.code}) Rate / Ton`,
      `${c.name} (${c.code}) Final Total`,
    ]),
  ];

  let totalPurchase = 0;
  let totalKg = 0;
  let totalFinalPkr = 0;

  const rows = items.map((item) => {
    const metrics = calculateItemMetrics(item, expenseColumns);
    totalPurchase += item.purchaseAmountPkr || 0;
    totalKg += item.quantityKg || 0;
    totalFinalPkr += metrics.finalTotalAmountPkr;

    const rowCells: Array<string | number> = [
      item.productName,
      item.originCountry,
      item.lotRef ?? '',
      item.shipmentDate ?? '',
      item.purchaseAmountPkr,
      item.quantityKg,
      Math.round(metrics.tons * 1000) / 1000,
      ...expenseColumns.map((col) => item.expenses[col.id] ?? 0),
      Number(metrics.baseRatePerKg.toFixed(4)),
      ...countries.flatMap((c) => {
        const conv = calculateCountryConversion(metrics, c.rate);
        return [
          c.rate,
          Number(conv.ratePerKg.toFixed(c.rate < 0.05 ? 4 : 2)),
          Number(conv.ratePerTon.toFixed(2)),
          Number(conv.finalTotal.toFixed(2)),
        ];
      }),
    ];

    return rowCells.map(escapeCsvCell).join(',');
  });

  const summaryCells: Array<string | number> = [
    'TOTAL',
    `${items.length} ${items.length === 1 ? 'Item' : 'Items'}`,
    '',
    '',
    totalPurchase,
    totalKg,
    Math.round((totalKg / 1000) * 1000) / 1000,
    ...expenseColumns.map(() => ''),
    '',
    ...countries.flatMap((c) => [
      c.rate,
      '',
      '',
      Number((totalFinalPkr * (c.rate >= 0 ? c.rate : 0)).toFixed(2)),
    ]),
  ];

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows,
    summaryCells.map(escapeCsvCell).join(','),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `commodity-costing-ledger-${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
