import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import { dispatchN8nEvent, dispatchWhatsAppMessage } from '../services/automation.ts';

const router = Router();

const inquirySchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  interestedService: z.string().max(160).optional(),
  message: z.string().min(5).max(1500),
});

router.get('/clinic', async (_req, res) => {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
    select: {
      clinicName: true,
      fullName: true,
      parentUnitName: true,
      tagline: true,
      addressLine: true,
      landmark: true,
      cityStateCountry: true,
      primaryPhone: true,
      secondaryPhone: true,
      whatsappNumber: true,
      officialEmail: true,
      weekdayHours: true,
      sundayHours: true,
      morningSessionStart: true,
      morningSessionEnd: true,
    },
  });

  res.json({
    clinic: settings,
    doctor: {
      name: 'Dr. Varun Agrawal',
      qualification: 'DNB Radiology',
      designation: 'Consultant Radiologist & Fetal Medicine Specialist',
      expertise: [
        'NT Scan',
        'Anomaly Scan',
        'Growth Scan',
        'Doppler',
        'Fetal Echo',
        'BPP',
      ],
      availability: 'Morning session, daily',
    },
  });
});

router.get('/maps-config', (_req, res) => {
  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';
  res.json({ apiKey });
});

// STRICT COMPLIANCE: Never return pricing fields (advanceAmountInr / internalBaseFeeInr) on public service catalogue endpoints
router.get('/services', async (_req, res) => {
  const categories = await prisma.serviceCategory.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
      services: {
        where: {
          isVisiblePublic: true,
          approvalStatus: 'PUBLISHED',
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          slug: true,
          code: true,
          name: true,
          categoryId: true,
          summary: true,
          clinicalDescription: true,
          preparationNotes: true,
          durationMinutes: true,
          requiresDoctorMorning: true,
        },
      },
    },
  });

  res.json({ categories });
});

router.get('/services/:slug', async (req, res) => {
  const service = await prisma.diagnosticService.findFirst({
    where: {
      slug: req.params.slug,
      isVisiblePublic: true,
      approvalStatus: 'PUBLISHED',
      category: { isVisible: true },
    },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      summary: true,
      clinicalDescription: true,
      preparationNotes: true,
      durationMinutes: true,
      requiresDoctorMorning: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  if (!service) {
    res.status(404).json({ error: 'Diagnostic service not found.' });
    return;
  }

  res.json({ service });
});

router.get('/cms/:pageKey', async (req, res) => {
  const items = await prisma.cmsContentItem.findMany({
    where: {
      pageKey: req.params.pageKey,
      status: 'PUBLISHED',
    },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      pageKey: true,
      title: true,
      contentMarkdown: true,
      medicalReviewerName: true,
      publishedAt: true,
    },
  });
  res.json({ items });
});

router.post('/inquiries', async (req, res) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Please enter your name, a valid 10-digit phone number, and your inquiry message.',
    });
    return;
  }

  const leadCode = `CRM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const lead = await prisma.crmLead.create({
    data: {
      leadCode,
      fullName: parsed.data.fullName.trim(),
      phone: parsed.data.phone.trim(),
      email: parsed.data.email?.trim() || null,
      source: 'WEBSITE_CONTACT',
      interestedService: parsed.data.interestedService?.trim() || null,
      message: parsed.data.message.trim(),
      status: 'NEW',
    },
  });

  await logAudit({
    action: 'PUBLIC_INQUIRY_SUBMITTED',
    resourceType: 'CrmLead',
    resourceId: lead.id,
    summary: `Website inquiry ${lead.leadCode} submitted by ${lead.fullName}`,
    ipAddress: req.ip,
  });

  await dispatchN8nEvent({
    eventId: `crm-inquiry-${lead.id}`,
    eventType: 'crm.inquiry_created',
    payload: {
      leadCode: lead.leadCode,
      fullName: lead.fullName,
      source: lead.source,
      interestedService: lead.interestedService,
      phone: lead.phone,
    },
  });

  await dispatchWhatsAppMessage({
    eventId: `wa-inquiry-${lead.id}`,
    recipientPhone: lead.phone,
    templateKey: 'INQUIRY_ACKNOWLEDGMENT',
    messageBody: `EDFIC (A Unit of EWA DERMA): Thank you for contacting EWA Diagnostic & Fetal Imaging Centre, Lucknow. Your inquiry reference ${lead.leadCode} has been received and our reception team will respond shortly.`,
  });

  res.status(201).json({
    leadCode: lead.leadCode,
    message: 'Your inquiry has been registered with EDFIC Reception.',
  });
});

const quickAppointmentSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter patient full name').max(120),
  phone: z
    .string()
    .trim()
    .refine((val) => val.replace(/\D/g, '').length >= 10 && val.length <= 16, {
      message: 'Please enter a valid 10-digit mobile number',
    }),
  preferredService: z.string().trim().max(160).optional(),
  preferredDate: z.string().trim().max(32).optional(),
  preferredWindow: z
    .enum(['MORNING', 'AFTERNOON_EVENING', 'EARLIEST_AVAILABLE'])
    .optional(),
  notes: z.string().trim().max(600).optional(),
});

router.post('/quick-appointment', async (req, res) => {
  const parsed = quickAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    res.status(400).json({
      error:
        firstIssue ||
        'Please enter your full name and a valid 10-digit mobile number.',
    });
    return;
  }

  const {
    fullName,
    phone,
    preferredService,
    preferredDate,
    preferredWindow = 'EARLIEST_AVAILABLE',
    notes,
  } = parsed.data;

  const windowLabel =
    preferredWindow === 'MORNING'
      ? 'Morning Specialist Window (9:30 AM - 1:30 PM)'
      : preferredWindow === 'AFTERNOON_EVENING'
        ? 'Afternoon / Evening (2:00 PM - 8:00 PM)'
        : 'Earliest Available Slot';

  const summaryParts = [
    '[Quick Appointment Request]',
    preferredDate ? `Preferred Date: ${preferredDate}` : 'Preferred Date: Flexible',
    `Session: ${windowLabel}`,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean);

  const leadCode = `QCK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const dueAt = new Date(Date.now() + 60 * 60 * 1000);

  const lead = await prisma.crmLead.create({
    data: {
      leadCode,
      fullName,
      phone,
      source: 'BOOKING_INQUIRY',
      interestedService: preferredService || 'General Diagnostic / Consultation',
      message: summaryParts.join(' | '),
      followUpDueAt: dueAt,
      status: 'NEW',
    },
  });

  await prisma.crmTask.create({
    data: {
      leadId: lead.id,
      title: `Quick Appointment callback: ${lead.fullName} (${leadCode})`,
      dueAt,
    },
  });

  await logAudit({
    action: 'PUBLIC_QUICK_APPOINTMENT_REQUESTED',
    resourceType: 'CrmLead',
    resourceId: lead.id,
    summary: `Quick appointment request ${lead.leadCode} logged for ${lead.fullName}`,
    ipAddress: req.ip,
  });

  await dispatchN8nEvent({
    eventId: `crm-quick-${lead.id}`,
    eventType: 'crm.inquiry_created',
    payload: {
      leadCode: lead.leadCode,
      fullName: lead.fullName,
      phone: lead.phone,
      source: 'QUICK_APPOINTMENT',
      preferredService: lead.interestedService,
      preferredDate: preferredDate || null,
      preferredWindow,
    },
  });

  await dispatchWhatsAppMessage({
    eventId: `wa-quick-${lead.id}`,
    recipientPhone: lead.phone,
    templateKey: 'INQUIRY_ACKNOWLEDGMENT',
    messageBody: `EDFIC (A Unit of EWA DERMA): Your Quick Appointment request (${lead.leadCode}) for ${lead.interestedService} has been received. EDFIC Reception will call you shortly to confirm your slot.`,
  });

  res.status(201).json({
    leadCode: lead.leadCode,
    preferredService: lead.interestedService,
    windowLabel,
    preferredDate: preferredDate || 'Flexible',
    message:
      'Your Quick Appointment request has been received. EDFIC Reception will call you shortly to confirm your slot.',
  });
});

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  action: z.enum(['ASK', 'SUBMIT_TO_RECEPTION']).optional(),
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional().or(z.literal('')),
  interestedService: z.string().max(160).optional(),
});

router.post('/chat', async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please enter a valid message or contact inquiry.' });
    return;
  }

  const { action, message, fullName, phone, email, interestedService } = parsed.data;

  // 1. Direct Handoff to Reception CRM Management System
  if (action === 'SUBMIT_TO_RECEPTION') {
    if (!fullName || !phone || phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({
        error: 'Please provide your full name and a valid 10-digit mobile number for reception follow-up.',
      });
      return;
    }

    const leadCode = `CRM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const lead = await prisma.crmLead.create({
      data: {
        leadCode,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        source: 'WEBSITE_CONTACT',
        interestedService: interestedService?.trim() || null,
        message: `[Reception Chatbot] ${message.trim()}`,
        status: 'NEW',
      },
    });

    await prisma.crmTask.create({
      data: {
        leadId: lead.id,
        title: `Follow up chatbot inquiry ${leadCode} (${lead.fullName})`,
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    await logAudit({
      action: 'PUBLIC_CHATBOT_INQUIRY_SUBMITTED',
      resourceType: 'CrmLead',
      resourceId: lead.id,
      summary: `Chatbot handoff ${lead.leadCode} logged for ${lead.fullName}`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `crm-chatbot-${lead.id}`,
      eventType: 'crm.inquiry_created',
      payload: {
        leadCode: lead.leadCode,
        fullName: lead.fullName,
        source: 'RECEPTION_CHATBOT',
        interestedService: lead.interestedService,
        phone: lead.phone,
      },
    });

    await dispatchWhatsAppMessage({
      eventId: `wa-chatbot-${lead.id}`,
      recipientPhone: lead.phone,
      templateKey: 'INQUIRY_ACKNOWLEDGMENT',
      messageBody: `EDFIC (A Unit of EWA DERMA): Your chat inquiry (${lead.leadCode}) has been forwarded to EDFIC Reception at Sushant Golf City, Lucknow. Our team will contact you shortly.`,
    });

    res.status(201).json({
      handoffComplete: true,
      leadCode: lead.leadCode,
      reply: `Thank you, ${lead.fullName}. Your query has been logged directly with EDFIC Reception under reference ${lead.leadCode}. A follow-up task has been queued for our reception team.`,
      suggestedRoute: { label: 'Book Appointment Slot', to: '/book' },
    });
    return;
  }

  // 2. Automated Non-Diagnostic EDFIC Reception Q&A
  const q = message.trim();
  const lower = q.toLowerCase();

  const [clinic, services] = await Promise.all([
    prisma.clinicSetting.findUnique({ where: { id: 'singleton' } }),
    prisma.diagnosticService.findMany({
      where: { isVisiblePublic: true, approvalStatus: 'PUBLISHED', category: { isVisible: true } },
      select: {
        slug: true,
        name: true,
        summary: true,
        preparationNotes: true,
        durationMinutes: true,
        requiresDoctorMorning: true,
      },
    }),
  ]);

  // Booking reference non-PHI lookup (EDF-XXXXXX)
  const bookingRefMatch = q.toUpperCase().match(/\bEDF-[A-Z0-9-]{4,}\b/);
  if (bookingRefMatch) {
    const appt = await prisma.appointment.findUnique({
      where: { bookingReference: bookingRefMatch[0] },
      select: {
        bookingReference: true,
        status: true,
        appointmentDate: true,
        startTime: true,
        service: { select: { name: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    });

    if (!appt) {
      res.json({
        reply: `No booking was found matching reference ${bookingRefMatch[0]}. Please verify the reference code or send your mobile number to EDFIC Reception for assistance.`,
        promptReceptionHandoff: true,
        suggestedRoute: { label: 'Book Appointment', to: '/book' },
      });
      return;
    }

    const latestPaymentStatus = appt.payments[0]?.status?.replace(/_/g, ' ') || 'PENDING';
    res.json({
      reply: `Booking ${appt.bookingReference} (${appt.service.name}) is scheduled for ${appt.appointmentDate} at ${appt.startTime}. Appointment status: ${appt.status.replace(/_/g, ' ')}. UPI verification status: ${latestPaymentStatus}.`,
      suggestedRoute: { label: 'Track / Manage in Portal', to: '/portal' },
    });
    return;
  }

  // Location / Address queries
  if (/\b(address|where|location|directions|map|lulu|sushant|lucknow|reach)\b/.test(lower)) {
    res.json({
      reply: `EDFIC (A Unit of EWA DERMA) is located at ${clinic?.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'} (${clinic?.landmark || 'Near Lulu Mall'}), ${clinic?.cityStateCountry || 'Lucknow, Uttar Pradesh, India'}.`,
      suggestedRoute: { label: 'View Contact & Directions', to: '/contact' },
    });
    return;
  }

  // Hours / Doctor Session queries
  if (/\b(time|timing|hours|open|close|sunday|varun|doctor|morning|schedule|when)\b/.test(lower)) {
    res.json({
      reply: `Operating hours: ${clinic?.weekdayHours || 'Monday–Saturday: 9:00 AM – 8:00 PM'}, ${clinic?.sundayHours || 'Sunday: 10:00 AM – 2:00 PM (By Appointment)'}. Specialist fetal imaging sessions led by Dr. Varun Agrawal (DNB Radiology) run daily during the morning session (${clinic?.morningSessionStart || '09:30'}–${clinic?.morningSessionEnd || '13:30'}).`,
      suggestedRoute: { label: 'View Doctor & Slots', to: '/doctor' },
    });
    return;
  }

  // Appointment / UPI Booking flow
  if (/\b(book|appointment|slot|upi|utr|advance|reschedule|cancel)\b/.test(lower)) {
    res.json({
      reply: 'To book an ultrasound or fetal scan, select your service and preferred time slot on our Book Appointment page, complete the UPI advance transfer, and enter your UTR reference. EDFIC reception manually verifies payments before final confirmation.',
      suggestedRoute: { label: 'Book Appointment Now', to: '/book' },
    });
    return;
  }

  // Report PDF / Portal queries
  if (/\b(report|pdf|result|download|portal)\b/.test(lower)) {
    res.json({
      reply: 'For medical privacy, finalized ultrasound and Doppler PDFs are published strictly inside your authenticated EDFIC Patient Portal account - never sent through unsecured public links.',
      suggestedRoute: { label: 'Open Patient Portal', to: '/portal' },
    });
    return;
  }

  // PCPNDT / Sex Determination / Statutory rules
  if (/\b(pcpndt|sex|gender|boy|girl|id|aadhaar|prescription|document|form\s*f)\b/.test(lower)) {
    res.json({
      reply: 'EDFIC strictly follows the PCPNDT Act: prenatal sex determination is prohibited by law. For obstetric scans, patients must bring a valid government photo ID, referring clinician prescription, and prior reports for mandatory Form F compliance.',
      suggestedRoute: { label: 'Read Patient Guidelines', to: '/patient-info' },
    });
    return;
  }

  // Non-public pricing / fee queries -> route cleanly to Reception
  if (/\b(price|cost|fee|fees|rate|charges|discount|how much|rupees|rs)\b/.test(lower)) {
    res.json({
      reply: 'Investigation charges vary by prescribed study and are shared directly by our reception desk rather than posted as promotional pricing online. Would you like me to forward your inquiry to EDFIC Reception for exact details?',
      promptReceptionHandoff: true,
    });
    return;
  }

  // Service catalogue keyword match
  const matchedService = services.find((svc) => {
    const svcLower = svc.name.toLowerCase();
    if (lower.includes(svcLower)) return true;
    const tokens = svcLower.split(/[\s/(),-]+/).filter((t) => t.length >= 4);
    return tokens.some((token) => lower.includes(token));
  });

  if (matchedService) {
    res.json({
      reply: `${matchedService.name} (~${matchedService.durationMinutes} mins${matchedService.requiresDoctorMorning ? ', morning specialist window' : ''}): ${matchedService.summary} Preparation: ${matchedService.preparationNotes}`,
      suggestedRoute: { label: `View ${matchedService.name}`, to: `/services/${matchedService.slug}` },
    });
    return;
  }

  // Preparation general keywords
  if (/\b(prep|preparation|fasting|bladder|water|drink|eat|before)\b/.test(lower)) {
    res.json({
      reply: 'Preparation depends on your prescribed scan: Whole Abdomen & Renal Doppler require 6–8 hours fasting, while KUB & early pelvic scans require a comfortably full bladder. You can also send your prescribed scan name directly to reception below.',
      promptReceptionHandoff: true,
      suggestedRoute: { label: 'Full Preparation Checklist', to: '/patient-info' },
    });
    return;
  }

  // General helpful response + offer Reception CRM escalation
  res.json({
    reply:
      'I can help with EDFIC timings, Sushant Golf City directions, ultrasound preparation, booking steps, Patient Portal reports, or check a booking code (e.g. EDF-...). You can also send your question directly to our Reception Desk right here.',
    promptReceptionHandoff: true,
  });
});

export default router;
