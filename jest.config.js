module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: [
    "tmp",
    "<rootDir>/test",
    "collection/.*/files"
  ],
  testPathIgnorePatterns: [
    "node_modules"
  ],
  coverageReporters: [
    "html"
  ],
  coverageDirectory: "coverage"
};
