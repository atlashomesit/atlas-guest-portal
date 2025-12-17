import type { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import "./ui.css";
type ElementTag = "input" | "textarea" | "select";

interface SharedProps {
  as?: ElementTag;
  fullWidth?: boolean;
  className?: string;
}

type NativeProps<T extends ElementTag> = T extends "textarea"
  ? TextareaHTMLAttributes<HTMLTextAreaElement>
  : T extends "select"
    ? SelectHTMLAttributes<HTMLSelectElement>
    : InputHTMLAttributes<HTMLInputElement>;

type InputProps<T extends ElementTag = "input"> = SharedProps & PropsWithChildren & NativeProps<T>;

function buildClassName(className?: string, fullWidth?: boolean) {
  return ["rb-input", fullWidth ? "w-full" : null, className].filter(Boolean).join(" ");
}

export function Input<T extends ElementTag = "input">({ as, fullWidth = true, className, children, ...rest }: InputProps<T>) {
  const Component = (as || "input") as keyof JSX.IntrinsicElements;

  return (
    <Component className={buildClassName(className, fullWidth)} {...(rest as NativeProps<T>)}>
      {children}
    </Component>
  );
}
