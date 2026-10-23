import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const domSetup = ["tests/setup/vitest.setup.ts"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real module throws outside a React Server Components build.
      "server-only": fileURLToPath(
        new URL("./tests/setup/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    reporters: ["default", "junit"],
    outputFile: { junit: "reports/junit/vitest.xml" },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "cobertura", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        // Exercised by Playwright, not Vitest.
        "src/app/**",
        // Vendored shadcn/ui code.
        "src/components/ui/**",
        "src/lib/api/generated/**",
      ],
      // Placeholder thresholds; see docs/testing.md.
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: domSetup,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "jsdom",
          include: ["tests/integration/**/*.int.test.{ts,tsx}"],
          setupFiles: domSetup,
        },
      },
    ],
  },
});
