/**
 * Unified error and loading type definitions for both Guest and Owner portals.
 * Provides a consistent contract for error handling, recovery actions, and loading states.
 *
 * @see docs/UNIFIED_ERROR_LOADING_PATTERNS.md
 */

/* ============================================================================
   ERROR TYPES
   ============================================================================ */

/**
 * Categorical error types for consistent user-facing messaging.
 * - VALIDATION: User input doesn't meet requirements (e.g., invalid email, missing field)
 * - NETWORK: Connectivity or server timeout issues (e.g., offline, API timeout)
 * - PERMISSION: User lacks access to resource (e.g., unauthorized, forbidden)
 * - UNKNOWN: Unexpected server error or crash (e.g., 5xx, unhandled exception)
 */
export type ErrorCategory = "validation" | "network" | "permission" | "unknown";

/**
 * Recovery action types — the affordances offered to recover from an error.
 */
export type RecoveryActionType =
  | "RETRY"
  | "RETRY_PAYMENT"
  | "SEARCH_AGAIN"
  | "CONTACT_SUPPORT"
  | "CHECK_EMAIL"
  | "GO_BACK"
  | "SIGN_IN"
  | "REQUEST_ACCESS";

/**
 * A single recovery action button/link.
 * Example: { actionType: "RETRY_PAYMENT", actionLabel: "Try Again", delaySeconds: 30 }
 */
export interface RecoveryAction {
  actionType: RecoveryActionType;
  actionLabel: string;              // Button/link text
  actionUrl?: string;               // External/navigation URL (optional)
  onClick?: () => void;             // Click handler (optional)
  delaySeconds?: number;            // Countdown timer for rate-limit scenarios
}

/**
 * User-facing error object. Maps to ErrorBanner, ErrorDisplay, or ErrorLayout.
 */
export interface UserError {
  code: string;                     // Machine-readable code (e.g., "PAYMENT_DECLINED")
  category: ErrorCategory;          // One of: validation, network, permission, unknown
  message: string;                  // Primary message (max 1-2 sentences)
  details?: string;                 // Secondary details or hint text
  recoveryActions: RecoveryAction[]; // Array of recovery buttons
  timestamp?: Date;                 // When error occurred (for logging)
}

/**
 * Error response from API (ASP.NET ProblemDetails or similar).
 */
export interface ApiErrorResponse {
  status: number;
  statusText: string;
  type?: string;                    // e.g., "https://example.com/errors/payment-failed"
  title?: string;                   // e.g., "Payment Failed"
  detail?: string;                  // e.g., "Card declined by issuer"
  instance?: string;                // e.g., "/v1/orders/abc123"
  errors?: Record<string, string[]>; // Field validation errors
  message?: string;                 // Alternative message field
  error?: string;                   // Alternative error field (e.g., OAuth errors)
}

/**
 * Parsed error from failed HTTP request.
 */
export interface HttpError extends Error {
  status: number;
  statusText: string;
  body?: ApiErrorResponse | string;
  isNetworkError: boolean;          // True if connectivity issue (no HTTP response)
  isTimeout: boolean;               // True if request exceeded timeout
}

/**
 * Error context for logging/monitoring.
 */
export interface ErrorContext {
  boundaryName?: string;            // Error boundary that caught it
  routePath?: string;               // URL path
  routeSearch?: string;             // URL query string
  userId?: string;                  // User ID (if applicable)
  sessionId?: string;               // Session ID for tracing
  tags?: Record<string, string>;    // Arbitrary metadata
}

/* ============================================================================
   LOADING TYPES
   ============================================================================ */

/**
 * Skeleton/loading shape variants.
 */
export type LoadingShape =
  | "skeleton-card"      // Grid of property cards (search results)
  | "skeleton-grid"      // Small item grid (amenities, features)
  | "skeleton-list"      // Vertical list items (bookings, transactions)
  | "skeleton-table"     // Data table (owner bookings, analytics)
  | "skeleton-form"      // Form with fields (checkout, property edit)
  | "spinner";           // Inline spinner (button action, quick fetch)

/**
 * LoadingState component props.
 */
export interface LoadingStateProps {
  kind: LoadingShape;
  count?: number;                   // Number of skeleton items (default 6)
  rows?: number;                    // Number of rows for table skeleton
  message?: string;                 // Accessible loading message for screen readers
  className?: string;               // Additional CSS classes
}

/**
 * Request state for async data fetching.
 */
export type RequestState = "idle" | "loading" | "success" | "error";

/**
 * Generic async operation state tracker.
 */
export interface AsyncState<T, E = UserError> {
  state: RequestState;
  data?: T;
  error?: E;
  isLoading: boolean;
  isError: boolean;
  timestamp?: Date;
}

/* ============================================================================
   STATE MESSAGE TYPES (Empty states, not found, permission denied)
   ============================================================================ */

/**
 * Action in StateMessage or ErrorLayout.
 */
export interface StateAction {
  label: string;                    // Button/link text
  to?: string;                      // react-router Link target (internal route)
  href?: string;                    // External/mailto/tel link
  onClick?: () => void;             // Click handler
  variant?: "primary" | "secondary";
  disabled?: boolean;
  "data-testid"?: string;
}

/**
 * StateMessage props — for empty states, 404, permission denied.
 */
export interface StateMessageProps {
  icon?: React.ReactNode;           // Emoji or SVG icon
  title: string;                    // Headline
  message?: string;                 // Supporting text
  primaryAction?: StateAction;      // Most prominent action
  secondaryActions?: StateAction[]; // Quiet alternatives
  "data-testid"?: string;
}

/**
 * ErrorLayout props — for full-page errors.
 */
export interface ErrorLayoutAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export interface ErrorLayoutProps {
  title: string;                    // e.g., "We couldn't load this page"
  description: string;              // e.g., "Something unexpected happened. Try again or go home."
  primaryAction?: ErrorLayoutAction;
  secondaryAction?: ErrorLayoutAction;
  children?: React.ReactNode;       // Additional content
}

/**
 * ErrorBanner props — for inline/dismissible alerts.
 */
export type ErrorSeverity = "error" | "warning" | "info";

export interface ErrorBannerProps {
  message: string;
  severity?: ErrorSeverity;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * ErrorBoundary props.
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  name?: string;                    // Name for logging
  fallback?: React.ReactNode;       // Custom error UI (optional)
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/* ============================================================================
   HELPER FUNCTIONS (Type guards)
   ============================================================================ */

/**
 * Check if error is a UserError.
 */
export function isUserError(error: unknown): error is UserError {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    "category" in error &&
    "message" in error &&
    "recoveryActions" in error
  );
}

/**
 * Check if error is an ApiErrorResponse.
 */
export function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  return (
    error !== null &&
    typeof error === "object" &&
    ("status" in error || "title" in error || "detail" in error)
  );
}

/**
 * Check if error is an HttpError.
 */
export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    "status" in error &&
    "isNetworkError" in error &&
    "isTimeout" in error
  );
}

/**
 * Check if we're in a network error state.
 */
export function isNetworkError(error: unknown): boolean {
  if (isHttpError(error)) return error.isNetworkError;
  if (isUserError(error)) return error.category === "network";
  return false;
}

/**
 * Check if error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (isHttpError(error)) {
    // Network errors and 5xx are retryable; 4xx client errors are not
    return error.isNetworkError || error.isTimeout || error.status >= 500;
  }
  if (isUserError(error)) {
    return error.recoveryActions.some((a) => a.actionType === "RETRY" || a.actionType === "RETRY_PAYMENT");
  }
  return false;
}

/**
 * Extract error message safely.
 */
export function getErrorMessage(error: unknown): string {
  if (isUserError(error)) return error.message;
  if (isHttpError(error)) return error.message;
  if (isApiErrorResponse(error)) return error.detail || error.title || "Request failed";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}
