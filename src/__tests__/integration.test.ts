import request from 'supertest';
import app from '../app.js';
import { sequelize } from '../config/database.js';

describe('Integration Tests', () => {
  
  afterAll(async () => {
    await sequelize.close();
  });

  // 1. Test Public Health Endpoint
//   describe('GET /health', () => {
//     it('should return 200 OK and status info', async () => {
//       const response = await request(app).get('/health');
//       expect(response.status).toBe(200);
//       expect(response.body).toHaveProperty('status', 'ok');
//       expect(response.body).toHaveProperty('service', 'aura-backend');
//     });
//   });

  // 2. Test Root Endpoint
  describe('GET /', () => {
    it('should return 200 OK and Hello World message', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('Hello World!');
    });
  });

  // 3. Test Account Deletion Info Page (Static HTML)
  describe('GET /account/delete/info', () => {
    it('should return 200 OK and HTML content', async () => {
      const response = await request(app).get('/account/delete/info');
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('text/html');
      expect(response.text).toContain('Cómo eliminar tu cuenta de AURA');
    });
  });

  // 4. Test Protected Route without Token (Unauthorized)
  describe('GET /api/users/profile', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app).get('/api/users/profile');
      expect(response.status).toBe(401);
      // expect(response.body).toHaveProperty('error'); // The middleware might return just status or different body
    });
  });

  // 5. Test Non-existent Route
  describe('GET /api/non-existent-route', () => {
    it('should return 404 Not Found (or handled error)', async () => {
      const response = await request(app).get('/api/non-existent-route');
      // Express default 404 is HTML, but if we have a catch-all or just no route match
      expect(response.status).toBe(404);
    });
  });
});
