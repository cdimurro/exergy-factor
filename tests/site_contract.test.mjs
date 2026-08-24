import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "data", "conformance_contract_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "script.js"), "utf8");
const sandbox = {
  console,
  document: {
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
  window: { location: { hostname: "example.test" } },
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "script.js" });
const kernel = sandbox.window.EXERGY_FACTOR_KERNEL;

function runCase(caseDefinition) {
  const input = caseDefinition.inputs;
  switch (caseDefinition.operation) {
    case "thermal_exergy_factor_c":
      return kernel.thermal_exergy_factor_c(input.source_c, input.reference_c);
    case "cooling_exergy_factor_c":
      return kernel.cooling_exergy_factor_c(input.cold_c, input.ambient_c);
    case "sensible_heat_exergy_factor_c":
      return kernel.sensible_heat_exergy_factor_c(input.supply_c, input.return_c, input.reference_c);
    case "petela_exergy_factor":
      return kernel.petela_exergy_factor(input.reference_k, input.radiation_temperature_k);
    case "accessible_exergy":
      return kernel.accessible_exergy(input.energy, input.exergy_factor);
    case "weighted_exergy_factor":
      return kernel.weighted_exergy_factor(input.records);
    case "format_energy_notation":
      return kernel.format_energy_notation(input.quantity, input.unit, input.exergy_factor, input.precision);
    default:
      throw new Error(`unhandled operation ${caseDefinition.operation}`);
  }
}

for (const caseDefinition of contract.valid_cases.filter((item) => item.implementations.includes("exergy-factor-browser"))) {
  test(`valid contract: ${caseDefinition.id}`, () => {
    const actual = runCase(caseDefinition);
    if (typeof caseDefinition.expected === "string") {
      assert.equal(actual, caseDefinition.expected);
    } else {
      assert.ok(Math.abs(actual - caseDefinition.expected) <= caseDefinition.absolute_tolerance);
    }
  });
}

for (const caseDefinition of contract.invalid_cases.filter((item) => item.implementations.includes("exergy-factor-browser"))) {
  test(`invalid contract: ${caseDefinition.id}`, () => {
    assert.throws(() => runCase(caseDefinition), { name: /^(RangeError|TypeError)$/ });
  });
}

test("hosted API page points to the live keyless service", () => {
  const html = fs.readFileSync(path.join(root, "api-key.html"), "utf8");
  assert.match(html, /https:\/\/exergy-factor-api\.onrender\.com\/v1/);
  assert.match(html, /No API key required/);
  assert.match(html, /id="api-health-check"/);
  assert.match(html, /id="api-health-status"/);
  assert.match(html, /href="terms\.html"/);
  assert.match(source, /https:\/\/exergy-factor-api\.onrender\.com\/v1/);
  assert.doesNotMatch(source, /api-keys\/request|requestApiKey|accept_terms/);
});

test("calculator defaults to 5 MWh of heat at 100 C", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<option value="heat" selected>Heat<\/option>/);
  assert.match(html, /id="energy-value"[^>]*value="5"/);
  assert.match(html, /id="source-temp"[^>]*value="100"/);
  assert.match(html, /<option value="boe">boe \(oil\)<\/option>/);
  assert.match(html, /class="exergy-notation-bracket">\[Th = 100 °C, T0 = 20 °C\]<\/span>/);
  assert.match(html, /<strong class="accessible" id="work-output">1\.072 MWh<\/strong>/);
  assert.match(html, /id="anergy-output">3\.928 MWh<\/strong>/);
  assert.match(source, /preset\.needsTemperature === "cooling" \? "0" : ""/);
  assert.doesNotMatch(source, /preset\.unit && ENERGY_TO_J\[preset\.unit\]\) fields\["energy-unit"\]\.value = preset\.unit/);
  assert.match(source, /"Inaccessible Anergy", fields\["anergy-output"\]/);
  assert.match(source, /function displayExergyUnit\(unit\) \{\s*return unit\.replace/);
  assert.match(source, /function renderNotation\(output, notation, bracket = ""\)/);
  assert.match(source, /function inaccessibleAnergy\(energy, exergy\)/);
  assert.match(source, /inaccessibleAnergy\(energyJ, exergyJ\)/);
  assert.match(html, /id="energy-unit-help"[^>]*data-default-tooltip=/);
  assert.doesNotMatch(html, /id="fixed-note"/);
  assert.match(source, /unitHelp\.dataset\.tooltip = fuelVolumeTooltip\(fixed\)/);
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(css, /--accessible-green: #16803d/);
  assert.match(css, /--anergy-red: #b2372f/);
  assert.match(css, /\.answer-item strong\.accessible\s*\{\s*color: var\(--accessible-green\)/);
  assert.match(css, /\.answer-item strong\.inaccessible\s*\{\s*color: var\(--anergy-red\)/);
  assert.match(css, /\.exergy-notation-bracket,\s*\.compare-result-bracket\s*\{\s*display: inline-block;\s*white-space: nowrap/);
  assert.match(css, /\.calculator-result\s*\{\s*grid-template-columns: minmax\(105px, 0\.55fr\) minmax\(0, 3\.2fr\) minmax\(125px, 0\.7fr\) minmax\(150px, 0\.85fr\)/);
});

test("every local HTML link resolves", () => {
  for (const filename of fs.readdirSync(root).filter((name) => name.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, filename), "utf8");
    for (const match of html.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|\/)/.test(target)) continue;
      assert.ok(fs.existsSync(path.resolve(root, target)), `${filename}: missing ${target}`);
    }
  }
});

test("comparison factor meters preserve partial widths and tooltip structure", () => {
  const elements = new Map();
  const field = (value = "") => ({
    value,
    dataset: {},
    textContent: "",
    innerHTML: "",
    hidden: false,
  });
  for (const [id, value] of Object.entries({
    "compare-a-preset": "electricity",
    "compare-a-quantity": "5",
    "compare-a-unit": "MWh",
    "compare-a-factor": "1",
    "compare-b-preset": "heat",
    "compare-b-quantity": "5",
    "compare-b-unit": "MWh",
    "compare-b-factor": "0.17",
    "compare-b-source": "100",
    "compare-b-source-unit": "C",
    "compare-b-sink": "20",
    "compare-b-sink-unit": "C",
    "compare-bars": "",
    "compare-summary": "",
    "compare-equivalence": "",
  })) {
    elements.set(id, field(value));
  }

  const comparisonSandbox = {
    console,
    document: {
      addEventListener() {},
      getElementById(id) { return elements.get(id) || null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    window: { location: { hostname: "example.test" } },
  };
  comparisonSandbox.window.window = comparisonSandbox.window;
  vm.createContext(comparisonSandbox);
  vm.runInContext(source, comparisonSandbox, { filename: "script.js" });
  vm.runInContext("cacheFields(); renderCompare();", comparisonSandbox, { filename: "comparison-render.js" });

  const resultHtml = elements.get("compare-bars").innerHTML;
  const widths = [...resultHtml.matchAll(/<rect class="compare-factor-fill"[^>]*width="([0-9.]+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(widths.length, 2);
  assert.equal(widths[0], 100);
  assert.ok(widths[1] > 0 && widths[1] < 100, `expected a partial Heat bar, received ${widths[1]}%`);
  assert.match(resultHtml, /gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0"/);
  assert.match(resultHtml, /clipPath id="compare-factor-clip-a"/);
  assert.match(resultHtml, /clip-path="url\(#compare-factor-clip-b\)"/);
  assert.match(resultHtml, /<rect x="0" y="0" width="100" height="22" rx="8"><\/rect>/);
  assert.match(resultHtml, /class="compare-factor-meter"/);
  assert.match(resultHtml, /data-tooltip="Exergy Factor: 0\.214"/);
  assert.doesNotMatch(resultHtml, /style=/);

  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const meterBlock = css.match(/\.compare-factor-meter\s*\{([\s\S]*?)\}/)?.[1] || "";
  assert.doesNotMatch(meterBlock, /overflow\s*:/);
  assert.match(css, /\.compare-factor-meter::after/);
  assert.match(css, /\.compare-factor-chart\s*\{/);
  assert.match(css, /\.compare-page \.temperature-pair\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.compare-page \.temperature-input\s*\{\s*grid-template-columns: minmax\(0, 1fr\) 72px/);
  assert.doesNotMatch(css, /--factor-fill/);

  elements.get("compare-a-preset").value = "crudeOil";
  elements.get("compare-a-quantity").value = "5";
  elements.get("compare-a-unit").value = "Quad";
  elements.get("compare-a-factor").value = "1.06";
  vm.runInContext("renderCompare();", comparisonSandbox, { filename: "comparison-lhv-render.js" });
  assert.match(elements.get("compare-bars").innerHTML, /data-label="Inaccessible Anergy">0 Quad<\/strong>/);
});

test("anergy is never negative when an LHV exergy factor exceeds one", () => {
  assert.equal(kernel.inaccessible_anergy(5, 5.3), 0);
  assert.equal(kernel.inaccessible_anergy(5, 1.072), 3.928);
});

test("energy-form changes preserve the selected unit and default cooling to 0 C", () => {
  const elements = new Map();
  const field = (value = "") => ({ value, dataset: {}, textContent: "", hidden: false });
  for (const [id, value] of Object.entries({
    "energy-value": "5",
    "energy-unit": "MMBtu",
    "energy-form": "cooling",
    "source-temp": "100",
    "source-unit": "C",
    "sink-temp": "20",
    "sink-unit": "C",
    "notation-output": "",
  })) {
    elements.set(id, field(value));
  }

  const calculatorSandbox = {
    console,
    document: {
      addEventListener() {},
      getElementById(id) { return elements.get(id) || null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    window: { location: { hostname: "example.test" } },
  };
  calculatorSandbox.window.window = calculatorSandbox.window;
  vm.createContext(calculatorSandbox);
  vm.runInContext(source, calculatorSandbox, { filename: "script.js" });
  vm.runInContext("cacheFields(); syncPresetSelection('calculator'); applyCalculatorForm();", calculatorSandbox, { filename: "calculator-form.js" });

  assert.equal(elements.get("energy-unit").value, "MMBtu");
  assert.equal(elements.get("source-temp").value, "0");
  assert.equal(elements.get("sink-temp").value, "30");
});
