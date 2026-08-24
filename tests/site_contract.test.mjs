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
