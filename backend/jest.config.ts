import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testTimeout: 30_000,

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Relax strict checks that don't matter for test files
          strict: false,
          esModuleInterop: true,
        },
      },
    ],
  },

  // Clear mock state between test files (not between individual tests —
  // each test sets up its own mock responses via mockReturnValueOnce)
  clearMocks: false,
  resetMocks: false,
  restoreMocks: false,

  // Show individual test names in CI output
  verbose: true,

  // Collect coverage from service + middleware layers only
  collectCoverageFrom: [
    'src/modules/**/*.service.ts',
    'src/middleware/**/*.ts',
    '!src/**/*.d.ts',
  ],

  // Map the env vars needed by config/env.ts during test runs
  // (real values don't matter — Supabase + Redis are mocked)
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
};

export default config;