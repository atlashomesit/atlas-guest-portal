import React, { useState } from 'react';

export interface RentalAgreementSignatureRecord {
  signedBy: string;
  signedAtIso: string;
  agreementVersion: string;
}

export interface RentalAgreementGateCardProps {
  villaName: string;
  agreementVersion?: string;
  clauses: string[];
  existingSignature?: RentalAgreementSignatureRecord | null;
  onSign: (record: RentalAgreementSignatureRecord) => void | Promise<void>;
  children?: React.ReactNode;
}

export const RentalAgreementGateCard: React.FC<RentalAgreementGateCardProps> = ({
  villaName,
  agreementVersion = 'v1.0',
  clauses,
  existingSignature = null,
  onSign,
  children,
}) => {
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<RentalAgreementSignatureRecord | null>(existingSignature);
  const [submitting, setSubmitting] = useState(false);

  if (signature) {
    return (
      <div data-testid="rental-agreement-unlocked" className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Rental agreement ({signature.agreementVersion}) signed by{' '}
          <span className="font-semibold">{signature.signedBy}</span>
        </div>
        {children}
      </div>
    );
  }

  const canSubmit = signerName.trim().length >= 2 && agreed && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const record: RentalAgreementSignatureRecord = {
        signedBy: signerName.trim(),
        signedAtIso: new Date().toISOString(),
        agreementVersion,
      };
      await onSign(record);
      setSignature(record);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="rental-agreement-gate"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 className="text-base font-semibold text-slate-900">
        Sign {villaName} Rental Agreement to unlock check-in instructions
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        Door access codes and check-in details are revealed immediately after signing.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-700">
        {clauses.map((clause, idx) => (
          <li key={idx}>{clause}</li>
        ))}
      </ul>
      <label className="mt-3 flex items-start gap-2 text-xs text-slate-800">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>I have read and agree to the villa rental terms ({agreementVersion}).</span>
      </label>
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700" htmlFor="rental-signer-name">
          Full legal name (e-signature)
        </label>
        <input
          id="rental-signer-name"
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Type your full name"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Signing...' : 'Sign & Unlock Check-in Instructions'}
      </button>
    </form>
  );
};
