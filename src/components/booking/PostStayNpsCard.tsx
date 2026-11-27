import React, { useState } from 'react';

export type NpsCategory = 'Detractor' | 'Passive' | 'Promoter';

export function classifyNpsScore(score: number): NpsCategory {
  if (score >= 9) return 'Promoter';
  if (score >= 7) return 'Passive';
  return 'Detractor';
}

export interface PostStayNpsCardProps {
  propertyName: string;
  onSubmit: (payload: { score: number; category: NpsCategory; comment: string }) => void;
}

export const PostStayNpsCard: React.FC<PostStayNpsCardProps> = ({
  propertyName,
  onSubmit,
}) => {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted && score !== null) {
    return (
      <div data-testid="post-stay-nps-submitted" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Thank you for rating {propertyName} ({score}/10).
      </div>
    );
  }

  return (
    <div data-testid="post-stay-nps-card" className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">
        How likely are you to recommend {propertyName} to a friend?
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="NPS Score 0 to 10">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            aria-pressed={score === n}
            onClick={() => setScore(n)}
            className={`h-8 w-8 rounded-lg border text-xs font-semibold ${
              score === n
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        aria-label="Optional stay feedback"
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share what stood out or could be better (optional)"
        className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-xs"
      />
      <button
        type="button"
        disabled={score === null}
        onClick={() => {
          if (score === null) return;
          onSubmit({ score, category: classifyNpsScore(score), comment: comment.trim() });
          setSubmitted(true);
        }}
        className="mt-2 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        Submit Rating
      </button>
    </div>
  );
};
