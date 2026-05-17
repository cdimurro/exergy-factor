# Exergy Factor

Static website for `exergyfactor.com`: a simple online calculator for converting ordinary energy quantities into quantity-plus-Exergy-Factor notation.

Core notation:

```text
1 MWh, f_X = 0.73
```

The site is intentionally zero-build and can be served directly by GitHub Pages.

Features:

- Single-record calculator for `quantity, f_X = value`
- Temperature-based thermal Exergy Factor calculation
- Unit conversion for energy and accessible exergy
- Minimal compare tool for visualizing two energy forms by `MWh_ex`

## Local preview

```bash
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.
