/**
 * ESLint rule: require-error-before-empty-state (TASK-7195 done-when #4)
 *
 * The four-state rule: a fetched resource must distinguish loading | error | empty | populated.
 * When a render chain checks "are we loading" and "is the list empty" but never rules out "did
 * the fetch fail" in between, a failed load renders the same UI as a genuine zero-result — a
 * confident factual negative ("No bookings yet", "All accounts are settled") on data that was
 * never actually read. On a money worklist that is a trust defect, not a cosmetic one.
 *
 * This rule looks at JSX ternary chains ( a ? <X/> : b ? <Y/> : <Z/> ) that branch on both a
 * loading-ish test and an emptiness test (`list.length === 0` and friends). If the enclosing
 * component tracks an error/failure state (a top-level `error`, `fetchError`, `apiError`,
 * `loadFailed`, etc. binding — however it was declared: useState, a plain const, or destructured
 * off a hook like useResourceState), that tracked state must be checked at or before the
 * emptiness test. If it never is, this is exactly the shape of the live defect this task found in
 * Bookings.tsx: `fetchError` is tracked, but the loading/empty ternary never consults it.
 *
 * This rule deliberately does NOT require importing any particular hook — mandating an import is
 * trivially satisfied and catches nothing. It looks at the actual render-decision shape instead.
 *
 * Known scope (see the rule's test file and the task report for the full reasoning):
 *   - Only ConditionalExpression ("ternary") chains used in JSX are inspected. A standalone
 *     `list.length === 0 && <Empty/>` logical-AND guard (not part of a ternary) is out of scope
 *     for this first version.
 *   - A chain must exhibit BOTH a loading-ish test and an emptiness test to be considered a
 *     "resource render chain" at all — this is what keeps the rule from firing on unrelated
 *     `.length === 0` ternaries that have nothing to do with a fetch (e.g. a local dropdown's
 *     "no matches" branch, which never has a sibling loading branch).
 *   - The enclosing component must have at least one top-level binding whose name looks
 *     error/failure-shaped for the rule to have anything to complain about. A component that
 *     tracks no error state at all is a different (also real, but different) problem than the one
 *     this task is closing.
 *
 * Escape hatch: same-line `// four-state-ok: <reason>` comment on the emptiness-test line.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
"use strict";

function buildMessage(errorNames) {
  // Setter-shaped bindings (setFetchError) match the same name heuristic as their getter — that's
  // fine for detection, but listing both in the message is just noise. Prefer the non-setter
  // names for display; fall back to the full set on the rare chance only a setter-shaped name
  // matched at all.
  const all = Array.from(errorNames).sort();
  const nonSetters = all.filter((n) => !/^set[A-Z]/.test(n));
  const names = (nonSetters.length > 0 ? nonSetters : all).join(", ");
  return (
    "Four-state violation (TASK-7195): this empty-state check runs without first ruling out a " +
    `tracked load error (component tracks: ${names}) — on a failed fetch this renders a confident ` +
    '"nothing here" instead of the failure. Add an error branch ahead of the emptiness check (see ' +
    "useResourceState in src/hooks/useResourceState.ts, or check the tracked flag directly), or add " +
    "a same-line `// four-state-ok: <reason>` escape hatch."
  );
}

function isErrorLikeName(name) {
  if (!name) return false;
  return /error/i.test(name) || /failed/i.test(name) || /failure/i.test(name);
}

/** Bounded, finite walk over a destructuring/binding pattern only — never touches `.parent`. */
function collectNamesFromPattern(pattern, names) {
  if (!pattern || typeof pattern !== "object") return;
  if (pattern.type === "Identifier") {
    if (isErrorLikeName(pattern.name)) names.add(pattern.name);
    return;
  }
  if (pattern.type === "ArrayPattern") {
    for (const el of pattern.elements) collectNamesFromPattern(el, names);
    return;
  }
  if (pattern.type === "ObjectPattern") {
    for (const prop of pattern.properties) {
      if (prop.type === "Property") collectNamesFromPattern(prop.value, names);
      else if (prop.type === "RestElement") collectNamesFromPattern(prop.argument, names);
    }
    return;
  }
  if (pattern.type === "AssignmentPattern") {
    collectNamesFromPattern(pattern.left, names);
    return;
  }
  if (pattern.type === "RestElement") {
    collectNamesFromPattern(pattern.argument, names);
  }
}

/**
 * Every top-level `const`/`let`/`var` binding (and every function parameter) directly in the
 * component's own body counts — this is how useState pairs, plain derived consts (`const
 * loadFailed = resourceState.status === "error"`), and destructured hook results
 * (`const { isError: loadFailed } = useResourceState(...)`) are all picked up the same way,
 * regardless of which of the three shapes the component happens to use.
 */
function collectErrorLikeNames(componentFn) {
  const names = new Set();
  if (!componentFn) return names;

  for (const param of componentFn.params || []) {
    collectNamesFromPattern(param, names);
  }

  if (!componentFn.body || componentFn.body.type !== "BlockStatement") return names;
  for (const stmt of componentFn.body.body) {
    if (stmt.type !== "VariableDeclaration") continue;
    for (const decl of stmt.declarations) {
      collectNamesFromPattern(decl.id, names);
    }
  }
  return names;
}

/**
 * Walk upward via `.parent` only (Program-ward, strictly finite, cannot cycle — this is the safe
 * direction; see TASK-7459 / no-coerce-numeric-onchange.cjs for why a DOWNWARD walk must never
 * treat `.parent` as a traversable edge). Returns the outermost function-like ancestor, i.e. the
 * page/component function itself even when `node` is nested inside an inline useCallback or a
 * `.map()` render callback.
 */
function findComponentFunction(node) {
  let cur = node;
  let outer = null;
  while (cur) {
    if (
      cur.type === "FunctionDeclaration" ||
      cur.type === "FunctionExpression" ||
      cur.type === "ArrowFunctionExpression"
    ) {
      outer = cur;
    }
    cur = cur.parent;
  }
  return outer;
}

function referencesAnyName(text, names) {
  for (const n of names) {
    if (new RegExp(`\\b${n}\\b`).test(text)) return true;
  }
  return false;
}

function unwrapChain(node) {
  return node && node.type === "ChainExpression" ? node.expression : node;
}

function isLengthMember(node) {
  node = unwrapChain(node);
  return !!(node && node.type === "MemberExpression" && !node.computed && node.property && node.property.name === "length");
}

function nodeIsLengthZeroCheck(node) {
  node = unwrapChain(node);
  if (!node) return false;
  if (node.type === "BinaryExpression") {
    const isZero = (n) => n && n.type === "Literal" && n.value === 0;
    const isOne = (n) => n && n.type === "Literal" && n.value === 1;
    if ((node.operator === "===" || node.operator === "==") && (
      (isLengthMember(node.left) && isZero(node.right)) ||
      (isLengthMember(node.right) && isZero(node.left))
    )) return true;
    if (node.operator === "<" && isLengthMember(node.left) && isOne(node.right)) return true;
    return false;
  }
  if (node.type === "UnaryExpression" && node.operator === "!") {
    return isLengthMember(node.argument);
  }
  return false;
}

/** Bounded — only ever descends into `.left`/`.right` of a `&&` chain; cannot cycle. */
function decomposeAnd(node, out) {
  const n = unwrapChain(node);
  if (n && n.type === "LogicalExpression" && n.operator === "&&") {
    decomposeAnd(n.left, out);
    decomposeAnd(n.right, out);
  } else {
    out.push(node);
  }
  return out;
}

/** 'positive' for `loading`, 'negative' for `!loading`, else null. Operates on ONE identifier at
 * a time so a plain substring test for "loading" is safe (no camelCase word-boundary pitfall). */
function loadingFlagPolarity(node) {
  const n = unwrapChain(node);
  if (!n) return null;
  if (n.type === "UnaryExpression" && n.operator === "!") {
    const inner = loadingFlagPolarity(n.argument);
    if (inner === "positive") return "negative";
    if (inner === "negative") return "positive";
    return null;
  }
  if (n.type === "Identifier") {
    return /loading/i.test(n.name) ? "positive" : null;
  }
  if (n.type === "MemberExpression" && !n.computed && n.property && n.property.type === "Identifier") {
    return /loading/i.test(n.property.name) ? "positive" : null;
  }
  return null;
}

function textLooksEmptyShaped(text) {
  if (/\bempty\b/i.test(text)) return true;
  if (/[\w$]Empty\b/.test(text)) return true;
  if (/\.status\s*===?\s*["']empty["']/.test(text)) return true;
  return false;
}

/**
 * Classify one ternary `test` expression into 'error' | 'loading' | 'empty' | 'other'.
 * Priority: an explicit reference to a tracked error/failure binding always wins; a bare
 * *positive* loading flag (`loading`, not `!loading`) wins next, because `loading && list.length
 * === 0` is a "still fetching, nothing yet" skeleton guard, not an empty-result claim; only then
 * does an emptiness shape resolve to 'empty'.
 */
function classifyTest(testNode, sourceCode, errorNames) {
  const operands = decomposeAnd(testNode, []);

  let hasEmpty = false;
  let hasPositiveLoading = false;
  let errorHit = false;

  for (const op of operands) {
    const text = sourceCode.getText(op);
    if (errorNames.size > 0 && referencesAnyName(text, errorNames)) errorHit = true;
    if (nodeIsLengthZeroCheck(op) || textLooksEmptyShaped(text)) hasEmpty = true;
    if (loadingFlagPolarity(op) === "positive") hasPositiveLoading = true;
  }

  if (errorHit) return "error";
  if (hasPositiveLoading) return "loading";
  if (hasEmpty) return "empty";

  const wholeText = sourceCode.getText(testNode);
  if (/\.status\s*===?\s*["']loading["']/.test(wholeText)) return "loading";
  return "other";
}

function isJsxish(node) {
  if (!node) return false;
  if (node.type === "JSXElement" || node.type === "JSXFragment") return true;
  if (node.type === "ConditionalExpression") return isJsxish(node.consequent) || isJsxish(node.alternate);
  return false;
}

/** Bounded by chain length — only ever follows `.alternate`, and each step lands on a brand new
 * node, so this cannot cycle even without the `seen` guard; the guard is belt-and-braces. */
function flattenChain(head) {
  const tests = [];
  let cur = head;
  const seen = new Set();
  while (cur && cur.type === "ConditionalExpression" && !seen.has(cur)) {
    seen.add(cur);
    tests.push({ test: cur.test, consequent: cur.consequent });
    cur = cur.alternate;
  }
  return { tests, finalAlternate: cur };
}

function hasFourStateOkMarker(sourceCode, node) {
  const line = node.loc.start.line;
  return sourceCode.getAllComments().some(
    (c) => c.loc.start.line === line && /four-state-ok:/.test(c.value),
  );
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a tracked load-error state to be checked before an empty-state branch renders (TASK-7195)",
      category: "Best Practices",
      recommended: "error",
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const errorNamesCache = new WeakMap();

    return {
      ConditionalExpression(node) {
        // Only process chain heads — a node that is itself the `alternate` of a parent
        // ConditionalExpression is already covered as part of that parent's chain.
        if (node.parent && node.parent.type === "ConditionalExpression" && node.parent.alternate === node) {
          return;
        }

        const { tests, finalAlternate } = flattenChain(node);
        if (tests.length === 0) return;

        const hasJsx = tests.some((t) => isJsxish(t.consequent)) || isJsxish(finalAlternate);
        if (!hasJsx) return;

        const componentFn = findComponentFunction(node);
        if (!componentFn) return;

        let errorNames = errorNamesCache.get(componentFn);
        if (!errorNames) {
          errorNames = collectErrorLikeNames(componentFn);
          errorNamesCache.set(componentFn, errorNames);
        }
        if (errorNames.size === 0) return; // nothing tracked — out of scope for this rule

        const categories = tests.map((t) => classifyTest(t.test, sourceCode, errorNames));

        const loadingIdx = categories.indexOf("loading");
        const emptyIdx = categories.indexOf("empty");
        if (loadingIdx === -1 || emptyIdx === -1) return; // not a loading+empty resource chain

        const errorSeenInTime = categories.slice(0, emptyIdx + 1).includes("error");
        if (errorSeenInTime) return;

        const emptyTestNode = tests[emptyIdx].test;
        if (hasFourStateOkMarker(sourceCode, emptyTestNode)) return;

        context.report({ node: emptyTestNode, message: buildMessage(errorNames) });
      },
    };
  },
};
