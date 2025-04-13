import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/shapex.ts"],
  clean: true,
  format: ["esm", "cjs"],
  dts: true,
  treeshake: "smallest",
  sourcemap: true,
});
