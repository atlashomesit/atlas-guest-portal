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
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;

    if (cur.type === "LogicalExpression" && logicalOrCoercion(cur)) return true;
    if (cur.type === "CallExpression" && isNumericCoercion(cur)) return true;

    for (const key of Object.keys(cur)) {
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
