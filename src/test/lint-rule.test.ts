// @trace NFR-9
import { RuleTester, ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
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
    { code: 'const a = <p>{ok ? t("a") : t("b")}</p>;' },
    { code: 'const a = <p>{err && t("a")}</p>;' },
    { code: 'const a = <p>{`${t("a")} · ${n}`}</p>;' },
    { code: 'const a = <option value="cs">{t("lang.cs")}</option>;' },
    { code: 'const a = <input type="text" value={v} name="answer" inputMode="decimal" />;' },
    { code: 'const a = <Icon name="check" size={20} />;' },
    { code: 'const a = <ChoiceGroup name="q1" legend={t("q")} options={o} />;' },
    { code: 'const a = <Button variant="primary" type="submit" icon="bolt">{t("go")}</Button>;' },
    { code: 'const a = <Panel tone="hero" subject="math" accent="#ff0000" className="x" />;' },
    { code: 'const a = <a href="/admin" rel="noopener" target="_blank">{t("a")}</a>;' },
  ],
  invalid: [
    { code: 'const a = <h1>Doučko</h1>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <p>Skoro! {t("x")}</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <button aria-label="Zavřít" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <img alt="Hero" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <input placeholder={"Type here"} />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <abbr title="Experience points" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <p>{"Hello"}</p>;', errors: [{ messageId: 'text' }] },
    // Literals inside expressions
    { code: 'const a = <p>{ok ? "Hotovo" : t("x")}</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <p>{err && "Chyba"}</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <p>{label ?? "Zavřít"}</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <p>{`Úroveň ${n}`}</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <p>{t("a") + " bodů"}</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <button aria-label={open ? "Zavřít" : "Otevřít"} />;', errors: [{ messageId: 'attr' }, { messageId: 'attr' }] },
    // Other accessible-name and visible-value attributes
    { code: 'const a = <div aria-description="Mise" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <div role="meter" aria-valuetext="Polovina" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <section aria-roledescription="karta" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <input type="submit" value="Odeslat" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <h1 children="Doučko" />;', errors: [{ messageId: 'attr' }] },
    // Text props of components (design system and app)
    { code: 'const a = <Icon name="check" label="Hotovo" />;', errors: [{ messageId: 'attr' }] },
    { code: 'const a = <Panel ariaLabel="Mise" kicker="Dnes" />;', errors: [{ messageId: 'attr' }, { messageId: 'attr' }] },
    { code: 'const a = <SubjectTile name="Matematika" meta={`${n} úloh`} />;', errors: [{ messageId: 'attr' }, { messageId: 'attr' }] },
    { code: 'const a = <AnswerPart unit="cm" placeholder="Tvoje odpověď" />;', errors: [{ messageId: 'attr' }, { messageId: 'attr' }] },
  ],
});

describe('lint wiring (NFR-9)', () => {
  it('npm run lint reports literal text in a src/ component as an error', async () => {
    const eslint = new ESLint();
    const [result] = await eslint.lintText('export const X = () => <h1>Doučko</h1>;\n', {
      filePath: 'src/features/probe/Probe.tsx',
    });
    const hits = result.messages.filter((m) => m.ruleId === 'doucko/no-literal-ui-text');
    expect(hits.map((m) => m.severity)).toEqual([2]);
  });
});
