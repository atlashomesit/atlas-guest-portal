# Build troubleshooting

## Vite/Cloudflare build considerations

- Runtime config is loaded via `/config.json` at app startup. Ensure the Pages Function is deployed so the endpoint responds before the app bootstraps.
- Keep the booking calendar overlay markup inside the calendar render tree (e.g., wrap the `DateRange` calendar and its loading overlay in a `relative` container). Placing the overlay JSX outside a proper wrapper can leave unbalanced JSX and break the Vite build.
