// Deterministic visual-pattern detection, never an AI-authorship classifier.
export const DETECTOR = {
  version: '2.1.0', minFontSize: 44, minCharacters: 12, maxCharacters: 220,
  minPhraseLetters: 2, minWeightContrast: 200, minColorDistance: 40, minRunSizeRatio: 0.7, punctuationRequired: false
};

export function classifyHero(hero) {
  if (!hero) return { category: 'missing-data', matched: false, reason: 'No dominant first-viewport hero found.' };
  const text = (hero.text || '').replace(/\s+/g, ' ').trim();
  if (hero.size < DETECTOR.minFontSize || text.length < DETECTOR.minCharacters || text.length > DETECTOR.maxCharacters || !/\s/.test(text)) {
    return { category: 'no-match', matched: false, reason: 'Hero is too small, too short/long, or a single word.' };
  }
  const runs = [];
  for (const run of hero.runs || []) {
    if (run.size < hero.size * DETECTOR.minRunSizeRatio) continue;
    const last = runs.at(-1);
    if (last && ['italic','color','family','weight','gradient','size'].every(k => last[k] === run[k])) last.text += ' ' + run.text;
    else runs.push({ ...run });
  }
  const rgb = value => { const m = /^rgba?\(([^)]+)\)$/.exec(value); return m ? m[1].split(/[,\s/]+/).filter(Boolean).map(Number) : null; };
  const differentColor = (a,b) => {
    const x=rgb(a),y=rgb(b);
    if (!x || !y) return false; // Unsupported color spaces stay conservative.
    return Math.hypot(...x.slice(0,3).map((v,i)=>v-y[i])) >= DETECTOR.minColorDistance || Math.abs((x[3] ?? 1)-(y[3] ?? 1)) >= 0.2;
  };
  let italic = false, color = false, family = false, weight = false, gradient = false;
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const a = runs[i], b = runs[j];
    if ((a.text.match(/[\p{L}\p{N}]/gu) || []).length < 2 || (b.text.match(/[\p{L}\p{N}]/gu) || []).length < 2) continue;
    italic ||= a.italic !== b.italic;
    color ||= differentColor(a.color,b.color);
    family ||= a.family !== b.family;
    weight ||= Math.abs(a.weight - b.weight) >= DETECTOR.minWeightContrast;
    gradient ||= a.gradient !== b.gradient;
  }
  const flags = { italic, color, family, weight, gradient };
  const matched = Object.values(flags).some(Boolean);
  return { category: italic ? 'italic-phrase' : matched ? 'highlighted-phrase' : 'no-match', matched, flags,
    reason: matched ? 'Large dominant hero contains visibly different text runs.' : 'No contrasting phrase within the dominant hero.' };
}

// Runs in Chromium with normal fonts and images loaded. Text-run boxes are recorded
// so manual review can distinguish text from CSS defaults and crop actual captures.
export function extractHero() {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const rectJSON = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
  const visible = e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (r.width <= 0 || r.height <= 0 || r.top >= innerHeight || r.bottom <= 0 || r.left >= innerWidth || r.right <= 0) return false;
    for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) return false; }
    return true;
  };
  const candidates = [...document.querySelectorAll('h1,h2,[role="heading"],p,div')].filter(e => {
    if (!visible(e) || e.closest('nav,footer,[role="navigation"]')) return false;
    const text = clean(e.innerText);
    if (text.length < 4 || text.length > 220) return false;
    if (e.matches('div,p') && (!e.childNodes.length || e.querySelector('h1,h2,h3,p,div,button,input,ul,ol'))) return false;
    return true;
  }).map(e => {
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), runs = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = clean(node.textContent), parent = node.parentElement;
      if (!text || !parent || !visible(parent)) continue;
      const range = document.createRange(); range.selectNodeContents(node); const box = range.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight) continue;
      const s = getComputedStyle(parent);
      let gradient = false;
      for (let a = parent; a; a = a.parentElement) {
        const c = getComputedStyle(a);
        if (/gradient\(/.test(c.backgroundImage) && (c.backgroundClip === 'text' || c.webkitBackgroundClip === 'text')) gradient = true;
        if (a === e) break;
      }
      runs.push({ text, italic: s.fontStyle !== 'normal', color: s.color, family: s.fontFamily, weight: Number(s.fontWeight) || 400,
        gradient, size: parseFloat(s.fontSize), box: rectJSON(box) });
    }
    const rect = e.getBoundingClientRect();
    return { element: e, text: clean(e.innerText), tag: e.tagName.toLowerCase(), size: Math.max(0,...runs.map(r=>r.size)),
      box: rectJSON(rect), runs, outerHTML: e.outerHTML.slice(0,4000) };
  }).filter(x => x.runs.length && x.size >= 28);
  const pool = candidates;
  pool.sort((a,b) => b.size - a.size || Number(b.tag === 'h1') - Number(a.tag === 'h1') || a.box.y - b.box.y);
  if (!pool.length) return null;
  const { element, ...hero } = pool[0];
  return { ...hero, viewportWidth: innerWidth, sizeViewportRatio: hero.size / innerWidth,
    bodyFontRatio: hero.size / parseFloat(getComputedStyle(document.body).fontSize), candidateCount: pool.length };
}
