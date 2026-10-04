// doucko/no-literal-ui-text (NFR-9): every visible string and accessible name comes from the
// message catalog (src/i18n), never from a literal in a component.
//
// Reports a string with a letter that can end up on screen or in the accessibility tree:
//   - JSX text: <h1>Doučko</h1>, <p>Skoro! {t('x')}</p>
//   - a literal anywhere a JSX child expression can yield it: {'Hello'}, {ok ? 'Ano' : t('x')},
//     {err && 'Chyba'}, {label ?? 'Zavřít'}, {`Úroveň ${n}`}, {t('a') + ' bodů'}
//   - the same inside a text attribute of a DOM element: aria-label, aria-description,
//     aria-roledescription, aria-valuetext, aria-placeholder, aria-braillelabel, title, alt,
//     placeholder, children, and value on <input type="submit|button|reset">
//   - the same inside any prop of a component (PascalCase), except props that never carry text
//     (NON_TEXT_PROPS, plus `name` on components where it is an identifier)
// Allows punctuation-only text (" · ", "/"), whitespace, and every expression ({t('key')}).

const DOM_TEXT_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "aria-braillelabel",
  "aria-brailleroledescription",
  "title",
  "alt",
  "placeholder",
  "children",
]);
const VISIBLE_VALUE_INPUT_TYPES = new Set(["submit", "button", "reset"]);
/** Component props that hold identifiers, styling or behaviour, never UI text. */
const NON_TEXT_PROPS = new Set([
  "className", "id", "key", "variant", "tone", "size", "type", "kind", "state", "subject", "accent", "icon", "iconAfter",
  "href", "to", "rel", "target", "role", "lang", "translationLang", "htmlFor", "inputMode", "autoComplete", "method",
  "as", "color", "align", "src", "srcSet", "testId",
]);
/** Components whose `name` is an identifier (icon name, form-field name), not a display name. */
const NAME_IS_IDENTIFIER = new Set(["Icon", "ChoiceGroup"]);

const hasLetter = (s) => /\p{L}/u.test(s);

/** Literal strings with a letter that `node` can evaluate to (or contain, for templates and +). */
function literalTexts(node) {
  if (!node) return [];
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" && hasLetter(node.value) ? [node.value] : [];
    case "TemplateLiteral":
      return node.quasis.map((q) => q.value.cooked ?? "").filter(hasLetter);
    case "ConditionalExpression":
      return [...literalTexts(node.consequent), ...literalTexts(node.alternate)];
    case "LogicalExpression":
      return [...literalTexts(node.left), ...literalTexts(node.right)];
    case "BinaryExpression":
      return node.operator === "+" ? [...literalTexts(node.left), ...literalTexts(node.right)] : [];
    case "JSXExpressionContainer":
      return literalTexts(node.expression);
    default:
      return [];
  }
}

function elementName(opening) {
  const n = opening.name;
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXMemberExpression") return n.property.name;
  return null;
}

function staticAttribute(opening, name) {
  const attr = opening.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === name);
  return attr?.value?.type === "Literal" ? attr.value.value : null;
}

function isTextAttribute(opening, prop) {
  const element = elementName(opening);
  if (!element) return false;
  if (/^[A-Z]/.test(element)) {
    if (prop.startsWith("data-") || prop.startsWith("on") || NON_TEXT_PROPS.has(prop)) return false;
    return !(prop === "name" && NAME_IS_IDENTIFIER.has(element));
  }
  if (DOM_TEXT_ATTRIBUTES.has(prop)) return true;
  return prop === "value" && element === "input" && VISIBLE_VALUE_INPUT_TYPES.has(staticAttribute(opening, "type"));
}

export default {
  meta: {
    type: "problem",
    docs: { description: "UI text must come from the message catalog (src/i18n), not a literal (NFR-9)." },
    schema: [],
    messages: {
      text: "Literal UI text {{text}}: put it in the message catalog (src/i18n) and render t('<key>') (NFR-9).",
      attr: "Literal {{name}} {{text}}: put it in the message catalog (src/i18n) and pass t('<key>') (NFR-9).",
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (hasLetter(node.value)) context.report({ node, messageId: "text", data: { text: JSON.stringify(node.value.trim()) } });
      },
      JSXExpressionContainer(node) {
        if (node.parent.type === "JSXAttribute") return;
        for (const text of literalTexts(node.expression)) context.report({ node, messageId: "text", data: { text: JSON.stringify(text) } });
      },
      JSXAttribute(node) {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : null;
        if (!name || !node.value || !isTextAttribute(node.parent, name)) return;
        for (const text of literalTexts(node.value)) context.report({ node, messageId: "attr", data: { name, text: JSON.stringify(text) } });
      },
    };
  },
};
