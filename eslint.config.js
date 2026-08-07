import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Artefatos gerados e diretórios de ferramentas não são código-fonte.
  // Sem isso o CLI do Supabase (supabase/.temp) injeta centenas de erros
  // em bundles minificados e o lint deixa de ser utilizável.
  {
    ignores: [
      "dist",
      "supabase/.temp",
      "supabase/.branches",
      "graphify-out",
      ".vercel",
      "check_ts.js",
      "check_ts.mjs",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
