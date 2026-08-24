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
1 MWh_th, fx = 0.170 [Th = 80 °C, T0 = 20 °C]
```

`fx` is the **Exergy Factor**: accessible work potential per unit of reported
energy, against a stated reference environment. It is nonnegative and can exceed
1 when the denominator is an accounting basis such as LHV. It is computed from
stated conditions rather than assumed, and it makes
electricity, fuels, heat, cooling, and storage comparable on the axis that
actually determines what they can do.

The reference environment is part of the report, not a hidden default — the
same 80 °C heat quantity is worth more in winter than in summer, and the notation says
so.

The distinction from that environment is what makes work possible. The
calculator reports it through `fx`; it does not apply a separate
"distinguishability factor." At the same state as the reference, `fx = 0`.

## What this repo is

The static site behind `exergyfactor.com`. Zero build step, no dependencies,
served directly by GitHub Pages.

| Page | What it does |
|---|---|
| `index.html` | Single-record calculator producing full quantity-plus-quality notation |
| `compare.html` | Compares two energy forms by accessible exergy in `MWh_ex` |
| `methodology.html` | The thermodynamic basis, and the limits of the method |
| `api-key.html` | Inspect and use the public API contract |

Supported: typed carrier notation (`MWh_e`, `MWh_m`, `MWh_th`, `MWh_solar`,
`MWh_HHV_NG`), an HHV/LHV basis toggle for supported combustible fuels,
temperature-based thermal Exergy Factors, cooling services below ambient, unit
conversion for energy and accessible exergy, and the Carrier Registry / Fidelity
Tier summaries.

The browser unit selector includes SI energy units through PJ and TWh, customary
BTU/MMBTU and therm units, refrigeration ton-hours for cooling, and named fuel
volume shortcuts.

When the carrier and quality context are known, the calculator uses the full
notation as its standard output:

```text
5 BTU_th, fx = 0.214 [Th = 100 °C, T0 = 20 °C]
1.3 MWh_HHV_NG, fx = 0.930 [basis = HHV]
```

The short form (`quantity typed_unit, fx = value`) remains valid when the source
or reference context is unavailable. The typed suffix still matters: `BTU_th`
identifies thermal energy, while `MWh_HHV_NG` identifies natural gas on an HHV
denominator; a bare `BTU` or `MWh` leaves that carrier or basis implicit.

Fuel volumes cannot determine an exact energy quantity without a measured
heating value. The calculator keeps its `scf(natural gas)` and `bbl(oil)`
shortcuts tied to the matching fuel form and places the pinned EIA 2026
U.S.-average estimate in the Unit info tooltip; use the companion library with
a measured HHV or LHV for a composition-specific result.

The companion library also accepts Primary, Secondary, Final, and Useful Exergy
boundaries alongside the corresponding energy records, then records Applied
Exergy at the task and a separate non-energy service outcome. It preserves
historical substitution-method data as a statistical equivalent without
treating it as physical exergy. This additional accounting does not add
complexity to the browser calculator.

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

## API access

The hosted public beta is keyless. Use the canonical endpoint:

```text
https://api.exergyfactor.com/v1
```

The health check is:

```text
https://api.exergyfactor.com/v1/health
```

Local previews use:

```text
http://127.0.0.1:8000/v1/health
```

For local work, run the optional API service and use its corresponding local
base URL instead.

The free deployment is intended for a low-volume public service. It should not
be treated as a high-availability or high-volume service.

## Scope

This is a calculator for individual, accumulated energy quantities. It returns the quantity,
Exergy Factor, and accessible exergy. It does not perform process, technology,
emissions, health, or economic analysis; The Exergy Imperative handles that
downstream work. The companion Python library offers an optional accounting
record for Primary, Secondary, Final, and Useful Exergy, Applied Exergy at the
task, and a separate non-energy service outcome. When total task-boundary
energy is measured, the methodology also distinguishes its Applied Energy and
Applied Anergy residual; this website does not add that complexity to the
calculator.

The browser presets cover heat, electricity, cooling, mechanical work, common
fuels, and solar radiation. Natural gas and hydrogen default to HHV, with LHV
available when the source record explicitly uses it. Heterogeneous fuels and
state-specific forms such as biomass, radiation, nuclear, and plasma use the
library/API or the calculator's custom factor input rather than an invented
universal preset.

## Citing

If you use the Exergy Factor notation in published work, please cite the paper
above. Citation metadata is in
[quantity-and-quality/CITATION.cff](https://github.com/cdimurro/quantity-and-quality/blob/main/CITATION.cff).

## License

[MIT](LICENSE)
