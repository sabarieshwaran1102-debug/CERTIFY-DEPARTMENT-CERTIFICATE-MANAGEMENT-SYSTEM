/**
 * Email notification service.
 * Failure is non-fatal — errors are logged but never propagate to callers.
 *
 * Configuration (all optional — email is silently disabled when not set):
 *   EMAIL_HOST        SMTP host (e.g. smtp.example.com)
 *   EMAIL_PORT        SMTP port (default 587)
 *   EMAIL_SECURE      'true' for TLS on port 465 (default false)
 *   EMAIL_USER        SMTP username
 *   EMAIL_PASS        SMTP password
 *   EMAIL_FROM        Sender address (default: noreply@certify.local)
 *   EMAIL_ENABLED     'true' to enable sending (default false in non-production)
 */
import nodemailer from 'nodemailer';

const isEnabled = () => {
    if (process.env.NODE_ENV === 'test') return false;
    if (process.env.EMAIL_ENABLED === 'true') return true;
    if (process.env.NODE_ENV === 'production') return !!process.env.EMAIL_HOST;
    return false;
};

let _transporter = null;

function getTransporter() {
    if (!isEnabled()) return null;
    if (!_transporter) {
        _transporter = nodemailer.createTransport({
            host:   process.env.EMAIL_HOST,
            port:   parseInt(process.env.EMAIL_PORT || '587', 10),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return _transporter;
}

const FROM = process.env.EMAIL_FROM || 'CERTIFY <noreply@certify.local>';

async function sendMail({ to, subject, text, html }) {
    if (!to) return;
    const transporter = getTransporter();
    if (!transporter) return; // email disabled
    try {
        await transporter.sendMail({ from: FROM, to, subject, text, html });
    } catch (err) {
        // Log but never throw — email failure must not break the main transaction
        console.error('[emailService] send failed:', err.message);
    }
}

// ── Certificate event helpers ─────────────────────────────────────────────────

export async function notifyCertificateSubmitted({ studentEmail, studentName, odNumber, eventName, isLate }) {
    if (!studentEmail) return;
    const subject = isLate
        ? `[CERTIFY] Late certificate submitted — ${odNumber}`
        : `[CERTIFY] Certificate submitted — ${odNumber}`;
    const text = isLate
        ? `Hello ${studentName},\n\nYour late certificate for OD ${odNumber} (${eventName}) has been submitted and is awaiting late-submission approval.\n\nRegards,\nCERTIFY System`
        : `Hello ${studentName},\n\nYour certificate for OD ${odNumber} (${eventName}) has been submitted successfully and is pending review.\n\nRegards,\nCERTIFY System`;
    await sendMail({ to: studentEmail, subject, text });
}

export async function notifyCertificateVerified({ studentEmail, studentName, odNumber, eventName }) {
    if (!studentEmail) return;
    await sendMail({
        to: studentEmail,
        subject: `[CERTIFY] Certificate verified — ${odNumber}`,
        text: `Hello ${studentName},\n\nYour certificate for OD ${odNumber} (${eventName}) has been verified.\n\nRegards,\nCERTIFY System`,
    });
}

export async function notifyCertificateRejected({ studentEmail, studentName, odNumber, eventName, reason }) {
    if (!studentEmail) return;
    await sendMail({
        to: studentEmail,
        subject: `[CERTIFY] Certificate rejected — ${odNumber}`,
        text: `Hello ${studentName},\n\nYour certificate for OD ${odNumber} (${eventName}) has been rejected.\n\nReason: ${reason || 'No reason provided'}\n\nPlease re-upload a corrected certificate.\n\nRegards,\nCERTIFY System`,
    });
}

export async function notifyLateSubmitted({ reviewerEmail, reviewerName, studentName, odNumber, eventName, lateReason }) {
    if (!reviewerEmail) return;
    await sendMail({
        to: reviewerEmail,
        subject: `[CERTIFY] Late certificate pending approval — ${odNumber}`,
        text: `Hello ${reviewerName},\n\nStudent ${studentName} has submitted a late certificate for OD ${odNumber} (${eventName}).\n\nReason provided: ${lateReason || 'None'}\n\nPlease log in to review and approve or reject the late submission.\n\nRegards,\nCERTIFY System`,
    });
}

export async function notifyLateApproved({ studentEmail, studentName, odNumber, eventName }) {
    if (!studentEmail) return;
    await sendMail({
        to: studentEmail,
        subject: `[CERTIFY] Late certificate approved — ${odNumber}`,
        text: `Hello ${studentName},\n\nYour late certificate for OD ${odNumber} (${eventName}) has been approved. Your certificate is now pending final verification.\n\nRegards,\nCERTIFY System`,
    });
}

export async function notifyLateRejected({ studentEmail, studentName, odNumber, eventName, reason }) {
    if (!studentEmail) return;
    await sendMail({
        to: studentEmail,
        subject: `[CERTIFY] Late certificate rejected — ${odNumber}`,
        text: `Hello ${studentName},\n\nYour late certificate submission for OD ${odNumber} (${eventName}) has been rejected.\n\nReason: ${reason || 'No reason provided'}\n\nRegards,\nCERTIFY System`,
    });
}

export async function notifyOverdue({ studentEmail, studentName, odNumber, eventName, deadline }) {
    if (!studentEmail) return;
    await sendMail({
        to: studentEmail,
        subject: `[CERTIFY] Certificate overdue — ${odNumber}`,
        text: `Hello ${studentName},\n\nYour certificate for OD ${odNumber} (${eventName}) was due by ${deadline} and is now marked as overdue.\n\nPlease contact your class advisor immediately.\n\nRegards,\nCERTIFY System`,
    });
}
