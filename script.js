const ENERGY_TO_J = {
  Wh: 3600,
  kWh: 3.6e6,
  MWh: 3.6e9,
  GWh: 3.6e12,
  TWh: 3.6e15,
  J: 1,
  kJ: 1e3,
  MJ: 1e6,
  GJ: 1e9,
  TJ: 1e12,
  PJ: 1e15,
  EJ: 1e18,
  Btu: 1055.05585262,
  MMBtu: 1.05505585262e9,
  Quad: 1.05505585262e18,
  // NIST U.S. legal therm. It intentionally differs slightly from 100,000
  // International Table Btu.
  therm: 105480400,
  dekatherm: 10 * 105480400,
  Dth: 10 * 105480400,
  "ton-hour": 12000 * 1055.05585262,
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
  methane: { energy: 1.3, unit: "MWh", form: "naturalGas", basis: "HHV", fx: 0.93, auto: false },
  hydrogen: { energy: 2.47, unit: "MWh", form: "hydrogen", basis: "HHV", fx: 0.83, auto: false },
};

const comparePresets = {
  // Electricity and mechanical work are both work-equivalent (fx = 1), but they
  // remain separate so the carrier is not mislabeled in the exported notation.
  electricity: { label: "Electricity", unit: "MWh", typedUnit: "MWh_e", fx: 1, tier: "F1", basis: "Delivered work at point of use" },
  mechanical: { label: "Mechanical work", unit: "MWh", typedUnit: "MWh_m", fx: 1, tier: "F1", basis: "Delivered shaft work at the machine boundary" },

  // `needsTemperature` means the user supplies the number, not a preset. There
  // used to be thirteen fixed heat temperatures — 35, 40, 50, 60, 70, 80, 90,
  // 120, 150, 180, 250, 500 °C — and the chance a real stream sits exactly on one
  // of them is close to nil, so almost every visitor either picked a wrong
  // neighbour or gave up. The temperature is the answer; it should be typed in.
  // Btu is the friendlier default for a heat quantity on the public calculator;
  // keep the canonical comparison/reporting unit in MWh so the comparison page
  // remains stable and users can still choose any supported unit explicitly.
  heat: { label: "Heat", unit: "MWh", calculatorUnit: "Btu", typedUnit: "MWh_th", tier: "F2", needsTemperature: "heat", basis: "Carnot factor from your source and reference temperatures" },
  cooling: { label: "Cooling", unit: "MWh", typedUnit: "MWh_cooling", tier: "F2", needsTemperature: "cooling", basis: "Cooling service against your stated ambient" },

  // Natural gas is ~93% methane and the framework's screening factor is the same
  // number, so they were literally duplicate rows: `methane` and `naturalGasLhv`
  // carried identical fx AND identical typed units. Named together instead.
  naturalGasHhv: { label: "Natural gas (HHV)", unit: "MWh", typedUnit: "MWh_HHV_NG", fx: 0.93, tier: "F1", basis: "Higher heating value fuel basis" },
  naturalGasLhv: { label: "Natural gas (LHV)", unit: "MWh", typedUnit: "MWh_LHV_CH4", fx: 1.04, tier: "F1", basis: "Lower heating value fuel basis; natural gas approximated as methane" },
  hydrogen: { label: "Hydrogen (HHV)", unit: "MWh", typedUnit: "MWh_HHV_H2", fx: 0.83, tier: "F1", basis: "Higher heating value hydrogen basis" },
  hydrogenLhv: { label: "Hydrogen (LHV)", unit: "MWh", typedUnit: "MWh_LHV_H2", fx: 0.98, tier: "F1", basis: "Lower heating value hydrogen basis" },
  dieselLhv: { label: "Diesel (LHV reference)", unit: "MWh", typedUnit: "MWh_LHV_diesel", fx: 1.06, tier: "F1", basis: "Approximate lower heating value fuel basis" },
  gasolineLhv: { label: "Gasoline (LHV reference)", unit: "MWh", typedUnit: "MWh_LHV_gasoline", fx: 1.07, tier: "F1", basis: "Approximate lower heating value fuel basis" },
  coalLhv: { label: "Coal (LHV reference)", unit: "MWh", typedUnit: "MWh_LHV_coal", fx: 1.05, tier: "F1", basis: "Approximate lower heating value fuel basis" },
  crudeOil: { label: "Crude oil (LHV reference)", unit: "MWh", typedUnit: "MWh_LHV_crude", fx: 1.06, tier: "F1", basis: "Approximate lower heating value crude-oil basis" },

  solar: { label: "Solar radiation", unit: "MWh", typedUnit: "MWh_solar", fx: 0.932, tier: "F2", basis: "Petela radiation Exergy Factor", referenceC: 20 },
  custom: { label: "Custom", unit: "MWh", typedUnit: "", fx: 0.73, tier: "F1", needsCustomFactor: true, basis: "User-defined Exergy Factor" },
};

// The browser keeps the common fuel choice simple. HHV is the canonical public
// default; LHV is available only when the source record explicitly uses it.
const FORM_BASIS_KEYS = Object.freeze({
  naturalGas: Object.freeze({ HHV: "naturalGasHhv", LHV: "naturalGasLhv" }),
  hydrogen: Object.freeze({ HHV: "hydrogen", LHV: "hydrogenLhv" }),
});

function formPresetKey(formKey, basis = "HHV") {
  return FORM_BASIS_KEYS[formKey]?.[basis] || formKey;
}

function calculatorPreset() {
  const formKey = fields["energy-form"]?.value;
  const basis = fields["energy-basis"]?.value || "HHV";
  const key = formPresetKey(formKey, basis);
  return { formKey, key, preset: comparePresets[key] || comparePresets.custom };
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
    if (Number.isFinite(canonical.referenceC)) preset.referenceC = canonical.referenceC;
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

function compareSides() {
  return Array.from(document.querySelectorAll("[data-compare-row]"))
    .map((row) => row.dataset.compareRow)
    .filter(Boolean)
    .slice(0, 2);
}

function hasCompare() {
  return compareSides().length === 2 && hasField("compare-bars");
}

function cacheFields() {
  [
    "energy-value",
    "energy-unit",
    "energy-form",
    "energy-unit-help",
    "energy-basis",
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
    "inaccessible-output",
    "exergy-output",
    "method-output",
    "tier-output",
    "basis-output",
    "conversion-grid",
    "compare-a-preset",
    "compare-a-quantity",
    "compare-a-unit",
    "compare-a-factor",
    "compare-a-source",
    "compare-a-source-unit",
    "compare-a-sink",
    "compare-a-sink-unit",
    "compare-b-preset",
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
    "export-csv",
    "export-png",
  ].forEach((id) => {
    fields[id] = byId(id);
  });

  // Cache comparison controls by id so each row uses the same calculation path.
  document.querySelectorAll("[id^='compare-']").forEach((element) => {
    fields[element.id] = element;
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

// The calculation always converts temperatures to Kelvin internally, but the
// declaration bracket preserves the units the user selected. That keeps a copied
// record faithful to the source data: `Th = 212 °F` stays visibly Fahrenheit.
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

function formatTemperatureDisplay(value, unit) {
  const symbols = { C: "°C", F: "°F", K: "K" };
  return `${value} ${symbols[unit] || unit}`;
}

function format(value, precision = 4) {
  if (!Number.isFinite(value)) return "invalid";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 100000 || abs < 0.0001) return value.toExponential(3);
  return Number(value.toFixed(precision)).toString();
}

// Comparison text is meant to be read by people, not copied from a calculator
// log. Keep scientific notation in the general formatter for technical exports,
// but spell out large comparison values so `1.880e+7x` becomes `18.8 million
// times` and an equivalent quantity becomes `94 million BTU`.
const COMPARISON_SCALES = Object.freeze([
  { divisor: 1e18, label: "quintillion" },
  { divisor: 1e15, label: "quadrillion" },
  { divisor: 1e12, label: "trillion" },
  { divisor: 1e9, label: "billion" },
  { divisor: 1e6, label: "million" },
  { divisor: 1e3, label: "thousand" },
]);

function formatComparisonMagnitude(value, precision = 2) {
  const scale = COMPARISON_SCALES.find(({ divisor }) => Math.abs(value) >= divisor);
  if (!scale) return Number(value.toFixed(precision)).toString();
  return `${Number((value / scale.divisor).toFixed(precision))} ${scale.label}`;
}

function formatComparisonRatio(value) {
  if (!Number.isFinite(value)) return "invalid";
  if (value === 0) return "0 times";
  return `${formatComparisonMagnitude(value, 2)} times`;
}

function formatComparisonQuantity(value) {
  if (!Number.isFinite(value)) return "invalid";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1000) return formatComparisonMagnitude(value, 2);
  if (Math.abs(value) < 0.001) return Number(value.toPrecision(3)).toString();
  return Number(value.toFixed(3)).toString();
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

// A temperature as it appears inside the declaration bracket. Include the degree
// symbol so the self-verifying notation is readable when copied from the site.
function formatBracketTemp(celsius) {
  return `${Math.round((celsius + 1e-9) * 10) / 10} °C`;
}

function formatBracketTemperature(value, unit, fallbackCelsius) {
  const number = Number(value);
  const symbols = { C: "°C", F: "°F", K: "K" };
  if (Number.isFinite(number) && symbols[unit]) {
    return `${Math.round((number + 1e-9) * 10) / 10} ${symbols[unit]}`;
  }
  return Number.isFinite(fallbackCelsius) ? formatBracketTemp(fallbackCelsius) : "invalid";
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
// gas), so the full record is `1 MWh_HHV_NG, fx = 0.930 [basis = HHV]` rather
// than leaving the basis to be inferred from the unit suffix. The library states
// it the same way; so does this.
function declarationBracket({
  preset,
  sourceC,
  sinkC,
  coldC,
  sourceValue,
  sourceUnit,
  sinkValue,
  sinkUnit,
  coldValue,
  coldUnit,
}) {
  const displayedSink = formatBracketTemperature(sinkValue, sinkUnit, sinkC);
  if (Number.isFinite(coldC) && Number.isFinite(sinkC)) {
    const displayedCold = formatBracketTemperature(coldValue ?? sourceValue, coldUnit ?? sourceUnit, coldC);
    return ` [Tcold = ${displayedCold}, T0 = ${displayedSink}]`;
  }
  if (Number.isFinite(sourceC) && Number.isFinite(sinkC) && sourceC > sinkC) {
    const displayedSource = formatBracketTemperature(sourceValue, sourceUnit, sourceC);
    return ` [Th = ${displayedSource}, T0 = ${displayedSink}]`;
  }
  if (preset?.typedUnit?.endsWith("_solar") && Number.isFinite(preset.referenceC)) {
    return ` [T0 = ${formatBracketTemp(preset.referenceC)}]`;
  }
  const basis = /_(HHV|LHV)_/.exec(preset?.typedUnit || "");
  if (basis) return ` [basis = ${basis[1]}]`;
  return "";
}

function formatDisplayEnergy(value) {
  return format(value, 3);
}

function displayEnergyUnit(unit) {
  return String(unit).replaceAll("MMBtu", "MMBTU").replaceAll("Btu", "BTU");
}

function normalizeUnit(unit) {
  return unit;
}

function typedSuffix(typedUnit) {
  if (!typedUnit || !typedUnit.includes("_")) return "";
  return typedUnit.slice(typedUnit.indexOf("_"));
}

function displayUnit(unit, preset = null) {
  if (!preset || !preset.typedUnit || unit.includes("(")) return displayEnergyUnit(unit);
  const suffix = typedSuffix(preset.typedUnit);
  return displayEnergyUnit(suffix ? `${unit}${suffix}` : unit);
}

function displayAccessibleUnit(unit) {
  const baseUnit = unit.replace(/\(.+\)/, "");
  return baseUnit === "J" ? "Joules" : displayEnergyUnit(baseUnit);
}

// Fuel-volume units carry a reference heating value the calculator applies for you.
//
// A barrel and an scf measure VOLUME, so `ENERGY_TO_J` is already assuming an
// energy content to convert them — here, pinned EIA 2026 U.S.-average estimates.
// A volume and fuel name still cannot determine a meter-specific heating value. That
// assumption was invisible: a visitor picking `bbl(oil)` had no way to see which
// heating value they had just accepted, and the carrier they picked in the form
// above could contradict the one the unit implies.
//
// They are offered only when the matching fuel form is selected. The form stays
// under the user's control, and the estimate is kept in the Unit info tooltip so
// it does not insert a moving note into the input stack.
// `reportIn` keeps the reported figure at a readable size. A single scf in MWh is
// 0.0003, and its exergy rounds to a bare "0" on screen — a number that looks like
// an error rather than a small quantity.
const FUEL_VOLUME_UNITS = {
  "boe": { form: "crudeOil", reportIn: "MWh", display: "5.800 MMBTU per barrel of oil equivalent (nominal U.S. DOE convention)" },
  "bbl(oil)": { form: "crudeOil", reportIn: "MWh", display: "5.689 MMBTU per barrel (EIA 2026 estimated U.S. crude-oil average)" },
  "scf(natural gas)": { form: "naturalGas", basis: "HHV", reportIn: "kWh", display: "1,036 BTU per scf (EIA 2026 estimated U.S. natural-gas average), HHV" },
  "Mcf(natural gas)": { form: "naturalGas", basis: "HHV", reportIn: "MWh", display: "1.036 MMBTU per Mcf (EIA 2026 estimated U.S. natural-gas average), HHV" },
  "MMcf(natural gas)": { form: "naturalGas", basis: "HHV", reportIn: "MWh", display: "1,036 MMBTU per MMcf (EIA 2026 estimated U.S. natural-gas average), HHV" },
};

const COOLING_SERVICE_UNITS = new Set(["ton-hour"]);

const DEFAULT_UNIT_TOOLTIP = "Choose the unit from your meter, invoice, model, or dataset. Fuel-volume shortcuts are shown only for their matching fuel form; their reference estimate appears here.";

// Exposed for the repository's headless numerical conformance check. The public
// UI still uses the same objects and functions directly.
window.EXERGY_FACTOR_CALCULATION_INTERNALS = Object.freeze({
  ENERGY_TO_J,
  FUEL_VOLUME_UNITS,
  COOLING_SERVICE_UNITS,
  FORM_BASIS_KEYS,
  comparePresets,
  formPresetKey,
  unitCompatibleWithForm,
  thermalFactorFromTemperatures,
  formatComparisonRatio,
  formatComparisonQuantity,
  displayEnergyUnit,
  displayUnit,
  formatBracketTemperature,
});

function unitCompatibleWithForm(formKey, unit) {
  const fixed = FUEL_VOLUME_UNITS[unit];
  if (fixed && fixed.form !== formKey) return false;
  if (COOLING_SERVICE_UNITS.has(unit) && formKey !== "cooling") return false;
  return true;
}

function updateUnitOptions() {
  if (!hasField("energy-unit") || !hasField("energy-form")) return;

  const formKey = fields["energy-form"].value;
  const select = fields["energy-unit"];
  for (const option of select.options) {
    const compatible = unitCompatibleWithForm(formKey, option.value);
    option.hidden = !compatible;
    option.disabled = !compatible;
  }

  if (!unitCompatibleWithForm(formKey, select.value)) {
    const { preset } = calculatorPreset();
    const fallback = preset.calculatorUnit || preset.unit;
    if (fallback && unitCompatibleWithForm(formKey, fallback)) select.value = fallback;
  }
}

function updateUnitContext() {
  if (!hasField("energy-unit")) return;

  const selectedUnit = fields["energy-unit"].value;
  const fixed = FUEL_VOLUME_UNITS[selectedUnit];
  const help = byId("energy-unit-help");
  if (fixed) {
    if (hasField("energy-basis")) {
      if (fixed.basis) fields["energy-basis"].value = fixed.basis;
      fields["energy-basis"].disabled = Boolean(fixed.basis);
    }
    if (help) {
      help.dataset.tooltip = `Reference conversion: ${fixed.display}. This is an estimated reference, not a meter-specific heating value; use a measured HHV or LHV with the Python library or API when accuracy matters.`;
    }
    return;
  }

  if (hasField("energy-basis")) fields["energy-basis"].disabled = false;
  if (help) help.dataset.tooltip = DEFAULT_UNIT_TOOLTIP;
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
    const { formKey, preset } = calculatorPreset();

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
      let factor;
      try {
        // Use the same canonical kernel as the public API after converting each
        // independently selected temperature unit to Celsius. This avoids a
        // second UI-only equation drifting from the tested cooling calculation.
        factor = coolingExergyFactorC(coldC, ambientC);
      } catch (error) {
        return { factor: NaN, method: error instanceof Error ? error.message : "Enter valid cooling and ambient temperatures.", tier: "F2" };
      }
      return {
        factor,
        method: "F2 cooling factor from your service and ambient temperatures.",
        tier: "F2",
        coldC,
        sinkC: ambientC,
        coldValue: fields["source-temp"]?.value,
        coldUnit: sourceUnit(),
        sinkValue: fields["sink-temp"]?.value,
        sinkUnit: sinkUnit(),
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
        sourceValue: fields["source-temp"].value,
        sourceUnit: sourceUnit(),
        sinkValue: fields["sink-temp"].value,
        sinkUnit: sinkUnit(),
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

function renderConversions(energyJ, exergyJ, inaccessibleJ = energyJ - exergyJ) {
  if (!hasField("conversion-grid")) return;

  const rows = [
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.kWh)} kWh`],
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.MWh)} MWh`],
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.GJ)} GJ`],
    ["Energy", `${formatDisplayEnergy(energyJ / ENERGY_TO_J.MMBtu)} MMBTU`],
    ["Accessible Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.kWh)} kWh`],
    ["Accessible Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.MWh)} MWh`],
    ["Accessible Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.GJ)} GJ`],
    ["Accessible Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.MMBtu)} MMBTU`],
    ["Inaccessible Anergy", `${formatDisplayEnergy(inaccessibleJ / ENERGY_TO_J.kWh)} kWh`],
    ["Inaccessible Anergy", `${formatDisplayEnergy(inaccessibleJ / ENERGY_TO_J.MWh)} MWh`],
    ["Inaccessible Anergy", `${formatDisplayEnergy(inaccessibleJ / ENERGY_TO_J.GJ)} GJ`],
    ["Inaccessible Anergy", `${formatDisplayEnergy(inaccessibleJ / ENERGY_TO_J.MMBtu)} MMBTU`],
  ];

  fields["conversion-grid"].innerHTML = rows
    .map(
          ([label, value]) => `
        <div class="conversion-card${label === "Inaccessible Anergy" ? " inaccessible-anergy" : ""}">
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
  const sourceValue = fields[`compare-${side}-source`]?.value;
  const sinkValue = fields[`compare-${side}-sink`]?.value;
  const sourceUnit = fields[`compare-${side}-source-unit`]?.value || "C";
  const sinkUnit = fields[`compare-${side}-sink-unit`]?.value || "C";
  const sourceC = toCelsius(sourceValue, sourceUnit);
  const sinkC = toCelsius(sinkValue, sinkUnit);
  if (!Number.isFinite(sourceC) || !Number.isFinite(sinkC)) return { factor: NaN };
  const sourceK = tempToK(sourceValue, sourceUnit);
  const sinkK = tempToK(sinkValue, sinkUnit);
  if (preset.needsTemperature === "cooling") {
    if (sourceC >= sinkC || sourceK <= 0 || sinkK <= 0) return { factor: NaN };
    return {
      factor: sinkK / sourceK - 1,
      coldC: sourceC,
      sinkC,
      coldValue: sourceValue,
      coldUnit: sourceUnit,
      sinkValue,
      sinkUnit,
    };
  }
  if (sourceC <= sinkC || sourceK <= 0 || sinkK <= 0) return { factor: NaN };
  return {
    factor: 1 - sinkK / sourceK,
    sourceC,
    sinkC,
    sourceValue,
    sourceUnit,
    sinkValue,
    sinkUnit,
  };
}

function compareRow(side) {
  const prefix = `compare-${side}`;
  const presetKey = fields[`${prefix}-preset`].value;
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
  const anergyJ = Number.isFinite(energyJ) && Number.isFinite(exergyJ) ? energyJ - exergyJ : NaN;
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
    sourceValue: derived.sourceValue,
    sourceUnit: derived.sourceUnit,
    sinkValue: derived.sinkValue,
    sinkUnit: derived.sinkUnit,
    coldValue: derived.coldValue,
    coldUnit: derived.coldUnit,
    factor,
    energyJ,
    exergyJ,
    anergyJ,
    exergyInUnit: exergyJ / ENERGY_TO_J[unit],
    anergyInUnit: anergyJ / ENERGY_TO_J[unit],
    exergyUnit: displayAccessibleUnit(unit),
    mwhEx: exergyJ / ENERGY_TO_J.MWh,
  };
}

function renderCompare() {
  if (!hasCompare()) return;

  const rows = compareSides().map(compareRow);
  if (rows.some((row) => !Number.isFinite(row.exergyJ))) {
    fields["compare-bars"].innerHTML = "";
    fields["compare-summary"].textContent = "Check comparison inputs.";
    if (hasField("compare-equivalence")) fields["compare-equivalence"].textContent = "";
    return;
  }

  fields["compare-bars"].innerHTML = rows
    .map((row) => {
      // The chart is a quality scale, not a quantity chart: Exergy Factor is
      // bounded to the 0–1 track while Accessible Exergy remains the numeric
      // result shown at the right.
      const factorOnScale = Math.min(1, Math.max(0, row.factor));
      const gradientId = `compare-gradient-${row.side.toLowerCase()}`;
      const factorLabel = formatFactor(row.factor);
      return `
        <div class="bar-row">
          <div class="compare-side-label" aria-hidden="true">${row.side}</div>
          <div class="bar-notation">
            <strong>${formatComparisonQuantity(row.quantity)} ${row.displayUnit}, fx = ${formatFactor(row.factor)}${row.bracket}</strong>
          </div>
          <div class="bar-factor" data-tooltip="Exergy Factor: ${factorLabel}">
            <svg class="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none" role="meter" aria-label="${row.label} Exergy Factor on a 0 to 1 scale" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${factorOnScale}" aria-valuetext="${factorLabel}" title="Exergy Factor: ${factorLabel}" xmlns="http://www.w3.org/2000/svg">
              <title>Exergy Factor: ${factorLabel}</title>
              <defs>
                <linearGradient id="${gradientId}" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#b66d12"></stop>
                  <stop offset="100%" stop-color="#0d766f"></stop>
                </linearGradient>
              </defs>
              <rect class="bar-track-empty" x="0" y="0" width="100" height="1"></rect>
              <rect class="bar-track-fill" x="0" y="0" width="${factorOnScale * 100}" height="1" fill="url(#${gradientId})"></rect>
            </svg>
          </div>
          <div class="bar-value accessible-bar-value">
            <strong>${formatDisplayEnergy(row.exergyInUnit)} ${row.exergyUnit}</strong>
          </div>
          <div class="bar-value inaccessible-bar-value">
            <strong>${formatDisplayEnergy(row.anergyInUnit)} ${row.exergyUnit}</strong>
          </div>
        </div>
      `;
    })
    .join("");

  const allZero = rows.every((row) => row.mwhEx === 0);
  if (allZero) {
    fields["compare-summary"].textContent = `${rows.map(compareQuantityLabel).join(" and ")} all have zero accessible exergy.`;
    if (hasField("compare-equivalence")) fields["compare-equivalence"].textContent = "";
    return;
  }
  const higher = rows.reduce((best, row) => (row.mwhEx >= best.mwhEx ? row : best));
  const lower = rows.reduce((worst, row) => (row.mwhEx <= worst.mwhEx ? row : worst));
  if (lower.mwhEx === 0) {
    fields["compare-summary"].textContent = `${compareQuantityLabel(higher)} carries accessible exergy; ${compareQuantityLabel(lower)} has zero accessible exergy.`;
    renderEquivalence(rows);
    return;
  }
  const ratio = higher.mwhEx / lower.mwhEx;
  if (Math.abs(ratio - 1) < 1e-12) {
    fields["compare-summary"].textContent = `${compareQuantityLabel(higher)} carries the same accessible exergy as ${compareQuantityLabel(lower)}.`;
  } else {
    fields["compare-summary"].textContent = `${compareQuantityLabel(higher)} carries ${formatComparisonRatio(ratio)} the accessible exergy of ${compareQuantityLabel(lower)}.`;
  }
  renderEquivalence(rows);
}

function sentenceLabel(row) {
  return row.label === "Electricity" ? "electricity" : row.label === "Heat" ? "heat" : row.label;
}

function narrativeUnit(row) {
  if (row.unit === "Btu") return "BTU";
  if (row.unit === "MMBtu") return "MMBTU";
  return row.unit;
}

function compareContext(row) {
  if (row.presetKey === "heat" && Number.isFinite(row.sourceC) && Number.isFinite(row.sinkC)) {
    return ` at ${formatBracketTemperature(row.sourceValue, row.sourceUnit, row.sourceC)} in a ${formatBracketTemperature(row.sinkValue, row.sinkUnit, row.sinkC)} environment`;
  }
  if (row.presetKey === "cooling" && Number.isFinite(row.coldC) && Number.isFinite(row.sinkC)) {
    return ` cooled to ${formatBracketTemperature(row.coldValue, row.coldUnit, row.coldC)} in a ${formatBracketTemperature(row.sinkValue, row.sinkUnit, row.sinkC)} environment`;
  }
  return "";
}

function compareQuantityLabel(row) {
  return `${formatComparisonQuantity(row.quantity)} ${narrativeUnit(row)} of ${sentenceLabel(row)}${compareContext(row)}`;
}

function renderEquivalence(rows) {
  if (!hasField("compare-equivalence")) return;

  const [reference, ...comparisons] = rows;
  const equivalents = comparisons
    .filter((row) => Number.isFinite(row.factor) && row.factor > 0 && ENERGY_TO_J[row.unit])
    .map((row) => `${compareQuantityLabel(reference)} carries the same accessible exergy as ${formatComparisonQuantity(reference.exergyJ / (row.factor * ENERGY_TO_J[row.unit]))} ${narrativeUnit(row)} of ${sentenceLabel(row)}${compareContext(row)}`);

  if (!equivalents.length) {
    fields["compare-equivalence"].textContent = "Equivalence requires another row to have a positive Exergy Factor.";
    return;
  }

  fields["compare-equivalence"].textContent = `${equivalents.join("; ")}.`;
}

function applyCalculatorForm() {
  if (!hasCalculator() || !hasField("energy-form")) return;

  const formKey = fields["energy-form"].value;
  const basisMap = FORM_BASIS_KEYS[formKey];
  const basisRow = byId("energy-basis-row");
  if (basisRow) basisRow.hidden = !basisMap;
  if (basisMap && hasField("energy-basis") && !basisMap[fields["energy-basis"].value]) {
    fields["energy-basis"].value = "HHV";
  }
  const { preset } = calculatorPreset();
  const calculatorUnit = preset.calculatorUnit || preset.unit;
  if (hasField("energy-unit") && calculatorUnit && ENERGY_TO_J[calculatorUnit]) fields["energy-unit"].value = calculatorUnit;
  if (hasField("factor-unit")) fields["factor-unit"].value = "decimal";
  if (hasField("exergy-factor")) fields["exergy-factor"].value = preset.fx;
  if (hasField("custom-factor")) fields["custom-factor"].value = "";
  const wantsTemps = Boolean(preset.needsTemperature);
  if (hasField("source-temp")) {
    fields["source-temp"].value = preset.needsTemperature === "heat"
      ? "100"
      : preset.needsTemperature === "cooling"
        ? "7"
        : "";
  }
  if (hasField("source-unit")) fields["source-unit"].value = "C";
  // Cooling is rejected to ambient, which is warmer than the service, so its
  // sensible default differs from heat's.
  if (hasField("sink-temp")) fields["sink-temp"].value = preset.needsTemperature === "cooling" ? "30" : "20";
  if (hasField("sink-unit")) fields["sink-unit"].value = "C";

  // Show the temperatures only for the carriers whose factor depends on them,
  // the way the comparison page does. A fuel's factor is a property of the fuel;
  // leaving two temperature boxes sitting there implied they did something.
  const sourceRow = byId("source-temp-row");
  const sinkRow = byId("sink-temp-row");
  if (sourceRow) sourceRow.hidden = !wantsTemps;
  if (sinkRow) sinkRow.hidden = !wantsTemps;
  const customRow = byId("custom-factor-row");
  if (customRow) customRow.hidden = formKey !== "custom";

  // "Source" and "Sink" are the wrong words for a chiller: nothing is sourced
  // from the cold side, and the ambient is what heat is rejected TO.
  const cooling = preset.needsTemperature === "cooling";
  const sourceLabel = sourceRow?.querySelector("label");
  const sinkLabel = sinkRow?.querySelector("label");
  if (sourceLabel) sourceLabel.textContent = cooling ? "Cooling Temperature" : "Source Temperature";
  if (sinkLabel) sinkLabel.textContent = cooling ? "Ambient Temperature" : "Sink Temperature";
  if (hasField("source-temp")) fields["source-temp"].placeholder = cooling ? "7" : "100";
  updateUnitOptions();
  updateUnitContext();
}

function updateCalculator() {
  if (!hasCalculator()) {
    renderCompare();
    return;
  }

  // Keep the carrier selected by the user. Volume shortcuts are only offered
  // for the fuel they name, and their reference conversion is shown in the
  // Unit help tooltip rather than inserting a moving note into the form.
  updateUnitOptions();
  updateUnitContext();

  const energy = Number(fields["energy-value"].value);
  const energyUnit = normalizeUnit(fields["energy-unit"].value);
  const { preset } = calculatorPreset();
  const energyJ = currentEnergyJ();
  const { factor, method, tier, sourceC, sinkC, coldC, sourceValue, sourceUnit: selectedSourceUnit, sinkValue, sinkUnit: selectedSinkUnit, coldValue, coldUnit: selectedColdUnit } = calculateFactor();

  if (!Number.isFinite(energy) || energy < 0 || !Number.isFinite(energyJ) || !Number.isFinite(factor)) {
    fields["notation-output"].textContent = "Check the inputs";
    if (hasField("fx-output")) fields["fx-output"].textContent = "No result";
    if (hasField("work-output")) fields["work-output"].textContent = "No result";
    if (hasField("inaccessible-output")) fields["inaccessible-output"].textContent = "No result";
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
//     1 MWh_th, fx = 0.170 [Th = 80 °C, T0 = 20 °C]
  //
  // The bracket is the whole point: it is what lets whoever receives the record
  // re-derive the factor themselves, in one division, without trusting this
  // calculator. This page previously published only the short form even when it
  // had both temperatures in hand, while the methodology page promised the
  // notation "can be short or self-verifying" — so the claim was made and the
  // evidence withheld.
  const bracket = declarationBracket({
    preset,
    sourceC,
    sinkC,
    coldC,
    sourceValue,
    sourceUnit: selectedSourceUnit,
    sinkValue,
    sinkUnit: selectedSinkUnit,
    coldValue,
    coldUnit: selectedColdUnit,
  });
  const notation = fixedForUnit
    ? `${format(energy, 4)} ${fields["energy-unit"].value} → ${format(notationQuantity, 4)} ${typedEnergyUnit}, fx = ${formatFactor(factor)}${bracket}`
    : `${format(notationQuantity, 4)} ${typedEnergyUnit}, fx = ${formatFactor(factor)}${bracket}`;
  const exergyJ = energyJ * factor;
  const inaccessibleJ = Math.max(0, energyJ - exergyJ);
  const exergyInInputUnit = fixedForUnit
    ? exergyJ / reportInJ
    : exergyJ / ENERGY_TO_J[fields["energy-unit"].value];
  const inaccessibleInInputUnit = fixedForUnit
    ? inaccessibleJ / reportInJ
    : inaccessibleJ / ENERGY_TO_J[fields["energy-unit"].value];
  const exergyUnit = fixedForUnit
    ? displayAccessibleUnit(fixedForUnit.reportIn)
    : displayAccessibleUnit(energyUnit);

  fields["notation-output"].textContent = notation;
  if (hasField("fx-output")) fields["fx-output"].textContent = formatFactor(factor);
  if (hasField("work-output")) fields["work-output"].textContent = `${formatDisplayEnergy(exergyInInputUnit)} ${exergyUnit}`;
  if (hasField("inaccessible-output")) fields["inaccessible-output"].textContent = `${formatDisplayEnergy(inaccessibleInInputUnit)} ${exergyUnit}`;
  if (hasField("exergy-output")) fields["exergy-output"].textContent = `${formatDisplayEnergy(exergyInInputUnit)} ${exergyUnit}`;
  if (hasField("method-output")) fields["method-output"].textContent = method;
  if (hasField("tier-output")) fields["tier-output"].textContent = tierDescription(tier);
  if (hasField("basis-output")) fields["basis-output"].textContent = preset.basis || method;
  if (hasField("calculator-result")) fields["calculator-result"].hidden = false;
  renderConversions(energyJ, exergyJ, inaccessibleJ);
  renderCompare();
}

function bindCompareRow(side) {
  const preset = fields[`compare-${side}-preset`];
  if (!preset || preset.dataset.compareBound === "true") return;

  applyComparePreset(side);
  preset.addEventListener("change", () => applyComparePreset(side));
  fields[`compare-${side}-quantity`]?.addEventListener("input", renderCompare);
  fields[`compare-${side}-unit`]?.addEventListener("change", renderCompare);
  fields[`compare-${side}-factor`]?.addEventListener("input", () => {
    fields[`compare-${side}-preset`].value = "custom";
    renderCompare();
  });
  [`compare-${side}-source`, `compare-${side}-sink`].forEach((id) => {
    fields[id]?.addEventListener("input", renderCompare);
  });
  [`compare-${side}-source-unit`, `compare-${side}-sink-unit`].forEach((id) => {
    fields[id]?.addEventListener("change", renderCompare);
  });
  preset.dataset.compareBound = "true";
}

function applyComparePreset(side) {
  if (!hasCompare()) return;

  const preset = comparePresets[fields[`compare-${side}-preset`].value] || comparePresets.custom;
  fields[`compare-${side}-unit`].value = preset.unit;

  // Known presets already define fx (or derive it from temperatures). Only an
  // Other / custom row needs a factor input from the user.
  const factorRow = byId(`compare-${side}-factor-row`);
  const tempsRow = byId(`compare-${side}-temps`);
  const needsTemps = Boolean(preset.needsTemperature);
  const needsCustomFactor = Boolean(preset.needsCustomFactor);
  if (factorRow) factorRow.hidden = !needsCustomFactor;
  if (tempsRow) tempsRow.hidden = !needsTemps;
  if (needsTemps) {
    const cooling = preset.needsTemperature === "cooling";
    const source = fields[`compare-${side}-source`];
    const sink = fields[`compare-${side}-sink`];
    const sourceUnitField = fields[`compare-${side}-source-unit`];
    const sinkUnitField = fields[`compare-${side}-sink-unit`];
    const sourceLabel = byId(`compare-${side}-source-label`);
    const sinkLabel = byId(`compare-${side}-sink-label`);
    if (sourceLabel) sourceLabel.textContent = cooling ? "Cooling Temperature" : "Source Temperature";
    if (sinkLabel) sinkLabel.textContent = cooling ? "Ambient Temperature" : "Sink Temperature";
    // Two bare boxes give no clue which is which, and a placeholder of "7" or
    // "100" only looks like a value someone forgot to type. They say what they are.
    if (source) {
      source.value = cooling ? "7" : "100";
      source.placeholder = cooling ? "cooling to" : "source";
    }
    // Cooling is rejected to ambient, which is warmer than the service.
    if (sink) {
      sink.value = cooling ? "30" : "20";
      sink.placeholder = cooling ? "ambient" : "reference";
    }
    if (sourceUnitField && !sourceUnitField.value) sourceUnitField.value = "C";
    if (sinkUnitField && !sinkUnitField.value) sinkUnitField.value = "C";
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
  if (hasField("energy-form")) fields["energy-form"].value = example.form || "custom";
  if (hasField("energy-basis")) fields["energy-basis"].value = example.basis || "HHV";
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
    fields["custom-factor"].value = fields["energy-form"]?.value === "custom" ? example.fx : "";
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

const EXPORT_COLORS = Object.freeze({
  accessible: "#187a4b",
  inaccessible: "#8f2d2d",
});

function exportColorFor(label) {
  if (/^Accessible Exergy|^Accessible exergy/i.test(label)) return EXPORT_COLORS.accessible;
  if (/^Inaccessible Anergy|^Inaccessible anergy/i.test(label)) return EXPORT_COLORS.inaccessible;
  return "";
}

/** What is currently on screen, in one shape both exporters can use. */
function exportModel() {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";

  if (hasCalculator()) {
    const { preset } = calculatorPreset();
    const inputs = [
      ["Carrier", preset.label],
      ["Quantity", fields["energy-value"].value],
      ["Unit", displayEnergyUnit(fields["energy-unit"].value)],
    ];
    if (preset.needsTemperature) {
      const isCooling = preset.needsTemperature === "cooling";
      inputs.push([isCooling ? "Cooling to" : "Source temperature",
        formatTemperatureDisplay(fields["source-temp"].value, sourceUnit())]);
      inputs.push([isCooling ? "Ambient" : "Reference temperature",
        formatTemperatureDisplay(fields["sink-temp"].value, sinkUnit())]);
    }
    if (FORM_BASIS_KEYS[fields["energy-form"]?.value]) {
      inputs.push(["Fuel basis", fields["energy-basis"].value]);
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
        ["Inaccessible Anergy", fields["inaccessible-output"]?.textContent.trim() || ""],
      ],
      stamp,
    };
  }

  if (hasCompare()) {
    const rows = compareSides().map(compareRow);
    return {
      kind: "compare",
      title: "Accessible exergy comparison",
      rows: rows.map((row) => ({
        side: row.side,
        carrier: row.label,
        quantity: row.quantity,
        unit: row.unit,
        factor: row.factor,
        notation: `${formatComparisonQuantity(row.quantity)} ${row.displayUnit}, fx = ${formatFactor(row.factor)}${row.bracket}`,
        exergy: `${formatDisplayEnergy(row.exergyInUnit)} ${row.exergyUnit}`,
        anergy: `${formatDisplayEnergy(row.anergyInUnit)} ${row.exergyUnit}`,
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
    lines = [[
      "side",
      "carrier",
      "quantity",
      "unit",
      "exergy_factor",
      "notation",
      "accessible_exergy",
      "accessible_exergy_color",
      "inaccessible_anergy",
      "inaccessible_anergy_color",
    ].join(",")];
    for (const row of model.rows) {
      lines.push([
        row.side,
        row.carrier,
        row.quantity,
        row.unit,
        formatFactor(row.factor),
        row.notation,
        row.exergy,
        EXPORT_COLORS.accessible,
        row.anergy,
        EXPORT_COLORS.inaccessible,
      ].map(csvCell).join(","));
    }
  } else {
    lines = [["field", "value", "display_color"].join(",")];
    for (const [key, value] of [...model.inputs, ...model.results]) {
      lines.push([key, value, exportColorFor(key)].map(csvCell).join(","));
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
      blocks.push({ type: "value", text: `Accessible exergy: ${row.exergy}`, color: EXPORT_COLORS.accessible });
      blocks.push({ type: "value", text: `Inaccessible anergy: ${row.anergy}`, color: EXPORT_COLORS.inaccessible });
      blocks.push({ type: "gap" });
    }
  } else {
    for (const [key, value] of model.inputs) blocks.push({ type: "pair", key, text: value });
    blocks.push({ type: "gap" });
  }
  for (const [key, value] of model.results) {
    const color = exportColorFor(key);
    blocks.push({ type: "label", text: key, color });
    blocks.push({ type: "value", text: value, color });
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
      ctx.fillStyle = block.color || "#5b6b68";
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
      ctx.fillStyle = block.color || "#1d2b2b";
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

document.addEventListener("DOMContentLoaded", () => {
  cacheFields();

  if (hasCalculator()) {
    byId("calculator-form").addEventListener("submit", (event) => event.preventDefault());
    document.querySelectorAll("#calculator-form input, #calculator-form select").forEach((element) => {
      const update = () => {
        if (element.id === "energy-form") {
          if (FORM_BASIS_KEYS[element.value] && hasField("energy-basis")) fields["energy-basis"].value = "HHV";
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
    compareSides().forEach(bindCompareRow);
  }

  if (hasField("export-csv")) fields["export-csv"].addEventListener("click", exportCsv);
  if (hasField("export-png")) fields["export-png"].addEventListener("click", exportPng);

  if (hasCompare()) renderCompare();
});
