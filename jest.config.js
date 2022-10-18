/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  bail: true,
  clearMocks: true,
  setupFilesAfterEnv: [ './tests/setup/global-setup.ts' ],
  globalSetup: './tests/setup/global-setup.ts',
  globalTeardown: './tests/setup/global-teardown.ts',
  silent: false,
  collectCoverageFrom: ['./src/**/*.{js,ts}'],
  collectCoverage: true,
  coverageReporters: ['json-summary', 'json', 'lcov'],
  testLocationInResults: true,
  testMatch: ['**/tests/lib/**/*.[t]s?(x)'],
  json: true,
  reporters: ['default'],
  transform: {
    '^.*\/tests\/lib\/.*/.*.[t]s?(x)$': [ 'ts-jest', {
      isolatedModules: true
    }]
  },
  rootDir: './',
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  maxWorkers: 4,
  maxConcurrency: 4,
};
