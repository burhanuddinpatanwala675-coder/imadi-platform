import { app, prisma } from './app.js';

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () =>
    console.log(`Imadi API listening on :${port}`)
);

const shutdown = (signal: string) => {
    console.log(`${signal} received; shutting down.`);
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
