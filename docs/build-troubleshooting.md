# Build troubleshooting

## Vite/Cloudflare build considerations

- Ensure the `/config` script in `index.html` is loaded as a module: `<script type="module" src="/config"></script>`. Without the `type="module"` attribute, Vite cannot bundle the tag cleanly and will emit warnings during Pages builds.
- Keep the booking calendar overlay markup inside the calendar render tree (e.g., wrap the `DateRange` calendar and its loading overlay in a `relative` container). Placing the overlay JSX outside a proper wrapper can leave unbalanced JSX and break the Vite build.
