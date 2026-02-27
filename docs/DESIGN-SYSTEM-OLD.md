# OLD Design — Visual Identity & Implementation

Single source of truth: OLD screenshot (luxury pastel, calm, premium boutique).

---

## 1) Color tokens (from OLD)

| Token | Hex | Usage |
|-------|-----|--------|
| `primaryGradientStart` | `#fdeee9` | Hero top-left, warm peach |
| `primaryGradientEnd` | `#e8f7ff` | Hero bottom-right, light blue |
| `secondaryGradientStart` | `#f7eafc` | Amenities section |
| `secondaryGradientEnd` | `#fff4ea` | Amenities section end |
| `accent (CTA)` | `#ff7a59` | Primary buttons, links |
| `darkFooterStart` | `#071624` | Testimonials & footer top |
| `darkFooterEnd` | `#10243a` | Footer bottom |
| `textPrimary` | `#0f1724` | Headings, body |
| `textMuted` | `#6b7280` | Secondary text |
| `sectionHeadingMuted` | `#9b59b6` | Uppercase labels (e.g. "WHAT WE OFFER") |
| `amenityIcon` | `#c3b3e8` | Amenity card icons |

Defined in `src/styles/themes/luxury-pastel.css` and mapped to `--bg-primary`, `--cta-primary`, `--footer-bg`, etc.

---

## 2) Visual system

- **Tailwind:** Section gaps `py-section-gap` (40px), `md:py-section-gap-md` (64px), `lg:py-section-gap-lg` (96px). Radii `rounded-2xl` (16px), `rounded-[20px]` (20px). Shadows `var(--shadow-level-1|2|3)`.
- **Typography:** Serif = Cormorant Garamond (headings), Sans = DM Sans (body). H1 fluid `clamp(3.25rem, 8vw, 6rem)`, H2 `clamp(2rem, 5vw, 3.5rem)`, body 18px.
- **Spacing:** Section gap desktop 96px, tablet 64px, mobile 40px. Generous padding inside cards and between elements.

---

## 3) Section order & behavior

1. **HERO** — Headline (serif), subtext, two CTAs (primary coral, secondary outline). Right: floating booking card (glassmorphism, rounded 16–24px, soft shadow). Trust badges row under CTAs.
2. **TRUST STRIP** — Row with icons (Verified homes, Secure payments, No hidden fees).
3. **FEATURED ROOMS** — 2x2 responsive grid, image cards with bottom gradient overlay, title, short desc, price right, “View details”. Hover: lift -6px, scale 1.02, softer shadow.
4. **AMENITIES** — Pastel gradient background, 2x4 or 3x3 glass cards (icon + title + 1-line desc).
5. **GALLERY** — 3-column or masonry; hover zoom; lazy-load (existing Gallery page).
6. **TESTIMONIALS** — Full-width dark gradient section, white text, 3 cards (name, rating, quote).
7. **FOOTER** — Dark navy gradient, 4–5 column (brand, quick links, help, locate us), top divider, copyright.

---

## 4) Copyable snippets

### Tailwind theme.extend (excerpt)

```js
spacing: {
  'section-gap': 'var(--section-gap-mobile)',
  'section-gap-md': 'var(--section-gap-tablet)',
  'section-gap-lg': 'var(--section-gap-desktop)',
},
borderRadius: {
  xl: '1.25rem',
  '2xl': '1.5rem',
  card: 'var(--radius-card)',
  'card-lg': 'var(--radius-card-lg)',
},
```

### Hero + booking card (concept)

- Left: eyebrow pill, H1 serif “Indulge in an Unforgettable Stay”, subtext, primary CTA (coral), secondary CTA (outline).
- Right: wrapper `rounded-[20px] bg-white/95 shadow-[var(--shadow-level-3)] backdrop-blur-sm` around `SearchAvailabilityWidget`.

### Room card (concept)

- Container: `rounded-2xl overflow-hidden bg-bg-card shadow-level1 transition-all duration-[180ms] hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-level2`.
- Image: `aspect-[4/3] object-cover`, bottom overlay `bg-gradient-to-t from-black/40 to-transparent`.
- Body: title (serif), location, price right, “View details” link.

### Amenities card (concept)

- Section background: `linear-gradient(180deg, var(--secondary-gradient-start), var(--secondary-gradient-end))`.
- Card: `rounded-2xl bg-white/90 backdrop-blur-sm border border-white/80 p-8 shadow-level2 hover:-translate-y-1.5 hover:scale-[1.02]`.

### Footer (concept)

- Section: `background: linear-gradient(180deg, var(--dark-footer-start), var(--dark-footer-end))`, `text-[var(--footer-text)]`, 4–5 columns, `border-t border-white/10`.

---

## 5) Accessibility & responsive

- **Contrast:** `#0f1724` on `#fdeee9` ≈ 12:1 (pass). `#ff7a59` on white ≈ 4.5:1 (pass for large text). `#6b7280` on `#fdeee9` ≈ 4.6:1 (pass). Dark footer: white on `#071624` (pass).
- **Focus:** All buttons and links use `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` with accent color.
- **ARIA:** Hero has `aria-labelledby="hero-title"`. Booking form has `id="search-form"`. Testimonials section `aria-labelledby="testimonials-heading"`.
- **Breakpoints:** Desktop 1024px+, tablet 768px+, mobile &lt;768px. Hero stacks vertically on mobile; booking card full width; section gaps reduce on smaller screens.

---

## 6) Micro-interactions

- Button hover: `duration-[180ms]`, `hover:scale-[1.02]`, shadow fade.
- Card hover: `translateY(-6px)` (or `-translate-y-1.5`), `scale-[1.02]`, softer shadow.
- Use CSS `transform` and `opacity` only; avoid layout-triggering animations. Respect `prefers-reduced-motion` if added later.

---

## 7) Implementation priority

1. **Hero + booking card** — Pastel gradient, OLD copy, glass card wrapper, trust strip.
2. **Footer** — Dark navy gradient, 4-column, white text.
3. **Section gaps** — Apply `py-section-gap` / `md:py-section-gap-md` / `lg:py-section-gap-lg` to all main sections.
4. **Featured rooms** — 2x2 grid, hover lift, gradient overlay on image.
5. **Amenities** — Pastel gradient section, glass cards, icon + title + 1-line desc.
6. **Testimonials** — Dark gradient section, white text, 3 cards.
7. **Gallery** — 3-column, hover zoom, lazy-load (existing page).

Files touched: `src/styles/themes/luxury-pastel.css`, `tailwind.config.js`, `Slider.tsx`, `Footer.tsx`, `Home.tsx`, `ServicesSection.tsx`, `TestimonialsSection.tsx`, `theme.ts` (DEFAULT_THEME = "default").
