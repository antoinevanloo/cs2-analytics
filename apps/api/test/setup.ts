/**
 * Jest Test Setup
 *
 * Configures the test environment before running tests.
 */

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };

// Clean up after all tests
afterAll(async () => {
  // Add any global cleanup here
});
