import { ConfidentialClientApplication } from '@azure/msal-node';
import nodemailer from 'nodemailer';

let msalClient = null;

function getMsalClient() {
    if (msalClient) return msalClient;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return null;

    msalClient = new ConfidentialClientApplication({
        auth: { clientId, clientSecret, authority: `https://login.microsoftonline.com/${tenantId}` },
    });
    return msalClient;
}

/**
 * Send email via Microsoft Graph API (OAuth2) or fallback to SMTP password.
 * 
 * @param {object} options - { from, to, cc, subject, html, text, attachments }
 *   attachments: [{ filename, content (Buffer), contentType }]
 */
export async function sendMail(options) {
    const smtpUser = process.env.SMTP_USER;
    const cca = getMsalClient();

    // Try Microsoft Graph API first
    if (cca && smtpUser) {
        try {
            const tokenRes = await cca.acquireTokenByClientCredential({
                scopes: ['https://graph.microsoft.com/.default'],
            });

            if (tokenRes?.accessToken) {
                console.log('[Email] Sending via Microsoft Graph API');

                // Build Graph API message
                const toRecipients = (options.to || '').split(/[,;]/).filter(Boolean).map(e => ({
                    emailAddress: { address: e.trim() }
                }));
                const ccRecipients = options.cc
                    ? options.cc.split(/[,;]/).filter(Boolean).map(e => ({ emailAddress: { address: e.trim() } }))
                    : [];

                const message = {
                    subject: options.subject,
                    body: {
                        contentType: options.html ? 'HTML' : 'Text',
                        content: options.html || options.text || '',
                    },
                    toRecipients,
                    ccRecipients,
                };

                // Add attachments
                if (options.attachments && options.attachments.length > 0) {
                    message.attachments = options.attachments.map(att => ({
                        '@odata.type': '#microsoft.graph.fileAttachment',
                        name: att.filename,
                        contentType: att.contentType || 'application/octet-stream',
                        contentBytes: Buffer.isBuffer(att.content)
                            ? att.content.toString('base64')
                            : att.content,
                    }));
                }

                const res = await fetch(
                    `https://graph.microsoft.com/v1.0/users/${smtpUser}/sendMail`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${tokenRes.accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ message, saveToSentItems: false }),
                    }
                );

                if (res.ok || res.status === 202) {
                    console.log('[Email] Sent successfully via Graph API');
                    return { success: true, method: 'graph' };
                }

                const errText = await res.text();
                console.warn('[Email] Graph API error:', res.status, errText);
                throw new Error(`Graph API ${res.status}: ${errText}`);
            }
        } catch (err) {
            console.warn('[Email] Graph API failed, falling back to SMTP password:', err.message);
        }
    }

    // Fallback to SMTP password auth
    console.log('[Email] Sending via SMTP password auth');
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: { user: smtpUser, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
        from: options.from || process.env.SMTP_FROM || smtpUser,
        to: options.to,
        cc: options.cc || undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
    });

    return { success: true, method: 'smtp' };
}

/**
 * @deprecated Use sendMail() directly instead.
 * Kept for backward compatibility — returns a nodemailer-like transporter.
 */
export async function createMailTransporter() {
    console.log('[Email] Using SMTP password transport (legacy)');
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
}
