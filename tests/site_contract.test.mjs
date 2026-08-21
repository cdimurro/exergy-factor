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

test("public API page matches the keyless beta contract", () => {
  const html = fs.readFileSync(path.join(root, "api-key.html"), "utf8");
  assert.match(html, /<p class="eyebrow">Free public API<\/p>/);
  assert.match(html, /<h1>Exergy Factor API\.<\/h1>/);
  assert.match(html, /https:\/\/api\.exergyfactor\.com\/v1/);
  assert.doesNotMatch(html, /Free and keyless\. No account, email, or API key is required/);
  assert.match(html, /href="https:\/\/api\.exergyfactor\.com\/v1\/health"/);
  assert.match(html, /href="https:\/\/api\.exergyfactor\.com\/docs"/);
  assert.match(html, /POST \/calculate/);
  assert.doesNotMatch(html, /GET  \/v1\/capabilities/);
  assert.doesNotMatch(html, /onrender\.com/);
  assert.doesNotMatch(html, /id="api-key-form"/);
});

test("calculator clearly accepts an accumulated energy quantity", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<p class="eyebrow">Energy Quality Calculator<\/p>/);
  assert.match(html, /<h1>Calculate the Quality of an Energy Quantity\.<\/h1>/);
  assert.doesNotMatch(html, /id="quantity-note"/);
  assert.doesNotMatch(html, /Find the Exergy Factor of an energy stream/);
});

test("calculator form catalog defaults to heat and keeps fuel basis explicit", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<option value="heat" selected>Heat<\/option>/);
  assert.match(html, /<option value="Btu" selected>BTU<\/option>/);
  assert.match(html, /<option value="PJ">PJ<\/option>/);
  assert.match(html, /<option value="TWh">TWh<\/option>/);
  assert.match(html, /<option value="Dth">Dth<\/option>/);
  assert.match(html, /<option value="ton-hour">ton-hour \(cooling\)<\/option>/);
  assert.match(html, /id="energy-value"[^>]*value="5"/);
  assert.match(html, /id="source-temp"[^>]*value="100"/);
  assert.match(html, /id="sink-temp"[^>]*value="20"/);
  assert.match(html, /5 BTU_th, fx = 0\.214 \[Th = 100 °C, T0 = 20 °C\]/);
  assert.match(html, /<strong id="work-output">1\.072 BTU<\/strong>/);
  assert.match(html, /<div class="answer-item inaccessible-answer">[\s\S]*<span class="result-label">Inaccessible Anergy<\/span>[\s\S]*<strong id="inaccessible-output">3\.928 BTU<\/strong>/);
  assert.match(html, /<option value="naturalGas">Natural gas<\/option>/);
  assert.match(html, /<option value="mechanical">Mechanical work<\/option>/);
  assert.match(html, /id="energy-basis-row" hidden/);
  assert.match(html, /<option value="HHV" selected>HHV<\/option>/);
  assert.match(html, /id="energy-unit-help"/);
  assert.doesNotMatch(html, /id="fixed-note"/);
  assert.ok(html.indexOf('id="energy-value"') < html.indexOf('id="energy-unit"'));
  assert.ok(html.indexOf('id="energy-unit"') < html.indexOf('id="energy-basis-row"'));
  assert.doesNotMatch(html, /value="naturalGasHhv"/);
  assert.doesNotMatch(html, /value="naturalGasLhv"/);

  const internals = sandbox.window.EXERGY_FACTOR_CALCULATION_INTERNALS;
  assert.equal(internals.formPresetKey("naturalGas", "HHV"), "naturalGasHhv");
  assert.equal(internals.formPresetKey("naturalGas", "LHV"), "naturalGasLhv");
  assert.equal(internals.formPresetKey("hydrogen", "HHV"), "hydrogen");
  assert.equal(internals.formPresetKey("hydrogen", "LHV"), "hydrogenLhv");
  assert.equal(internals.comparePresets.mechanical.fx, 1);
  assert.equal(internals.comparePresets.mechanical.typedUnit, "MWh_m");
  assert.equal(internals.comparePresets.heat.calculatorUnit, "Btu");
  assert.equal(internals.comparePresets.naturalGasHhv.fx, 0.93);
  assert.equal(internals.comparePresets.naturalGasLhv.fx, 1.04);
  assert.equal(internals.comparePresets.hydrogen.fx, 0.83);
  assert.equal(internals.comparePresets.hydrogenLhv.fx, 0.98);
  assert.equal(internals.displayUnit("Btu", internals.comparePresets.heat), "BTU_th");
  assert.equal(internals.displayUnit("MMBtu", internals.comparePresets.heat), "MMBTU_th");
  assert.equal(internals.displayUnit("kWh", internals.comparePresets.naturalGasHhv), "kWh_HHV_NG");
  assert.equal(internals.formatBracketTemperature("40", "F", 4.4), "40 °F");
  assert.equal(internals.formatBracketTemperature("303.15", "K", 30), "303.2 K");
  assert.equal(internals.ENERGY_TO_J.PJ, 1e15);
  assert.equal(internals.ENERGY_TO_J.TWh, 3.6e15);
  assert.equal(internals.ENERGY_TO_J["ton-hour"], 12000 * 1055.05585262);
  assert.equal(internals.unitCompatibleWithForm("naturalGas", "MMcf(natural gas)"), true);
  assert.equal(internals.unitCompatibleWithForm("crudeOil", "bbl(oil)"), true);
  assert.equal(internals.unitCompatibleWithForm("heat", "MMcf(natural gas)"), false);
  assert.equal(internals.unitCompatibleWithForm("naturalGas", "bbl(oil)"), false);
  assert.equal(internals.unitCompatibleWithForm("cooling", "ton-hour"), true);
  assert.equal(internals.unitCompatibleWithForm("heat", "ton-hour"), false);
  assert.match(source, /→ \$\{format\(notationQuantity, 4\)\} \$\{typedEnergyUnit\}/);
});

test("calculator examples use readable labels and full context when it is known", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /data-example="electric">Electricity · 1 MWh · fx = 1\.0<\/button>/);
  assert.match(html, /data-example="cooling7">Cooling · 1 MWh · fx = 0\.082 \[7 °C → 30 °C\]<\/button>/);
  assert.match(html, /data-example="heat80">Heat · 4 MWh · fx = 0\.170 \[80 °C → 20 °C\]<\/button>/);
  assert.match(html, /data-example="steam150">Heat · 0\.5 BTU · fx = 0\.307 \[150 °C → 20 °C\]<\/button>/);
  assert.match(html, /data-example="methane">Natural gas \(HHV\) · 1\.3 MWh · fx = 0\.930 \[basis = HHV\]<\/button>/);
  assert.match(html, /data-example="hydrogen">Hydrogen \(HHV\) · 2\.47 MWh · fx = 0\.830 \[basis = HHV\]<\/button>/);
  assert.doesNotMatch(html, /data-example="cooling7">1 MWh_cooling/);
  assert.doesNotMatch(html, /data-example="heat80">4 MWh_th/);
});

test("comparison defaults are internally consistent", () => {
  const html = fs.readFileSync(path.join(root, "compare.html"), "utf8");
  assert.match(html, /<p class="eyebrow">Energy Quality Comparison<\/p>/);
  assert.match(html, /<h1>Compare the Accessible Exergy of Different Quantities of Energy\.<\/h1>/);
  assert.match(html, /<h2>Energy Quality Comparison<\/h2>/);
  assert.match(html, /class="compare-row" data-compare-row="a"/);
  assert.match(html, /class="compare-row" data-compare-row="b"/);
  assert.equal((html.match(/class="compare-row"/g) || []).length, 2);
  assert.doesNotMatch(html, /id="add-compare-row"/);
  assert.match(html, /<option value="electricity" selected>Electricity<\/option>/);
  assert.match(html, /<option value="heat" selected>Heat<\/option>/);
  assert.match(html, /id="compare-a-quantity"[^>]*value="5"/);
  assert.match(html, /id="compare-b-quantity"[^>]*value="5"/);
  assert.match(html, /id="compare-a-unit"[\s\S]*<option value="MWh" selected>MWh<\/option>/);
  assert.match(html, /id="compare-b-unit"[\s\S]*<option value="MWh" selected>MWh<\/option>/);
  assert.match(html, /id="compare-a-factor-row" hidden/);
  assert.match(html, /id="compare-b-factor-row" hidden/);
  assert.match(html, /id="compare-b-temps">/);
  assert.match(html, /id="compare-b-source"[^>]*value="100"/);
  assert.match(html, /id="compare-b-sink"[^>]*value="20"/);
  assert.match(html, /id="compare-b-source-label"[^>]*>Source Temperature<\/label>/);
  assert.match(html, /id="compare-b-sink-label"[^>]*>Sink Temperature<\/label>/);
  assert.match(html, /id="compare-b-source-unit"[\s\S]*<option value="C" selected>°C<\/option>/);
  assert.match(html, /id="compare-b-sink-unit"[\s\S]*<option value="C" selected>°C<\/option>/);
  assert.match(html, /<h3 class="compare-chart-title">Exergy Factor Notation<\/h3>/);
  assert.match(html, /<h3 class="compare-chart-title">Exergy Factor<\/h3>/);
  assert.match(html, /<h3 class="compare-chart-title">Accessible Exergy<\/h3>/);
  assert.match(html, /<h3 class="compare-chart-title">Inaccessible Anergy<\/h3>/);
  assert.doesNotMatch(html, />Temperatures \(°C\)</);
  assert.doesNotMatch(html, /compare-row-head/);
  assert.doesNotMatch(html, /compare-field-wide/);
  assert.match(html, /5 MWh of electricity carries 4\.66 times the accessible exergy of 5 MWh of heat at 100 °C in a 20 °C environment/);
  assert.match(html, /5 MWh of electricity carries the same accessible exergy as 23\.322 MWh of heat at 100 °C in a 20 °C environment/);
  assert.doesNotMatch(html, /value="bbl\(oil\)"/);
  assert.doesNotMatch(html, /value="scf\(natural gas\)"/);
  assert.doesNotMatch(source, /function addCompareRow\(\)/);
  assert.match(source, /compareSides\(\)\.map\(compareRow\)/);
  assert.match(source, /factorRow\.hidden = !needsCustomFactor/);
  assert.match(source, /source\.value = cooling \? "7" : "100"/);
  assert.match(source, /const factorOnScale = Math\.min\(1, Math\.max\(0, row\.factor\)\)/);
  assert.match(source, /<div class="bar-factor" data-tooltip="Exergy Factor: \$\{factorLabel\}">/);
  assert.match(source, /<svg class="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none" role="meter"/);
  assert.match(source, /aria-valuenow="\$\{factorOnScale\}" aria-valuetext="\$\{factorLabel\}" title="Exergy Factor: \$\{factorLabel\}"/);
  assert.match(source, /width="\$\{factorOnScale \* 100\}" height="1" fill="url\(#\$\{gradientId\}\)"/);
  assert.doesNotMatch(source, /row\.exergyInUnit \* 100/);
  assert.doesNotMatch(source, /<span class="bar-fill"/);
  assert.match(source, /<div class="compare-side-label" aria-hidden="true">\$\{row\.side\}<\/div>/);
  assert.match(source, /<div class="bar-notation">/);
  assert.doesNotMatch(source, /class="bar-factor-value"/);
  assert.match(source, /<div class="bar-value accessible-bar-value">/);
  assert.match(source, /<div class="bar-value inaccessible-bar-value">/);
  assert.match(source, /formatDisplayEnergy\(row\.anergyInUnit\)/);
  assert.match(source, /function compareContext\(row\)/);
  assert.match(source, /formatBracketTemperature\(row\.sourceValue, row\.sourceUnit, row\.sourceC\)/);
  assert.match(source, /formatBracketTemperature\(row\.sinkValue, row\.sinkUnit, row\.sinkC\)/);
  assert.match(source, /\$\{narrativeUnit\(row\)\} of \$\{sentenceLabel\(row\)\}\$\{compareContext\(row\)\}/);
  assert.doesNotMatch(source, /Enter degrees Celsius/);
  assert.match(source, /const sourceC = toCelsius\(sourceValue, sourceUnit\)/);
  assert.match(source, /const sinkC = toCelsius\(sinkValue, sinkUnit\)/);
  assert.match(source, /const EXPORT_COLORS = Object\.freeze/);
  assert.match(source, /accessible_exergy_color/);
  assert.match(source, /inaccessible_anergy_color/);
  assert.match(source, /formatTemperatureDisplay\(fields\["source-temp"\]\.value/);
  assert.match(source, /factor = coolingExergyFactorC\(coldC, ambientC\)/);
});

test("cooling conversion accepts mixed temperature units", () => {
  const coldC = ((40 - 32) * 5) / 9;
  assert.ok(Math.abs(kernel.cooling_exergy_factor_c(coldC, 30) - 0.092) < 0.001);
});

test("comparison text spells out large ratios and quantities", () => {
  const internals = sandbox.window.EXERGY_FACTOR_CALCULATION_INTERNALS;
  assert.equal(internals.formatComparisonRatio(4.66), "4.66 times");
  assert.equal(internals.formatComparisonRatio(1.88e7), "18.8 million times");
  assert.equal(internals.formatComparisonQuantity(23.322), "23.322");
  assert.equal(internals.formatComparisonQuantity(9.4e7), "94 million");
  assert.doesNotMatch(internals.formatComparisonRatio(1.88e7), /e\+/);
});

test("methodology documents full self-verifying notation", () => {
  const html = fs.readFileSync(path.join(root, "methodology.html"), "utf8");
  assert.match(html, /Full notation is the standard when quality context is known\./);
  assert.match(html, /short two-number form remains valid/);
  assert.match(html, /1 MWh, fx = 0\.170/);
  assert.match(html, /1 MWh_th, fx = 0\.170 \[Th = 80 °C, T0 = 20 °C\]/);
  assert.match(html, /5 BTU_th, fx = 0\.214 \[Th = 100 °C, T0 = 20 °C\]/);
  assert.match(html, /1\.3 MWh_HHV_NG, fx = 0\.930 \[basis = HHV\]/);
});

test("methodology separates exergy potentials from Applied Exergy and service", () => {
  const html = fs.readFileSync(path.join(root, "methodology.html"), "utf8");
  assert.match(html, /Primary Exergy[\s\S]*Secondary Exergy[\s\S]*Final Exergy[\s\S]*Useful Exergy[\s\S]*Applied Exergy[\s\S]*Energy Services/);
  assert.match(html, /aria-label="Primary Energy = Primary Exergy \+ Primary Anergy"/);
  assert.match(html, /aria-label="Secondary Energy = Secondary Exergy \+ Secondary Anergy"/);
  assert.match(html, /aria-label="Final Energy = Final Exergy \+ Final Anergy"/);
  assert.match(html, /aria-label="Useful Energy = Useful Exergy \+ Useful Anergy"/);
  assert.match(html, /aria-label="Applied Energy = Applied Exergy \+ Applied Anergy"/);
  assert.match(html, /class="accounting-arrow"/);
  assert.match(html, /class="accounting-token accounting-exergy"/);
  assert.match(html, /class="accounting-token accounting-anergy"/);
  assert.match(html, /class="accounting-stage accounting-service-stage" aria-label="Energy Services"/);
  assert.match(html, /class="accounting-token accounting-service">Energy Services<\/span>/);
  assert.match(html, /Primary Exergy<\/strong> is the raw resource as it exists in nature/);
  assert.match(html, /Applied Exergy<\/strong> is the work-capable portion of Applied Energy/);
  assert.match(html, /Energy Services<\/strong> are the final benefits people or processes care about/);
  assert.match(html, /Useful Energy is the total first-law output of the end-use device/);
  assert.match(html, /Applied Energy is the total energy that actually crosses the final device-to-task boundary/);
  assert.doesNotMatch(html, /primary energy → secondary energy → final energy → useful energy → energy service/);
});

test("paper download buttons serve the bundled PDF directly", () => {
  const pdfPath = path.join(root, "paper", "quantity-and-quality-standard-reporting-framework.pdf");
  assert.ok(fs.existsSync(pdfPath));
  for (const filename of fs.readdirSync(root).filter((name) => name.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, filename), "utf8");
    if (!html.includes("Download the paper")) continue;
    assert.match(
      html,
      /class="primary-link" href="paper\/quantity-and-quality-standard-reporting-framework\.pdf" download="quantity-and-quality-standard-reporting-framework\.pdf"/,
      `${filename}: paper download button must use the bundled PDF`,
    );
  }
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
