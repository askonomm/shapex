import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/flatmatter.ts"],
  clean: true,
  format: ["cjs", "esm"],
  dts: true,
  treeshake: "smallest",
  sourcemap: true,
});