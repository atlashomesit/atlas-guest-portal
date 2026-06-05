export type RecoveryAction = {
  actionType: "RETRY_PAYMENT" | "SEARCH_AGAIN" | "CONTACT_SUPPORT" | "CHECK_EMAIL";
  actionLabel: string;
  actionUrl?: string;
  delaySeconds?: number;
};

export type ErrorResponse = {
  code: string;
  message: string;
  details?: string;
  recoveryActions?: RecoveryAction[];
};

type Props = {
  error: ErrorResponse;
  onActionClick?: (action: RecoveryAction) => void;
};

export default function ErrorDisplay({ error, onActionClick }: Props) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3" data-testid="error-display">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">{error.code}</p>
        <p className="text-sm font-medium text-red-800">{error.message}</p>
        {error.details ? <p className="text-xs text-red-700/80">{error.details}</p> : null}
      </div>
      {Array.isArray(error.recoveryActions) && error.recoveryActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {error.recoveryActions.map((action, idx) => {
            const label = action.delaySeconds && action.delaySeconds > 0
              ? `${action.actionLabel} (${action.delaySeconds}s)`
              : action.actionLabel;
            if (action.actionUrl) {
              return (
                <a
                  key={`${action.actionType}-${idx}`}
                  href={action.actionUrl}
                  onClick={() => onActionClick?.(action)}
                  className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
                >
                  {label}
                </a>
              );
            }
            return (
              <button
                key={`${action.actionType}-${idx}`}
                type="button"
                onClick={() => onActionClick?.(action)}
                className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

