
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { AppService } from '../src/app.service.js';

describe('Telemetry API (e2e)', () => {
  let app: INestApplication<App>;

  const mockService = {
    processTelemetry: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(AppService)
        .useValue(mockService)
        .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /telemetry - accepts valid metrics', async () => {
    const payload = {
      agentId: 'node-01',
      hostname: 'linux-mint-lab',
      cpuUsage: 35.5,
      memoryUsage: 48.2,
    };

    mockService.processTelemetry.mockResolvedValueOnce({
      status: 'processed',
      agentId: payload.agentId,
      alertTriggered: false,
    });

    const response = await request(app.getHttpServer())
      .post('/telemetry')
      .send(payload)
      .expect(201);

    expect(response.body.status).toBe('processed');
    expect(response.body.alertTriggered).toBe(false);
    expect(mockService.processTelemetry)
      .toHaveBeenCalledWith(payload);
  });

  it('POST /telemetry - rejects CPU > 100', async () => {
    const response = await request(app.getHttpServer())
      .post('/telemetry')
      .send({
        agentId: 'node-03',
        hostname: 'invalid-test',
        cpuUsage: 150,
        memoryUsage: 40,
      })
      .expect(400);

    expect(response.body.message)
      .toContain('cpuUsage must not be greater than 100');
  });

  it('POST /telemetry - requires agentId', async () => {
    const response = await request(app.getHttpServer())
      .post('/telemetry')
      .send({
        hostname: 'invalid-test',
        cpuUsage: 45,
        memoryUsage: 60,
      })
      .expect(400);

    expect(response.body.message)
      .toContain('agentId should not be empty');
  });
});
