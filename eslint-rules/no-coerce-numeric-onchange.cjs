/**
 * ESLint rule: no-coerce-numeric-onchange (TASK-6014)
 *
 * Bans the mobile-unclearable-number-field anti-pattern: coercing `*.target.value` with
 * Number()/parseInt()/parseFloat() and feeding the result through `|| fallback` or Math.max/min
 * inside an onChange handler.
 *
 * Use `toEditableInt` + `clampMin` from `src/utils/numericInput.ts` instead.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
"use strict";

const MESSAGE =
  "Unclearable numeric field: do not coerce event.target.value with Number/parseInt/parseFloat " +
  "and a || fallback (or Math.max/min) inside onChange — mobile keyboards cannot clear the field. " +
  "Use toEditableInt() on change and clampMin() on blur/submit (see src/utils/numericInput.ts).";

function isTargetValue(node) {
  return (
    node &&
    node.type === "MemberExpression" &&
    node.object &&
    node.object.type === "MemberExpression" &&
    node.object.property &&
    node.object.property.name === "target" &&
    node.property &&
    node.property.name === "value"
  );
}

function isNumericCoercion(node) {
  if (!node || node.type !== "CallExpression") return false;
  const { callee } = node;
  if (callee.type === "Identifier" && (callee.name === "Number" || callee.name === "parseInt" || callee.name === "parseFloat")) {
    return node.arguments.some(isTargetValue);
  }
  if (callee.type === "MemberExpression" && callee.object && callee.object.name === "Math") {
    const fn = callee.property && callee.property.name;
    if (fn === "max" || fn === "min") {
      return node.arguments.some((arg) => {
        if (arg.type === "LogicalExpression" && arg.operator === "||") return true;
        if (isNumericCoercion(arg)) return true;
        if (arg.type === "CallExpression" && isNumericCoercion(arg)) return true;
        return false;
      });
    }
  }
  return false;
}

function logicalOrCoercion(node) {
  if (!node || node.type !== "LogicalExpression" || node.operator !== "||") return false;
  return isNumericCoercion(node.left);
}

function handlerCoercesNumericValue(handler) {
  if (!handler) return false;
  const body = handler.body;
  if (!body) return false;

  const stack = [body];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    // TASK-7459: the walk below must not revisit a node. Without this the traversal is
    // unbounded and V8 aborts the process with `Fatal JavaScript invalid size error` —
    // see the `parent` note below for how the cycle forms.
    if (seen.has(cur)) continue;
    seen.add(cur);

    if (cur.type === "LogicalExpression" && logicalOrCoercion(cur)) return true;
    if (cur.type === "CallExpression" && isNumericCoercion(cur)) return true;

    for (const key of Object.keys(cur)) {
      // TASK-7459 — THE BUG THIS FIXES. ESLint sets `node.parent` on every node during
      // traversal, and `parent` is an object whose `.type` is a string, so the generic
      // "push anything that looks like a node" test below matched it. The walk then cycled
      // child -> parent -> child -> parent without end, growing `stack` until V8 refused to
      // allocate and killed the process (`invalid size error`, byte-identical every run).
      // That takes down `npm run lint` for the WHOLE repo, so gate STEP 1 can never reach a
      // verdict and under MERGE-FAST nothing can be pushed at all.
      // An ESLint AST is a tree apart from these back-references, so skipping `parent` is
      // what makes the traversal finite; `seen` above is belt-and-braces for any other
      // back-reference a future parser adds (e.g. `scope`, `range` objects).
      if (key === "parent") continue;
      const val = cur[key];
      if (Array.isArray(val)) val.forEach((v) => stack.push(v));
      else if (val && typeof val.type === "string") stack.push(val);
    }
  }
  return false;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban Number(v)||N coercion inside onChange handlers (TASK-6014)",
      category: "Best Practices",
      recommended: "error",
    },
    schema: [],
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== "onChange") return;
        const value = node.value;
        if (!value) return;
        const handler =
          value.type === "JSXExpressionContainer" ? value.expression : null;
        if (!handler) return;
        if (
          (handler.type === "ArrowFunctionExpression" || handler.type === "FunctionExpression") &&
          handlerCoercesNumericValue(handler)
        ) {
          context.report({ node: handler, message: MESSAGE });
        }
      },
    };
  },
};
