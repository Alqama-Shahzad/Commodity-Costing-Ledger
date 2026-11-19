import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 bg-[#18181B] text-[#FAF9F6] px-3.5 py-2 rounded-md border border-[#18181B] text-xs font-medium"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Offline mode · Changes saved locally</span>
    </div>
  );
}
