import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Native document navigation preserves beforeunload protection for editor work,
    // including browser Back. Editor-owned navigation also flushes pending saves.
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "docs/**",
    "plan/**",
    "next-env.d.ts",
    "supabase/.temp/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
