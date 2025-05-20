export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'esnext',
          target: 'esnext',
        },
        useESM: true,
      },
    ],
  },
  testMatch: ['**/test/**/*.test.{ts,js}'],
  collectCoverageFrom: [
    'oracle/**/*.ts',
    '!oracle/**/*.d.ts',
    '!oracle/test/**/*',
  ],
  setupFilesAfterEnv: ['./jest.setup.ts'],
};