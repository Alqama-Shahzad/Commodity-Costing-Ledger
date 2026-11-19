import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ExpenseColumn, TradeItem } from '../types/ledger';
import {
  calculateItemMetrics,
  formatCompactTotal,
  formatNumber,
  formatTons,
} from '../utils/calculations';

interface ItemFormModalProps {
  isOpen: boolean;
  editingItem: TradeItem | null;
  expenseColumns: ExpenseColumn[];
  onClose: () => void;
  onSave: (item: Omit<TradeItem, 'id'>, existingId?: string) => void;
}

export function ItemFormModal({
  isOpen,
  editingItem,
  expenseColumns,
  onClose,
  onSave,
}: ItemFormModalProps) {
  const [originCountry, setOriginCountry] = useState('Pakistan');
  const [productName, setProductName] = useState('');
  const [lotRef, setLotRef] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [expenses, setExpenses] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingItem) {
      setOriginCountry(editingItem.originCountry);
      setProductName(editingItem.productName);
      setLotRef(editingItem.lotRef ?? '');
      setShipmentDate(editingItem.shipmentDate ?? '');
      setPurchaseAmount(String(editingItem.purchaseAmountPkr));
      setQuantityKg(String(editingItem.quantityKg));
      const nextExp: Record<string, string> = {};
      for (const col of expenseColumns) {
        const val = editingItem.expenses[col.id];
        nextExp[col.id] = val !== undefined ? String(val) : '0';
      }
      setExpenses(nextExp);
    } else {
      setOriginCountry('Pakistan');
      setProductName('');
      setLotRef('');
      setShipmentDate(new Date().toISOString().slice(0, 10));
      setPurchaseAmount('');
      setQuantityKg('');
      const nextExp: Record<string, string> = {};
      for (const col of expenseColumns) {
        nextExp[col.id] = '0';
      }
      setExpenses(nextExp);
    }
    setError('');
  }, [isOpen, editingItem, expenseColumns]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const previewMetrics = useMemo(() => {
    const parsedPurchase = parseFloat(purchaseAmount) || 0;
    const parsedQty = parseFloat(quantityKg) || 0;
    const parsedExpenses: Record<string, number> = {};
    for (const col of expenseColumns) {
      parsedExpenses[col.id] = parseFloat(expenses[col.id] || '0') || 0;
    }
    return calculateItemMetrics(
      {
        id: 'preview',
        originCountry,
        productName,
        lotRef,
        shipmentDate,
        purchaseAmountPkr: parsedPurchase,
        quantityKg: parsedQty,
        expenses: parsedExpenses,
      },
      expenseColumns
    );
  }, [originCountry, productName, lotRef, shipmentDate, purchaseAmount, quantityKg, expenses, expenseColumns]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOrigin = originCountry.trim();
    const trimmedProduct = productName.trim();
    const parsedPurchase = parseFloat(purchaseAmount);
    const parsedQty = parseFloat(quantityKg);

    if (!trimmedOrigin) {
      setError('Origin country is required.');
      return;
    }
    if (!trimmedProduct) {
      setError('Product name is required.');
      return;
    }
    if (Number.isNaN(parsedPurchase) || parsedPurchase < 0) {
      setError('Enter a valid total purchase amount.');
      return;
    }
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setError('Quantity in Kg must be greater than 0.');
      return;
    }

    const numericExpenses: Record<string, number> = {};
    for (const col of expenseColumns) {
      const val = parseFloat(expenses[col.id] || '0');
      numericExpenses[col.id] = Number.isNaN(val) || val < 0 ? 0 : val;
    }

    onSave(
      {
        originCountry: trimmedOrigin,
        productName: trimmedProduct,
        lotRef: lotRef.trim() || undefined,
        shipmentDate: shipmentDate || undefined,
        purchaseAmountPkr: parsedPurchase,
        quantityKg: parsedQty,
        expenses: numericExpenses,
      },
      editingItem?.id
    );
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#18181B]/40 p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
    >
      <div className="w-full sm:max-w-2xl bg-white border-t sm:border border-[#E5E2DC] rounded-t-xl sm:rounded-md overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E5E2DC] flex items-center justify-between shrink-0">
          <div>
            <h2 id="item-modal-title" className="text-base font-semibold text-[#18181B]">
              {editingItem ? 'Edit Commodity Entry' : 'Add Commodity Entry'}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Enter purchase amount, shipment weight, and per-kg handling expenses in PKR.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center -mr-2 text-[#64748B] hover:text-[#18181B] rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-origin" className="text-xs font-medium text-[#18181B]">
                  Origin Country
                </label>
                <input
                  id="modal-origin"
                  type="text"
                  placeholder="e.g. Pakistan"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  className="px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-product" className="text-xs font-medium text-[#18181B]">
                  Product Name
                </label>
                <input
                  id="modal-product"
                  type="text"
                  placeholder="e.g. Onion"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-lot-ref" className="text-xs font-medium text-[#64748B]">
                  Lot / Container Ref <span className="font-normal">(Optional)</span>
                </label>
                <input
                  id="modal-lot-ref"
                  type="text"
                  placeholder="e.g. BL-2041"
                  value={lotRef}
                  onChange={(e) => setLotRef(e.target.value)}
                  className="px-3 py-2.5 sm:py-2 text-base sm:text-sm font-mono bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-date" className="text-xs font-medium text-[#64748B]">
                  Shipment Date <span className="font-normal">(Optional)</span>
                </label>
                <input
                  id="modal-date"
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  className="px-3 py-2.5 sm:py-2 text-base sm:text-sm font-mono bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-purchase" className="text-xs font-medium text-[#18181B]">
                  Total Purchase Amount (PKR)
                </label>
                <input
                  id="modal-purchase"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="e.g. 4500000"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  className="px-3 py-2.5 sm:py-2 text-base sm:text-sm font-mono tabular-nums bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="modal-qty" className="text-xs font-medium text-[#18181B]">
                    Quantity (Kg)
                  </label>
                  <span className="text-xs font-mono tabular-nums text-[#0F5132] font-medium">
                    {formatTons(previewMetrics.tons)}
                  </span>
                </div>
                <input
                  id="modal-qty"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="e.g. 22000"
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(e.target.value)}
                  className="px-3 py-2.5 sm:py-2 text-base sm:text-sm font-mono tabular-nums bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E2DC]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#18181B]">
                  Per-Kg Expenses (PKR)
                </span>
                <span className="text-xs font-mono tabular-nums text-[#64748B]">
                  Total: {formatNumber(previewMetrics.totalExpensePerKg, 2)} PKR/kg
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {expenseColumns.map((col) => (
                  <div key={col.id} className="flex flex-col gap-1">
                    <label
                      htmlFor={`modal-exp-${col.id}`}
                      className="text-xs text-[#64748B] truncate"
                    >
                      {col.name}
                    </label>
                    <input
                      id={`modal-exp-${col.id}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={expenses[col.id] ?? ''}
                      onChange={(e) =>
                        setExpenses((prev) => ({
                          ...prev,
                          [col.id]: e.target.value,
                        }))
                      }
                      className="px-3 py-2 sm:py-1.5 text-base sm:text-sm font-mono tabular-nums bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E2DC] grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 bg-[#FAF9F6] -mx-4 sm:-mx-6 px-4 sm:px-6 py-4">
              <div>
                <div className="text-[11px] text-[#64748B]">Base Rate / Kg</div>
                <div className="text-sm font-mono tabular-nums font-medium text-[#18181B] mt-0.5">
                  {formatNumber(previewMetrics.baseRatePerKg, 2)} PKR
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#64748B]">Landed Rate / Kg</div>
                <div className="text-sm font-mono tabular-nums font-semibold text-[#0F5132] mt-0.5">
                  {formatNumber(previewMetrics.landedRatePerKg, 2)} PKR
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#64748B]">Landed Rate / Ton</div>
                <div className="text-sm font-mono tabular-nums font-medium text-[#18181B] mt-0.5">
                  {formatNumber(previewMetrics.landedRatePerTon, 2)} PKR
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#64748B]">Final Total</div>
                <div className="text-sm font-mono tabular-nums font-semibold text-[#0F5132] mt-0.5">
                  {formatCompactTotal(previewMetrics.finalTotalAmountPkr)} PKR
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-700 font-medium">{error}</p>}
          </div>

          <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-[#E5E2DC] bg-white flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-xs font-medium text-[#64748B] hover:text-[#18181B] transition-colors whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              {editingItem ? 'Save Changes' : 'Add to Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
