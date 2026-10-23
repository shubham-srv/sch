import { existsSync, readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import testingLibrary from "eslint-plugin-testing-library";

// Import boundaries (docs/architecture.md). Everything that crosses a folder
// goes through the "@/" alias, so the rules below only have to inspect alias
// paths. Flat config replaces (not merges) rule options, so each override
// rebuilds the full pattern list.
const parentRelative = {
  regex: "^\\.\\./",
  message: 'Use the "@/" alias instead of "../" imports.',
};

const featureInternals = (ownFeature) => ({
  regex: ownFeature
    ? `^@/features/(?!${ownFeature}/)[^/]+/`
    : "^@/features/[^/]+/",
  message:
    "Import a feature through its index.ts (@/features/<name>), never its internals.",
});

const restrict = (ownFeature, ...extra) => ({
  "no-restricted-imports": [
    "error",
    { patterns: [parentRelative, featureInternals(ownFeature), ...extra] },
  ],
});

const featuresDir = new URL("./src/features", import.meta.url);
const features = existsSync(featuresDir)
  ? readdirSync(featuresDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // An `any` needs an eslint-disable comment that says why.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: restrict(),
  },
  ...features.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: restrict(feature),
  })),
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: restrict(undefined, {
      regex: "^@/(features|lib/api)(/|$)",
      message: "components/ui is vendored UI: no features or API code.",
    }),
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: restrict(undefined, {
      regex: "^@/(features|components)(/|$)",
      message: "lib must not depend on features or components.",
    }),
  },
  {
    // pa11y-ci loads only .js or .json configs, through require().
    files: [".pa11yci.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    ...testingLibrary.configs["flat/react"],
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "reports/**",
    "playwright-report/**",
    "test-results/**",
    "src/lib/api/generated/**",
  ]),
]);

export default eslintConfig;
