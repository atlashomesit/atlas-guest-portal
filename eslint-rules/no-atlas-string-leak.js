/**
 * ESLint rule: no-atlas-string-leak
 *
 * RA-006: Prevents hardcoded Atlas brand strings from appearing in the guest portal.
 * When starguesthouse.atlastays.com (or any white-label tenant) loads the portal,
 * they must not see "Atlas Homestays" anywhere in the UI.
 *
 * Allowed exemption: strings in test files (**\/*.test.*, **\/*.spec.*).
 * Fix: replace the string with `getTenantContext()?.name ?? 'Our Homestays'` or
 *      the relevant field from TenantInfo.
 */

/** Atlas brand strings that must not appear verbatim in user-visible code. */
const BANNED_PATTERNS = [
  /atlas\s*homestays/i,
  /atlashomestays/i,
];

/** Check a raw string value — returns true when it contains a banned pattern. */
function isBanned(value) {
  return BANNED_PATTERNS.some(re => re.test(value));
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded Atlas brand strings in guest portal source',
      url: 'https://github.com/atlashomesit/atlas-api/blob/dev/docs/requirements/RA-006-tenant-isolation-payments-and-branding.md',
    },
    schema: [],
    messages: {
      atlasStringLeak:
        'RA-006: Hardcoded Atlas brand string "{{value}}" found. ' +
        'Replace with getTenantContext()?.name or the relevant TenantInfo field.',
    },
  },
  create(context) {
    const filename = context.getFilename?.() ?? context.filename ?? '';
    // Skip test / spec files
    if (/\.(test|spec)\.[tj]sx?$/.test(filename)) return {};

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (isBanned(node.value)) {
          context.report({
            node,
            messageId: 'atlasStringLeak',
            data: { value: node.value },
          });
        }
      },

      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const raw = quasi.value.raw;
          if (isBanned(raw)) {
            context.report({
              node: quasi,
              messageId: 'atlasStringLeak',
              data: { value: raw },
            });
          }
        }
      },

      JSXText(node) {
        if (isBanned(node.value)) {
          context.report({
            node,
            messageId: 'atlasStringLeak',
            data: { value: node.value.trim() },
          });
        }
      },
    };
  },
};
