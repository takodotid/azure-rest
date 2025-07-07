import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	platform: "node",
	target: "es2022",
	sourcemap: true
});
