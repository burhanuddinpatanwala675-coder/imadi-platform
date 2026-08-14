import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@prisma/client', () => ({
    AdminRole: {
        super_admin: 'super_admin',
        editor: 'editor',
        sales: 'sales',
    },
    ContentStatus: {
        published: 'published',
    },
    PrismaClient: class {
        contactInquiry = { create: vi.fn().mockResolvedValue({ id: 'i1' }) };
        newsletterSubscriber = { findUnique: vi.fn(), upsert: vi.fn() };
        $queryRawUnsafe = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    },
}));

describe('public form contracts', () => {
    it('requires a complete contact request', async () => {
        const { app } = await import('../src/app.js');
        const request = (await import('supertest')).default;
        const response = await request(app).post('/api/contact').send({ name: 'A' });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unauthenticated dashboard request', async () => {
        const { app } = await import('../src/app.js');
        const request = (await import('supertest')).default;
        const response = await request(app).get('/api/admin/dashboard');

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('issues a CSRF token for cookie-authenticated mutations', async () => {
        const { app } = await import('../src/app.js');
        const request = (await import('supertest')).default;
        const response = await request(app).get('/api/csrf');

        expect(response.status).toBe(200);
        expect(response.body.data.token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('reports ready when the database is reachable', async () => {
        const { app } = await import('../src/app.js');
        const request = (await import('supertest')).default;
        const response = await request(app).get('/ready');

        expect(response.status).toBe(200);
        expect(response.body.data.database).toBe('connected');
    });
});
