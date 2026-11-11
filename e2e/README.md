# Search hierarchy regression

`search-hierarchy.spec.ts` uses the shared `atlas-e2e` Playwright toolchain and a running local guest preview. It intercepts synthetic reads and blocks external requests and writes. No credentials are required. Set `GUEST_UX_BASE_URL` to the loopback preview origin.

The daily UX evidence records the exact runner configuration, TypeScript check, Playwright collection and actual execution for this spec. A wrapper config should set `testDir` to this directory, one worker and no global authentication setup. This is scoped browser coverage, not the release gate.
