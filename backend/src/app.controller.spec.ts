
import { describe, it, expect, vi } from 'vitest';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('Telemetry Controller', () => {
  it('procesa una medición normal', async () => {
    const result = {
      status: 'processed',
      agentId: 'node-01',
      timestamp: '2026-11-21T12:00:00.000Z',
      s3Key: 'logs/node-01/test.json',
      alertTriggered: false,
    };

    const mockService = {
      processTelemetry: vi.fn().mockResolvedValue(result),
    };

    const controller = new AppController(
      mockService as unknown as AppService,
    );

    const payload = {
      agentId: 'node-01',
      hostname: 'linux-mint-lab',
      cpuUsage: 35.5,
      memoryUsage: 48.2,
    };

    const response =
      await controller.receiveTelemetry(payload);

    expect(response).toEqual(result);
    expect(mockService.processTelemetry)
      .toHaveBeenCalledWith(payload);
  });

  it('devuelve una alerta cuando el servicio la genera', async () => {
    const result = {
      status: 'processed',
      agentId: 'node-02',
      timestamp: '2026-11-21T12:00:00.000Z',
      s3Key: 'logs/node-02/test.json',
      alertTriggered: true,
    };

    const mockService = {
      processTelemetry: vi.fn().mockResolvedValue(result),
    };

    const controller = new AppController(
      mockService as unknown as AppService,
    );

    const payload = {
      agentId: 'node-02',
      hostname: 'server-test',
      cpuUsage: 92.5,
      memoryUsage: 76.3,
    };

    const response =
      await controller.receiveTelemetry(payload);

    expect(response.alertTriggered).toBe(true);
    expect(mockService.processTelemetry)
      .toHaveBeenCalledWith(payload);
  });
});
