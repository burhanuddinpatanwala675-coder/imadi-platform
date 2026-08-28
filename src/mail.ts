import nodemailer from 'nodemailer';
import type { TransportOptions } from 'nodemailer';

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
const transport = configured ? nodemailer.createTransport({ host: process.env.SMTP_HOST!, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! } } as TransportOptions) : null;
const from = process.env.SMTP_FROM || 'Imadi Technologies <no-reply@example.com>';

async function send(to: string, subject: string, text: string) {
    if (!to) return;
    if (!transport) { console.warn(`Email not sent (SMTP is not configured): ${subject}`); return; }
    await transport.sendMail({ from, to, subject, text });
}

export async function notifyContact(input: { name: string; workEmail: string; companyName: string; message: string; projectType?: string; website?: string; toolsUsed?: string; timeline?: string; budgetRange?: string }) {
    const context = [
        input.projectType ? `Looking to improve: ${input.projectType}` : null,
        input.website ? `Website: ${input.website}` : null,
        input.toolsUsed ? `Current tools: ${input.toolsUsed}` : null,
        input.timeline ? `Timeline: ${input.timeline}` : null,
        input.budgetRange ? `Budget: ${input.budgetRange}` : null,
    ].filter(Boolean).join('\n');
    await Promise.all([send(input.workEmail, 'We received your Imadi enquiry', `Thanks ${input.name}. Our team has received your enquiry and will be in touch shortly.`), send(process.env.SALES_NOTIFICATION_EMAIL || '', `New website enquiry — ${input.companyName}`, `${input.name} (${input.workEmail})\n${context ? `\n${context}\n` : ''}\n${input.message}`)]);
}
export async function sendNewsletterConfirmation(email: string, firstName: string | undefined, unsubscribeUrl: string) { await send(email, 'You’re subscribed to Imadi updates', `Thanks${firstName ? ` ${firstName}` : ''}. You’ll receive occasional practical technology insights from Imadi Technologies. To unsubscribe at any time, use: ${unsubscribeUrl}`); }
export async function sendPasswordReset(email: string, resetUrl: string) { await send(email, 'Reset your Imadi admin password', `A password-reset request was received for your Imadi administrator account. Reset your password within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`); }
