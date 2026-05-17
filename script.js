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

const examples = {
  electric: { energy: 1, unit: "MWh", form: "electricity", fx: 1, auto: false },
  adoption: { energy: 1, unit: "kWh", form: "custom", fx: 0.73, auto: false },
  heat80: { energy: 4, unit: "MWh", form: "heat80", source: 80, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  steam150: { energy: 0.5, unit: "Btu", form: "steam150", source: 150, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  methane: { energy: 1.3, unit: "EJ", form: "methane", fx: 1.04, auto: false },
  hydrogen: { energy: 2.47, unit: "MMcf(natural gas)", form: "naturalGasHhv", fx: 0.94, auto: false },
};

const comparePresets = {
  electricity: { label: "Electricity", unit: "MWh", fx: 1, basis: "Delivered electricity at point of use" },
  battery: { label: "Battery discharge", unit: "MWh", fx: 1, basis: "Delivered electrical discharge" },
  solar: { label: "Solar radiation", unit: "MWh", fx: 0.93, basis: "Reference solar radiation quality factor" },
  heat60: { label: "60 °C low-grade heat", unit: "MWh", fx: 0.12, sourceC: 60, sinkC: 20, basis: "Carnot factor from source and sink temperatures" },
  heat80: { label: "80 °C hot water", unit: "MWh", fx: 0.17, sourceC: 80, sinkC: 20, basis: "Carnot factor from source and sink temperatures" },
  heat120: { label: "120 °C process heat", unit: "MWh", fx: 0.254, sourceC: 120, sinkC: 20, basis: "Carnot factor from source and sink temperatures" },
  steam150: { label: "150 °C steam", unit: "MWh", fx: 0.307, sourceC: 150, sinkC: 20, basis: "Carnot factor from source and sink temperatures" },
  heat250: { label: "250 °C process heat", unit: "MWh", fx: 0.44, sourceC: 250, sinkC: 20, basis: "Carnot factor from source and sink temperatures" },
  heat500: { label: "500 °C industrial heat", unit: "MWh", fx: 0.621, sourceC: 500, sinkC: 20, basis: "Carnot factor from source and sink temperatures" },
  cooling5: { label: "5 °C cooling", unit: "MWh", fx: 0.054, sourceC: 20, sinkC: 5, basis: "Reference cooling quality factor against 20 °C ambient" },
  methane: { label: "Methane LHV", unit: "MWh", fx: 1.04, basis: "Lower heating value fuel basis" },
  naturalGasLhv: { label: "Natural gas LHV", unit: "MWh", fx: 1.04, basis: "Lower heating value fuel basis" },
  naturalGasHhv: { label: "Natural gas HHV", unit: "MWh", fx: 0.94, basis: "Higher heating value fuel basis" },
  dieselLhv: { label: "Diesel LHV", unit: "MWh", fx: 1.06, basis: "Lower heating value fuel basis" },
  gasolineLhv: { label: "Gasoline LHV", unit: "MWh", fx: 1.07, basis: "Lower heating value fuel basis" },
  crudeOil: { label: "Crude oil", unit: "bbl(oil)", fx: 1.06, basis: "Approximate crude oil chemical exergy factor" },
  coalLhv: { label: "Coal LHV", unit: "MWh", fx: 1.05, basis: "Lower heating value fuel basis" },
  hydrogenLhv: { label: "Hydrogen LHV", unit: "MWh", fx: 0.97, basis: "Lower heating value hydrogen basis" },
  hydrogen: { label: "Hydrogen HHV", unit: "MWh", fx: 0.83, basis: "Higher heating value hydrogen basis" },
  custom: { label: "Custom", unit: "MWh", fx: 0.73, basis: "User-defined Exergy Factor" },
};

const fields = {};

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
    "work-output",
    "exergy-output",
    "method-output",
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

function format(value, precision = 4) {
  if (!Number.isFinite(value)) return "invalid";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 100000 || abs < 0.0001) return value.toExponential(3);
  return Number(value.toFixed(precision)).toString();
}

function formatFactor(value) {
  return format(value, 3);
}

function formatDisplayEnergy(value) {
  return format(value, 3);
}

function normalizeUnit(unit) {
  return unit;
}

function displayUnit(unit) {
  return unit;
}

function displayExergyUnit(unit) {
  const baseUnit = unit.replace(/\(.+\)/, "");
  return `${baseUnit}(exergy)`;
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

    if (hasAdvancedSourceOverride()) {
      const factor = thermalFactorFromTemperatures(
        fields["source-temp"].value,
        fields["source-unit"].value,
        fields["sink-temp"].value,
        fields["sink-unit"].value,
      );
      if (!Number.isFinite(factor)) {
        return { factor: NaN, method: "Enter source and sink temperatures with source greater than sink." };
      }
      return { factor, method: "Advanced thermal factor from source and sink temperatures." };
    }

    if (hasCustomFactorOverride()) {
      const custom = Number(fields["custom-factor"]?.value);
      if (Number.isFinite(custom) && custom >= 0) {
        return { factor: custom, method: "Advanced custom Exergy Factor provided by user." };
      }
      return { factor: NaN, method: "Custom Exergy Factor must be a nonnegative number." };
    }

    if (Number.isFinite(preset.sourceC) && preset.basis.includes("Carnot") && hasField("sink-temp")) {
      const factor = thermalFactorFromTemperatures(
        preset.sourceC,
        "C",
        fields["sink-temp"].value,
        fields["sink-unit"].value,
      );
      if (!Number.isFinite(factor)) {
        return { factor: NaN, method: "Enter sink temperature below the reference source temperature." };
      }
      return { factor, method: `Thermal factor for ${preset.label} from reference source and sink temperature.` };
    }

    if (formKey !== "custom") {
      return { factor: preset.fx, method: `Reference factor for ${preset.label}.` };
    }

    return { factor: NaN, method: "Enter a custom Exergy Factor or source and sink temperatures." };
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
      return { factor: NaN, method: "Enter source and sink temperatures with source greater than sink." };
    }
    fields["exergy-factor"].value = formatFactor(
      fields["factor-unit"].value === "percent" ? factor * 100 : factor,
    );
    return { factor, method: "Thermal Carnot factor from source and sink temperatures." };
  }

  const raw = Number(fields["exergy-factor"]?.value);
  if (!Number.isFinite(raw) || raw < 0) {
    return { factor: NaN, method: "Exergy Factor must be a nonnegative number." };
  }
  const factor = fields["factor-unit"]?.value === "percent" ? raw / 100 : raw;
  return { factor, method: "Direct Exergy Factor provided by user." };
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
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.kWh)} kWh(exergy)`],
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.MWh)} MWh(exergy)`],
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.GJ)} GJ(exergy)`],
    ["Exergy", `${formatDisplayEnergy(exergyJ / ENERGY_TO_J.MMBtu)} MMBtu(exergy)`],
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
            <em>${format(row.quantity, 3)} ${displayUnit(row.unit)}, fx = ${formatFactor(row.factor)}</em>
          </div>
          <div class="bar-track" aria-label="${format(row.exergyInUnit, 4)} out of 1 ${row.exergyUnit} work potential">
            <span class="bar-fill" style="width:${width}%"></span>
          </div>
          <div class="bar-value">${format(row.exergyInUnit, 4)} ${row.exergyUnit}</div>
        </div>
      `;
    })
    .join("");

  const [a, b] = rows;
  if (a.mwhEx === 0 && b.mwhEx === 0) {
    fields["compare-summary"].textContent = "Both records have zero work potential.";
    if (hasField("compare-equivalence")) fields["compare-equivalence"].textContent = "";
    return;
  }
  const higher = a.mwhEx >= b.mwhEx ? a : b;
  const lower = a.mwhEx >= b.mwhEx ? b : a;
  if (lower.mwhEx === 0) {
    fields["compare-summary"].textContent = `${higher.label} carries work potential; ${lower.label} is zero for these inputs.`;
    renderEquivalence(rows);
    return;
  }
  fields["compare-summary"].textContent = `${higher.label} carries ${format(higher.mwhEx / lower.mwhEx, 2)}x the work potential of ${lower.label} for these quantities.`;
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
  fields["compare-equivalence"].textContent = `${format(a.quantity, 3)} ${displayUnit(a.unit)} of ${sentenceLabel(a)} is equivalent to ${format(equivalentQuantity, 3)} ${displayUnit(b.unit)} of ${sentenceLabel(b)}.`;
}

function applyCalculatorForm() {
  if (!hasCalculator() || !hasField("energy-form")) return;

  const preset = comparePresets[fields["energy-form"].value] || comparePresets.custom;
  if (hasField("factor-unit")) fields["factor-unit"].value = "decimal";
  if (hasField("exergy-factor")) fields["exergy-factor"].value = preset.fx;
  if (hasField("custom-factor")) fields["custom-factor"].value = "";
  if (hasField("source-temp")) fields["source-temp"].value = "";
  if (hasField("source-unit")) fields["source-unit"].value = "C";
  if (hasField("sink-temp")) fields["sink-temp"].value = "20";
  if (hasField("sink-unit")) fields["sink-unit"].value = "C";
}

function updateCalculator() {
  if (!hasCalculator()) {
    renderCompare();
    return;
  }

  const energy = Number(fields["energy-value"].value);
  const energyUnit = normalizeUnit(fields["energy-unit"].value);
  const energyJ = currentEnergyJ();
  const { factor, method } = calculateFactor();

  if (!Number.isFinite(energy) || energy < 0 || !Number.isFinite(energyJ) || !Number.isFinite(factor)) {
    fields["notation-output"].textContent = "Check the inputs";
    if (hasField("work-output")) fields["work-output"].textContent = "No result";
    if (hasField("exergy-output")) fields["exergy-output"].textContent = "No result";
    if (hasField("method-output")) fields["method-output"].textContent = method;
    if (hasField("conversion-grid")) fields["conversion-grid"].innerHTML = "";
    if (hasField("calculator-result")) fields["calculator-result"].hidden = false;
    return;
  }

  const notation = `${format(energy, 4)} ${displayUnit(energyUnit)}, fx = ${formatFactor(factor)}`;
  const exergyJ = energyJ * factor;
  const exergyInInputUnit = exergyJ / ENERGY_TO_J[fields["energy-unit"].value];
  const exergyUnit = displayExergyUnit(energyUnit);

  fields["notation-output"].textContent = notation;
  if (hasField("work-output")) fields["work-output"].textContent = `${formatDisplayEnergy(exergyInInputUnit)} ${displayUnit(energyUnit)} of work potential`;
  if (hasField("exergy-output")) fields["exergy-output"].textContent = `${formatDisplayEnergy(exergyInInputUnit)} ${exergyUnit}`;
  if (hasField("method-output")) fields["method-output"].textContent = method;
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

  if (hasCompare()) renderCompare();
});
