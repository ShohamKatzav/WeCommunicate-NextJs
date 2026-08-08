export default [
  {
    ignores: ["**/node_modules/**", "**/.next/**"],
  },
  {
    files: ["**/*.{js,cjs,mjs,jsx,ts,tsx}"],
    extends: ["next/core-web-vitals"],
  },
];
