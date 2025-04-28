import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/flatmatter.ts"],
  clean: true,
  format: ["esm", "cjs"],
  dts: true,
  treeshake: "smallest",
  sourcemap: true,
});
