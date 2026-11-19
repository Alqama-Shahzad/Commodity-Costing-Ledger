import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Install App"
        title="Install Commodity Costing Ledger app"
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-xs font-medium text-[#0F5132] bg-white border border-[#0F5132]/35 hover:border-[#0F5132] hover:bg-[#0F5132]/5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install on iOS"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-xs font-medium text-[#0F5132] bg-white border border-[#0F5132]/35 hover:border-[#0F5132] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#18181B]/40 p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIOSGuide(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full sm:max-w-sm bg-white border-t sm:border border-[#E5E2DC] rounded-t-xl sm:rounded-md p-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC]">
                <h3 id="ios-install-title" className="text-sm font-semibold text-[#18181B]">
                  Install on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close instructions"
                  className="p-1 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-xs text-[#64748B] leading-relaxed">
                <li>
                  1. Tap the <strong className="text-[#18181B]">Share</strong> icon in Safari&apos;s toolbar.
                </li>
                <li>
                  2. Scroll down and select <strong className="text-[#18181B]">Add to Home Screen</strong>.
                </li>
                <li>
                  3. Tap <strong className="text-[#18181B]">Add</strong> to launch CostLedger offline anytime.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2.5 min-h-[44px] text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
