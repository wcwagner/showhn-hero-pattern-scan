# Reproduce or extend the collection

Run commands from the repository root with Node.js 20 or newer.

```sh
npm install
npx playwright install chromium
```

## Galleries

Gallery composition uses preserved screenshots without contacting the source sites. The [lead manifest](../gallery/lead-contact-sheet.json) and [dense manifest](../gallery/dense-contact-sheet.json) contain source URLs and crop coordinates.

```sh
node src/contact-sheet.mjs gallery/lead-contact-sheet.json
node src/dense-contact-sheet.mjs
```

Older gallery layouts remain available:

```sh
node src/contact-sheet.mjs gallery/post-contact-sheet.json
node src/contact-sheet.mjs gallery/yc-post-contact-sheet.json
npm run gallery:compose
npm run gallery:uneed:compose
npm run gallery:slopmark:compose
```

The npm gallery commands without `:compose` visit live pages and may replace their gallery captures. Save a new manifest and output directory when preserving a new observation date.

## Inspect a page

```sh
npm run inspect -- https://example.com
```

This prints the heading's markup and computed styles. See [methodology](methodology.md) before interpreting a match.

## Scan a directory batch

Fetch a complete public batch, then render it with the current detector. Choose fresh output paths to preserve older observations.

```sh
node src/yc-source.mjs --batch "Spring 2026" --output results/new-cohort.json
node src/scan-yc.mjs --input results/new-cohort.json --output results/new-scan.json --screenshots assets/new-scan
```

The source fetcher uses the directory's public search configuration; its restricted public credential stays in memory. All company records in the requested batch are included. Historical query/name flags are metadata, not selection criteria. The renderer uses four concurrent browser contexts by default and makes no model call per page.

Make a candidate sheet and a separate sample selected independently of predictions:

```sh
node src/yc-contact-sheet.mjs --report results/new-scan.json --selection italic --output assets/new-italic --manifest gallery/new-italic.json
node src/yc-contact-sheet.mjs --report results/new-scan.json --selection audit --count 24 --output assets/new-audit --manifest gallery/new-audit.json
```

## Historical Show HN and Uneed scans

These use the original detector, not v2.1. Dates use `YYYY-MM-DD`; `--end` is exclusive. Show HN windows are UTC. A limited run selects newest pages first and is a candidate search, not a representative sample.

```sh
npm run scan -- --start 2026-09-04 --end 2026-09-11 --limit 100 --concurrency 4 --output results/new-showhn.json
npm run scan:uneed -- --start 2026-09-04 --end 2026-09-11 --output results/new-uneed.json
```

## Checks and archived summary graphic

```sh
npm run check
npm test
node src/cohort-summary.mjs
node src/crawl-scale.mjs
```

The last two commands rebuild the existing two-batch summary and scale graphic. [Research notes](research-notes.md) retain the dated results and complete provenance.
