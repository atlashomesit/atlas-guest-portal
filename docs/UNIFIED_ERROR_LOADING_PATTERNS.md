# Unified Error and Loading Patterns

## Overview

This document specifies the unified error and loading patterns for both the **Guest Portal** (customer-facing) and **Owner Portal** (property manager-facing). Both portals share a common design language, theming system, and component library built on Tailwind CSS with CSS custom properties for brand customization.

---

## Error Patterns

### 1. Error Types

The system categorizes all errors into **4 distinct types** for consistent user communication:

| Error Type | Severity | Cause | Example | Recovery |
|-----------|----------|-------|---------|----------|
| **Validation** | Medium | User input doesn't meet requirements | Invalid email, missing fields, date in past | Highlight field, show inline help, retry |
| **Network** | High | Connectivity or server timeout issues | No internet, API timeout, CORS failure | Offline indicator, retry button, queue for later |
| **Permission** | Medium | User lacks access to resource | Unauthorized booking, property not shared | Contact support, sign in, request access |
| **Unknown** | Critical | Unexpected server error or crash | 5xx, unhandled exception, data corruption | Full-page error screen, contact support, reload |

### 2. Error Display Components

#### Component: `ErrorBanner`
**Usage:** Dismissible alerts for non-fatal errors within a page context (inline form errors, rate limits, temporary API issues).

**Location:** `src/components/ErrorBanner.tsx`

**Props:**
```typescript
interface ErrorBannerProps {
  message: string;           // User-facing message, max 2 sentences
  severity: "error" | "warning" | "info";  // Visual treatment
  onRetry?: () => void;      // Callback for retry action
  onDismiss?: () => void;    // Callback to close banner
  className?: string;        // Additional tailwind classes
}
```

**Visual Spec:**
- **Icon:** Semantic icon (⚠️ error, ⚡ warning, ℹ️ info)
- **Color scheme:** Uses CSS custom properties for themeable colors
  - Error: `--support-error` (10% opacity on `--bg-surface`)
  - Warning: `--support-warning` (10% opacity on `--bg-surface`)
  - Info: `--accent-primary` (10% opacity on `--bg-surface`)
- **Border:** `border-border-strong` for error, `border-border-subtle` for warning/info
- **Layout:** Flex row with icon, message, and action buttons right-aligned
- **Dismiss:** ✕ button or explicit close action
- **Animation:** None (static banner)

**CSS Classes:**
```css
.error-banner {
  @apply rounded-xl border px-4 py-3 text-sm flex items-start gap-3;
}
.error-banner__icon {
  @apply flex-shrink-0 text-lg;
}
.error-banner__content {
  @apply flex-1;
}
.error-banner__actions {
  @apply flex-shrink-0 flex gap-2 ml-4;
}
```

**Usage Example:**
```tsx
<ErrorBanner
  message="Your payment was declined. Try another card or contact support."
  severity="error"
  onRetry={() => handlePaymentRetry()}
  onDismiss={() => dismissBanner()}
/>
```

#### Component: `ErrorDisplay`
**Usage:** Structured error details with recovery action buttons. Used in forms, booking widgets, and payment flows.

**Location:** `src/components/ErrorDisplay.tsx`

**Props:**
```typescript
interface ErrorDisplay {
  error: {
    code: string;                      // e.g., "PAYMENT_DECLINED"
    message: string;                   // e.g., "We couldn't process your payment"
    details?: string;                  // Additional context (optional)
    recoveryActions?: RecoveryAction[]; // Array of actionable next steps
  };
  onActionClick?: (action: RecoveryAction) => void;
}

type RecoveryAction = {
  actionType: "RETRY_PAYMENT" | "SEARCH_AGAIN" | "CONTACT_SUPPORT" | "CHECK_EMAIL" | "GO_BACK";
  actionLabel: string;                 // e.g., "Retry Payment"
  actionUrl?: string;                  // For external/navigation links
  delaySeconds?: number;               // Countdown timer (e.g., cooldown)
};
```

**Visual Spec:**
- **Background:** `bg-red-50` border `border-red-200` (customizable via CSS vars)
- **Text hierarchy:**
  - Code (uppercase, small, muted): `text-xs font-semibold uppercase text-red-700`
  - Message (primary): `text-sm font-medium text-red-800`
  - Details (secondary): `text-xs text-red-700/80`
- **Action buttons:** Secondary style with border, hover fill effect
- **Layout:** Vertical stack: code → message → details → buttons

**CSS Classes:**
```css
.error-display {
  @apply rounded-xl border border-red-200 bg-red-50 p-4 space-y-3;
}
.error-display__code {
  @apply text-xs font-semibold uppercase tracking-wide text-red-700;
}
.error-display__message {
  @apply text-sm font-medium text-red-800;
}
.error-display__details {
  @apply text-xs text-red-700/80;
}
.error-display__actions {
  @apply flex flex-wrap gap-2;
}
.error-display__action-button {
  @apply inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors;
}
```

**Usage Example:**
```tsx
<ErrorDisplay
  error={{
    code: "PAYMENT_DECLINED",
    message: "We couldn't process your payment",
    details: "Your card was declined by the issuer",
    recoveryActions: [
      { actionType: "RETRY_PAYMENT", actionLabel: "Try Again" },
      { actionType: "CONTACT_SUPPORT", actionLabel: "Contact Support", actionUrl: "/support" }
    ]
  }}
  onActionClick={(action) => handleRecovery(action)}
/>
```

#### Component: `StateMessage`
**Usage:** Empty states, not-found pages, permission denied. Centered, full-height layout with icon, headline, message, and primary + secondary actions.

**Location:** `src/components/StateMessage.tsx`

**Props:**
```typescript
interface StateMessage {
  icon?: React.ReactNode;              // Emoji or SVG icon (no illustration library)
  title: string;                       // Headline (max 2 words)
  message?: string;                    // Supporting text (1-2 sentences)
  primaryAction?: StateAction;         // Most prominent recovery action
  secondaryActions?: StateAction[];    // Quiet alternatives
  "data-testid"?: string;
}

type StateAction = {
  label: string;
  to?: string;                         // react-router Link target
  href?: string;                       // External/mailto link
  onClick?: () => void;
  variant?: "primary" | "secondary";
};
```

**Visual Spec:**
- **Layout:** Centered, min 50vh height
- **Icon:** 5xl text emoji or SVG (no library illustrations)
- **Title:** `text-xl font-bold text-text-primary`
- **Message:** `text-sm text-text-secondary`
- **Primary button:** Solid brand color, no border
- **Secondary buttons:** Border with transparent fill
- **Responsive:** Stacks vertically on mobile, flexes on tablet+

**CSS Classes:**
```css
.state-message {
  @apply min-h-[50vh] flex items-center justify-center px-4 py-12;
}
.state-message__container {
  @apply max-w-md w-full text-center space-y-4;
}
.state-message__icon {
  @apply text-5xl leading-none;
}
.state-message__title {
  @apply text-xl font-bold text-text-primary;
}
.state-message__message {
  @apply text-sm text-text-secondary leading-relaxed;
}
.state-message__actions {
  @apply flex flex-col sm:flex-row gap-3 justify-center items-stretch pt-1;
}
.state-message__action {
  @apply inline-flex items-center justify-center rounded-xl px-4 py-3 text-base font-medium transition-colors;
}
.state-message__action--primary {
  @apply bg-brand-primary text-white hover:opacity-95;
}
.state-message__action--secondary {
  @apply border border-border-subtle bg-bg-surface text-text-primary hover:bg-bg-muted;
}
```

**Usage Example:**
```tsx
<StateMessage
  icon="🔒"
  title="Access Denied"
  message="This property listing is not shared with you. Contact the owner to request access."
  primaryAction={{ label: "Browse Other Listings", to: "/search" }}
  secondaryActions={[
    { label: "Contact Support", href: "mailto:support@atlas.com" }
  ]}
/>
```

#### Component: `ErrorLayout`
**Usage:** Full-page errors (caught by error boundary, runtime config failures, catastrophic state).

**Location:** `src/components/ErrorLayout.tsx`

**Props:**
```typescript
interface ErrorLayout {
  title: string;                       // e.g., "We couldn't load this page"
  description: string;                 // e.g., "Something unexpected happened. Try again or go home."
  primaryAction?: ErrorLayoutAction;
  secondaryAction?: ErrorLayoutAction;
  children?: React.ReactNode;          // For additional content (error details, support form)
}

interface ErrorLayoutAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}
```

**Visual Spec:**
- **Background:** `bg-bg-muted`
- **Layout:** Centered, full min-height screen
- **Max-width:** 2xl container
- **Typography:**
  - Tenant name: `text-sm font-semibold uppercase tracking-wide text-primary`
  - Title: `text-3xl font-bold sm:text-4xl text-text-primary`
  - Description: `text-base sm:text-lg text-text-muted`
- **Actions:** Two-button row, center-aligned, wrap on mobile

**CSS Classes:**
```css
.error-layout {
  @apply min-h-screen flex flex-col items-center justify-center bg-bg-muted text-center p-6 gap-4;
}
.error-layout__container {
  @apply max-w-2xl space-y-4;
}
.error-layout__header {
  @apply space-y-2;
}
.error-layout__tenant {
  @apply text-sm font-semibold uppercase tracking-wide text-primary;
}
.error-layout__title {
  @apply text-3xl font-bold text-text-primary sm:text-4xl;
}
.error-layout__description {
  @apply text-text-muted text-base sm:text-lg;
}
.error-layout__actions {
  @apply flex gap-3 flex-wrap justify-center;
}
```

**Usage Example:**
```tsx
<ErrorLayout
  title="Configuration Error"
  description="The API base URL is not configured. Contact your administrator."
  primaryAction={{ label: "Try Again", onClick: handleReload }}
  secondaryAction={{ label: "Go Home", href: "/" }}
/>
```

#### Component: `ErrorBoundary`
**Usage:** Catches unhandled React errors anywhere in the component tree. Automatically reports to monitoring system (Sentry, etc.).

**Location:** `src/components/ErrorBoundary.tsx`

**Behavior:**
- Catches errors during rendering, lifecycle methods, and event handlers
- Logs to monitoring system with boundary name, route, and component context
- Renders full-page error fallback to user
- Provides "Try Again" (reload) and "Back to Home" actions
- Never shows stack traces to user

**Integration:**
```tsx
<ErrorBoundary name="PaymentFlow">
  <PaymentWidget />
</ErrorBoundary>
```

### 3. Messaging Tone & Copy Strategy

**Principles:**
- **Clear and specific:** Avoid technical jargon, error codes, HTTP status numbers (except in support emails)
- **Actionable:** Every error message includes at least one recovery action
- **Empathetic:** Acknowledge the issue and reassure the user
- **Hinglish-friendly:** Write for multilingual users; plain English with short sentences

**Error Mapping Examples:**

| Scenario | Message | Actions |
|----------|---------|---------|
| Validation (missing field) | "Phone number is required. Please enter 10 digits." | Fix input, retry |
| Network timeout | "We couldn't reach the server. Check your connection and try again." | Retry, offline queue |
| 404 Not Found | "This listing is no longer available." | Browse similar, go home |
| 403 Forbidden | "You don't have access to this property. Contact the owner for permission." | Contact owner, browse other |
| 429 Too Many Requests | "Too many requests. Please wait a moment before trying again." | Countdown timer + retry |
| 5xx Server Error | "Our servers are having trouble. Try again in a few minutes or contact support." | Retry, contact support |
| Payment declined | "Your card was declined. Try another payment method or contact your bank." | Retry, change payment, support |
| Offline | "You're offline. Some features may not work. Check your connection." | Dismiss, offline indicator |

**Razorpay-specific errors:** See `src/utils/razorpayGuestErrors.ts` for payment error mapping.

### 4. Recovery Actions

Each error should provide **at least one** clear recovery path:

| Action Type | Label | Handler | Example |
|------------|-------|---------|---------|
| `RETRY` | "Try Again" | Re-execute failed operation | Reload page, retry form submission |
| `SEARCH_AGAIN` | "Search Again" | Navigate to search with cleared filters | After no results found |
| `RETRY_PAYMENT` | "Retry Payment" | Restart payment flow | After payment decline |
| `CONTACT_SUPPORT` | "Contact Support" | Open support drawer or mailto | For unresolvable errors |
| `CHECK_EMAIL` | "Check Your Email" | Navigate to email inbox or show inbox message | After booking confirmation |
| `GO_BACK` | "Go Back" | History.back() or navigate parent | After failed action |

**Delay/Cooldown:** Recovery actions can include a `delaySeconds` property for rate-limit scenarios:
```typescript
{
  actionType: "RETRY_PAYMENT",
  actionLabel: "Retry Payment",
  delaySeconds: 30  // Button displays as "Retry Payment (30s)" and updates countdown
}
```

---

## Loading Patterns

### 1. Loading States

The system uses **4 distinct loading patterns** for different contexts:

| Pattern | Usage | Duration | Animation |
|---------|-------|----------|-----------|
| **Skeleton cards** | List/grid views (search results, listings) | 2-8s (page load) | Staggered pulse |
| **Inline spinners** | Form submissions, inline actions | <2s (button action) | Continuous spin |
| **Full-screen loader** | Page transitions, critical data fetch | 1-5s (navigation) | Centered spinner |
| **Staggered skeletons** | Multiple items loading sequentially | Varies (progressive load) | Cascading pulse |

### 2. Component: `LoadingState`
**Usage:** Unified loading component that renders the appropriate skeleton or spinner based on context.

**Location:** `src/components/LoadingState.tsx`

**Props:**
```typescript
interface LoadingStateProps {
  kind: "skeleton-card" | "skeleton-grid" | "skeleton-list" | "skeleton-table" | "skeleton-form" | "spinner";
  count?: number;           // Number of skeleton items (default 6)
  rows?: number;            // Number of rows for table skeleton (default 6)
  message?: string;         // Accessible message for screen readers
}
```

### 3. Skeleton Patterns

#### Pattern: `skeleton-card`
**Usage:** Grid of property cards (search results, city listings, recently viewed).

**Structure:**
```
┌─────────────────────────┐
│ [Image placeholder]     │
├─────────────────────────┤
│ [Title] [Badge]         │
│ [Location]              │
│                         │
│ [Price]         [Button]│
└─────────────────────────┘
```

**Component:** `SkeletonCard` (individual), rendered in grid

**Animation:** Staggered pulse — each skeleton delays by 100ms for cascading effect

**CSS:**
```css
.skeleton-card {
  @apply flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface;
}
.skeleton-card__image {
  @apply h-48 w-full bg-bg-muted animate-pulse;
}
.skeleton-card__content {
  @apply flex flex-1 flex-col gap-3 p-5;
}
.skeleton-card__line {
  @apply bg-bg-muted rounded animate-pulse;
}
```

**Usage:**
```tsx
<LoadingState kind="skeleton-card" count={6} />
```

**Stagger Animation (CSS):**
```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.skeleton-card:nth-child(1) { animation-delay: 0ms; }
.skeleton-card:nth-child(2) { animation-delay: 100ms; }
.skeleton-card:nth-child(3) { animation-delay: 200ms; }
.skeleton-card:nth-child(4) { animation-delay: 300ms; }
.skeleton-card:nth-child(5) { animation-delay: 400ms; }
.skeleton-card:nth-child(6) { animation-delay: 500ms; }
```

#### Pattern: `skeleton-grid`
**Usage:** Smaller item grid (amenities, image gallery, feature grid).

**Structure:** Compact 4-column grid
```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ [Im] │ │ [Im] │ │ [Im] │ │ [Im] │
│ [Tx] │ │ [Tx] │ │ [Tx] │ │ [Tx] │
└──────┘ └──────┘ └──────┘ └──────┘
```

**CSS:**
```css
.skeleton-grid {
  @apply grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4;
}
.skeleton-grid__item {
  @apply rounded-lg overflow-hidden;
}
```

#### Pattern: `skeleton-list`
**Usage:** Vertical list items (bookings, transactions, notifications).

**Structure:**
```
┌─────────────────────────────────┐
│ [Thumb] [Line 1]                │
│         [Line 2]                │
│         [Line 3]                │
├─────────────────────────────────┤
│ [Thumb] [Line 1]                │
│         [Line 2]                │
└─────────────────────────────────┘
```

**CSS:**
```css
.skeleton-list {
  @apply space-y-3;
}
.skeleton-list__item {
  @apply flex gap-4 p-4 border border-border-subtle rounded-lg;
}
.skeleton-list__thumbnail {
  @apply w-20 h-20 bg-bg-muted rounded animate-pulse flex-shrink-0;
}
.skeleton-list__content {
  @apply flex-1 space-y-2;
}
```

#### Pattern: `skeleton-table`
**Usage:** Data tables (owner bookings, transaction history, analytics).

**Structure:**
```
┌──────────┬──────────┬──────────┬──────────┐
│ Header 1 │ Header 2 │ Header 3 │ Header 4 │
├──────────┼──────────┼──────────┼──────────┤
│ [cell]   │ [cell]   │ [cell]   │ [cell]   │
│ [cell]   │ [cell]   │ [cell]   │ [cell]   │
└──────────┴──────────┴──────────┴──────────┘
```

**CSS:**
```css
.skeleton-table {
  @apply overflow-hidden rounded-lg border border-border-subtle;
}
.skeleton-table__header {
  @apply bg-bg-muted p-4 flex gap-4;
}
.skeleton-table__row {
  @apply p-4 flex gap-4 border-b border-border-subtle last:border-b-0;
}
.skeleton-table__cell {
  @apply h-4 bg-bg-muted rounded animate-pulse;
}
```

#### Pattern: `skeleton-form`
**Usage:** Form loading state (checkout, profile edit, property creation).

**Structure:**
```
[Label]
[Input field placeholder]

[Label]
[Input field placeholder]

[Label]
[Input field placeholder]

[Cancel Button] [Submit Button]
```

**CSS:**
```css
.skeleton-form {
  @apply space-y-6;
}
.skeleton-form__field {
  @apply space-y-2;
}
.skeleton-form__label {
  @apply h-4 w-32 bg-bg-muted rounded animate-pulse;
}
.skeleton-form__input {
  @apply h-10 w-full bg-bg-muted rounded animate-pulse;
}
.skeleton-form__buttons {
  @apply flex gap-3;
}
.skeleton-form__button {
  @apply h-10 w-32 bg-bg-muted rounded animate-pulse;
}
```

### 4. Spinner Pattern
**Usage:** Inline loading for buttons, small form sections, quick operations.

**Structure:**
```
      ◌ ← animated rotation
```

**CSS:**
```css
.spinner {
  @apply flex items-center justify-center min-h-48;
}
.spinner__icon {
  @apply w-12 h-12 border-4 border-border-subtle border-t-cta-primary rounded-full animate-spin;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Variations:**
- **Button inline spinner:** `w-4 h-4` inside button text
- **Page spinner:** `w-12 h-12` centered on page
- **Form spinner:** `w-6 h-6` next to submit button

### 5. CSS Animations

#### Animation: `animate-pulse` (Skeleton)
**Library:** Tailwind built-in
**Keyframes:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```
**Duration:** 2s
**Timing:** ease-in-out
**Iteration:** infinite

#### Animation: `animate-spin` (Spinner)
**Library:** Tailwind built-in
**Keyframes:**
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```
**Duration:** 1s
**Timing:** linear
**Iteration:** infinite

#### Animation: `stagger-pulse` (Cascading Skeletons) — Custom
**Purpose:** Skeleton cards pulse in sequence for visual interest and perceived progressive loading.

**CSS:**
```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.skeleton-card {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

/* Stagger children by 100ms increments */
.skeleton-list > :nth-child(1) { animation-delay: 0ms; }
.skeleton-list > :nth-child(2) { animation-delay: 100ms; }
.skeleton-list > :nth-child(3) { animation-delay: 200ms; }
.skeleton-list > :nth-child(4) { animation-delay: 300ms; }
.skeleton-list > :nth-child(5) { animation-delay: 400ms; }
.skeleton-list > :nth-child(6) { animation-delay: 500ms; }
```

**Implementation:** Add to `src/styles/theme.ts` or global CSS:
```typescript
export const extendedTheme = {
  animation: {
    'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
  },
  keyframes: {
    'skeleton-pulse': {
      '0%, 100%': { opacity: '0.6' },
      '50%': { opacity: '1' },
    },
  },
};
```

### 6. Loading Placement & Timing

| Context | Pattern | Placement | Duration | Fallback |
|---------|---------|-----------|----------|----------|
| Page load | Skeleton cards | Full viewport | 2-5s | Keep showing, refresh prompt at 10s |
| Form submission | Inline spinner | Next to button | <2s | "Still working..." message at 3s |
| List fetch | Skeleton list | Replace list | 1-3s | Show previous data with "loading" indicator |
| Image load | Skeleton grid item | Placeholder area | <1s | Show fallback gradient, lazy-load final image |
| Modal open | Full-screen spinner | Center modal | <1s | Show error message if timeout |
| Page transition | Full-screen spinner | Center screen | <1s | Show destination page anyway (optimistic) |

### 7. Skeleton vs. Real Content — Transition

**Smooth transition (no flash):**
1. Show skeleton while fetching
2. On successful fetch, replace skeleton with real content (opacity fade or immediate)
3. No layout shift (skeleton dimensions match real content)

**Abort handling (user navigates away):**
1. Cancel fetch request immediately (AbortController)
2. Remove spinner/skeleton from DOM
3. Don't show fallback/error

---

## Implementation Guidelines

### File Structure
```
src/
├── components/
│   ├── ErrorBanner.tsx          # Dismissible inline alerts
│   ├── ErrorBoundary.tsx        # Global error catcher
│   ├── ErrorDisplay.tsx         # Structured error with actions
│   ├── ErrorLayout.tsx          # Full-page error screen
│   ├── LoadingState.tsx         # Skeleton & spinner factory
│   ├── StateMessage.tsx         # Empty state / not found
│   ├── apartments/
│   │   └── SkeletonCard.tsx     # Reusable card skeleton
│   └── ui/
│       └── Button.tsx           # Action button styling
├── lib/
│   ├── monitoring.ts            # Error reporting (Sentry)
│   └── http.ts                  # API error handling
├── utils/
│   ├── razorpayGuestErrors.ts   # Payment-specific errors
│   ├── serverErrorFromResponse.ts # Response → message mapping
│   └── errors.ts                # [NEW] Centralized error builders
└── styles/
    └── animations.css           # [NEW] Custom animations
```

### New Files to Create

#### `src/utils/errors.ts` — Error Builder Utilities
```typescript
/**
 * Centralized error message builders for consistency across portals.
 * Maps API errors, network errors, and validation errors to user-friendly messages.
 */

export type ErrorCode = 
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR";

export interface UserError {
  code: ErrorCode;
  message: string;
  details?: string;
  recoveryActions: RecoveryAction[];
}

export function buildValidationError(fieldName: string, reason: string): UserError {
  return {
    code: "VALIDATION_ERROR",
    message: `${fieldName} is invalid.`,
    details: reason,
    recoveryActions: [
      { actionType: "RETRY", actionLabel: "Fix and Retry" }
    ]
  };
}

export function buildNetworkError(): UserError {
  return {
    code: "NETWORK_ERROR",
    message: "We couldn't reach the server.",
    details: "Check your internet connection and try again.",
    recoveryActions: [
      { actionType: "RETRY", actionLabel: "Try Again" },
      { actionType: "CONTACT_SUPPORT", actionLabel: "Contact Support", actionUrl: "/support" }
    ]
  };
}

export function buildPermissionError(): UserError {
  return {
    code: "PERMISSION_DENIED",
    message: "You don't have access to this resource.",
    recoveryActions: [
      { actionType: "CONTACT_SUPPORT", actionLabel: "Request Access", actionUrl: "/support" }
    ]
  };
}

export function buildServerError(status: number, contactEmail: string): UserError {
  return {
    code: "SERVER_ERROR",
    message: `Server error (${status}). Try again or contact support.`,
    recoveryActions: [
      { actionType: "RETRY", actionLabel: "Try Again" },
      { actionType: "CONTACT_SUPPORT", actionLabel: `Email ${contactEmail}`, actionUrl: `mailto:${contactEmail}` }
    ]
  };
}
```

#### `src/styles/animations.css` — Custom Animations
```css
/* Skeleton cascade animation */
@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.animate-skeleton-pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

/* Stagger offsets for cascading effect */
.skeleton-stagger-1 { animation-delay: 0ms; }
.skeleton-stagger-2 { animation-delay: 100ms; }
.skeleton-stagger-3 { animation-delay: 200ms; }
.skeleton-stagger-4 { animation-delay: 300ms; }
.skeleton-stagger-5 { animation-delay: 400ms; }
.skeleton-stagger-6 { animation-delay: 500ms; }
```

### Tailwind Configuration Update
```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
};
```

### Integration Checklist

**Phase 1: Core Components (Week 1)**
- [ ] Verify `ErrorBanner`, `ErrorDisplay`, `StateMessage`, `ErrorLayout` components exist and are properly exported
- [ ] Create `src/utils/errors.ts` with error builders
- [ ] Add custom animations to Tailwind config
- [ ] Create `src/styles/animations.css` with stagger classes

**Phase 2: API Integration (Week 2)**
- [ ] Update `src/api/client.ts` to use error builders for API failures
- [ ] Update `src/utils/serverErrorFromResponse.ts` to map responses to `UserError` types
- [ ] Update payment error handling to use centralized builders

**Phase 3: Usage in Portals (Week 3)**
- [ ] Guest Portal: Integrate errors in search, booking, payment flows
- [ ] Owner Portal: Integrate errors in property management, booking management flows
- [ ] Test all 4 error types in multiple contexts

**Phase 4: Testing & Polish (Week 4)**
- [ ] Add unit tests for error builders
- [ ] Test skeleton animations on mobile (stagger timing)
- [ ] Verify a11y (screen readers, keyboard nav)
- [ ] Performance audit (no jank on low-end devices)

---

## Accessibility (a11y)

### Error Components
- **ErrorBanner:** `role="alert"`, screen reader announcement
- **ErrorDisplay:** Semantic heading structure, icon has `aria-hidden="true"`
- **StateMessage:** `aria-hidden` on decorative icon, semantic `<h1>` for title
- **ErrorLayout:** Full page error gets `role="main"`, title is `<h1>`

### Loading Components
- **Skeleton:** `aria-hidden="true"` (never announced), parent has `role="status" aria-live="polite"`
- **Spinner:** `aria-busy="true"`, `<span class="sr-only">` with loading message
- **LoadingState:** Parent div has `role="status" aria-live="polite" aria-busy="true"`

**Example:**
```tsx
<div role="status" aria-live="polite" aria-busy="true">
  <span className="sr-only">Loading listings...</span>
  <LoadingState kind="skeleton-card" count={6} />
</div>
```

### Keyboard Navigation
- All action buttons are keyboard accessible (Tab, Space/Enter to activate)
- Error modals can be dismissed with Escape key
- Links styled as buttons are actual `<a>` or `<button>` elements
- No keyboard traps (focus always escapes from error modals)

### Color & Contrast
- Error colors meet WCAG AA contrast (4.5:1 for text)
- Don't rely on color alone — use icons + text
- Red (#d32f2f) + white text passes contrast check

---

## Testing Strategy

### Unit Tests
```typescript
// ErrorDisplay.test.tsx
describe("ErrorDisplay", () => {
  test("renders error code, message, and details", () => {
    render(<ErrorDisplay error={errorMock} />);
    expect(screen.getByText("PAYMENT_DECLINED")).toBeInTheDocument();
    expect(screen.getByText("We couldn't process your payment")).toBeInTheDocument();
  });

  test("renders recovery action buttons with onClick callbacks", () => {
    render(<ErrorDisplay error={errorMock} onActionClick={mockHandler} />);
    fireEvent.click(screen.getByText("Retry Payment"));
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

### Integration Tests
```typescript
// BookingFlow.test.tsx
describe("Booking flow error handling", () => {
  test("shows validation error on missing field and allows retry", async () => {
    render(<BookingForm />);
    fireEvent.click(screen.getByText("Book Now"));
    expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
    
    fireEvent.change(screen.getByPlaceholderText(/phone/i), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByText("Try Again"));
    // Form submission continues
  });
});
```

### Visual Tests
- Verify skeleton animations are smooth (no jank)
- Test dark/light theme colors are applied
- Check responsive breakpoints (mobile, tablet, desktop)
- Verify icons scale appropriately

### Performance Tests
- Skeleton render time < 100ms
- Spinner rotation @ 60fps
- No memory leaks when error banners mount/unmount
- Staggered skeleton animations don't block main thread

---

## Migration Path

### Existing Components to Update
- `ErrorBanner`: Keep as-is, ensure used consistently
- `ErrorDisplay`: Already follows spec, no changes needed
- `StateMessage`: Migrate error handling to new builders
- `ErrorLayout`: Already follows spec, minor color standardization
- `LoadingState`: Already comprehensive, add stagger classes
- `SkeletonCard`: Keep as-is, document in this spec

### New Usage Points
- **Guest Portal Search:** Replace inline error alerts with `ErrorBanner`
- **Booking Flow:** Use `ErrorDisplay` for validation errors
- **Payment:** Map Razorpay errors to recovery actions
- **Owner Portal:** Standardize error handling across dashboards
- **API Clients:** Implement centralized error builders

---

## References

- Existing implementations: `src/components/Error*.tsx`, `src/components/LoadingState.tsx`, `src/components/StateMessage.tsx`
- Error mapping: `src/utils/razorpayGuestErrors.ts`, `src/utils/serverErrorFromResponse.ts`
- Design tokens: `src/styles/theme.ts`, `tailwind.config.js`
- Monitoring: `src/lib/monitoring.ts`
