import { SUPPORT_DRAWER_COPY } from "../../config/supportDrawerCopy";
import { CallbackStatus } from "./supportDrawer.types";

interface CallbackRequestFormProps {
  callbackError: string | null;
  callbackPhone: string;
  callbackStatus: CallbackStatus;
  expectationText?: string;
  onClose: () => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
}

const CallbackRequestForm = ({
  callbackError,
  callbackPhone,
  callbackStatus,
  expectationText,
  onClose,
  onPhoneChange,
  onSubmit,
}: CallbackRequestFormProps) => {
  const copy = SUPPORT_DRAWER_COPY.callbackForm;
  const resolvedExpectationText = expectationText ?? copy.expectationText;

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-[var(--drawer-card-padding-block,0.75rem)] shadow-inner">
      <p className="text-sm font-semibold text-text-primary">{copy.title}</p>
      <p className="text-xs text-text-muted">{copy.subtitle}</p>
      {resolvedExpectationText ? (
        <p className="mt-1 text-[11px] text-text-muted">{resolvedExpectationText}</p>
      ) : null}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-muted px-3 py-2 focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20">
        <span className="text-xs font-semibold text-text-muted">{copy.phonePrefixLabel}</span>
        <input
          type="tel"
          inputMode="numeric"
          value={callbackPhone}
          onChange={(event) => onPhoneChange(event.target.value)}
          className="w-full bg-transparent text-base font-medium text-text-primary outline-none placeholder:text-text-muted"
          placeholder={copy.phonePlaceholder}
          aria-label={copy.phoneInputAriaLabel}
        />
      </div>
      {callbackError ? <p className="mt-1 text-xs font-semibold text-support-error">{callbackError}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={callbackStatus === "sending"}
          onClick={onSubmit}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-cta-primary px-4 py-3 text-sm font-semibold text-[var(--text-on-cta)] shadow-level1 transition hover:bg-cta-secondary disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
        >
          {callbackStatus === "sending"
            ? copy.submitLabels.sending
            : callbackStatus === "sent"
              ? copy.submitLabels.sent
              : copy.submitLabels.idle}
        </button>
        <button
          type="button"
          onClick={onClose}
          // TASK-958: bump cancel button to 14px text + ~44px tap target
          // (px-3 py-2 text-xs → px-4 py-3 text-sm). Below-minimum targets
          // on mobile caused frequent mis-taps when dismissing the form.
          className="rounded-full px-4 py-3 text-sm font-semibold text-text-muted underline underline-offset-2"
        >
          {copy.closeLabel}
        </button>
      </div>
      {callbackStatus === "sent" ? (
        <p className="mt-1 text-xs font-semibold text-success">{copy.successMessage}</p>
      ) : null}
    </div>
  );
};

export default CallbackRequestForm;
