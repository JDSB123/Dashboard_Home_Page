module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: ["**/*.js", "!**/node_modules/**"],
};
