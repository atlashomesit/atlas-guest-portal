/**
 * ESLint rule: no-atlas-string-leak
 *
 * RA-006: Prevents hardcoded Atlas brand strings, platform phone numbers,
 * marketplace emails, and social handles from appearing in the guest portal.
 * When starguesthouse.atlastays.com (or any white-label tenant) loads the portal,
 * they must not see any Atlas-platform contact or identity string in the UI.
 *
 * Allowed exemption: strings in test files (**\/*.test.*, **\/*.spec.*).
 * Fix: replace brand strings with `getTenantContext()?.name ?? 'Our Homestays'` or
 *      the relevant field from TenantInfo; replace contact strings with
 *      getContactPhone()/getContactEmail()/getTelLink() from @/config/contact,
 *      and hide the element when empty on a white-label tenant.
 */

/** Atlas brand strings and platform contacts that must not appear verbatim in user-visible code. */
const BANNED_PATTERNS = [
  // Brand names
  /atlas\s*homestays/i,
  /atlashomestays/i,
  // Platform phone numbers — match with/without +91 prefix, spaces or dashes
  /(\+?91[\s-]?)?7032493290/,
  /(\+?91[\s-]?)?7416261981/,
  /(\+?91[\s-]?)?9502244053/,
  // Marketplace emails
  /atlashomeskphb@gmail\.com/i,
  /support@atlastays\.com/i,
  /privacy@atlastays\.com/i,
  // Social handle
  /atlashomeskphb/i,
  // Atlas host/admin portal — must not appear on white-label guest sites (TASK-7434)
  /app\.atlaspms\.in/i,
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
      description: 'Disallow hardcoded Atlas brand strings and platform contacts (phone/email/social) in guest portal source',
      url: 'https://github.com/atlashomesit/atlas-api/blob/dev/docs/requirements/RA-006-tenant-isolation-payments-and-branding.md',
    },
    schema: [],
    messages: {
      atlasStringLeak:
        'RA-006: Hardcoded Atlas platform string "{{value}}" found (brand, phone, email, or social handle). ' +
        'Replace with getTenantContext()?.name, getContactPhone()/getContactEmail() from @/config/contact, ' +
        'or the relevant TenantInfo field; hide on white-label tenants when no tenant value exists.',
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
