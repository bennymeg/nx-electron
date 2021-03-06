module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: [
    "tmp",
    "<rootDir>/test",
    "<rootDir>/src",
    "collection/.*/files"
  ],
  testPathIgnorePatterns: [
    "node_modules"
  ],
  coverageReporters: [
    "html"
  ],
  coverageDirectory: "coverage",
};