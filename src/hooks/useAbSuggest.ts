/**
 * TASK-101733: React binding for GET /api/promo-codes/ab-suggest.
 * Idle until both a positive listingId and a non-blank groupTag are provided;
 * otherwise fetches once per (listingId, groupTag) pair. A server 404 (no active
 * codes in the group) resolves to `empty`, never an error — the caller renders
 * nothing in that case.
 */
import { useEffect, useState } from 'react';
import { fetchAbSuggest, type AbSuggestResult } from '@/api/promoAbClient';

export type AbSuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; suggestion: AbSuggestResult }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export function useAbSuggest(
  listingId: string | number | null | undefined,
  groupTag: string | null | undefined,
): AbSuggestState {
  const id = listingId != null && String(listingId).trim() !== '' ? Number(listingId) : NaN;
  const tag = groupTag?.trim() ?? '';
  const usable = Number.isFinite(id) && id > 0 && tag.length > 0;
  const key = usable ? `${id}|${tag}` : '';

  const [state, setState] = useState<AbSuggestState>({ status: 'idle' });

  useEffect(() => {
    if (!key) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      try {
        const suggestion = await fetchAbSuggest(id, tag, controller.signal);
        if (cancelled) return;
        setState(suggestion ? { status: 'ready', suggestion } : { status: 'empty' });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not load suggested offer.',
        });
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // key identity covers (id, tag); id/tag derived above from the raw args.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
