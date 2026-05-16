const ENERGY_TO_J = {
  Wh: 3600,
  kWh: 3.6e6,
  MWh: 3.6e9,
  kWh_th: 3.6e6,
  MWh_th: 3.6e9,
  MWh_solar: 3.6e9,
  MWh_LHV: 3.6e9,
  MWh_HHV: 3.6e9,
  MWh_cooling: 3.6e9,
  GWh: 3.6e12,
  J: 1,
  kJ: 1e3,
  MJ: 1e6,
  GJ: 1e9,
  TJ: 1e12,
  Btu: 1055.05585262,
  MMBtu: 1.05505585262e9,
  therm: 105505585.262,
  boe: 6.1178632e9,
};

const examples = {
  electric: { energy: 1, unit: "MWh", fx: 1, auto: false },
  adoption: { energy: 1, unit: "MWh", fx: 0.73, auto: false },
  heat80: { energy: 1, unit: "MWh_th", source: 80, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  steam150: { energy: 1, unit: "MWh_th", source: 150, sourceUnit: "C", sink: 20, sinkUnit: "C", auto: true },
  methane: { energy: 1, unit: "MWh_LHV", fx: 1.04, auto: false },
  hydrogen: { energy: 1, unit: "MWh_HHV", fx: 0.83, auto: false },
};

const fields = {};

function byId(id) {
  return document.getElementById(id);
}

function cacheFields() {
  [
    "energy-value",
    "energy-unit",
    "source-temp",
    "source-unit",
    "exergy-factor",
    "factor-unit",
    "sink-temp",
    "sink-unit",
    "auto-factor",
    "notation-output",
    "exergy-output",
    "method-output",
    "conversion-grid",
    "hero-notation",
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

function normalizeUnit(unit) {
  return unit;
}

function calculateFactor() {
  if (fields["auto-factor"].checked) {
    const sourceK = tempToK(fields["source-temp"].value, fields["source-unit"].value);
    const sinkK = tempToK(fields["sink-temp"].value, fields["sink-unit"].value);
    if (!Number.isFinite(sourceK) || !Number.isFinite(sinkK) || sourceK <= 0 || sinkK <= 0 || sourceK <= sinkK) {
      return { factor: NaN, method: "Temperature inputs need source > sink, both above absolute zero." };
    }
    const factor = 1 - sinkK / sourceK;
    fields["exergy-factor"].value = format(
      fields["factor-unit"].value === "percent" ? factor * 100 : factor,
      6
    );
    return { factor, method: "Thermal Carnot factor from source and sink temperatures." };
  }

  const raw = Number(fields["exergy-factor"].value);
  if (!Number.isFinite(raw) || raw < 0) {
    return { factor: NaN, method: "Exergy Factor must be a nonnegative number." };
  }
  const factor = fields["factor-unit"].value === "percent" ? raw / 100 : raw;
  return { factor, method: "Direct Exergy Factor provided by user." };
}

function currentEnergyJ() {
  const quantity = Number(fields["energy-value"].value);
  const unit = fields["energy-unit"].value;
  if (!Number.isFinite(quantity) || quantity < 0 || !ENERGY_TO_J[unit]) return NaN;
  return quantity * ENERGY_TO_J[unit];
}

function renderConversions(energyJ, exergyJ) {
  const rows = [
    ["Energy", `${format(energyJ / ENERGY_TO_J.kWh)} kWh`],
    ["Energy", `${format(energyJ / ENERGY_TO_J.MWh)} MWh`],
    ["Energy", `${format(energyJ / ENERGY_TO_J.GJ)} GJ`],
    ["Energy", `${format(energyJ / ENERGY_TO_J.MMBtu)} MMBtu`],
    ["Exergy", `${format(exergyJ / ENERGY_TO_J.kWh)} kWh_ex`],
    ["Exergy", `${format(exergyJ / ENERGY_TO_J.MWh)} MWh_ex`],
    ["Exergy", `${format(exergyJ / ENERGY_TO_J.GJ)} GJ_ex`],
    ["Exergy", `${format(exergyJ / ENERGY_TO_J.MMBtu)} MMBtu_ex`],
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

function updateCalculator() {
  const energy = Number(fields["energy-value"].value);
  const energyUnit = normalizeUnit(fields["energy-unit"].value);
  const energyJ = currentEnergyJ();
  const { factor, method } = calculateFactor();

  if (!Number.isFinite(energy) || energy < 0 || !Number.isFinite(energyJ) || !Number.isFinite(factor)) {
    fields["notation-output"].textContent = "Check the inputs";
    fields["exergy-output"].textContent = "No result";
    fields["method-output"].textContent = method;
    fields["hero-notation"].textContent = "1 MWh, f_X = 0.73";
    fields["conversion-grid"].innerHTML = "";
    return;
  }

  const notation = `${format(energy, 4)} ${energyUnit}, f_X = ${format(factor, 4)}`;
  const exergyJ = energyJ * factor;
  const exergyInInputUnit = exergyJ / ENERGY_TO_J[fields["energy-unit"].value];
  const exergyUnit = `${energyUnit.split("_", 1)[0]}_ex`;

  fields["notation-output"].textContent = notation;
  fields["hero-notation"].textContent = notation;
  fields["exergy-output"].textContent = `${format(exergyInInputUnit, 4)} ${exergyUnit}`;
  fields["method-output"].textContent = method;
  renderConversions(energyJ, exergyJ);
}

function setExample(name) {
  const example = examples[name];
  if (!example) return;
  fields["energy-value"].value = example.energy;
  fields["energy-unit"].value = example.unit;
  fields["auto-factor"].checked = Boolean(example.auto);

  if (example.auto) {
    fields["source-temp"].value = example.source;
    fields["source-unit"].value = example.sourceUnit;
    fields["sink-temp"].value = example.sink;
    fields["sink-unit"].value = example.sinkUnit;
    fields["factor-unit"].value = "decimal";
  } else {
    fields["factor-unit"].value = "decimal";
    fields["exergy-factor"].value = example.fx;
  }
  updateCalculator();
}

function resetCalculator() {
  fields["energy-value"].value = 1;
  fields["energy-unit"].value = "MWh";
  fields["source-temp"].value = 80;
  fields["source-unit"].value = "C";
  fields["sink-temp"].value = 20;
  fields["sink-unit"].value = "C";
  fields["factor-unit"].value = "decimal";
  fields["auto-factor"].checked = true;
  updateCalculator();
}

document.addEventListener("DOMContentLoaded", () => {
  cacheFields();
  document.querySelectorAll("input, select").forEach((element) => {
    element.addEventListener("input", updateCalculator);
    element.addEventListener("change", updateCalculator);
  });
  byId("reset-button").addEventListener("click", resetCalculator);
  byId("use-factor-example").addEventListener("click", () => setExample("adoption"));
  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => setExample(button.dataset.example));
  });
  updateCalculator();
});
