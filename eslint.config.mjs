import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript")];
const fullConfig = [{ ignores: [".next/**", "node_modules/**", "out/**", "build/**", "next-env.d.ts"] }, ...eslintConfig];
export default fullConfig;
