# Exergy Factor

**[exergyfactor.com](https://www.exergyfactor.com)** — a free online website for calculating and comparing the *quality* of different forms of energy.

[![Site](https://img.shields.io/website?url=https%3A%2F%2Fexergyfactor.com&label=exergyfactor.com)](https://exergyfactor.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## The problem

One MWh of electricity can do one MWh of useful work, whereas one MWh of 80 °C water, in a 20 °C environment, can do
about 0.17 MWh of useful work. They both contain the same amount of *energy* but their ability to perform *useful work* is vastly different. This tool allows you to calculate and understand those differences.

## The fix

Report one extra field alongside the quantity:

```text
1 MWh, fx = 0.170 
```

`fx` is the **Exergy Factor**: accessible work potential per unit of reported
energy, against a stated reference environment.

The reference environment can also be included when desired. This is essential because
same 80 °C stream is worth more in the middle of winter than in the middle of summer, because the environmental conditions are different

The full self-verifiable notion is written as followed:

```text
5 MWh_th, fx = 0.170 [Th = 80 °C, T0 = 20 °C]
```

This tells you much more than just writing 5 MWh. 

Distinguishability between the source and the environment is what makes work possible. If the energy source has the same temperature as the environment then it is not possible to perform useful work using that energy source. 
The calculator displays this through `fx`; it does not apply a separate
"distinguishability factor." At the same state as the reference, `fx = 0`.

## What this repo is

The static site behind `exergyfactor.com`. Zero build step, no dependencies,
served directly by GitHub Pages.

| Page | What it does |
|---|---|
| `index.html` | Single-record calculator producing `quantity, fx = value` |
| `compare.html` | Compares two energy forms by accessible exergy in `MWh_ex` |
| `methodology.html` | The thermodynamic basis, and the limits of the method |
| `api-key.html` | Use the public API and open its interactive documentation |

Supported: typed carrier notation (`MWh_e`, `MWh_m`, `MWh_th`, `MWh_solar`,
`MWh_HHV_NG`), an HHV/LHV basis toggle for supported combustible fuels,
temperature-based thermal Exergy Factors, cooling services below ambient, unit
conversion for energy and accessible exergy, and the Carrier Registry / Fidelity
Tier summaries.

Fuel volumes cannot determine an exact energy quantity without a measured
heating value. The calculator labels its `scf(natural gas)` and `bbl(oil)`
shortcuts as pinned EIA 2026 U.S.-average estimates; use the companion library
with a measured HHV or LHV for a composition-specific result.

The companion library also accepts primary, secondary, final, and useful energy
boundaries. It preserves historical substitution-method data as a statistical
equivalent without treating it as physical exergy. This additional accounting
does not add complexity to the browser calculator.

## Related projects

| Product | Use it when |
|---|---|
| **[Exergy Factor](https://exergyfactor.com)** | You need a free, no-install calculator for one or a few energy records. |
| **[Quantity and Quality](https://github.com/cdimurro/quantity-and-quality)** | You need the canonical calculation kernel, CLI, schemas, API, or batch reporting standard. |
| **[The Exergy Imperative](https://github.com/cdimurro/the-exergy-imperative)** | You need to turn utility or telemetry data into prioritized losses, emissions, health screens, economics, and reports. |

The canonical framework paper is available at
[`paper/quantity-and-quality-standard-reporting-framework.pdf`](paper/quantity-and-quality-standard-reporting-framework.pdf).

## Local preview

```bash
python -m http.server 8765
```

Then open <http://127.0.0.1:8765/>.

Before publishing changes:

```bash
python scripts/check_site.py
node --check script.js
node scripts/check_calculations.js
```

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

## Hosted API

The public beta API is keyless and available at:

```text
https://exergy-factor-api.onrender.com/v1
```

Interactive documentation is at
<https://exergy-factor-api.onrender.com/docs>. A health check and sample
calculation are available from the `API` page on the website. The service
retains the same units, reference conditions, bases, boundaries, Fidelity Tiers,
assumptions, and warnings as the Python package. Free hosting may sleep after
inactivity; use the local package or deploy the container under your control for
production workloads.

## Scope

This is a calculator for individual energy streams. It returns the quantity,
Exergy Factor, and accessible exergy. It does not perform process, technology,
emissions, health, or economic analysis; The Exergy Imperative handles that
downstream work. The companion Python library offers an optional accounting
record for primary, secondary, final, and useful energy, Applied Exergy at the
task, and a separate non-energy service outcome; this website does not add that
complexity to the calculator.

## Citing

If you use the Exergy Factor notation in published work, please cite the paper
above. Citation metadata is in
[quantity-and-quality/CITATION.cff](https://github.com/cdimurro/quantity-and-quality/blob/main/CITATION.cff).

## License

[MIT](LICENSE)
