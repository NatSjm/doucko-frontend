// doucko/no-literal-ui-text (NFR-9): every visible string and accessible name comes from the
// message catalog (src/i18n), never from a literal in a component.
//
// Reports a string with a letter that can end up on screen or in the accessibility tree:
//   - JSX text: <h1>Doučko</h1>, <p>Skoro! {t('x')}</p>
//   - a literal anywhere a JSX child expression can yield it: {'Hello'}, {ok ? 'Ano' : t('x')},
//     {err && 'Chyba'}, {label ?? 'Zavřít'}, {`Úroveň ${n}`}, {t('a') + ' bodů'}
//   - the same inside a text attribute of a DOM element: aria-label, aria-description,
//     aria-roledescription, aria-valuetext, aria-placeholder, aria-braillelabel, title, alt,
//     placeholder, children, label, defaultValue and value on <textarea> and every <input> whose type
//     shows its value (any but hidden/checkbox/radio/range/color/file/image)
//   - the same inside any prop of a component (PascalCase), except props that never carry text
//     (NON_TEXT_PROPS, plus `name` on components where it is an identifier)
//   - literals nested in arrays and objects ({ label: 'Ano' }, except identifier keys such as
//     `value`), template expressions, TS wrappers (`as`, `satisfies`, `!`), call receivers and
//     arguments ('Ahoj'.toUpperCase(), items.join(' a ')) and what callbacks return
//     (items.map(() => 'Ahoj')); t('key') is exempt
//   - a literal assigned to document.title (or window./globalThis.document.title), in .ts and .tsx files
// Allows punctuation-only text (" · ", "/"), whitespace, and every expression ({t('key')}).
// Not seen (static analysis cannot follow them): text reached through a variable or another module,
// and spread attributes. The pseudo-catalog render test (src/app/i18n-coverage.test.tsx) is the
// backstop for those.

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
  "label",
]);
/** Elements whose `defaultValue` is shown in the field. */
const DEFAULT_VALUE_ELEMENTS = new Set(["input", "textarea"]);
/** Component props that hold identifiers, styling or behaviour, never UI text. */
const NON_TEXT_PROPS = new Set([
  "className", "id", "key", "variant", "tone", "size", "type", "kind", "state", "subject", "accent", "icon", "iconAfter",
  "href", "to", "rel", "target", "role", "lang", "translationLang", "htmlFor", "inputMode", "autoComplete", "method",
  "as", "color", "align", "src", "srcSet", "testId",
  // A problem field path (contract "Field paths", e.g. `parts[0].spec.accepted[1]`), never shown.
  "path",
]);
/** Components whose `name` is an identifier (icon name, form-field name), not a display name. */
const NAME_IS_IDENTIFIER = new Set(["Icon", "ChoiceGroup"]);

/** Object keys inside a text prop that hold identifiers, not text ({ value: 'a', label: t('yes') }). */
const NON_TEXT_KEYS = new Set([...NON_TEXT_PROPS, "value"]);

/** Locale formatting: n.toLocaleString('cs-CZ', { style: 'percent' }) takes a locale and options, not text. */
const isLocaleFormatting = (callee) =>
  callee.type === "MemberExpression" &&
  callee.property.type === "Identifier" &&
  /^(toLocale\w*|localeCompare)$/.test(callee.property.name);

/** Intl formatters whose methods never take display text. */
const INTL_NON_TEXT = new Set(["NumberFormat", "DateTimeFormat", "RelativeTimeFormat", "PluralRules", "DisplayNames", "DurationFormat"]);

/** `X` when `node` is `Intl.X(...)` or `new Intl.X(...)`, else null. */
const intlConstructor = (node) =>
  (node?.type === "NewExpression" || node?.type === "CallExpression") &&
  node.callee.type === "MemberExpression" &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === "Intl" &&
  node.callee.property.type === "Identifier"
    ? node.callee.property.name
    : null;

/** Functions whose string argument is a catalog key. */
const CATALOG_LOOKUPS = new Set(["t"]);
/** Input types whose `value` is not shown as text in the field. */
const NON_TEXT_INPUT_TYPES = new Set(["hidden", "checkbox", "radio", "range", "color", "file", "image"]);

const hasLetter = (s) => /\p{L}/u.test(s);
const propertyKey = (p) => (p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? String(p.key.value) : null);

/** Literal strings with a letter that `node` can evaluate to (or contain, for templates, + and collections). */
function literalTexts(node) {
  if (!node) return [];
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" && hasLetter(node.value) ? [node.value] : [];
    case "TemplateLiteral":
      return [...node.quasis.map((q) => q.value.cooked ?? "").filter(hasLetter), ...node.expressions.flatMap(literalTexts)];
    case "ArrayExpression":
      return node.elements.flatMap((e) => literalTexts(e?.type === "SpreadElement" ? e.argument : e));
    case "ObjectExpression":
      return node.properties.flatMap((p) => (p.type === "Property" && !NON_TEXT_KEYS.has(propertyKey(p)) ? literalTexts(p.value) : []));
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
    case "ChainExpression":
      return literalTexts(node.expression);
    case "CallExpression": {
      // t('key') is the catalog lookup; its argument is a key, not text.
      if (node.callee.type === "Identifier" && CATALOG_LOOKUPS.has(node.callee.name)) return [];
      // Locale and format options are not text; a literal receiver ('Ahoj'.toLocaleUpperCase()) still is.
      if (isLocaleFormatting(node.callee)) return literalTexts(node.callee.object);
      // Intl.X('cs', {...}) with or without `new`: locale and options. Only the formatters whose methods
      // take numbers, dates and identifiers (format(n, 'day'), of('cs'), select(n)) are exempt; any other
      // (ListFormat formats the strings it gets, Segmenter returns its input) is checked below.
      if (intlConstructor(node)) return [];
      if (node.callee.type === "MemberExpression" && INTL_NON_TEXT.has(intlConstructor(node.callee.object))) return [];
      // 'Ahoj'.toUpperCase(), items.join(' a '), format('Ahoj {n}', n), items.map(() => 'Ahoj'):
      // the receiver, the arguments and what a callback argument returns.
      const receiver = node.callee.type === "MemberExpression" ? literalTexts(node.callee.object) : [];
      return [...receiver, ...node.arguments.flatMap((a) => literalTexts(a.type === "SpreadElement" ? a.argument : a))];
    }
    case "ArrowFunctionExpression":
      return node.body.type === "BlockStatement" ? returnedTexts(node.body) : literalTexts(node.body);
    case "FunctionExpression":
      return returnedTexts(node.body);
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

/** Literal texts the `return` statements of a function body can produce (nested functions excluded). */
function returnedTexts(body) {
  const out = [];
  const walk = (n) => {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "ReturnStatement") return out.push(...literalTexts(n.argument));
    if (/Function/.test(n.type)) return;
    for (const [k, v] of Object.entries(n)) {
      if (k === "parent") continue;
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  body.body.forEach(walk);
  return out;
}

function elementName(opening) {
  const n = opening.name;
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXMemberExpression") return n.property.name;
  return null;
}

function staticAttribute(opening, name) {
  const attr = opening.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === name);
  const value = attr?.value?.type === "JSXExpressionContainer" ? attr.value.expression : attr?.value;
  return value?.type === "Literal" ? value.value : null;
}

function isTextAttribute(opening, prop) {
  const element = elementName(opening);
  if (!element) return false;
  if (/^[A-Z]/.test(element)) {
    if (prop.startsWith("data-") || prop.startsWith("on") || NON_TEXT_PROPS.has(prop)) return false;
    return !(prop === "name" && NAME_IS_IDENTIFIER.has(element));
  }
  if (DOM_TEXT_ATTRIBUTES.has(prop)) return true;
  if (prop === "defaultValue") return DEFAULT_VALUE_ELEMENTS.has(element);
  if (prop !== "value") return false;
  if (element === "textarea") return true;
  // A text-like input shows its value; a type that is not static could be any of them.
  if (element === "input") return !NON_TEXT_INPUT_TYPES.has(staticAttribute(opening, "type"));
  return false;
}

/** `document`, `window.document` or `globalThis.document`. */
const isDocument = (n) =>
  (n.type === "Identifier" && n.name === "document") ||
  (n.type === "MemberExpression" && n.property.type === "Identifier" && n.property.name === "document" &&
    n.object.type === "Identifier" && ["window", "globalThis", "self"].includes(n.object.name));

export default {
  meta: {
    type: "problem",
    docs: { description: "UI text must come from the message catalog (src/i18n), not a literal (NFR-9)." },
    schema: [],
    messages: {
      text: "Literal UI text {{text}}: put it in the message catalog (src/i18n) and render t('<key>') (NFR-9).",
      attr: "Literal {{name}} {{text}}: put it in the message catalog (src/i18n) and pass t('<key>') (NFR-9).",
      title: "Literal document title {{text}}: put it in the message catalog (src/i18n) and assign t('<key>') (NFR-9).",
    },
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        const left = node.left;
        const isTitle =
          left.type === "MemberExpression" &&
          isDocument(left.object) &&
          ((left.property.type === "Identifier" && left.property.name === "title") || left.property.value === "title");
        if (isTitle) for (const text of literalTexts(node.right)) context.report({ node, messageId: "title", data: { text: JSON.stringify(text) } });
      },
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
