# UI Style Guide

Use the shared design tokens to keep contrast and hierarchy consistent across Atlas Homestays.

## Core tokens

| Token | Purpose | Default value |
| --- | --- | --- |
| `--bg-primary` | Page background | `#ede7c7` |
| `--bg-surface` | Cards and raised surfaces | `#fdfbf6` |
| `--bg-muted` | Soft section fills | `#e7dfc4` |
| `--text-primary` | Strong text | `#1b2533` |
| `--text-body` | Default body copy | `#243041` |
| `--text-muted` | Secondary text | `#3f4a5a` |
| `--text-contrast` | On-brand/dark backgrounds | `#ffffff` |
| `--brand` | Brand accents and strokes | `#2f4b86` |
| `--brand-ink` | Brand-aligned text | `#1f2f52` |
| `--brand-contrast` | Light brand surface | `#eef3ff` |
| `--border-subtle` / `--border-default` | Low-emphasis borders | `#dcd3b3` |
| `--shadow-soft` / `--shadow-strong` | Elevation shadows | Theme-defined |
| `--footer-bg` / `--footer-text` / `--footer-link` | Footer background and readable text colors | Theme-defined |
| `--color-bg` / `--color-surface` / `--color-surface-muted` | Aliases for default, raised, and muted surfaces | Mirrors the `--bg-*` tokens |

## Usage rules

- **Light backgrounds require dark text.** Prefer `--text-body` for normal copy and `--text-primary` for headings; avoid hard-coded grays.
- **Brand accents.** Use `--brand` for strokes/lines and `--brand-contrast` for chips or headers; pair with `--brand-ink` text.
- **Buttons and CTAs.** Keep `--text-contrast` on `--brand`, `--cta-primary`, or other dark fills.
- **Cards and surfaces.** Use `--bg-surface` with `--border-default` and `--shadow-soft` for raised cards.
- **Footer.** Always use `--footer-bg` with `--footer-text` for body copy and `--footer-link` plus `--footer-link-hover` for links.

Follow these tokens before adding new colors; update this guide when introducing additional theme values.
