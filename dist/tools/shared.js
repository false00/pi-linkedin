import { safeExecute } from "../tool-runtime.js";

export function buildTool(spec) {
  return {
    name: spec.name,
    label: spec.label,
    description: spec.description,
    parameters: spec.parameters,
    execute: safeExecute(async (params, signal, onUpdate, ctx) => spec.run({ params, signal, onUpdate, ctx })),
  };
}
