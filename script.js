const ENERGY_TO_J = {
  Wh: 3600,
  kWh: 3.6e6,
  MWh: 3.6e9,
  GWh: 3.6e12,
  J: 1,
  kJ: 1e3,
  MJ: 1e6,
  GJ: 1e9,
  TJ: 1e12,
  EJ: 1e18,
  Btu: 1055.05585262,
  MMBtu: 1.05505585262e9,
  Quad: 1.05505585262e18,
  // NIST U.S. legal therm. It intentionally differs slightly from 100,000
  // International Table Btu.
  therm: 105480400,
  // Nominal BOE and pinned EIA 2026 U.S.-average fuel estimates. A measured
  // heating value is required for a composition-specific result.
  boe: 5.8 * 1.05505585262e9,
  "bbl(oil)": 5.689 * 1.05505585262e9,
  "scf(natural gas)": 1036 * 1055.05585262,
  "Mcf(natural gas)": 1.036 * 1.05505585262e9,
  "MMcf(natural gas)": 1036 * 1.05505585262e9,
};

// This small pure kernel is exercised against the versioned conformance
// contract published by quantity-and-quality. UI code calls the same functions,
// so a browser result cannot quietly diverge from the Python implementations.
function finiteNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new RangeError(`${name} must be finite`);
  return number;
}

function thermalExergyFactorC(sourceC, referenceC) {
  const sourceK = finiteNumber(sourceC, "source_c") + 273.15;
  const referenceK = finiteNumber(referenceC, "reference_c") + 273.15;
  if (sourceK <= 0 || referenceK <= 0) throw new RangeError("temperatures must be above absolute zero");
  if (sourceK < referenceK) throw new RangeError("source temperature must not be below reference temperature");
  return 1 - referenceK / sourceK;
}

function coolingExergyFactorC(coldC, ambientC) {
  const coldK = finiteNumber(coldC, "cold_c") + 273.15;
  const ambientK = finiteNumber(ambientC, "ambient_c") + 273.15;
  if (coldK <= 0 || ambientK <= 0) throw new RangeError("temperatures must be above absolute zero");
  if (coldK > ambientK) throw new RangeError("cold service temperature must not exceed ambient temperature");
  return ambientK / coldK - 1;
}

function sensibleHeatExergyFactorC(supplyC, returnC, referenceC) {
  const supplyK = finiteNumber(supplyC, "supply_c") + 273.15;
  const returnK = finiteNumber(returnC, "return_c") + 273.15;
  const referenceK = finiteNumber(referenceC, "reference_c") + 273.15;
  if (Math.min(supplyK, returnK, referenceK) <= 0) throw new RangeError("temperatures must be above absolute zero");
  if (supplyK <= returnK) throw new RangeError("supply temperature must exceed return temperature");
  const relativeLift = (supplyK - returnK) / returnK;
  let correction;
  if (relativeLift < 1e-4) {
    correction = relativeLift * (0.5 + relativeLift * (-1 / 3 + relativeLift * (0.25 - relativeLift / 5)));
  } else {
    correction = 1 - Math.log1p(relativeLift) / relativeLift;
  }
  const factor = (returnK - referenceK) / returnK + (referenceK / returnK) * correction;
  if (factor < -1e-12) throw new RangeError("reference state produces negative sensible-heat exergy");
  return Math.max(0, factor);
}

function petelaExergyFactor(referenceK = 293.15, radiationTemperatureK = 5778) {
  const reference = finiteNumber(referenceK, "reference_k");
  const radiation = finiteNumber(radiationTemperatureK, "radiation_temperature_k");
  if (reference <= 0 || radiation <= 0) throw new RangeError("temperatures must be positive");
  if (reference > radiation) throw new RangeError("reference temperature must not exceed radiation temperature");
  const ratio = reference / radiation;
  return 1 - (4 / 3) * ratio + (1 / 3) * ratio ** 4;
}

function accessibleExergy(energy, exergyFactor) {
  const quantity = finiteNumber(energy, "energy");
  const factor = finiteNumber(exergyFactor, "exergy_factor");
  if (quantity < 0 || factor < 0) throw new RangeError("energy and exergy factor must be nonnegative");
  return quantity * factor;
}

function weightedExergyFactor(records) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  let energy = 0;
  let exergy = 0;
  records.forEach(([weightValue, factorValue]) => {
    const weight = finiteNumber(weightValue, "weight");
    const factor = finiteNumber(factorValue, "exergy_factor");
    if (weight < 0 || factor < 0) throw new RangeError("weights and factors must be nonnegative");
    energy += weight;
    exergy += weight * factor;
  });
  if (energy <= 0) throw new RangeError("at least one positive weight is required");
  return exergy / energy;
}

function formatEnergyNotation(quantityValue, unit, exergyFactor, precision = 3) {
  const quantity = finiteNumber(quantityValue, "quantity");
  const factor = finiteNumber(exergyFactor, "exergy_factor");
  if (quantity < 0 || factor < 0) throw new RangeError("quantity and exergy factor must be nonnegative");
  if (!unit) throw new TypeError("unit is required");
  const quantityText = quantity.toFixed(precision).replace(/\.?0+$/, "") || "0";
  const factorText = Number.isInteger(factor) ? factor.toFixed(1) : factor.toFixed(precision);
  return `${quantityText} ${unit}, fx = ${factorText}`;
}

window.EXERGY_FACTOR_KERNEL = Object.freeze({
  thermal_exergy_factor_c: thermalExergyFactorC,
  cooling_exergy_factor_c: coolingExergyFactorC,
  sensible_heat_exergy_factor_c: sensibleHeatExergyFactorC,
  petela_exergy_factor: petelaExergyFactor,
  accessible_exergy: accessibleExergy,
  weighted_exergy_factor: weightedExergyFactor,
  format_energy_notation: formatEnergyNotation,
});

function apiBaseUrl() {
  if (window.EXERGY_FACTOR_API_BASE_URL) return String(window.EXERGY_FACTOR_API_BASE_URL).replace(/\/$/, "");
  if (window.location && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8000/v1";
  }
  return "https://exergy-factor-api.onrender.com/v1";
}

// These name carriers, so they had to follow the carrier list when it was
// deduplicated: `heat80`, `steam150` and `methaneHhv` no longer exist, and
// setting a <select> to a value that is not in it leaves the control on whatever
// was there before — the example button appeared to do nothing. The two heat
// examples now select "Heat" and supply their temperature, which is the point.
const examples = {
  electric: { energy: 1, unit: "MWh", form: "electricity", fx: 1, auto: false },
  // Replaces an "I already know fx = 0.73" example. That is not something this
  // tool does any more — the factor is its output — and cooling was the one
  // path with no example at all.
  cooling7: { energy: 1, unit: "MWh", form: "cooling", source: 7, sourceUnit: "C", sink: 30, sinkUnit: "C", auto: true },
  heat80: { energy: 4, unit: "MWh", form: "heat", source: 80, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  steam150: { energy: 0.5, unit: "Btu", form: "heat", source: 150, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  methane: { energy: 1.3, unit: "MWh", form: "naturalGasHhv", fx: 0.93, auto: false },
  hydrogen: { energy: 2.47, unit: "MWh", form: "hydrogen", fx: 0.83, auto: false },
};

const comparePresets = {
  // ONE entry for electricity-like output whose Exergy Factor is 1 by definition.
  // PV DC output, battery discharge, and pumped hydro output use the electricity
  // carrier at their delivery boundary; mechanical shaft work is kept separate
  // because it has its own MWh_m carrier suffix.
  electricity: { label: "Electricity", unit: "MWh", typedUnit: "MWh_e", fx: 1, tier: "F1", basis: "Delivered work at point of use" },
  mechanical: { label: "Mechanical work", unit: "MWh", typedUnit: "MWh_m", fx: 1, tier: "F1", basis: "Shaft work at the machine boundary" },

  // `needsTemperature` means the user supplies the number, not a preset. There
  // used to be thirteen fixed heat temperatures — 35, 40, 50, 60, 70, 80, 90,
  // 120, 150, 180, 250, 500 °C — and the chance a real stream sits exactly on one
  // of them is close to nil, so almost every visitor either picked a wrong
  // neighbour or gave up. The temperature is the answer; it should be typed in.
  heat: { label: "Heat", unit: "MWh", typedUnit: "MWh_th", tier: "F2", needsTemperature: "heat", basis: "Carnot factor from your source and reference temperatures" },
  cooling: { label: "Cooling", unit: "MWh", typedUnit: "MWh_cooling", tier: "F2", needsTemperature: "cooling", basis: "Cooling service against your stated ambient" },

  // Natural gas is ~93% methane and the framework's screening factor is the same
  // number, so they were literally duplicate rows: `methane` and `naturalGasLhv`
  // carried identical fx AND identical typed units. Named together instead.
  naturalGasHhv: { label: "Natural gas HHV", unit: "MWh", typedUnit: "MWh_HHV_NG", fx: 0.93, tier: "F1", basis: "Higher heating value fuel basis" },
  naturalGasLhv: { label: "Natural gas LHV", unit: "MWh", typedUnit: "MWh_LHV_CH4", fx: 1.04, tier: "F1", basis: "Lower heating value fuel basis" },
  hydrogen: { label: "Hydrogen HHV", unit: "MWh", typedUnit: "MWh_HHV_H2", fx: 0.83, tier: "F1", basis: "Higher heating value hydrogen basis" },
  hydrogenLhv: { label: "Hydrogen LHV", unit: "MWh", typedUnit: "MWh_LHV_H2", fx: 0.98, tier: "F1", basis: "Lower heating value hydrogen basis" },
  // These HHV values are screening conversions of the existing illustrative
  // LHV presets. Use an assay- or composition-specific chemical-exergy model
  // for engineering work; the basis switch must never imply a universal fuel
  // factor for grade-dependent products.
  dieselHhv: { label: "Diesel HHV", unit: "MWh", typedUnit: "MWh_HHV_diesel", fx: 0.98, tier: "F1", basis: "Approximate chemical exergy divided by higher heating value" },
  dieselLhv: { label: "Diesel LHV", unit: "MWh", typedUnit: "MWh_LHV_diesel", fx: 1.06, tier: "F1", basis: "Lower heating value fuel basis" },
  gasolineHhv: { label: "Gasoline HHV", unit: "MWh", typedUnit: "MWh_HHV_gasoline", fx: 1.00, tier: "F1", basis: "Approximate chemical exergy divided by higher heating value" },
  gasolineLhv: { label: "Gasoline LHV", unit: "MWh", typedUnit: "MWh_LHV_gasoline", fx: 1.07, tier: "F1", basis: "Lower heating value fuel basis" },
  coalHhv: { label: "Coal HHV", unit: "MWh", typedUnit: "MWh_HHV_coal", fx: 0.94, tier: "F1", basis: "Approximate chemical exergy divided by higher heating value; grade and moisture matter" },
  coalLhv: { label: "Coal LHV", unit: "MWh", typedUnit: "MWh_LHV_coal", fx: 1.05, tier: "F1", basis: "Lower heating value fuel basis" },
  crudeOilHhv: { label: "Crude oil HHV", unit: "MWh", typedUnit: "MWh_HHV_crude", fx: 1.00, tier: "F1", basis: "Approximate crude oil chemical exergy factor on a higher heating value basis" },
  crudeOil: { label: "Crude oil", unit: "MWh", typedUnit: "MWh_LHV_crude", fx: 1.06, tier: "F1", basis: "Approximate crude oil chemical exergy factor" },

  solar: { label: "Solar radiation", unit: "MWh", typedUnit: "MWh_solar", fx: 0.932, tier: "F2", basis: "Petela radiation Exergy Factor" },
  custom: { label: "Custom", unit: "MWh", typedUnit: "", fx: 0.73, tier: "F1", needsCustomFactor: true, basis: "User-defined Exergy Factor" },
};

// HHV and LHV are reporting bases, not different kinds of fuel. Keep the
// paired reference factors together so the UI can expose one fuel choice and a
// single, explicit basis switch instead of duplicate select options.
const fuelBasisGroups = {
  naturalGas: {
    label: "Natural gas",
    keys: { LHV: "naturalGasLhv", HHV: "naturalGasHhv" },
  },
  hydrogen: {
    label: "Hydrogen",
    keys: { LHV: "hydrogenLhv", HHV: "hydrogen" },
  },
  diesel: {
    label: "Diesel",
    keys: { LHV: "dieselLhv", HHV: "dieselHhv" },
  },
  gasoline: {
    label: "Gasoline",
    keys: { LHV: "gasolineLhv", HHV: "gasolineHhv" },
  },
  coal: {
    label: "Coal",
    keys: { LHV: "coalLhv", HHV: "coalHhv" },
  },
  crudeOil: {
    label: "Crude oil",
    keys: { LHV: "crudeOil", HHV: "crudeOilHhv" },
  },
};

function fuelBasisGroupForKey(key) {
  return Object.values(fuelBasisGroups).find((group) => Object.values(group.keys).includes(key)) || null;
}

function basisControlIds(prefix) {
  return prefix === "calculator"
    ? { preset: "energy-form", control: "energy-basis-control", toggle: "energy-basis-toggle" }
    : {
        preset: `compare-${prefix}-preset`,
        control: `compare-${prefix}-basis-control`,
        toggle: `compare-${prefix}-basis-toggle`,
      };
}

function updateFuelBasisControl(prefix, presetKey) {
  const ids = basisControlIds(prefix);
  const control = byId(ids.control);
  const toggle = byId(ids.toggle);
  if (!control || !toggle) return;

  const group = fuelBasisGroupForKey(presetKey);
  const basisLockedToVolumeReference = prefix === "calculator"
    && Boolean(FUEL_VOLUME_UNITS[fields["energy-unit"]?.value]);
  control.hidden = !group || basisLockedToVolumeReference;
  toggle.disabled = basisLockedToVolumeReference;
  if (!group) {
    toggle.checked = false;
    return;
  }

  const basis = Object.entries(group.keys).find(([, key]) => key === presetKey)?.[0] || "HHV";
  toggle.checked = basis === "HHV";
  toggle.setAttribute("aria-label", `${group.label} basis: ${basis}. Toggle to switch between HHV and LHV.`);
}

function currentPresetKey(prefix) {
  const select = byId(basisControlIds(prefix).preset);
  return select?.dataset.basisPreset || select?.value || "custom";
}

function syncPresetSelection(prefix) {
  const select = byId(basisControlIds(prefix).preset);
  if (select) select.dataset.basisPreset = select.value;
}

function applyFuelBasisToggle(prefix) {
  const ids = basisControlIds(prefix);
  const select = byId(ids.preset);
  const toggle = byId(ids.toggle);
  if (!select || !toggle) return;

  const group = fuelBasisGroupForKey(currentPresetKey(prefix));
  if (!group) return;
  // Keep the visible fuel option selected. The internal HHV/LHV preset is
  // stored separately because it is not itself an option in the select.
  select.dataset.basisPreset = group.keys[toggle.checked ? "HHV" : "LHV"];
}

applyCanonicalReferenceData(
  comparePresets,
  window.EXERGY_FACTOR_REFERENCE_DATA && window.EXERGY_FACTOR_REFERENCE_DATA.presets,
);

const fields = {};

function applyCanonicalReferenceData(presets, canonicalPresets) {
  if (!canonicalPresets) return;
  Object.entries(canonicalPresets).forEach(([key, canonical]) => {
    const preset = presets[key];
    if (!preset) return;
    if (Number.isFinite(canonical.fx)) preset.fx = canonical.fx;
    if (canonical.base_unit) preset.unit = canonical.base_unit;
    if (canonical.typed_unit) preset.typedUnit = canonical.typed_unit;
    if (canonical.tier) preset.tier = canonical.tier;
    if (canonical.basis) preset.basis = canonical.basis;
    if (canonical.reference) preset.reference = canonical.reference;
    if (canonical.boundary) preset.boundary = canonical.boundary;
    if (canonical.calculation) preset.calculation = canonical.calculation;
    if (canonical.adoption_note) preset.adoptionNote = canonical.adoption_note;
    if (Number.isFinite(canonical.sourceC)) preset.sourceC = canonical.sourceC;
    if (Number.isFinite(canonical.sinkC)) preset.sinkC = canonical.sinkC;
  });
}

function byId(id) {
  return document.getElementById(id);
}

function hasField(id) {
  return Boolean(fields[id]);
}

function hasCalculator() {
  return hasField("energy-value") && hasField("energy-unit") && hasField("notation-output");
}

function hasCompare() {
  return hasField("compare-a-preset") && hasField("compare-b-preset") && hasField("compare-bars");
}

function hasApiHealthCheck() {
  return hasField("api-health-check") && hasField("api-health-status");
}

function cacheFields() {
  [
    "energy-value",
    "energy-unit",
    "energy-form",
    "energy-basis-toggle",
    "custom-factor",
    "advanced-options",
    "source-temp",
    "source-unit",
    "exergy-factor",
    "factor-unit",
    "sink-temp",
    "sink-unit",
    "calculator-result",
    "notation-output",
    "fx-output",
    "work-output",
    "exergy-output",
    "method-output",
    "tier-output",
    "basis-output",
    "conversion-grid",
    "compare-a-preset",
    "compare-a-basis-toggle",
    "compare-a-quantity",
    "compare-a-unit",
    "compare-a-factor",
    "compare-a-source",
    "compare-a-source-unit",
    "compare-a-sink",
    "compare-a-sink-unit",
    "compare-b-preset",
    "compare-b-basis-toggle",
    "compare-b-quantity",
    "compare-b-unit",
    "compare-b-factor",
    "compare-b-source",
    "compare-b-source-unit",
    "compare-b-sink",
    "compare-b-sink-unit",
    "compare-bars",
    "compare-summary",
    "compare-equivalence",
    "api-health-check",
    "api-health-status",
    "export-csv",
    "export-png",
  ].forEach((id) => {
    fields[id] = byId(id);
  });
}

function tempToK(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  if (unit === "K") return number;
  if (unit === "C") return number + 273.15;
  if (unit === "F") return ((number - 32) * 5) / 9 + 273.15;
  return NaN;
}

// The declaration bracket is published in Celsius whatever the user typed, so two
// records from two people are comparable without unit archaeology.
function toCelsius(value, unit) {
  const kelvin = tempToK(value, unit);
  return Number.isFinite(kelvin) ? kelvin - 273.15 : NaN;
}

// Each temperature keeps its own unit picker. Falling back to Celsius rather
// than returning undefined matters: undefined reaches tempToK, which yields NaN,
// and the entire thermal answer disappears with nothing on screen to say why.
function sourceUnit() {
  return fields["source-unit"]?.value || "C";
}

function sinkUnit() {
  return fields["sink-unit"]?.value || "C";
}

function format(value, precision = 4) {
  if (!Number.isFinite(value)) return "invalid";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 100000 || abs < 0.0001) return value.toExponential(3);
  return Number(value.toFixed(precision)).toString();
}

// A COMPUTED Exergy Factor keeps its trailing zeros: 0.170, not 0.17, and 0.730,
// not 0.73. Those digits show the precision being claimed, and dropping them made
// the published figure look different from the value a reader recomputes
// (1 - 293.15/353.15 = 0.16990 -> 0.170).
//
// An EXACT factor is not padded. Electricity is 1 by definition, not 1 measured to
// three decimals, so it reads fx = 1.0. The quantity is never padded either.
function formatFactor(value) {
  if (!Number.isFinite(value)) return "invalid";
  if (Number.isInteger(value)) return value.toFixed(1);
  return value.toFixed(3);
}

// A temperature as it appears inside the declaration bracket. Keep the degree
// symbol visible so the notation matches the on-page temperature controls.
function formatBracketTemp(celsius) {
  // One decimal. A stream entered as 340 F is 171.1111... C, and printing
  // `Th = 171.111 C` claims a precision the reading never had.
  return `${Number(celsius.toFixed(1))} °C`;
}

// The declaration bracket, wherever there is one to declare.
//
// The full form is the useful one: it carries the conditions the factor was
// derived at, so a reader can re-derive it instead of taking it on trust. The
// short form is correct only when there is genuinely nothing to declare —
// electricity is 1 whatever the environment does.
//
// A fuel has something to declare too, and it was being dropped: HHV and LHV give
// materially different factors for the same fuel (0.930 against 1.040 for natural
// gas), so a bare `1 MWh_HHV_NG, fx = 0.930` leaves the reader to infer the basis
// from the unit suffix. The library states it as `[basis = HHV]`; so does this.
function declarationBracket({ preset, sourceC, sinkC, coldC }) {
  if (Number.isFinite(coldC) && Number.isFinite(sinkC)) {
    return ` [Tcold = ${formatBracketTemp(coldC)}, T0 = ${formatBracketTemp(sinkC)}]`;
  }
  if (Number.isFinite(sourceC) && Number.isFinite(sinkC) && sourceC > sinkC) {
    return ` [Th = ${formatBracketTemp(sourceC)}, T0 = ${formatBracketTemp(sinkC)}]`;
  }
  const basis = /_(HHV|LHV)_/.exec(preset?.typedUnit || "");
  if (basis) return ` [basis = ${basis[1]}]`;
  return "";
}

function formatDisplayEnergy(value) {
  return format(value, 3);
}

function normalizeUnit(unit) {
  return unit;
}

function typedSuffix(typedUnit) {
  if (!typedUnit || !typedUnit.includes("_")) return "";
  return typedUnit.slice(typedUnit.indexOf("_"));
}

function displayUnit(unit, preset = null) {
  if (!preset || !preset.typedUnit || unit.includes("(")) return unit;
  const suffix = typedSuffix(preset.typedUnit);
  return suffix ? `${unit}${suffix}` : unit;
}

function displayExergyUnit(unit) {
  const baseUnit = unit.replace(/\(.+\)/, "");
  return `${baseUnit}_ex`;
}

// Fuel-volume units carry a heating value the calculator applies for you.
//
// A barrel and an scf measure VOLUME, so `ENERGY_TO_J` is already assuming an
// energy content to convert them — here, pinned EIA 2026 U.S.-average estimates.
// A volume and fuel name still cannot determine a meter-specific heating value. That
// assumption was invisible: a visitor picking `bbl(oil)` had no way to see which
// heating value they had just accepted, and the carrier they picked in the form
// above could contradict the one the unit implies.
//
// Both are now locked and shown. The unit already decides the fuel and its energy
// content, so those two fields stop being editable, which is also the clearest
// way to show what IS still theirs to enter.
// `reportIn` keeps the reported figure at a readable size. A single scf in MWh is
// 0.0003, and its exergy rounds to a bare "0" on screen — a number that looks like
// an error rather than a small quantity.
const FUEL_VOLUME_UNITS = {
  "boe": { form: "crudeOil", reportIn: "MWh", display: "5.800 MMBtu per barrel of oil equivalent (nominal U.S. DOE convention)" },
  "bbl(oil)": { form: "crudeOil", reportIn: "MWh", display: "5.689 MMBtu per barrel (EIA 2026 estimated U.S. crude-oil average)" },
  "scf(natural gas)": { form: "naturalGasHhv", reportIn: "kWh", display: "1,036 Btu per scf (EIA 2026 estimated U.S. natural-gas average), HHV" },
  "Mcf(natural gas)": { form: "naturalGasHhv", reportIn: "MWh", display: "1.036 MMBtu per Mcf (EIA 2026 estimated U.S. natural-gas average), HHV" },
  "MMcf(natural gas)": { form: "naturalGasHhv", reportIn: "MWh", display: "1,036 MMBtu per MMcf (EIA 2026 estimated U.S. natural-gas average), HHV" },
};

// Exposed for the repository's headless numerical conformance check. The public
// UI still uses the same objects and functions directly.
window.EXERGY_FACTOR_CALCULATION_INTERNALS = Object.freeze({
  ENERGY_TO_J,
  FUEL_VOLUME_UNITS,
  thermalFactorFromTemperatures,
});

function applyFixedValuesForUnit() {
  if (!hasField("energy-unit") || !hasField("energy-form")) return;
  const selectedUnit = fields["energy-unit"].value;
  const fixed = FUEL_VOLUME_UNITS[selectedUnit];
  const note = byId("fixed-note");
  const form = fields["energy-form"];

  if (!fixed) {
    if (note) {
      note.hidden = true;
      note.textContent = "";
    }
    form.disabled = false;
    return;
  }

  // The unit names the fuel, so the carrier is not a free choice any more.
  if (form.value !== fixed.form) {
    form.value = fixed.form;
    syncPresetSelection("calculator");
    applyCalculatorForm();
    // applyCalculatorForm resets the unit to the carrier's default, which would
    // undo the very choice that got us here.
    fields["energy-unit"].value = selectedUnit;
  }
  form.disabled = true;
  if (note) {
    note.textContent = `Uses ${fixed.display}. This is an estimated reference conversion, not a meter-specific heating value; use the Python library with your measured HHV or LHV when accuracy matters.`;
    note.hidden = false;
  }
}

function tierDescription(tier) {
  const tiers = window.EXERGY_FACTOR_REFERENCE_DATA && window.EXERGY_FACTOR_REFERENCE_DATA.fidelity_tiers;
  const match = Array.isArray(tiers) ? tiers.find((item) => item.tier === tier) : null;
  if (!match) return tier || "F1";
  return `${match.tier} ${match.name}`;
}

function hasAdvancedSourceOverride() {
  return hasField("source-temp") && fields["source-temp"].value.trim() !== "";
}

function hasCustomFactorOverride() {
  return hasField("custom-factor") && fields["custom-factor"].value.trim() !== "";
}

function thermalFactorFromTemperatures(sourceValue, sourceUnit, sinkValue, sinkUnit) {
  const hasSinkTemp = String(sinkValue).trim() !== "";
  const sourceK = tempToK(sourceValue, sourceUnit);
  const sinkK = tempToK(sinkValue, sinkUnit);
  if (!hasSinkTemp || !Number.isFinite(sourceK) || !Number.isFinite(sinkK) || sourceK <= 0 || sinkK <= 0 || sourceK < sinkK) {
    return NaN;
  }
  return 1 - sinkK / sourceK;
}

function calculateFactor() {
  if (hasField("energy-form")) {
    const formKey = currentPresetKey("calculator");
    const preset = comparePresets[formKey] || comparePresets.custom;

    // Cooling is decided FIRST. It shares the two temperature inputs with heat but
    // uses a different equation, and the generic thermal branch below would read a
    // chiller as a heat source colder than its sink and simply refuse it.
    if (preset.needsTemperature === "cooling") {
      const coldC = toCelsius(fields["source-temp"]?.value, sourceUnit());
      const ambientC = toCelsius(fields["sink-temp"]?.value, sinkUnit());
      if (!Number.isFinite(coldC) || !Number.isFinite(ambientC)) {
        return { factor: NaN, method: "Enter the temperature you are cooling to, and the ambient you reject heat to.", tier: "F2" };
      }
      if (coldC > ambientC) {
        return { factor: NaN, method: "A cooling service cannot be warmer than the ambient it is rejected to.", tier: "F2" };
      }
      return {
        factor: (ambientC + 273.15) / (coldC + 273.15) - 1,
        method: "F2 cooling factor from your service and ambient temperatures.",
        tier: "F2",
        coldC,
        sinkC: ambientC,
      };
    }

    if (hasAdvancedSourceOverride()) {
      const factor = thermalFactorFromTemperatures(
        fields["source-temp"].value,
        sourceUnit(),
        fields["sink-temp"].value,
        sinkUnit(),
      );
      if (!Number.isFinite(factor)) {
        return { factor: NaN, method: "Enter source and sink temperatures with source greater than or equal to sink.", tier: "F2" };
      }
      // Carry the temperatures out with the factor. Without them the caller can
      // only print the short form, which is why this calculator published records
      // nobody could check even when it knew both temperatures.
      return {
        factor,
        method: "F2 thermal factor from source and sink temperatures.",
        tier: "F2",
        sourceC: toCelsius(fields["source-temp"].value, sourceUnit()),
        sinkC: toCelsius(fields["sink-temp"].value, sinkUnit()),
      };
    }

    if (hasCustomFactorOverride()) {
      const custom = Number(fields["custom-factor"]?.value);
      if (Number.isFinite(custom) && custom >= 0) {
        return { factor: custom, method: "F1 custom Exergy Factor provided by user.", tier: "F1" };
      }
      return { factor: NaN, method: "Custom Exergy Factor must be a nonnegative number.", tier: "F1" };
    }

    // Heat with no temperature yet: say what is needed instead of showing a
    // number from a preset the visitor did not choose.
    if (preset.needsTemperature === "heat") {
      return { factor: NaN, method: "Enter the temperature your heat is delivered at, and your reference temperature.", tier: "F2" };
    }

    if (formKey !== "custom") {
      return { factor: preset.fx, method: `${preset.tier || "F1"} reference factor for ${preset.label}.`, tier: preset.tier || "F1" };
    }

    return { factor: NaN, method: "Enter a custom Exergy Factor or source and sink temperatures.", tier: "F1" };
  }

  const hasSourceTemp = hasField("source-temp") && fields["source-temp"].value.trim() !== "";
  const hasSinkTemp = hasField("sink-temp") && fields["sink-temp"].value.trim() !== "";

  if (hasSourceTemp) {
    const factor = thermalFactorFromTemperatures(
      fields["source-temp"].value,
      sourceUnit(),
      fields["sink-temp"].value,
      sinkUnit(),
    );
    if (!hasSinkTemp || !Number.isFinite(factor)) {
      return { factor: NaN, method: "Enter source and sink temperatures with source greater than or equal to sink.", tier: "F2" };
    }
    fields["exergy-factor"].value = formatFactor(
      fields["factor-unit"].value === "percent" ? factor * 100 : factor,
    );
    return { factor, method: "F2 thermal Carnot factor from source and sink temperatures.", tier: "F2" };
  }

  const raw = Number(fields["exergy-factor"]?.value);
  if (!Number.isFinite(raw) || raw < 0) {
    return { factor: NaN, method: "Exergy Factor must be a nonnegative number.", tier: "F1" };
  }
  const factor = fields["factor-unit"]?.value === "percent" ? raw / 100 : raw;
  return { factor, method: "F1 direct Exergy Factor provided by user.", tier: "F1" };
}

function currentEnergyJ() {
  const quantity = Number(fields["energy-value"].value);
  const unit = fields["energy-unit"].value;
  if (!Number.isFinite(quantity) || quantity < 0 || !ENERGY_TO_J[unit]) return NaN;
  return quantity * ENERGY_TO_J[unit];
}

function renderConversions(energyJ, exergyJ) {
  if (!hasField("conversion-grid")) return;

  const rows = [
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.kWh)} kWh`],
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.MWh)} MWh`],
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.GJ)} GJ`],
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.MMBtu)} MMBtu`],
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.kWh)} kWh_ex`],
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.MWh)} MWh_ex`],
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.GJ)} GJ_ex`],
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.MMBtu)} MMBtu_ex`],
  ];

  fields["conversion-grid"].innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="conversion-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
}

// Heat and cooling get their factor from this row's own temperatures. Everything
// else keeps the editable factor field, which is the right control for a carrier
// whose factor is a property of the fuel rather than of your site.
function compareRowTemperatures(side, preset) {
  if (!preset.needsTemperature) return {};
  const sourceC = Number(fields[`compare-${side}-source`]?.value);
  const sinkC = Number(fields[`compare-${side}-sink`]?.value);
  const sourceUnit = fields[`compare-${side}-source-unit`]?.value || "C";
  const sinkUnit = fields[`compare-${side}-sink-unit`]?.value || "C";
  const sourceK = tempToK(sourceC, sourceUnit);
  const sinkK = tempToK(sinkC, sinkUnit);
  const sourceCelsius = toCelsius(sourceC, sourceUnit);
  const sinkCelsius = toCelsius(sinkC, sinkUnit);
  if (!Number.isFinite(sourceK) || !Number.isFinite(sinkK)) return { factor: NaN };
  if (preset.needsTemperature === "cooling") {
    if (sourceK >= sinkK || sourceK <= 0 || sinkK <= 0) return { factor: NaN };
    return { factor: sinkK / sourceK - 1, coldC: sourceCelsius, sinkC: sinkCelsius };
  }
  if (sourceK <= sinkK || sourceK <= 0 || sinkK <= 0) return { factor: NaN };
  return { factor: 1 - sinkK / sourceK, sourceC: sourceCelsius, sinkC: sinkCelsius };
}

function compareRow(side) {
  const prefix = `compare-${side}`;
  const presetKey = currentPresetKey(side);
  const preset = comparePresets[presetKey] || comparePresets.custom;
  const quantity = Number(fields[`${prefix}-quantity`].value);
  const unit = fields[`${prefix}-unit`].value;
  const derived = compareRowTemperatures(side, preset);
  const factor = preset.needsTemperature ? derived.factor : Number(fields[`${prefix}-factor`].value);
  const energyJ = Number.isFinite(quantity) && quantity >= 0 && ENERGY_TO_J[unit]
    ? quantity * ENERGY_TO_J[unit]
    : NaN;
  const exergyJ = Number.isFinite(energyJ) && Number.isFinite(factor) && factor >= 0
    ? energyJ * factor
    : NaN;
  return {
    side: side.toUpperCase(),
    presetKey,
    label: preset.label,
    quantity,
    unit,
    displayUnit: displayUnit(unit, preset),
    // Now that a heat or cooling row carries its own temperatures, it has a full
    // declaration to publish like everything else.
    bracket: declarationBracket({ preset, ...derived }),
    sourceC: derived.sourceC,
    sinkC: derived.sinkC,
    coldC: derived.coldC,
    factor,
    energyJ,
    exergyJ,
    exergyInUnit: exergyJ / ENERGY_TO_J[unit],
    exergyUnit: displayExergyUnit(unit),
    mwhEx: exergyJ / ENERGY_TO_J.MWh,
  };
}

function renderCompare() {
  if (!hasCompare()) return;

  const rows = [compareRow("a"), compareRow("b")];
  if (rows.some((row) => !Number.isFinite(row.exergyJ))) {
    fields["compare-bars"].innerHTML = "";
    fields["compare-summary"].textContent = "Check comparison inputs.";
    if (hasField("compare-equivalence")) fields["compare-equivalence"].textContent = "";
    return;
  }

  fields["compare-bars"].innerHTML = `
    <div class="compare-result-head">
      <span></span>
      <span>Exergy Factor Notation</span>
      <span>Exergy Factor</span>
      <span>Accessible Exergy</span>
      <span>Inaccessible Anergy</span>
    </div>
    ${rows.map((row) => {
      const factorOnScale = Math.min(1, Math.max(0, row.factor));
      const factorBarWidth = factorOnScale * 100;
      // Keep the amber-to-teal scale anchored to the full track. A partial bar
      // therefore shows the early (amber) part of the scale instead of squeezing
      // the entire gradient into its own short width.
      const factorGradientSize = factorOnScale > 0 ? 100 / factorOnScale : 100;
      const factorLabel = formatFactor(row.factor);
      const inaccessibleInUnit = (row.energyJ - row.exergyJ) / ENERGY_TO_J[row.unit];
      const bracket = row.bracket.trim();
      return `
        <div class="compare-result-row">
          <div class="compare-result-side">${row.side}</div>
          <div class="compare-result-notation">${format(row.quantity, 3)} ${row.displayUnit}, fx = ${formatFactor(row.factor)}${bracket ? `<span class="compare-result-bracket">${bracket}</span>` : ""}</div>
          <div class="compare-result-factor">
            <span class="compare-factor-meter" tabindex="0" role="meter" aria-label="${factorLabel} Exergy Factor" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${factorOnScale}" aria-valuetext="${factorLabel}" data-tooltip="Exergy Factor: ${factorLabel}">
              <span class="compare-factor-track" aria-hidden="true">
                <span class="compare-factor-fill" style="--factor-fill:${factorBarWidth}%;--factor-gradient-size:${factorGradientSize}%"></span>
              </span>
            </span>
          </div>
          <strong class="compare-result-value accessible" data-label="Accessible Exergy">${formatDisplayEnergy(row.exergyInUnit)} ${row.unit}</strong>
          <strong class="compare-result-value inaccessible" data-label="Inaccessible Anergy">${formatDisplayEnergy(inaccessibleInUnit)} ${row.unit}</strong>
        </div>
      `;
    }).join("")}
  `;

  const [a, b] = rows;
  if (a.mwhEx === 0 && b.mwhEx === 0) {
    fields["compare-summary"].textContent = "Both records have zero accessible exergy.";
    if (hasField("compare-equivalence")) fields["compare-equivalence"].textContent = "";
    return;
  }
  const higher = a.mwhEx >= b.mwhEx ? a : b;
  const lower = a.mwhEx >= b.mwhEx ? b : a;
  if (lower.mwhEx === 0) {
    fields["compare-summary"].textContent = `${higher.label} carries accessible exergy; ${lower.label} is zero for these inputs.`;
    renderEquivalence(rows);
    return;
  }
  fields["compare-summary"].textContent = `${format(higher.quantity, 3)} ${higher.unit} of ${sentenceLabel(higher)} carries ${format(higher.mwhEx / lower.mwhEx, 2)} times the accessible exergy of ${format(lower.quantity, 3)} ${lower.unit} of ${sentenceLabel(lower)}.`;
  renderEquivalence(rows);
}

function sentenceLabel(row) {
  const label = row.label.replace(/\s+(HHV|LHV)$/i, "").toLowerCase();
  if (row.presetKey === "heat" && Number.isFinite(row.sourceC) && Number.isFinite(row.sinkC)) {
    return `${label} at ${formatBracketTemp(row.sourceC)} in a ${formatBracketTemp(row.sinkC)} environment`;
  }
  if (row.presetKey === "cooling" && Number.isFinite(row.coldC) && Number.isFinite(row.sinkC)) {
    return `${label} at ${formatBracketTemp(row.coldC)} in a ${formatBracketTemp(row.sinkC)} environment`;
  }
  return label;
}

function renderEquivalence(rows) {
  if (!hasField("compare-equivalence")) return;

  const [a, b] = rows;
  if (!Number.isFinite(b.factor) || b.factor <= 0 || !ENERGY_TO_J[b.unit]) {
    fields["compare-equivalence"].textContent = "Equivalence requires row B to have a positive Exergy Factor.";
    return;
  }

  const equivalentQuantity = a.exergyJ / (b.factor * ENERGY_TO_J[b.unit]);
  fields["compare-equivalence"].textContent = `${format(a.quantity, 3)} ${a.unit} of ${sentenceLabel(a)} carries the same accessible exergy as ${format(equivalentQuantity, 3)} ${b.unit} of ${sentenceLabel(b)}.`;
}

function applyCalculatorForm() {
  if (!hasCalculator() || !hasField("energy-form")) return;

  const presetKey = currentPresetKey("calculator");
  const preset = comparePresets[presetKey] || comparePresets.custom;
  updateFuelBasisControl("calculator", presetKey);
  if (hasField("energy-unit") && preset.unit && ENERGY_TO_J[preset.unit]) fields["energy-unit"].value = preset.unit;
  if (hasField("factor-unit")) fields["factor-unit"].value = "decimal";
  if (hasField("exergy-factor")) fields["exergy-factor"].value = preset.fx;
  if (hasField("custom-factor")) fields["custom-factor"].value = "";
  if (hasField("source-temp")) fields["source-temp"].value = "";
  if (hasField("source-unit")) fields["source-unit"].value = "C";
  // Cooling is rejected to ambient, which is warmer than the service, so its
  // sensible default differs from heat's.
  if (hasField("sink-temp")) fields["sink-temp"].value = preset.needsTemperature === "cooling" ? "30" : "20";
  if (hasField("sink-unit")) fields["sink-unit"].value = "C";

  // Show the temperatures only for the carriers whose factor depends on them,
  // the way the comparison page does. A fuel's factor is a property of the fuel;
  // leaving two temperature boxes sitting there implied they did something.
  const wantsTemps = Boolean(preset.needsTemperature);
  const sourceRow = byId("source-temp-row");
  const sinkRow = byId("sink-temp-row");
  if (sourceRow) sourceRow.hidden = !wantsTemps;
  if (sinkRow) sinkRow.hidden = !wantsTemps;

  // "Source" and "Sink" are the wrong words for a chiller: nothing is sourced
  // from the cold side, and the ambient is what heat is rejected TO.
  const cooling = preset.needsTemperature === "cooling";
  const sourceLabel = sourceRow?.querySelector("label");
  const sinkLabel = sinkRow?.querySelector("label");
  if (sourceLabel) sourceLabel.textContent = cooling ? "Cooling Temperature" : "Source Temperature";
  if (sinkLabel) sinkLabel.textContent = cooling ? "Ambient Temperature" : "Sink Temperature";
  if (hasField("source-temp")) fields["source-temp"].placeholder = cooling ? "7" : "80";
}

function updateCalculator() {
  if (!hasCalculator()) {
    renderCompare();
    return;
  }

  applyFixedValuesForUnit();

  const energy = Number(fields["energy-value"].value);
  const energyUnit = normalizeUnit(fields["energy-unit"].value);
  const preset = comparePresets[currentPresetKey("calculator")] || comparePresets.custom;
  const energyJ = currentEnergyJ();
  const { factor, method, tier, sourceC, sinkC, coldC } = calculateFactor();

  if (!Number.isFinite(energy) || energy < 0 || !Number.isFinite(energyJ) || !Number.isFinite(factor)) {
    fields["notation-output"].textContent = "Check the inputs";
    if (hasField("fx-output")) fields["fx-output"].textContent = "No result";
    if (hasField("work-output")) fields["work-output"].textContent = "No result";
    if (hasField("exergy-output")) fields["exergy-output"].textContent = "No result";
    if (hasField("method-output")) fields["method-output"].textContent = method;
    if (hasField("tier-output")) fields["tier-output"].textContent = tierDescription(tier);
    if (hasField("basis-output")) fields["basis-output"].textContent = preset.basis || "No basis";
    if (hasField("conversion-grid")) fields["conversion-grid"].innerHTML = "";
    if (hasField("calculator-result")) fields["calculator-result"].hidden = false;
    return;
  }

  // An Exergy Factor is work potential per unit ENERGY, so it cannot be applied to
  // a volume. Reporting `1 bbl(oil), fx = 1.060` and `1.06 bbl_ex` produced
  // "barrels of exergy", which is not a quantity. For a fuel-volume unit the
  // notation states the energy the volume represents — via the heating value shown
  // and locked above — and the exergy comes out in energy units too.
  const fixedForUnit = FUEL_VOLUME_UNITS[fields["energy-unit"].value];
  const reportInJ = fixedForUnit ? ENERGY_TO_J[fixedForUnit.reportIn] : 0;
  // The carrier suffix rides on whichever energy unit we report in. Taking
  // preset.typedUnit wholesale pinned an "MWh" prefix onto a quantity that was
  // actually in kWh, so an scf read `0.2931 MWh_HHV_NG` beside `0.273 kWh_ex`.
  const typedEnergyUnit = fixedForUnit
    ? `${fixedForUnit.reportIn}${typedSuffix(preset.typedUnit)}`
    : displayUnit(energyUnit, preset);
  const notationQuantity = fixedForUnit ? energyJ / reportInJ : energy;

  // THE FULL OPERATIONAL NOTATION.
  //
  //     1 MWh, fx = 0.170 [Th = 80 C, T0 = 20 C]
  //
  // The bracket is the whole point: it is what lets whoever receives the record
  // re-derive the factor themselves, in one division, without trusting this
  // calculator. This page previously published only the short form even when it
  // had both temperatures in hand, while the methodology page promised the
  // notation "can be short or self-verifying" — so the claim was made and the
  // evidence withheld.
  const isCooling = Number.isFinite(coldC) && Number.isFinite(sinkC);
  const bracket = declarationBracket({ preset, sourceC, sinkC, coldC });
  const notation = `${format(notationQuantity, 4)} ${typedEnergyUnit}, fx = ${formatFactor(factor)}${bracket}`;
  const exergyJ = energyJ * factor;
  const exergyInInputUnit = fixedForUnit
    ? exergyJ / reportInJ
    : exergyJ / ENERGY_TO_J[fields["energy-unit"].value];
  const exergyUnit = fixedForUnit ? `${fixedForUnit.reportIn}_ex` : displayExergyUnit(energyUnit);

  fields["notation-output"].textContent = notation;
  if (hasField("fx-output")) fields["fx-output"].textContent = formatFactor(factor);
  if (hasField("work-output")) fields["work-output"].textContent = `${formatDisplayEnergy(exergyInInputUnit)} ${exergyUnit}`;
  if (hasField("exergy-output")) fields["exergy-output"].textContent = `${formatDisplayEnergy(exergyInInputUnit)} ${exergyUnit}`;
  if (hasField("method-output")) fields["method-output"].textContent = method;
  if (hasField("tier-output")) fields["tier-output"].textContent = tierDescription(tier);
  if (hasField("basis-output")) fields["basis-output"].textContent = preset.basis || method;
  if (hasField("calculator-result")) fields["calculator-result"].hidden = false;
  renderConversions(energyJ, exergyJ);
  renderCompare();
}

function applyComparePreset(side) {
  if (!hasCompare()) return;

  const presetKey = currentPresetKey(side);
  const preset = comparePresets[presetKey] || comparePresets.custom;
  updateFuelBasisControl(side, presetKey);
  fields[`compare-${side}-unit`].value = preset.unit;

  // Show whichever control this carrier actually needs — the factor, or the two
  // temperatures it is derived from. They are alternatives, so the row does not
  // grow. Heat and cooling used to show an empty "enter fx" box with nowhere to
  // get the number, which asked the visitor for the one thing they came without.
  const factorRow = byId(`compare-${side}-factor-row`);
  const tempsRow = byId(`compare-${side}-temps`);
  const needsTemps = Boolean(preset.needsTemperature);
  const needsCustomFactor = presetKey === "custom";
  if (factorRow) factorRow.hidden = needsTemps || !needsCustomFactor;
  if (tempsRow) tempsRow.hidden = !needsTemps;
  // Two temperature boxes need more of the row than one factor box did.
  const rowEl = document.querySelector(`[data-compare-row="${side}"]`);
  if (rowEl) {
    rowEl.classList.toggle("has-temps", needsTemps);
    rowEl.classList.toggle("has-factor", needsCustomFactor);
  }

  if (needsTemps) {
    const cooling = preset.needsTemperature === "cooling";
    const source = fields[`compare-${side}-source`];
    const sink = fields[`compare-${side}-sink`];
    // Two bare boxes give no clue which is which, and a placeholder of "7" or
    // "80" only looks like a value someone forgot to type. They say what they are.
    if (source) {
      source.value = cooling ? "" : "100";
      source.placeholder = cooling ? "cooling to" : "source";
    }
    // Cooling is rejected to ambient, which is warmer than the service.
    if (sink) {
      sink.value = cooling ? "30" : "20";
      sink.placeholder = cooling ? "ambient" : "reference";
    }
    fields[`compare-${side}-source-unit`].value = "C";
    fields[`compare-${side}-sink-unit`].value = "C";
  } else {
    fields[`compare-${side}-factor`].value = preset.fx;
  }
  renderCompare();
}

function setExample(name) {
  if (!hasCalculator()) return;

  const example = examples[name];
  if (!example) return;
  fields["energy-value"].value = example.energy;
  fields["energy-unit"].value = example.unit;
  if (hasField("energy-form")) {
    fields["energy-form"].value = example.form || "custom";
    syncPresetSelection("calculator");
  }
  applyCalculatorForm();
  fields["energy-unit"].value = example.unit;

  // An example that carries temperatures has to keep them. This blanked
  // source-temp unconditionally, which was harmless while heat came from a fixed
  // preset and fatal once the temperature became the input: both heat examples
  // set "Heat", immediately erased their own 80 °C or 150 °C, and rendered
  // "Check the inputs".
  if (hasField("source-temp")) fields["source-temp"].value = example.source ?? "";
  if (hasField("source-unit")) fields["source-unit"].value = example.sourceUnit || "C";
  if (hasField("sink-temp")) fields["sink-temp"].value = example.sink ?? "20";
  if (hasField("sink-unit")) fields["sink-unit"].value = example.sinkUnit || "C";
  if (hasField("factor-unit")) fields["factor-unit"].value = "decimal";
  if (hasField("exergy-factor")) fields["exergy-factor"].value = example.fx;
  if (hasField("custom-factor")) {
    fields["custom-factor"].value = currentPresetKey("calculator") === "custom" ? example.fx : "";
  }
  updateCalculator();
}

// ---------------------------------------------------------------------------
// Export
//
// Both formats are built with nothing but the platform. The site is deliberately
// zero-build and zero-dependency, and pulling a screenshot library off a CDN to
// make an image would trade that for a third-party script on every page load.
//
// The PNG is DRAWN rather than screenshotted. A DOM capture would also take the
// export buttons, the tooltips and whatever the layout happens to be doing at
// that width, and the usual foreignObject route silently loses external
// stylesheets and misbehaves in Safari. Drawing the record onto a canvas gives
// the same information as a deliberate, legible card that looks the same
// everywhere — and it cannot capture something the reader did not mean to share.
// ---------------------------------------------------------------------------

/** What is currently on screen, in one shape both exporters can use. */
function exportModel() {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";

  if (hasCalculator()) {
    const preset = comparePresets[currentPresetKey("calculator")] || comparePresets.custom;
    const inputs = [
      ["Carrier", preset.label],
      ["Quantity", fields["energy-value"].value],
      ["Unit", fields["energy-unit"].value],
    ];
    if (preset.needsTemperature) {
      const isCooling = preset.needsTemperature === "cooling";
      inputs.push([isCooling ? "Cooling to" : "Source temperature",
        `${fields["source-temp"].value} ${sourceUnit()}`]);
      inputs.push([isCooling ? "Ambient" : "Reference temperature",
        `${fields["sink-temp"].value} ${sinkUnit()}`]);
    }
    const fixed = FUEL_VOLUME_UNITS[fields["energy-unit"].value];
    if (fixed) inputs.push(["Heating value", fixed.display]);
    return {
      kind: "calculator",
      title: "Exergy Factor",
      inputs,
      results: [
        ["Exergy Factor", fields["fx-output"]?.textContent.trim() || ""],
        ["Exergy Factor Notation", fields["notation-output"].textContent.trim()],
        ["Accessible Exergy", fields["work-output"].textContent.trim()],
      ],
      stamp,
    };
  }

  if (hasCompare()) {
    const rows = [compareRow("a"), compareRow("b")];
    return {
      kind: "compare",
      title: "Exergy Factor — comparison",
      rows: rows.map((row) => ({
        side: row.side,
        carrier: row.label,
        quantity: row.quantity,
        unit: row.unit,
        factor: row.factor,
        notation: `${format(row.quantity, 3)} ${row.displayUnit}, fx = ${formatFactor(row.factor)}${row.bracket}`,
        exergy: `${formatDisplayEnergy(row.exergyInUnit)} ${row.exergyUnit}`,
      })),
      results: [
        ["Accessible Exergy Ratio", fields["compare-summary"].textContent.trim()],
        ["Equivalent Quantity", hasField("compare-equivalence") ? fields["compare-equivalence"].textContent.trim() : ""],
      ].filter((pair) => pair[1]),
      stamp,
    };
  }
  return null;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportCsv() {
  const model = exportModel();
  if (!model) return;
  let lines;
  if (model.kind === "compare") {
    lines = [["side", "carrier", "quantity", "unit", "exergy_factor", "notation", "accessible_exergy"].join(",")];
    for (const row of model.rows) {
      lines.push([row.side, row.carrier, row.quantity, row.unit, formatFactor(row.factor), row.notation, row.exergy].map(csvCell).join(","));
    }
  } else {
    lines = [["field", "value"].join(",")];
    for (const [key, value] of [...model.inputs, ...model.results]) {
      lines.push([key, value].map(csvCell).join(","));
    }
  }
  lines.push([].join(""));
  lines.push(["generated", model.stamp].map(csvCell).join(","));
  lines.push(["source", "https://exergyfactor.com/"].map(csvCell).join(","));
  const stampForName = model.stamp.slice(0, 10);
  downloadBlob(
    new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }),
    `exergy-factor-${model.kind}-${stampForName}.csv`,
  );
}

function exportPng() {
  const model = exportModel();
  if (!model) return;

  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = 900;
  const pad = 48;
  const lineGap = 30;

  // Lay the card out once to find its height, then draw it. Measuring first
  // avoids a fixed height that clips a long comparison or leaves a gap under a
  // short one.
  const blocks = [];
  blocks.push({ type: "title", text: model.title });
  if (model.kind === "compare") {
    for (const row of model.rows) {
      blocks.push({ type: "label", text: `Side ${row.side} — ${row.carrier}` });
      blocks.push({ type: "value", text: row.notation });
      blocks.push({ type: "value", text: `Accessible exergy: ${row.exergy}` });
      blocks.push({ type: "gap" });
    }
  } else {
    for (const [key, value] of model.inputs) blocks.push({ type: "pair", key, text: value });
    blocks.push({ type: "gap" });
  }
  for (const [key, value] of model.results) {
    blocks.push({ type: "label", text: key });
    blocks.push({ type: "value", text: value });
  }

  // ONE definition of how far each block advances, used to size the canvas and
  // again to draw it. Two separate guesses left a band of empty white above the
  // footer that grew with the number of rows.
  const advanceFor = (block) => {
    if (block.type === "gap") return 14;
    if (block.type === "title") return lineGap + 6;
    if (block.type === "label") return lineGap - 8;
    return lineGap;
  };
  const height = pad * 2 + 8 + blocks.reduce((total, block) => total + advanceFor(block), 0);

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  // Nothing to draw on. Better to leave the page alone than to throw out of a
  // click handler and take the rest of the script with it.
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0f766e";
  ctx.fillRect(0, 0, width, 6);

  let y = pad + 8;
  for (const block of blocks) {
    if (block.type === "title") {
      ctx.fillStyle = "#134e4a";
      ctx.font = "700 24px Arial, Helvetica, sans-serif";
      ctx.fillText(block.text, pad, y);
    } else if (block.type === "label") {
      ctx.fillStyle = "#5b6b68";
      ctx.font = "600 13px Arial, Helvetica, sans-serif";
      ctx.fillText(block.text.toUpperCase(), pad, y);
    } else if (block.type === "pair") {
      ctx.fillStyle = "#5b6b68";
      ctx.font = "400 15px Arial, Helvetica, sans-serif";
      ctx.fillText(block.key, pad, y);
      ctx.fillStyle = "#1d2b2b";
      ctx.font = "600 15px Arial, Helvetica, sans-serif";
      ctx.fillText(String(block.text), pad + 250, y);
    } else if (block.type === "value") {
      ctx.fillStyle = "#1d2b2b";
      ctx.font = "600 17px Arial, Helvetica, sans-serif";
      ctx.fillText(block.text, pad, y);
    }
    y += advanceFor(block);
  }

  ctx.fillStyle = "#8a9895";
  ctx.font = "400 12px Arial, Helvetica, sans-serif";
  ctx.fillText(`exergyfactor.com · ${model.stamp}`, pad, height - 20);

  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `exergy-factor-${model.kind}-${model.stamp.slice(0, 10)}.png`);
  }, "image/png");
}

async function checkApiHealth() {
  if (!hasApiHealthCheck()) return;

  const status = fields["api-health-status"];
  const button = fields["api-health-check"];
  const baseUrl = apiBaseUrl();
  status.dataset.state = "pending";
  status.textContent = "Checking the live API...";
  button.disabled = true;

  try {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.detail || `Health check returned HTTP ${response.status}.`);
    }
    status.dataset.state = "success";
    status.textContent = `Live API is healthy (${data.schema_version}).`;
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = error && error.message ? error.message : "Unable to reach the live API.";
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cacheFields();

  if (hasCalculator()) {
    byId("calculator-form").addEventListener("submit", (event) => event.preventDefault());
    document.querySelectorAll("#calculator-form input, #calculator-form select").forEach((element) => {
      const update = () => {
        if (element.id === "energy-basis-toggle") applyFuelBasisToggle("calculator");
        if (element.id === "energy-form") {
          syncPresetSelection("calculator");
          applyCalculatorForm();
        }
        updateCalculator();
      };
      element.addEventListener("input", update);
      element.addEventListener("change", update);
    });
    document.querySelectorAll("[data-example]").forEach((button) => {
      button.addEventListener("click", () => setExample(button.dataset.example));
    });
    applyCalculatorForm();
    updateCalculator();
  }

  if (hasCompare()) {
    ["a", "b"].forEach((side) => {
      fields[`compare-${side}-preset`].addEventListener("change", () => {
        syncPresetSelection(side);
        applyComparePreset(side);
      });
      fields[`compare-${side}-basis-toggle`]?.addEventListener("change", () => {
        applyFuelBasisToggle(side);
        applyComparePreset(side);
      });
      fields[`compare-${side}-quantity`].addEventListener("input", renderCompare);
      // Changing the unit no longer drops the row to "Custom". The carrier and
      // the unit are independent — natural gas is natural gas whether you meter
      // it in MMBtu or MWh — and for a heat row the reset was worse than
      // surprising: it hid the temperature fields mid-entry and put the empty
      // factor box back.
      fields[`compare-${side}-unit`].addEventListener("change", renderCompare);
      // Typing a factor by hand IS an override, so that still becomes Custom.
      fields[`compare-${side}-factor`].addEventListener("input", () => {
        fields[`compare-${side}-preset`].value = "custom";
        updateFuelBasisControl(side, "custom");
        renderCompare();
      });
      [`compare-${side}-source`, `compare-${side}-source-unit`, `compare-${side}-sink`, `compare-${side}-sink-unit`].forEach((id) => {
        if (fields[id]) fields[id].addEventListener("input", renderCompare);
        if (fields[id]) fields[id].addEventListener("change", renderCompare);
      });
      applyComparePreset(side);
    });
  }

  if (hasField("export-csv")) fields["export-csv"].addEventListener("click", exportCsv);
  if (hasField("export-png")) fields["export-png"].addEventListener("click", exportPng);

  if (hasApiHealthCheck()) {
    fields["api-health-check"].addEventListener("click", checkApiHealth);
  }

  if (hasCompare()) renderCompare();
});
