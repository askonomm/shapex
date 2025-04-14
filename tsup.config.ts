import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/shapex.ts"],
  clean: true,
  format: ["esm"],
  dts: true,
  sourcemap: true,
});
