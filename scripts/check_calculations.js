#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = {
  window: { EXERGY_FACTOR_REFERENCE_DATA: null, location: { hostname: "localhost" } },
  document: { addEventListener() {} },
  console,
  Number,
  Math,
  Object,
  String,
  URL,
  Blob,
  setTimeout,
  fetch: async () => { throw new Error("network is disabled in calculation checks"); },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "script.js"), "utf8"), context);

const internals = context.window.EXERGY_FACTOR_CALCULATION_INTERNALS;
if (!internals) throw new Error("calculator internals were not exposed");
const { ENERGY_TO_J, thermalFactorFromTemperatures } = internals;

function close(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: ${actual} != ${expected}`);
  }
}

// NIST exact/authoritative conversion values used by the Python library.
close(ENERGY_TO_J.Wh, 3600, 0, "Wh to J");
close(ENERGY_TO_J.Btu, 1055.05585262, 0, "Btu_IT to J");
close(ENERGY_TO_J.therm, 105480400, 0, "U.S. therm to J");

// Pinned EIA 2026 U.S.-average estimates and the separate nominal BOE convention.
close(ENERGY_TO_J["scf(natural gas)"] / ENERGY_TO_J.Btu, 1036, 1e-12, "gas Btu/scf");
close(ENERGY_TO_J["bbl(oil)"] / ENERGY_TO_J.MMBtu, 5.689, 1e-12, "crude MMBtu/bbl");
close(ENERGY_TO_J.boe / ENERGY_TO_J.MMBtu, 5.8, 1e-12, "nominal MMBtu/boe");

// Independent published thermal examples and physical-domain rejection.
close(thermalFactorFromTemperatures(80, "C", 20, "C"), 1 - 293.15 / 353.15, 1e-15, "80 C heat");
close(thermalFactorFromTemperatures(40, "C", 20, "C"), 1 - 293.15 / 313.15, 1e-15, "40 C heat");
if (!Number.isNaN(thermalFactorFromTemperatures(10, "C", 20, "C"))) {
  throw new Error("reversed thermal state was accepted");
}

console.log("browser calculation constants and thermal equations passed");
