import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import {
  dispatchDailyReceptionSummary,
  triggerUpcomingAppointmentReminders,
} from '../services/automation.ts';

const router = Router();

function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

async function requireN8nAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
    select: { n8nWebhookSecret: true, n8nApiKey: true },
  });

  const secret = settings?.n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || '';
  const apiKey = settings?.n8nApiKey || process.env.N8N_API_KEY || '';

  const providedSig = String(req.headers['x-edfic-signature'] || '');
  const providedKey = String(req.headers['x-n8n-api-key'] || '');

  if (apiKey && safeTimingCompare(providedKey, apiKey)) {
    next();
    return;
  }

  if (secret && providedSig) {
    const rawBody = JSON.stringify(req.body ?? {});
    const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (safeTimingCompare(providedSig, expectedSig)) {
      next();
      return;
    }
  }

  res.status(401).json({
    error: 'Unauthorized n8n integration request. Valid X-EDFIC-Signature or X-N8N-API-KEY required.',
  });
}

// Inbound authenticated trigger for n8n scheduled upcoming appointment reminders
router.post('/n8n/trigger-reminders', requireN8nAuth, async (req, res) => {
  const rawDate = req.body?.targetDate ?? req.body?.date;
  const targetDate =
    typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : undefined;

  const result = await triggerUpcomingAppointmentReminders({
    targetDate,
    actorRole: 'N8N_WORKFLOW',
  });
  res.json(result);
});

// Inbound authenticated trigger for n8n scheduled daily reception summary
router.post('/n8n/trigger-daily-summary', requireN8nAuth, async (req, res) => {
  const date =
    typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
      ? req.body.date
      : undefined;

  const result = await dispatchDailyReceptionSummary({
    date,
    actorRole: 'N8N_WORKFLOW',
  });
  res.json(result);
});

const executionCallbackSchema = z.object({
  eventId: z.string().min(3),
  executionId: z.string().min(1).max(120).optional(),
  status: z.enum(['SENT', 'DELIVERED', 'FAILED']),
  errorMessage: z.string().max(400).optional(),
});

// Inbound n8n execution status callback
router.post('/n8n/execution-callback', requireN8nAuth, async (req, res) => {
  const parsed = executionCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid execution callback payload.' });
    return;
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId: parsed.data.eventId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Webhook event not found.' });
    return;
  }

  const updated = await prisma.webhookEvent.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status === 'DELIVERED' ? 'SENT' : parsed.data.status,
      ...(parsed.data.executionId ? { executionId: parsed.data.executionId } : {}),
      ...(parsed.data.errorMessage ? { lastError: parsed.data.errorMessage } : {}),
    },
  });

  await logAudit({
    actorRole: 'N8N_WORKFLOW',
    action: 'N8N_EXECUTION_CALLBACK',
    resourceType: 'WebhookEvent',
    resourceId: updated.id,
    summary: `n8n reported ${parsed.data.status} for ${updated.eventId}`,
    ipAddress: req.ip,
  });

  res.json({ ok: true, eventId: updated.eventId, status: updated.status });
});

// WhatsApp Business API webhook challenge verification (GET)
router.get('/whatsapp/webhook', async (req, res) => {
  const mode = String(req.query['hub.mode'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');

  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
    select: { whatsappWebhookSecret: true },
  });
  const verifyToken =
    settings?.whatsappWebhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET || '';

  if (mode === 'subscribe' && verifyToken && safeTimingCompare(token, verifyToken)) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: 'WhatsApp webhook verification failed.' });
});

const whatsappStatusSchema = z.object({
  externalMessageId: z.string().min(1),
  status: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED']),
  errorMessage: z.string().max(400).optional(),
});

// WhatsApp provider delivery status callback (POST)
router.post('/whatsapp/webhook', async (req, res) => {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
    select: { whatsappWebhookSecret: true },
  });
  const secret = settings?.whatsappWebhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET || '';

  const providedSecret = String(req.headers['x-whatsapp-webhook-secret'] || '');
  const hubSig = String(req.headers['x-hub-signature-256'] || '');

  let authorized = false;
  if (secret && safeTimingCompare(providedSecret, secret)) {
    authorized = true;
  } else if (secret && hubSig.startsWith('sha256=')) {
    const rawBody = JSON.stringify(req.body ?? {});
    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    authorized = safeTimingCompare(hubSig, expected);
  }

  if (!authorized) {
    res.status(401).json({ error: 'Unauthorized WhatsApp webhook callback.' });
    return;
  }

  // Support both simple adapter status JSON and Meta Cloud nested statuses array
  let parsedStatus: {
    externalMessageId: string;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    errorMessage?: string;
  } | null = null;

  const direct = whatsappStatusSchema.safeParse(req.body);
  if (direct.success) {
    parsedStatus = direct.data;
  } else {
    const metaStatus = (
      req.body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0] ?? null
    ) as { id?: string; status?: string; errors?: Array<{ title?: string }> } | null;
    if (metaStatus?.id && metaStatus?.status) {
      const upper = metaStatus.status.toUpperCase();
      if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(upper)) {
        parsedStatus = {
          externalMessageId: metaStatus.id,
          status: upper as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
          errorMessage: metaStatus.errors?.[0]?.title,
        };
      }
    }
  }

  if (!parsedStatus) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const log = await prisma.whatsAppMessageLog.findFirst({
    where: { externalMessageId: parsedStatus.externalMessageId },
  });

  if (!log) {
    res.status(404).json({ error: 'Matching WhatsApp log entry not found.' });
    return;
  }

  const updated = await prisma.whatsAppMessageLog.update({
    where: { id: log.id },
    data: {
      status: parsedStatus.status,
      webhookVerified: true,
      ...(parsedStatus.status === 'DELIVERED' || parsedStatus.status === 'READ'
        ? { deliveredAt: log.deliveredAt ?? new Date() }
        : {}),
      ...(parsedStatus.errorMessage ? { errorMessage: parsedStatus.errorMessage } : {}),
    },
  });

  await logAudit({
    actorRole: 'WHATSAPP_WEBHOOK',
    action: 'WHATSAPP_DELIVERY_STATUS_UPDATED',
    resourceType: 'WhatsAppMessageLog',
    resourceId: updated.id,
    summary: `WhatsApp message ${parsedStatus.externalMessageId} marked ${parsedStatus.status}`,
    ipAddress: req.ip,
  });

  res.json({ ok: true, logId: updated.id, status: updated.status });
});

export default router;
