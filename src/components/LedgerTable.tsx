import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  Copy,
  CopyPlus,
  Download,
  LayoutGrid,
  Pencil,
  Plus,
  Printer,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import {
  CountryCurrency,
  ExpenseColumn,
  SortDirection,
  SortField,
  TradeItem,
} from '../types/ledger';
import {
  calculateCountryConversion,
  calculateItemMetrics,
  exportLedgerToCsv,
  formatCompactTotal,
  formatCountryQuote,
  formatMultiCountryQuote,
  formatNumber,
  formatRatePerKg,
  formatRatePerTon,
  formatTons,
} from '../utils/calculations';

interface LedgerTableProps {
  items: TradeItem[];
  expenseColumns: ExpenseColumn[];
  countries: CountryCurrency[];
  onUpdateItem: (item: TradeItem) => void;
  onDuplicateItem: (item: TradeItem) => void;
  onEditItemModal: (item: TradeItem) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenAddModal: () => void;
  onAddExpenseColumn: (name: string) => void;
  onRenameExpenseColumn: (id: string, name: string) => void;
  onRemoveExpenseColumn: (id: string) => void;
  onUpdateCountryRate: (countryId: string, rate: number) => void;
  onAddCountry: (name: string, code: string, rate: number) => void;
  onRemoveCountry: (countryId: string) => void;
}

interface InlineDecimalInputProps {
  value: number;
  ariaLabel: string;
  onCommit: (next: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

function InlineDecimalInput({
  value,
  ariaLabel,
  onCommit,
  className = '',
  disabled = false,
  placeholder = '0',
}: InlineDecimalInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setDraft(raw);
      if (raw !== '' && raw !== '.') {
        const parsed = parseFloat(raw);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          onCommit(parsed);
        }
      } else if (raw === '') {
        onCommit(0);
      }
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || parsed < 0) {
      setDraft('0');
      onCommit(0);
    } else {
      setDraft(String(parsed));
      onCommit(parsed);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
}

export function LedgerTable({
  items,
  expenseColumns,
  countries,
  onUpdateItem,
  onDuplicateItem,
  onEditItemModal,
  onDeleteItem,
  onOpenAddModal,
  onAddExpenseColumn,
  onRenameExpenseColumn,
  onRemoveExpenseColumn,
  onUpdateCountryRate,
  onAddCountry,
  onRemoveCountry,
}: LedgerTableProps) {
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');

  // Search, Origin Filter & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Copy feedback key (either item.id or `${item.id}:${country.id}`)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add Expense inline header state
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [newExpenseName, setNewExpenseName] = useState('');

  // Rename Expense inline header state
  const [renamingExpenseId, setRenamingExpenseId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Add Country inline header state
  const [isAddingCountry, setIsAddingCountry] = useState(false);
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [newCountryRate, setNewCountryRate] = useState('');

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1800);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1800);
    }
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newExpenseName.trim();
    if (!trimmed) return;
    onAddExpenseColumn(trimmed);
    setNewExpenseName('');
    setIsAddingExpense(false);
  };

  const handleCommitRenameExpense = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      onRenameExpenseColumn(id, trimmed);
    }
    setRenamingExpenseId(null);
    setRenameDraft('');
  };

  const handleCreateCountry = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCountryName.trim();
    const trimmedCode = newCountryCode.trim().toUpperCase();
    const parsedRate = parseFloat(newCountryRate);
    if (!trimmedName || !trimmedCode || Number.isNaN(parsedRate) || parsedRate <= 0) {
      return;
    }
    onAddCountry(trimmedName, trimmedCode, parsedRate);
    setNewCountryName('');
    setNewCountryCode('');
    setNewCountryRate('');
    setIsAddingCountry(false);
  };

  const uniqueOrigins = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const origin = item.originCountry.trim();
      if (origin) set.add(origin);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const rowComputations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = items
      .filter((item) => {
        if (originFilter !== 'all' && item.originCountry.trim() !== originFilter) {
          return false;
        }
        if (!query) return true;
        return (
          item.productName.toLowerCase().includes(query) ||
          item.originCountry.toLowerCase().includes(query) ||
          (item.lotRef ?? '').toLowerCase().includes(query) ||
          (item.shipmentDate ?? '').toLowerCase().includes(query)
        );
      })
      .map((item) => ({
        item,
        metrics: calculateItemMetrics(item, expenseColumns),
      }));

    if (sortField === 'default') {
      return filtered;
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'product':
          cmp = a.item.productName.localeCompare(b.item.productName);
          break;
        case 'quantity':
          cmp = a.item.quantityKg - b.item.quantityKg;
          break;
        case 'landedRate':
          cmp = a.metrics.landedRatePerKg - b.metrics.landedRatePerKg;
          break;
        case 'finalTotal':
          cmp = a.metrics.finalTotalAmountPkr - b.metrics.finalTotalAmountPkr;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [items, expenseColumns, searchQuery, originFilter, sortField, sortDirection]);

  const hasActiveFilters = searchQuery.trim() !== '' || originFilter !== 'all';

  // Compute summary footer totals across visible rows
  const totalQuantityKg = rowComputations.reduce((sum, r) => sum + (r.item.quantityKg || 0), 0);
  const totalTons = totalQuantityKg / 1000;
  const totalPurchasePkr = rowComputations.reduce(
    (sum, r) => sum + (r.item.purchaseAmountPkr || 0),
    0
  );
  const totalFinalPkr = rowComputations.reduce(
    (sum, r) => sum + r.metrics.finalTotalAmountPkr,
    0
  );

  const totalColumnCount = 4 + expenseColumns.length + countries.length + 1;

  return (
    <div className="space-y-3">
      {/* Print-Only Header */}
      <div className="hidden print:block pb-3 mb-2 border-b border-[#E5E2DC]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[#18181B]">
            Commodity Costing Ledger
          </h2>
          <span className="text-xs font-mono text-[#64748B]">
            Printed {new Date().toISOString().slice(0, 10)} · {rowComputations.length}{' '}
            {rowComputations.length === 1 ? 'Commodity' : 'Commodities'}
          </span>
        </div>
      </div>

      {/* Operational Toolbar: Search, Filter, Sort, Export CSV, Print / PDF */}
      <div className="no-print bg-white border border-[#E5E2DC] rounded-md px-3.5 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 sm:max-w-xs min-w-0">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, origin, lot ref..."
              aria-label="Search ledger entries"
              className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-sm sm:text-xs bg-[#FAF9F6] border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#18181B] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <select
              aria-label="Filter by origin country"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="px-2.5 py-2 sm:py-1.5 text-xs bg-[#FAF9F6] border border-[#E5E2DC] rounded text-[#18181B] focus:outline-none focus:border-[#0F5132]"
            >
              <option value="all">All Origins</option>
              {uniqueOrigins.map((origin) => (
                <option key={origin} value={origin}>
                  {origin}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <select
                aria-label="Sort commodities"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="flex-1 sm:flex-none px-2.5 py-2 sm:py-1.5 text-xs bg-[#FAF9F6] border border-[#E5E2DC] rounded text-[#18181B] focus:outline-none focus:border-[#0F5132]"
              >
                <option value="default">Sort: Default</option>
                <option value="product">Sort: Product</option>
                <option value="quantity">Sort: Quantity</option>
                <option value="landedRate">Sort: Landed / Kg</option>
                <option value="finalTotal">Sort: Final Total</option>
              </select>
              {sortField !== 'default' && (
                <button
                  type="button"
                  onClick={() =>
                    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                  }
                  aria-label={`Toggle sort direction (${sortDirection})`}
                  title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                  className="px-2 py-2 sm:py-1.5 text-xs bg-[#FAF9F6] border border-[#E5E2DC] rounded text-[#18181B] hover:border-[#0F5132] transition-colors cursor-pointer"
                >
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 lg:pt-0 border-t lg:border-t-0 border-[#E5E2DC]/70">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setOriginFilter('all');
              }}
              className="text-xs font-medium text-[#0F5132] hover:underline mr-auto lg:mr-2 whitespace-nowrap cursor-pointer"
            >
              Clear filters
            </button>
          )}

          <button
            type="button"
            disabled={rowComputations.length === 0}
            onClick={() =>
              exportLedgerToCsv(
                rowComputations.map((r) => r.item),
                expenseColumns,
                countries
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 text-xs font-medium text-[#18181B] bg-white border border-[#E5E2DC] hover:border-[#0F5132] hover:text-[#0F5132] disabled:opacity-45 disabled:pointer-events-none rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            disabled={rowComputations.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 text-xs font-medium text-[#18181B] bg-white border border-[#E5E2DC] hover:border-[#0F5132] hover:text-[#0F5132] disabled:opacity-45 disabled:pointer-events-none rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Mobile View Switcher & Quick Expense Column Control (< md) */}
      <div className="no-print flex md:hidden items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Ledger layout view"
          className="inline-flex items-center p-1 bg-white border border-[#E5E2DC] rounded-md"
        >
          <button
            type="button"
            onClick={() => setMobileView('cards')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded transition-colors cursor-pointer ${
              mobileView === 'cards'
                ? 'bg-[#0F5132] text-white'
                : 'text-[#64748B] hover:text-[#18181B]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setMobileView('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded transition-colors cursor-pointer ${
              mobileView === 'table'
                ? 'bg-[#0F5132] text-white'
                : 'text-[#64748B] hover:text-[#18181B]'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Table
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingExpense((prev) => !prev)}
          className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[40px] text-xs font-medium text-[#0F5132] bg-white border border-[#0F5132]/30 hover:border-[#0F5132] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Expense
        </button>
      </div>

      {/* Mobile Add Expense Inline Bar */}
      {isAddingExpense && (
        <form
          onSubmit={handleCreateExpense}
          className="no-print md:hidden bg-white border border-[#E5E2DC] rounded-md p-3 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="New expense column (e.g. Customs)"
            value={newExpenseName}
            onChange={(e) => setNewExpenseName(e.target.value)}
            autoFocus
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-[#FAF9F6] border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
          />
          <button
            type="submit"
            className="px-3.5 py-2 min-h-[40px] text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded whitespace-nowrap cursor-pointer"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingExpense(false);
              setNewExpenseName('');
            }}
            aria-label="Cancel add expense"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#64748B] hover:text-[#18181B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* MOBILE CARD LEDGER VIEW (< md when mobileView === 'cards') */}
      {mobileView === 'cards' && (
        <div className="no-print md:hidden space-y-3">
          {rowComputations.length === 0 ? (
            <div className="bg-white border border-[#E5E2DC] rounded-md px-5 py-10 text-center">
              {items.length === 0 ? (
                <>
                  <p className="text-sm font-semibold text-[#18181B]">
                    Your costing ledger is empty
                  </p>
                  <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                    Add your first commodity shipment to calculate landed rates per kg/ton and multi-country currency conversions.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenAddModal}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Commodity
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#18181B]">
                    No matching commodities found
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Try adjusting your search or origin filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setOriginFilter('all');
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-medium text-[#0F5132] border border-[#0F5132]/30 rounded cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {rowComputations.map(({ item, metrics }) => (
                <article
                  key={item.id}
                  className="bg-white border border-[#E5E2DC] rounded-md overflow-hidden"
                >
                  {/* Card Header: Product, Origin, Lot/Date, Actions */}
                  <div className="px-3.5 py-3 border-b border-[#E5E2DC] bg-[#FAF9F6] flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="text"
                        aria-label="Product name"
                        value={item.productName}
                        placeholder="Product"
                        onChange={(e) =>
                          onUpdateItem({ ...item, productName: e.target.value })
                        }
                        className="w-full text-base font-semibold text-[#18181B] bg-transparent border-b border-transparent focus:border-[#0F5132] focus:outline-none py-0.5"
                      />
                      <input
                        type="text"
                        aria-label="Origin country"
                        value={item.originCountry}
                        placeholder="Origin"
                        onChange={(e) =>
                          onUpdateItem({ ...item, originCountry: e.target.value })
                        }
                        className="w-full text-xs text-[#64748B] bg-transparent border-b border-transparent focus:border-[#0F5132] focus:outline-none py-0.5"
                      />
                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="text"
                          aria-label="Lot or container reference"
                          value={item.lotRef ?? ''}
                          placeholder="Lot / Ref"
                          onChange={(e) =>
                            onUpdateItem({ ...item, lotRef: e.target.value })
                          }
                          className="w-28 text-[11px] font-mono text-[#64748B] bg-white/70 border border-[#E5E2DC] rounded px-1.5 py-0.5 focus:border-[#0F5132] focus:outline-none"
                        />
                        <input
                          type="date"
                          aria-label="Shipment date"
                          value={item.shipmentDate ?? ''}
                          onChange={(e) =>
                            onUpdateItem({ ...item, shipmentDate: e.target.value })
                          }
                          className="text-[11px] font-mono text-[#64748B] bg-white/70 border border-[#E5E2DC] rounded px-1.5 py-0.5 focus:border-[#0F5132] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            item.id,
                            formatMultiCountryQuote(item, metrics, countries)
                          )
                        }
                        aria-label={`Copy all quotes for ${item.productName}`}
                        title="Copy multi-country quote"
                        className="min-w-[36px] min-h-[40px] flex items-center justify-center text-[#64748B] hover:text-[#0F5132] rounded transition-colors cursor-pointer"
                      >
                        {copiedKey === item.id ? (
                          <Check className="w-4 h-4 text-[#0F5132]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateItem(item)}
                        aria-label={`Duplicate ${item.productName}`}
                        title="Duplicate row"
                        className="min-w-[36px] min-h-[40px] flex items-center justify-center text-[#64748B] hover:text-[#0F5132] rounded transition-colors cursor-pointer"
                      >
                        <CopyPlus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditItemModal(item)}
                        aria-label={`Edit ${item.productName}`}
                        title="Edit item"
                        className="min-w-[36px] min-h-[40px] flex items-center justify-center text-[#64748B] hover:text-[#0F5132] rounded transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        aria-label={`Delete ${item.productName}`}
                        title="Delete item"
                        className="min-w-[36px] min-h-[40px] flex items-center justify-center text-[#64748B] hover:text-red-700 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Purchase Amount, Quantity & Base Rate */}
                  <div className="grid grid-cols-2 divide-x divide-[#E5E2DC] border-b border-[#E5E2DC]">
                    <div className="p-3">
                      <div className="text-[11px] font-medium text-[#64748B]">
                        Purchase (PKR)
                      </div>
                      <InlineDecimalInput
                        value={item.purchaseAmountPkr}
                        ariaLabel={`${item.productName} purchase amount PKR`}
                        onCommit={(next) =>
                          onUpdateItem({ ...item, purchaseAmountPkr: next })
                        }
                        className="w-full mt-1 text-base font-mono tabular-nums font-medium text-[#18181B] bg-transparent border-b border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-1"
                      />
                      <div className="text-[11px] font-mono tabular-nums text-[#64748B] mt-1">
                        Base: {formatNumber(metrics.baseRatePerKg, 2)} / kg
                      </div>
                    </div>

                    <div className="p-3">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium text-[#64748B]">
                          Quantity (Kg)
                        </span>
                        <span className="text-[11px] font-mono tabular-nums font-medium text-[#0F5132]">
                          {formatTons(metrics.tons)}
                        </span>
                      </div>
                      <InlineDecimalInput
                        value={item.quantityKg}
                        ariaLabel={`${item.productName} quantity in kg`}
                        onCommit={(next) => onUpdateItem({ ...item, quantityKg: next })}
                        className="w-full mt-1 text-base font-mono tabular-nums font-medium text-[#18181B] bg-transparent border-b border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-1"
                      />
                      <div className="text-[11px] font-mono tabular-nums text-[#64748B] mt-1">
                        {formatCompactTotal(item.quantityKg)} kg
                      </div>
                    </div>
                  </div>

                  {/* Per-Kg Expenses */}
                  <div className="p-3 border-b border-[#E5E2DC]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-[#64748B]">
                        Per-Kg Expenses (PKR)
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#18181B] font-medium">
                        Sum: {formatNumber(metrics.totalExpensePerKg, 2)} / kg
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      {expenseColumns.map((col) => {
                        const isRenaming = renamingExpenseId === col.id;
                        return (
                          <div key={col.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-1">
                              {isRenaming ? (
                                <div className="flex items-center gap-1 w-full">
                                  <input
                                    type="text"
                                    value={renameDraft}
                                    onChange={(e) => setRenameDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCommitRenameExpense(col.id);
                                      if (e.key === 'Escape') setRenamingExpenseId(null);
                                    }}
                                    autoFocus
                                    className="w-full px-1.5 py-0.5 text-xs bg-white border border-[#0F5132] rounded focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCommitRenameExpense(col.id)}
                                    aria-label="Save expense name"
                                    className="p-1 text-[#0F5132] cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-[#64748B] truncate">
                                    {col.name}
                                  </span>
                                  {!col.isDefault && (
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRenamingExpenseId(col.id);
                                          setRenameDraft(col.name);
                                        }}
                                        aria-label={`Rename ${col.name}`}
                                        className="p-1 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onRemoveExpenseColumn(col.id)}
                                        aria-label={`Remove ${col.name}`}
                                        className="p-1 text-[#64748B] hover:text-red-700 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <InlineDecimalInput
                              value={item.expenses[col.id] ?? 0}
                              ariaLabel={`${item.productName} ${col.name} expense per kg`}
                              onCommit={(next) =>
                                onUpdateItem({
                                  ...item,
                                  expenses: {
                                    ...item.expenses,
                                    [col.id]: next,
                                  },
                                })
                              }
                              className="w-full text-sm font-mono tabular-nums text-[#18181B] bg-[#FAF9F6] border border-[#E5E2DC] rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0F5132]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-Country Landed Cost Matrix with Per-Country Quote Copy */}
                  <div className="divide-y divide-[#E5E2DC]">
                    {countries.map((country) => {
                      const converted = calculateCountryConversion(metrics, country.rate);
                      const cellCopyKey = `${item.id}:${country.id}`;
                      const isCopied = copiedKey === cellCopyKey;
                      return (
                        <div
                          key={country.id}
                          className={`px-3.5 py-2.5 ${
                            country.isBase ? 'bg-[#F4F8F6]/70' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-semibold text-[#18181B] truncate">
                                {country.name}
                              </span>
                              <span className="text-[11px] font-mono text-[#64748B]">
                                {country.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-[#64748B]">Rate</span>
                                {country.isBase ? (
                                  <span className="font-mono text-xs tabular-nums font-medium text-[#0F5132]">
                                    1 (Base)
                                  </span>
                                ) : (
                                  <InlineDecimalInput
                                    value={country.rate}
                                    ariaLabel={`${country.name} (${country.code}) rate`}
                                    onCommit={(next) => onUpdateCountryRate(country.id, next)}
                                    className="w-20 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                                  />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(
                                    cellCopyKey,
                                    formatCountryQuote(item, metrics, country)
                                  )
                                }
                                aria-label={`Copy ${country.name} quote`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#64748B] hover:text-[#0F5132] border border-[#E5E2DC] rounded bg-white cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#0F5132]" />
                                    <span className="text-[#0F5132]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Quote</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-[10px] text-[#64748B]">Rate / Kg</div>
                              <div
                                className={`font-mono tabular-nums font-semibold mt-0.5 ${
                                  country.isBase ? 'text-[#0F5132]' : 'text-[#18181B]'
                                }`}
                              >
                                {formatRatePerKg(converted.ratePerKg, country.rate)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-[#64748B]">Rate / Ton</div>
                              <div className="font-mono tabular-nums text-[#18181B] mt-0.5">
                                {formatRatePerTon(converted.ratePerTon)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-[#64748B]">Final Total</div>
                              <div
                                className={`font-mono tabular-nums font-semibold mt-0.5 ${
                                  country.isBase ? 'text-[#0F5132]' : 'text-[#18181B]'
                                }`}
                              >
                                {formatCompactTotal(converted.finalTotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}

              {/* Mobile Summary Footer Block */}
              <section
                aria-label="Ledger Summary"
                className="bg-[#F5F3EE] border border-[#E5E2DC] rounded-md overflow-hidden"
              >
                <div className="px-3.5 py-2.5 border-b border-[#E5E2DC] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#18181B]">
                    Ledger Summary
                  </span>
                  <span className="text-xs text-[#64748B]">
                    {rowComputations.length}{' '}
                    {rowComputations.length === 1 ? 'Commodity' : 'Commodities'}
                  </span>
                </div>

                <div className="grid grid-cols-2 divide-x divide-[#E5E2DC] border-b border-[#E5E2DC]">
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-[#64748B]">Total Purchase (PKR)</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#18181B] mt-0.5">
                      {formatCompactTotal(totalPurchasePkr)}
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-[#64748B]">Total Volume</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#18181B] mt-0.5">
                      {formatCompactTotal(totalQuantityKg)} kg
                    </div>
                    <div className="text-[11px] font-mono tabular-nums font-medium text-[#0F5132]">
                      {formatTons(totalTons)}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[#E5E2DC]">
                  {countries.map((country) => {
                    const countryGrandTotal =
                      totalFinalPkr * (country.rate >= 0 ? country.rate : 0);
                    return (
                      <div
                        key={country.id}
                        className={`px-3.5 py-2 flex items-center justify-between gap-3 ${
                          country.isBase ? 'bg-[#E9F1EC]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-medium text-[#18181B]">{country.name}</span>
                          <span className="font-mono text-[11px] text-[#64748B]">
                            ({country.code})
                          </span>
                        </div>
                        <span
                          className={`font-mono text-sm tabular-nums font-semibold ${
                            country.isBase ? 'text-[#0F5132]' : 'text-[#18181B]'
                          }`}
                        >
                          {formatCompactTotal(countryGrandTotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* FULL LEDGER TABLE (Always shown on md+, print, or on mobile when mobileView === 'table') */}
      <div
        className={`${
          mobileView === 'table' ? 'block' : 'hidden md:block print:block'
        } bg-white border border-[#E5E2DC] rounded-md overflow-hidden print-ledger-wrapper`}
      >
        <div className="overflow-auto ledger-scroll min-h-[260px] max-h-[calc(100vh-225px)] print-ledger-wrapper">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Tier 1: Group Headers */}
              <tr className="bg-[#FAF9F6] border-b border-[#E5E2DC] text-[11px] font-medium text-[#64748B] h-[38px]">
                <th
                  colSpan={3}
                  className="sticky top-0 lg:left-0 z-20 lg:z-30 bg-[#FAF9F6] px-3.5 xl:px-4 py-1.5 h-[38px] border-r border-[#E5E2DC] whitespace-nowrap"
                >
                  Commodity &amp; Volume
                </th>
                <th
                  colSpan={expenseColumns.length}
                  className="sticky top-0 z-20 bg-[#FAF9F6] px-3 py-1.5 h-[38px] border-r border-[#E5E2DC] whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>Per-Kg Expenses (PKR)</span>
                    {isAddingExpense ? (
                      <form onSubmit={handleCreateExpense} className="no-print flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Expense name"
                          value={newExpenseName}
                          onChange={(e) => setNewExpenseName(e.target.value)}
                          autoFocus
                          className="w-28 h-6 px-2 text-xs font-normal text-[#18181B] bg-white border border-[#0F5132] rounded focus:outline-none"
                        />
                        <button
                          type="submit"
                          aria-label="Confirm add expense"
                          className="p-1 text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel add expense"
                          onClick={() => {
                            setIsAddingExpense(false);
                            setNewExpenseName('');
                          }}
                          className="p-1 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingExpense(true)}
                        className="no-print inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[#0F5132] hover:bg-[#0F5132]/10 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add Expense
                      </button>
                    )}
                  </div>
                </th>
                <th
                  colSpan={1}
                  className="sticky top-0 z-20 bg-[#FAF9F6] px-3 py-1.5 h-[38px] border-r border-[#E5E2DC] whitespace-nowrap text-right"
                >
                  Base Cost
                </th>
                <th
                  colSpan={countries.length}
                  className="sticky top-0 z-20 bg-[#FAF9F6] px-3 py-1.5 h-[38px] border-r border-[#E5E2DC] whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span>Landed Cost &amp; Country Currency Conversions</span>
                    {isAddingCountry ? (
                      <form onSubmit={handleCreateCountry} className="no-print flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Country"
                          value={newCountryName}
                          onChange={(e) => setNewCountryName(e.target.value)}
                          autoFocus
                          className="w-24 h-6 px-2 text-xs font-normal text-[#18181B] bg-white border border-[#0F5132] rounded focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Code"
                          maxLength={6}
                          value={newCountryCode}
                          onChange={(e) => setNewCountryCode(e.target.value.toUpperCase())}
                          className="w-14 h-6 px-2 text-xs font-mono uppercase text-[#18181B] bg-white border border-[#0F5132] rounded focus:outline-none"
                        />
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Rate"
                          value={newCountryRate}
                          onChange={(e) => setNewCountryRate(e.target.value)}
                          className="w-20 h-6 px-2 text-xs font-mono tabular-nums text-[#18181B] bg-white border border-[#0F5132] rounded focus:outline-none"
                        />
                        <button
                          type="submit"
                          aria-label="Confirm add country"
                          className="p-1 text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel add country"
                          onClick={() => {
                            setIsAddingCountry(false);
                            setNewCountryName('');
                            setNewCountryCode('');
                            setNewCountryRate('');
                          }}
                          className="p-1 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingCountry(true)}
                        className="no-print inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[#0F5132] hover:bg-[#0F5132]/10 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add Country
                      </button>
                    )}
                  </div>
                </th>
                <th className="no-print sticky top-0 z-20 bg-[#FAF9F6] px-3 py-1.5 h-[38px] text-center whitespace-nowrap">
                  Actions
                </th>
              </tr>

              {/* Tier 2: Column Headers & Sticky Currency Rate Inputs */}
              <tr className="bg-[#FAF9F6] border-b border-[#E5E2DC] text-xs font-semibold text-[#18181B] align-top">
                <th className="sticky top-[38px] lg:left-0 z-20 lg:z-30 bg-[#FAF9F6] px-3.5 xl:px-4 py-2.5 min-w-[175px] xl:min-w-[190px] 2xl:min-w-[205px] border-r border-[#E5E2DC]">
                  <div>Origin &amp; Product</div>
                  <div className="text-[11px] font-normal text-[#64748B] mt-0.5">
                    Lot Ref · Shipment Date
                  </div>
                </th>

                <th className="sticky top-[38px] z-20 bg-[#FAF9F6] px-2.5 xl:px-3 py-2.5 min-w-[115px] xl:min-w-[125px] border-r border-[#E5E2DC] text-right">
                  <div>Purchase Amount</div>
                  <div className="text-[11px] font-normal text-[#64748B] mt-0.5">Total PKR</div>
                </th>

                <th className="sticky top-[38px] z-20 bg-[#FAF9F6] px-2.5 xl:px-3 py-2.5 min-w-[105px] xl:min-w-[115px] border-r border-[#E5E2DC] text-right">
                  <div>Quantity</div>
                  <div className="text-[11px] font-normal text-[#64748B] mt-0.5">Kg / Tons</div>
                </th>

                {expenseColumns.map((col) => {
                  const isRenaming = renamingExpenseId === col.id;
                  return (
                    <th
                      key={col.id}
                      className="sticky top-[38px] z-20 bg-[#FAF9F6] px-2.5 xl:px-3 py-2.5 min-w-[92px] xl:min-w-[100px] border-r border-[#E5E2DC] text-right"
                    >
                      {isRenaming ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitRenameExpense(col.id);
                              if (e.key === 'Escape') setRenamingExpenseId(null);
                            }}
                            autoFocus
                            className="w-20 px-1.5 py-0.5 text-xs font-normal bg-white border border-[#0F5132] rounded focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCommitRenameExpense(col.id)}
                            aria-label="Save expense name"
                            className="p-0.5 text-[#0F5132] cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="truncate">{col.name}</span>
                          {!col.isDefault && (
                            <span className="no-print inline-flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingExpenseId(col.id);
                                  setRenameDraft(col.name);
                                }}
                                title={`Rename ${col.name}`}
                                aria-label={`Rename ${col.name}`}
                                className="p-0.5 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveExpenseColumn(col.id)}
                                title={`Remove ${col.name}`}
                                aria-label={`Remove ${col.name}`}
                                className="p-0.5 text-[#64748B] hover:text-red-700 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-[11px] font-normal text-[#64748B] mt-0.5">PKR / kg</div>
                    </th>
                  );
                })}

                <th className="sticky top-[38px] z-20 bg-[#FAF9F6] px-2.5 xl:px-3 py-2.5 min-w-[96px] xl:min-w-[108px] border-r border-[#E5E2DC] text-right">
                  <div>Base Rate</div>
                  <div className="text-[11px] font-normal text-[#64748B] mt-0.5">PKR / kg</div>
                </th>

                {countries.map((country) => (
                  <th
                    key={country.id}
                    className={`sticky top-[38px] z-20 px-2.5 xl:px-3 py-2.5 min-w-[152px] xl:min-w-[164px] 2xl:min-w-[178px] border-r border-[#E5E2DC] text-right ${
                      country.isBase ? 'bg-[#F4F8F6]' : 'bg-[#FAF9F6]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-[#18181B]">{country.name}</span>
                        <span className="text-[11px] font-mono font-normal text-[#64748B]">
                          {country.code}
                        </span>
                      </div>
                      {!country.isBase && (
                        <button
                          type="button"
                          onClick={() => onRemoveCountry(country.id)}
                          title={`Remove ${country.name}`}
                          aria-label={`Remove ${country.name} column`}
                          className="no-print p-0.5 text-[#64748B] hover:text-red-700 transition-colors cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Sticky Currency Rate input box directly at the top of each country column */}
                    <div className="mt-1.5 flex items-center justify-between gap-2 pt-1.5 border-t border-[#E5E2DC]/80">
                      <span className="text-[11px] font-normal text-[#64748B] whitespace-nowrap">
                        Rate
                      </span>
                      {country.isBase ? (
                        <span className="font-mono text-xs tabular-nums font-medium text-[#0F5132]">
                          1 (Base)
                        </span>
                      ) : (
                        <InlineDecimalInput
                          value={country.rate}
                          ariaLabel={`${country.name} (${country.code}) rate`}
                          onCommit={(next) => onUpdateCountryRate(country.id, next)}
                          className="w-20 xl:w-24 px-1.5 py-0.5 text-xs font-mono tabular-nums font-medium text-right text-[#18181B] bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                        />
                      )}
                    </div>
                  </th>
                ))}

                <th className="no-print sticky top-[38px] z-20 bg-[#FAF9F6] px-2.5 py-2.5 min-w-[112px] text-center">
                  <span className="sr-only">Row Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E5E2DC]">
              {rowComputations.length === 0 ? (
                <tr>
                  <td colSpan={totalColumnCount} className="px-6 py-14 text-center">
                    {items.length === 0 ? (
                      <>
                        <p className="text-sm font-semibold text-[#18181B]">
                          Your costing ledger is empty
                        </p>
                        <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
                          Add your first commodity shipment to calculate landed rates per kg/ton and multi-country currency conversions.
                        </p>
                        <button
                          type="button"
                          onClick={onOpenAddModal}
                          className="no-print mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add First Commodity
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-[#18181B]">
                          No matching commodities found
                        </p>
                        <p className="text-xs text-[#64748B] mt-1">
                          Try clearing or adjusting your search and origin filter.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setOriginFilter('all');
                          }}
                          className="no-print mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#0F5132] border border-[#0F5132]/30 hover:border-[#0F5132] rounded transition-colors cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                rowComputations.map(({ item, metrics }) => (
                  <tr
                    key={item.id}
                    className="group bg-white hover:bg-[#FAF9F6]/70 transition-colors align-top"
                  >
                    {/* Origin & Product + Lot Ref & Date (sticky left on lg+) */}
                    <td className="lg:sticky lg:left-0 lg:z-10 bg-white group-hover:bg-[#FAF9F6] px-3.5 xl:px-4 py-3 border-r border-[#E5E2DC]">
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="text"
                          aria-label="Product name"
                          value={item.productName}
                          placeholder="Product"
                          onChange={(e) =>
                            onUpdateItem({ ...item, productName: e.target.value })
                          }
                          className="w-full text-sm font-semibold text-[#18181B] bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-0.5"
                        />
                        <input
                          type="text"
                          aria-label="Origin country"
                          value={item.originCountry}
                          placeholder="Origin"
                          onChange={(e) =>
                            onUpdateItem({ ...item, originCountry: e.target.value })
                          }
                          className="w-full text-xs text-[#64748B] bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-0.5"
                        />
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            aria-label="Lot or container reference"
                            value={item.lotRef ?? ''}
                            placeholder="Lot / Ref"
                            onChange={(e) =>
                              onUpdateItem({ ...item, lotRef: e.target.value })
                            }
                            className="w-20 text-[11px] font-mono text-[#64748B] bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-0.5"
                          />
                          <span className="text-[#E5E2DC] text-[10px]" aria-hidden="true">
                            ·
                          </span>
                          <input
                            type="date"
                            aria-label="Shipment date"
                            value={item.shipmentDate ?? ''}
                            onChange={(e) =>
                              onUpdateItem({ ...item, shipmentDate: e.target.value })
                            }
                            className="text-[11px] font-mono text-[#64748B] bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-0.5"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Total Purchase Amount (PKR) */}
                    <td className="px-3 py-3 border-r border-[#E5E2DC] text-right">
                      <InlineDecimalInput
                        value={item.purchaseAmountPkr}
                        ariaLabel={`${item.productName} purchase amount PKR`}
                        onCommit={(next) =>
                          onUpdateItem({ ...item, purchaseAmountPkr: next })
                        }
                        className="w-full text-sm font-mono tabular-nums text-right text-[#18181B] bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-0.5"
                      />
                      <div className="text-[11px] font-mono tabular-nums text-[#64748B] mt-1">
                        {formatCompactTotal(item.purchaseAmountPkr)} PKR
                      </div>
                    </td>

                    {/* Quantity in Kg + automatic Tons */}
                    <td className="px-3 py-3 border-r border-[#E5E2DC] text-right">
                      <InlineDecimalInput
                        value={item.quantityKg}
                        ariaLabel={`${item.productName} quantity in kg`}
                        onCommit={(next) => onUpdateItem({ ...item, quantityKg: next })}
                        className="w-full text-sm font-mono tabular-nums text-right text-[#18181B] bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-0.5"
                      />
                      <div className="text-[11px] font-mono tabular-nums text-[#0F5132] font-medium mt-1">
                        {formatTons(metrics.tons)}
                      </div>
                    </td>

                    {/* Dynamic Per-Kg Expense Cells */}
                    {expenseColumns.map((col) => (
                      <td
                        key={col.id}
                        className="px-3 py-3 border-r border-[#E5E2DC] text-right"
                      >
                        <InlineDecimalInput
                          value={item.expenses[col.id] ?? 0}
                          ariaLabel={`${item.productName} ${col.name} expense per kg`}
                          onCommit={(next) =>
                            onUpdateItem({
                              ...item,
                              expenses: {
                                ...item.expenses,
                                [col.id]: next,
                              },
                            })
                          }
                          className="w-full text-sm font-mono tabular-nums text-right text-[#18181B] bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#0F5132] focus:outline-none py-0.5"
                        />
                        <div className="text-[11px] font-mono tabular-nums text-[#64748B] mt-1">
                          {formatNumber(item.expenses[col.id] ?? 0, 2)} / kg
                        </div>
                      </td>
                    ))}

                    {/* Base Rate / Kg (PKR) */}
                    <td className="px-3 py-3 border-r border-[#E5E2DC] text-right">
                      <div className="text-sm font-mono tabular-nums font-medium text-[#18181B]">
                        {formatNumber(metrics.baseRatePerKg, 2)}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1">Base / kg</div>
                    </td>

                    {/* Country Columns (Base PKR + Converted Countries) */}
                    {countries.map((country) => {
                      const converted = calculateCountryConversion(metrics, country.rate);
                      const cellCopyKey = `${item.id}:${country.id}`;
                      const isCopied = copiedKey === cellCopyKey;
                      return (
                        <td
                          key={country.id}
                          className={`px-3 py-2.5 border-r border-[#E5E2DC] ${
                            country.isBase ? 'bg-[#F4F8F6]/60' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="text-[11px] text-[#64748B] whitespace-nowrap">
                                Rate / Kg
                              </span>
                              <span
                                className={`font-mono tabular-nums font-semibold ${
                                  country.isBase ? 'text-[#0F5132]' : 'text-[#18181B]'
                                }`}
                              >
                                {formatRatePerKg(converted.ratePerKg, country.rate)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="text-[11px] text-[#64748B] whitespace-nowrap">
                                Rate / Ton
                              </span>
                              <span className="font-mono tabular-nums text-[#18181B]">
                                {formatRatePerTon(converted.ratePerTon)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-[#E5E2DC]/70 text-xs">
                              <span className="text-[11px] font-medium text-[#64748B] whitespace-nowrap">
                                Final Total
                              </span>
                              <span
                                className={`font-mono tabular-nums font-semibold ${
                                  country.isBase ? 'text-[#0F5132]' : 'text-[#18181B]'
                                }`}
                              >
                                {formatCompactTotal(converted.finalTotal)}
                              </span>
                            </div>
                            <div className="no-print flex justify-end pt-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(
                                    cellCopyKey,
                                    formatCountryQuote(item, metrics, country)
                                  )
                                }
                                title={`Copy ${country.name} buyer quote`}
                                aria-label={`Copy ${country.name} buyer quote for ${item.productName}`}
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-[#64748B] hover:text-[#0F5132] transition-colors cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-[#0F5132]" />
                                    <span className="text-[#0F5132]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>Copy quote</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    {/* Row Actions */}
                    <td className="no-print px-2.5 py-3 text-center">
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              item.id,
                              formatMultiCountryQuote(item, metrics, countries)
                            )
                          }
                          title={`Copy all quotes for ${item.productName}`}
                          aria-label={`Copy all quotes for ${item.productName}`}
                          className="p-1.5 text-[#64748B] hover:text-[#0F5132] rounded transition-colors cursor-pointer"
                        >
                          {copiedKey === item.id ? (
                            <Check className="w-3.5 h-3.5 text-[#0F5132]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicateItem(item)}
                          title={`Duplicate ${item.productName}`}
                          aria-label={`Duplicate ${item.productName}`}
                          className="p-1.5 text-[#64748B] hover:text-[#0F5132] rounded transition-colors cursor-pointer"
                        >
                          <CopyPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditItemModal(item)}
                          title={`Edit ${item.productName}`}
                          aria-label={`Edit ${item.productName}`}
                          className="p-1.5 text-[#64748B] hover:text-[#0F5132] rounded transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          title={`Delete ${item.productName}`}
                          aria-label={`Delete ${item.productName}`}
                          className="p-1.5 text-[#64748B] hover:text-red-700 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Sticky Summary Footer */}
            <tfoot>
              <tr className="bg-[#F5F3EE] border-t-2 border-[#E5E2DC] text-xs font-semibold text-[#18181B]">
                <td className="sticky bottom-0 lg:left-0 z-20 lg:z-30 bg-[#F5F3EE] px-3.5 xl:px-4 py-3 border-r border-[#E5E2DC]">
                  <div className="text-xs font-semibold text-[#18181B]">Ledger Summary</div>
                  <div className="text-[11px] font-normal text-[#64748B] mt-0.5">
                    {rowComputations.length}{' '}
                    {rowComputations.length === 1 ? 'Commodity' : 'Commodities'}
                    {hasActiveFilters ? ' (Filtered)' : ''}
                  </div>
                </td>

                <td className="sticky bottom-0 z-20 bg-[#F5F3EE] px-3 py-3 border-r border-[#E5E2DC] text-right">
                  <div className="text-[11px] font-normal text-[#64748B]">Total Purchase</div>
                  <div className="text-sm font-mono tabular-nums font-semibold text-[#18181B] mt-0.5">
                    {formatCompactTotal(totalPurchasePkr)}
                  </div>
                </td>

                <td className="sticky bottom-0 z-20 bg-[#F5F3EE] px-3 py-3 border-r border-[#E5E2DC] text-right">
                  <div className="font-mono tabular-nums text-sm font-semibold text-[#18181B]">
                    {formatCompactTotal(totalQuantityKg)} kg
                  </div>
                  <div className="text-[11px] font-mono tabular-nums font-medium text-[#0F5132] mt-0.5">
                    {formatTons(totalTons)}
                  </div>
                </td>

                {expenseColumns.map((col) => (
                  <td
                    key={col.id}
                    className="sticky bottom-0 z-20 bg-[#F5F3EE] px-3 py-3 border-r border-[#E5E2DC] text-right text-[#64748B] font-mono"
                  >
                    —
                  </td>
                ))}

                <td className="sticky bottom-0 z-20 bg-[#F5F3EE] px-3 py-3 border-r border-[#E5E2DC] text-right text-[#64748B] font-mono">
                  —
                </td>

                {countries.map((country) => {
                  const countryGrandTotal = totalFinalPkr * (country.rate >= 0 ? country.rate : 0);
                  return (
                    <td
                      key={country.id}
                      className={`sticky bottom-0 z-20 px-3 py-3 border-r border-[#E5E2DC] text-right ${
                        country.isBase ? 'bg-[#E9F1EC]' : 'bg-[#F5F3EE]'
                      }`}
                    >
                      <div className="text-[11px] font-normal text-[#64748B]">
                        Total ({country.code})
                      </div>
                      <div
                        className={`text-sm font-mono tabular-nums font-semibold mt-0.5 ${
                          country.isBase ? 'text-[#0F5132]' : 'text-[#18181B]'
                        }`}
                      >
                        {formatCompactTotal(countryGrandTotal)}
                      </div>
                    </td>
                  );
                })}

                <td className="no-print sticky bottom-0 z-20 bg-[#F5F3EE] px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
