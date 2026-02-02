module.exports = {
  root: true,
  env: { node: true, es2022: true, jest: true },
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  parserOptions: { ecmaVersion: "latest", sourceType: "commonjs" },
  rules: { "no-console": "off", "prefer-const": "warn" },
};
