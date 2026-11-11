/**
 * ESLint rule: no-wall-clock-wait   (TASK-102734)
 *
 * A default-timeout `waitFor()` / `findBy*()` / `findAllBy*()` polls a 1,000 ms WALL-CLOCK window (@testing-library/dom
 * arms one real setTimeout deadline and, when it fires, rejects with the last error it saw - it does not look again).
 * On a starved worker (the release gate's STEP 1 runs the guest suite beside the API compile) the deadline can fire
 * between the two Scheduler tasks React needs to publish a value, so the test fails although nothing is wrong. One such
 * flake discarded a 48-minute gate run on 2026-09-30, and the ledger holds a STEP 1 vitest red on each of the four
 * preceding nights. Waiting for an ORDER instead of a TIME removes the failure class.
 *
 * Use, in this order:
 *   1. `await settle(); expect(screen.getByX(...))`   - `settle()` from src/test/settle.ts drains promises the test
 *      controls (mocked fetch / API modules) inside act(), with no clock involved.
 *   2. fake timers + `await vi.advanceTimersByTimeAsync(ms)`   - for a timer the component owns (debounce, delay).
 *   3. `await import('./LazyThing')` first            - for `React.lazy` chunks, then `settle()`.
 *   4. Genuinely real work only (real I/O, an unmockable animation): keep the wait, pass an explicit `timeout` AND write
 *      `// wall-clock: <why this cannot be drained>` on the line above the call, on its line, or inside it.
 *
 * NEVER raise the window to make a red green: a longer window only moves the load level at which the same red returns.
 *
 * What is NOT reported: a file that installs fake timers which fake `setTimeout` (`vi.useFakeTimers()` with no
 * `toFake`, or `toFake` listing 'setTimeout'; NOT `shouldAdvanceTime: true`, which follows the real clock, and NOT a
 * Date-only fake). Under those, waitFor's deadline is not a real timer at all.
 *
 * RATCHET. `eslint-rules/no-wall-clock-wait.baseline.json` lists, per file, how many UNJUSTIFIED waits are tolerated
 * today. The file may only shrink: a file with MORE than its baseline (a new file's baseline is 0) fails on the extra
 * calls, and a file with FEWER than its baseline fails too ("stale baseline"), so the number can never sit above
 * reality and a fixed file is forced out of the list. eslint-rules/no-wall-clock-wait.baseline.test.cjs pins the
 * ceiling. An `options[0].baseline` object replaces the JSON file (used by the RuleTester cases).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
"use strict";

const fs = require("fs");
const path = require("path");

const BASELINE_FILE = path.join(__dirname, "no-wall-clock-wait.baseline.json");
const FIND_RE = /^find(All)?By[A-Z]/;
const MARKER_RE = /wall-clock:\s*\S/;

let cachedBaseline = null;
function loadBaseline() {
  if (cachedBaseline) return cachedBaseline;
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    cachedBaseline = parsed && typeof parsed.files === "object" && parsed.files ? parsed.files : {};
  } catch {
    cachedBaseline = {};
  }
  return cachedBaseline;
}

function calleeName(callee) {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
    // vi.waitFor is vitest's own poller, a different API; only DTL's helpers are in scope.
    if (callee.object.type === "Identifier" && callee.object.name === "vi") return null;
    return callee.property.name;
  }
  return null;
}

/** "wait" for the waitFor-style helpers (options are argument #2), "find" for the findBy and findAllBy queries (options are #3). */
function waitKind(name) {
  if (name === "waitFor" || name === "waitForElementToBeRemoved") return "wait";
  if (name && FIND_RE.test(name)) return "find";
  return null;
}

function propName(prop) {
  if (prop.type !== "Property" || prop.computed) return null;
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal") return String(prop.key.value);
  return null;
}

function hasExplicitTimeout(node, kind) {
  const opts = node.arguments[kind === "wait" ? 1 : 2];
  if (!opts || opts.type !== "ObjectExpression") return false;
  return opts.properties.some((p) => propName(p) === "timeout");
}

/** True when this `vi.useFakeTimers(...)` call fakes setTimeout on a clock the test advances by hand. */
function fakesSetTimeout(node) {
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
  if (callee.property.name !== "useFakeTimers") return false;
  if (callee.object.type !== "Identifier" || (callee.object.name !== "vi" && callee.object.name !== "jest")) return false;
  const arg = node.arguments[0];
  if (!arg) return true; // default: everything but nextTick/queueMicrotask is faked
  if (arg.type !== "ObjectExpression") return false;
  let toFake = null;
  for (const p of arg.properties) {
    const n = propName(p);
    if (n === "shouldAdvanceTime" && p.value.type === "Literal" && p.value.value === true) return false;
    if (n === "toFake") toFake = p.value;
  }
  if (!toFake) return true;
  if (toFake.type !== "ArrayExpression") return false;
  return toFake.elements.some((el) => el && el.type === "Literal" && el.value === "setTimeout");
}

function relativeFilename(context) {
  const filename = context.filename || (context.getFilename && context.getFilename()) || "";
  const cwd = context.cwd || (context.getCwd && context.getCwd()) || process.cwd();
  return path.relative(cwd, path.resolve(cwd, filename)).split(path.sep).join("/");
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban default-timeout waitFor/findBy* in tests (wall-clock race on a starved worker, TASK-102734); drain with settle() instead",
      category: "Best Practices",
      recommended: "error",
    },
    fixable: null,
    schema: [
      {
        type: "object",
        properties: {
          baseline: { type: "object", additionalProperties: { type: "integer", minimum: 0 } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      wallClock:
        "{{name}}() polls a wall-clock window that a starved worker can miss while nothing is wrong (TASK-102734). " +
        "Drain mocked work with `await settle(); expect(...)` from src/test/settle.ts, or use fake timers and " +
        "vi.advanceTimersByTimeAsync for a timer you own. For genuinely real work pass an explicit `timeout` and add a " +
        "`// wall-clock: <why>` comment. This file has {{count}} unjustified wait(s); its baseline allows {{allowed}}. " +
        "Never raise a timeout to fix a red.",
      staleBaseline:
        "no-wall-clock-wait baseline is stale: eslint-rules/no-wall-clock-wait.baseline.json allows {{allowed}} " +
        "unjustified wait(s) in this file but only {{count}} remain. Lower it to {{count}}" +
        "{{deleteHint}} - the baseline may only shrink.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const options = context.options[0] || {};
    const baseline = options.baseline || loadBaseline();
    const rel = relativeFilename(context);
    const allowed = Object.prototype.hasOwnProperty.call(baseline, rel) ? baseline[rel] : 0;

    const candidates = [];
    let installsFakeTimers = false;

    function isJustified(node, kind) {
      if (!hasExplicitTimeout(node, kind)) return false;
      const first = node.loc.start.line;
      const last = node.loc.end.line;
      return sourceCode
        .getAllComments()
        .some((c) => MARKER_RE.test(c.value) && c.loc.end.line >= first - 1 && c.loc.start.line <= last);
    }

    return {
      CallExpression(node) {
        if (fakesSetTimeout(node)) installsFakeTimers = true;
        const name = calleeName(node.callee);
        const kind = waitKind(name);
        if (!kind) return;
        if (isJustified(node, kind)) return;
        candidates.push({ node, name });
      },

      "Program:exit"(program) {
        // Under faked setTimeout waitFor's deadline is not a real timer, so nothing here is unjustified; a leftover
        // baseline entry for such a file is then reported as stale below like any other.
        const reportable = installsFakeTimers ? [] : candidates;
        const count = reportable.length;
        if (count > allowed) {
          for (const { node, name } of reportable.slice(allowed)) {
            context.report({ node, messageId: "wallClock", data: { name, count: String(count), allowed: String(allowed) } });
          }
        } else if (count < allowed) {
          context.report({
            node: program,
            loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
            messageId: "staleBaseline",
            data: { allowed: String(allowed), count: String(count), deleteHint: count === 0 ? " (delete the entry)" : "" },
          });
        }
      },
    };
  },
};
