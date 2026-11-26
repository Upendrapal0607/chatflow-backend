module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['<rootDir>/src/tests/**/*.test.ts', '<rootDir>/src/tests/**/*.spec.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.eslint.json',
            },
        ],
    },
    collectCoverage: false,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/tests/**/*',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
    ],
    testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/'],
    testTimeout: 10000,
    verbose: true,
};
