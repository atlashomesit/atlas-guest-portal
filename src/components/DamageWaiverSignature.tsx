import { useEffect, useRef, useState } from "react";

export type SignatureMode = "typed" | "drawn";

interface Props {
  busy: boolean;
  onCancel: () => void;
  onSign: (payload: { signatureType: SignatureMode; typedName?: string; signatureBlob?: Blob }) => void;
}

/** TASK-1975: typed-name or canvas draw signature capture for damage waiver. */
export default function DamageWaiverSignature({ busy, onCancel, onSign }: Props) {
  const [mode, setMode] = useState<SignatureMode>("typed");
  const [typedName, setTypedName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [mode]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };

  const onPointerUp = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const submit = async () => {
    if (mode === "typed") {
      if (!typedName.trim()) return;
      onSign({ signatureType: "typed", typedName: typedName.trim() });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    onSign({ signatureType: "drawn", signatureBlob: blob });
  };

  const canSubmit = mode === "typed" ? typedName.trim().length > 1 : hasInk;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waiver-sign-title"
      data-testid="damage-waiver-signature-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-bg-surface border border-border-subtle p-5 shadow-level2">
        <h3 id="waiver-sign-title" className="text-lg font-bold text-text-primary mb-1">
          Sign damage waiver
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Type your full legal name or draw your signature.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-medium border ${
              mode === "typed" ? "bg-brand-primary text-white border-brand-primary" : "border-border-subtle text-text-secondary"
            }`}
            onClick={() => setMode("typed")}
            data-testid="waiver-mode-typed"
          >
            Type name
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-medium border ${
              mode === "drawn" ? "bg-brand-primary text-white border-brand-primary" : "border-border-subtle text-text-secondary"
            }`}
            onClick={() => setMode("drawn")}
            data-testid="waiver-mode-drawn"
          >
            Draw
          </button>
        </div>

        {mode === "typed" ? (
          <div className="mb-4">
            <label htmlFor="waiver-typed-name" className="block text-sm font-medium text-text-primary mb-1">
              Full legal name
            </label>
            <input
              id="waiver-typed-name"
              data-testid="waiver-typed-name"
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm italic focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="As on your government ID"
              style={{ fontFamily: "Segoe Script, Brush Script MT, cursive" }}
            />
          </div>
        ) : (
          <div className="mb-4">
            <canvas
              ref={canvasRef}
              width={640}
              height={220}
              className="w-full touch-none rounded-lg border border-border-subtle bg-white"
              data-testid="waiver-draw-canvas"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <button type="button" className="mt-2 text-xs text-text-muted underline" onClick={clearCanvas}>
              Clear signature
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-border-subtle py-3 text-sm font-medium text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !canSubmit}
            data-testid="waiver-sign-submit"
            className="flex-1 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Signing…" : "Sign & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
