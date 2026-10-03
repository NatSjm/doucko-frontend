// @trace NFR-9
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../eslint-rules/no-literal-ui-text.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2023, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('doucko/no-literal-ui-text', rule, {
  valid: [
    { code: 'const a = <h1>{t("app.name")}</h1>;' },
    { code: 'const a = <button aria-label={t("x")} />;' },
    { code: 'const a = <div className="dk-t-title" data-testid="shell" />;' },
    { code: 'const a = <p> {t("a")} · {t("b")} </p>;' },
    { code: 'const a = <span>{"  "}</span>;' },
  ],
  invalid: [
    { code: 'const a = <h1>Doučko</h1>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <p>Skoro! {t("x")}</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <button aria-label="Zavřít" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <img alt="Hero" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <input placeholder={"Type here"} />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <abbr title="Experience points" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <p>{"Hello"}</p>;', errors: [{ messageId: 'text' }] },
  ],
});
