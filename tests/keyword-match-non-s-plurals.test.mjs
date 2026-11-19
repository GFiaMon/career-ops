// tests/keyword-match-non-s-plurals.test.mjs — a JD keyword in a non-`-s`
// plural has to reach the singular its CV uses.
//
// variantForms() built candidates by adding or stripping a trailing `s` only.
// German, Dutch and Polish form plurals with `-en`, `-n` or `-e`, so every one
// of them was unreachable: the German JD keyword `Klassifizierungen` came back
// missing against a `cv.de.md` that says `Klassifizierung`, and the two are the
// same word. Measured over one user's 62 composed applications, tailoring
// raised coverage by +11.0 points for English CVs and +8.5 for German ones.
//
// The guards below are the other half: they pass before and after the fix, and
// fail if the new suffix rules are widened to strip short stems or to stem
// inside a longer word.
import assert from 'node:assert/strict';
import { analyzeCoverage, variantForms } from '../keyword-match.mjs';
import { pass, fail } from './helpers.mjs';

console.log('\nkeyword-match: plurals in languages that do not use -s');

function check(label, run) {
  try { run(); pass(label); } catch (error) { fail(`${label}: ${error.message}`); }
}

/** Whether keyword-match counts `keyword` as present in `cv`. */
const found = (keyword, cv) => analyzeCoverage([keyword], cv).present.includes(keyword);

check('a German plural keyword matches the singular on the CV', () => {
  for (const [keyword, cv] of [
    ['Klassifizierungen', 'Regression und Klassifizierung mit scikit-learn.'],
    ['Prognosen', 'Prognose von Zeitreihen im Betrieb.'],
    ['Modelle', 'Ein Modell in den produktiven Betrieb gebracht.'],
    ['Datenquellen', 'Mehrere Datenquelle-Systeme angebunden.'],
    ['Agenten', 'Einen Agent mit LangGraph gebaut.'],
  ]) {
    assert.ok(found(keyword, cv), `${keyword} in "${cv}"`);
  }
});

check('the singular is among the candidate forms', () => {
  assert.ok(variantForms('Klassifizierungen').includes('klassifizierung'));
  assert.ok(variantForms('Prognosen').includes('prognose'));
  assert.ok(variantForms('Modelle').includes('modell'));
});

check('the same rule reaches Dutch and Polish plurals', () => {
  assert.ok(found('pijplijnen', 'Een pijplijn in productie.'), 'nl: pijplijnen -> pijplijn');
  assert.ok(found('modele', 'Zbudowałem model w Pythonie.'), 'pl: modele -> model');
});

check('the English -s rules are unchanged', () => {
  assert.ok(found('LLM', 'Built agents with LLMs.'), 'LLM -> LLMs');
  assert.ok(found('Large Language Models', 'Built agents with LLMs.'), 'synonym group still reached');
  assert.deepEqual(variantForms('aws'), ['aws'], 'three-letter -s token never stripped');
  assert.deepEqual(variantForms('it'), ['it'], 'two-letter token gets no variant');
  assert.ok(!found('java', 'Senior javascript developer.'), 'boundaries still hold');
});

check('a stem shorter than five characters is never produced', () => {
  // `tage` -> `tag` would make the German JD word for "days" match a CV
  // mentioning a `tag`, so the floor is part of the rule, not a detail.
  assert.ok(!variantForms('tage').includes('tag'));
  assert.ok(!variantForms('oben').includes('ob'));
  assert.ok(!found('Tage', 'Tag a release with semver.'));
  // `daten` -> `date` is why the floor is five and not four: unlike
  // `kubernete`, `date` is a word an English CV carries for its own reasons,
  // so the stem would report a German keyword as covered when it is not.
  assert.ok(!variantForms('daten').includes('date'));
  assert.ok(!found('Daten', 'Delivered on the agreed date.'));
});

check('a candidate stem still cannot match inside a longer word', () => {
  // The boundary-aware counting is what makes the extra forms safe: the
  // `prognos` form produced from `Prognosen` must not hit `Prognostiker`.
  assert.ok(!found('Prognosen', 'Arbeit als Prognostiker im Team.'));
  assert.ok(!found('Modelle', 'Modellierung von Daten.'));
});
