import { useRef, useState, type FormEvent } from "react";

export interface ArrivalDetailsDraft {
  arrivalTime: string;
  guestCount: string;
  contactPhone: string;
  contactEmail: string;
}

interface Props {
  value: ArrivalDetailsDraft;
  currentGuestCount: number;
  phoneRequired: boolean;
  validatePhone: (value: string) => boolean;
  validateEmail: (value: string) => boolean;
  onApply: (value: ArrivalDetailsDraft) => void;
}

export default function ArrivalDetailsEditor({ value, currentGuestCount, phoneRequired, validatePhone, validateEmail, onApply }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const [confirmReduction, setConfirmReduction] = useState(false);
  const [status, setStatus] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const arrivalInput = useRef<HTMLInputElement>(null);
  const countInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const close = () => {
    setEditing(false);
    setConfirmReduction(false);
    setError("");
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const apply = (confirmed = false) => {
    const count = Number(draft.guestCount);
    if (!draft.guestCount.trim() || !Number.isInteger(count) || count < 1) {
      setError("Please enter a whole number of guests (at least 1).");
      countInput.current?.focus(); return;
    }
    if ((phoneRequired && !draft.contactPhone.trim()) || (draft.contactPhone.trim() && !validatePhone(draft.contactPhone))) {
      setError("Please enter a valid WhatsApp mobile number. For a number outside India, start with + and the country code.");
      phoneInput.current?.focus(); return;
    }
    if (draft.contactEmail.trim() && !validateEmail(draft.contactEmail)) {
      setError("Please enter a valid email address, for example name@example.com.");
      emailInput.current?.focus(); return;
    }
    setError("");
    if (count < currentGuestCount && !confirmed) { setConfirmReduction(true); return; }
    onApply({ ...draft, guestCount: String(count) });
    setStatus("Arrival details updated. Other guest details are kept.");
    close();
  };
  const update = (key: keyof ArrivalDetailsDraft, next: string) => {
    setDraft((previous) => ({ ...previous, [key]: next }));
    setError(""); setConfirmReduction(false);
  };
  const inputClass = "block w-full rounded-lg border border-border-subtle px-3 py-2.5 mb-3 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary";
  return (
    <section data-testid="checkin-arrival-correction" className="border border-border-subtle rounded-xl p-3 mb-4 text-sm">
      <p>Arrival {value.arrivalTime || "not specified"} · {currentGuestCount} {currentGuestCount === 1 ? "guest" : "guests"}</p>
      {!editing && <button ref={editButton} type="button" className="min-h-[44px] underline text-text-primary"
        onClick={() => { setDraft(value); setStatus(""); setError(""); setConfirmReduction(false); setEditing(true); requestAnimationFrame(() => arrivalInput.current?.focus()); }}>
        Edit arrival details
      </button>}
      {editing && <form noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); apply(); }}>
        <p className="font-semibold mb-3">Arrival details</p>
        {error && <p role="alert" className="text-red-700 mb-3">{error}</p>}
        <label htmlFor="arrival-edit-time">Estimated arrival time (optional)</label>
        <input ref={arrivalInput} id="arrival-edit-time" type="time" value={draft.arrivalTime} onChange={(event) => update("arrivalTime", event.target.value)} className={inputClass} />
        <label htmlFor="arrival-edit-count">Number of guests *</label>
        <input ref={countInput} id="arrival-edit-count" type="number" min="1" step="1" required value={draft.guestCount} onChange={(event) => update("guestCount", event.target.value)} className={inputClass} />
        <label htmlFor="arrival-edit-phone">WhatsApp mobile number {phoneRequired ? "*" : "(optional)"}</label>
        <input ref={phoneInput} id="arrival-edit-phone" type="tel" required={phoneRequired} value={draft.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} className={inputClass} />
        <label htmlFor="arrival-edit-email">Email address (optional)</label>
        <input ref={emailInput} id="arrival-edit-email" type="email" value={draft.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} className={inputClass} />
        {confirmReduction && <p role="alert" className="p-2.5 bg-orange-50 text-text-primary mb-3">
          Reducing the guest count removes ID details for the last {currentGuestCount - Number(draft.guestCount) === 1 ? "guest" : `${currentGuestCount - Number(draft.guestCount)} guests`}.{" "}
          <button type="button" className="min-h-[44px] underline" onClick={() => apply(true)}>Remove guest and apply</button>
        </p>}
        <button type="submit" className="min-h-[44px] rounded-lg px-3.5 py-2.5 bg-brand-primary text-white">Apply changes</button>{" "}
        <button type="button" className="min-h-[44px] underline" onClick={close}>Cancel</button>
      </form>}
      <p role="status">{status}</p>
    </section>
  );
}
