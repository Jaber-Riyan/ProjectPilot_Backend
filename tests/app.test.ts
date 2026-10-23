import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('ProjectPilot LMS - Backend Foundation Tests', () => {
  describe('Application Initialization', () => {
    it('should be importable without automatically binding or listening to a network port', () => {
      // The Express application instance should exist
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
      // Verify app does not have a listening HTTP server attached
      // In Express, when app.listen() is called, it returns an http.Server instance.
      // app itself is a request listener function.
      expect((app as unknown as { listening?: boolean }).listening).toBeUndefined();
    });
  });

  describe('Health Check Endpoints', () => {
    it('GET /api/v1/health should return 200 with liveness details', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.headers['x-request-id']).toBeDefined();

      expect(res.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'ok',
          uptimeSeconds: expect.any(Number),
          timestamp: expect.any(String),
          environment: expect.any(String),
          version: '1.0.0',
        }),
      });
    });

    it('GET /api/v1/health/ready should return 200 with readiness details', async () => {
      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'ok',
          services: {
            http: 'up',
            database: 'not_configured_phase_1',
          },
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe('404 Not Found Middleware', () => {
    it('should return 404 with structured JSON for unknown routes', async () => {
      const res = await request(app).get('/api/v1/non-existent-route');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining("The requested resource 'GET /api/v1/non-existent-route' was not found"),
        },
      });
    });

    it('should return 404 for unknown root routes', async () => {
      const res = await request(app).post('/random-unhandled-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Error Handling Middleware', () => {
    it('should return 400 INVALID_JSON when receiving malformed JSON body', async () => {
      const res = await request(app)
        .post('/api/v1/health')
        .set('Content-Type', 'application/json')
        .send('{"invalidJson": unquoted_value}');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Malformed JSON payload provided in request body',
        },
      });
    });

    it('should propagate incoming X-Request-Id header in response', async () => {
      const customRequestId = 'test-request-id-12345';
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Request-Id', customRequestId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('Security Headers', () => {
    it('should include Helmet security headers in responses', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.headers['x-dns-prefetch-control']).toBeDefined();
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
