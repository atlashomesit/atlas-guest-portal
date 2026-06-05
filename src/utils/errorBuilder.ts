/**
 * Centralized error message builders for consistency across Guest and Owner portals.
 * Maps API errors, network errors, and validation errors to user-friendly UserError objects.
 *
 * @see docs/UNIFIED_ERROR_LOADING_PATTERNS.md
 */

import { UserError, RecoveryAction, ApiErrorResponse } from "@/types/errors";

/* ============================================================================
   VALIDATION ERRORS
   ============================================================================ */

/**
 * Build a validation error for a specific field.
 * @param fieldName The name of the field (e.g., "Phone number")
 * @param reason The validation failure reason (e.g., "must be 10 digits")
 */
export function buildValidationError(fieldName: string, reason: string): UserError {
  return {
    code: "VALIDATION_ERROR",
    category: "validation",
    message: `${fieldName} is invalid.`,
    details: reason,
    recoveryActions: [
      {
        actionType: "RETRY",
        actionLabel: "Fix and retry",
      },
    ],
  };
}

/**
 * Build a "field missing" error.
 * @param fieldName The required field (e.g., "Email address")
 */
export function buildMissingFieldError(fieldName: string): UserError {
  return {
    code: "MISSING_FIELD",
    category: "validation",
    message: `${fieldName} is required.`,
    details: `Please enter a valid ${fieldName.toLowerCase()}.`,
    recoveryActions: [
      {
        actionType: "RETRY",
        actionLabel: "Fill in and retry",
      },
    ],
  };
}

/**
 * Build a "too many requests" error (rate limit).
 * @param retryAfterSeconds How many seconds before user can retry
 */
export function buildRateLimitError(retryAfterSeconds: number = 30): UserError {
  return {
    code: "RATE_LIMIT",
    category: "validation",
    message: "Too many requests. Please wait before trying again.",
    details: `You can try again in ${retryAfterSeconds} seconds.`,
    recoveryActions: [
      {
        actionType: "RETRY",
        actionLabel: "Retry",
        delaySeconds: retryAfterSeconds,
      },
    ],
  };
}

/* ============================================================================
   NETWORK ERRORS
   ============================================================================ */

/**
 * Build a generic network error (offline, connectivity issue).
 */
export function buildNetworkError(): UserError {
  return {
    code: "NETWORK_ERROR",
    category: "network",
    message: "We couldn't reach the server.",
    details: "Check your internet connection and try again.",
    recoveryActions: [
      {
        actionType: "RETRY",
        actionLabel: "Try again",
      },
      {
        actionType: "CONTACT_SUPPORT",
        actionLabel: "Contact support",
        actionUrl: "/support",
      },
    ],
  };
}

/**
 * Build a timeout error (request took too long).
 */
export function buildTimeoutError(): UserError {
  return {
    code: "TIMEOUT_ERROR",
    category: "network",
    message: "The request took too long. Please try again.",
    details: "Our servers might be busy. Give it a moment and try again.",
    recoveryActions: [
      {
        actionType: "RETRY",
        actionLabel: "Try again",
      },
    ],
  };
}

/**
 * Build an offline error.
 */
export function buildOfflineError(): UserError {
  return {
    code: "OFFLINE_ERROR",
    category: "network",
    message: "You're offline.",
    details: "Some features may not work. Check your connection.",
    recoveryActions: [
      {
        actionType: "RETRY",
        actionLabel: "Retry",
      },
    ],
  };
}

/* ============================================================================
   PERMISSION ERRORS
   ============================================================================ */

/**
 * Build a 401 Unauthorized error.
 */
export function buildUnauthorizedError(): UserError {
  return {
    code: "UNAUTHORIZED",
    category: "permission",
    message: "You need to sign in.",
    details: "Please log in with your account to continue.",
    recoveryActions: [
      {
        actionType: "SIGN_IN",
        actionLabel: "Sign in",
        actionUrl: "/auth/login",
      },
      {
        actionType: "GO_BACK",
        actionLabel: "Go back",
      },
    ],
  };
}

/**
 * Build a 403 Forbidden error.
 */
export function buildForbiddenError(resourceType: string = "resource"): UserError {
  return {
    code: "FORBIDDEN",
    category: "permission",
    message: `You don't have access to this ${resourceType}.`,
    details: "Contact the owner or administrator to request access.",
    recoveryActions: [
      {
        actionType: "CONTACT_SUPPORT",
        actionLabel: "Request access",
        actionUrl: "/support",
      },
      {
        actionType: "GO_BACK",
        actionLabel: "Go back",
      },
    ],
  };
}

/**
 * Build a permission error for a specific resource.
 * @param action The action user tried (e.g., "book", "edit")
 * @param resourceType The resource type (e.g., "property", "listing")
 */
export function buildPermissionDeniedError(
  action: string = "view",
  resourceType: string = "resource"
): UserError {
  return {
    code: "PERMISSION_DENIED",
    category: "permission",
    message: `You can't ${action} this ${resourceType}.`,
    details: "It may have been removed or you may not have permission to access it.",
    recoveryActions: [
      {
        actionType: "CONTACT_SUPPORT",
        actionLabel: "Contact support",
        actionUrl: "/support",
      },
    ],
  };
}

/* ============================================================================
   NOT FOUND ERRORS
   ============================================================================ */

/**
 * Build a 404 Not Found error.
 * @param itemType The thing that wasn't found (e.g., "listing", "property")
 */
export function buildNotFoundError(itemType: string = "page"): UserError {
  return {
    code: "NOT_FOUND",
    category: "unknown",
    message: `This ${itemType} wasn't found or no longer exists.`,
    details: "It may have been removed or the link may be broken.",
    recoveryActions: [
      {
        actionType: "SEARCH_AGAIN",
        actionLabel: "Browse listings",
        actionUrl: "/search",
      },
      {
        actionType: "GO_BACK",
        actionLabel: "Go back",
      },
    ],
  };
}

/* ============================================================================
   SERVER ERRORS
   ============================================================================ */

/**
 * Build a 5xx server error.
 * @param contactEmail Support email (optional)
 */
export function buildServerError(status: number = 500, contactEmail?: string): UserError {
  const actions: RecoveryAction[] = [
    {
      actionType: "RETRY",
      actionLabel: "Try again",
    },
  ];

  if (contactEmail) {
    actions.push({
      actionType: "CONTACT_SUPPORT",
      actionLabel: `Email ${contactEmail}`,
      actionUrl: `mailto:${contactEmail}`,
    });
  } else {
    actions.push({
      actionType: "CONTACT_SUPPORT",
      actionLabel: "Contact support",
      actionUrl: "/support",
    });
  }

  return {
    code: status === 503 ? "SERVICE_UNAVAILABLE" : "SERVER_ERROR",
    category: "unknown",
    message: status === 503 ? "Our service is temporarily unavailable." : "Our servers encountered an error.",
    details:
      status >= 500
        ? `Server responded with ${status}. Try again shortly or contact support if the problem persists.`
        : "Try again shortly or contact support if the problem persists.",
    recoveryActions: actions,
  };
}

/**
 * Build a generic unknown error.
 */
export function buildUnknownError(): UserError {
  return {
    code: "UNKNOWN_ERROR",
    category: "unknown",
    message: "Something unexpected happened.",
    details: "Try again or contact support if the issue persists.",
    recoveryActions: [
      {
        actionType: "RETRY",
        actionLabel: "Try again",
      },
      {
        actionType: "CONTACT_SUPPORT",
        actionLabel: "Contact support",
        actionUrl: "/support",
      },
    ],
  };
}

/* ============================================================================
   DOMAIN-SPECIFIC ERRORS
   ============================================================================ */

/**
 * Build a payment-related error.
 * @param reason The decline reason (e.g., "card declined", "invalid cvv")
 */
export function buildPaymentError(reason: string): UserError {
  return {
    code: "PAYMENT_ERROR",
    category: "validation",
    message: "We couldn't process your payment.",
    details: reason,
    recoveryActions: [
      {
        actionType: "RETRY_PAYMENT",
        actionLabel: "Try again",
      },
      {
        actionType: "CONTACT_SUPPORT",
        actionLabel: "Contact support",
        actionUrl: "/support",
      },
    ],
  };
}

/**
 * Build a booking-related error.
 * @param reason The reason booking failed (e.g., "dates unavailable")
 */
export function buildBookingError(reason: string): UserError {
  return {
    code: "BOOKING_ERROR",
    category: "validation",
    message: "We couldn't complete your booking.",
    details: reason,
    recoveryActions: [
      {
        actionType: "SEARCH_AGAIN",
        actionLabel: "Search again",
        actionUrl: "/search",
      },
      {
        actionType: "CONTACT_SUPPORT",
        actionLabel: "Contact support",
        actionUrl: "/support",
      },
    ],
  };
}

/**
 * Build a property/listing error.
 */
export function buildPropertyError(action: string = "load"): UserError {
  return {
    code: "PROPERTY_ERROR",
    category: "unknown",
    message: `We couldn't ${action} this property.`,
    details: "It may have been removed or there may be a temporary issue.",
    recoveryActions: [
      {
        actionType: "SEARCH_AGAIN",
        actionLabel: "Browse other properties",
        actionUrl: "/search",
      },
      {
        actionType: "CONTACT_SUPPORT",
        actionLabel: "Contact support",
        actionUrl: "/support",
      },
    ],
  };
}

/* ============================================================================
   API RESPONSE MAPPING
   ============================================================================ */

/**
 * Build a UserError from an HTTP status code.
 * Use this as a fallback when the API response body is unparseable.
 * @param status HTTP status code
 * @param body Optional response body (for more details)
 */
export function buildErrorFromHttpStatus(
  status: number,
  body?: string | ApiErrorResponse
): UserError {
  // Client errors (4xx)
  if (status === 400) {
    return buildValidationError("Request", typeof body === "string" ? body : "Invalid input");
  }
  if (status === 401) {
    return buildUnauthorizedError();
  }
  if (status === 403) {
    return buildForbiddenError();
  }
  if (status === 404) {
    return buildNotFoundError();
  }
  if (status === 409) {
    return buildValidationError("Resource", "Conflict: the resource may have changed");
  }
  if (status === 429) {
    return buildRateLimitError();
  }

  // Server errors (5xx)
  if (status >= 500) {
    return buildServerError(status);
  }

  return buildUnknownError();
}

/**
 * Build a UserError from a parsed API error response.
 * Maps ProblemDetails format and similar error structures.
 * @param response The parsed API error response
 */
export function buildErrorFromApiResponse(response: ApiErrorResponse): UserError {
  const { status, title, detail, errors, message, error } = response;

  // Extract the most relevant error message
  const mainMessage = title || message || error || "Request failed";
  let details = detail || "";

  // Handle validation errors (field errors)
  if (errors && typeof errors === "object") {
    const fieldErrors = Object.values(errors)
      .flat()
      .filter((e): e is string => typeof e === "string");

    if (fieldErrors.length > 0) {
      details = fieldErrors.join("; ");
      return buildValidationError("Input", details);
    }
  }

  // Route by status code
  return buildErrorFromHttpStatus(status, { status, statusText: "", detail: details || mainMessage });
}

/* ============================================================================
   HELPERS
   ============================================================================ */

/**
 * Check if error is recoverable with a specific action type.
 */
export function hasRecoveryAction(
  error: UserError,
  actionType: "RETRY" | "RETRY_PAYMENT" | "SEARCH_AGAIN" | "CONTACT_SUPPORT" | string
): boolean {
  return error.recoveryActions.some((a) => a.actionType === actionType);
}

/**
 * Add a recovery action to an existing error.
 */
export function addRecoveryAction(
  error: UserError,
  action: RecoveryAction
): UserError {
  return {
    ...error,
    recoveryActions: [...error.recoveryActions, action],
  };
}

/**
 * Replace all recovery actions in an error.
 */
export function setRecoveryActions(
  error: UserError,
  actions: RecoveryAction[]
): UserError {
  return {
    ...error,
    recoveryActions: actions,
  };
}
