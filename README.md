# Exergy Factor

Static website for `exergyfactor.com`: a simple online calculator for converting ordinary energy quantities into quantity-plus-Exergy-Factor notation.

Core notation:

```text
1 MWh, fx = 0.73
```

The site is intentionally zero-build and can be served directly by GitHub Pages.

Features:

- Single-record calculator for `quantity, fx = value`
- Dedicated comparison page for visualizing two energy forms by accessible exergy
- Dedicated methodology page explaining the thermodynamic basis
- Temperature-based thermal Exergy Factor calculation
- Unit conversion for energy and accessible exergy

## Local preview

```bash
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.
