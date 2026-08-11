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
  therm: 105505585.262,
  boe: 6.1178632e9,
  "bbl(oil)": 6.1178632e9,
  "scf(natural gas)": 1.05505585262e6,
  "Mcf(natural gas)": 1.05505585262e9,
  "MMcf(natural gas)": 1.05505585262e12,
};

function apiBaseUrl() {
  if (window.EXERGY_FACTOR_API_BASE_URL) return String(window.EXERGY_FACTOR_API_BASE_URL).replace(/\/$/, "");
  if (window.location && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8000/v1";
  }
  return "https://api.exergyfactor.com/v1";
}

const examples = {
  electric: { energy: 1, unit: "MWh", form: "electricity", fx: 1, auto: false },
  adoption: { energy: 1, unit: "kWh", form: "custom", fx: 0.73, auto: false },
  heat80: { energy: 4, unit: "MWh", form: "heat80", source: 80, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  steam150: { energy: 0.5, unit: "Btu", form: "steam150", source: 150, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  methane: { energy: 1.3, unit: "MWh", form: "methaneHhv", fx: 0.93, auto: false },
  hydrogen: { energy: 2.47, unit: "MWh", form: "hydrogen", fx: 0.83, auto: false },
};

const comparePresets = {
  // ONE entry for everything whose Exergy Factor is 1 by definition. Electricity,
  // PV DC output, battery discharge, pumped hydro output and mechanical shaft
  // work were five separate options with the same fx, the same typed unit and
  // different prose. Five ways to say the same thing is a choice the reader has
  // to make and cannot get right, so it is one option that names them all.
  electricity: { label: "Electricity, PV, battery or shaft work", unit: "MWh", typedUnit: "MWh_e", fx: 1, tier: "F1", basis: "Delivered work at point of use" },

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
  naturalGasHhv: { label: "Natural gas / methane — HHV", unit: "MWh", typedUnit: "MWh_HHV_NG", fx: 0.93, tier: "F1", basis: "Higher heating value fuel basis" },
  naturalGasLhv: { label: "Natural gas / methane — LHV", unit: "MWh", typedUnit: "MWh_LHV_CH4", fx: 1.04, tier: "F1", basis: "Lower heating value fuel basis" },
  hydrogen: { label: "Hydrogen — HHV", unit: "MWh", typedUnit: "MWh_HHV_H2", fx: 0.83, tier: "F1", basis: "Higher heating value hydrogen basis" },
  hydrogenLhv: { label: "Hydrogen — LHV", unit: "MWh", typedUnit: "MWh_LHV_H2", fx: 0.98, tier: "F1", basis: "Lower heating value hydrogen basis" },
  dieselLhv: { label: "Diesel — LHV", unit: "MWh", typedUnit: "MWh_LHV_diesel", fx: 1.06, tier: "F1", basis: "Lower heating value fuel basis" },
  gasolineLhv: { label: "Gasoline — LHV", unit: "MWh", typedUnit: "MWh_LHV_gasoline", fx: 1.07, tier: "F1", basis: "Lower heating value fuel basis" },
  coalLhv: { label: "Coal — LHV", unit: "MWh", typedUnit: "MWh_LHV_coal", fx: 1.05, tier: "F1", basis: "Lower heating value fuel basis" },
  crudeOil: { label: "Crude oil", unit: "MWh", typedUnit: "MWh_LHV_crude", fx: 1.06, tier: "F1", basis: "Approximate crude oil chemical exergy factor" },

  solar: { label: "Solar radiation", unit: "MWh", typedUnit: "MWh_solar", fx: 0.932, tier: "F2", basis: "Petela radiation Exergy Factor" },
  custom: { label: "A factor I already know", unit: "MWh", typedUnit: "", fx: 0.73, tier: "F1", needsCustomFactor: true, basis: "User-defined Exergy Factor" },
};

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

function hasApiKeyForm() {
  return hasField("api-key-form") && hasField("api-email") && hasField("api-key-status");
}

function cacheFields() {
  [
    "energy-value",
    "energy-unit",
    "energy-form",
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
    "verify-output",
    "work-output",
    "exergy-output",
    "method-output",
    "tier-output",
    "basis-output",
    "conversion-grid",
    "compare-a-preset",
    "compare-a-quantity",
    "compare-a-unit",
    "compare-a-factor",
    "compare-b-preset",
    "compare-b-quantity",
    "compare-b-unit",
    "compare-b-factor",
    "compare-bars",
    "compare-summary",
    "compare-equivalence",
    "api-key-form",
    "api-email",
    "api-name",
    "api-organization",
    "api-intended-use",
    "api-key-status",
    "api-key-dev-output",
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

// A temperature as it appears inside the declaration bracket. ASCII "C" keeps the
// notation copy-pasteable into a CSV cell or a plain-text report without an
// encoding step; the paper's typeset "80°C" and this "80 C" are the same record.
function formatBracketTemp(celsius) {
  // One decimal. A stream entered as 340 F is 171.1111... C, and printing
  // `Th = 171.111 C` claims a precision the reading never had.
  return `${Number(celsius.toFixed(1))} C`;
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
  if (!hasSinkTemp || !Number.isFinite(sourceK) || !Number.isFinite(sinkK) || sourceK <= 0 || sinkK <= 0 || sourceK <= sinkK) {
    return NaN;
  }
  return 1 - sinkK / sourceK;
}

function calculateFactor() {
  if (hasField("energy-form")) {
    const formKey = fields["energy-form"].value;
    const preset = comparePresets[formKey] || comparePresets.custom;

    // Cooling is decided FIRST. It shares the two temperature inputs with heat but
    // uses a different equation, and the generic thermal branch below would read a
    // chiller as a heat source colder than its sink and simply refuse it.
    if (preset.needsTemperature === "cooling") {
      const coldC = toCelsius(fields["source-temp"]?.value, fields["source-unit"]?.value);
      const ambientC = toCelsius(fields["sink-temp"]?.value, fields["sink-unit"]?.value);
      if (!Number.isFinite(coldC) || !Number.isFinite(ambientC)) {
        return { factor: NaN, method: "Enter the temperature you are cooling to, and the ambient you reject heat to.", tier: "F2" };
      }
      if (coldC >= ambientC) {
        return { factor: NaN, method: "A cooling service has to be colder than the ambient it is rejected to.", tier: "F2" };
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
        fields["source-unit"].value,
        fields["sink-temp"].value,
        fields["sink-unit"].value,
      );
      if (!Number.isFinite(factor)) {
        return { factor: NaN, method: "Enter source and sink temperatures with source greater than sink.", tier: "F2" };
      }
      // Carry the temperatures out with the factor. Without them the caller can
      // only print the short form, which is why this calculator published records
      // nobody could check even when it knew both temperatures.
      return {
        factor,
        method: "F2 thermal factor from source and sink temperatures.",
        tier: "F2",
        sourceC: toCelsius(fields["source-temp"].value, fields["source-unit"].value),
        sinkC: toCelsius(fields["sink-temp"].value, fields["sink-unit"].value),
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
      fields["source-unit"].value,
      fields["sink-temp"].value,
      fields["sink-unit"].value,
    );
    if (!hasSinkTemp || !Number.isFinite(factor)) {
      return { factor: NaN, method: "Enter source and sink temperatures with source greater than sink.", tier: "F2" };
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

function compareRow(side) {
  const prefix = `compare-${side}`;
  const presetKey = fields[`${prefix}-preset`].value;
  const preset = comparePresets[presetKey] || comparePresets.custom;
  const quantity = Number(fields[`${prefix}-quantity`].value);
  const unit = fields[`${prefix}-unit`].value;
  const factor = Number(fields[`${prefix}-factor`].value);
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

  fields["compare-bars"].innerHTML = rows
    .map((row) => {
      const width = Math.min(100, Math.max(0, row.exergyInUnit * 100));
      return `
        <div class="bar-row">
          <div class="bar-meta">
            <span>${row.side}</span>
            <strong>${row.label}</strong>
            <em>${format(row.quantity, 3)} ${row.displayUnit}, f_X = ${formatFactor(row.factor)}</em>
          </div>
          <div class="bar-track" aria-label="${format(row.exergyInUnit, 4)} out of 1 ${row.exergyUnit} accessible exergy">
            <span class="bar-fill" style="width:${width}%"></span>
          </div>
          <div class="bar-value">${format(row.exergyInUnit, 4)} ${row.exergyUnit}</div>
        </div>
      `;
    })
    .join("");

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
  fields["compare-summary"].textContent = `${higher.label} carries ${format(higher.mwhEx / lower.mwhEx, 2)}x the accessible exergy of ${lower.label} for these quantities.`;
  renderEquivalence(rows);
}

function sentenceLabel(row) {
  return row.label === "Electricity" ? "electricity" : row.label;
}

function renderEquivalence(rows) {
  if (!hasField("compare-equivalence")) return;

  const [a, b] = rows;
  if (!Number.isFinite(b.factor) || b.factor <= 0 || !ENERGY_TO_J[b.unit]) {
    fields["compare-equivalence"].textContent = "Equivalence requires row B to have a positive Exergy Factor.";
    return;
  }

  const equivalentQuantity = a.exergyJ / (b.factor * ENERGY_TO_J[b.unit]);
  fields["compare-equivalence"].textContent = `${format(a.quantity, 3)} ${a.displayUnit} of ${sentenceLabel(a)} is equivalent to ${format(equivalentQuantity, 3)} ${b.displayUnit} of ${sentenceLabel(b)}.`;
}

// Show the inputs the selected carrier actually needs, and nothing else. Heat and
// cooling need two temperatures; a fuel needs neither; "a factor I already know"
// needs only the factor. Presenting all of them at once, with the ones that matter
// buried under a heading called "Optional Inputs", is why the temperature fields
// went unused and people reached for a fixed preset instead.
function applyCalculatorForm() {
  if (!hasCalculator() || !hasField("energy-form")) return;

  const preset = comparePresets[fields["energy-form"].value] || comparePresets.custom;
  const mode = preset.needsTemperature || "";

  if (hasField("energy-unit") && preset.unit && ENERGY_TO_J[preset.unit]) fields["energy-unit"].value = preset.unit;
  if (hasField("factor-unit")) fields["factor-unit"].value = "decimal";
  if (hasField("exergy-factor")) fields["exergy-factor"].value = preset.fx;
  if (hasField("custom-factor")) fields["custom-factor"].value = "";
  if (hasField("source-temp")) fields["source-temp"].value = "";
  if (hasField("source-unit")) fields["source-unit"].value = "C";
  if (hasField("sink-temp")) fields["sink-temp"].value = "20";
  if (hasField("sink-unit")) fields["sink-unit"].value = "C";

  const temperatureSection = byId("temperature-section");
  if (temperatureSection) temperatureSection.hidden = !mode;
  const advanced = byId("advanced-options");
  if (advanced) advanced.hidden = !preset.needsCustomFactor;

  // Cooling asks a different question from heat, so it should not reuse heat's
  // wording. "Source temperature" is meaningless for a chiller.
  const heading = byId("temperature-heading");
  const note = byId("temperature-note");
  const sourceLabel = byId("source-temp-label");
  const sinkLabel = byId("sink-temp-label");
  if (mode === "cooling") {
    if (heading) heading.textContent = "Your cooling temperatures";
    if (note) note.textContent = "Holding something below ambient takes work, and how much depends on these two numbers.";
    if (sourceLabel) sourceLabel.textContent = "Temperature you are cooling to";
    if (sinkLabel) sinkLabel.textContent = "Ambient temperature you reject heat to";
    if (hasField("source-temp")) fields["source-temp"].placeholder = "e.g. 7";
    if (hasField("sink-temp")) fields["sink-temp"].value = "30";
  } else if (mode === "heat") {
    if (heading) heading.textContent = "Your stream temperatures";
    if (note) note.textContent = "The Exergy Factor of heat depends entirely on these two numbers. Enter the ones you measured.";
    if (sourceLabel) sourceLabel.textContent = "Temperature of your heat";
    if (sinkLabel) sinkLabel.textContent = "Reference temperature (your environment)";
    if (hasField("source-temp")) fields["source-temp"].placeholder = "e.g. 80";
  }
}

function updateCalculator() {
  if (!hasCalculator()) {
    renderCompare();
    return;
  }

  const energy = Number(fields["energy-value"].value);
  const energyUnit = normalizeUnit(fields["energy-unit"].value);
  const preset = comparePresets[fields["energy-form"]?.value] || comparePresets.custom;
  const energyJ = currentEnergyJ();
  const { factor, method, tier, sourceC, sinkC, coldC } = calculateFactor();

  if (!Number.isFinite(energy) || energy < 0 || !Number.isFinite(energyJ) || !Number.isFinite(factor)) {
    fields["notation-output"].textContent = "Check the inputs";
    // Clear the derivation too. Leaving the previous stream's arithmetic on
    // screen next to "Check the inputs" showed a confident-looking check of a
    // record that is no longer the one being edited.
    if (hasField("verify-output")) fields["verify-output"].textContent = method;
    if (hasField("work-output")) fields["work-output"].textContent = "No result";
    if (hasField("exergy-output")) fields["exergy-output"].textContent = "No result";
    if (hasField("method-output")) fields["method-output"].textContent = method;
    if (hasField("tier-output")) fields["tier-output"].textContent = tierDescription(tier);
    if (hasField("basis-output")) fields["basis-output"].textContent = preset.basis || "No basis";
    if (hasField("conversion-grid")) fields["conversion-grid"].innerHTML = "";
    if (hasField("calculator-result")) fields["calculator-result"].hidden = false;
    return;
  }

  const typedEnergyUnit = displayUnit(energyUnit, preset);

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
  const isHeat = Number.isFinite(sourceC) && Number.isFinite(sinkC) && sourceC > sinkC;
  const declarable = isHeat || isCooling;
  const bracket = isCooling
    ? ` [Tcold = ${formatBracketTemp(coldC)}, T0 = ${formatBracketTemp(sinkC)}]`
    : isHeat
      ? ` [Th = ${formatBracketTemp(sourceC)}, T0 = ${formatBracketTemp(sinkC)}]`
      : "";
  const notation = `${format(energy, 4)} ${typedEnergyUnit}, fx = ${formatFactor(factor)}${bracket}`;
  const exergyJ = energyJ * factor;
  const exergyInInputUnit = exergyJ / ENERGY_TO_J[fields["energy-unit"].value];
  const exergyUnit = displayExergyUnit(energyUnit);

  fields["notation-output"].textContent = notation;
  if (hasField("verify-output")) {
    if (isCooling) {
      const coldK = coldC + 273.15;
      const ambientK = sinkC + 273.15;
      fields["verify-output"].textContent =
        `fx = T0/Tcold - 1 = ${Number(ambientK.toFixed(2))}/${Number(coldK.toFixed(2))} - 1 = ${(ambientK / coldK - 1).toFixed(3)}`;
    } else if (isHeat) {
      const sourceK = sourceC + 273.15;
      const sinkK = sinkC + 273.15;
      fields["verify-output"].textContent =
        `fx = 1 - T0/Th = 1 - ${Number(sinkK.toFixed(2))}/${Number(sourceK.toFixed(2))} = ${(1 - sinkK / sourceK).toFixed(3)}`;
    } else {
      // Not a failure. A short-form record contradicts nothing; there is simply
      // nothing declared to check it against, and saying so is more honest than
      // showing a blank or implying the number is unverified because it is wrong.
      fields["verify-output"].textContent =
        "Short form: no source and reference temperatures declared, so this record cannot be re-derived by a reader.";
    }
  }
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

  const preset = comparePresets[fields[`compare-${side}-preset`].value] || comparePresets.custom;
  fields[`compare-${side}-unit`].value = preset.unit;
  fields[`compare-${side}-factor`].value = preset.fx;
  renderCompare();
}

function setExample(name) {
  if (!hasCalculator()) return;

  const example = examples[name];
  if (!example) return;
  fields["energy-value"].value = example.energy;
  fields["energy-unit"].value = example.unit;
  if (hasField("energy-form")) fields["energy-form"].value = example.form || "custom";
  applyCalculatorForm();
  fields["energy-unit"].value = example.unit;

  if (hasField("source-temp")) fields["source-temp"].value = "";
  if (hasField("source-unit")) fields["source-unit"].value = "C";
  if (hasField("sink-temp")) fields["sink-temp"].value = "20";
  if (hasField("sink-unit")) fields["sink-unit"].value = "C";
  if (hasField("factor-unit")) fields["factor-unit"].value = "decimal";
  if (hasField("exergy-factor")) fields["exergy-factor"].value = example.fx;
  if (hasField("custom-factor")) {
    fields["custom-factor"].value = fields["energy-form"]?.value === "custom" ? example.fx : "";
  }
  updateCalculator();
}

async function requestApiKey(event) {
  event.preventDefault();
  if (!hasApiKeyForm()) return;

  const status = fields["api-key-status"];
  const output = fields["api-key-dev-output"];
  if (output) {
    output.hidden = true;
    output.textContent = "";
  }
  status.textContent = "Requesting API key...";
  status.dataset.state = "pending";

  const payload = {
    email: fields["api-email"].value.trim(),
    name: fields["api-name"]?.value.trim() || "",
    organization: fields["api-organization"]?.value.trim() || "",
    intended_use: fields["api-intended-use"]?.value.trim() || "",
  };

  try {
    const response = await fetch(`${apiBaseUrl()}/api-keys/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.detail || "API key request failed.");
    }
    status.dataset.state = "success";
    status.textContent = "API key generated. Check your email for the key and a curl example.";
    if (data.delivery_method === "console") {
      status.textContent = "API key generated in development mode. Check the API server console for the key.";
    }
    if (data.api_key && output) {
      output.hidden = false;
      output.textContent = data.api_key;
    }
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = error && error.message ? error.message : "Unable to request an API key.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cacheFields();

  if (hasCalculator()) {
    byId("calculator-form").addEventListener("submit", (event) => event.preventDefault());
    document.querySelectorAll("#calculator-form input, #calculator-form select").forEach((element) => {
      const update = () => {
        if (element.id === "energy-form") applyCalculatorForm();
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
      fields[`compare-${side}-preset`].addEventListener("change", () => applyComparePreset(side));
      fields[`compare-${side}-quantity`].addEventListener("input", renderCompare);
      fields[`compare-${side}-unit`].addEventListener("change", () => {
        fields[`compare-${side}-preset`].value = "custom";
        renderCompare();
      });
      fields[`compare-${side}-factor`].addEventListener("input", () => {
        fields[`compare-${side}-preset`].value = "custom";
        renderCompare();
      });
    });
  }

  if (hasApiKeyForm()) {
    fields["api-key-form"].addEventListener("submit", requestApiKey);
  }

  if (hasCompare()) renderCompare();
});
