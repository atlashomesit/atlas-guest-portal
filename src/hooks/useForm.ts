import { useState, useCallback } from "react";

export interface FormField {
  value: string;
  error: string;
  touched: boolean;
}

export interface FormState {
  [key: string]: FormField;
}

export type ValidationFn = (value: string) => string | undefined;

export const useForm = (
  onSubmit: (values: Record<string, string>) => Promise<void>,
  validators?: Record<string, ValidationFn>
) => {
  const [formState, setFormState] = useState<FormState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setFieldValue = useCallback((fieldName: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value,
        error: validators?.[fieldName]?.(value) || "",
      },
    }));
  }, [validators]);

  const setFieldTouched = useCallback((fieldName: string, touched: boolean) => {
    setFormState((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        touched,
      },
    }));
  }, []);

  const validateForm = useCallback((): boolean => {
    let isValid = true;
    const newState = { ...formState };

    Object.keys(validators || {}).forEach((fieldName) => {
      const error = validators![fieldName](formState[fieldName]?.value || "");
      if (error) {
        isValid = false;
        newState[fieldName] = {
          ...newState[fieldName],
          error,
          touched: true,
        };
      }
    });

    setFormState(newState);
    return isValid;
  }, [formState, validators]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      try {
        const values = Object.keys(formState).reduce(
          (acc, key) => ({
            ...acc,
            [key]: formState[key].value,
          }),
          {}
        );
        await onSubmit(values);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [formState, validateForm, onSubmit]
  );

  const resetForm = useCallback(() => {
    setFormState({});
    setSubmitError(null);
    setIsSubmitting(false);
  }, []);

  return {
    formState,
    setFieldValue,
    setFieldTouched,
    handleSubmit,
    resetForm,
    isSubmitting,
    submitError,
  };
};

export default useForm;
