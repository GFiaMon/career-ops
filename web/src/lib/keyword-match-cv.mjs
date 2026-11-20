import fs from "node:fs";

/**
 * The tailored CV HTML that keyword-match.mjs should score for a report.
 *
 * The manifest's html column comes first, because the pdf mode names the pair
 * differently: the HTML is `cv-{candidate}-{report}-{company}.html` and the
 * PDF adds `-{YYYY-MM-DD}`. Swapping `.pdf` for `.html` finds only a sibling
 * with the same stem, as in a bundle's `cv.pdf` and `cv.html`, so it is the
 * fallback for a row with no html column.
 *
 * @param {string|null|undefined} indexedPdf
 * @param {string|null|undefined} [indexedHtml] - The manifest's html path,
 *   already contained to output/ by the caller.
 * @returns {string|null}
 */
export function tailoredCvForKeywordMatch(indexedPdf, indexedHtml = null) {
  if (isHtmlFile(indexedHtml)) return indexedHtml;
  if (typeof indexedPdf !== "string" || !indexedPdf) return null;
  const html = indexedPdf.replace(/\.pdf$/i, ".html");
  if (html === indexedPdf) return null;
  return isHtmlFile(html) ? html : null;
}

function isHtmlFile(p) {
  if (typeof p !== "string" || !/\.html?$/i.test(p)) return false;
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
