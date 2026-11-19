import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { CountryCurrency } from '../types/ledger';

interface CurrencyHeaderStripProps {
  countries: CountryCurrency[];
  onUpdateRate: (countryId: string, rate: number) => void;
  onAddCountry: (name: string, code: string, rate: number) => void;
  onRemoveCountry: (countryId: string) => void;
}

interface RateFieldProps {
  value: number;
  disabled?: boolean;
  label: string;
  onCommit: (next: number) => void;
}

function RateField({ value, disabled, label, onCommit }: RateFieldProps) {
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
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        onCommit(parsed);
      }
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || parsed < 0) {
      setDraft(String(value));
    } else {
      setDraft(String(parsed));
      onCommit(parsed);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full sm:w-24 bg-transparent font-mono text-sm sm:text-xs tabular-nums text-right outline-none border-b transition-colors py-1 sm:py-0.5 ${
        disabled
          ? 'border-transparent text-[#64748B] cursor-default'
          : 'border-[#E5E2DC] text-[#18181B] focus:border-[#0F5132]'
      }`}
    />
  );
}

export function CurrencyHeaderStrip({
  countries,
  onUpdateRate,
  onAddCountry,
  onRemoveCountry,
}: CurrencyHeaderStripProps) {
  const [mobileExpanded, setMobileExpanded] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    const parsedRate = parseFloat(rate);

    if (!trimmedName) {
      setError('Enter a country name.');
      return;
    }
    if (!trimmedCode || trimmedCode.length > 6) {
      setError('Enter a 2–6 letter currency code.');
      return;
    }
    if (Number.isNaN(parsedRate) || parsedRate <= 0) {
      setError('Enter a positive conversion rate.');
      return;
    }

    onAddCountry(trimmedName, trimmedCode, parsedRate);
    setName('');
    setCode('');
    setRate('');
    setError('');
    setIsAdding(false);
  };

  return (
    <section
      aria-label="Manual Exchange Rates"
      className="no-print bg-white border border-[#E5E2DC] rounded-md overflow-hidden"
    >
      {/* Mobile Header Toggle + Add Country */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 md:hidden border-b border-[#E5E2DC]/70">
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className="inline-flex items-center gap-2 min-h-[36px] text-left cursor-pointer"
          aria-expanded={mobileExpanded}
        >
          <span className="text-xs font-semibold text-[#18181B]">
            Exchange Rates
          </span>
          <span className="text-xs text-[#64748B]">
            Manual · {countries.length}
          </span>
          {mobileExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#64748B]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileExpanded(true);
            setIsAdding((prev) => !prev);
            setError('');
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] text-xs font-medium text-[#0F5132] border border-[#0F5132]/30 hover:border-[#0F5132] hover:bg-[#0F5132]/5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Country
        </button>
      </div>

      {/* Rates Body: 2-col mobile, 3-col tablet, 5-col laptop, single-line flex on xl+ */}
      <div
        className={`${
          mobileExpanded ? 'block' : 'hidden md:block'
        } px-3.5 sm:px-5 lg:px-6 py-2.5`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 xl:gap-4">
          <div className="flex flex-col xl:flex-row xl:flex-wrap xl:items-center gap-3 xl:gap-x-5 xl:gap-y-2 flex-1 min-w-0">
            <div className="hidden xl:flex items-center gap-2 pr-3 border-r border-[#E5E2DC] shrink-0">
              <span className="text-xs font-semibold text-[#18181B] whitespace-nowrap">
                Exchange Rates
              </span>
              <span className="text-xs text-[#64748B] whitespace-nowrap">
                Manual · 1 PKR base
              </span>
            </div>

            <div className="hidden md:flex xl:hidden items-center justify-between gap-3 pb-1 border-b border-[#E5E2DC]/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#18181B]">
                  Exchange Rates
                </span>
                <span className="text-xs text-[#64748B]">
                  Manual · 1 PKR base
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAdding((prev) => !prev);
                  setError('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F5132] border border-[#0F5132]/30 hover:border-[#0F5132] hover:bg-[#0F5132]/5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Country
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:flex xl:flex-wrap items-center gap-x-4 gap-y-2.5 xl:gap-x-5 xl:gap-y-2">
              {countries.map((country) => (
                <div
                  key={country.id}
                  className="flex flex-col xl:flex-row xl:items-center gap-0.5 xl:gap-2 text-xs pb-1.5 xl:pb-0 border-b border-[#E5E2DC]/60 xl:border-b-0"
                >
                  <div className="flex items-center justify-between xl:justify-start gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-[#18181B] truncate">
                        {country.name}
                      </span>
                      <span className="text-[#64748B] font-mono text-[11px] shrink-0">
                        {country.code}
                      </span>
                    </div>
                    {!country.isBase && (
                      <button
                        type="button"
                        onClick={() => onRemoveCountry(country.id)}
                        title={`Remove ${country.name}`}
                        aria-label={`Remove ${country.name}`}
                        className="xl:hidden p-1 -mr-1 text-[#64748B] hover:text-red-700 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {country.isBase ? (
                    <span className="font-mono tabular-nums text-xs text-[#0F5132] font-medium xl:pl-1 py-1 xl:py-0">
                      1 (Base)
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <RateField
                        value={country.rate}
                        label={`${country.name} (${country.code}) exchange rate`}
                        onCommit={(next) => onUpdateRate(country.id, next)}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveCountry(country.id)}
                        title={`Remove ${country.name}`}
                        aria-label={`Remove ${country.name}`}
                        className="hidden xl:inline-flex p-0.5 text-[#64748B] hover:text-red-700 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsAdding((prev) => !prev);
              setError('');
            }}
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F5132] border border-[#0F5132]/30 hover:border-[#0F5132] hover:bg-[#0F5132]/5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Country
          </button>
        </div>
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="px-3.5 sm:px-4 py-3 border-t border-[#E5E2DC] bg-[#FAF9F6] grid grid-cols-1 sm:flex sm:flex-wrap sm:items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="strip-country-name" className="text-[11px] font-medium text-[#64748B]">
              Country Name
            </label>
            <input
              id="strip-country-name"
              type="text"
              placeholder="e.g. UAE"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full sm:w-40 px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="strip-country-code" className="text-[11px] font-medium text-[#64748B]">
                Currency Code
              </label>
              <input
                id="strip-country-code"
                type="text"
                placeholder="e.g. AED"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full sm:w-24 px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs font-mono uppercase bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="strip-country-rate" className="text-[11px] font-medium text-[#64748B]">
                Rate per 1 PKR
              </label>
              <input
                id="strip-country-rate"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 0.0132"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full sm:w-32 px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs font-mono tabular-nums bg-white border border-[#E5E2DC] rounded focus:outline-none focus:border-[#0F5132]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <button
              type="submit"
              className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Add Column
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setError('');
              }}
              className="px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-xs font-medium text-[#64748B] hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-700 font-medium w-full sm:w-auto">{error}</p>
          )}
        </form>
      )}
    </section>
  );
}
