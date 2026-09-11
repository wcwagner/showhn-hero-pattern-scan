# Research notes and scan history

This preserves the detailed scan record from before the gallery-first README. Commands run from the repository root. The opening definition and first detection rules describe the original period-required scanner; the later v2.1 section describes the current typography detector. Earlier galleries remain archived examples, not the current post layout.

A reproducible, imperfect detector for the **slopmark**, a recurring landing-page composition:

> A short proposition in enormous type, terminated by a hard period, with one word or clause switched to italics, an accent color, a display face, or gradient text.

This repository gathers product launches, renders their landing pages in Chromium, reads their computed hero styles, and ranks likely matches. It detects a visual dialect—not AI authorship: a page can bear the slopmark without proving who or what made it.

The first two corpora are Show HN submissions from the public Algolia API and Uneed's public daily launch ladder.

![Twelve slopmark landing-page heroes arranged as a shareable gallery](../assets/showhn-hero-pattern-gallery.webp)

The 2904×2436 WebP above is checked in at [`assets/showhn-hero-pattern-gallery.webp`](../assets/showhn-hero-pattern-gallery.webp), sized at a compact 1.19:1 aspect ratio for README embeds, messaging, and social posts. It includes [Clawback](https://clawback.md/), an exact accent-word example: “Stop paying for tokens twice.”

## Quick start

Requirements: Node.js 20 or newer.

```sh
npm install
npx playwright install chromium
npm run scan -- \
  --start 2026-07-07 \
  --end 2026-07-15 \
  --output results/2026-07-07--2026-07-14.json
```

For a second launch corpus with the same renderer and scoring rules:

```sh
npm run scan:uneed -- \
  --start 2026-07-07 \
  --end 2026-07-15 \
  --output results/uneed-2026-07-07--2026-07-14.json
```

Uneed dates follow the dates accepted by its daily ladder endpoint; `--end` remains exclusive.

Show HN dates are UTC and `--end` is exclusive. The example therefore covers July 7 through July 14.

With `--limit`, pages are selected newest first. Reports retain the full unique-page count, separately report `inspectedLandingPages`, and record whether selection was limited. A limited run is a candidate-finding sample, not a prevalence estimate for the entire date range.

For a quick smoke test:

```sh
npm run scan -- --start 2026-07-14 --end 2026-07-15 --limit 10
```

To inspect exact hero markup and computed styles for specific pages:

```sh
npm run inspect -- https://openclaw.ai https://souva.app
```

## Archival screenshot gallery

`gallery/manifest.json` is the source of truth for the twelve-tile share gallery above, including viewport, compression, order, and collage layout. Regenerate every homepage crop and the final montage with:

```sh
npm run gallery
```

Recompose the montage from the checked-in screenshots without touching the network:

```sh
npm run gallery:compose
```

The pipeline saves compressed 1440×900 WebP captures under `assets/screenshots/` and a borderless 3×4 montage at `assets/showhn-hero-pattern-gallery.webp`. The individual captures are deliberately versioned because live landing pages mutate or disappear.

The independently sourced [Uneed gallery](../assets/uneed-hero-pattern-gallery.webp) has parallel commands:

```sh
npm run gallery:uneed
npm run gallery:uneed:compose
```

The 50-tile scan-derived evidence wall remains separate from the curated gallery. Every wall entry is a unique, non-seed host that matched the strict signature and scored 12 or higher. Regenerate it with:

```sh
npm run gallery:slopmark
```

Recompose it from the checked-in screenshots without touching the network:

```sh
npm run gallery:slopmark:compose
```

The Uneed manifest uses `assets/uneed-screenshots/` and `assets/uneed-hero-pattern-gallery.webp`, so regenerating one corpus does not overwrite the other.

## Detection rules

The scanner finds the largest visible `h1` in the first viewport and records:

- computed font size, family, weight, line height, tracking, and color;
- terminal punctuation;
- descendant `span`, `em`, `i`, `strong`, and `b` elements;
- italic, color, font-family, and gradient differences between descendants and the H1;
- a possible short eyebrow immediately above the hero;
- a few framework hints.

The default thresholds are deliberately legible in `src/scan.mjs`:

- **large:** at least 52px;
- **sentence-like:** 18–220 characters and containing whitespace;
- **period:** visible hero text ends in `.`;
- **special phrase:** a descendant changes italics, color, family, or uses clipped gradient text.

`strict_signature` means all four conditions matched. `score12Plus` is a separate ranking, not a subset of the strict signature. It also rewards very large type, mixed faces, italics, gradients, and eyebrow copy.

## July 7–14, 2026 snapshot

The initial run found:

| Stage | Count |
|---|---:|
| Show HN submissions | 1,178 |
| External landing-page submissions | 684 |
| Unique landing pages | 663 |
| Successfully rendered with a visible H1 | 543 |
| Large sentence-style H1 | 245 |
| Large sentence ending in a period | 155 |
| Large sentence with a specially styled phrase | 136 |
| Strict signature | 98 |
| Score 12 or higher | 39 |

The broad signature appeared on 18.0% of successfully rendered pages; the score threshold captured 7.2%.

See `results/` for the machine-readable dated run. `examples/seed-urls.json` contains the pages that motivated the investigation and is not used as training data by the detector.

## Independent Uneed snapshot

Running the same detector against Uneed's public daily launch ladder for July 7–14 produced:

| Stage | Count |
|---|---:|
| Uneed launch listings | 226 |
| Unique landing pages | 226 |
| Successfully rendered with a visible H1 | 203 |
| Large sentence-style H1 | 121 |
| Large sentence ending in a period | 67 |
| Strict signature | 46 |
| Score 12 or higher | 21 |

The broad signature appeared on 22.7% of successfully rendered pages; the score threshold captured 10.3%. `gallery/uneed-manifest.json` records the twelve visually reviewed examples selected for the second gallery.

Only six of the 226 Uneed hosts also appeared in the same-dated Show HN corpus, and none of the twelve gallery selections overlapped. This makes the second gallery a mostly independent replication rather than a repackaging of the first scan.

## Slopmark evidence wall

![Fifty non-seed, higher-scoring slopmark examples arranged as a dense evidence wall](../assets/slopmark-evidence-wall.webp)

The evidence wall contains 50 unique hosts: 33 discovered through Show HN and 17 through Uneed. All satisfy the strict signature, all score 12 or higher, and all URLs from `examples/seed-urls.json` are excluded. The wall is therefore a dense view of detector results beyond the examples that motivated the investigation, not a mood board assembled from the seed set.

## September 11, 2026 follow-up

A bounded follow-up fetched Show HN submissions for September 4–10 and rendered the **100 newest unique eligible URLs**. These selected submissions all date to September 10. It is a candidate search, not a random sample or a comparable weekly prevalence study.

| Stage | Count |
|---|---:|
| Show HN submissions in the requested week | 853 |
| External landing-page submissions | 526 |
| Unique landing pages in the requested week | 518 |
| Selected pages inspected | 100 |
| Rendered with a visible H1 | 77 |
| No visible H1 | 23 |
| Navigation errors | 0 |
| Strict signature | 12 |
| Score 12 or higher | 0 |

The [dated report](../results/showhn-2026-09-04--2026-09-10-limited.json) preserves every observation, selection order, and rendering settings. The [September gallery manifest](../gallery/september-manifest.json) identifies seven scan candidates and the separately nominated [Herdr](https://herdr.dev/) example. Herdr is not included in these scan counts. Talleyrand is an adjacent example without a terminal period.

```sh
npm run scan -- --start 2026-09-04 --end 2026-09-11 --limit 100 --concurrency 4 --output results/showhn-2026-09-04--2026-09-10-limited.json
node src/gallery.mjs --manifest gallery/september-manifest.json
```

The original July reports and screenshot directories are preserved. The September pass uses the same style thresholds as July; the scanner changes only clarify limiting, record rendering settings, validate numeric arguments, and select bounded samples newest first.

## YC: complete public directory batches

The September 11 follow-up collects **every currently public company** in the [Spring 2026](https://www.ycombinator.com/companies?batch=Spring%202026) and [Winter 2026](https://www.ycombinator.com/companies?batch=Winter%202026) YC directory batches. Selection does not require AI in the company name, industry, or description. The two batches contain 392 distinct companies with 391 distinct website URLs and one missing website. These are current landing pages captured on the same date, not reconstructions of launch-day designs or a time series.

| Scope | Companies | Observed heroes | Italic candidates | Other highlighted candidates | No detected match | Missing data |
|---|---:|---:|---:|---:|---:|---:|
| Complete public Spring 2026 batch | 193 | 174 | 16 | 32 | 126 | 19 |
| Complete public Winter 2026 batch | 199 | 173 | 14 | 31 | 128 | 26 |
| Both public batches | 392 | 347 | 30 | 63 | 254 | 45 |

These are **candidate counts**, not visually validated totals or counts of AI-generated websites. The heuristics are useful for finding examples, but are not reliable enough to label the whole cohort without review: the blinded Spring sample exposed three misses, and separate candidate review rejected Thomas as a false positive. The 15-example Spring post image is a separate, visually reviewed selection. Missing data includes unavailable pages, blocking, and no detectable first-viewport hero; it is never counted as a negative result. Hidden or unlaunched cohort members cannot be collected from the public directory.

### Reproduce the cohort and crawl

```sh
npm run source:yc
npm run scan:yc
node src/yc-source.mjs --batch "Winter 2026" --output results/yc-winter-2026-cohort.json
node src/scan-yc.mjs --input results/yc-winter-2026-cohort.json --output results/yc-winter-2026-2026-09-11.json --screenshots assets/yc-winter-2026-screenshots
node src/cohort-summary.mjs
node src/yc-contact-sheet.mjs --selection italic
node src/yc-contact-sheet.mjs --selection audit
npm test
```

`src/yc-source.mjs` reads the public directory frontend's search configuration and queries its intended public index. The public restricted search credential stays in memory and is never logged or saved. [Cohort records](../results/yc-spring-2026-cohort.json), [per-page observations](../results/yc-spring-2026-2026-09-11.json), and [screenshots](../assets/yc-spring-2026-screenshots/) preserve batch, URLs, names, query membership, timestamps, missing-data status, DOM fragments, typography runs, and screenshot geometry.

The [Winter cohort](../results/yc-winter-2026-cohort.json), [Winter observations](../results/yc-winter-2026-2026-09-11.json), and [combined summary](../results/yc-two-batch-summary.json) preserve the adjacent-batch extension. Both runs inspect complete public batches with four concurrent browser contexts and deterministic JavaScript; there is no model call per page. The Winter run completed in 2 minutes 24 seconds. Historical query/name flags remain in raw source metadata for provenance, but do not filter either cohort.

The additional contact sheets reproduce without network access:

```sh
node src/yc-contact-sheet.mjs --report results/yc-winter-2026-2026-09-11.json --selection italic --output assets/yc-winter-2026-italic --manifest gallery/yc-winter-2026-italic-selection.json
node src/yc-contact-sheet.mjs --report results/yc-winter-2026-2026-09-11.json --selection audit --count 16 --output assets/yc-winter-2026-audit --manifest gallery/yc-winter-2026-audit-selection.json
```

### Detector v2.1 and validation

The YC detector is separate from the historical July scoring system. It selects the largest visible heading-like text in a fixed 1440×900 viewport, using semantic H1 as a tie-break. It requires a proposition of 12–220 characters, at least two words, and type at least 44px. It compares actual text runs and does **not** require a terminal period. Normal fonts and images are loaded; video/audio resources are blocked.

A phrase can differ by italics, font family, font weight (at least 200), gradient use, or RGB distance (at least 40 on 0–255 channels). Runs below 70% of the dominant font size are excluded to avoid treating small labels as hero emphasis. Adjacent runs with identical styling are merged so letter-by-letter spans remain detectable. Unsupported computed color spaces are ignored conservatively for color-only detection. Each result retains the applied settings and classifier version. The initial Spring observations were collected with v2.0 classifications, then all saved text runs were rescored with frozen v2.1; the report preserves both versions. The Winter scan and future runs use frozen v2.1 directly; thresholds were not retuned on the review sample.

Nine deterministic/browser fixtures cover meaningful edge cases: no period, whole-heading italics, tiny subtitles, nearly identical colors, real color contrast, split-letter spans, weight-only emphasis, missing heroes, and small-logo H1 versus a dominant H2.

A separate agent visually labeled a [24-page sample](../gallery/yc-audit-selection.json), chosen by SHA-256 of company-profile URLs independently of predictions and reviewed without classifier output. There were 8 visual matches, 15 nonmatches, and 1 uncertain animated heading. Frozen v2.1 agreed on 20 of the 23 adjudicated pages and missed 3; it produced no false positives in this small sample. This is a sanity check, not a general accuracy estimate. [Labels and disagreements](../results/yc-spring-2026-visual-audit.json) remain inspectable. The misses expose known limitations: propositions split across separate headings (Mochatrade, Plena Health), and a visibly emphasized line smaller than the conservative run-size threshold (Zolvo).

A second blinded [Winter sample](../results/yc-winter-2026-visual-audit.json) used the same SHA-256 selection rule for 16 companies, with classifier v2.1 unchanged. Visual labels were 5 matches, 9 nonmatches, 1 missing hero, and 1 uncertain faint heading. The classifier agreed on 13 of the 14 adjudicated match/nonmatch cases; it missed Tepali by selecting a large statistics block instead of the actual headline. The missing hero remained missing data. These small checks are not estimates of whole-batch accuracy, and the known Thomas false positive outside the samples still matters.

The two existing curated 12-image sets are positive-enriched references, not an independent test set. A [current revisit of those 24 URLs](../results/positive-reference-revisit-2026-09-11.json) produced 20 matches, 3 current nonmatches, and 1 blocked page. Heard and EarlyConversions had changed substantially. This measures present-day agreement with historical reference URLs; it does not rescore the old screenshots or establish precision/recall.

The [italic candidate contact sheet](../assets/yc-spring-2026-italic-1.webp) is visually reviewable, but still contains detector candidates. For example, Thomas selected a subtitle beneath a much larger graphic wordmark; it should be excluded from a curated gallery. Rotating text can duplicate or concatenate words in captured DOM, and screenshot timing can differ slightly from typography extraction.

### Curated YC post image

The final [15-example YC contact sheet](../assets/yc-spring-2026-contact-sheet.webp) selects visually reviewed italic-phrase candidates from this cohort. Its [manifest](../gallery/yc-post-contact-sheet.json) preserves company names, YC/source URLs, screenshot paths, and crop coordinates. Thomas is excluded; TakeCareOS uses a manually reviewed crop of the complete heading. Selection is editorial, not a new prevalence estimate; the [independent visual audit and detector misses](../results/yc-spring-2026-visual-audit.json) remain separate.

```sh
node src/contact-sheet.mjs gallery/yc-post-contact-sheet.json
```

## Two-batch scale and established-company examples

The [two-batch scale graphic](../assets/yc-two-batch-scale.svg) uses one mark for each of the 392 company records in the [combined crawl summary](../results/yc-two-batch-summary.json): 93 heuristic candidates, 254 nonmatches, and 45 unclassified records. It does not imply that all candidates were visually confirmed. The [WebP version](../assets/yc-two-batch-scale.webp) is available for the post.

A separate [three-example established-company collage](../assets/established-contact-sheet.webp) shows Wispr Flow, Antithesis, and Intercom. Wispr uses an italic phrase; Antithesis and Intercom use phrase-level color contrast. These were visually selected from a bounded 12-site check, with [review notes](../results/established-review.md), [public-page observations](../results/established-results.json), and [reviewed results](../results/established-reviewed-results.json). The [crop manifest](../gallery/established-contact-sheet.json) preserves source URLs and screenshot paths. This comparison makes no AI-authorship claim.

Reproduce both from preserved observations and screenshots:

```sh
node src/cohort-summary.mjs
node src/crawl-scale.mjs
node src/contact-sheet.mjs gallery/established-contact-sheet.json
```

## Compact post contact sheet

The post's graduated-density, 21-example contact sheet uses archived screenshots only:

```sh
node src/contact-sheet.mjs
```

Its layout and provenance are recorded in [gallery/post-contact-sheet.json](../gallery/post-contact-sheet.json); the output is [assets/slopmark-contact-sheet.webp](../assets/slopmark-contact-sheet.webp).

## Caveats

- Pages change. A rerun measures the current landing page, not necessarily what appeared on launch day.
- Client-side rendering, bot protection, consent screens, A/B tests, and network failures create missing or misleading observations.
- GitHub, app-store, document, social, and similar links are excluded because they are not product landing pages.
- The legacy Show HN/Uneed scanner blocks images, media, and fonts and waits only 500 ms after DOM load. Custom fonts and late animations can change the actual visual result. That legacy detector also ignores styled fragments narrower than 100 px or shorter than 20 px, and does not score font-weight changes alone; it can miss the short bold or italic word that motivated this search. Use full-resource screenshots for visual review.
- Color changes can be semantic for reasons unrelated to this pattern; rankings require visual review.
- The framework hints are diagnostics, not evidence. Astro, Next.js, Webflow, Framer, and plain HTML can all produce the same composition.
- Most importantly: visual convergence cannot establish whether a human, an agent, a template, or some mixture produced a page.
