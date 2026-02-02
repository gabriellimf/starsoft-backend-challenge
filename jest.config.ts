import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testRegex: '.*\\.spec\\.ts$',
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 80,
      branches: 80,
      functions: 80,
    },
  },
};

export default config;
