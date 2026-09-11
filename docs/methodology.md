# Detection and review

The scanner finds a visual composition. It does not identify AI-generated sites or infer who made a page.

## Current detector

[Detector v2.1](../src/hero-detector.mjs) runs deterministic JavaScript on rendered pages. At a fixed 1440×900 viewport, it selects the largest visible heading-like text, using H1 as a tie-break. A candidate must have at least two words, 12–220 characters, and type at least 44px. A terminal period is optional.

It compares actual text runs for an italic, font-family, weight, gradient, or color change within the heading. A whole heading in italics is not enough. Weight must differ by at least 200; RGB distance must be at least 40. Runs smaller than 70% of the dominant font size are excluded, and adjacent runs with the same style are merged. Fonts and images load normally; audio/video resources are blocked.

Reports preserve text runs, geometry, settings, timestamps, screenshots, and the detector version. Results distinguish:

- **Candidate:** the typography rule matched; visual review is still needed.
- **No match:** a hero was detected, but the rule did not match it.
- **Missing data:** a blocked/unavailable page, missing URL, or no detectable hero. This is not a negative result.

## How reliable is it?

Useful for collecting candidates; insufficient for labeling an entire corpus without review.

Independent agents reviewed deterministic samples without seeing the predictions. Company-profile URLs were selected by SHA-256, independently of detector output. The detector stayed frozen during review.

| Sample | Adjudicated cases | Agreements | Misses | Other cases |
|---|---:|---:|---:|---|
| [Spring batch](../results/yc-spring-2026-visual-audit.json) | 23 | 20 | 3 | 1 uncertain |
| [Winter batch](../results/yc-winter-2026-visual-audit.json) | 14 | 13 | 1 | 1 uncertain, 1 missing |

These small checks are not general accuracy estimates. The misses included a proposition split across headings, a smaller italic line, and a statistics block selected instead of the headline. Separate candidate review rejected Thomas: the detector selected a subtitle below a much larger graphic wordmark. Animated text can also differ between DOM extraction and the screenshot.

The [revisit of 24 historical positive examples](../results/positive-reference-revisit-2026-09-11.json) is a temporal regression check, not an independent test set. Pages changed, including Heard and EarlyConversions. The [nine fixtures](../src/hero-detector.test.mjs) test specific edge cases; they do not establish real-world accuracy.

## Reading the collection

Gallery selection is editorial. A compact gallery is neither a complete set of candidates nor a prevalence estimate. Each manifest records its source screenshots and crop choices. Examples from manually reviewed sites and different discovery sources are not silently pooled into a detector denominator.

The [initial site review](../results/established-review.md) and [additional 25-site check](../results/established-additional-review.md) also preserve exclusions and undetermined cases; a bounded search does not establish that no other examples exist.

A capture records the current page at its observation time, not necessarily its launch-day design. Whole-batch scans cover all publicly listed companies in the selected directory batch, including missing data; they do not include undisclosed companies. The [two-batch summary](../results/yc-two-batch-summary.json) preserves full company counts without a name or industry filter.

## Historical scanner

[The original Show HN/Uneed scanner](../src/scan.mjs) uses different rules: an H1 at least 52px, a terminal period, and a styled descendant. It blocks fonts/images and has known blind spots for short words and weight-only changes. Its score threshold is not a subset of its strict signature. Historical reports remain unchanged and should not be compared directly with v2.1 counts. Detailed settings, counts, and caveats are in the [research notes](research-notes.md).
