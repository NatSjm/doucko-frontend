// doucko/no-literal-ui-text (NFR-9): every visible string and accessible name comes from the
// message catalog (src/i18n), never from a literal in a component.
//
// Reports:
//   - JSX text that contains a letter: <h1>Doučko</h1>, <p>Skoro! {t('x')}</p>
//   - a string literal rendered as a JSX child: <p>{'Hello'}</p>
//   - a string literal in aria-label, title, alt or placeholder, quoted or in braces
// Allows punctuation-only text (" · ", "/"), whitespace, and every expression ({t('key')}).

const TEXT_ATTRIBUTES = new Set(["aria-label", "title", "alt", "placeholder"]);
const hasLetter = (s) => /\p{L}/u.test(s);
const isStringLiteral = (node) =>
  (node?.type === "Literal" && typeof node.value === "string") ||
  (node?.type === "TemplateLiteral" && node.expressions.length === 0);
const literalText = (node) => (node.type === "Literal" ? node.value : node.quasis[0].value.cooked);

export default {
  meta: {
    type: "problem",
    docs: { description: "UI text must come from the message catalog (src/i18n), not a literal (NFR-9)." },
    schema: [],
    messages: {
      text: "Literal UI text {{text}}: put it in the message catalog (src/i18n) and render t('<key>') (NFR-9).",
      attr: "Literal {{name}}: put it in the message catalog (src/i18n) and pass t('<key>') (NFR-9).",
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (hasLetter(node.value)) context.report({ node, messageId: "text", data: { text: JSON.stringify(node.value.trim()) } });
      },
      JSXExpressionContainer(node) {
        const expr = node.expression;
        if (node.parent.type !== "JSXAttribute" && isStringLiteral(expr) && hasLetter(literalText(expr)))
          context.report({ node, messageId: "text", data: { text: JSON.stringify(literalText(expr)) } });
      },
      JSXAttribute(node) {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : null;
        if (!name || !TEXT_ATTRIBUTES.has(name) || !node.value) return;
        const value = node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        if (isStringLiteral(value) && hasLetter(literalText(value))) context.report({ node, messageId: "attr", data: { name } });
      },
    };
  },
};
