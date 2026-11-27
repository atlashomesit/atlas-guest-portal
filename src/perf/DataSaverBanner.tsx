import React from 'react';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

export function isDataSaverPreferred(nav?: { connection?: NetworkInformationLike } | null): boolean {
  const connection = nav?.connection;
  if (!connection) return false;
  return Boolean(connection.saveData || connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
}

export interface DataSaverBannerProps {
  lightweightMode: boolean;
  onToggleFullSite: () => void;
}

export const DataSaverBanner: React.FC<DataSaverBannerProps> = ({
  lightweightMode,
  onToggleFullSite,
}) => {
  if (!lightweightMode) return null;
  return (
    <div
      data-testid="data-saver-banner"
      className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-1.5 text-xs text-white"
    >
      <span>Data Saver active — showing lightweight photos</span>
      <button
        type="button"
        onClick={onToggleFullSite}
        className="underline font-semibold text-amber-300 hover:text-amber-200"
      >
        Load full site
      </button>
    </div>
  );
};
