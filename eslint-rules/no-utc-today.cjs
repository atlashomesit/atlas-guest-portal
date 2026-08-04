/**
 * ESLint rule: no-utc-today
 *
 * ADR-0077 (timezone sweep 2026-07-15). All Atlas customers operate in IST. Between
 * 00:00 and 05:30 IST, `new Date().toISOString()` yields YESTERDAY's calendar day, so
 * seeding a "today", a default date range, or a filename stamp from it is wrong exactly
 * in the overnight window — the recurring UTC-vs-IST bug class.
 *
 * Banned:
 *   new Date().toISOString().slice(0, 10)          // FORBIDDEN — UTC calendar day
 *   new Date().toISOString().split('T')[0]         // FORBIDDEN — UTC calendar day
 *   someDate.toISOString().slice(0, 10)            // FORBIDDEN when someDate is `new Date()`-ish
 *
 * Use instead (from "@/utils/dateRange" and "@/utils/date"):
 *   toISODate(date)                                 // IST yyyy-MM-dd
 *   getIstCalendarDate()                            // IST calendar date for today
 *   getIstStartOfDay(instant)                       // IST midnight for an instant
 *
 * Escape hatch: a genuine UTC day-stamp may add a same-line `// utc-instant-ok: <reason>`
 * comment (checked by the rule). Test/spec files are exempt.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
"use strict";

const MESSAGE =
  "UTC calendar-day derivation (ADR-0077): new Date().toISOString().slice(0,10)/split('T')[0] " +
  "is UTC and yields YESTERDAY between 00:00 and 05:30 IST. Use toISODate()/getIstCalendarDate() " +
  "from '@/utils/dateRange' and '@/utils/date'. If you truly need a UTC " +
  "day, add a same-line `// utc-instant-ok: <reason>` comment.";

// Matches `.toISOString()` being called on the object side of the outer call.
function isToISOStringCall(node) {
  return (
    node &&
    node.type === "CallExpression" &&
    node.callee &&
    node.callee.type === "MemberExpression" &&
    node.callee.property &&
    node.callee.property.name === "toISOString"
  );
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban UTC calendar-day derivations; use IST operational-today helpers (ADR-0077)",
      category: "Best Practices",
      recommended: "error",
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();

    function hasInstantOkMarker(node) {
      const line = node.loc.start.line;
      const comments = sourceCode.getAllComments();
      return comments.some(
        (c) => c.loc.start.line === line && /utc-instant-ok:/.test(c.value),
      );
    }

    return {
      // .slice(...) or .split(...) whose object is a `.toISOString()` call.
      "CallExpression[callee.type='MemberExpression']"(node) {
        const propName = node.callee.property && node.callee.property.name;
        if (propName !== "slice" && propName !== "split") return;
        if (!isToISOStringCall(node.callee.object)) return;
        if (hasInstantOkMarker(node)) return;
        context.report({ node, message: MESSAGE });
      },
    };
  },
};
