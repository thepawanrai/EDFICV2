import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { scanMedicalContentCompliance } from '../services/compliance.ts';

const router = Router();

const cmsDraftSchema = z.object({
  slug: z.string().min(2).max(120),
  pageKey: z.string().min(2).max(60),
  title: z.string().min(3).max(180),
  contentMarkdown: z.string().min(10).max(20000),
});

const serviceManageSchema = z.object({
  name: z.string().min(2).max(160),
  categoryId: z.string().min(1),
  summary: z.string().min(5).max(500),
  clinicalDescription: z.string().min(5).max(3000),
  preparationNotes: z.string().min(2).max(1000),
  durationMinutes: z.coerce.number().int().min(10).max(120),
  requiresDoctorMorning: z.boolean().default(false),
  isVisiblePublic: z.boolean().default(true),
  advanceAmountInr: z.coerce.number().int().min(0).max(50000).default(500),
});

// List all CMS content items + compliance status
router.get(
  '/content',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (_req, res) => {
    const items = await prisma.cmsContentItem.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ items });
  }
);

router.post(
  '/content',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = cmsDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid slug, pageKey, title, and content are required.' });
      return;
    }

    const scan = scanMedicalContentCompliance(
      `${parsed.data.title}\n${parsed.data.contentMarkdown}`
    );

    const item = await prisma.cmsContentItem.upsert({
      where: { slug: parsed.data.slug.trim() },
      update: {
        pageKey: parsed.data.pageKey.trim(),
        title: parsed.data.title.trim(),
        contentMarkdown: parsed.data.contentMarkdown.trim(),
        status: 'DRAFT',
        checklistNoPrice: scan.checks.noPricingOrDiscounts,
        checklistNoSexDetermination: scan.checks.noSexDetermination,
        checklistNoGuarantee: scan.checks.noUnsupportedGuarantees,
        checklistNoFakeTestimonial: scan.checks.noPromotionalTestimonials,
        complianceIssues: scan.issues.join(' | ') || null,
      },
      create: {
        slug: parsed.data.slug.trim(),
        pageKey: parsed.data.pageKey.trim(),
        title: parsed.data.title.trim(),
        contentMarkdown: parsed.data.contentMarkdown.trim(),
        status: 'DRAFT',
        authorId: req.auth!.userId,
        checklistNoPrice: scan.checks.noPricingOrDiscounts,
        checklistNoSexDetermination: scan.checks.noSexDetermination,
        checklistNoGuarantee: scan.checks.noUnsupportedGuarantees,
        checklistNoFakeTestimonial: scan.checks.noPromotionalTestimonials,
        complianceIssues: scan.issues.join(' | ') || null,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CMS_DRAFT_SAVED',
      resourceType: 'CmsContentItem',
      resourceId: item.id,
      summary: `Saved CMS draft ${item.slug} (compliance passed: ${scan.passed})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ item, complianceScan: scan });
  }
);

// Medical Content Workflow: DRAFT -> MEDICAL_REVIEW -> COMPLIANCE_REVIEW -> FINAL_APPROVED -> PUBLISHED
router.post(
  '/content/:id/advance',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const item = await prisma.cmsContentItem.findUnique({ where: { id: req.params.id } });
    if (!item) {
      res.status(404).json({ error: 'CMS item not found.' });
      return;
    }

    const targetStage = String(req.body?.targetStage || '');
    const scan = scanMedicalContentCompliance(`${item.title}\n${item.contentMarkdown}`);
    if (!scan.passed) {
      res.status(422).json({
        error: 'Cannot advance content until NMC/PCPNDT compliance checks pass.',
        issues: scan.issues,
      });
      return;
    }

    if (targetStage === 'MEDICAL_REVIEW') {
      const updated = await prisma.cmsContentItem.update({
        where: { id: item.id },
        data: { status: 'MEDICAL_REVIEW' },
      });
      res.json({ item: updated });
      return;
    }

    if (targetStage === 'COMPLIANCE_REVIEW') {
      if (req.auth!.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Only Super Admin may complete Medical Review.' });
        return;
      }
      const updated = await prisma.cmsContentItem.update({
        where: { id: item.id },
        data: {
          status: 'COMPLIANCE_REVIEW',
          medicalReviewerName: req.auth!.fullName,
        },
      });
      res.json({ item: updated });
      return;
    }

    if (targetStage === 'FINAL_APPROVED' || targetStage === 'PUBLISHED') {
      if (req.auth!.role !== 'SUPER_ADMIN') {
        res.status(403).json({
          error: 'Final approval and publishing require Super Administrator authorization.',
        });
        return;
      }
      const updated = await prisma.cmsContentItem.update({
        where: { id: item.id },
        data: {
          status: targetStage,
          complianceReviewerName: item.complianceReviewerName || req.auth!.fullName,
          finalApproverName: req.auth!.fullName,
          publishedAt: targetStage === 'PUBLISHED' ? new Date() : item.publishedAt,
        },
      });
      await logAudit({
        actorUserId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: `CMS_${targetStage}`,
        resourceType: 'CmsContentItem',
        resourceId: updated.id,
        summary: `Moved CMS item ${updated.slug} to ${targetStage}`,
        ipAddress: req.ip,
      });
      res.json({ item: updated });
      return;
    }

    res.status(400).json({ error: 'Unsupported workflow transition stage.' });
  }
);

// Dynamic Service Catalogue management (public endpoints strip pricing)
router.get(
  '/services',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (_req, res) => {
    const categories = await prisma.serviceCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        services: { orderBy: { name: 'asc' } },
      },
    });
    res.json({ categories });
  }
);

router.post(
  '/services',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = serviceManageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid service details are required.' });
      return;
    }

    const scan = scanMedicalContentCompliance(
      `${parsed.data.name}\n${parsed.data.summary}\n${parsed.data.clinicalDescription}`
    );
    if (!scan.passed) {
      res.status(422).json({
        error: 'Service copy failed public medical ethics & pricing compliance check.',
        issues: scan.issues,
      });
      return;
    }

    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const code = `SVC-${Date.now().toString().slice(-5)}`;

    const service = await prisma.diagnosticService.create({
      data: {
        slug,
        code,
        ...parsed.data,
        approvalStatus: req.auth!.role === 'SUPER_ADMIN' ? 'PUBLISHED' : 'MEDICAL_REVIEW',
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'SERVICE_CREATED',
      resourceType: 'DiagnosticService',
      resourceId: service.id,
      summary: `Created diagnostic service ${service.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ service });
  }
);

router.patch(
  '/services/:id',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = serviceManageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid service update payload.' });
      return;
    }

    if (parsed.data.summary || parsed.data.clinicalDescription || parsed.data.name) {
      const scan = scanMedicalContentCompliance(
        `${parsed.data.name || ''}\n${parsed.data.summary || ''}\n${parsed.data.clinicalDescription || ''}`
      );
      if (!scan.passed) {
        res.status(422).json({
          error: 'Updated copy failed compliance scan.',
          issues: scan.issues,
        });
        return;
      }
    }

    const service = await prisma.diagnosticService.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'SERVICE_UPDATED',
      resourceType: 'DiagnosticService',
      resourceId: service.id,
      summary: `Updated diagnostic service ${service.name} (public visibility: ${service.isVisiblePublic})`,
      ipAddress: req.ip,
    });

    res.json({ service });
  }
);

const categoryManageSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(5).max(800),
  sortOrder: z.coerce.number().int().min(1).max(100).default(10),
  isVisible: z.boolean().default(true),
});

router.post(
  '/categories',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = categoryManageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid category name and description are required.' });
      return;
    }

    const scan = scanMedicalContentCompliance(
      `${parsed.data.name}\n${parsed.data.description}`
    );
    if (!scan.passed) {
      res.status(422).json({
        error: 'Category copy failed public medical ethics & pricing compliance check.',
        issues: scan.issues,
      });
      return;
    }

    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const category = await prisma.serviceCategory.create({
      data: {
        slug,
        name: parsed.data.name.trim(),
        description: parsed.data.description.trim(),
        sortOrder: parsed.data.sortOrder,
        isVisible: parsed.data.isVisible,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CATEGORY_CREATED',
      resourceType: 'ServiceCategory',
      resourceId: category.id,
      summary: `Created service category ${category.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ category });
  }
);

router.patch(
  '/categories/:id',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = categoryManageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid category update payload.' });
      return;
    }

    if (parsed.data.name || parsed.data.description) {
      const scan = scanMedicalContentCompliance(
        `${parsed.data.name || ''}\n${parsed.data.description || ''}`
      );
      if (!scan.passed) {
        res.status(422).json({
          error: 'Updated category copy failed compliance scan.',
          issues: scan.issues,
        });
        return;
      }
    }

    const category = await prisma.serviceCategory.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CATEGORY_UPDATED',
      resourceType: 'ServiceCategory',
      resourceId: category.id,
      summary: `Updated service category ${category.name} (visible: ${category.isVisible})`,
      ipAddress: req.ip,
    });

    res.json({ category });
  }
);

export default router;
