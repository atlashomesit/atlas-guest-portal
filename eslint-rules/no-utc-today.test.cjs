/**
 * Test harness for no-utc-today eslint rule (ADR-0077).
 *
 * Run with: npx mocha eslint-rules/no-utc-today.test.cjs
 */
const rule = require('./no-utc-today.cjs');
const { RuleTester } = require('eslint');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
});

ruleTester.run('no-utc-today', rule, {
  valid: [
    // The IST helpers this rule steers toward.
    `const today = toISODate(new Date());`,
    `const from = getIstCalendarDate();`,
    `const today = toISODate(someDate);`,
    // toISOString for a full timestamp (not a calendar-day slice) is fine.
    `const stamp = new Date().toISOString();`,
    // Slicing something that is not a toISOString() result.
    `const head = someString.slice(0, 10);`,
    // Explicit escape hatch for a genuine UTC stamp.
    `const utcDay = new Date().toISOString().slice(0, 10); // utc-instant-ok: cross-region cache key`,
  ],
  invalid: [
    {
      code: `const today = new Date().toISOString().slice(0, 10);`,
      errors: [{ message: /ADR-0077/ }],
    },
    {
      code: `const today = new Date().toISOString().split('T')[0];`,
      errors: [{ message: /ADR-0077/ }],
    },
    {
      code: `a.download = \`bookings-\${new Date().toISOString().slice(0, 10)}.csv\`;`,
      errors: [{ message: /ADR-0077/ }],
    },
    {
      // A wrong-line marker must NOT excuse it.
      code: `// utc-instant-ok: on the wrong line\nconst today = new Date().toISOString().slice(0, 10);`,
      errors: [{ message: /ADR-0077/ }],
    },
  ],
});

// eslint's RuleTester throws on failure; reaching here means all cases passed.
console.log('no-utc-today: all rule-tester cases passed');
