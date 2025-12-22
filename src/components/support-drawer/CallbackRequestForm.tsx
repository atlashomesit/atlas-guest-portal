import { CallbackStatus } from "./supportDrawer.types";

interface CallbackRequestFormProps {
  callbackError: string | null;
  callbackPhone: string;
  callbackStatus: CallbackStatus;
  onClose: () => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
}

const CallbackRequestForm = ({
  callbackError,
  callbackPhone,
  callbackStatus,
  onClose,
  onPhoneChange,
  onSubmit,
}: CallbackRequestFormProps) => (
  <div className="rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-inner">
    <p className="text-sm font-semibold text-text-primary">Callback request</p>
    <p className="text-xs text-text-muted">Share your number and we&apos;ll reach out shortly.</p>
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-muted px-3 py-2 focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20">
      <span className="text-xs font-semibold text-text-muted">+91</span>
      <input
        type="tel"
        inputMode="numeric"
        value={callbackPhone}
        onChange={(event) => onPhoneChange(event.target.value)}
        className="w-full bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
        placeholder="10-digit phone number"
        aria-label="Callback phone"
      />
    </div>
    {callbackError ? <p className="mt-1 text-xs font-semibold text-support-error">{callbackError}</p> : null}
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        disabled={callbackStatus === "sending"}
        onClick={onSubmit}
        className="inline-flex flex-1 items-center justify-center rounded-full bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow-level1 transition hover:bg-cta-secondary disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
      >
        {callbackStatus === "sending" ? "Sending..." : callbackStatus === "sent" ? "Request sent" : "Submit"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full px-3 py-2 text-xs font-semibold text-text-muted underline underline-offset-2"
      >
        Close
      </button>
    </div>
    {callbackStatus === "sent" ? <p className="mt-1 text-xs font-semibold text-success">We&apos;ll call you soon.</p> : null}
  </div>
);

export default CallbackRequestForm;
