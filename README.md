# Exergy Factor

**[exergyfactor.com](https://exergyfactor.com)** — a free calculator for reporting energy as *quantity plus quality*.

[![Site](https://img.shields.io/website?url=https%3A%2F%2Fexergyfactor.com&label=exergyfactor.com)](https://exergyfactor.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## The problem

A megawatt-hour is not a megawatt-hour. One MWh of electricity can do a full
MWh of work. One MWh of 80 °C hot water, against a 20 °C environment, can do
about 0.17 MWh of work — the rest cannot be recovered, no matter how good your
equipment is. Add them up as "2 MWh" and the number is arithmetically fine and
physically meaningless.

Energy reporting almost universally records the first law (how much) and
discards the second (how useful). Decisions get made on the sum.

## The fix

Report one extra field alongside the quantity:

```text
1 MWh_th, fx = 0.170 [Th = 80 C, T0 = 20 C]
```

`fx` is the **Exergy Factor**: the fraction of that energy available as useful
work, against a stated reference environment. It is a number between 0 and 1,
it is computed from stated conditions rather than assumed, and it makes
electricity, fuels, heat, cooling, and storage comparable on the axis that
actually determines what they can do.

The reference environment is part of the report, not a hidden default — the
same 80 °C stream is worth more in winter than in summer, and the notation says
so.

## What this repo is

The static site behind `exergyfactor.com`. Zero build step, no dependencies,
served directly by GitHub Pages.

| Page | What it does |
|---|---|
| `index.html` | Single-record calculator producing `quantity, fx = value` |
| `compare.html` | Compares two energy forms by accessible exergy in `MWh_ex` |
| `methodology.html` | The thermodynamic basis, and the limits of the method |
| `api-key.html` | Request a free API key |

Supported: typed carrier notation (`MWh_e`, `MWh_th`, `MWh_solar`,
`MWh_HHV_NG`), temperature-based thermal Exergy Factors, cooling services below
ambient, unit conversion for energy and accessible exergy, and the Carrier
Registry / Fidelity Tier summaries.

## Related projects

| | |
|---|---|
| **[quantity-and-quality](https://github.com/cdimurro/quantity-and-quality)** | The Python library and CLI. This site is a thin front end over the same reference data; the library is what you want for batch work, existing datasets, and scripting. |
| **Paper** | [`paper/quantity-and-quality-standard-reporting-framework.pdf`](paper/quantity-and-quality-standard-reporting-framework.pdf) — the reporting framework this implements. |

## Local preview

```bash
python -m http.server 8765
```

Then open <http://127.0.0.1:8765/>.

## Syncing the reference data

The site's reference examples are generated from the Python package, so the two
cannot drift. From a checkout of
[quantity-and-quality](https://github.com/cdimurro/quantity-and-quality), with
this repo checked out alongside it:

```bash
python -m quantity_quality export-web-data \
  --output ../exergy-factor/data/reference_examples.json \
  --js-output ../exergy-factor/data/reference_examples.js
```

Commit the regenerated `data/` files together with whatever library change
caused them to move.

## API endpoint

The key-request form posts to:

```text
https://api.exergyfactor.com/v1/api-keys/request
```

When previewing from `localhost` or `127.0.0.1` it uses
`http://127.0.0.1:8000/v1/api-keys/request` instead. Override with:

```js
window.EXERGY_FACTOR_API_BASE_URL = "https://api.exergyfactor.com/v1";
```

## Scope

This is a screening tool. It gives existing records one additional quality
field. It is not a process simulator and does not replace detailed exergy
analysis, ISO 50001, IPMVP, LCA, or engineering judgement.

## Citing

If you use the Exergy Factor notation in published work, please cite the paper
above. Citation metadata is in
[quantity-and-quality/CITATION.cff](https://github.com/cdimurro/quantity-and-quality/blob/main/CITATION.cff).

## License

[MIT](LICENSE) © 2026 Christopher DiMurro
