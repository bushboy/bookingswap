import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../index';

describe('Health Check Integration', () => {
    let app: any;
    let server: any;

    beforeAll(async () => {
        const appInstance = await createApp();
        app = appInstance.app;
        server = appInstance.server;
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    it('should include SwapExpirationService in health check response', async () => {
        const response = await request(app)
            .get('/health')
            .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('services');
        expect(response.body.services).toHaveProperty('swap_expiration');

        const swapExpirationHealth = response.body.services.swap_expiration;
        expect(swapExpirationHealth).toHaveProperty('status');
        expect(swapExpirationHealth).toHaveProperty('responseTime');
        expect(swapExpirationHealth).toHaveProperty('lastCheck');
        expect(swapExpirationHealth).toHaveProperty('details');

        const details = swapExpirationHealth.details;
        expect(details).toHaveProperty('isRunning');
        expect(details).toHaveProperty('checkIntervalMs');
        expect(details).toHaveProperty('totalChecksPerformed');
        expect(details).toHaveProperty('totalSwapsProcessed');

        expect(typeof details.isRunning).toBe('boolean');
        expect(typeof details.checkIntervalMs).toBe('number');
        expect(typeof details.totalChecksPerformed).toBe('number');
        expect(typeof details.totalSwapsProcessed).toBe('number');
    });

    it('should report healthy status when SwapExpirationService is running', async () => {
        const response = await request(app)
            .get('/health')
            .expect(200);

        const swapExpirationHealth = response.body.services.swap_expiration;

        // Service should be healthy when running
        expect(['healthy', 'degraded']).toContain(swapExpirationHealth.status);
        expect(swapExpirationHealth.details.isRunning).toBe(true);
    });
});