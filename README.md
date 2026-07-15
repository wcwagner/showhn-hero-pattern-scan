# Show HN hero-pattern scan

A reproducible, imperfect detector for a recurring landing-page composition:

> A short proposition in enormous type, terminated by a hard period, with one word or clause switched to italics, an accent color, a display face, or gradient text.

This repository gathers Show HN submissions from the public Algolia API, renders external landing pages in Chromium, reads their computed hero styles, and ranks likely matches. It detects a visual dialect—not AI authorship.

![Twelve high-scoring landing-page heroes arranged as a gallery](assets/showhn-hero-pattern-gallery.webp)

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

Dates are UTC and `--end` is exclusive. The example therefore covers July 7 through July 14.

For a quick smoke test:

```sh
npm run scan -- --start 2026-07-14 --end 2026-07-15 --limit 10
```

To inspect exact hero markup and computed styles for specific pages:

```sh
npm run inspect -- https://openclaw.ai https://souva.app
```

## Archival screenshot gallery

`gallery/manifest.json` is the source of truth for candidate selection, order, viewport, compression, and collage layout. Regenerate every homepage crop and the final montage with:

```sh
npm run gallery
```

Recompose the montage from the checked-in screenshots without touching the network:

```sh
npm run gallery:compose
```

The pipeline saves compressed 1440×900 WebP captures under `assets/screenshots/` and a borderless 3×4 montage at `assets/showhn-hero-pattern-gallery.webp`. The individual captures are deliberately versioned because live landing pages mutate or disappear.

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

`strict_signature` means all four conditions matched. `score_12_plus` is a narrower ranking that also rewards very large type, mixed faces, italics, gradients, and eyebrow copy.

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

The broad signature appeared on 18.0% of successfully rendered pages; the higher-confidence score captured 7.2%.

See `results/` for the machine-readable dated run. `examples/seed-urls.json` contains the pages that motivated the investigation and is not used as training data by the detector.

## Caveats

- Pages change. A rerun measures the current landing page, not necessarily what appeared on launch day.
- Client-side rendering, bot protection, consent screens, A/B tests, and network failures create missing or misleading observations.
- GitHub, app-store, document, social, and similar links are excluded because they are not product landing pages.
- Color changes can be semantic for reasons unrelated to this pattern; rankings require visual review.
- The framework hints are diagnostics, not evidence. Astro, Next.js, Webflow, Framer, and plain HTML can all produce the same composition.
- Most importantly: visual convergence cannot establish whether a human, an agent, a template, or some mixture produced a page.
