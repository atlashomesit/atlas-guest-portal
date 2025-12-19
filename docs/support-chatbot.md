## Support chatbot

Telemetry for chat interactions (open, send, quick actions, escalations) should follow the event shapes in [`docs/analytics.md`](./analytics.md). Use descriptive `surface` values (e.g., `chat_launcher`, `inline_prompt`) and avoid sending raw chat text or other PII.
