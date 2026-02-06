module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.js", "**/test/**/*.test.js"],
  collectCoverageFrom: [
    "**/*.js",
    "!**/node_modules/**",
    "!jest.config.cjs",
    "!eslint.config.js",
    "!shared/model-registry.js", // No callers under test yet
    "!**/coverage/**", // Istanbul report artifacts
    "!**/__tests__/**",
    "!**/test/**",
  ],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 65,
      lines: 65,
      statements: 65,
    },
  },
};
