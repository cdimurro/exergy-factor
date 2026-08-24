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
const { ENERGY_TO_J, FORM_BASIS_KEYS, comparePresets, formPresetKey, thermalFactorFromTemperatures, unitCompatibleWithForm } = internals;

function close(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: ${actual} != ${expected}`);
  }
}

// NIST exact/authoritative conversion values used by the Python library.
close(ENERGY_TO_J.Wh, 3600, 0, "Wh to J");
close(ENERGY_TO_J.Btu, 1055.05585262, 0, "Btu_IT to J");
close(ENERGY_TO_J.therm, 105480400, 0, "U.S. therm to J");
close(ENERGY_TO_J.PJ, 1e15, 0, "PJ to J");
close(ENERGY_TO_J.TWh, 3.6e15, 0, "TWh to J");
close(ENERGY_TO_J.dekatherm, 10 * 105480400, 0, "dekatherm to J");
close(ENERGY_TO_J.Dth, 10 * 105480400, 0, "Dth to J");
close(ENERGY_TO_J["ton-hour"], 12000 * 1055.05585262, 0, "refrigeration ton-hour to J");

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

if (FORM_BASIS_KEYS.naturalGas.HHV !== "naturalGasHhv" || FORM_BASIS_KEYS.naturalGas.LHV !== "naturalGasLhv") {
  throw new Error("natural-gas HHV/LHV selector mapping drifted");
}
if (FORM_BASIS_KEYS.hydrogen.HHV !== "hydrogen" || FORM_BASIS_KEYS.hydrogen.LHV !== "hydrogenLhv") {
  throw new Error("hydrogen HHV/LHV selector mapping drifted");
}
if (formPresetKey("naturalGas", "HHV") !== "naturalGasHhv" || formPresetKey("naturalGas", "LHV") !== "naturalGasLhv") {
  throw new Error("natural-gas basis resolution drifted");
}
if (!unitCompatibleWithForm("naturalGas", "MMcf(natural gas)")) throw new Error("natural-gas volume unit was rejected for natural gas");
if (!unitCompatibleWithForm("crudeOil", "bbl(oil)")) throw new Error("oil volume unit was rejected for crude oil");
if (unitCompatibleWithForm("heat", "MMcf(natural gas)")) throw new Error("natural-gas volume unit leaked into heat");
if (unitCompatibleWithForm("naturalGas", "bbl(oil)")) throw new Error("oil volume unit leaked into natural gas");
if (!unitCompatibleWithForm("cooling", "ton-hour")) throw new Error("cooling ton-hour unit was rejected for cooling");
if (unitCompatibleWithForm("heat", "ton-hour")) throw new Error("cooling ton-hour unit leaked into heat");
close(comparePresets.mechanical.fx, 1, 0, "mechanical work fx");
close(comparePresets.naturalGasHhv.fx, 0.93, 0, "natural gas HHV fx");
close(comparePresets.naturalGasLhv.fx, 1.04, 0, "natural gas LHV fx");
close(comparePresets.hydrogen.fx, 0.83, 0, "hydrogen HHV fx");
close(comparePresets.hydrogenLhv.fx, 0.98, 0, "hydrogen LHV fx");

console.log("browser calculation constants and thermal equations passed");
