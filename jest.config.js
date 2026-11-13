/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {},
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Agent worktrees under .claude/ hold full copies of this repo, tests
  // included. Without this, jest discovered each suite once per worktree and
  // reported ~3x the real test count while running stale code.
  testPathIgnorePatterns: ["/node_modules/", "/\\.claude/", "/\\.next/"],
};

export default config;
