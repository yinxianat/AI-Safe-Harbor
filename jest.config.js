/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {},
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default config;
