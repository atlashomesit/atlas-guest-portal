import { createElement, type HTMLAttributes, type PropsWithChildren } from "react";
import "./ui.css";

type TypographyVariant = "h1" | "h2" | "h3" | "subtitle" | "body" | "muted";

type AllowedElements =
  | HTMLHeadingElement
  | HTMLParagraphElement
  | HTMLSpanElement
  | HTMLLabelElement
  | HTMLDivElement;

type TagName = "h1" | "h2" | "h3" | "p" | "span" | "label" | "div";

interface TypographyProps<T extends TagName> extends HTMLAttributes<AllowedElements>, PropsWithChildren {
  as?: T;
  variant?: TypographyVariant;
}

export function Typography<T extends TagName = "p">({ as, variant = "body", className, children, ...rest }: TypographyProps<T>) {
  const variantTagMap: Record<TypographyVariant, TagName> = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    subtitle: "p",
    body: "p",
    muted: "span",
  };
  const tag = (as || variantTagMap[variant]) as TagName;
  const classes = ["rb-typography", `rb-typography--${variant}`, className].filter(Boolean).join(" ");

  return createElement(tag, { className: classes, ...rest }, children);
}
