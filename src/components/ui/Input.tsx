import { createElement, type InputHTMLAttributes, type PropsWithChildren, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import "./ui.css";

type ElementTag = "input" | "textarea" | "select";
type InputState = "default" | "error" | "success" | "warning";

interface SharedProps {
  fullWidth?: boolean;
  className?: string;
  state?: InputState;
  error?: string;
  helper?: string;
}

type InputProps =
  | (SharedProps & PropsWithChildren & InputHTMLAttributes<HTMLInputElement> & { as?: "input" })
  | (SharedProps & PropsWithChildren & TextareaHTMLAttributes<HTMLTextAreaElement> & { as: "textarea" })
  | (SharedProps & PropsWithChildren & SelectHTMLAttributes<HTMLSelectElement> & { as: "select" });

function buildClassName(className?: string, fullWidth?: boolean, state?: InputState) {
  return [
    "rb-input",
    state && state !== "default" ? `rb-input--${state}` : null,
    fullWidth ? "w-full" : null,
    className
  ].filter(Boolean).join(" ");
}

export function Input({
  as = "input",
  fullWidth = true,
  className,
  children,
  state = "default",
  error,
  helper,
  "aria-invalid": ariaInvalid,
  ...rest
}: InputProps) {
  const tag = as;
  const isError = state === "error" || !!error;

  return (
    <div>
      {createElement(
        tag,
        {
          className: buildClassName(className, fullWidth, state),
          "aria-invalid": isError || ariaInvalid,
          "aria-describedby": error ? "input-error" : helper ? "input-helper" : undefined,
          ...rest,
        },
        children,
      )}
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
