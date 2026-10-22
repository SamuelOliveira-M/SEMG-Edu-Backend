module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2020, sourceType: "module" },
  env: { node: true, es2020: true },
  rules: { "no-debugger": "error", "no-dupe-args": "error", "no-unreachable": "error" },
  ignorePatterns: ["build/", "node_modules/"],
};
