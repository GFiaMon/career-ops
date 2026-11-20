// The ATS coverage panel scores the tailored CV the manifest records for a
// report, and says when it fell back to cv.md.
//
// modes/pdf.md names the pair differently (step 18 writes
// output/cv-{candidate}-{report}-{company}.html, step 21 writes the PDF with a
// -{YYYY-MM-DD} suffix), so the HTML cannot be found by swapping the PDF's
// extension. generate-pdf.mjs records it in the manifest's html column.

import "../helpers/web-ts-alias-loader.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tailoredCvForKeywordMatch } from "../../src/lib/keyword-match-cv.mjs";
import { coverageModel } from "../../src/lib/keyword-coverage.mjs";

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ENV_KEYS = ["CAREER_OPS_ROOT", "CAREER_OPS_CODE_ROOT", "CAREER_OPS_DATA_DIR", "CAREER_OPS_PROFILE", "CAREER_OPS_PDF_INDEX"];

// A workspace whose cv.md lacks the JD keyword and whose tailored CV has it,
// so the coverage number says which of the two was scored.
function workspace({ index }) {
  const root = mkdtempSync(path.join(tmpdir(), "kw-cv-index-"));
  for (const dir of ["reports", "output", "data"]) mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(path.join(root, "cv.md"), "# Jane Doe\n\nAnalyst at Globex.\n");
  writeFileSync(path.join(root, "data", "applications.md"), "# tracker\n");
  writeFileSync(path.join(root, "reports", "001-acme-2026-01-01.md"), "## Keywords extracted\n- Zorblax\n\n## Next\n");
  writeFileSync(path.join(root, "output", "cv-jane-doe-001-acme-2026-01-01.pdf"), "not a real pdf");
  writeFileSync(
    path.join(root, "output", "cv-jane-doe-001-acme.html"),
    "<html><body><p>Jane Doe used Zorblax at Globex.</p></body></html>",
  );
  if (index) {
    writeFileSync(
      path.join(root, "data", "pdf-index.tsv"),
      [
        "# report\tpdf\thtml\tformat\tdate\tkind",
        "001\toutput/cv-jane-doe-001-acme-2026-01-01.pdf\toutput/cv-jane-doe-001-acme.html\ta4\t2026-01-01\tcv",
      ].join("\n"),
    );
  }
  return root;
}

async function getPanel(root) {
  const prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  process.env.CAREER_OPS_CODE_ROOT = CODE_ROOT;
  try {
    const { GET } = await import("../../src/app/api/keyword-match/route.ts");
    const res = await GET(new Request("http://localhost/api/keyword-match?report=1"));
    return await res.json();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("the panel scores the HTML the manifest records, named the way modes/pdf.md names it", async () => {
  const root = workspace({ index: true });
  try {
    const body = await getPanel(root);
    assert.equal(body.available, true, JSON.stringify(body));
    assert.deepEqual(body.result.missing, [], "Zorblax is only on the tailored CV, so cv.md was scored");
    assert.equal(body.result.coveragePct, 100);
    assert.equal(body.cvKind, "tailored");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("with no indexed CV the panel scores cv.md and says so", async () => {
  const root = workspace({ index: false });
  try {
    const body = await getPanel(root);
    assert.equal(body.available, true, JSON.stringify(body));
    assert.equal(body.cvKind, "base");
    assert.deepEqual(body.result.missing, ["Zorblax"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a manifest html path that is gone falls back to the PDF's same-stem sibling", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kw-cv-fallback-"));
  try {
    const pdf = path.join(dir, "cv.pdf");
    const sibling = path.join(dir, "cv.html");
    writeFileSync(pdf, "pdf");
    writeFileSync(sibling, "<p>cv</p>");
    assert.equal(tailoredCvForKeywordMatch(pdf, path.join(dir, "deleted.html")), sibling);
    assert.equal(tailoredCvForKeywordMatch(pdf, null), sibling);
    // The html column must name an HTML file; anything else is not scored.
    assert.equal(tailoredCvForKeywordMatch(path.join(dir, "none.pdf"), pdf), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("coverageModel keeps which CV was scored, and only the two known kinds", () => {
  const result = { total: 1, presentCount: 1, coveragePct: 100, present: ["Go"], thin: ["Go"], missing: [] };
  assert.equal(coverageModel({ available: true, cvKind: "tailored", result }).cvKind, "tailored");
  assert.equal(coverageModel({ available: true, cvKind: "base", result }).cvKind, "base");
  // An older route sends no cvKind: the panel then names neither CV.
  assert.equal(coverageModel({ available: true, result }).cvKind, null);
  assert.equal(coverageModel({ available: true, cvKind: "master", result }).cvKind, null);
  assert.equal(coverageModel(null).cvKind, null);
});
