import 'dotenv/config';

import { notifyContact, sendNewsletterConfirmation, sendPasswordReset } from './mail.js';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { PrismaClient, AdminRole, ContentStatus, SubscriberStatus, Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

export const prisma = new PrismaClient();
export const app = express();

const production = process.env.NODE_ENV === 'production';

const defaultSessionSecret = 'development-only-secret-change-me';
const secret = process.env.SESSION_SECRET || defaultSessionSecret;
const cookieSecure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : production;
const defaultPublicSiteUrl = production
    ? 'https://imadi-technologies.netlify.app'
    : 'http://localhost:3000';
const publicSiteUrl = (process.env.PUBLIC_SITE_URL || defaultPublicSiteUrl).replace(/\/$/, '');

const origins = (
    process.env.ALLOWED_ORIGINS || (production
        ? 'https://imadi-technologies.netlify.app'
        : 'http://localhost:3000')
)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

if (production) {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL must be configured in production.');
    }

    if (secret === defaultSessionSecret || secret.length < 32) {
        throw new Error('SESSION_SECRET must be a unique value of at least 32 characters in production.');
    }

    if (!cookieSecure) {
        throw new Error('COOKIE_SECURE must be true in production.');
    }

    if (origins.some((origin) => !origin.startsWith('https://'))) {
        throw new Error('ALLOWED_ORIGINS must contain explicit HTTPS origins in production.');
    }

    if (!publicSiteUrl.startsWith('https://')) {
        throw new Error('PUBLIC_SITE_URL must be the public HTTPS website address in production.');
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('SMTP is not configured: contact, newsletter, and password-reset emails will not be sent.');
    }
}

app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

app.use(
    helmet({
        contentSecurityPolicy: production ? undefined : false,
    })
);

const corsOptions = {
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
};

// Handle browser preflight requests before parsing a body or applying rate
// limits. This is especially important when the static Netlify site calls the
// API on a different origin.
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());

app.use(
    rateLimit({
        windowMs: 15 * 60_000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false,
    })
);


const openApi = {
    openapi: '3.0.3',
    info: {
        title: 'Imadi Technologies API',
        version: '1.0.0',
    },
    paths: {
        '/api/contact': {
            post: {
                summary: 'Submit contact enquiry',
            },
        },
        '/api/newsletter/subscribe': {
            post: {
                summary: 'Subscribe newsletter',
            },
        },
        '/api/blog': {
            get: {
                summary: 'List published posts',
            },
        },
        '/api/admin/auth/login': {
            post: {
                summary: 'Administrator login',
            },
        },
        '/api/admin/dashboard': {
            get: {
                summary: 'Dashboard',
                security: [{ cookieAuth: [] }],
            },
        },
    },
    components: {
        securitySchemes: {
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'imadi_session',
            },
        },
    },
};


app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApi)
);

app.get('/api/openapi.json', (_req, res) => {
    res.json(openApi);
});


type AuthRequest = Request & {
    user?: {
        id: string;
        role: AdminRole;
        email: string;
    };
};


const success = (
    res: Response,
    data: unknown,
    status = 200
) =>
    res.status(status).json({
        success: true,
        data,
    });


const fail = (
    res: Response,
    code: string,
    message: string,
    status = 400
) =>
    res.status(status).json({
        success: false,
        error: {
            code,
            message,
        },
    });


const clean = (value: string) =>
    value.trim().replace(/[<>]/g, '');


const text = z
    .string()
    .trim()
    .min(1)
    .max(500)
    .transform(clean);


const email = z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase());


// Accepts either a full absolute URL (https://...) or the site-relative
// path returned by POST /api/admin/media (e.g. "/uploads/xyz.jpg"), since
// both are valid values for an <img src> and the upload endpoint only
// returns the latter.
const imageRef = z
    .string()
    .trim()
    .max(2048)
    .refine((value) => /^https?:\/\//i.test(value) || value.startsWith('/'), {
        message: 'Enter a valid image URL or upload an image.',
    });

// Value from an <input type="date"> (yyyy-mm-dd). Lets an editor choose the
// blog post / case study's publish date instead of it always being "now" —
// useful for backdating older work or keeping a specific publish order.
const publishDate = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
    .optional();

const resolvePublishedAt = (status: ContentStatus, chosenDate?: string) =>
    status === ContentStatus.published
        ? new Date(chosenDate ? `${chosenDate}T00:00:00.000Z` : Date.now())
        : null;

// Optional per-page SEO overrides. Search engines truncate around these
// lengths, so cap them here rather than letting an editor write something
// that just gets cut off in results.
const seoTitle = z.string().trim().max(70).nullable().optional();
const seoDescription = z.string().trim().max(160).nullable().optional();


const contactSchema = z.object({
    name: text,
    workEmail: email,
    companyName: text,
    phoneNumber: z.string().max(50).optional(),
    projectType: text,
    budgetRange: z.string().max(120).optional(),
    message: z.string().trim().min(10).max(5000).transform(clean),
    sourcePage: z.string().max(512).default('/'),
    honeypot: z.string().max(0).optional(),
});


const subscriberSchema = z.object({
    email,
    firstName: z.string().trim().max(100).optional(),
    consent: z.literal(true),
    honeypot: z.string().max(0).optional(),
});


function requireAuth(
    roles?: AdminRole[]
) {
    return (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const token = req.cookies.imadi_session;

            if (!token) {
                return fail(
                    res,
                    'UNAUTHENTICATED',
                    'Sign in required.',
                    401
                );
            }


            const user =
                jwt.verify(token, secret) as AuthRequest['user'];


            if (!user) {
                return fail(
                    res,
                    'UNAUTHENTICATED',
                    'Session invalid.',
                    401
                );
            }


            if (
                roles &&
                !roles.includes(user.role)
            ) {
                return fail(
                    res,
                    'FORBIDDEN',
                    'Insufficient permissions.',
                    403
                );
            }


            req.user = user;

            next();

        } catch {
            return fail(
                res,
                'UNAUTHENTICATED',
                'Session is invalid or expired.',
                401
            );
        }
    };
}

app.post(
    '/api/admin/blog',
    csrf,
    requireAuth([AdminRole.super_admin, AdminRole.editor]),
    async (req, res, next: NextFunction) => {
        try {
            const schema = z.object({
                title: z.string().min(3),
                slug: z.string().min(3),
                excerpt: z.string().min(10),
                content: z.string().min(10),
                category: z.string().min(2).max(100).default('Technology'),
                status: z.nativeEnum(ContentStatus).default(ContentStatus.draft),
                tags: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
                coverImageUrl: imageRef.nullable().optional(),
                publishedAt: publishDate,
                seoTitle,
                seoDescription,
            });

            const data = schema.parse(req.body);

            const post = await prisma.blogPost.create({
                data: {
                    title: data.title,
                    slug: data.slug,
                    excerpt: data.excerpt,
                    content: data.content,
                    category: data.category,
                    tags: data.tags,
                    coverImageUrl: data.coverImageUrl,
                    status: data.status,
                    publishedAt: resolvePublishedAt(data.status, data.publishedAt),
                    seoTitle: data.seoTitle,
                    seoDescription: data.seoDescription,
                    author: {
                        connect: {
                            id: req.user!.id
                        }
                    }
                }
            });

            return res.json({
                success: true,
                post
            });

        } catch (error) {
            console.error('BLOG CREATE ERROR:', error);
            next(error);
        }
    }
);
app.delete(
    '/api/admin/blog/:id',
    csrf,
    requireAuth([AdminRole.super_admin, AdminRole.editor]),
    async (req, res, next: NextFunction) => {

        try {

            await prisma.blogPost.delete({
                where: {
                    id: String(req.params.id)
                }
            });

            return res.json({
                success: true
            });

        } catch (error) {

            console.error('BLOG DELETE ERROR:', error);
            next(error);

        }

    }
);
function csrf(
    req: Request,
    res: Response,
    next: NextFunction
) {

    if (
        ['GET', 'HEAD', 'OPTIONS']
            .includes(req.method)
    ) {
        return next();
    }


    const token = req.header('x-csrf-token');


    if (
        !token ||
        token !== req.cookies.imadi_csrf
    ) {
        return fail(
            res,
            'CSRF_INVALID',
            'CSRF token is missing or invalid.',
            403
        );
    }


    next();
}


async function audit(
    req: AuthRequest,
    action: string,
    entityType?: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue) {

    await prisma.auditLog.create({
        data: {
            actorId: req.user?.id,
            action,
            entityType,
            entityId,
            metadata,
        },
    });

}


const publicLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 12,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message:
                'Too many submissions. Please try again later.',
        },
    },
});


app.get(
    '/health',
    (_req, res) =>
        success(res, { status: 'ok' })
);

app.get(
    '/ready',
    async (_req, res) => {
        try {
            await prisma.$queryRawUnsafe('SELECT 1');
            return success(res, { status: 'ready', database: 'connected' });
        } catch {
            return fail(
                res,
                'DATABASE_UNAVAILABLE',
                'Database is unavailable.',
                503
            );
        }
    }
);


app.get(
    '/api/csrf',
    (_req, res) => {

        const token =
            crypto.randomBytes(32).toString('hex');


        res.cookie(
            'imadi_csrf',
            token,
            {
                httpOnly: false,
                sameSite: 'strict',
                secure: cookieSecure,
            }
        );


        success(res, { token });
    }
);


app.post(
    '/api/contact',
    publicLimiter,
    async (
        req,
        res,
        next
    ) => {

        try {

            const d =
                contactSchema.parse(req.body);


            if (d.honeypot) {
                return success(
                    res,
                    { accepted: true },
                    202
                );
            }


            const {
                honeypot,
                ...data
            } = d;


            const inquiry =
                await prisma.contactInquiry.create({
                    data,
                });


            void notifyContact(data)
                .catch(console.error);


            success(
                res,
                {
                    id: inquiry.id,
                    message:
                        'Thank you. Your enquiry has been received.',
                },
                201
            );

        } catch (e) {
            next(e);
        }

    }
);

app.post('/api/newsletter/unsubscribe', publicLimiter, async (req, res, next) => {
    try {
        const { token } = z.object({ token: z.string().length(48) }).parse(req.body);
        const item = await prisma.newsletterSubscriber.update({ where: { unsubscribeToken: token }, data: { status: SubscriberStatus.unsubscribed } });
        success(res, { unsubscribed: true, email: item.email });
    } catch (e) { next(e); }
});


app.post(
    '/api/newsletter/subscribe',
    publicLimiter,
    async (
        req,
        res,
        next
    ) => {

        try {

            const d =
                subscriberSchema.parse(req.body);


            if (d.honeypot) {
                return success(
                    res,
                    {
                        subscribed: true,
                    },
                    202
                );
            }


            const existing =
                await prisma.newsletterSubscriber.findUnique({
                    where: {
                        email: d.email,
                    },
                });


            if (
                existing?.status === 'active'
            ) {

                return success(
                    res,
                    {
                        subscribed: true,
                        message:
                            'You are already subscribed.',
                    }
                );

            }


            const subscriber =
                await prisma.newsletterSubscriber.upsert({
                    where: {
                        email: d.email,
                    },

                    update: {
                        status: 'active',
                        firstName: d.firstName,
                        consentAt: new Date(),
                    },

                    create: {
                        email: d.email,
                        firstName: d.firstName,
                        status: 'active',
                        consentAt: new Date(),
                        unsubscribeToken:
                            crypto
                                .randomBytes(24)
                                .toString('hex'),
                    },
                });


            success(
                res,
                {
                    id: subscriber.id,
                    subscribed: true,
                },
                201
            );

            void sendNewsletterConfirmation(subscriber.email, subscriber.firstName || undefined, `${publicSiteUrl}/unsubscribe.html?token=${subscriber.unsubscribeToken}`).catch(console.error);


        } catch (e) {
            next(e);
        }

    }
);

app.get('/api/case-studies', async (_req, res, next) => {
    try {
        const items = await prisma.caseStudy.findMany({
            where: { status: ContentStatus.published },
            orderBy: { publishedAt: 'desc' },
            select: { id: true, title: true, slug: true, clientName: true, industry: true, challenge: true, outcomes: true, coverImageUrl: true, publishedAt: true },
        });
        success(res, { items });
    } catch (e) { next(e); }
});

app.get('/api/case-studies/:slug', async (req, res, next) => {
    try {
        const item = await prisma.caseStudy.findFirst({ where: { slug: String(req.params.slug), status: ContentStatus.published } });
        if (!item) return fail(res, 'NOT_FOUND', 'Case study not found.', 404);
        success(res, item);
    } catch (e) { next(e); }
});



app.get(
    '/api/blog',
    async (
        req,
        res,
        next
    ) => {

        try {

            const page =
                Math.max(
                    1,
                    Number(req.query.page) || 1
                );


            const limit =
                Math.min(
                    50,
                    Math.max(
                        1,
                        Number(req.query.limit) || 10
                    )
                );


            const category =
                typeof req.query.category === 'string'
                    ? req.query.category
                    : undefined;


            const search =
                typeof req.query.search === 'string'
                    ? req.query.search
                    : undefined;


            const where = {
                status: ContentStatus.published,

                ...(category
                    ? { category }
                    : {}),

                ...(search
                    ? {
                        OR: [
                            {
                                title: {
                                    contains: search,
                                    mode: 'insensitive' as const,
                                },
                            },
                            {
                                excerpt: {
                                    contains: search,
                                    mode: 'insensitive' as const,
                                },
                            },
                        ],
                    }
                    : {}),
            };


            const [
                items,
                total,
            ] =
                await prisma.$transaction([
                    prisma.blogPost.findMany({
                        where,
                        orderBy: {
                            publishedAt: 'desc',
                        },

                        skip:
                            (page - 1) * limit,

                        take: limit,

                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            excerpt: true,
                            coverImageUrl: true,
                            category: true,
                            tags: true,
                            publishedAt: true,
                            status: true,
                        },
                    }),

                    prisma.blogPost.count({
                        where,
                    }),
                ]);


            success(
                res,
                {
                    items,

                    pagination: {
                        page,
                        limit,
                        total,
                        pages:
                            Math.ceil(
                                total / limit
                            ),
                    },
                }
            );


        } catch (e) {
            next(e);
        }

    }
);



app.get(
    '/api/blog/:slug',
    async (
        req,
        res,
        next
    ) => {

        try {

            const post =
                await prisma.blogPost.findFirst({
                    where: {
                        slug: req.params.slug,
                        status: ContentStatus.published,
                    },

                    include: {
                        author: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                });


            if (!post) {
                return fail(
                    res,
                    'NOT_FOUND',
                    'Post not found.',
                    404
                );
            }


            success(
                res,
                post
            );


        } catch (e) {
            next(e);
        }

    }
);



app.post(
    '/api/admin/auth/login',
    rateLimit({
        windowMs:
            15 * 60_000,
        limit: 8,
    }),

    async (
        req,
        res,
        next
    ) => {

        try {

            const d =
                z.object({
                    email,
                    password:
                        z.string()
                            .min(8)
                            .max(200),
                })
                    .parse(req.body);



            const user =
                await prisma.adminUser.findUnique({
                    where: {
                        email: d.email,
                    },
                });



            const bcrypt =
                await import('bcryptjs');



            if (
                !user ||
                !(await bcrypt.compare(
                    d.password,
                    user.passwordHash
                ))
            ) {

                return fail(
                    res,
                    'INVALID_CREDENTIALS',
                    'Invalid email or password.',
                    401
                );

            }



            await prisma.adminUser.update({
                where: {
                    id: user.id,
                },

                data: {
                    lastLoginAt:
                        new Date(),
                },
            });



            const token =
                jwt.sign(
                    {
                        id: user.id,
                        role: user.role,
                        email: user.email,
                    },

                    secret,

                    {
                        expiresIn: '8h',
                    }
                );



            res.cookie(
                'imadi_session',
                token,
                {
                    httpOnly: true,
                    secure: cookieSecure,
                    sameSite: 'strict',
                    maxAge:
                        8 * 60 * 60_000,
                }
            );



            await prisma.auditLog.create({
                data: {
                    actorId: user.id,
                    action:
                        'admin.login',
                },
            });



            success(
                res,
                {
                    user: {
                        id: user.id,
                        fullName: user.fullName,
                        email: user.email,
                        role: user.role,
                    },
                }
            );


        } catch (e) {
            next(e);
        }

    }
);



app.post(
    '/api/admin/auth/logout',
    csrf,
    requireAuth(),

    async (
        req: AuthRequest,
        res,
        next
    ) => {

        try {

            res.clearCookie(
                'imadi_session'
            );


            await audit(
                req,
                'admin.logout'
            );


            success(
                res,
                {
                    loggedOut: true,
                }
            );


        } catch (e) {
            next(e);
        }

    }
);

app.post('/api/admin/auth/forgot-password', rateLimit({ windowMs: 15 * 60_000, limit: 5 }), async (req, res, next) => {
    try {
        const { email: requestedEmail } = z.object({ email }).parse(req.body);
        const user = await prisma.adminUser.findUnique({ where: { email: requestedEmail } });
        if (user) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            await prisma.passwordResetToken.deleteMany({ where: { adminUserId: user.id, usedAt: null } });
            await prisma.passwordResetToken.create({ data: { adminUserId: user.id, tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'), expiresAt: new Date(Date.now() + 30 * 60_000) } });
            void sendPasswordReset(user.email, `${publicSiteUrl}/admin/reset-password.html?token=${rawToken}`).catch(console.error);
        }
        success(res, { requested: true, message: 'If an account exists, a reset link has been sent.' });
    } catch (e) { next(e); }
});

app.post('/api/admin/auth/reset-password', rateLimit({ windowMs: 15 * 60_000, limit: 5 }), async (req, res, next) => {
    try {
        const data = z.object({ token: z.string().length(64), password: z.string().min(12).max(200) }).parse(req.body);
        const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');
        const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }, include: { adminUser: true } });
        if (!record) return fail(res, 'RESET_INVALID', 'This password-reset link is invalid or expired.', 400);
        const bcrypt = await import('bcryptjs');
        await prisma.$transaction([prisma.adminUser.update({ where: { id: record.adminUserId }, data: { passwordHash: await bcrypt.hash(data.password, 12) } }), prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })]);
        success(res, { reset: true });
    } catch (e) { next(e); }
});

app.get(
    '/api/settings/public',
    async (req, res, next) => {
        try {

            const settings =
                await prisma.siteSettings.findUnique({
                    where: {
                        id: 1
                    }
                });

            res.json({
                success: true,
                data: settings
            });

        } catch (error) {
            next(error);
        }
    }
);


app.get(
    '/api/admin/auth/me',
    requireAuth(),

    async (
        req: AuthRequest,
        res,
        next
    ) => {

        try {

            const user =
                await prisma.adminUser.findUnique({
                    where: {
                        id: req.user!.id,
                    },

                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        lastLoginAt: true,
                    },
                });


            success(
                res,
                {
                    user,
                }
            );


        } catch (e) {
            next(e);
        }

    }
);
app.get(
    '/api/admin/users',
    requireAuth([AdminRole.super_admin]),

    async (
        _req,
        res,
        next
    ) => {

        try {

            const users =
                await prisma.adminUser.findMany({
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        lastLoginAt: true,
                        createdAt: true,
                    },

                    orderBy: {
                        createdAt: 'desc',
                    },
                });


            success(
                res,
                users
            );


        } catch (e) {
            next(e);
        }

    }
);



app.post(
    '/api/admin/users',
    csrf,
    requireAuth([AdminRole.super_admin]),

    async (
        req: AuthRequest,
        res,
        next
    ) => {

        try {

            const d =
                z.object({
                    fullName: text,
                    email,
                    password:
                        z.string()
                            .min(12)
                            .max(200),

                    role:
                        z.nativeEnum(AdminRole),
                })
                    .parse(req.body);



            const bcrypt =
                await import('bcryptjs');



            const user =
                await prisma.adminUser.create({

                    data: {

                        fullName:
                            d.fullName,

                        email:
                            d.email,

                        passwordHash:
                            await bcrypt.hash(
                                d.password,
                                12
                            ),

                        role:
                            d.role,
                    },


                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        createdAt: true,
                    },

                });



            await audit(
                req,
                'admin.created',
                'AdminUser',
                user.id,
                {
                    role: user.role,
                }
            );


            success(
                res,
                user,
                201
            );


        } catch (e) {
            next(e);
        }

    }
);

app.get(
    '/api/admin/blog',
    requireAuth([AdminRole.super_admin, AdminRole.editor]),
    async (_req, res, next) => {
        try {
            const posts = await prisma.blogPost.findMany({
                include: {
                    author: {
                        select: { fullName: true },
                    },
                },
                orderBy: { updatedAt: 'desc' },
            });

            success(res, posts);
        } catch (e) {
            next(e);
        }
    }
);

app.get(
    '/api/admin/blog/:id',
    requireAuth([AdminRole.super_admin, AdminRole.editor]),
    async (req, res, next: NextFunction) => {

        try {

            const post = await prisma.blogPost.findUnique({
                where: {
                    id: String(req.params.id)
                }
            });

            if (!post) {
                return fail(res, 'NOT_FOUND', 'Post not found.', 404);
            }

            return res.json({
                success: true,
                post
            });

        } catch (error) {

            console.error('BLOG FETCH ERROR:', error);
            next(error);

        }

    }
);

app.patch(
    '/api/admin/blog/:id',
    csrf,
    requireAuth([AdminRole.super_admin, AdminRole.editor]),
    async (req, res, next: NextFunction) => {

        try {

            const schema = z.object({
                title: z.string().min(3),
                slug: z.string().min(3),
                excerpt: z.string().min(10),
                content: z.string().min(10),
                category: z.string().min(2).max(100),
                status: z.nativeEnum(ContentStatus),
                tags: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
                coverImageUrl: imageRef.nullable().optional(),
                publishedAt: publishDate,
                seoTitle,
                seoDescription,
            });

            const data = schema.parse(req.body);

            const post = await prisma.blogPost.update({
                where: {
                    id: String(req.params.id)
                },
                data: {
                    title: data.title,
                    slug: data.slug,
                    excerpt: data.excerpt,
                    content: data.content,
                    category: data.category,
                    status: data.status,
                    tags: data.tags,
                    coverImageUrl: data.coverImageUrl,
                    publishedAt: resolvePublishedAt(data.status, data.publishedAt),
                    seoTitle: data.seoTitle,
                    seoDescription: data.seoDescription,
                }
            });

            return res.json({
                success: true,
                post
            });

        } catch (error) {

            console.error('BLOG UPDATE ERROR:', error);
            next(error);

        }

    }
);

app.delete(
    '/api/admin/users/:id',
    csrf,
    requireAuth([AdminRole.super_admin]),

    async (
        req: AuthRequest,
        res,
        next
    ) => {

        try {

            if (
                req.params.id === req.user!.id
            ) {

                return fail(
                    res,
                    'VALIDATION_ERROR',
                    'You cannot remove your own account.',
                    422
                );

            }


            await prisma.adminUser.delete({
                where: {
                    id: String(req.params.id)
                },
            });



            await audit(
                req,
                'admin.deleted',
                'AdminUser',
                String(req.params.id));


            success(
                res,
                {
                    deleted: true,
                }
            );


        } catch (e) {
            next(e);
        }

    }
);



const updateInquiry =
    z.object({

        status:
            z.enum([
                'new',
                'contacted',
                'qualified',
                'proposal_sent',
                'won',
                'lost',
                'archived',
            ])
                .optional(),


        assignedToId:
            z.string()
                .nullable()
                .optional(),


        notes:
            z.string()
                .max(10000)
                .nullable()
                .optional(),

    });



app.get(
    '/api/admin/inquiries',
    requireAuth(),

    async (
        req,
        res,
        next
    ) => {

        try {

            const q =
                typeof req.query.q === 'string'
                    ? req.query.q
                    : '';


            const status =
                typeof req.query.status === 'string'
                    ? req.query.status
                    : undefined;



            const inquiries =
                await prisma.contactInquiry.findMany({

                    where: {

                        ...(status
                            ? {
                                status:
                                    status as never,
                            }
                            : {}),


                        ...(q
                            ? {

                                OR: [

                                    {
                                        name: {
                                            contains: q,
                                            mode:
                                                'insensitive',
                                        },
                                    },


                                    {
                                        workEmail: {
                                            contains: q,
                                            mode:
                                                'insensitive',
                                        },
                                    },


                                    {
                                        companyName: {
                                            contains: q,
                                            mode:
                                                'insensitive',
                                        },
                                    },

                                ],

                            }

                            : {}),

                    },


                    include: {

                        assignedTo: {

                            select: {

                                id: true,
                                fullName: true,
                                email: true,

                            },

                        },

                    },


                    orderBy: {
                        createdAt:
                            'desc',
                    },

                });



            success(
                res,
                inquiries
            );


        } catch (e) {
            next(e);
        }

    }
);



app.patch(
    '/api/admin/inquiries/:id',
    csrf,
    requireAuth([
        AdminRole.super_admin,
        AdminRole.sales,
    ]),

    async (
        req: AuthRequest,
        res,
        next
    ) => {

        try {

            const data =
                updateInquiry.parse(
                    req.body
                );


            const item =
                await prisma.contactInquiry.update({

                    where: {
                        id: String(req.params.id)
                    },

                    data,

                });



            await audit(
                req,
                'inquiry.updated',
                'ContactInquiry',
                item.id,
                data
            );


            success(
                res,
                item
            );


        } catch (e) {
            next(e);
        }

    }
);


const caseStudySchema = z.object({
    title: text,
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(140),
    clientName: z.string().trim().max(160).nullable().optional(),
    industry: text,
    challenge: z.string().trim().min(10).max(10000),
    solution: z.string().trim().min(10).max(10000),
    outcomes: z.string().trim().min(10).max(10000),
    coverImageUrl: imageRef.nullable().optional(),
    galleryImages: z.array(z.string().url().max(2048)).max(12).default([]),
    status: z.nativeEnum(ContentStatus).default(ContentStatus.draft),
    publishedAt: publishDate,
    seoTitle,
    seoDescription,
});

app.get('/api/admin/case-studies', requireAuth([AdminRole.super_admin, AdminRole.editor]), async (_req, res, next) => {
    try { success(res, await prisma.caseStudy.findMany({ orderBy: { updatedAt: 'desc' } })); } catch (e) { next(e); }
});

app.post('/api/admin/case-studies', csrf, requireAuth([AdminRole.super_admin, AdminRole.editor]), async (req: AuthRequest, res, next) => {
    try {
        const data = caseStudySchema.parse(req.body);
        const item = await prisma.caseStudy.create({ data: { ...data, publishedAt: resolvePublishedAt(data.status, data.publishedAt) } });
        await audit(req, 'case-study.created', 'CaseStudy', item.id, { title: item.title });
        success(res, item, 201);
    } catch (e) { next(e); }
});

app.patch('/api/admin/case-studies/:id', csrf, requireAuth([AdminRole.super_admin, AdminRole.editor]), async (req: AuthRequest, res, next) => {
    try {
        const data = caseStudySchema.parse(req.body);
        const item = await prisma.caseStudy.update({ where: { id: String(req.params.id) }, data: { ...data, publishedAt: resolvePublishedAt(data.status, data.publishedAt) } });
        await audit(req, 'case-study.updated', 'CaseStudy', item.id, { title: item.title });
        success(res, item);
    } catch (e) { next(e); }
});

app.delete('/api/admin/case-studies/:id', csrf, requireAuth([AdminRole.super_admin, AdminRole.editor]), async (req: AuthRequest, res, next) => {
    try {
        await prisma.caseStudy.delete({ where: { id: String(req.params.id) } });
        await audit(req, 'case-study.deleted', 'CaseStudy', String(req.params.id));
        success(res, { deleted: true });
    } catch (e) { next(e); }
});

app.get('/api/admin/subscribers', requireAuth([AdminRole.super_admin]), async (_req, res, next) => {
    try { success(res, await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { next(e); }
});

app.patch('/api/admin/subscribers/:id', csrf, requireAuth([AdminRole.super_admin]), async (req: AuthRequest, res, next) => {
    try {
        const { status } = z.object({ status: z.nativeEnum(SubscriberStatus) }).parse(req.body);
        const item = await prisma.newsletterSubscriber.update({ where: { id: String(req.params.id) }, data: { status } });
        await audit(req, 'subscriber.updated', 'NewsletterSubscriber', item.id, { status });
        success(res, item);
    } catch (e) { next(e); }
});

app.get('/api/admin/settings', requireAuth([AdminRole.super_admin]), async (_req, res, next) => {
    try { success(res, await prisma.siteSettings.findUnique({ where: { id: 1 } })); } catch (e) { next(e); }
});

app.post('/api/admin/media', csrf, requireAuth([AdminRole.super_admin, AdminRole.editor]), async (req: AuthRequest, res, next) => {
    try {
        const { filename, dataUrl } = z.object({ filename: z.string().min(1).max(120), dataUrl: z.string().max(7_000_000) }).parse(req.body);
        const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match) return fail(res, 'VALIDATION_ERROR', 'Upload a PNG, JPEG, WebP, or GIF image.', 422);
        const bytes = Buffer.from(match[2], 'base64');
        if (bytes.length > Number(process.env.MEDIA_MAX_BYTES || 5_242_880)) return fail(res, 'VALIDATION_ERROR', 'The image is too large (maximum 5 MB).', 422);
        const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[match[1]];
        const storedName = `${crypto.randomUUID()}.${extension}`;
        const uploadDir = path.join(__dirname, '../public/uploads');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, storedName), bytes, { flag: 'wx' });
        const url = `/uploads/${storedName}`;
        await audit(req, 'media.uploaded', 'Media', storedName, { filename });
        success(res, { url, filename: storedName }, 201);
    } catch (e) { next(e); }
});

// Empty string means "not set yet" (cleared in the admin form), so it is
// accepted alongside a real absolute URL rather than rejected.
const socialLinkUrl = z.union([z.string().trim().url().max(300), z.literal('')]).optional();

app.patch('/api/admin/settings', csrf, requireAuth([AdminRole.super_admin]), async (req: AuthRequest, res, next) => {
    try {
        const data = z.object({
            companyName: text, primaryEmail: email, phoneNumber: z.string().trim().max(80).nullable().optional(),
            address: z.string().trim().max(500).nullable().optional(), consultationCTA: z.string().trim().max(160).nullable().optional(),
            analyticsId: z.string().trim().max(120).nullable().optional(), notificationEmails: z.array(email).max(12),
            socialLinks: z.object({
                linkedin: socialLinkUrl,
                x: socialLinkUrl,
                linkedinFounder: socialLinkUrl,
                linkedinCofounder: socialLinkUrl,
                portfolioFounder: socialLinkUrl,
                portfolioCofounder: socialLinkUrl,
                instagram: socialLinkUrl,
                facebook: socialLinkUrl,
                tiktok: socialLinkUrl,
                // Live/demo links for products shown on the Products page and the
                // AI Lab section — each stays hidden on the site until set here.
                maflowUrl: socialLinkUrl,
                cfcIndexUrl: socialLinkUrl,
                alicoUrl: socialLinkUrl,
                erpUrl: socialLinkUrl,
                renazUrl: socialLinkUrl,
            }).optional(),
        }).parse(req.body);
        const item = await prisma.siteSettings.update({ where: { id: 1 }, data });
        await audit(req, 'settings.updated', 'SiteSettings', '1');
        success(res, item);
    } catch (e) { next(e); }
});



app.get(
    '/api/admin/dashboard',
    requireAuth(),

    async (
        _req,
        res,
        next
    ) => {

        try {

            const [
                leadTotal,
                breakdown,
                recentLeads,
                newsletterGrowth,

            ] =
                await Promise.all([

                    prisma.contactInquiry.count(),


                    prisma.contactInquiry.groupBy({

                        by: [
                            'status',
                        ],

                        _count: true,

                    }),


                    prisma.contactInquiry.findMany({

                        take: 8,

                        orderBy: {
                            createdAt:
                                'desc',
                        },

                        select: {

                            id: true,
                            name: true,
                            companyName: true,
                            status: true,
                            createdAt: true,

                        },

                    }),



                    prisma.newsletterSubscriber.count({

                        where: {

                            status:
                                'active',

                            createdAt: {

                                gte:
                                    new Date(
                                        Date.now()
                                        -
                                        30 *
                                        864e5
                                    ),

                            },

                        },

                    }),

                ]);



            success(
                res,
                {

                    leadTotal,

                    statusBreakdown:
                        breakdown,

                    recentLeads,

                    newsletterGrowth,

                    conversionFunnel:
                        breakdown,

                }
            );


        } catch (e) {
            next(e);
        }

    }
);

app.get('/sitemap.xml', async (_req, res, next) => {
    try {
        const pages = ['/', '/solutions.html', '/expertise.html', '/process.html', '/insights.html', '/case-studies.html', '/about.html', '/contact.html', '/privacy.html', '/terms.html', '/assessment.html', '/careers.html', '/how-we-build.html', '/build-vs-buy.html', '/roi-calculator.html', '/ai-demo.html', '/products.html'];
        const [posts, caseStudies] = await Promise.all([
            prisma.blogPost.findMany({ where: { status: ContentStatus.published }, select: { slug: true } }),
            prisma.caseStudy.findMany({ where: { status: ContentStatus.published }, select: { slug: true } }),
        ]);
        const dynamicPages = [
            ...posts.map((post: { slug: string }) => `/article.html?slug=${post.slug}`),
            ...caseStudies.map((item: { slug: string }) => `/case-study.html?slug=${item.slug}`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages, ...dynamicPages].map((page) => `  <url><loc>${publicSiteUrl}${page}</loc></url>`).join('\n')}\n</urlset>`;
        res.type('application/xml').send(xml);
    } catch (e) { next(e); }
});



app.use(
    '/api',
    (_req, res) =>
        fail(
            res,
            'NOT_FOUND',
            'Endpoint not found.',
            404
        )
);



const __dirname =
    path.dirname(
        fileURLToPath(import.meta.url)
    );


const publicRoot = [
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../public'),
].find(existsSync);

if (!publicRoot) {
    throw new Error('The public site directory could not be found.');
}



app.use(
    express.static(
        publicRoot
    )
);



app.get(
    [
        '/',
        '/index.html',
        '/contact.html',
    ],

    async (
        req,
        res,
        next
    ) => {

        try {

            const page =
                req.path === '/'
                    ||
                    req.path === '/index.html'
                    ? 'index.html'
                    : 'contact.html';


            const html =
                await readFile(
                    path.join(
                        publicRoot,
                        page
                    ),
                    'utf8'
                );


            res
                .type('html')
                .send(html);


        } catch (e) {
            next(e);
        }

    }
);



app.get(
    /.*/,
    (_req, res) =>
        res.sendFile(
            path.join(
                publicRoot,
                'index.html'
            )
        )
);



app.use(
    (
        err: unknown,
        _req: Request,
        res: Response,
        _next: NextFunction
    ) => {


        if (
            err instanceof ZodError
        ) {

            return fail(
                res,
                'VALIDATION_ERROR',
                'Invalid request.',
                422
            );

        }



        if (
            (err as any)?.code === 'P2002'
        ) {

            return fail(
                res,
                'CONFLICT',
                'A record with that value already exists.',
                409
            );

        }



        if (
            (err as any)?.code === 'P2025'
        ) {

            return fail(
                res,
                'NOT_FOUND',
                'Record not found.',
                404
            );

        }



        console.error(err);



        return fail(
            res,
            'INTERNAL_ERROR',
            'An unexpected error occurred.',
            500
        );

    }
);
