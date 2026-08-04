import { useCallback, useMemo, useState } from 'react';

/**
 * TASK-7195: four explicit resource states — never collapse `error` into `empty`.
 * Use at fetch-driven surfaces so a failed load cannot be mistaken for "nothing here".
 */
export type ResourceState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'success'; data: T };

export type UseResourceState<T> = {
  state: ResourceState<T>;
  setIdle: () => void;
  setLoading: () => void;
  setError: (message: string) => void;
  setEmpty: () => void;
  setSuccess: (data: T) => void;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  isSuccess: boolean;
  data: T | undefined;
  errorMessage: string | null;
};

export function useResourceState<T>(initial: ResourceState<T> = { status: 'idle' }): UseResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>(initial);

  const setIdle = useCallback(() => setState({ status: 'idle' }), []);
  const setLoading = useCallback(() => setState({ status: 'loading' }), []);
  const setError = useCallback((message: string) => setState({ status: 'error', message }), []);
  const setEmpty = useCallback(() => setState({ status: 'empty' }), []);
  const setSuccess = useCallback((data: T) => setState({ status: 'success', data }), []);

  return useMemo(
    () => ({
      state,
      setIdle,
      setLoading,
      setError,
      setEmpty,
      setSuccess,
      isLoading: state.status === 'loading',
      isError: state.status === 'error',
      isEmpty: state.status === 'empty',
      isSuccess: state.status === 'success',
      data: state.status === 'success' ? state.data : undefined,
      errorMessage: state.status === 'error' ? state.message : null,
    }),
    [state, setIdle, setLoading, setError, setEmpty, setSuccess],
  );
}
