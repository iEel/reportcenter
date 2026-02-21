import { ConfidentialClientApplication } from '@azure/msal-node';
import nodemailer from 'nodemailer';

/**
 * Create email transporter with OAuth2 or fallback to password auth.
 * OAuth2 uses Microsoft Graph SMTP with XOAUTH2.
 */
export async function createMailTransporter() {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const smtpUser = process.env.SMTP_USER;

    // Try OAuth2 first
    if (tenantId && clientId && clientSecret && smtpUser) {
        try {
            const cca = new ConfidentialClientApplication({
                auth: {
                    clientId,
                    clientSecret,
                    authority: `https://login.microsoftonline.com/${tenantId}`,
                },
            });

            const tokenResponse = await cca.acquireTokenByClientCredential({
                scopes: ['https://outlook.office365.com/.default'],
            });

            if (tokenResponse?.accessToken) {
                console.log('[Email] Using OAuth2 XOAUTH2 transport');
                return nodemailer.createTransport({
                    host: 'smtp.office365.com',
                    port: 587,
                    secure: false,
                    auth: {
                        type: 'OAuth2',
                        user: smtpUser,
                        accessToken: tokenResponse.accessToken,
                    },
                });
            }
        } catch (err) {
            console.warn('[Email] OAuth2 token failed, falling back to password:', err.message);
        }
    }

    // Fallback to password auth
    console.log('[Email] Using password auth transport');
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: smtpUser,
            pass: process.env.SMTP_PASS,
        },
    });
}
