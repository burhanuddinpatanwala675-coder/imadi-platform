import { PrismaClient } from '@prisma/client'; import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
    const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMeBeforeProduction!', 12); const admin = await prisma.adminUser.upsert({ where: { email: 'admin@example.com' }, update: {}, create: { fullName: 'Imadi Administrator', email: 'admin@example.com', passwordHash, role: 'super_admin' } }); await prisma.siteSettings.upsert({
        where: { id: 1 }, update: {}, create: {
            id: 1,
            companyName: 'Imadi Technologies',
            primaryEmail: 'hello@example.com',
            notificationEmails: ['sales@example.com'],
            socialLinks: {},
            metaDefaults: {}
        }
    }); await prisma.blogPost.upsert({ where: { slug: 'technology-strategy-without-the-theatre' }, update: {}, create: { title: 'Technology strategy without the theatre', slug: 'technology-strategy-without-the-theatre', excerpt: 'How to turn a technology question into an actionable decision.', content: 'Sample editorial content. Replace with reviewed Imadi content before publishing.', category: 'Strategy', tags: ['strategy'], authorId: admin.id, status: 'draft' } }); await prisma.contactInquiry.upsert({ where: { id: 'seed-inquiry' }, update: {}, create: { id: 'seed-inquiry', name: 'Sample enquiry', workEmail: 'sample@example.com', companyName: 'Example Company', projectType: 'Custom software', message: 'Sample enquiry for development and dashboard testing.', sourcePage: '/' } })
} main().finally(() => prisma.$disconnect());
