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
