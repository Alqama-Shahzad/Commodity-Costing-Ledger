import { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, Undo2, X } from 'lucide-react';
import { CurrencyHeaderStrip } from './components/CurrencyHeaderStrip';
import { ItemFormModal } from './components/ItemFormModal';
import { LedgerTable } from './components/LedgerTable';
import { LedgerState, TradeItem, UndoSnapshot } from './types/ledger';
import {
  getInitialLedgerState,
  loadLedgerState,
  saveLedgerState,
} from './utils/calculations';

function createUniqueId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function App() {
  const [ledger, setLedger] = useState<LedgerState>(() => loadLedgerState());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TradeItem | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    saveLedgerState(ledger);
  }, [ledger]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const pushUndo = (snapshot: UndoSnapshot) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoSnapshot(snapshot);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null);
      undoTimerRef.current = null;
    }, 8000);
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    setLedger((prev) => {
      switch (undoSnapshot.type) {
        case 'item': {
          const nextItems = [...prev.items];
          const insertIndex = Math.min(undoSnapshot.index, nextItems.length);
          nextItems.splice(insertIndex, 0, undoSnapshot.item);
          return { ...prev, items: nextItems };
        }
        case 'expense': {
          const nextCols = [...prev.expenseColumns];
          const insertIndex = Math.min(undoSnapshot.index, nextCols.length);
          nextCols.splice(insertIndex, 0, undoSnapshot.column);
          const nextItems = prev.items.map((item) => ({
            ...item,
            expenses: {
              ...item.expenses,
              [undoSnapshot.column.id]: undoSnapshot.valuesByItemId[item.id] ?? 0,
            },
          }));
          return {
            ...prev,
            expenseColumns: nextCols,
            items: nextItems,
          };
        }
        case 'country': {
          const nextCountries = [...prev.countries];
          const insertIndex = Math.min(undoSnapshot.index, nextCountries.length);
          nextCountries.splice(insertIndex, 0, undoSnapshot.country);
          return { ...prev, countries: nextCountries };
        }
        case 'reset':
          return undoSnapshot.previousState;
      }
    });

    setUndoSnapshot(null);
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: TradeItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = (
    payload: Omit<TradeItem, 'id'>,
    existingId?: string
  ) => {
    setLedger((prev) => {
      if (existingId) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === existingId ? { ...payload, id: existingId } : item
          ),
        };
      }
      const newItem: TradeItem = {
        ...payload,
        id: createUniqueId('item'),
      };
      return {
        ...prev,
        items: [...prev.items, newItem],
      };
    });
  };

  const handleUpdateItemInline = (updated: TradeItem) => {
    setLedger((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === updated.id ? updated : item)),
    }));
  };

  const handleDuplicateItem = (source: TradeItem) => {
    const cloned: TradeItem = {
      ...source,
      id: createUniqueId('item'),
      productName: source.productName ? `${source.productName} (Copy)` : 'Copy',
      expenses: { ...source.expenses },
    };
    setLedger((prev) => {
      const idx = prev.items.findIndex((i) => i.id === source.id);
      const nextItems = [...prev.items];
      nextItems.splice(idx >= 0 ? idx + 1 : nextItems.length, 0, cloned);
      return { ...prev, items: nextItems };
    });
  };

  const handleDeleteItem = (itemId: string) => {
    const index = ledger.items.findIndex((i) => i.id === itemId);
    const target = ledger.items[index];
    if (!target) return;

    pushUndo({
      type: 'item',
      label: `Deleted "${target.productName || 'item'}"`,
      item: { ...target, expenses: { ...target.expenses } },
      index,
    });

    setLedger((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleAddExpenseColumn = (name: string) => {
    const newId = createUniqueId('exp');
    setLedger((prev) => ({
      ...prev,
      expenseColumns: [...prev.expenseColumns, { id: newId, name, isDefault: false }],
      items: prev.items.map((item) => ({
        ...item,
        expenses: { ...item.expenses, [newId]: 0 },
      })),
    }));
  };

  const handleRenameExpenseColumn = (id: string, name: string) => {
    setLedger((prev) => ({
      ...prev,
      expenseColumns: prev.expenseColumns.map((col) =>
        col.id === id ? { ...col, name } : col
      ),
    }));
  };

  const handleRemoveExpenseColumn = (id: string) => {
    const index = ledger.expenseColumns.findIndex((c) => c.id === id);
    const column = ledger.expenseColumns[index];
    if (!column) return;

    const valuesByItemId: Record<string, number> = {};
    for (const item of ledger.items) {
      valuesByItemId[item.id] = item.expenses[id] ?? 0;
    }

    pushUndo({
      type: 'expense',
      label: `Removed "${column.name}" column`,
      column: { ...column },
      index,
      valuesByItemId,
    });

    setLedger((prev) => ({
      ...prev,
      expenseColumns: prev.expenseColumns.filter((col) => col.id !== id),
      items: prev.items.map((item) => {
        const nextExpenses = { ...item.expenses };
        delete nextExpenses[id];
        return { ...item, expenses: nextExpenses };
      }),
    }));
  };

  const handleUpdateCountryRate = (countryId: string, rate: number) => {
    setLedger((prev) => ({
      ...prev,
      countries: prev.countries.map((country) =>
        country.id === countryId && !country.isBase ? { ...country, rate } : country
      ),
    }));
  };

  const handleAddCountry = (name: string, code: string, rate: number) => {
    const newId = createUniqueId('country');
    setLedger((prev) => ({
      ...prev,
      countries: [
        ...prev.countries,
        { id: newId, name, code, rate, isBase: false },
      ],
    }));
  };

  const handleRemoveCountry = (countryId: string) => {
    const index = ledger.countries.findIndex((c) => c.id === countryId);
    const country = ledger.countries[index];
    if (!country || country.isBase) return;

    pushUndo({
      type: 'country',
      label: `Removed "${country.name} (${country.code})"`,
      country: { ...country },
      index,
    });

    setLedger((prev) => ({
      ...prev,
      countries: prev.countries.filter(
        (c) => c.id !== countryId || c.isBase
      ),
    }));
  };

  const handleResetLedger = () => {
    pushUndo({
      type: 'reset',
      label: 'Ledger reset to clean defaults',
      previousState: {
        items: ledger.items.map((i) => ({ ...i, expenses: { ...i.expenses } })),
        expenseColumns: ledger.expenseColumns.map((c) => ({ ...c })),
        countries: ledger.countries.map((c) => ({ ...c })),
      },
    });
    setLedger(getInitialLedgerState());
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#18181B] flex flex-col">
      <header className="no-print bg-white border-b border-[#E5E2DC]">
        <div className="max-w-[1680px] mx-auto px-3.5 sm:px-6 py-2.5 sm:py-0 sm:h-14 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-6 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[#18181B] truncate">
              Commodity Costing Ledger
            </h1>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#64748B] whitespace-nowrap">
              <span>
                {ledger.items.length}{' '}
                {ledger.items.length === 1 ? 'Item' : 'Items'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{ledger.expenseColumns.length} Expenses</span>
              <span aria-hidden="true">·</span>
              <span>{ledger.countries.length} Currencies</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetLedger}
              aria-label="Reset Ledger"
              title="Clear items and restore default columns and rates"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-xs font-medium text-[#64748B] hover:text-[#18181B] border border-[#E5E2DC] sm:border-transparent hover:border-[#E5E2DC] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Ledger</span>
              <span className="sm:hidden">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[40px] sm:min-h-0 text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1680px] w-full mx-auto px-3.5 sm:px-6 py-3 sm:py-4 space-y-3">
        <CurrencyHeaderStrip
          countries={ledger.countries}
          onUpdateRate={handleUpdateCountryRate}
          onAddCountry={handleAddCountry}
          onRemoveCountry={handleRemoveCountry}
        />

        <LedgerTable
          items={ledger.items}
          expenseColumns={ledger.expenseColumns}
          countries={ledger.countries}
          onUpdateItem={handleUpdateItemInline}
          onDuplicateItem={handleDuplicateItem}
          onEditItemModal={handleOpenEditModal}
          onDeleteItem={handleDeleteItem}
          onOpenAddModal={handleOpenAddModal}
          onAddExpenseColumn={handleAddExpenseColumn}
          onRenameExpenseColumn={handleRenameExpenseColumn}
          onRemoveExpenseColumn={handleRemoveExpenseColumn}
          onUpdateCountryRate={handleUpdateCountryRate}
          onAddCountry={handleAddCountry}
          onRemoveCountry={handleRemoveCountry}
        />
      </main>

      <ItemFormModal
        isOpen={isModalOpen}
        editingItem={editingItem}
        expenseColumns={ledger.expenseColumns}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
      />

      {/* Undo Banner for deletions and resets */}
      {undoSnapshot && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-40 w-[calc(100%-2rem)] sm:w-auto max-w-md bg-[#18181B] text-white px-4 py-2.5 rounded-md border border-[#18181B] flex items-center justify-between gap-4"
        >
          <span className="text-xs font-medium truncate">{undoSnapshot.label}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] text-xs font-semibold text-[#FAF9F6] bg-[#0F5132] hover:bg-[#146C43] rounded transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setUndoSnapshot(null)}
              aria-label="Dismiss notification"
              className="p-1 text-[#A1A1AA] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
