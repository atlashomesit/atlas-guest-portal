import type { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import "./ui.css";

type ElementTag = "input" | "textarea" | "select";
type InputState = "default" | "error" | "success" | "warning";

interface SharedProps {
  as?: ElementTag;
  fullWidth?: boolean;
  className?: string;
  state?: InputState;
  error?: string;
  helper?: string;
}

type NativeProps<T extends ElementTag> = T extends "textarea"
  ? TextareaHTMLAttributes<HTMLTextAreaElement>
  : T extends "select"
    ? SelectHTMLAttributes<HTMLSelectElement>
    : InputHTMLAttributes<HTMLInputElement>;

type InputProps<T extends ElementTag = "input"> = SharedProps & PropsWithChildren & NativeProps<T>;

function buildClassName(className?: string, fullWidth?: boolean, state?: InputState) {
  return [
    "rb-input",
    state && state !== "default" ? `rb-input--${state}` : null,
    fullWidth ? "w-full" : null,
    className
  ].filter(Boolean).join(" ");
}

export function Input<T extends ElementTag = "input">({
  as,
  fullWidth = true,
  className,
  children,
  state = "default",
  error,
  helper,
  "aria-invalid": ariaInvalid,
  ...rest
}: InputProps<T>) {
  const Component = (as || "input") as keyof JSX.IntrinsicElements;
  const isError = state === "error" || !!error;

  return (
    <div>
      <Component
        className={buildClassName(className, fullWidth, state)}
        aria-invalid={isError || ariaInvalid}
        aria-describedby={error ? "input-error" : helper ? "input-helper" : undefined}
        {...(rest as NativeProps<T>)}
      >
        {children}
      </Component>
      {error && (
        <p id="input-error" className="rb-input__error">
          {error}
        </p>
      )}
      {helper && !error && (
        <p id="input-helper" className="rb-input__helper">
          {helper}
        </p>
      )}
    </div>
  );
}
