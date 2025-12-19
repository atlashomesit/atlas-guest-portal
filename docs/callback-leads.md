# Callback leads contract

The callback request bar sends leads to the booking backend when the `/api/leads/callback` endpoint is reachable. When the endpoint is not available, the client stores a small backlog locally so submissions are not lost.

## Request payload

Endpoint: `/api/leads/callback`

Method: `POST`

Headers:

- `Content-Type: application/json`

Body:

```json
{
  "phone": "+911234567890",
  "route": "/property_details/oak-suite",
  "listingId": "oak-suite",
  "unitCode": "oak-suite",
  "context": {
    "source": "callback_bar"
  }
}
```

Notes:

- `phone` must include the country code and is only sent to the backend (never attached to analytics events).
- `listingId`/`unitCode` help route the lead to the right property; they are optional but recommended on detail pages.
- `context` is an open object for backend operators (e.g., `utm` fragments or AB experiment labels).

## Expected response

The UI treats any 2xx response as success. A representative payload:

```json
{
  "success": true,
  "leadId": "cb_12345",
  "message": "Lead created"
}
```

On non-2xx responses the client will show a failure message and fall back to local storage.

## Fallback storage

When the network request fails or `fetch` is unavailable:

- The payload is appended to `localStorage` under the `callback_leads_backlog` key.
- Up to 25 of the most recent entries are retained; older ones are dropped to prevent unbounded growth.
- The backlog is **not** transmitted to analytics and remains on the user's device until cleared manually.

This allows operators to diagnose issues while ensuring the caller is informed that the request did not go through.
