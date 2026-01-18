import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Coverage reports are generated files
    "coverage/**",
  ]),
  // Custom rules overrides
  {
    rules: {
      // Disable react-hooks rules that flag legitimate patterns like data loading in useEffect
      // and animation triggers. These are common React patterns that are intentional.
      "react-hooks/set-state-in-effect": "off",
      // Allow Date.now() and similar impure calls in useMemo - this is a common pattern
      // for calculating time-based values that should update when dependencies change
      "react-hooks/purity": "off",
      // Allow ref updates during render for the pattern of keeping refs in sync with props
      // This is a documented React pattern for avoiding stale closures in callbacks
      "react-hooks/refs": "off",
      // Allow unused variables that start with underscore (intentionally unused)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
