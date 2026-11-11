/**
 * Test harness for the no-wall-clock-wait eslint rule (TASK-102734).
 *
 * Run with: npx vitest run eslint-rules/no-wall-clock-wait.test.cjs
 * (RuleTester binds to vitest's injected describe/it globals; see the scan-roots note in vitest.config.ts.)
 */
const rule = require('./no-wall-clock-wait.cjs');
const { RuleTester } = require('eslint');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const FILE = 'src/example.test.tsx';
const base = (extra) => ({ filename: FILE, ...extra });

ruleTester.run('no-wall-clock-wait', rule, {
  valid: [
    // The deterministic forms the rule steers toward.
    base({ code: `await settle(); expect(screen.getByText('x')).toBeInTheDocument();` }),
    base({ code: `await act(async () => { await vi.advanceTimersByTimeAsync(500); });` }),
    // Not a DTL wait: vitest's own poller is out of scope.
    base({ code: `await vi.waitFor(() => expect(x).toBe(1));` }),
    // Unrelated names.
    base({ code: `const waitForMe = 1; foo(waitForMe); bar.finder('x');` }),

    // Real work, justified: explicit timeout AND a wall-clock marker (line above, same line, or inside the call).
    base({ code: `// wall-clock: React.lazy chunk import is real module loading\nawait waitFor(() => expect(x).toBe(1), { timeout: 5000 });` }),
    base({ code: `await waitFor(() => expect(x).toBe(1), { timeout: 5000 }); // wall-clock: real debounce owned by the widget` }),
    base({ code: `await screen.findByText('x', {}, { timeout: 5000 }); // wall-clock: real image decode` }),
    base({ code: `await waitFor(\n  () => expect(x).toBe(1),\n  { timeout: 5000 }, // wall-clock: real I/O\n);` }),
    base({ code: `// wall-clock: lazy route\nawait screen.findAllByRole('row', undefined, { timeout: 2000 });` }),

    // Files that fake setTimeout are exempt (the deadline is not a real timer there), wherever the call sits.
    base({ code: `vi.useFakeTimers();\nawait waitFor(() => expect(x).toBe(1));` }),
    base({ code: `async function later() { await screen.findByText('x'); }\nvi.useFakeTimers();` }),
    base({ code: `vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });\nawait waitFor(() => expect(x).toBe(1));` }),
    base({ code: `vi.useFakeTimers({ now: 0 });\nawait waitFor(() => expect(x).toBe(1));` }),

    // Ratchet: the baseline tolerates up to N unjustified waits in this exact file.
    {
      filename: FILE,
      options: [{ baseline: { [FILE]: 2 } }],
      code: `await waitFor(() => a());\nawait screen.findByText('b');`,
    },
    // A wait that carries its justification does not consume baseline.
    {
      filename: FILE,
      options: [{ baseline: { [FILE]: 1 } }],
      code: `await waitFor(() => a());\n// wall-clock: real I/O\nawait waitFor(() => b(), { timeout: 3000 });`,
    },
  ],

  invalid: [
    // The exact line TASK-102734 removed from useTenantProcessingFee.test.tsx.
    base({
      code: `await waitFor(() => expect(first.result.current).toBe(1.25));`,
      errors: [{ messageId: 'wallClock', data: { name: 'waitFor', count: '1', allowed: '0' } }],
    }),
    base({ code: `await screen.findByText('x');`, errors: [{ messageId: 'wallClock' }] }),
    base({ code: `await screen.findAllByRole('row');`, errors: [{ messageId: 'wallClock' }] }),
    base({ code: `await within(panel).findByTestId('id');`, errors: [{ messageId: 'wallClock' }] }),
    base({ code: `const { findByText } = render(view); await findByText('x');`, errors: [{ messageId: 'wallClock' }] }),
    base({ code: `await waitForElementToBeRemoved(() => screen.queryByText('spinner'));`, errors: [{ messageId: 'wallClock' }] }),
    base({ code: `await rtl.waitFor(() => a());`, errors: [{ messageId: 'wallClock' }] }),

    // A longer window without a justification is exactly the anti-pattern (a timeout bump).
    base({ code: `await waitFor(() => a(), { timeout: 15_000 });`, errors: [{ messageId: 'wallClock' }] }),
    base({ code: `await screen.findByText('x', {}, { timeout: 15_000 });`, errors: [{ messageId: 'wallClock' }] }),
    // A marker with no explicit timeout is not a justification either.
    base({ code: `// wall-clock: trust me\nawait waitFor(() => a());`, errors: [{ messageId: 'wallClock' }] }),
    // A marker with no reason.
    base({ code: `// wall-clock:\nawait waitFor(() => a(), { timeout: 3000 });`, errors: [{ messageId: 'wallClock' }] }),
    // A marker far from the call does not excuse it.
    base({ code: `// wall-clock: elsewhere\nconst a = 1;\nconst b = 2;\nawait waitFor(() => a(), { timeout: 3000 });`, errors: [{ messageId: 'wallClock' }] }),

    // Fake timers that do NOT make the deadline a fake timer still count as real wall-clock.
    base({ code: `vi.useFakeTimers({ toFake: ['Date'] });\nawait waitFor(() => a());`, errors: [{ messageId: 'wallClock' }] }),
    base({ code: `vi.useFakeTimers({ shouldAdvanceTime: true });\nawait waitFor(() => a());`, errors: [{ messageId: 'wallClock' }] }),

    // Ratchet, growth: baseline 1, two unjustified waits -> only the extra one is reported.
    {
      filename: FILE,
      options: [{ baseline: { [FILE]: 1 } }],
      code: `await waitFor(() => a());\nawait waitFor(() => b());`,
      errors: [{ messageId: 'wallClock', line: 2, data: { name: 'waitFor', count: '2', allowed: '1' } }],
    },
    // A baseline for another file grants nothing here: new files start at zero.
    {
      filename: FILE,
      options: [{ baseline: { 'src/other.test.tsx': 5 } }],
      code: `await waitFor(() => a());`,
      errors: [{ messageId: 'wallClock' }],
    },
    // Ratchet, shrink: the baseline says 3 but only 1 remains -> stale, must be lowered.
    {
      filename: FILE,
      options: [{ baseline: { [FILE]: 3 } }],
      code: `await waitFor(() => a());`,
      errors: [{ messageId: 'staleBaseline', line: 1, data: { allowed: '3', count: '1', deleteHint: '' } }],
    },
    // Ratchet, cleared: the baseline says 2 but none remain -> stale, entry must be deleted.
    {
      filename: FILE,
      options: [{ baseline: { [FILE]: 2 } }],
      code: `await settle();\nexpect(x).toBe(1);`,
      errors: [{ messageId: 'staleBaseline', data: { allowed: '2', count: '0', deleteHint: ' (delete the entry)' } }],
    },
    // A fake-timer file still reports a leftover baseline entry as stale.
    {
      filename: FILE,
      options: [{ baseline: { [FILE]: 1 } }],
      code: `vi.useFakeTimers();\nawait waitFor(() => a());`,
      errors: [{ messageId: 'staleBaseline' }],
    },
  ],
});

// eslint's RuleTester throws on failure; reaching here means all cases passed.
console.log('no-wall-clock-wait: all rule-tester cases passed');
