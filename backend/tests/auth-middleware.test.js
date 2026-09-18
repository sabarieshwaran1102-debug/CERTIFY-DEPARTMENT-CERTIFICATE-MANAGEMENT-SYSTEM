import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

const buildApp = async () => {
  process.env.JWT_SECRET = 'test-secret';

  const { verifyToken, requireRole } = await import('../src/middleware/auth.js');
  const { errorHandler } = await import('../src/middleware/errorHandler.js');
  const User = (await import('../src/models/User.js')).default;

  const app = express();

  app.use(express.json());
  app.get('/protected', verifyToken, requireRole('student'), (req, res) => {
    res.json({ ok: true, user: req.user.username });
  });
  app.use(errorHandler);

  return { app, User };
};

describe('auth middleware', () => {
  it('returns 401 when the token is missing', async () => {
    const { app } = await buildApp();
    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Missing or invalid authorization token');
  });

  it('returns 403 when the user lacks the required role', async () => {
    const { app, User } = await buildApp();
    const token = jwt.sign({ user_id: 999 }, 'test-secret');

    jest.spyOn(User, 'getById').mockResolvedValue({
      user_id: 999,
      student_id: 10,
      role: 'coordinating_faculty',
      username: 'faculty',
      is_active: true,
      assigned_faculty_id: null,
    });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Insufficient permissions for this action');
  });
});
