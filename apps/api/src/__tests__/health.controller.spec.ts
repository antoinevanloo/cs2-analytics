/**
 * Health Controller Tests
 *
 * Tests for the health check endpoints.
 */

// Mock dependencies before imports
const mockPrismaService = {
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

const mockQueue = {
  getJobCounts: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    failed: 0,
    completed: 10,
  }),
};

const mockParserService = {
  checkHealth: jest.fn().mockResolvedValue(true),
  getCircuitBreakerStatus: jest.fn().mockReturnValue({
    state: 'CLOSED',
    failures: 0,
  }),
};

// Mock modules
jest.mock('../common/prisma', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrismaService),
}));

jest.mock('../modules/demo/parser.service', () => ({
  ParserService: jest.fn().mockImplementation(() => mockParserService),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../health.controller';
import { PrismaService } from '../common/prisma';
import { ParserService } from '../modules/demo/parser.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 0,
      active: 0,
      failed: 0,
      completed: 10,
    });
    mockParserService.checkHealth.mockResolvedValue(true);
    mockParserService.getCircuitBreakerStatus.mockReturnValue({
      state: 'CLOSED',
      failures: 0,
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getQueueToken('demo-parsing'), useValue: mockQueue },
        { provide: ParserService, useValue: mockParserService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('health', () => {
    it('should return basic health status', () => {
      const result = controller.health();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('ready', () => {
    it('should return ready status when database is connected', async () => {
      const result = await controller.ready();

      expect(result).toHaveProperty('ready', true);
      expect(result.checks).toHaveProperty('database', true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should return not ready when database fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await controller.ready();

      expect(result.checks.database).toBe(false);
      expect(result.ready).toBe(false);
    });

    it('should check queue connection', async () => {
      const result = await controller.ready();

      expect(result.checks).toHaveProperty('queue', true);
      expect(mockQueue.getJobCounts).toHaveBeenCalled();
    });
  });

  describe('detailedHealth', () => {
    it('should return detailed health with all components', async () => {
      const result = await controller.detailedHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('service', 'cs2-analytics-api');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('checks');
    });

    it('should return healthy when all checks pass', async () => {
      const result = await controller.detailedHealth();

      expect(result.status).toBe('healthy');
      expect(result.checks?.database.status).toBe('healthy');
    });

    it('should include database latency', async () => {
      const result = await controller.detailedHealth();

      expect(result.checks?.database).toHaveProperty('latency');
      expect(typeof result.checks?.database.latency).toBe('number');
    });

    it('should return unhealthy when database fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB error'));

      const result = await controller.detailedHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks?.database.status).toBe('unhealthy');
    });

    it('should include queue job counts', async () => {
      const result = await controller.detailedHealth();

      expect(result.checks?.queue).toHaveProperty('jobs');
      expect(result.checks?.queue.jobs).toEqual({
        waiting: 0,
        active: 0,
        failed: 0,
      });
    });

    it('should show degraded status when many jobs failed', async () => {
      mockQueue.getJobCounts.mockResolvedValueOnce({
        waiting: 0,
        active: 0,
        failed: 15,
        completed: 100,
      });

      const result = await controller.detailedHealth();

      expect(result.checks?.queue.status).toBe('degraded');
    });

    it('should include parser circuit breaker status', async () => {
      const result = await controller.detailedHealth();

      expect(result.checks?.parser).toHaveProperty('circuitBreaker');
      expect(result.checks?.parser.circuitBreaker).toEqual({
        state: 'CLOSED',
        failures: 0,
      });
    });
  });

  describe('root', () => {
    it('should return API info', () => {
      const result = controller.root();

      expect(result).toHaveProperty('name', 'CS2 Analytics API');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('documentation', '/docs');
      expect(result).toHaveProperty('endpoints');
    });

    it('should list all available endpoints', () => {
      const result = controller.root();

      expect(result.endpoints).toHaveProperty('demos');
      expect(result.endpoints).toHaveProperty('players');
      expect(result.endpoints).toHaveProperty('rounds');
      expect(result.endpoints).toHaveProperty('analysis');
      expect(result.endpoints).toHaveProperty('health');
    });
  });
});
