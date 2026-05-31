import { Link } from "react-router-dom";

export type StateAction = {
  label: string;
  /** Internal route — rendered as a react-router <Link>. */
  to?: string;
  /** External/mailto/tel link — rendered as an <a>. */
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  "data-testid"?: string;
};

type Props = {
  /** A simple inline glyph or SVG — no illustration library. */
  icon?: React.ReactNode;
  title: string;
  message?: string;
  /** Most prominent recovery affordance. */
  primaryAction?: StateAction;
  /** Quieter alternatives (email support, go home, etc.). */
  secondaryActions?: StateAction[];
  "data-testid"?: string;
};

function actionClasses(variant: StateAction["variant"]): string {
  if (variant === "secondary") {
    return "inline-flex items-center justify-center rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-base font-medium text-text-primary hover:bg-bg-muted transition-colors";
  }
  return "inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-base font-semibold text-white hover:opacity-95 transition-opacity";
}

function ActionEl({ action }: { action: StateAction }) {
  const cls = actionClasses(action.variant);
  if (action.to) {
    return (
      <Link to={action.to} onClick={action.onClick} className={cls} data-testid={action["data-testid"]}>
        {action.label}
      </Link>
    );
  }
  if (action.href) {
    return (
      <a href={action.href} onClick={action.onClick} className={cls} data-testid={action["data-testid"]}>
        {action.label}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls} data-testid={action["data-testid"]}>
      {action.label}
    </button>
  );
}

/**
 * Unified empty / error state: glyph + headline + one supportive line + a clear
 * recovery action. Plain, Hinglish-friendly copy — never surfaces HTTP codes or
 * stack traces. Works at 390px.
 */
export default function StateMessage({
  icon,
  title,
  message,
  primaryAction,
  secondaryActions,
  "data-testid": testId,
}: Props) {
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center px-4 py-12"
      data-testid={testId}
    >
      <div className="max-w-md w-full text-center space-y-4">
        {icon ? (
          <div className="text-5xl leading-none" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <h1 className="text-xl font-bold text-text-primary">{title}</h1>
        {message ? (
          <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
        ) : null}
        {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch pt-1">
            {primaryAction ? (
              <ActionEl action={{ ...primaryAction, variant: primaryAction.variant ?? "primary" }} />
            ) : null}
            {secondaryActions?.map((action, idx) => (
              <ActionEl
                key={`${action.label}-${idx}`}
                action={{ ...action, variant: action.variant ?? "secondary" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
