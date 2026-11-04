# Search discovery setup, November 4, 2026

Six public pages now supply their own canonical URL, existing title and description,
Open Graph fields, Twitter preview, English language and index/snippet directives.
A 1200 × 630 preview image describes the calculator. The metadata uses the existing
page wording; visible page content, numerical code, data, styles and reference
conditions are preserved from the published revision.

JSON-LD identifies the site, its Exergy Lab publisher, each public page, the free
calculator and real navigation breadcrumbs. No reviews, ratings, invented dates
or scientific certification are added. Each JSON-LD block has an exact CSP hash;
the existing script policy is preserved without enabling unsafe inline scripts.

The six-page sitemap records this metadata revision. robots.txt permits public
crawling; the old calculate.html redirect remains noindex. llms.txt links to the
calculator, comparison, methodology, API, policy pages and Exergy Lab catalogue.
It is an additional reference file, not a search-engine requirement or ranking
guarantee. The public IndexNow ownership file permits submission after deployment.

Analytics remains unchanged: the static calculator has no analytics, advertising
cookies or input/result collection. Exergy Lab's consented GA4 reports apply to
exergy-lab.com; they must not be described as measuring this separate domain.
Hosting and API operations retain their existing privacy boundaries.

Validation: scripts/check_site.py, scripts/check_search_metadata.py, JavaScript
syntax, calculator checks and existing site contracts. The release uses the live
GitHub Pages source d9a411ec9933871f7dcc91288c69778eb3182a96 as its parent and
preserves unrelated local work. Production receipts and engine-submission status
are recorded in the Exergy Analyst search publication report.

Published source: e8e0e5d06328192bf130100ebda5fb0af99958bd. GitHub Pages reports
the build completed at 2026-11-04T15:42:52Z. Live HTTP confirms all six public HTML
files and the preview image, sitemap, ownership file and llms.txt match that source.
IndexNow acknowledged the six URLs with HTTP 202 at 15:43 UTC; acknowledgement
does not establish indexing, ranking or AI citations. Google Search Console
verification/submission could not be established because the current OAuth token
does not grant webmasters access. No new analytics collection was introduced.

A follow-up corrects only the exported source_version labels from 0.13.1 to the
published canonical Quantity and Quality 0.13.3. All numerical values, source
hashes and the conformance contract remain unchanged; the cross-repository CI
comparison is retained as the independent check.
