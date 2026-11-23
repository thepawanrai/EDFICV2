// server.ts
import "dotenv/config";
import fs4 from "node:fs";
import path5 from "node:path";

// server/lib/expressAsyncPatch.ts
import { createRequire } from "node:module";
var require2 = createRequire(import.meta.url);
try {
  const Layer = require2("express/lib/router/layer");
  Layer.prototype.handle_request = function handleRequestAsync(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) {
      return next();
    }
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === "function") {
        result.catch(next);
      }
      return result;
    } catch (err) {
      return next(err);
    }
  };
} catch {
}

// server/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs3 from "node:fs";
import path4 from "node:path";

// server/lib/prisma.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}
var prisma = global.__edficPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  global.__edficPrisma = prisma;
}
async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// server/lib/security.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
function resolveRuntimeSecret(envName, devFallback) {
  const configured = process.env[envName]?.trim();
  if (configured && !configured.startsWith("CHANGE_ME_")) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      `[SECURITY WARNING] ${envName} is unset or placeholder in production; using ephemeral runtime key.`
    );
    return crypto.randomBytes(32).toString("hex");
  }
  return devFallback;
}
var JWT_SECRET = resolveRuntimeSecret(
  "JWT_SECRET",
  "edfic-dev-jwt-secret-change-in-production-32chars"
);
var CSRF_SECRET = resolveRuntimeSecret(
  "CSRF_SECRET",
  "edfic-dev-csrf-secret-change-in-production-32chars"
);
var AUTH_COOKIE_NAME = "edfic_session";
var CSRF_COOKIE_NAME = "edfic_csrf";
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
function signSessionToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}
function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function isHttpsRequest(req) {
  if (!req) return process.env.NODE_ENV === "production";
  if (req.secure) return true;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  if (forwardedProto === "https") return true;
  const origin = String(req.headers.origin || "");
  if (origin.startsWith("https://")) return true;
  const referer = String(req.headers.referer || "");
  if (referer.startsWith("https://")) return true;
  const xfh = String(req.headers["x-forwarded-host"] || "");
  if (xfh.endsWith(".run.app")) return true;
  return false;
}
function getCookieOptions(req, httpOnly) {
  const isHttps = isHttpsRequest(req);
  return {
    httpOnly,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    maxAge: 12 * 60 * 60 * 1e3,
    path: "/"
  };
}
function setAuthCookies(res, payload, req) {
  const token = signSessionToken(payload);
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions(req, true));
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions(req, false));
  return csrfToken;
}
function clearAuthCookies(res, req) {
  const opts = getCookieOptions(req, true);
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: "/",
    sameSite: opts.sameSite,
    secure: opts.secure
  });
}
function generateCsrfToken() {
  const nonce = crypto.randomBytes(24).toString("hex");
  const sig = crypto.createHmac("sha256", CSRF_SECRET).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}
function verifyCsrfTokenValue(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [nonce, sig] = parts;
  if (!nonce || !sig) return false;
  const expected = crypto.createHmac("sha256", CSRF_SECRET).update(nonce).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function isSameOriginBrowserRequest(req) {
  const originHeader = req.headers.origin;
  if (typeof originHeader !== "string") return false;
  let originHost = "";
  try {
    originHost = new URL(originHeader).host.toLowerCase();
  } catch {
    return false;
  }
  const rawXfh = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase();
  const rawHost = String(req.get("host") || "").trim().toLowerCase();
  return Boolean(
    rawXfh && originHost === rawXfh || rawHost && originHost === rawHost
  );
}
function csrfProtection(req, res, next) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }
  if (req.path.startsWith("/hermes") || req.path.startsWith("/integrations")) {
    next();
    return;
  }
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers["x-csrf-token"];
  if (typeof cookieToken === "string" && typeof headerToken === "string" && timingSafeEqualString(cookieToken, headerToken) && verifyCsrfTokenValue(cookieToken)) {
    next();
    return;
  }
  if (!cookieToken && typeof headerToken === "string" && verifyCsrfTokenValue(headerToken) && isSameOriginBrowserRequest(req)) {
    next();
    return;
  }
  res.status(403).json({
    error: "Invalid or missing CSRF verification token. Please refresh and try again."
  });
}
async function logAudit(params) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        actorRole: params.actorRole ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        summary: params.summary,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress ?? null
      }
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

// server/lib/storage.ts
import fs from "fs";
import path from "path";
import crypto2 from "crypto";
var STORAGE_ROOT = path.resolve(process.cwd(), "storage");
var REPORTS_DIR = path.join(STORAGE_ROOT, "reports");
var EVIDENCE_DIR = path.join(STORAGE_ROOT, "evidence");
function ensureStorageDirectories() {
  try {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  } catch (err) {
    console.warn(
      "Unable to initialize storage directories at startup:",
      err instanceof Error ? err.message : err
    );
  }
}
function isValidPdfBuffer(buffer) {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}
function isValidEvidenceBuffer(buffer, mimeType) {
  if (buffer.length < 4) return false;
  if (mimeType === "application/pdf") {
    return isValidPdfBuffer(buffer);
  }
  if (mimeType === "image/png") {
    return buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71;
  }
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  }
  return false;
}
function savePrivateFile(directory, originalExt, buffer) {
  ensureStorageDirectories();
  const safeExt = originalExt.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10) || ".bin";
  const fileName = `${Date.now()}-${crypto2.randomBytes(12).toString("hex")}${safeExt}`;
  const fullPath = path.join(directory, fileName);
  fs.writeFileSync(fullPath, buffer);
  return fileName;
}
function resolvePrivateFile(directory, storedFileName) {
  if (!storedFileName || storedFileName.includes("..") || /[/\\]/.test(storedFileName)) {
    return null;
  }
  const baseDir = path.resolve(directory);
  const sanitized = path.basename(storedFileName);
  const fullPath = path.resolve(baseDir, sanitized);
  if (!fullPath.startsWith(baseDir + path.sep)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

// server/middleware/requestLogger.ts
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      const durationMs = Date.now() - start;
      console.log(
        JSON.stringify({
          ts: (/* @__PURE__ */ new Date()).toISOString(),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs
        })
      );
    }
  });
  next();
}

// server/seed.ts
import { execSync } from "child_process";
import fs2 from "fs";
import path2 from "path";
var CATEGORIES = [
  {
    slug: "obstetric-fetal-imaging",
    name: "Obstetric & Fetal Imaging",
    description: "Specialized trimester-specific fetal ultrasound evaluations led by Dr. Varun Agrawal (DNB Radiology) for maternal and fetal care.",
    sortOrder: 1
  },
  {
    slug: "general-ultrasound",
    name: "General Ultrasound",
    description: "High-resolution diagnostic ultrasonography for abdominal, renal, KUB, and general internal organ assessments.",
    sortOrder: 2
  },
  {
    slug: "doppler-vascular-studies",
    name: "Doppler & Vascular Studies",
    description: "Color and spectral Doppler blood-flow assessments across obstetric, arterial, venous, carotid, and abdominal territories.",
    sortOrder: 3
  },
  {
    slug: "breast-imaging",
    name: "Breast Imaging",
    description: "Dedicated high-frequency breast and axillary ultrasonography for diagnostic screening and targeted clinical evaluation.",
    sortOrder: 4
  },
  {
    slug: "musculoskeletal-small-parts",
    name: "Musculoskeletal & Small Parts",
    description: "High-frequency linear imaging for thyroid, neck, scrotum, joints, soft tissue, and ophthalmic B-scan evaluations.",
    sortOrder: 5
  },
  {
    slug: "pelvic-transvaginal-ultrasound",
    name: "Pelvic & Transvaginal Ultrasound",
    description: "Focused gynecological, follicular, and high-resolution 2D/3D transvaginal imaging performed with privacy and clinical sensitivity.",
    sortOrder: 6
  },
  {
    slug: "other-specialized-ultrasound",
    name: "Other Specialized Ultrasound Investigations",
    description: "Image-guided diagnostic procedures and targeted regional ultrasound studies performed under specialist supervision.",
    sortOrder: 7
  }
];
var SERVICES = [
  // Obstetric & Fetal Imaging
  {
    code: "OBS-NT",
    slug: "nt-scan",
    name: "NT Scan (Nuchal Translucency)",
    categorySlug: "obstetric-fetal-imaging",
    summary: "First-trimester fetal screening scan performed between 11 and 13+6 weeks of gestation.",
    clinicalDescription: "Evaluates nuchal translucency thickness, nasal bone visualization, crown-rump length, and early fetal anatomy as part of first-trimester screening.",
    preparationNotes: "Bring previous dating scan and maternal blood test requisition if available. Mildly full bladder is helpful.",
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 500
  },
  {
    code: "OBS-ANOMALY",
    slug: "anomaly-scan",
    name: "Anomaly Scan (TIFFA / Level II)",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Detailed second-trimester fetal anatomical survey typically scheduled between 18 and 22 weeks.",
    clinicalDescription: "Systematic organ-by-organ evaluation of fetal cranial, cardiac, thoracic, abdominal, spinal, and limb development along with placental position and amniotic fluid.",
    preparationNotes: "Carry earlier trimester ultrasound reports and obstetric prescriptions. Allow 30\u201345 minutes for thorough examination.",
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 700
  },
  {
    code: "OBS-GROWTH",
    slug: "growth-scan",
    name: "Growth Scan",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Third-trimester fetal biometry, presentation, placental maturity, and liquor assessment.",
    clinicalDescription: "Measures fetal growth parameters (BPD, HC, AC, FL), estimated fetal weight trends, fetal lie, placental localization, and amniotic fluid volume.",
    preparationNotes: "Bring prior anomaly and dating reports for growth comparison.",
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 500
  },
  {
    code: "OBS-BPP",
    slug: "bpp-biophysical-profile",
    name: "BPP (Biophysical Profile)",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Dynamic assessment of fetal well-being combining fetal breathing, tone, movement, and amniotic fluid.",
    clinicalDescription: "Real-time ultrasound evaluation of fetal biophysical parameters as clinically indicated during late pregnancy.",
    preparationNotes: "Have a light meal 60 minutes prior to the appointment unless advised otherwise.",
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 500
  },
  {
    code: "OBS-CERVIX",
    slug: "cervical-length",
    name: "Cervical Length Assessment",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Precise measurement of cervical canal length and internal os status during pregnancy.",
    clinicalDescription: "Assesses cervical competence and length to assist obstetricians in monitoring pregnancy progression.",
    preparationNotes: "Empty bladder immediately prior if performed transvaginally; follow clinician instructions.",
    durationMinutes: 20,
    requiresDoctorMorning: true,
    advanceAmountInr: 500
  },
  {
    code: "OBS-FECHO",
    slug: "fetal-echo",
    name: "Fetal Echo (Fetal Echocardiography)",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Targeted evaluation of the fetal heart chambers, outflow tracts, arches, and cardiac rhythm.",
    clinicalDescription: "Specialist-led fetal cardiac examination indicated for detailed evaluation of cardiac anatomy and blood flow patterns, typically between 20 and 24 weeks.",
    preparationNotes: "Carry Level II Anomaly Scan report and referring obstetrician or cardiologist notes.",
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 800
  },
  {
    code: "OBS-VIAB",
    slug: "early-pregnancy-viability-scan",
    name: "Early Pregnancy Viability Scan",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Early first-trimester confirmation of intrauterine gestation sac, fetal pole, and cardiac activity.",
    clinicalDescription: "Confirms gestational sac location, crown-rump dating, and early embryonic development.",
    preparationNotes: "Drink 2\u20133 glasses of water 45 minutes before scan if scheduled transabdominally.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500
  },
  {
    code: "OBS-TWIN",
    slug: "twin-pregnancy-scan",
    name: "Twin Pregnancy Scan",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Dedicated dual-gestation monitoring evaluating chorionicity, amnionicity, and comparative fetal growth.",
    clinicalDescription: "Structured twin pregnancy ultrasound assessing twin biometry, amniotic fluid pockets, placental sharing, and Doppler indices.",
    preparationNotes: "Carry all prior twin pregnancy records and allow extra examination time.",
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 700
  },
  {
    code: "OBS-L1TWIN",
    slug: "level-1-twin-scan",
    name: "Level 1 Twin Scan",
    categorySlug: "obstetric-fetal-imaging",
    summary: "First-trimester screening and chorionicity assignment for twin gestations.",
    clinicalDescription: "Documents twin crown-rump lengths, nuchal translucency, membrane thickness (lambda/T-sign), and early structural milestones.",
    preparationNotes: "Bring LMP details and prior early pregnancy scans.",
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 700
  },
  {
    code: "OBS-AFI",
    slug: "afi-amniotic-fluid-index",
    name: "AFI (Amniotic Fluid Index)",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Targeted four-quadrant measurement of amniotic fluid volume and fetal presentation.",
    clinicalDescription: "Assesses liquor adequacy and fetal position for obstetric decision-making.",
    preparationNotes: "No special fasting required; bring latest obstetric file.",
    durationMinutes: 20,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  {
    code: "OBS-ROUTINE",
    slug: "obstetric-routine-usg",
    name: "Obstetric Routine USG",
    categorySlug: "obstetric-fetal-imaging",
    summary: "Standard pregnancy ultrasound for fetal presentation, cardiac activity, and interval check.",
    clinicalDescription: "Provides routine obstetric ultrasound assessment per referring clinician guidance.",
    preparationNotes: "Bring antenatal card and prior ultrasound reports.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500
  },
  // General Ultrasound
  {
    code: "GEN-ABD",
    slug: "abdomen-ultrasound",
    name: "Abdomen Ultrasound",
    categorySlug: "general-ultrasound",
    summary: "Diagnostic imaging of liver, gallbladder, biliary tree, pancreas, spleen, and abdominal aorta.",
    clinicalDescription: "High-resolution upper abdominal evaluation for hepatobiliary, pancreatic, and splenic conditions.",
    preparationNotes: "6 hours of fasting (plain water permitted) prior to examination for optimal gallbladder evaluation.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  {
    code: "GEN-KUB",
    slug: "kub-ultrasound",
    name: "KUB (Kidneys, Ureters & Bladder)",
    categorySlug: "general-ultrasound",
    summary: "Focused urinary tract ultrasound evaluating renal parenchyma, calculi, ureteric dilatation, and bladder.",
    clinicalDescription: "Assesses kidney size, corticomedullary differentiation, hydronephrosis, bladder wall, and post-void residual urine.",
    preparationNotes: "Drink 3\u20134 glasses of water 45\u201360 minutes prior and hold urine until scan completion.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  // Doppler & Vascular Studies
  {
    code: "DOP-STUDY",
    slug: "doppler-study",
    name: "Obstetric Doppler Study",
    categorySlug: "doppler-vascular-studies",
    summary: "Umbilical, middle cerebral artery (MCA), and uterine artery blood-flow evaluation during pregnancy.",
    clinicalDescription: "Color and spectral Doppler assessment evaluating fetoplacental circulation and fetal hemodynamic adaptation.",
    preparationNotes: "Bring recent growth scan and obstetric referral slip.",
    durationMinutes: 35,
    requiresDoctorMorning: true,
    advanceAmountInr: 600
  },
  {
    code: "DOP-ABD",
    slug: "abdomen-doppler",
    name: "Abdomen Doppler",
    categorySlug: "doppler-vascular-studies",
    summary: "Color Doppler assessment of portal vein, hepatic veins, IVC, and mesenteric vasculature.",
    clinicalDescription: "Evaluates hepatic and splanchnic venous/arterial flow direction, patency, and velocity waveforms.",
    preparationNotes: "6 hours fasting recommended prior to examination.",
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600
  },
  {
    code: "DOP-ART",
    slug: "arterial-doppler",
    name: "Arterial Doppler",
    categorySlug: "doppler-vascular-studies",
    summary: "Upper or lower limb arterial color Doppler for peripheral vascular flow and stenosis screening.",
    clinicalDescription: "Assesses arterial patency, triphasic/monophasic waveform morphology, plaque, and collateral flow.",
    preparationNotes: "Wear comfortable loose clothing; bring clinical notes.",
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600
  },
  {
    code: "DOP-VEN",
    slug: "venous-doppler",
    name: "Venous Doppler",
    categorySlug: "doppler-vascular-studies",
    summary: "Upper or lower limb venous Doppler for DVT exclusion and venous insufficiency mapping.",
    clinicalDescription: "Compression ultrasonography with color and spectral Doppler for deep venous thrombosis and saphenofemoral competence.",
    preparationNotes: "No fasting required; inform staff of affected limb side.",
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600
  },
  {
    code: "DOP-CAR",
    slug: "carotid-doppler",
    name: "Carotid Doppler",
    categorySlug: "doppler-vascular-studies",
    summary: "Bilateral carotid and vertebral artery color Doppler evaluation.",
    clinicalDescription: "Measures intima-media thickness, atherosclerotic plaque characteristics, and peak systolic flow velocities.",
    preparationNotes: "Wear an open-collar shirt without neck jewelry.",
    durationMinutes: 30,
    requiresDoctorMorning: false,
    advanceAmountInr: 600
  },
  {
    code: "DOP-REN",
    slug: "renal-doppler",
    name: "Renal Doppler",
    categorySlug: "doppler-vascular-studies",
    summary: "Bilateral renal artery and intrarenal resistive index Doppler study.",
    clinicalDescription: "Evaluates main renal arteries and segmental waveforms for renovascular assessment.",
    preparationNotes: "6 hours fasting with light low-gas diet the evening before helps visualization.",
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600
  },
  {
    code: "DOP-IOTA",
    slug: "iota-doppler",
    name: "IOTA Doppler",
    categorySlug: "doppler-vascular-studies",
    summary: "Structured pelvic adnexal assessment utilizing IOTA ultrasound and vascular Doppler criteria.",
    clinicalDescription: "Standardized morphological and vascularity characterization of ovarian/adnexal findings to assist gynecological evaluation.",
    preparationNotes: "Follow clinician instructions regarding full or empty bladder depending on transabdominal/TVS approach.",
    durationMinutes: 35,
    requiresDoctorMorning: true,
    advanceAmountInr: 600
  },
  // Breast Imaging
  {
    code: "BRS-USG",
    slug: "breast-ultrasound",
    name: "Breast Ultrasound (Bilateral / Targeted)",
    categorySlug: "breast-imaging",
    summary: "High-frequency sonomammography of breast parenchyma and bilateral axillae.",
    clinicalDescription: "Evaluates palpable lumps, focal tenderness, dense breast tissue, and axillary lymph nodes without ionizing radiation.",
    preparationNotes: "Avoid applying talcum powder or deodorant on the chest/underarms on the day of scan. Bring prior mammogram if available.",
    durationMinutes: 30,
    requiresDoctorMorning: false,
    advanceAmountInr: 500
  },
  // Musculoskeletal & Small Parts
  {
    code: "SP-THY",
    slug: "thyroid-ultrasound",
    name: "Thyroid Ultrasound",
    categorySlug: "musculoskeletal-small-parts",
    summary: "High-resolution imaging of thyroid lobes, isthmus, and cervical lymph nodes.",
    clinicalDescription: "Evaluates thyroid volume, parenchymal echotexture, nodules (TI-RADS characterization), and parathyroid region.",
    preparationNotes: "No fasting required; wear comfortable open-neck attire.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  {
    code: "SP-SCR",
    slug: "scrotum-ultrasound",
    name: "Scrotum Ultrasound (with Doppler)",
    categorySlug: "musculoskeletal-small-parts",
    summary: "High-frequency testicular, epididymal, and pampiniform plexus evaluation.",
    clinicalDescription: "Assesses testicular morphology, vascularity, hydrocele, varicocele, and epididymal pathology.",
    preparationNotes: "No fasting required.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500
  },
  {
    code: "SP-GEN",
    slug: "small-parts-ultrasound",
    name: "Small Parts Ultrasound",
    categorySlug: "musculoskeletal-small-parts",
    summary: "Targeted superficial high-frequency ultrasound for subcutaneous swellings, salivary glands, and lymph nodes.",
    clinicalDescription: "Evaluates focal soft-tissue lesions, parotid/submandibular glands, abdominal wall hernias, and superficial structures.",
    preparationNotes: "No specific preparation needed.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  {
    code: "SP-MSK",
    slug: "msk-musculoskeletal-ultrasound",
    name: "MSK (Musculoskeletal Ultrasound)",
    categorySlug: "musculoskeletal-small-parts",
    summary: "Dynamic tendon, ligament, muscle, bursa, and joint space ultrasound evaluation.",
    clinicalDescription: "High-resolution static and dynamic imaging of shoulder, knee, ankle, wrist, or focal musculoskeletal injuries.",
    preparationNotes: "Wear clothing allowing easy access to the affected joint; bring prior X-ray or MRI if available.",
    durationMinutes: 30,
    requiresDoctorMorning: false,
    advanceAmountInr: 500
  },
  {
    code: "SP-BSCAN",
    slug: "b-scan-ocular-ultrasound",
    name: "B Scan (Ophthalmic Ultrasound)",
    categorySlug: "musculoskeletal-small-parts",
    summary: "Non-invasive ocular B-scan evaluating posterior segment, vitreous, retina, and retrobulbar space.",
    clinicalDescription: "Diagnostic ophthalmic ultrasonography performed gently over closed eyelids when fundus view is obscured.",
    preparationNotes: "Remove contact lenses before the scan and avoid eye makeup.",
    durationMinutes: 20,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  {
    code: "SP-NECK",
    slug: "neck-ultrasound",
    name: "Neck Ultrasound",
    categorySlug: "musculoskeletal-small-parts",
    summary: "Comprehensive soft-tissue evaluation of cervical lymph nodes, salivary glands, and neck spaces.",
    clinicalDescription: "High-frequency examination of anterior and lateral neck compartments.",
    preparationNotes: "Remove necklaces prior to examination.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  // Pelvic & Transvaginal Ultrasound
  {
    code: "PEL-USG",
    slug: "pelvic-ultrasound",
    name: "Pelvic Ultrasound",
    categorySlug: "pelvic-transvaginal-ultrasound",
    summary: "Transabdominal assessment of uterus, endometrium, ovaries, adnexa, and pelvic cavity.",
    clinicalDescription: "Evaluates uterine dimensions, fibroids, endometrial thickness, ovarian morphology, and pelvic fluid.",
    preparationNotes: "Drink 4 glasses of water 45 minutes prior; comfortably full bladder required.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  {
    code: "PEL-FOLL",
    slug: "follicular-monitoring",
    name: "Follicular Monitoring",
    categorySlug: "pelvic-transvaginal-ultrasound",
    summary: "Serial ultrasound tracking of ovarian follicular growth, ovulation, and endometrial receptivity.",
    clinicalDescription: "Accurate serial measurement of dominant follicle diameter and endometrial trilaminar thickness.",
    preparationNotes: "Empty bladder right before TVS study; bring cycle day and medication details.",
    durationMinutes: 20,
    requiresDoctorMorning: false,
    advanceAmountInr: 400
  },
  {
    code: "PEL-TVS",
    slug: "tvs-transvaginal-scan",
    name: "TVS (Transvaginal Ultrasound)",
    categorySlug: "pelvic-transvaginal-ultrasound",
    summary: "High-resolution endovaginal pelvic and early-pregnancy diagnostic imaging.",
    clinicalDescription: "Provides superior near-field visualization of uterus, endometrium, ovaries, adnexa, and early gestation.",
    preparationNotes: "Empty bladder immediately before scan. Performed with sterile probe cover and strict privacy.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500
  },
  {
    code: "PEL-TVSTWIN",
    slug: "tvs-twin-pregnancy",
    name: "TVS Twin Pregnancy",
    categorySlug: "pelvic-transvaginal-ultrasound",
    summary: "Focused transvaginal evaluation in early twin gestation or cervical assessment.",
    clinicalDescription: "High-resolution endovaginal imaging for early twin chorionicity or cervical length monitoring.",
    preparationNotes: "Empty bladder prior to scan; bring prior obstetric records.",
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 600
  },
  {
    code: "PEL-TVS3D",
    slug: "tvs-3d-scan",
    name: "TVS 3D Scan (3D Pelvic Ultrasound)",
    categorySlug: "pelvic-transvaginal-ultrasound",
    summary: "Three-dimensional coronal reconstruction of the uterine cavity, septum, and adnexal anatomy.",
    clinicalDescription: "Volumetric 3D transvaginal ultrasound used in uterine anomaly mapping, endometrial assessment, and fertility workups.",
    preparationNotes: "Empty bladder just prior to examination.",
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 700
  },
  // Other Specialized Ultrasound Investigations
  {
    code: "OTH-CHEST",
    slug: "chest-ultrasound",
    name: "Chest / Pleural Ultrasound",
    categorySlug: "other-specialized-ultrasound",
    summary: "Evaluation of pleural effusion, chest wall lesions, and pleural-based collections.",
    clinicalDescription: "Quantifies pleural fluid, internal septations, and guides pre-procedural marking.",
    preparationNotes: "Carry recent chest X-ray or CT report if available.",
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500
  },
  {
    code: "OTH-HEAD",
    slug: "head-neurosonogram",
    name: "Head Ultrasound (Neonatal Neurosonogram)",
    categorySlug: "other-specialized-ultrasound",
    summary: "Transfontanellar cranial ultrasound for newborns and young infants.",
    clinicalDescription: "Radiation-free evaluation of neonatal cerebral ventricles and intracranial anatomy via the anterior fontanelle.",
    preparationNotes: "Feeding the infant shortly before the appointment often keeps them calm during scanning.",
    durationMinutes: 25,
    requiresDoctorMorning: true,
    advanceAmountInr: 500
  },
  {
    code: "OTH-FNAC",
    slug: "fnac-guided-ultrasound",
    name: "FNAC-Guided Ultrasound",
    categorySlug: "other-specialized-ultrasound",
    summary: "Real-time ultrasound guidance for targeted fine needle aspiration cytology sampling.",
    clinicalDescription: "Precision image guidance for thyroid, lymph node, breast, or superficial lesion sampling in coordination with pathology.",
    preparationNotes: "Inform reception of any blood-thinning medications (aspirin, clopidogrel, anticoagulants) prior to scheduling.",
    durationMinutes: 35,
    requiresDoctorMorning: true,
    advanceAmountInr: 700
  }
];
var INITIAL_CMS_ITEMS = [
  {
    slug: "about-edfic",
    pageKey: "about",
    title: "About EDFIC - A Specialized Wing of EWA DERMA",
    contentMarkdown: `EWA Diagnostic and Fetal Imaging Centre (EDFIC) operates as a specialized diagnostic and fetal imaging wing of EWA DERMA at Unit 10, Millennium Place, Sushant Golf City, Lucknow (near Lulu Mall).

Our practice is structured around appointment-based scheduling, specialist radiologist oversight, and structured diagnostic reporting so patients receive clear clinical communication without unnecessary waiting.`
  },
  {
    slug: "fetal-imaging-guide",
    pageKey: "fetal-imaging",
    title: "Trimester-Wise Fetal Imaging Pathway",
    contentMarkdown: `Fetal imaging at EDFIC follows clinically established obstetric milestones:
- Early Pregnancy Viability (6\u20139 weeks): Confirmation of gestational location, dating, and cardiac activity.
- First-Trimester NT & Screening Scan (11\u201313+6 weeks): Nuchal translucency measurement and early anatomical check.
- Second-Trimester Anomaly Scan (18\u201322 weeks): Comprehensive structural survey and fetal echocardiography when indicated.
- Third-Trimester Growth & Doppler (28\u201336+ weeks): Interval growth biometry, liquor index, and fetoplacental Doppler studies.

EDFIC strictly adheres to the Pre-Conception and Pre-Natal Diagnostic Techniques (PCPNDT) Act & Rules. Sex determination or gender prediction is strictly prohibited and not performed or communicated under any circumstances.`
  },
  {
    slug: "patient-consent-policy",
    pageKey: "patient-consent",
    title: "Patient Consent & PCPNDT Compliance Information",
    contentMarkdown: `1. Informed Consent: Every diagnostic ultrasound or image-guided procedure is conducted with informed patient consent and clinical referral documentation where applicable.
2. PCPNDT Statutory Compliance: All obstetric ultrasound examinations at EDFIC are performed strictly in accordance with the Pre-Conception and Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994. Patients undergoing obstetric scans are required to present valid photo identification and complete Form F statutory declarations as mandated by law.
3. Diagnostic Report Confidentiality: Finalized diagnostic reports are released exclusively to the patient or authorized clinician through verified channels and the authenticated patient portal.`
  },
  {
    slug: "privacy-policy",
    pageKey: "privacy-policy",
    title: "EDFIC Privacy & Patient Data Protection Notice",
    contentMarkdown: `EDFIC collects personal and clinical information solely for appointment scheduling, diagnostic examination delivery, statutory medical compliance, and authorized report access. Patient records and diagnostic PDFs are stored in access-controlled private storage with audit logging and are never published to public URLs or shared with unauthorized third parties.`
  },
  {
    slug: "terms-of-use",
    pageKey: "terms-of-use",
    title: "Terms and Conditions",
    contentMarkdown: `Appointments at EDFIC are scheduled by time slot and confirmed upon verification of the configured UPI advance reference by reception staff. Uploading a payment screenshot or UTR initiates manual verification and does not constitute automatic confirmation until verified against clinic banking records. Medical information on this website is educational and does not substitute an in-person clinical consultation.`
  },
  {
    slug: "disclaimer",
    pageKey: "disclaimer",
    title: "Medical & Diagnostic Disclaimer",
    contentMarkdown: `1. Educational Information Only: All clinical descriptions, scan preparation guides, and blog articles published on the EDFIC website are intended strictly for general patient awareness and educational reference. They do not constitute medical advice, diagnosis, or a substitute for an in-person consultation with a qualified physician or radiologist.

2. Diagnostic Interpretation & Clinical Correlation: Ultrasound, Doppler, and image-guided findings must always be interpreted by your referring obstetrician, physician, or specialist in conjunction with your complete clinical history, physical examination, and laboratory investigations.

3. Diagnostic Limitations: While EDFIC utilizes high-resolution imaging systems and follows standardized clinical protocols, medical ultrasound has recognized technical and biological limitations (such as fetal position, maternal habitus, gestational age, and acoustic windows), and no imaging modality can guarantee the detection of every congenital or medical condition.

4. Emergency Care Notice: This website and patient portal are not monitored for acute medical emergencies. In the event of an urgent or life-threatening medical situation, please contact emergency medical services or visit the nearest hospital emergency department immediately.`
  }
];
function runLocalPrismaDbPush() {
  const localPrismaBin = path2.resolve(process.cwd(), "node_modules", ".bin", "prisma");
  const cmd = fs2.existsSync(localPrismaBin) ? `"${localPrismaBin}" db push --skip-generate` : "npx prisma db push --skip-generate";
  execSync(cmd, { stdio: "inherit", env: { ...process.env } });
}
async function ensureSqliteTablesExist() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl.startsWith("file:")) return;
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ClinicSetting'"
    );
    if (rows.length === 0) {
      console.log("SQLite tables missing; running prisma db push --skip-generate...");
      runLocalPrismaDbPush();
    }
  } catch (err) {
    console.warn("SQLite schema check failed, attempting prisma db push:", err);
    runLocalPrismaDbPush();
  }
}
async function ensureSeeded() {
  await ensureSqliteTablesExist();
  await prisma.clinicSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      clinicName: "EDFIC",
      fullName: "EWA Diagnostic and Fetal Imaging Centre",
      parentUnitName: "A Unit of EWA DERMA",
      tagline: "Advanced Fetal Imaging & Diagnostic Services in Lucknow.",
      addressLine: "Unit 10, Millennium Place, Sushant Golf City",
      landmark: "Near Lulu Mall",
      cityStateCountry: "Lucknow, Uttar Pradesh, India",
      primaryPhone: "+91 94578 89090",
      secondaryPhone: "",
      whatsappNumber: "+91 94578 89090",
      officialEmail: "care@ewafetalimaging.com",
      weekdayHours: "Monday\u2013Saturday: 9:00 AM \u2013 8:00 PM",
      sundayHours: "Sunday: 10:00 AM \u2013 2:00 PM (By Appointment)",
      slotDurationMinutes: 30,
      slotCapacityPerSlot: 2,
      morningSessionStart: "09:30",
      morningSessionEnd: "13:30",
      upiId: "edfic.lucknow@upi",
      upiMerchantName: "EWA Diagnostic & Fetal Imaging Centre",
      defaultAdvanceAmountInr: 500
    }
  });
  const catMap = /* @__PURE__ */ new Map();
  for (const cat of CATEGORIES) {
    const record = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder
      },
      create: cat
    });
    catMap.set(cat.slug, record.id);
  }
  for (const svc of SERVICES) {
    const categoryId = catMap.get(svc.categorySlug);
    if (!categoryId) continue;
    await prisma.diagnosticService.upsert({
      where: { slug: svc.slug },
      update: {},
      create: {
        code: svc.code,
        slug: svc.slug,
        name: svc.name,
        categoryId,
        summary: svc.summary,
        clinicalDescription: svc.clinicalDescription,
        preparationNotes: svc.preparationNotes,
        durationMinutes: svc.durationMinutes,
        requiresDoctorMorning: svc.requiresDoctorMorning,
        isVisiblePublic: true,
        approvalStatus: "PUBLISHED",
        advanceAmountInr: svc.advanceAmountInr,
        internalBaseFeeInr: 0
      }
    });
  }
  for (const item of INITIAL_CMS_ITEMS) {
    await prisma.cmsContentItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        pageKey: item.pageKey,
        title: item.title,
        contentMarkdown: item.contentMarkdown,
        status: "PUBLISHED",
        checklistNoPrice: true,
        checklistNoSexDetermination: true,
        checklistNoGuarantee: true,
        checklistNoFakeTestimonial: true,
        medicalReviewerName: "Dr. Varun Agrawal (DNB Radiology)",
        complianceReviewerName: "EDFIC Compliance Desk",
        finalApproverName: "Medical Director",
        publishedAt: /* @__PURE__ */ new Date()
      }
    });
  }
  const userCount = await prisma.user.count();
  if (userCount === 0 && process.env.DISABLE_DEV_SEED !== "true") {
    const devAccounts = [
      {
        email: "admin@edfic.local",
        fullName: "EDFIC Super Administrator",
        role: "SUPER_ADMIN",
        phone: "9000000001"
      },
      {
        email: "reception@edfic.local",
        fullName: "Front Desk Reception",
        role: "RECEPTION",
        phone: "9000000002"
      },
      {
        email: "patient@edfic.local",
        fullName: "Ananya Sharma (Dev Test Patient)",
        role: "PATIENT",
        phone: "9876543210"
      }
    ];
    const defaultPasswordHash = await hashPassword("Edfic@2026!");
    for (const acc of devAccounts) {
      const user = await prisma.user.create({
        data: {
          email: acc.email,
          passwordHash: defaultPasswordHash,
          fullName: acc.fullName,
          phone: acc.phone,
          role: acc.role,
          isActive: true
        }
      });
      if (acc.role === "PATIENT") {
        await prisma.patient.create({
          data: {
            patientCode: "EDF-PT-1001",
            userId: user.id,
            fullName: acc.fullName,
            phone: acc.phone,
            email: acc.email,
            address: "Sushant Golf City, Lucknow",
            consentAccepted: true,
            consentTimestamp: /* @__PURE__ */ new Date()
          }
        });
      }
    }
  }
}
var isDirectRun = typeof process !== "undefined" && process.argv[1] && process.argv[1].endsWith("seed.ts");
if (isDirectRun) {
  ensureSeeded().then(() => {
    console.log("EDFIC seed completed.");
    process.exit(0);
  }).catch((err) => {
    console.error("EDFIC seed failed:", err);
    process.exit(1);
  });
}

// server/routes/auth.routes.ts
import { Router } from "express";
import { z } from "zod";

// server/middleware/auth.ts
import crypto3 from "crypto";
function extractSessionToken(req) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 0) return bearer;
  }
  return null;
}
function authenticateOptional(req, _res, next) {
  const token = extractSessionToken(req);
  if (token) {
    const decoded = verifySessionToken(token);
    if (decoded) {
      req.auth = decoded;
    }
  }
  next();
}
function requireAuth(req, res, next) {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const decoded = verifySessionToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
    return;
  }
  req.auth = decoded;
  next();
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        error: "Access denied: your role does not permit this operation."
      });
      return;
    }
    next();
  };
}
function requireHermesKey(req, res, next) {
  const rawConfigured = process.env.HERMES_API_KEY?.trim();
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && (!rawConfigured || rawConfigured.startsWith("CHANGE_ME_"))) {
    res.status(503).json({ error: "Hermes Agent integration credential is not configured." });
    return;
  }
  const configuredKey = rawConfigured || "edfic-hermes-dev-key-change-in-production";
  const providedKey = req.headers["x-hermes-api-key"];
  if (typeof providedKey !== "string") {
    res.status(401).json({ error: "Unauthorized Hermes Agent credential." });
    return;
  }
  const bufA = Buffer.from(providedKey, "utf8");
  const bufB = Buffer.from(configuredKey, "utf8");
  if (bufA.length !== bufB.length || !crypto3.timingSafeEqual(bufA, bufB)) {
    res.status(401).json({ error: "Unauthorized Hermes Agent credential." });
    return;
  }
  next();
}

// server/services/automation.ts
import crypto4 from "crypto";
import net from "net";
function validateOutboundUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: true };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "Invalid URL format." };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, reason: "Embedded credentials in integration URLs are not allowed." };
  }
  const isProd = process.env.NODE_ENV === "production";
  const allowedProtocols = isProd ? ["https:"] : ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      reason: isProd ? "Production integration URLs must use HTTPS." : "Only HTTP(S) URLs are permitted."
    };
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "metadata.google.internal" || host === "metadata.goog" || host === "0.0.0.0" || host.startsWith("169.254.") || host.startsWith("fe80:")) {
    return { valid: false, reason: "Metadata and link-local addresses are blocked." };
  }
  if (isProd) {
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "::1") {
      return { valid: false, reason: "Local/internal integration hosts are blocked in production." };
    }
    if (net.isIPv4(host)) {
      const octets = host.split(".").map(Number);
      if (octets[0] === 127 || octets[0] === 10 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168) {
        return { valid: false, reason: "Private IP ranges are blocked in production." };
      }
    }
  }
  return { valid: true };
}
var DEFAULT_WHATSAPP_TEMPLATES = {
  INQUIRY_ACKNOWLEDGMENT: "edfic_inquiry_ack",
  APPOINTMENT_ACKNOWLEDGMENT: "edfic_appointment_ack",
  BOOKING_REFERENCE: "edfic_booking_reference",
  PAYMENT_INSTRUCTIONS: "edfic_upi_instructions",
  PAYMENT_ACKNOWLEDGED: "edfic_payment_verified",
  PAYMENT_REJECTED: "edfic_payment_rejected",
  APPOINTMENT_CONFIRMED: "edfic_appointment_confirmed",
  APPOINTMENT_REMINDER: "edfic_appointment_reminder",
  APPOINTMENT_RESCHEDULED: "edfic_appointment_rescheduled",
  APPOINTMENT_CANCELLED: "edfic_appointment_cancelled",
  REPORT_PORTAL_NOTICE: "edfic_report_portal_notice"
};
function resolveWhatsAppTemplates(rawJson) {
  const base = { ...DEFAULT_WHATSAPP_TEMPLATES };
  if (!rawJson) return base;
  try {
    const parsed = JSON.parse(rawJson);
    for (const key of Object.keys(base)) {
      const val = parsed[key];
      if (typeof val === "string" && val.trim().length > 0) {
        base[key] = val.trim();
      }
    }
  } catch {
  }
  return base;
}
async function dispatchN8nEvent(params) {
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId: params.eventId }
  });
  if (existing) {
    return { status: existing.status, eventId: existing.eventId, duplicate: true };
  }
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" }
  });
  const webhookUrl = settings?.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL || "";
  const webhookSecret = settings?.n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || "";
  const n8nApiKey = settings?.n8nApiKey || process.env.N8N_API_KEY || "";
  const payloadString = JSON.stringify({
    eventId: params.eventId,
    eventType: params.eventType,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    source: "edfic-platform",
    data: params.payload
  });
  const record = await prisma.webhookEvent.create({
    data: {
      eventId: params.eventId,
      eventType: params.eventType,
      targetSystem: "N8N",
      payloadJson: payloadString,
      status: webhookUrl ? "PENDING" : "SKIPPED_UNCONFIGURED",
      attempts: 0
    }
  });
  if (!webhookUrl) {
    return { status: "SKIPPED_UNCONFIGURED", eventId: record.eventId };
  }
  return attemptN8nDelivery(record.id, webhookUrl, webhookSecret, n8nApiKey, payloadString);
}
async function retryWebhookEvent(webhookRecordId) {
  const record = await prisma.webhookEvent.findUnique({
    where: { id: webhookRecordId }
  });
  if (!record) {
    throw new Error("Webhook event not found.");
  }
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" }
  });
  const webhookUrl = settings?.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL || "";
  const webhookSecret = settings?.n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || "";
  const n8nApiKey = settings?.n8nApiKey || process.env.N8N_API_KEY || "";
  if (!webhookUrl) {
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "SKIPPED_UNCONFIGURED", lastAttemptAt: /* @__PURE__ */ new Date() }
    });
    return { status: "SKIPPED_UNCONFIGURED", eventId: record.eventId };
  }
  return attemptN8nDelivery(record.id, webhookUrl, webhookSecret, n8nApiKey, record.payloadJson);
}
async function retryFailedWebhooks(limit = 25) {
  const failedEvents = await prisma.webhookEvent.findMany({
    where: { status: "FAILED", attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: limit
  });
  let succeeded = 0;
  let failed = 0;
  for (const evt of failedEvents) {
    const res = await retryWebhookEvent(evt.id);
    if (res.status === "SENT") succeeded += 1;
    else if (res.status === "FAILED") failed += 1;
  }
  return { retried: failedEvents.length, succeeded, failed };
}
async function attemptN8nDelivery(id, webhookUrl, webhookSecret, n8nApiKey, payloadString) {
  const signature = webhookSecret ? crypto4.createHmac("sha256", webhookSecret).update(payloadString).digest("hex") : "";
  const parsedMeta = JSON.parse(payloadString);
  const headers = {
    "Content-Type": "application/json",
    "X-EDFIC-Event-Id": parsedMeta.eventId || "",
    "X-EDFIC-Event-Type": parsedMeta.eventType || ""
  };
  if (signature) {
    headers["X-EDFIC-Signature"] = signature;
  }
  if (n8nApiKey) {
    headers["X-N8N-API-KEY"] = n8nApiKey;
  }
  const urlCheck = validateOutboundUrl(webhookUrl);
  if (!urlCheck.valid) {
    const updated = await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: `Blocked URL: ${urlCheck.reason}`,
        lastAttemptAt: /* @__PURE__ */ new Date()
      }
    });
    return { status: updated.status, eventId: updated.eventId, lastError: updated.lastError };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5e3);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal
    });
    clearTimeout(timeout);
    const rawBody = await res.text().catch(() => "");
    let executionId = res.headers.get("x-n8n-execution-id");
    if (!executionId && rawBody) {
      try {
        const json = JSON.parse(rawBody);
        if (typeof json.executionId === "string") executionId = json.executionId;
      } catch {
      }
    }
    const status = res.ok ? "SENT" : "FAILED";
    const updated = await prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        attempts: { increment: 1 },
        executionId,
        responseStatus: res.status,
        responseBody: rawBody.slice(0, 500) || null,
        lastError: res.ok ? null : `HTTP ${res.status}`,
        lastAttemptAt: /* @__PURE__ */ new Date()
      }
    });
    await prisma.clinicSetting.update({
      where: { id: "singleton" },
      data: {
        n8nConnectionStatus: res.ok ? "CONNECTED" : "ERROR",
        n8nLastCheckedAt: /* @__PURE__ */ new Date()
      }
    }).catch(() => {
    });
    return { status: updated.status, eventId: updated.eventId, lastError: updated.lastError };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    const updated = await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: message,
        lastAttemptAt: /* @__PURE__ */ new Date()
      }
    });
    await prisma.clinicSetting.update({
      where: { id: "singleton" },
      data: {
        n8nConnectionStatus: "ERROR",
        n8nLastCheckedAt: /* @__PURE__ */ new Date()
      }
    }).catch(() => {
    });
    return { status: updated.status, eventId: updated.eventId, lastError: message };
  }
}
var BLOCKED_PHI_PATTERNS = [
  /\.pdf\b/i,
  /\bfindings\b/i,
  /\bimpression\b/i,
  /\bdiagnosis\b/i,
  /\bfetal\s*anomaly\b/i
];
async function dispatchWhatsAppMessage(params) {
  if (BLOCKED_PHI_PATTERNS.some((p) => p.test(params.messageBody))) {
    throw new Error(
      "Compliance block: Diagnostic reports or clinical findings cannot be sent over WhatsApp."
    );
  }
  if (params.eventId) {
    const existingLog = await prisma.whatsAppMessageLog.findUnique({
      where: { eventId: params.eventId }
    });
    if (existingLog) {
      return { status: existingLog.status, logId: existingLog.id, duplicate: true };
    }
  }
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" }
  });
  const provider = settings?.whatsappProvider || process.env.WHATSAPP_PROVIDER || "meta_cloud";
  const apiUrl = settings?.whatsappApiUrl || process.env.WHATSAPP_API_URL || "";
  const phoneId = settings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const accessToken = settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const templates = resolveWhatsAppTemplates(settings?.whatsappTemplatesJson);
  const templateName = templates[params.templateKey] || params.templateKey;
  if (!apiUrl || !accessToken) {
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: "SKIPPED_UNCONFIGURED",
        provider,
        errorMessage: "WhatsApp provider endpoint or access token not configured."
      }
    });
    return { status: log.status, logId: log.id };
  }
  const urlCheck = validateOutboundUrl(apiUrl);
  if (!urlCheck.valid) {
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: "FAILED",
        provider,
        errorMessage: `Blocked URL: ${urlCheck.reason}`
      }
    });
    return { status: log.status, logId: log.id };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5e3);
    const requestBody = provider === "meta_cloud" ? {
      messaging_product: "whatsapp",
      phone_number_id: phoneId,
      to: params.recipientPhone,
      type: "text",
      template_name: templateName,
      text: { body: params.messageBody }
    } : {
      provider,
      phoneNumberId: phoneId,
      to: params.recipientPhone,
      templateName,
      variables: params.templateVariables ?? [],
      message: params.messageBody
    };
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));
    const externalId = data?.messages?.[0]?.id ?? data?.messageId ?? data?.id ?? null;
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: response.ok ? "SENT" : "FAILED",
        provider,
        externalMessageId: externalId,
        errorMessage: response.ok ? null : `HTTP ${response.status}`
      }
    });
    await prisma.clinicSetting.update({
      where: { id: "singleton" },
      data: {
        whatsappConnectionStatus: response.ok ? "CONNECTED" : response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "ERROR",
        whatsappLastCheckedAt: /* @__PURE__ */ new Date()
      }
    }).catch(() => {
    });
    return { status: log.status, logId: log.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: "FAILED",
        provider,
        errorMessage: message
      }
    });
    await prisma.clinicSetting.update({
      where: { id: "singleton" },
      data: {
        whatsappConnectionStatus: "ERROR",
        whatsappLastCheckedAt: /* @__PURE__ */ new Date()
      }
    }).catch(() => {
    });
    return { status: log.status, logId: log.id };
  }
}
async function dispatchEmailNotification(params) {
  if (!params.recipientEmail || !params.recipientEmail.includes("@")) {
    return { status: "SKIPPED_NO_EMAIL" };
  }
  if (BLOCKED_PHI_PATTERNS.some((p) => p.test(params.bodyText) || p.test(params.subject))) {
    throw new Error(
      "Compliance block: Diagnostic reports or clinical findings cannot be emailed outside the authenticated portal."
    );
  }
  const result = await dispatchN8nEvent({
    eventId: `email-${params.eventId}`,
    eventType: "notification.email_queued",
    payload: {
      channel: "EMAIL",
      recipientEmail: params.recipientEmail,
      templateKey: params.templateKey,
      subject: params.subject,
      bodyText: params.bodyText,
      bookingReference: params.bookingReference || null
    }
  });
  return { status: result.status };
}
async function triggerUpcomingAppointmentReminders(params) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString().slice(0, 10);
  const targetDate = params?.targetDate || tomorrow;
  const appointments = await prisma.appointment.findMany({
    where: {
      appointmentDate: targetDate,
      status: { in: ["CONFIRMED", "PENDING_ADVANCE", "ADVANCE_SUBMITTED"] }
    },
    include: {
      service: { select: { name: true } }
    }
  });
  let dispatchedWebhooks = 0;
  let dispatchedWhatsApp = 0;
  for (const appt of appointments) {
    const n8nRes = await dispatchN8nEvent({
      eventId: `appt-reminder-${appt.id}-${targetDate}`,
      eventType: "appointment.reminder",
      payload: {
        bookingReference: appt.bookingReference,
        serviceName: appt.service.name,
        appointmentDate: appt.appointmentDate,
        startTime: appt.startTime,
        status: appt.status,
        patientPhone: appt.patientPhone
      }
    });
    if (!n8nRes.duplicate) dispatchedWebhooks += 1;
    const waRes = await dispatchWhatsAppMessage({
      eventId: `wa-reminder-${appt.id}-${targetDate}`,
      recipientPhone: appt.patientPhone,
      templateKey: "APPOINTMENT_REMINDER",
      appointmentId: appt.id,
      messageBody: `EDFIC Reminder: Your upcoming visit (${appt.bookingReference}) for ${appt.service.name} is scheduled on ${appt.appointmentDate} at ${appt.startTime}. Location: Unit 10, Millennium Place, Sushant Golf City (Near Lulu Mall), Lucknow.`
    });
    if (!waRes.duplicate) dispatchedWhatsApp += 1;
  }
  await logAudit({
    actorUserId: params?.actorUserId ?? null,
    actorRole: params?.actorRole ?? "SYSTEM",
    action: "APPOINTMENT_REMINDERS_TRIGGERED",
    resourceType: "Appointment",
    summary: `Triggered upcoming reminders for ${targetDate} (${appointments.length} appointments)`
  });
  return {
    targetDate,
    matchedAppointments: appointments.length,
    dispatchedWebhooks,
    dispatchedWhatsApp
  };
}
async function dispatchDailyReceptionSummary(params) {
  const date = params?.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const [
    todaysAppointmentsTotal,
    confirmedAppointments,
    pendingAdvanceAppointments,
    pendingPaymentVerifications,
    newInquiries,
    openFollowUpTasks
  ] = await Promise.all([
    prisma.appointment.count({
      where: { appointmentDate: date, status: { not: "CANCELLED" } }
    }),
    prisma.appointment.count({
      where: { appointmentDate: date, status: "CONFIRMED" }
    }),
    prisma.appointment.count({
      where: {
        appointmentDate: date,
        status: { in: ["PENDING_ADVANCE", "ADVANCE_SUBMITTED"] }
      }
    }),
    prisma.payment.count({
      where: { status: { in: ["PENDING", "SUBMITTED", "UNDER_VERIFICATION"] } }
    }),
    prisma.crmLead.count({
      where: { status: { in: ["NEW", "FOLLOW_UP", "APPOINTMENT_REQUESTED"] } }
    }),
    prisma.crmTask.count({
      where: { isCompleted: false }
    })
  ]);
  const summary = {
    todaysAppointmentsTotal,
    confirmedAppointments,
    pendingAdvanceAppointments,
    pendingPaymentVerifications,
    newInquiries,
    openFollowUpTasks
  };
  const eventId = `reception-daily-summary-${date}-${Date.now()}`;
  const res = await dispatchN8nEvent({
    eventId,
    eventType: "reception.daily_summary",
    payload: {
      date,
      ...summary
    }
  });
  await logAudit({
    actorUserId: params?.actorUserId ?? null,
    actorRole: params?.actorRole ?? "SYSTEM",
    action: "RECEPTION_DAILY_SUMMARY_DISPATCHED",
    resourceType: "WebhookEvent",
    summary: `Dispatched non-PHI daily reception summary for ${date}`
  });
  return {
    date,
    eventId: res.eventId,
    status: res.status,
    summary
  };
}
async function testN8nConnection(actorUserId) {
  const res = await dispatchN8nEvent({
    eventId: `n8n-ping-${Date.now()}`,
    eventType: "integration.test_ping",
    payload: {
      message: "EDFIC connectivity verification ping"
    }
  });
  await logAudit({
    actorUserId,
    actorRole: "SUPER_ADMIN",
    action: "N8N_CONNECTION_TESTED",
    resourceType: "ClinicSetting",
    resourceId: "singleton",
    summary: `Tested n8n webhook connectivity (${res.status})`
  });
  return res;
}
async function testWhatsAppConnection(actorUserId) {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" }
  });
  const provider = settings?.whatsappProvider || process.env.WHATSAPP_PROVIDER || "meta_cloud";
  const apiUrl = settings?.whatsappApiUrl || process.env.WHATSAPP_API_URL || "";
  const accessToken = settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
  let connectionStatus = "NOT_CONFIGURED";
  let detail = "Configure both WhatsApp API Endpoint URL and Access Token to verify connectivity.";
  if (apiUrl && accessToken) {
    const urlCheck = validateOutboundUrl(apiUrl);
    if (!urlCheck.valid) {
      connectionStatus = "ERROR";
      detail = `Blocked URL: ${urlCheck.reason}`;
    } else {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4e3);
        const res = await fetch(apiUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.status === 401 || res.status === 403) {
          connectionStatus = "AUTH_ERROR";
          detail = `Provider rejected credential (HTTP ${res.status}).`;
        } else if (res.ok || res.status === 405 || res.status === 400) {
          connectionStatus = "CONNECTED";
          detail = `Endpoint reachable under ${provider} (HTTP ${res.status}).`;
        } else {
          connectionStatus = "ERROR";
          detail = `Endpoint returned HTTP ${res.status}.`;
        }
      } catch (err) {
        connectionStatus = "ERROR";
        detail = err instanceof Error ? err.message : "Unable to reach WhatsApp provider URL.";
      }
    }
  }
  await prisma.clinicSetting.update({
    where: { id: "singleton" },
    data: {
      whatsappConnectionStatus: connectionStatus,
      whatsappLastCheckedAt: /* @__PURE__ */ new Date()
    }
  });
  await logAudit({
    actorUserId,
    actorRole: "SUPER_ADMIN",
    action: "WHATSAPP_CONNECTION_TESTED",
    resourceType: "ClinicSetting",
    resourceId: "singleton",
    summary: `Tested WhatsApp (${provider}) connectivity: ${connectionStatus}`
  });
  return { connectionStatus, provider, detail };
}

// server/services/scheduling.ts
import crypto5 from "crypto";
import { Prisma } from "@prisma/client";
var dateMutexChains = /* @__PURE__ */ new Map();
async function withDateLock(date, fn) {
  const prev = dateMutexChains.get(date) ?? Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  dateMutexChains.set(date, next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (dateMutexChains.get(date) === next) {
      dateMutexChains.delete(date);
    }
  }
}
function getTxOptions() {
  return process.env.DATABASE_URL?.startsWith("mysql") ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : void 0;
}
function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
async function expireStaleReservations(now = /* @__PURE__ */ new Date()) {
  const deletedHolds = await prisma.slotHold.deleteMany({
    where: { expiresAt: { lte: now } }
  });
  const staleAppointments = await prisma.appointment.findMany({
    where: {
      status: "PENDING_ADVANCE",
      reservationExpiresAt: { lte: now },
      payments: {
        none: {
          status: { in: ["SUBMITTED", "UNDER_VERIFICATION", "VERIFIED"] }
        }
      }
    },
    select: {
      id: true,
      bookingReference: true,
      appointmentDate: true,
      startTime: true,
      patientPhone: true
    }
  });
  let expiredCount = 0;
  for (const appt of staleAppointments) {
    const updated = await prisma.appointment.updateMany({
      where: {
        id: appt.id,
        status: "PENDING_ADVANCE"
      },
      data: {
        status: "CANCELLED",
        cancelledReason: "Reservation expired: advance payment not received within window"
      }
    });
    if (updated.count > 0) {
      expiredCount += 1;
      await dispatchN8nEvent({
        eventId: `appt-expired-${appt.id}`,
        eventType: "appointment.reservation_expired",
        payload: {
          bookingReference: appt.bookingReference,
          appointmentDate: appt.appointmentDate,
          startTime: appt.startTime,
          patientPhone: appt.patientPhone
        }
      }).catch(() => void 0);
    }
  }
  return {
    expiredHolds: deletedHolds.count,
    expiredAppointments: expiredCount
  };
}
async function getAvailableSlots(params) {
  const { date, serviceId, sessionToken } = params;
  const now = params.now ?? /* @__PURE__ */ new Date();
  await expireStaleReservations(now);
  const service = await prisma.diagnosticService.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error("Selected diagnostic service not found.");
  }
  const holiday = await prisma.clinicHoliday.findUnique({ where: { date } });
  if (holiday && holiday.isFullDay) {
    return {
      date,
      isHoliday: true,
      holidayReason: holiday.reason,
      isSunday: (/* @__PURE__ */ new Date(`${date}T00:00:00`)).getDay() === 0,
      dailyCapacityReached: false,
      slots: []
    };
  }
  const settings = await prisma.clinicSetting.findUnique({ where: { id: "singleton" } });
  const slotStep = settings?.slotDurationMinutes ?? 30;
  const capacity = settings?.slotCapacityPerSlot ?? 2;
  const maxDaily = settings?.maxDailyAppointments ?? 40;
  const morningStart = timeToMinutes(settings?.morningSessionStart ?? "09:30");
  const morningEnd = timeToMinutes(settings?.morningSessionEnd ?? "13:30");
  const dayOfWeek = (/* @__PURE__ */ new Date(`${date}T00:00:00`)).getDay();
  const isSunday = dayOfWeek === 0;
  let windowStart = isSunday ? timeToMinutes("10:00") : timeToMinutes("09:00");
  let windowEnd = isSunday ? timeToMinutes("14:00") : timeToMinutes("20:00");
  if (service.requiresDoctorMorning) {
    windowStart = Math.max(windowStart, morningStart);
    windowEnd = Math.min(windowEnd, morningEnd);
  }
  const todayStr = now.toISOString().slice(0, 10);
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      appointmentDate: date,
      status: {
        notIn: ["CANCELLED", "RESCHEDULED", "NO_SHOW"]
      }
    },
    select: {
      startTime: true,
      endTime: true
    }
  });
  const dailyCapacityReached = existingAppointments.length >= maxDaily;
  const activeHolds = await prisma.slotHold.findMany({
    where: {
      date,
      expiresAt: { gt: now },
      ...sessionToken ? { sessionToken: { not: sessionToken } } : {}
    },
    select: {
      startTime: true,
      serviceId: true
    }
  });
  const slots = [];
  const duration = service.durationMinutes || slotStep;
  for (let start = windowStart; start + duration <= windowEnd; start += slotStep) {
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(start + duration);
    if (date === todayStr && start <= currentMins + 30) {
      slots.push({
        startTime,
        endTime,
        available: false,
        remainingCapacity: 0,
        reason: "Slot time has passed"
      });
      continue;
    }
    if (dailyCapacityReached) {
      slots.push({
        startTime,
        endTime,
        available: false,
        remainingCapacity: 0,
        reason: "Daily clinic capacity reached"
      });
      continue;
    }
    const overlappingBookings = existingAppointments.filter((appt) => {
      const aStart = timeToMinutes(appt.startTime);
      const aEnd = timeToMinutes(appt.endTime);
      return start < aEnd && start + duration > aStart;
    }).length;
    const overlappingHolds = activeHolds.filter((hold) => hold.startTime === startTime).length;
    const effectiveCapacity = service.requiresDoctorMorning ? 1 : capacity;
    const remaining = Math.max(0, effectiveCapacity - overlappingBookings - overlappingHolds);
    slots.push({
      startTime,
      endTime,
      available: remaining > 0,
      remainingCapacity: remaining,
      reason: remaining > 0 ? void 0 : "Fully booked"
    });
  }
  return {
    date,
    isHoliday: false,
    isSunday,
    dailyCapacityReached,
    slots
  };
}
async function holdSlotAtomic(params) {
  const { serviceId, date, startTime, sessionToken, holdMinutes = 5 } = params;
  const now = params.now ?? /* @__PURE__ */ new Date();
  return withDateLock(date, async () => {
    const availability = await getAvailableSlots({ date, serviceId, sessionToken, now });
    const slot = availability.slots.find((s) => s.startTime === startTime);
    if (!slot || !slot.available) {
      throw new Error(slot?.reason || "This time slot is no longer available.");
    }
    const expiresAt = new Date(now.getTime() + holdMinutes * 60 * 1e3);
    await prisma.$transaction(async (tx) => {
      await tx.slotHold.deleteMany({
        where: {
          OR: [{ sessionToken }, { expiresAt: { lte: now } }]
        }
      });
      await tx.slotHold.create({
        data: {
          serviceId,
          date,
          startTime,
          sessionToken,
          expiresAt
        }
      });
    }, getTxOptions());
    return { heldUntil: expiresAt, startTime, date };
  });
}
async function bookAppointmentAtomic(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const allowOverride = Boolean(input.isReceptionOverride) && Boolean(input.actorRole && ["SUPER_ADMIN", "RECEPTION"].includes(input.actorRole));
  const channel = input.bookingChannel || "ONLINE";
  return withDateLock(input.date, async () => {
    await expireStaleReservations(now);
    return prisma.$transaction(async (tx) => {
      const service = await tx.diagnosticService.findUnique({
        where: { id: input.serviceId }
      });
      if (!service) {
        throw new Error("Selected diagnostic service was not found.");
      }
      const settings = await tx.clinicSetting.findUnique({
        where: { id: "singleton" }
      });
      const duration = service.durationMinutes || settings?.slotDurationMinutes || 30;
      const reqStart = timeToMinutes(input.startTime);
      const reqEnd = reqStart + duration;
      const endTime = minutesToTime(reqEnd);
      const capacity = service.requiresDoctorMorning ? 1 : settings?.slotCapacityPerSlot ?? 2;
      const maxDaily = settings?.maxDailyAppointments ?? 40;
      if (!allowOverride) {
        const holiday = await tx.clinicHoliday.findUnique({
          where: { date: input.date }
        });
        if (holiday?.isFullDay) {
          throw new Error(`Clinic closed on ${input.date}: ${holiday.reason}`);
        }
        const dayOfWeek = (/* @__PURE__ */ new Date(`${input.date}T00:00:00`)).getDay();
        const isSunday = dayOfWeek === 0;
        let windowStart = isSunday ? timeToMinutes("10:00") : timeToMinutes("09:00");
        let windowEnd = isSunday ? timeToMinutes("14:00") : timeToMinutes("20:00");
        if (service.requiresDoctorMorning) {
          windowStart = Math.max(
            windowStart,
            timeToMinutes(settings?.morningSessionStart ?? "09:30")
          );
          windowEnd = Math.min(
            windowEnd,
            timeToMinutes(settings?.morningSessionEnd ?? "13:30")
          );
        }
        if (reqStart < windowStart || reqEnd > windowEnd) {
          throw new Error(
            service.requiresDoctorMorning ? "This specialist scan is only available during the daily morning doctor session." : "Requested slot is outside EDFIC operating hours."
          );
        }
        const todayStr = now.toISOString().slice(0, 10);
        const currentMins = now.getHours() * 60 + now.getMinutes();
        if (input.date < todayStr || input.date === todayStr && reqStart <= currentMins + 30) {
          throw new Error("Cannot reserve a past time slot.");
        }
        const existingOnDate = await tx.appointment.findMany({
          where: {
            appointmentDate: input.date,
            status: { notIn: ["CANCELLED", "RESCHEDULED", "NO_SHOW"] }
          },
          select: {
            startTime: true,
            endTime: true,
            patientPhone: true,
            serviceId: true
          }
        });
        if (existingOnDate.length >= maxDaily) {
          throw new Error("Daily clinic booking capacity reached for the selected date.");
        }
        const normalizedPhone = input.patientPhone.trim();
        const duplicate = existingOnDate.find(
          (a) => a.patientPhone === normalizedPhone && (a.startTime === input.startTime || a.serviceId === input.serviceId)
        );
        if (duplicate) {
          throw new Error(
            "A duplicate active booking already exists for this patient phone and service/slot on this date."
          );
        }
        const overlapping = existingOnDate.filter((a) => {
          const aStart = timeToMinutes(a.startTime);
          const aEnd = timeToMinutes(a.endTime);
          return reqStart < aEnd && reqEnd > aStart;
        }).length;
        const foreignHolds = await tx.slotHold.count({
          where: {
            date: input.date,
            startTime: input.startTime,
            expiresAt: { gt: now },
            ...input.sessionToken ? { sessionToken: { not: input.sessionToken } } : {}
          }
        });
        if (overlapping + foreignHolds >= capacity) {
          throw new Error("Selected time slot was just reserved. Please pick another slot.");
        }
      }
      let patient = input.actorRole === "PATIENT" && input.actorUserId ? await tx.patient.findUnique({ where: { userId: input.actorUserId } }) : null;
      if (!patient) {
        patient = await tx.patient.findFirst({
          where: { phone: input.patientPhone.trim() }
        });
      }
      if (!patient) {
        const patientCount = await tx.patient.count();
        const patientCode = `EDF-PT-${(1001 + patientCount).toString()}`;
        patient = await tx.patient.create({
          data: {
            patientCode,
            userId: input.actorRole === "PATIENT" ? input.actorUserId ?? null : null,
            fullName: input.patientName.trim(),
            phone: input.patientPhone.trim(),
            email: input.patientEmail?.trim() || null,
            dateOfBirth: input.dateOfBirth || null,
            referredBy: input.referringDoctor?.trim() || null,
            consentAccepted: true,
            consentTimestamp: now
          }
        });
      }
      const bookingReference = await generateUniqueBookingReference();
      const expiryMinutes = settings?.reservationExpiryMinutes ?? 30;
      const reservationExpiresAt = channel === "ONLINE" ? new Date(now.getTime() + expiryMinutes * 60 * 1e3) : null;
      const appointment = await tx.appointment.create({
        data: {
          bookingReference,
          patientId: patient.id,
          serviceId: service.id,
          doctorId: null,
          appointmentDate: input.date,
          startTime: input.startTime,
          endTime,
          status: "PENDING_ADVANCE",
          patientName: input.patientName.trim(),
          patientPhone: input.patientPhone.trim(),
          patientEmail: input.patientEmail?.trim() || null,
          clinicalIndication: input.clinicalIndication?.trim() || null,
          referringDoctor: input.referringDoctor?.trim() || null,
          bookingChannel: channel,
          isReceptionOverride: allowOverride,
          overrideReason: allowOverride ? input.overrideReason?.trim() || "Reception override" : null,
          reservationExpiresAt,
          notes: input.notes?.trim() || null
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              advanceAmountInr: true,
              preparationNotes: true
            }
          }
        }
      });
      if (input.sessionToken) {
        await tx.slotHold.deleteMany({
          where: { sessionToken: input.sessionToken }
        });
      }
      const expectedAdvance = appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500;
      return {
        appointment,
        patient,
        upiPayment: {
          upiId: settings?.upiId || "edfic.lucknow@upi",
          merchantName: settings?.upiMerchantName || "EWA Diagnostic & Fetal Imaging Centre",
          expectedAdvanceInr: expectedAdvance
        }
      };
    }, getTxOptions());
  });
}
async function generateUniqueBookingReference() {
  const datePart = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = crypto5.randomBytes(2).toString("hex").toUpperCase();
  return `EDF-${datePart}-${randomPart}`;
}
async function generateNextPatientCode() {
  const count = await prisma.patient.count();
  return `EDF-PT-${(1001 + count).toString()}`;
}

// server/routes/auth.routes.ts
var router = Router();
var loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
var registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8).max(100)
});
router.get("/csrf", (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === "string" && verifyCsrfTokenValue(existing)) {
    res.json({ csrfToken: existing });
    return;
  }
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions(req, false));
  res.json({ csrfToken });
});
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email and password are required." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { patientProfile: true }
  });
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials or inactive account." });
    return;
  }
  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await logAudit({
      actorUserId: user.id,
      actorRole: user.role,
      action: "AUTH_LOGIN_FAILED",
      resourceType: "User",
      resourceId: user.id,
      summary: `Failed login attempt for ${email}`,
      ipAddress: req.ip
    });
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: /* @__PURE__ */ new Date() }
  });
  const sessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName
  };
  const csrfToken = setAuthCookies(res, sessionPayload, req);
  const sessionToken = signSessionToken(sessionPayload);
  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "AUTH_LOGIN_SUCCESS",
    resourceType: "User",
    resourceId: user.id,
    summary: `Signed in as ${user.role}`,
    ipAddress: req.ip
  });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      patientId: user.patientProfile?.id ?? null,
      patientCode: user.patientProfile?.patientCode ?? null
    },
    csrfToken,
    sessionToken
  });
});
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Please provide valid full name, email, 10-digit phone, and password (min 8 chars)."
    });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const patientCode = await generateNextPatientCode();
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        role: "PATIENT",
        isActive: true
      }
    });
    const regPhone = parsed.data.phone.trim();
    const existingGuestPatient = await tx.patient.findFirst({
      where: {
        userId: null,
        phone: regPhone,
        OR: [{ email: null }, { email }]
      }
    });
    const patient = existingGuestPatient ? await tx.patient.update({
      where: { id: existingGuestPatient.id },
      data: {
        userId: user.id,
        fullName: existingGuestPatient.fullName || user.fullName,
        email: existingGuestPatient.email || user.email,
        consentAccepted: true,
        consentTimestamp: existingGuestPatient.consentTimestamp ?? /* @__PURE__ */ new Date()
      }
    }) : await tx.patient.create({
      data: {
        patientCode,
        userId: user.id,
        fullName: user.fullName,
        phone: parsed.data.phone.trim(),
        email: user.email,
        consentAccepted: true,
        consentTimestamp: /* @__PURE__ */ new Date()
      }
    });
    return { user, patient };
  });
  const regPayload = {
    userId: created.user.id,
    email: created.user.email,
    role: created.user.role,
    fullName: created.user.fullName
  };
  const csrfToken = setAuthCookies(res, regPayload, req);
  const sessionToken = signSessionToken(regPayload);
  await logAudit({
    actorUserId: created.user.id,
    actorRole: "PATIENT",
    action: "PATIENT_REGISTERED",
    resourceType: "Patient",
    resourceId: created.patient.id,
    summary: `New patient portal account registered (${created.patient.patientCode})`,
    ipAddress: req.ip
  });
  await dispatchN8nEvent({
    eventId: `patient-reg-${created.patient.id}`,
    eventType: "patient.registered",
    payload: {
      patientCode: created.patient.patientCode,
      registrationChannel: "PATIENT_PORTAL",
      consentAccepted: created.patient.consentAccepted
    }
  });
  res.status(201).json({
    user: {
      id: created.user.id,
      email: created.user.email,
      fullName: created.user.fullName,
      phone: created.user.phone,
      role: created.user.role,
      patientId: created.patient.id,
      patientCode: created.patient.patientCode
    },
    csrfToken,
    sessionToken
  });
});
router.post("/logout", authenticateOptional, async (req, res) => {
  if (req.auth) {
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "AUTH_LOGOUT",
      resourceType: "User",
      resourceId: req.auth.userId,
      summary: `Signed out (${req.auth.role})`,
      ipAddress: req.ip
    });
  }
  clearAuthCookies(res, req);
  res.json({ ok: true });
});
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    include: { patientProfile: true }
  });
  if (!user || !user.isActive) {
    clearAuthCookies(res, req);
    res.status(401).json({ error: "Account unavailable." });
    return;
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      patientId: user.patientProfile?.id ?? null,
      patientCode: user.patientProfile?.patientCode ?? null
    }
  });
});
var auth_routes_default = router;

// server/routes/public.routes.ts
import crypto6 from "crypto";
import { Router as Router2 } from "express";
import { z as z2 } from "zod";
var router2 = Router2();
var inquirySchema = z2.object({
  fullName: z2.string().min(2).max(120),
  phone: z2.string().min(10).max(15),
  email: z2.string().email().optional().or(z2.literal("")),
  interestedService: z2.string().max(160).optional(),
  message: z2.string().min(5).max(1500)
});
router2.get("/clinic", async (_req, res) => {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" },
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
      morningSessionEnd: true
    }
  });
  res.json({
    clinic: settings,
    doctor: {
      name: "Dr. Varun Agrawal",
      qualification: "DNB Radiology",
      designation: "Consultant Radiologist & Fetal Medicine Specialist",
      expertise: [
        "NT Scan",
        "Anomaly Scan",
        "Growth Scan",
        "Doppler",
        "Fetal Echo",
        "BPP"
      ],
      availability: "Morning session, daily"
    }
  });
});
router2.get("/maps-config", (_req, res) => {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
  res.json({ apiKey });
});
router2.get("/services", async (_req, res) => {
  const categories = await prisma.serviceCategory.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
      services: {
        where: {
          isVisiblePublic: true,
          approvalStatus: "PUBLISHED"
        },
        orderBy: { name: "asc" },
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
          requiresDoctorMorning: true
        }
      }
    }
  });
  res.json({ categories });
});
router2.get("/services/:slug", async (req, res) => {
  const service = await prisma.diagnosticService.findFirst({
    where: {
      slug: req.params.slug,
      isVisiblePublic: true,
      approvalStatus: "PUBLISHED",
      category: { isVisible: true }
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
          name: true
        }
      }
    }
  });
  if (!service) {
    res.status(404).json({ error: "Diagnostic service not found." });
    return;
  }
  res.json({ service });
});
router2.get("/cms/:pageKey", async (req, res) => {
  const items = await prisma.cmsContentItem.findMany({
    where: {
      pageKey: req.params.pageKey,
      status: "PUBLISHED"
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      pageKey: true,
      title: true,
      contentMarkdown: true,
      medicalReviewerName: true,
      publishedAt: true
    }
  });
  res.json({ items });
});
router2.post("/inquiries", async (req, res) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Please enter your name, a valid 10-digit phone number, and your inquiry message."
    });
    return;
  }
  const leadCode = `CRM-${crypto6.randomBytes(3).toString("hex").toUpperCase()}`;
  const lead = await prisma.crmLead.create({
    data: {
      leadCode,
      fullName: parsed.data.fullName.trim(),
      phone: parsed.data.phone.trim(),
      email: parsed.data.email?.trim() || null,
      source: "WEBSITE_CONTACT",
      interestedService: parsed.data.interestedService?.trim() || null,
      message: parsed.data.message.trim(),
      status: "NEW"
    }
  });
  await logAudit({
    action: "PUBLIC_INQUIRY_SUBMITTED",
    resourceType: "CrmLead",
    resourceId: lead.id,
    summary: `Website inquiry ${lead.leadCode} submitted by ${lead.fullName}`,
    ipAddress: req.ip
  });
  await dispatchN8nEvent({
    eventId: `crm-inquiry-${lead.id}`,
    eventType: "crm.inquiry_created",
    payload: {
      leadCode: lead.leadCode,
      fullName: lead.fullName,
      source: lead.source,
      interestedService: lead.interestedService,
      phone: lead.phone
    }
  });
  await dispatchWhatsAppMessage({
    eventId: `wa-inquiry-${lead.id}`,
    recipientPhone: lead.phone,
    templateKey: "INQUIRY_ACKNOWLEDGMENT",
    messageBody: `EDFIC (A Unit of EWA DERMA): Thank you for contacting EWA Diagnostic & Fetal Imaging Centre, Lucknow. Your inquiry reference ${lead.leadCode} has been received and our reception team will respond shortly.`
  });
  res.status(201).json({
    leadCode: lead.leadCode,
    message: "Your inquiry has been registered with EDFIC Reception."
  });
});
var quickAppointmentSchema = z2.object({
  fullName: z2.string().trim().min(2, "Please enter patient full name").max(120),
  phone: z2.string().trim().refine((val) => val.replace(/\D/g, "").length >= 10 && val.length <= 16, {
    message: "Please enter a valid 10-digit mobile number"
  }),
  preferredService: z2.string().trim().max(160).optional(),
  preferredDate: z2.string().trim().max(32).optional(),
  preferredWindow: z2.enum(["MORNING", "AFTERNOON_EVENING", "EARLIEST_AVAILABLE"]).optional(),
  notes: z2.string().trim().max(600).optional()
});
router2.post("/quick-appointment", async (req, res) => {
  const parsed = quickAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    res.status(400).json({
      error: firstIssue || "Please enter your full name and a valid 10-digit mobile number."
    });
    return;
  }
  const {
    fullName,
    phone,
    preferredService,
    preferredDate,
    preferredWindow = "EARLIEST_AVAILABLE",
    notes
  } = parsed.data;
  const windowLabel = preferredWindow === "MORNING" ? "Morning Specialist Window (9:30 AM - 1:30 PM)" : preferredWindow === "AFTERNOON_EVENING" ? "Afternoon / Evening (2:00 PM - 8:00 PM)" : "Earliest Available Slot";
  const summaryParts = [
    "[Quick Appointment Request]",
    preferredDate ? `Preferred Date: ${preferredDate}` : "Preferred Date: Flexible",
    `Session: ${windowLabel}`,
    notes ? `Notes: ${notes}` : null
  ].filter(Boolean);
  const leadCode = `QCK-${crypto6.randomBytes(3).toString("hex").toUpperCase()}`;
  const dueAt = new Date(Date.now() + 60 * 60 * 1e3);
  const lead = await prisma.crmLead.create({
    data: {
      leadCode,
      fullName,
      phone,
      source: "BOOKING_INQUIRY",
      interestedService: preferredService || "General Diagnostic / Consultation",
      message: summaryParts.join(" | "),
      followUpDueAt: dueAt,
      status: "NEW"
    }
  });
  await prisma.crmTask.create({
    data: {
      leadId: lead.id,
      title: `Quick Appointment callback: ${lead.fullName} (${leadCode})`,
      dueAt
    }
  });
  await logAudit({
    action: "PUBLIC_QUICK_APPOINTMENT_REQUESTED",
    resourceType: "CrmLead",
    resourceId: lead.id,
    summary: `Quick appointment request ${lead.leadCode} logged for ${lead.fullName}`,
    ipAddress: req.ip
  });
  await dispatchN8nEvent({
    eventId: `crm-quick-${lead.id}`,
    eventType: "crm.inquiry_created",
    payload: {
      leadCode: lead.leadCode,
      fullName: lead.fullName,
      phone: lead.phone,
      source: "QUICK_APPOINTMENT",
      preferredService: lead.interestedService,
      preferredDate: preferredDate || null,
      preferredWindow
    }
  });
  await dispatchWhatsAppMessage({
    eventId: `wa-quick-${lead.id}`,
    recipientPhone: lead.phone,
    templateKey: "INQUIRY_ACKNOWLEDGMENT",
    messageBody: `EDFIC (A Unit of EWA DERMA): Your Quick Appointment request (${lead.leadCode}) for ${lead.interestedService} has been received. EDFIC Reception will call you shortly to confirm your slot.`
  });
  res.status(201).json({
    leadCode: lead.leadCode,
    preferredService: lead.interestedService,
    windowLabel,
    preferredDate: preferredDate || "Flexible",
    message: "Your Quick Appointment request has been received. EDFIC Reception will call you shortly to confirm your slot."
  });
});
var chatSchema = z2.object({
  message: z2.string().min(1).max(1e3),
  action: z2.enum(["ASK", "SUBMIT_TO_RECEPTION"]).optional(),
  fullName: z2.string().min(2).max(120).optional(),
  phone: z2.string().min(10).max(15).optional(),
  email: z2.string().email().optional().or(z2.literal("")),
  interestedService: z2.string().max(160).optional()
});
router2.post("/chat", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid message or contact inquiry." });
    return;
  }
  const { action, message, fullName, phone, email, interestedService } = parsed.data;
  if (action === "SUBMIT_TO_RECEPTION") {
    if (!fullName || !phone || phone.replace(/\D/g, "").length < 10) {
      res.status(400).json({
        error: "Please provide your full name and a valid 10-digit mobile number for reception follow-up."
      });
      return;
    }
    const leadCode = `CRM-${crypto6.randomBytes(3).toString("hex").toUpperCase()}`;
    const lead = await prisma.crmLead.create({
      data: {
        leadCode,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        source: "WEBSITE_CONTACT",
        interestedService: interestedService?.trim() || null,
        message: `[Reception Chatbot] ${message.trim()}`,
        status: "NEW"
      }
    });
    await prisma.crmTask.create({
      data: {
        leadId: lead.id,
        title: `Follow up chatbot inquiry ${leadCode} (${lead.fullName})`,
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1e3)
      }
    });
    await logAudit({
      action: "PUBLIC_CHATBOT_INQUIRY_SUBMITTED",
      resourceType: "CrmLead",
      resourceId: lead.id,
      summary: `Chatbot handoff ${lead.leadCode} logged for ${lead.fullName}`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `crm-chatbot-${lead.id}`,
      eventType: "crm.inquiry_created",
      payload: {
        leadCode: lead.leadCode,
        fullName: lead.fullName,
        source: "RECEPTION_CHATBOT",
        interestedService: lead.interestedService,
        phone: lead.phone
      }
    });
    await dispatchWhatsAppMessage({
      eventId: `wa-chatbot-${lead.id}`,
      recipientPhone: lead.phone,
      templateKey: "INQUIRY_ACKNOWLEDGMENT",
      messageBody: `EDFIC (A Unit of EWA DERMA): Your chat inquiry (${lead.leadCode}) has been forwarded to EDFIC Reception at Sushant Golf City, Lucknow. Our team will contact you shortly.`
    });
    res.status(201).json({
      handoffComplete: true,
      leadCode: lead.leadCode,
      reply: `Thank you, ${lead.fullName}. Your query has been logged directly with EDFIC Reception under reference ${lead.leadCode}. A follow-up task has been queued for our reception team.`,
      suggestedRoute: { label: "Book Appointment Slot", to: "/book" }
    });
    return;
  }
  const q = message.trim();
  const lower = q.toLowerCase();
  const [clinic, services] = await Promise.all([
    prisma.clinicSetting.findUnique({ where: { id: "singleton" } }),
    prisma.diagnosticService.findMany({
      where: { isVisiblePublic: true, approvalStatus: "PUBLISHED", category: { isVisible: true } },
      select: {
        slug: true,
        name: true,
        summary: true,
        preparationNotes: true,
        durationMinutes: true,
        requiresDoctorMorning: true
      }
    })
  ]);
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
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true }
        }
      }
    });
    if (!appt) {
      res.json({
        reply: `No booking was found matching reference ${bookingRefMatch[0]}. Please verify the reference code or send your mobile number to EDFIC Reception for assistance.`,
        promptReceptionHandoff: true,
        suggestedRoute: { label: "Book Appointment", to: "/book" }
      });
      return;
    }
    const latestPaymentStatus = appt.payments[0]?.status?.replace(/_/g, " ") || "PENDING";
    res.json({
      reply: `Booking ${appt.bookingReference} (${appt.service.name}) is scheduled for ${appt.appointmentDate} at ${appt.startTime}. Appointment status: ${appt.status.replace(/_/g, " ")}. UPI verification status: ${latestPaymentStatus}.`,
      suggestedRoute: { label: "Track / Manage in Portal", to: "/portal" }
    });
    return;
  }
  if (/\b(address|where|location|directions|map|lulu|sushant|lucknow|reach)\b/.test(lower)) {
    res.json({
      reply: `EDFIC (A Unit of EWA DERMA) is located at ${clinic?.addressLine || "Unit 10, Millennium Place, Sushant Golf City"} (${clinic?.landmark || "Near Lulu Mall"}), ${clinic?.cityStateCountry || "Lucknow, Uttar Pradesh, India"}.`,
      suggestedRoute: { label: "View Contact & Directions", to: "/contact" }
    });
    return;
  }
  if (/\b(time|timing|hours|open|close|sunday|varun|doctor|morning|schedule|when)\b/.test(lower)) {
    res.json({
      reply: `Operating hours: ${clinic?.weekdayHours || "Monday\u2013Saturday: 9:00 AM \u2013 8:00 PM"}, ${clinic?.sundayHours || "Sunday: 10:00 AM \u2013 2:00 PM (By Appointment)"}. Specialist fetal imaging sessions led by Dr. Varun Agrawal (DNB Radiology) run daily during the morning session (${clinic?.morningSessionStart || "09:30"}\u2013${clinic?.morningSessionEnd || "13:30"}).`,
      suggestedRoute: { label: "View Doctor & Slots", to: "/doctor" }
    });
    return;
  }
  if (/\b(book|appointment|slot|upi|utr|advance|reschedule|cancel)\b/.test(lower)) {
    res.json({
      reply: "To book an ultrasound or fetal scan, select your service and preferred time slot on our Book Appointment page, complete the UPI advance transfer, and enter your UTR reference. EDFIC reception manually verifies payments before final confirmation.",
      suggestedRoute: { label: "Book Appointment Now", to: "/book" }
    });
    return;
  }
  if (/\b(report|pdf|result|download|portal)\b/.test(lower)) {
    res.json({
      reply: "For medical privacy, finalized ultrasound and Doppler PDFs are published strictly inside your authenticated EDFIC Patient Portal account - never sent through unsecured public links.",
      suggestedRoute: { label: "Open Patient Portal", to: "/portal" }
    });
    return;
  }
  if (/\b(pcpndt|sex|gender|boy|girl|id|aadhaar|prescription|document|form\s*f)\b/.test(lower)) {
    res.json({
      reply: "EDFIC strictly follows the PCPNDT Act: prenatal sex determination is prohibited by law. For obstetric scans, patients must bring a valid government photo ID, referring clinician prescription, and prior reports for mandatory Form F compliance.",
      suggestedRoute: { label: "Read Patient Guidelines", to: "/patient-info" }
    });
    return;
  }
  if (/\b(price|cost|fee|fees|rate|charges|discount|how much|rupees|rs)\b/.test(lower)) {
    res.json({
      reply: "Investigation charges vary by prescribed study and are shared directly by our reception desk rather than posted as promotional pricing online. Would you like me to forward your inquiry to EDFIC Reception for exact details?",
      promptReceptionHandoff: true
    });
    return;
  }
  const matchedService = services.find((svc) => {
    const svcLower = svc.name.toLowerCase();
    if (lower.includes(svcLower)) return true;
    const tokens = svcLower.split(/[\s/(),-]+/).filter((t) => t.length >= 4);
    return tokens.some((token) => lower.includes(token));
  });
  if (matchedService) {
    res.json({
      reply: `${matchedService.name} (~${matchedService.durationMinutes} mins${matchedService.requiresDoctorMorning ? ", morning specialist window" : ""}): ${matchedService.summary} Preparation: ${matchedService.preparationNotes}`,
      suggestedRoute: { label: `View ${matchedService.name}`, to: `/services/${matchedService.slug}` }
    });
    return;
  }
  if (/\b(prep|preparation|fasting|bladder|water|drink|eat|before)\b/.test(lower)) {
    res.json({
      reply: "Preparation depends on your prescribed scan: Whole Abdomen & Renal Doppler require 6\u20138 hours fasting, while KUB & early pelvic scans require a comfortably full bladder. You can also send your prescribed scan name directly to reception below.",
      promptReceptionHandoff: true,
      suggestedRoute: { label: "Full Preparation Checklist", to: "/patient-info" }
    });
    return;
  }
  res.json({
    reply: "I can help with EDFIC timings, Sushant Golf City directions, ultrasound preparation, booking steps, Patient Portal reports, or check a booking code (e.g. EDF-...). You can also send your question directly to our Reception Desk right here.",
    promptReceptionHandoff: true
  });
});
var public_routes_default = router2;

// server/routes/appointments.routes.ts
import crypto7 from "crypto";
import { Router as Router3 } from "express";
import { z as z3 } from "zod";
var router3 = Router3();
var holdSchema = z3.object({
  serviceId: z3.string().min(1),
  date: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z3.string().regex(/^\d{2}:\d{2}$/),
  sessionToken: z3.string().min(8).max(80)
});
var bookSchema = z3.object({
  serviceId: z3.string().min(1),
  date: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z3.string().regex(/^\d{2}:\d{2}$/),
  sessionToken: z3.string().optional(),
  patientName: z3.string().min(2).max(120),
  patientPhone: z3.string().min(10).max(15),
  patientEmail: z3.string().email().optional().or(z3.literal("")),
  dateOfBirth: z3.string().optional(),
  clinicalIndication: z3.string().max(600).optional(),
  referringDoctor: z3.string().max(120).optional(),
  bookingChannel: z3.enum(["ONLINE", "PHONE", "WALK_IN"]).optional(),
  consentAccepted: z3.literal(true, {
    message: "Patient consent and PCPNDT notice acknowledgment required."
  }),
  isReceptionOverride: z3.boolean().optional(),
  overrideReason: z3.string().max(300).optional(),
  notes: z3.string().max(600).optional()
});
var lookupSchema = z3.object({
  bookingReference: z3.string().min(6).max(32),
  phone: z3.string().min(10).max(15)
});
var rescheduleSchema = z3.object({
  date: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z3.string().regex(/^\d{2}:\d{2}$/),
  isReceptionOverride: z3.boolean().optional(),
  reason: z3.string().max(300).optional()
});
router3.get("/slots", async (req, res) => {
  const date = String(req.query.date || "");
  const serviceId = String(req.query.serviceId || "");
  const sessionToken = req.query.sessionToken ? String(req.query.sessionToken) : void 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
    res.status(400).json({ error: "Valid date (YYYY-MM-DD) and serviceId are required." });
    return;
  }
  try {
    const result = await getAvailableSlots({ date, serviceId, sessionToken });
    res.json(result);
  } catch (err) {
    res.status(404).json({
      error: err instanceof Error ? err.message : "Unable to compute slots."
    });
  }
});
router3.post("/hold", async (req, res) => {
  const parsed = holdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid slot hold parameters." });
    return;
  }
  try {
    const held = await holdSlotAtomic(parsed.data);
    res.json({
      heldUntil: held.heldUntil.toISOString(),
      startTime: held.startTime,
      date: held.date
    });
  } catch (err) {
    res.status(409).json({
      error: err instanceof Error ? err.message : "This time slot is no longer available."
    });
  }
});
router3.post("/book", authenticateOptional, async (req, res) => {
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid appointment booking details."
    });
    return;
  }
  const data = parsed.data;
  const isStaff = Boolean(
    req.auth && ["SUPER_ADMIN", "RECEPTION"].includes(req.auth.role)
  );
  const bookingChannel = isStaff ? data.bookingChannel || "PHONE" : "ONLINE";
  try {
    const result = await bookAppointmentAtomic({
      ...data,
      bookingChannel,
      actorUserId: req.auth?.userId,
      actorRole: req.auth?.role
    });
    await logAudit({
      actorUserId: req.auth?.userId ?? null,
      actorRole: req.auth?.role ?? "PUBLIC",
      action: bookingChannel === "PHONE" ? "PHONE_APPOINTMENT_CREATED" : "APPOINTMENT_CREATED",
      resourceType: "Appointment",
      resourceId: result.appointment.id,
      summary: `Booked ${result.appointment.bookingReference} (${bookingChannel}) for ${result.appointment.service.name} on ${result.appointment.appointmentDate} ${result.appointment.startTime}`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `appt-created-${result.appointment.id}`,
      eventType: "appointment.created",
      payload: {
        bookingReference: result.appointment.bookingReference,
        bookingChannel,
        serviceName: result.appointment.service.name,
        appointmentDate: result.appointment.appointmentDate,
        startTime: result.appointment.startTime,
        patientPhone: result.appointment.patientPhone,
        patientEmail: result.appointment.patientEmail
      }
    });
    await dispatchWhatsAppMessage({
      eventId: `wa-appt-ack-${result.appointment.id}`,
      recipientPhone: result.appointment.patientPhone,
      templateKey: "APPOINTMENT_ACKNOWLEDGMENT",
      appointmentId: result.appointment.id,
      templateVariables: [
        result.appointment.bookingReference,
        result.appointment.service.name,
        result.appointment.appointmentDate,
        result.appointment.startTime
      ],
      messageBody: `EDFIC (A Unit of EWA DERMA): Appointment request ${result.appointment.bookingReference} received for ${result.appointment.service.name} on ${result.appointment.appointmentDate} at ${result.appointment.startTime}.`
    });
    if (result.appointment.status === "PENDING_ADVANCE") {
      await dispatchWhatsAppMessage({
        eventId: `wa-pay-instr-${result.appointment.id}`,
        recipientPhone: result.appointment.patientPhone,
        templateKey: "PAYMENT_INSTRUCTIONS",
        appointmentId: result.appointment.id,
        templateVariables: [
          result.appointment.bookingReference,
          String(result.upiPayment.expectedAdvanceInr),
          result.upiPayment.upiId
        ],
        messageBody: `EDFIC UPI Instructions (${result.appointment.bookingReference}): Please pay advance INR ${result.upiPayment.expectedAdvanceInr} to UPI ID ${result.upiPayment.upiId} (${result.upiPayment.merchantName}) and submit your UTR on the EDFIC booking portal for manual reception verification.`
      });
    }
    await dispatchEmailNotification({
      eventId: `appt-created-${result.appointment.id}`,
      recipientEmail: result.appointment.patientEmail,
      templateKey: "APPOINTMENT_ACKNOWLEDGMENT",
      bookingReference: result.appointment.bookingReference,
      subject: `EDFIC Appointment Request ${result.appointment.bookingReference}`,
      bodyText: `Your appointment request ${result.appointment.bookingReference} for ${result.appointment.service.name} on ${result.appointment.appointmentDate} at ${result.appointment.startTime} has been registered.`
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({
      error: err instanceof Error ? err.message : "Unable to book appointment."
    });
  }
});
router3.post("/lookup", async (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Booking reference and 10-digit phone number required." });
    return;
  }
  await expireStaleReservations();
  const appointment = await prisma.appointment.findFirst({
    where: {
      bookingReference: parsed.data.bookingReference.trim().toUpperCase(),
      patientPhone: parsed.data.phone.trim()
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          preparationNotes: true,
          durationMinutes: true,
          advanceAmountInr: true
        }
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          receiptNumber: true,
          paymentMethod: true,
          expectedAdvanceInr: true,
          amountSubmittedInr: true,
          totalServiceFeeInr: true,
          utrReference: true,
          paymentDate: true,
          status: true,
          rejectionReason: true,
          verifiedAt: true
        }
      }
    }
  });
  if (!appointment) {
    res.status(404).json({
      error: "No matching appointment found for that booking reference and phone number."
    });
    return;
  }
  const settings = await prisma.clinicSetting.findUnique({ where: { id: "singleton" } });
  res.json({
    appointment,
    upiPayment: {
      upiId: settings?.upiId || "edfic.lucknow@upi",
      merchantName: settings?.upiMerchantName || "EWA Diagnostic & Fetal Imaging Centre",
      expectedAdvanceInr: appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500
    }
  });
});
router3.get(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    await expireStaleReservations();
    const date = req.query.date ? String(req.query.date) : void 0;
    const status = req.query.status ? String(req.query.status) : void 0;
    const appointments = await prisma.appointment.findMany({
      where: {
        ...date ? { appointmentDate: date } : {},
        ...status ? { status } : {}
      },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            fullName: true,
            phone: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            requiresDoctorMorning: true,
            advanceAmountInr: true
          }
        },
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            receiptNumber: true,
            paymentMethod: true,
            expectedAdvanceInr: true,
            amountSubmittedInr: true,
            totalServiceFeeInr: true,
            utrReference: true,
            paymentDate: true,
            status: true,
            verifiedAt: true
          }
        },
        visit: {
          select: {
            id: true,
            visitNumber: true,
            status: true
          }
        }
      }
    });
    res.json({ appointments });
  }
);
router3.post(
  "/:id/confirm",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { payments: true, service: true }
    });
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found." });
      return;
    }
    const hasVerifiedPayment = appointment.payments.some((p) => p.status === "VERIFIED");
    const override = Boolean(req.body?.isReceptionOverride);
    if (!hasVerifiedPayment && !override) {
      res.status(422).json({
        error: "Appointment requires a verified advance payment before confirmation unless Reception Override is explicitly authorized."
      });
      return;
    }
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CONFIRMED",
        reservationExpiresAt: null,
        isReceptionOverride: appointment.isReceptionOverride || override,
        overrideReason: override ? String(req.body?.overrideReason || "Confirmed by reception override") : appointment.overrideReason
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "APPOINTMENT_CONFIRMED",
      resourceType: "Appointment",
      resourceId: updated.id,
      summary: `Confirmed ${updated.bookingReference} (override: ${override})`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `appt-confirmed-${updated.id}`,
      eventType: "appointment.confirmed",
      payload: {
        bookingReference: updated.bookingReference,
        serviceName: appointment.service.name,
        appointmentDate: updated.appointmentDate,
        startTime: updated.startTime,
        patientPhone: updated.patientPhone,
        patientEmail: updated.patientEmail
      }
    });
    await dispatchWhatsAppMessage({
      recipientPhone: updated.patientPhone,
      templateKey: "APPOINTMENT_CONFIRMED",
      appointmentId: updated.id,
      messageBody: `EDFIC Confirmation: Your appointment ${updated.bookingReference} for ${appointment.service.name} is confirmed on ${updated.appointmentDate} at ${updated.startTime}.`
    });
    await dispatchEmailNotification({
      eventId: `appt-confirmed-${updated.id}`,
      recipientEmail: updated.patientEmail,
      templateKey: "APPOINTMENT_CONFIRMED",
      bookingReference: updated.bookingReference,
      subject: `EDFIC Appointment Confirmed: ${updated.bookingReference}`,
      bodyText: `Your appointment ${updated.bookingReference} for ${appointment.service.name} is confirmed on ${updated.appointmentDate} at ${updated.startTime}.`
    });
    res.json({ appointment: updated });
  }
);
router3.patch(
  "/:id/notes",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 1200) : "";
    const existing = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Appointment not found." });
      return;
    }
    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: { notes }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "APPOINTMENT_NOTES_UPDATED",
      resourceType: "Appointment",
      resourceId: updated.id,
      summary: `Updated operational notes on ${updated.bookingReference}`,
      ipAddress: req.ip
    });
    res.json({ appointment: updated });
  }
);
router3.patch("/:id/reschedule", requireAuth, async (req, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid target date and time are required." });
    return;
  }
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { patient: true, service: true }
  });
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }
  const isStaff = ["SUPER_ADMIN", "RECEPTION"].includes(req.auth.role);
  const isOwner = appointment.patient.userId === req.auth.userId;
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: "Access denied." });
    return;
  }
  const allowOverride = Boolean(parsed.data.isReceptionOverride) && isStaff;
  try {
    const updated = await withDateLock(parsed.data.date, async () => {
      if (!allowOverride) {
        const avail = await getAvailableSlots({
          date: parsed.data.date,
          serviceId: appointment.serviceId
        });
        const slot = avail.slots.find((s) => s.startTime === parsed.data.startTime);
        if (!slot || !slot.available) {
          throw new Error(slot?.reason || "Requested reschedule slot is not available.");
        }
      }
      const endTime = minutesToTime(
        timeToMinutes(parsed.data.startTime) + (appointment.service.durationMinutes || 30)
      );
      return prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          appointmentDate: parsed.data.date,
          startTime: parsed.data.startTime,
          endTime,
          isReceptionOverride: allowOverride,
          notes: parsed.data.reason ? `${appointment.notes ? appointment.notes + "\n" : ""}Rescheduled: ${parsed.data.reason}` : appointment.notes
        }
      });
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "APPOINTMENT_RESCHEDULED",
      resourceType: "Appointment",
      resourceId: updated.id,
      summary: `Rescheduled ${updated.bookingReference} to ${updated.appointmentDate} ${updated.startTime}`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `appt-rescheduled-${updated.id}-${Date.now()}`,
      eventType: "appointment.rescheduled",
      payload: {
        bookingReference: updated.bookingReference,
        appointmentDate: updated.appointmentDate,
        startTime: updated.startTime,
        patientPhone: updated.patientPhone,
        patientEmail: updated.patientEmail
      }
    });
    await dispatchWhatsAppMessage({
      recipientPhone: updated.patientPhone,
      templateKey: "APPOINTMENT_RESCHEDULED",
      appointmentId: updated.id,
      messageBody: `EDFIC Update: Appointment ${updated.bookingReference} has been rescheduled to ${updated.appointmentDate} at ${updated.startTime}.`
    });
    await dispatchEmailNotification({
      eventId: `appt-rescheduled-${updated.id}-${Date.now()}`,
      recipientEmail: updated.patientEmail,
      templateKey: "APPOINTMENT_RESCHEDULED",
      bookingReference: updated.bookingReference,
      subject: `EDFIC Appointment Rescheduled: ${updated.bookingReference}`,
      bodyText: `Your appointment ${updated.bookingReference} has been rescheduled to ${updated.appointmentDate} at ${updated.startTime}.`
    });
    res.json({ appointment: updated });
  } catch (err) {
    res.status(409).json({
      error: err instanceof Error ? err.message : "Unable to reschedule appointment."
    });
  }
});
router3.patch("/:id/cancel", requireAuth, async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { patient: true }
  });
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }
  const isStaff = ["SUPER_ADMIN", "RECEPTION"].includes(req.auth.role);
  const isOwner = appointment.patient.userId === req.auth.userId;
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: "Access denied." });
    return;
  }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 300) : "Cancelled by request";
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: "CANCELLED",
      cancelledReason: reason
    }
  });
  await logAudit({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "APPOINTMENT_CANCELLED",
    resourceType: "Appointment",
    resourceId: updated.id,
    summary: `Cancelled ${updated.bookingReference}: ${reason}`,
    ipAddress: req.ip
  });
  await dispatchN8nEvent({
    eventId: `appt-cancelled-${updated.id}-${Date.now()}`,
    eventType: "appointment.cancelled",
    payload: {
      bookingReference: updated.bookingReference,
      reason,
      patientPhone: updated.patientPhone
    }
  });
  await dispatchWhatsAppMessage({
    eventId: `wa-appt-cancel-${updated.id}`,
    recipientPhone: updated.patientPhone,
    templateKey: "APPOINTMENT_CANCELLED",
    appointmentId: updated.id,
    templateVariables: [updated.bookingReference],
    messageBody: `EDFIC Notice: Appointment ${updated.bookingReference} has been cancelled (${reason}). Please contact EDFIC Reception to schedule another visit.`
  });
  res.json({ appointment: updated });
});
router3.post(
  "/:id/check-in",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { visit: true }
    });
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found." });
      return;
    }
    if (appointment.visit) {
      res.json({ visit: appointment.visit });
      return;
    }
    const visitNumber = `VIS-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}-${crypto7.randomBytes(2).toString("hex").toUpperCase()}`;
    const visit = await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: "CHECKED_IN" }
      });
      return tx.visit.create({
        data: {
          visitNumber,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId ?? null,
          status: "WAITING"
        }
      });
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PATIENT_CHECKED_IN",
      resourceType: "Visit",
      resourceId: visit.id,
      summary: `Checked in ${appointment.bookingReference} as visit ${visit.visitNumber}`,
      ipAddress: req.ip
    });
    res.status(201).json({ visit });
  }
);
var appointments_routes_default = router3;

// server/routes/payments.routes.ts
import crypto8 from "crypto";
import path3 from "path";
import { Router as Router4 } from "express";
import multer from "multer";
import { z as z4 } from "zod";
var router4 = Router4();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
  // 5 MB max
});
var submitUtrSchema = z4.object({
  bookingReference: z4.string().min(6).max(32),
  phone: z4.string().min(10).max(15),
  utrReference: z4.string().min(6).max(60),
  amountSubmittedInr: z4.coerce.number().int().min(100).max(1e5),
  paymentDate: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z4.string().max(400).optional()
});
var manualPaymentSchema = z4.object({
  appointmentId: z4.string().min(1),
  paymentMethod: z4.enum(["UPI", "CASH", "CARD", "BANK_TRANSFER"]).default("UPI"),
  utrReference: z4.string().min(2).max(60),
  amountSubmittedInr: z4.coerce.number().int().min(1).max(2e5),
  totalServiceFeeInr: z4.coerce.number().int().min(0).max(2e5).optional(),
  paymentDate: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  verifyImmediately: z4.boolean().default(true),
  notes: z4.string().max(400).optional()
});
var verifySchema = z4.object({
  totalServiceFeeInr: z4.coerce.number().int().min(0).max(2e5).optional(),
  notes: z4.string().max(400).optional()
});
var rejectSchema = z4.object({
  rejectionReason: z4.string().min(4).max(300)
});
var refundSchema = z4.object({
  refundReason: z4.string().min(4).max(300)
});
function nextReceiptNumber() {
  return `RCPT-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}-${crypto8.randomBytes(2).toString("hex").toUpperCase()}`;
}
router4.post(
  "/submit-utr",
  authenticateOptional,
  upload.single("evidence"),
  async (req, res) => {
    const parsed = submitUtrSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Valid booking reference, phone, UTR/reference, amount, and payment date are required."
      });
      return;
    }
    const appointment = await prisma.appointment.findFirst({
      where: {
        bookingReference: parsed.data.bookingReference.trim().toUpperCase(),
        patientPhone: parsed.data.phone.trim()
      },
      include: {
        service: true
      }
    });
    if (!appointment) {
      res.status(404).json({
        error: "Matching appointment not found for that booking reference and phone."
      });
      return;
    }
    if (appointment.status === "CANCELLED") {
      res.status(409).json({
        error: "This appointment has been cancelled or expired. Please reserve a fresh slot."
      });
      return;
    }
    let evidenceFilePath = null;
    let evidenceMimeType = null;
    if (req.file) {
      if (!isValidEvidenceBuffer(req.file.buffer, req.file.mimetype)) {
        res.status(400).json({
          error: "Evidence file must be a valid PNG, JPEG, or PDF document."
        });
        return;
      }
      const ext = path3.extname(req.file.originalname) || ".png";
      evidenceFilePath = savePrivateFile(EVIDENCE_DIR, ext, req.file.buffer);
      evidenceMimeType = req.file.mimetype;
    }
    const settings = await prisma.clinicSetting.findUnique({ where: { id: "singleton" } });
    const expectedAdvanceInr = appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500;
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          paymentMethod: "UPI",
          expectedAdvanceInr,
          amountSubmittedInr: parsed.data.amountSubmittedInr,
          utrReference: parsed.data.utrReference.trim(),
          paymentDate: parsed.data.paymentDate,
          evidenceFilePath,
          evidenceMimeType,
          status: "SUBMITTED",
          notes: parsed.data.notes?.trim() || null
        }
      });
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "ADVANCE_SUBMITTED",
          reservationExpiresAt: null
        }
      });
      return created;
    });
    await logAudit({
      actorUserId: req.auth?.userId ?? null,
      actorRole: req.auth?.role ?? "PUBLIC",
      action: "UPI_PAYMENT_SUBMITTED",
      resourceType: "Payment",
      resourceId: payment.id,
      summary: `UTR ${payment.utrReference} (INR ${payment.amountSubmittedInr}) submitted for ${appointment.bookingReference}; awaiting manual reception verification`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `pay-sub-${payment.id}`,
      eventType: "payment.submitted",
      payload: {
        bookingReference: appointment.bookingReference,
        utrReference: payment.utrReference,
        amountSubmittedInr: payment.amountSubmittedInr,
        patientPhone: appointment.patientPhone
      }
    });
    res.status(201).json({
      payment: {
        id: payment.id,
        status: payment.status,
        utrReference: payment.utrReference,
        amountSubmittedInr: payment.amountSubmittedInr,
        paymentDate: payment.paymentDate
      },
      message: "Payment reference recorded (status: Submitted). EDFIC reception staff will manually verify the transaction before confirming your slot."
    });
  }
);
router4.post(
  "/manual",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = manualPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid appointmentId, method, reference, and amount required." });
      return;
    }
    const appointment = await prisma.appointment.findUnique({
      where: { id: parsed.data.appointmentId },
      include: { service: true, patient: true }
    });
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found." });
      return;
    }
    const settings = await prisma.clinicSetting.findUnique({ where: { id: "singleton" } });
    const expectedAdvanceInr = appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500;
    const payDate = parsed.data.paymentDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const receiptNumber = parsed.data.verifyImmediately ? nextReceiptNumber() : null;
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          receiptNumber,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          paymentMethod: parsed.data.paymentMethod,
          expectedAdvanceInr,
          amountSubmittedInr: parsed.data.amountSubmittedInr,
          totalServiceFeeInr: parsed.data.totalServiceFeeInr ?? 0,
          utrReference: parsed.data.utrReference.trim(),
          paymentDate: payDate,
          status: parsed.data.verifyImmediately ? "VERIFIED" : "UNDER_VERIFICATION",
          verifiedById: parsed.data.verifyImmediately ? req.auth.userId : null,
          verifiedAt: parsed.data.verifyImmediately ? /* @__PURE__ */ new Date() : null,
          notes: parsed.data.notes?.trim() || "Recorded at EDFIC reception desk"
        }
      });
      if (parsed.data.verifyImmediately) {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status: appointment.status === "PENDING_ADVANCE" || appointment.status === "ADVANCE_SUBMITTED" ? "CONFIRMED" : appointment.status,
            reservationExpiresAt: null
          }
        });
      }
      return created;
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "MANUAL_PAYMENT_RECORDED",
      resourceType: "Payment",
      resourceId: payment.id,
      summary: `Recorded ${payment.paymentMethod} payment INR ${payment.amountSubmittedInr} (${payment.status}) for ${appointment.bookingReference}`,
      ipAddress: req.ip
    });
    if (payment.status === "VERIFIED") {
      await dispatchN8nEvent({
        eventId: `pay-verified-${payment.id}`,
        eventType: "payment.verified",
        payload: {
          receiptNumber: payment.receiptNumber,
          bookingReference: appointment.bookingReference,
          amountVerifiedInr: payment.amountSubmittedInr,
          paymentMethod: payment.paymentMethod
        }
      });
      await dispatchWhatsAppMessage({
        eventId: `wa-pay-verified-${payment.id}`,
        recipientPhone: appointment.patient.phone,
        templateKey: "PAYMENT_ACKNOWLEDGED",
        appointmentId: appointment.id,
        templateVariables: [
          payment.receiptNumber || payment.utrReference,
          String(payment.amountSubmittedInr),
          appointment.bookingReference
        ],
        messageBody: `EDFIC Payment Verified: INR ${payment.amountSubmittedInr} (Receipt ${payment.receiptNumber || payment.utrReference}) confirmed for booking ${appointment.bookingReference}.`
      });
      if (appointment.status === "PENDING_ADVANCE" || appointment.status === "ADVANCE_SUBMITTED") {
        await dispatchN8nEvent({
          eventId: `appt-confirmed-${appointment.id}`,
          eventType: "appointment.confirmed",
          payload: {
            bookingReference: appointment.bookingReference,
            serviceName: appointment.service.name,
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.startTime,
            patientPhone: appointment.patientPhone
          }
        });
        await dispatchWhatsAppMessage({
          eventId: `wa-appt-confirmed-${appointment.id}`,
          recipientPhone: appointment.patientPhone,
          templateKey: "APPOINTMENT_CONFIRMED",
          appointmentId: appointment.id,
          templateVariables: [
            appointment.bookingReference,
            appointment.service.name,
            appointment.appointmentDate,
            appointment.startTime
          ],
          messageBody: `EDFIC Confirmation: Your appointment ${appointment.bookingReference} for ${appointment.service.name} is confirmed on ${appointment.appointmentDate} at ${appointment.startTime}.`
        });
      }
    }
    res.status(201).json({ payment });
  }
);
router4.get(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const status = req.query.status ? String(req.query.status) : void 0;
    const payments = await prisma.payment.findMany({
      where: status ? { status } : void 0,
      orderBy: { createdAt: "desc" },
      include: {
        appointment: {
          select: {
            id: true,
            bookingReference: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            service: { select: { name: true } }
          }
        },
        patient: {
          select: {
            id: true,
            patientCode: true,
            fullName: true,
            phone: true
          }
        },
        verifiedBy: {
          select: { fullName: true }
        }
      }
    });
    res.json({ payments });
  }
);
router4.get(
  "/:id/evidence",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment || !payment.evidenceFilePath) {
      res.status(404).json({ error: "Payment evidence file not found." });
      return;
    }
    const fullPath = resolvePrivateFile(EVIDENCE_DIR, payment.evidenceFilePath);
    if (!fullPath) {
      res.status(404).json({ error: "Stored evidence file missing on disk." });
      return;
    }
    res.setHeader("Content-Type", payment.evidenceMimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(fullPath);
  }
);
router4.get("/:id/receipt", requireAuth, async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: {
      appointment: {
        include: {
          service: { select: { name: true, code: true } },
          payments: { where: { status: "VERIFIED" }, select: { amountSubmittedInr: true } }
        }
      },
      patient: {
        select: {
          userId: true,
          patientCode: true,
          fullName: true,
          phone: true
        }
      },
      verifiedBy: { select: { fullName: true } }
    }
  });
  if (!payment) {
    res.status(404).json({ error: "Payment receipt not found." });
    return;
  }
  const isStaff = ["SUPER_ADMIN", "RECEPTION"].includes(req.auth.role);
  const isOwner = payment.patient.userId === req.auth.userId;
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: "Access denied." });
    return;
  }
  const totalVerifiedForAppt = payment.appointment.payments.reduce(
    (sum, p) => sum + p.amountSubmittedInr,
    0
  );
  const balanceDueInr = payment.totalServiceFeeInr > 0 ? Math.max(0, payment.totalServiceFeeInr - totalVerifiedForAppt) : 0;
  res.json({
    receipt: {
      receiptNumber: payment.receiptNumber,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      utrReference: payment.utrReference,
      paymentDate: payment.paymentDate,
      amountPaidInr: payment.amountSubmittedInr,
      totalServiceFeeInr: payment.totalServiceFeeInr,
      totalVerifiedPaidInr: totalVerifiedForAppt,
      balanceDueInr,
      verifiedAt: payment.verifiedAt,
      verifiedBy: payment.verifiedBy?.fullName || null,
      bookingReference: payment.appointment.bookingReference,
      appointmentDate: payment.appointment.appointmentDate,
      startTime: payment.appointment.startTime,
      serviceName: payment.appointment.service.name,
      patient: {
        patientCode: payment.patient.patientCode,
        fullName: payment.patient.fullName,
        phone: payment.patient.phone
      }
    }
  });
});
router4.post(
  "/:id/under-verification",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { appointment: true }
    });
    if (!existing) {
      res.status(404).json({ error: "Payment record not found." });
      return;
    }
    const updated = await prisma.payment.update({
      where: { id: existing.id },
      data: { status: "UNDER_VERIFICATION" }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PAYMENT_UNDER_VERIFICATION",
      resourceType: "Payment",
      resourceId: updated.id,
      summary: `Marked UTR ${updated.utrReference} as Under Verification for ${existing.appointment.bookingReference}`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `pay-review-${updated.id}-${Date.now()}`,
      eventType: "payment.under_verification",
      payload: {
        bookingReference: existing.appointment.bookingReference,
        utrReference: updated.utrReference
      }
    });
    res.json({ payment: updated });
  }
);
router4.post(
  "/:id/verify",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid verification payload." });
      return;
    }
    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        appointment: { include: { service: true } },
        patient: true
      }
    });
    if (!existing) {
      res.status(404).json({ error: "Payment record not found." });
      return;
    }
    const receiptNumber = existing.receiptNumber || nextReceiptNumber();
    const updated = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: "VERIFIED",
          receiptNumber,
          totalServiceFeeInr: parsed.data.totalServiceFeeInr ?? existing.totalServiceFeeInr,
          verifiedById: req.auth.userId,
          verifiedAt: /* @__PURE__ */ new Date(),
          notes: parsed.data.notes?.trim() || existing.notes
        }
      });
      await tx.appointment.update({
        where: { id: existing.appointmentId },
        data: {
          status: "CONFIRMED",
          reservationExpiresAt: null
        }
      });
      return pay;
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PAYMENT_VERIFIED",
      resourceType: "Payment",
      resourceId: updated.id,
      summary: `Verified UTR ${updated.utrReference} (${receiptNumber}) for ${existing.appointment.bookingReference}`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `pay-verified-${updated.id}`,
      eventType: "payment.verified",
      payload: {
        receiptNumber,
        bookingReference: existing.appointment.bookingReference,
        amountVerifiedInr: updated.amountSubmittedInr,
        appointmentDate: existing.appointment.appointmentDate,
        startTime: existing.appointment.startTime
      }
    });
    await dispatchWhatsAppMessage({
      eventId: `wa-pay-verified-${updated.id}`,
      recipientPhone: existing.patient.phone,
      templateKey: "PAYMENT_ACKNOWLEDGED",
      appointmentId: existing.appointmentId,
      templateVariables: [
        receiptNumber,
        String(updated.amountSubmittedInr),
        existing.appointment.bookingReference
      ],
      messageBody: `EDFIC Payment Verified: Advance payment INR ${updated.amountSubmittedInr} (Receipt ${receiptNumber}) verified for ${existing.appointment.bookingReference}.`
    });
    await dispatchN8nEvent({
      eventId: `appt-confirmed-${existing.appointmentId}`,
      eventType: "appointment.confirmed",
      payload: {
        bookingReference: existing.appointment.bookingReference,
        serviceName: existing.appointment.service.name,
        appointmentDate: existing.appointment.appointmentDate,
        startTime: existing.appointment.startTime,
        patientPhone: existing.appointment.patientPhone,
        patientEmail: existing.appointment.patientEmail
      }
    });
    await dispatchWhatsAppMessage({
      eventId: `wa-appt-confirmed-${existing.appointmentId}`,
      recipientPhone: existing.patient.phone,
      templateKey: "APPOINTMENT_CONFIRMED",
      appointmentId: existing.appointmentId,
      templateVariables: [
        existing.appointment.bookingReference,
        existing.appointment.service.name,
        existing.appointment.appointmentDate,
        existing.appointment.startTime
      ],
      messageBody: `EDFIC Confirmation: Your appointment ${existing.appointment.bookingReference} for ${existing.appointment.service.name} is confirmed on ${existing.appointment.appointmentDate} at ${existing.appointment.startTime}.`
    });
    res.json({ payment: updated });
  }
);
router4.post(
  "/:id/reject",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Rejection reason is required." });
      return;
    }
    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { appointment: true, patient: true }
    });
    if (!existing) {
      res.status(404).json({ error: "Payment record not found." });
      return;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: "REJECTED",
          rejectionReason: parsed.data.rejectionReason.trim(),
          verifiedById: req.auth.userId,
          verifiedAt: /* @__PURE__ */ new Date()
        }
      });
      await tx.appointment.update({
        where: { id: existing.appointmentId },
        data: { status: "PENDING_ADVANCE" }
      });
      return pay;
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PAYMENT_REJECTED",
      resourceType: "Payment",
      resourceId: updated.id,
      summary: `Rejected UTR ${updated.utrReference} for ${existing.appointment.bookingReference}: ${parsed.data.rejectionReason}`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `pay-rejected-${updated.id}-${Date.now()}`,
      eventType: "payment.rejected",
      payload: {
        bookingReference: existing.appointment.bookingReference,
        utrReference: updated.utrReference,
        rejectionReason: updated.rejectionReason
      }
    });
    await dispatchWhatsAppMessage({
      recipientPhone: existing.patient.phone,
      templateKey: "PAYMENT_REJECTED",
      appointmentId: existing.appointmentId,
      messageBody: `EDFIC Payment Notice: Reference ${updated.utrReference} for ${existing.appointment.bookingReference} could not be verified (${parsed.data.rejectionReason.trim()}). Please re-submit a valid UTR on the booking portal.`
    });
    res.json({ payment: updated });
  }
);
router4.post(
  "/:id/refund",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Refund reason is required." });
      return;
    }
    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { appointment: true }
    });
    if (!existing) {
      res.status(404).json({ error: "Payment record not found." });
      return;
    }
    if (existing.status !== "VERIFIED") {
      res.status(422).json({ error: "Only verified payments can be marked as refunded." });
      return;
    }
    const updated = await prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: "REFUNDED",
        refundedAt: /* @__PURE__ */ new Date(),
        refundReason: parsed.data.refundReason.trim()
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PAYMENT_REFUNDED",
      resourceType: "Payment",
      resourceId: updated.id,
      summary: `Refunded payment ${updated.receiptNumber || updated.utrReference} for ${existing.appointment.bookingReference}: ${parsed.data.refundReason}`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `pay-refunded-${updated.id}`,
      eventType: "payment.refunded",
      payload: {
        receiptNumber: updated.receiptNumber,
        bookingReference: existing.appointment.bookingReference,
        amountRefundedInr: updated.amountSubmittedInr,
        refundReason: updated.refundReason
      }
    });
    res.json({ payment: updated });
  }
);
var payments_routes_default = router4;

// server/routes/patients.routes.ts
import { Router as Router5 } from "express";
import { z as z5 } from "zod";
var router5 = Router5();
var createPatientSchema = z5.object({
  fullName: z5.string().min(2).max(120),
  phone: z5.string().min(10).max(15),
  email: z5.string().email().optional().or(z5.literal("")),
  dateOfBirth: z5.string().optional(),
  gender: z5.string().max(30).optional(),
  address: z5.string().max(400).optional(),
  emergencyContact: z5.string().max(60).optional(),
  referredBy: z5.string().max(120).optional(),
  consentAccepted: z5.boolean().default(true),
  allowDuplicate: z5.boolean().optional()
});
var updatePatientSchema = z5.object({
  fullName: z5.string().min(2).max(120).optional(),
  phone: z5.string().min(10).max(15).optional(),
  email: z5.string().email().optional().or(z5.literal("")),
  dateOfBirth: z5.string().max(30).optional().nullable(),
  gender: z5.string().max(30).optional().nullable(),
  address: z5.string().max(400).optional().nullable(),
  emergencyContact: z5.string().max(60).optional().nullable(),
  referredBy: z5.string().max(120).optional().nullable(),
  consentAccepted: z5.boolean().optional()
});
var mergePatientsSchema = z5.object({
  sourcePatientId: z5.string().min(1),
  targetPatientId: z5.string().min(1),
  reason: z5.string().max(300).optional()
});
function normalizePhoneTail(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
router5.get("/me/portal", requireAuth, async (req, res) => {
  const patient = await prisma.patient.findFirst({
    where: { userId: req.auth.userId },
    include: {
      appointments: {
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              preparationNotes: true,
              advanceAmountInr: true
            }
          },
          payments: {
            orderBy: { createdAt: "desc" }
          }
        }
      },
      visits: {
        orderBy: { checkedInAt: "desc" },
        select: {
          id: true,
          visitNumber: true,
          checkedInAt: true,
          completedAt: true,
          status: true,
          appointment: {
            select: {
              bookingReference: true,
              service: { select: { name: true } }
            }
          }
        }
      },
      reports: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          reportCode: true,
          title: true,
          revisionNumber: true,
          fileName: true,
          fileSizeBytes: true,
          status: true,
          publishedAt: true,
          visit: { select: { visitNumber: true } }
        }
      }
    }
  });
  if (!patient) {
    res.json({ patient: null, appointments: [], visits: [], reports: [] });
    return;
  }
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" },
    select: { upiId: true, upiMerchantName: true, defaultAdvanceAmountInr: true }
  });
  res.json({
    patient: {
      id: patient.id,
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      phone: patient.phone,
      email: patient.email,
      dateOfBirth: patient.dateOfBirth,
      consentAccepted: patient.consentAccepted,
      consentTimestamp: patient.consentTimestamp
    },
    appointments: patient.appointments,
    visits: patient.visits,
    reports: patient.reports,
    upiConfig: settings
  });
});
router5.get(
  "/duplicates",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (_req, res) => {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { appointments: true, visits: true, reports: true, payments: true } }
      }
    });
    const groupsMap = /* @__PURE__ */ new Map();
    const byPhone = /* @__PURE__ */ new Map();
    const byEmail = /* @__PURE__ */ new Map();
    for (const pt of patients) {
      const pKey = normalizePhoneTail(pt.phone);
      if (pKey) {
        const list = byPhone.get(pKey) ?? [];
        list.push(pt);
        byPhone.set(pKey, list);
      }
      const eKey = pt.email?.trim().toLowerCase();
      if (eKey) {
        const list = byEmail.get(eKey) ?? [];
        list.push(pt);
        byEmail.set(eKey, list);
      }
    }
    for (const [pKey, list] of byPhone.entries()) {
      if (list.length > 1) {
        groupsMap.set(`phone:${pKey}`, {
          matchReason: `Matching mobile number (${pKey})`,
          patients: list
        });
      }
    }
    for (const [eKey, list] of byEmail.entries()) {
      if (list.length > 1) {
        const idsKey = list.map((x) => x.id).sort().join(",");
        const alreadyCovered = Array.from(groupsMap.values()).some(
          (g) => g.patients.map((x) => x.id).sort().join(",") === idsKey
        );
        if (!alreadyCovered) {
          groupsMap.set(`email:${eKey}`, {
            matchReason: `Matching email (${eKey})`,
            patients: list
          });
        }
      }
    }
    res.json({ duplicateGroups: Array.from(groupsMap.values()) });
  }
);
router5.get(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const q = String(req.query.q || "").trim();
    const patients = await prisma.patient.findMany({
      where: q ? {
        OR: [
          { fullName: { contains: q } },
          { phone: { contains: q } },
          { patientCode: { contains: q } },
          { email: { contains: q } }
        ]
      } : void 0,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        _count: {
          select: { appointments: true, visits: true, reports: true }
        }
      }
    });
    res.json({ patients });
  }
);
router5.post(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid patient full name and 10-digit phone are required." });
      return;
    }
    const tail = normalizePhoneTail(parsed.data.phone);
    const emailNorm = parsed.data.email?.trim().toLowerCase() || null;
    if (!parsed.data.allowDuplicate) {
      const potentialDuplicates = await prisma.patient.findMany({
        where: {
          OR: [
            { phone: { contains: tail } },
            ...emailNorm ? [{ email: emailNorm }] : []
          ]
        },
        take: 5,
        select: { id: true, patientCode: true, fullName: true, phone: true, email: true }
      });
      if (potentialDuplicates.length > 0) {
        res.status(409).json({
          error: `Duplicate protection: found existing patient record (${potentialDuplicates[0].patientCode} - ${potentialDuplicates[0].fullName}).`,
          potentialDuplicates
        });
        return;
      }
    }
    const patientCode = await generateNextPatientCode();
    const patient = await prisma.patient.create({
      data: {
        patientCode,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        email: emailNorm,
        dateOfBirth: parsed.data.dateOfBirth || null,
        gender: parsed.data.gender || null,
        address: parsed.data.address?.trim() || null,
        emergencyContact: parsed.data.emergencyContact?.trim() || null,
        referredBy: parsed.data.referredBy?.trim() || null,
        consentAccepted: parsed.data.consentAccepted,
        consentTimestamp: parsed.data.consentAccepted ? /* @__PURE__ */ new Date() : null
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PATIENT_CREATED",
      resourceType: "Patient",
      resourceId: patient.id,
      summary: `Created patient record ${patient.patientCode} (${patient.fullName})`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `patient-reg-${patient.id}`,
      eventType: "patient.registered",
      payload: {
        patientCode: patient.patientCode,
        registrationChannel: "STAFF_DESK",
        consentAccepted: patient.consentAccepted
      }
    });
    res.status(201).json({ patient });
  }
);
router5.patch(
  "/:id",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = updatePatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid patient update payload." });
      return;
    }
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Patient record not found." });
      return;
    }
    const patient = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        ...parsed.data.fullName ? { fullName: parsed.data.fullName.trim() } : {},
        ...parsed.data.phone ? { phone: parsed.data.phone.trim() } : {},
        ...parsed.data.email !== void 0 ? { email: parsed.data.email ? parsed.data.email.trim().toLowerCase() : null } : {},
        ...parsed.data.dateOfBirth !== void 0 ? { dateOfBirth: parsed.data.dateOfBirth } : {},
        ...parsed.data.gender !== void 0 ? { gender: parsed.data.gender } : {},
        ...parsed.data.address !== void 0 ? { address: parsed.data.address } : {},
        ...parsed.data.emergencyContact !== void 0 ? { emergencyContact: parsed.data.emergencyContact } : {},
        ...parsed.data.referredBy !== void 0 ? { referredBy: parsed.data.referredBy } : {},
        ...parsed.data.consentAccepted !== void 0 ? {
          consentAccepted: parsed.data.consentAccepted,
          consentTimestamp: parsed.data.consentAccepted ? existing.consentTimestamp ?? /* @__PURE__ */ new Date() : null
        } : {}
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PATIENT_UPDATED",
      resourceType: "Patient",
      resourceId: patient.id,
      summary: `Updated patient record ${patient.patientCode}`,
      ipAddress: req.ip
    });
    res.json({ patient });
  }
);
router5.post(
  "/merge",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = mergePatientsSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.sourcePatientId === parsed.data.targetPatientId) {
      res.status(400).json({ error: "Select two distinct patient records to merge." });
      return;
    }
    const [source, target] = await Promise.all([
      prisma.patient.findUnique({ where: { id: parsed.data.sourcePatientId } }),
      prisma.patient.findUnique({ where: { id: parsed.data.targetPatientId } })
    ]);
    if (!source || !target) {
      res.status(404).json({ error: "Source or target patient record not found." });
      return;
    }
    if (source.userId && target.userId && source.userId !== target.userId) {
      res.status(409).json({
        error: "Both patient records are linked to separate portal login accounts and cannot be auto-merged."
      });
      return;
    }
    const merged = await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id }
      });
      await tx.payment.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id }
      });
      await tx.visit.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id }
      });
      await tx.diagnosticReport.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id }
      });
      await tx.reportDownloadLog.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id }
      });
      await tx.crmLead.updateMany({
        where: { convertedPatientId: source.id },
        data: { convertedPatientId: target.id }
      });
      const updatedTarget = await tx.patient.update({
        where: { id: target.id },
        data: {
          userId: target.userId ?? source.userId,
          email: target.email ?? source.email,
          dateOfBirth: target.dateOfBirth ?? source.dateOfBirth,
          gender: target.gender ?? source.gender,
          address: target.address ?? source.address,
          emergencyContact: target.emergencyContact ?? source.emergencyContact,
          referredBy: target.referredBy ?? source.referredBy,
          consentAccepted: target.consentAccepted || source.consentAccepted,
          consentTimestamp: target.consentTimestamp ?? source.consentTimestamp
        }
      });
      await tx.patient.delete({ where: { id: source.id } });
      return updatedTarget;
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PATIENT_RECORDS_MERGED",
      resourceType: "Patient",
      resourceId: merged.id,
      summary: `Merged duplicate ${source.patientCode} into ${merged.patientCode}${parsed.data.reason ? ` (${parsed.data.reason})` : ""}`,
      ipAddress: req.ip
    });
    res.json({ patient: merged, mergedFromCode: source.patientCode });
  }
);
router5.get(
  "/:id",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: {
          orderBy: { appointmentDate: "desc" },
          include: { service: { select: { name: true } } }
        },
        payments: { orderBy: { createdAt: "desc" } },
        visits: {
          orderBy: { checkedInAt: "desc" },
          include: {
            appointment: { include: { service: { select: { name: true } } } }
          }
        },
        reports: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reportCode: true,
            title: true,
            revisionNumber: true,
            status: true,
            publishedAt: true,
            createdAt: true,
            visit: { select: { visitNumber: true, appointment: { select: { bookingReference: true } } } }
          }
        }
      }
    });
    if (!patient) {
      res.status(404).json({ error: "Patient record not found." });
      return;
    }
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "PATIENT_RECORD_ACCESSED",
      resourceType: "Patient",
      resourceId: patient.id,
      summary: `Accessed patient record ${patient.patientCode}`,
      ipAddress: req.ip
    });
    const isClinical = req.auth.role === "SUPER_ADMIN";
    if (!isClinical) {
      patient.visits = patient.visits.map((v) => ({
        ...v,
        clinicalNotes: null
      }));
    }
    res.json({ patient });
  }
);
var patients_routes_default = router5;

// server/routes/reports.routes.ts
import crypto9 from "crypto";
import { Router as Router6 } from "express";
import multer2 from "multer";
import { z as z6 } from "zod";
var router6 = Router6();
var uploadPdf = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
  // 15 MB PDF max
});
var uploadMetaSchema = z6.object({
  visitId: z6.string().min(1).optional(),
  appointmentId: z6.string().min(1).optional(),
  title: z6.string().min(3).max(160)
});
router6.get("/my-reports", requireAuth, async (req, res) => {
  const reports = await prisma.diagnosticReport.findMany({
    where: {
      status: "PUBLISHED",
      patient: { userId: req.auth.userId }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      reportCode: true,
      title: true,
      revisionNumber: true,
      fileName: true,
      fileSizeBytes: true,
      publishedAt: true,
      visit: {
        select: {
          visitNumber: true,
          appointment: {
            select: {
              bookingReference: true,
              service: { select: { name: true } }
            }
          }
        }
      },
      reviewedBy: {
        select: { fullName: true }
      }
    }
  });
  res.json({ reports });
});
router6.get(
  "/doctor-queue",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const [visits, appointments] = await Promise.all([
      prisma.visit.findMany({
        orderBy: { checkedInAt: "desc" },
        take: 80,
        include: {
          patient: {
            select: {
              id: true,
              patientCode: true,
              fullName: true,
              phone: true,
              dateOfBirth: true,
              gender: true,
              consentAccepted: true
            }
          },
          appointment: {
            select: {
              id: true,
              bookingReference: true,
              appointmentDate: true,
              startTime: true,
              endTime: true,
              clinicalIndication: true,
              referringDoctor: true,
              service: { select: { id: true, name: true, code: true } }
            }
          },
          reports: {
            orderBy: { revisionNumber: "desc" },
            include: {
              uploadedBy: { select: { fullName: true } },
              reviewedBy: { select: { fullName: true } },
              downloadLogs: {
                orderBy: { downloadedAt: "desc" },
                take: 10,
                include: {
                  downloadedBy: { select: { fullName: true, role: true } }
                }
              }
            }
          }
        }
      }),
      prisma.appointment.findMany({
        where: {
          status: { notIn: ["CANCELLED"] },
          OR: [
            { doctorId: null },
            { service: { requiresDoctorMorning: true } }
          ]
        },
        orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
        take: 100,
        include: {
          patient: {
            select: {
              id: true,
              patientCode: true,
              fullName: true,
              phone: true,
              consentAccepted: true
            }
          },
          service: {
            select: { id: true, name: true, code: true, requiresDoctorMorning: true }
          },
          visit: {
            select: {
              id: true,
              visitNumber: true,
              status: true,
              reports: {
                orderBy: { revisionNumber: "desc" },
                select: {
                  id: true,
                  reportCode: true,
                  revisionNumber: true,
                  status: true
                }
              }
            }
          }
        }
      })
    ]);
    const todayAppointments = appointments.filter((a) => a.appointmentDate === todayStr);
    const upcomingAppointments = appointments.filter((a) => a.appointmentDate > todayStr);
    const assignedPatientsMap = /* @__PURE__ */ new Map();
    for (const appt of appointments) {
      const existing = assignedPatientsMap.get(appt.patient.id);
      if (!existing) {
        assignedPatientsMap.set(appt.patient.id, {
          ...appt.patient,
          lastAppointmentDate: appt.appointmentDate,
          appointmentCount: 1
        });
      } else {
        existing.appointmentCount += 1;
        if (appt.appointmentDate > existing.lastAppointmentDate) {
          existing.lastAppointmentDate = appt.appointmentDate;
        }
      }
    }
    res.json({
      todayDate: todayStr,
      visits,
      todayAppointments,
      upcomingAppointments,
      assignedPatients: Array.from(assignedPatientsMap.values())
    });
  }
);
router6.patch(
  "/visits/:visitId",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const status = req.body?.status;
    const clinicalNotes = typeof req.body?.clinicalNotes === "string" ? req.body.clinicalNotes.slice(0, 2e3) : void 0;
    const visit = await prisma.visit.update({
      where: { id: req.params.visitId },
      data: {
        ...status ? { status } : {},
        ...clinicalNotes !== void 0 ? { clinicalNotes } : {},
        ...status === "COMPLETED" ? { completedAt: /* @__PURE__ */ new Date() } : {}
      }
    });
    if (status === "COMPLETED") {
      await prisma.appointment.update({
        where: { id: visit.appointmentId },
        data: { status: "COMPLETED" }
      });
    } else if (status === "IN_SCAN") {
      await prisma.appointment.update({
        where: { id: visit.appointmentId },
        data: { status: "IN_PROGRESS" }
      });
    }
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "VISIT_UPDATED",
      resourceType: "Visit",
      resourceId: visit.id,
      summary: `Updated visit ${visit.visitNumber} status to ${visit.status}`,
      ipAddress: req.ip
    });
    res.json({ visit });
  }
);
router6.post(
  "/upload",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  uploadPdf.single("reportPdf"),
  async (req, res) => {
    const parsed = uploadMetaSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.visitId && !parsed.data.appointmentId || !req.file) {
      res.status(400).json({
        error: "Visit ID or Appointment ID, report title, and a valid PDF file are required."
      });
      return;
    }
    if (req.file.mimetype !== "application/pdf" || !isValidPdfBuffer(req.file.buffer)) {
      res.status(400).json({ error: "Invalid file format. Only verified PDF reports are accepted." });
      return;
    }
    let visit = parsed.data.visitId ? await prisma.visit.findUnique({
      where: { id: parsed.data.visitId },
      include: { reports: { orderBy: { revisionNumber: "desc" }, take: 1 } }
    }) : await prisma.visit.findUnique({
      where: { appointmentId: parsed.data.appointmentId },
      include: { reports: { orderBy: { revisionNumber: "desc" }, take: 1 } }
    });
    if (!visit && parsed.data.appointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: parsed.data.appointmentId }
      });
      if (!appt) {
        res.status(404).json({ error: "Associated appointment not found." });
        return;
      }
      const visitNumber = `VIS-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}-${crypto9.randomBytes(2).toString("hex").toUpperCase()}`;
      visit = await prisma.visit.create({
        data: {
          visitNumber,
          appointmentId: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId ?? req.auth.userId,
          status: "IN_SCAN"
        },
        include: { reports: { orderBy: { revisionNumber: "desc" }, take: 1 } }
      });
    }
    if (!visit) {
      res.status(404).json({ error: "Clinical visit record not found." });
      return;
    }
    const nextRevision = (visit.reports[0]?.revisionNumber ?? 0) + 1;
    const storedFilePath = savePrivateFile(REPORTS_DIR, ".pdf", req.file.buffer);
    const reportCode = `RPT-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}-${crypto9.randomBytes(2).toString("hex").toUpperCase()}`;
    const report = await prisma.diagnosticReport.create({
      data: {
        reportCode,
        patientId: visit.patientId,
        visitId: visit.id,
        uploadedById: req.auth.userId,
        title: parsed.data.title.trim(),
        revisionNumber: nextRevision,
        fileName: req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"),
        storedFilePath,
        fileSizeBytes: req.file.size,
        mimeType: "application/pdf",
        status: nextRevision > 1 ? "REVISED" : "UNDER_REVIEW"
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "REPORT_UPLOADED",
      resourceType: "DiagnosticReport",
      resourceId: report.id,
      summary: `Uploaded ${report.reportCode} (Rev ${report.revisionNumber}) for visit ${visit.visitNumber}`,
      ipAddress: req.ip
    });
    res.status(201).json({ report });
  }
);
router6.post(
  "/:id/review",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const existing = await prisma.diagnosticReport.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Diagnostic report not found." });
      return;
    }
    const updated = await prisma.diagnosticReport.update({
      where: { id: existing.id },
      data: {
        reviewedById: req.auth.userId,
        status: existing.status === "DRAFT" ? "UNDER_REVIEW" : existing.status
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "REPORT_REVIEWED",
      resourceType: "DiagnosticReport",
      resourceId: updated.id,
      summary: `Medical staff reviewed ${updated.reportCode} (Rev ${updated.revisionNumber})`,
      ipAddress: req.ip
    });
    res.json({ report: updated });
  }
);
router6.post(
  "/:id/publish",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const existing = await prisma.diagnosticReport.findUnique({
      where: { id: req.params.id },
      include: { patient: true, visit: true }
    });
    if (!existing) {
      res.status(404).json({ error: "Diagnostic report not found." });
      return;
    }
    const report = await prisma.$transaction(async (tx) => {
      const updated = await tx.diagnosticReport.update({
        where: { id: existing.id },
        data: {
          status: "PUBLISHED",
          reviewedById: req.auth.userId,
          publishedAt: /* @__PURE__ */ new Date()
        }
      });
      await tx.visit.update({
        where: { id: existing.visitId },
        data: { status: "COMPLETED", completedAt: /* @__PURE__ */ new Date() }
      });
      await tx.appointment.update({
        where: { id: existing.visit.appointmentId },
        data: { status: "COMPLETED" }
      });
      return updated;
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "REPORT_PUBLISHED",
      resourceType: "DiagnosticReport",
      resourceId: report.id,
      summary: `Published diagnostic report ${report.reportCode} (Rev ${report.revisionNumber})`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `report-pub-${report.id}-rev${report.revisionNumber}`,
      eventType: "report.published",
      payload: {
        reportCode: report.reportCode,
        patientCode: existing.patient.patientCode,
        visitNumber: existing.visit.visitNumber
      }
    });
    await dispatchWhatsAppMessage({
      eventId: `wa-report-pub-${report.id}-rev${report.revisionNumber}`,
      recipientPhone: existing.patient.phone,
      templateKey: "REPORT_PORTAL_NOTICE",
      appointmentId: existing.visit.appointmentId,
      templateVariables: [report.reportCode, "/patient/portal"],
      messageBody: `EDFIC Notice: Your diagnostic report (${report.reportCode}) is now available in your secure Patient Portal (/patient/portal). Sign in with your registered EDFIC account to access it.`
    });
    res.json({ report });
  }
);
router6.get("/:id/download", requireAuth, async (req, res) => {
  const report = await prisma.diagnosticReport.findUnique({
    where: { id: req.params.id },
    include: { patient: true }
  });
  if (!report) {
    res.status(404).json({ error: "Diagnostic report not found." });
    return;
  }
  const isAdmin = req.auth.role === "SUPER_ADMIN";
  const isPatientOwner = report.patient.userId === req.auth.userId && report.status === "PUBLISHED";
  if (!isAdmin && !isPatientOwner) {
    res.status(403).json({
      error: "Access denied: you are not authorized to download this diagnostic report."
    });
    return;
  }
  const fullPath = resolvePrivateFile(REPORTS_DIR, report.storedFilePath);
  if (!fullPath) {
    res.status(404).json({ error: "Report PDF file is unavailable in private storage." });
    return;
  }
  await prisma.reportDownloadLog.create({
    data: {
      reportId: report.id,
      downloadedById: req.auth.userId,
      patientId: report.patientId,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"]?.slice(0, 200) ?? null
    }
  });
  await logAudit({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "REPORT_DOWNLOADED",
    resourceType: "DiagnosticReport",
    resourceId: report.id,
    summary: `Downloaded ${report.reportCode} (${report.fileName})`,
    ipAddress: req.ip
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${report.reportCode}-rev${report.revisionNumber}.pdf"`
  );
  res.setHeader("Cache-Control", "no-store, private");
  res.sendFile(fullPath);
});
var reports_routes_default = router6;

// server/routes/crm.routes.ts
import crypto10 from "crypto";
import { Router as Router7 } from "express";
import { z as z7 } from "zod";
var router7 = Router7();
var LEAD_STATUS_VALUES = [
  "NEW",
  "CONTACTED",
  "INFORMATION_PROVIDED",
  "APPOINTMENT_REQUESTED",
  "APPOINTMENT_CONFIRMED",
  "VISITED",
  "FOLLOW_UP",
  "SCHEDULED",
  "CONVERTED",
  "CLOSED"
];
var createLeadSchema = z7.object({
  fullName: z7.string().min(2).max(120),
  phone: z7.string().min(10).max(15),
  email: z7.string().email().optional().or(z7.literal("")),
  source: z7.enum(["WEBSITE_CONTACT", "BOOKING_INQUIRY", "WHATSAPP", "REFERRAL", "WALK_IN"]).default("WALK_IN"),
  interestedService: z7.string().max(160).optional(),
  message: z7.string().max(1500).optional(),
  notes: z7.string().max(1500).optional(),
  assignedToId: z7.string().optional(),
  followUpDueAt: z7.string().optional()
});
var updateLeadSchema = z7.object({
  status: z7.enum(LEAD_STATUS_VALUES).optional(),
  assignedToId: z7.string().nullable().optional(),
  linkedAppointmentId: z7.string().nullable().optional(),
  notes: z7.string().max(2e3).optional(),
  followUpDueAt: z7.string().nullable().optional()
});
var createTaskSchema = z7.object({
  title: z7.string().min(3).max(200),
  dueAt: z7.string().optional(),
  assignedToId: z7.string().optional()
});
var linkAppointmentSchema = z7.object({
  bookingReference: z7.string().min(4).max(40).optional(),
  appointmentId: z7.string().min(1).optional()
});
router7.get(
  "/assignees",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["RECEPTION", "SUPER_ADMIN"] }
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true, email: true }
    });
    res.json({ users });
  }
);
router7.get(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const status = req.query.status ? String(req.query.status) : void 0;
    const source = req.query.source ? String(req.query.source) : void 0;
    const assignedToId = req.query.assignedToId ? String(req.query.assignedToId) : void 0;
    const q = req.query.q ? String(req.query.q).trim() : "";
    const leads = await prisma.crmLead.findMany({
      where: {
        ...status ? { status } : {},
        ...source ? { source } : {},
        ...assignedToId ? { assignedToId } : {},
        ...q ? {
          OR: [
            { fullName: { contains: q } },
            { phone: { contains: q } },
            { leadCode: { contains: q } },
            { interestedService: { contains: q } }
          ]
        } : {}
      },
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { id: true, fullName: true, role: true } },
        convertedPatient: { select: { id: true, patientCode: true, fullName: true } },
        linkedAppointment: {
          select: {
            id: true,
            bookingReference: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            service: { select: { name: true } }
          }
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedTo: { select: { id: true, fullName: true } }
          }
        }
      }
    });
    res.json({ leads });
  }
);
router7.post(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid name and phone number required." });
      return;
    }
    const leadCode = `CRM-${crypto10.randomBytes(3).toString("hex").toUpperCase()}`;
    const lead = await prisma.crmLead.create({
      data: {
        leadCode,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        email: parsed.data.email?.trim() || null,
        source: parsed.data.source,
        interestedService: parsed.data.interestedService?.trim() || null,
        message: parsed.data.message?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        assignedToId: parsed.data.assignedToId || req.auth.userId,
        followUpDueAt: parsed.data.followUpDueAt ? new Date(parsed.data.followUpDueAt) : null
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CRM_LEAD_CREATED",
      resourceType: "CrmLead",
      resourceId: lead.id,
      summary: `Created CRM lead ${lead.leadCode} (${lead.source})`,
      ipAddress: req.ip
    });
    await dispatchN8nEvent({
      eventId: `crm-inquiry-${lead.id}`,
      eventType: "crm.inquiry_created",
      payload: {
        leadCode: lead.leadCode,
        fullName: lead.fullName,
        source: lead.source,
        interestedService: lead.interestedService,
        assignedToId: lead.assignedToId
      }
    });
    await dispatchWhatsAppMessage({
      eventId: `wa-inquiry-${lead.id}`,
      recipientPhone: lead.phone,
      templateKey: "INQUIRY_ACKNOWLEDGMENT",
      messageBody: `EDFIC (A Unit of EWA DERMA): Your inquiry (${lead.leadCode}) has been registered with EDFIC Reception, Sushant Golf City, Lucknow.`
    });
    res.status(201).json({ lead });
  }
);
router7.patch(
  "/:id",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid CRM lead update payload." });
      return;
    }
    const existing = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "CRM lead not found." });
      return;
    }
    const lead = await prisma.crmLead.update({
      where: { id: existing.id },
      data: {
        ...parsed.data.status ? { status: parsed.data.status } : {},
        ...parsed.data.assignedToId !== void 0 ? { assignedToId: parsed.data.assignedToId } : {},
        ...parsed.data.linkedAppointmentId !== void 0 ? { linkedAppointmentId: parsed.data.linkedAppointmentId } : {},
        ...parsed.data.notes !== void 0 ? { notes: parsed.data.notes } : {},
        ...parsed.data.followUpDueAt !== void 0 ? {
          followUpDueAt: parsed.data.followUpDueAt ? new Date(parsed.data.followUpDueAt) : null
        } : {}
      }
    });
    if (parsed.data.assignedToId && parsed.data.assignedToId !== existing.assignedToId) {
      await dispatchN8nEvent({
        eventId: `crm-assign-${lead.id}-${parsed.data.assignedToId}-${Date.now()}`,
        eventType: "crm.lead_assigned",
        payload: {
          leadCode: lead.leadCode,
          assignedToId: parsed.data.assignedToId
        }
      });
    }
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CRM_LEAD_UPDATED",
      resourceType: "CrmLead",
      resourceId: lead.id,
      summary: `Updated CRM lead ${lead.leadCode} (${lead.status})`,
      ipAddress: req.ip
    });
    res.json({ lead });
  }
);
router7.post(
  "/:id/link-appointment",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = linkAppointmentSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.bookingReference && !parsed.data.appointmentId) {
      res.status(400).json({ error: "Provide bookingReference or appointmentId to link." });
      return;
    }
    const lead = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      res.status(404).json({ error: "CRM lead not found." });
      return;
    }
    const appointment = await prisma.appointment.findFirst({
      where: parsed.data.appointmentId ? { id: parsed.data.appointmentId } : { bookingReference: parsed.data.bookingReference.trim().toUpperCase() },
      include: { service: { select: { name: true } } }
    });
    if (!appointment) {
      res.status(404).json({ error: "Matching appointment not found." });
      return;
    }
    const derivedStatus = appointment.status === "COMPLETED" ? "VISITED" : appointment.status === "CONFIRMED" || appointment.status === "CHECKED_IN" ? "APPOINTMENT_CONFIRMED" : "APPOINTMENT_REQUESTED";
    const updated = await prisma.crmLead.update({
      where: { id: lead.id },
      data: {
        linkedAppointmentId: appointment.id,
        convertedPatientId: lead.convertedPatientId || appointment.patientId,
        status: derivedStatus
      },
      include: {
        linkedAppointment: {
          select: {
            id: true,
            bookingReference: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            service: { select: { name: true } }
          }
        },
        convertedPatient: { select: { id: true, patientCode: true, fullName: true } }
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CRM_APPOINTMENT_LINKED",
      resourceType: "CrmLead",
      resourceId: lead.id,
      summary: `Linked appointment ${appointment.bookingReference} to CRM lead ${lead.leadCode}`,
      ipAddress: req.ip
    });
    res.json({ lead: updated });
  }
);
router7.post(
  "/:id/tasks",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Task title is required." });
      return;
    }
    const task = await prisma.crmTask.create({
      data: {
        leadId: req.params.id,
        title: parsed.data.title.trim(),
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        assignedToId: parsed.data.assignedToId || req.auth.userId
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CRM_TASK_CREATED",
      resourceType: "CrmTask",
      resourceId: task.id,
      summary: `Created follow-up task "${task.title}" on lead ${req.params.id}`,
      ipAddress: req.ip
    });
    res.status(201).json({ task });
  }
);
router7.patch(
  "/tasks/:taskId/toggle",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const existing = await prisma.crmTask.findUnique({ where: { id: req.params.taskId } });
    if (!existing) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    const task = await prisma.crmTask.update({
      where: { id: existing.id },
      data: {
        isCompleted: !existing.isCompleted,
        completedAt: !existing.isCompleted ? /* @__PURE__ */ new Date() : null
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CRM_TASK_TOGGLED",
      resourceType: "CrmTask",
      resourceId: task.id,
      summary: `Marked follow-up task ${task.isCompleted ? "completed" : "reopened"}`,
      ipAddress: req.ip
    });
    res.json({ task });
  }
);
router7.post(
  "/:id/convert",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const lead = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      res.status(404).json({ error: "CRM lead not found." });
      return;
    }
    if (lead.convertedPatientId) {
      const existingPatient = await prisma.patient.findUnique({
        where: { id: lead.convertedPatientId }
      });
      res.json({ patient: existingPatient, lead });
      return;
    }
    const patientCode = await generateNextPatientCode();
    const result = await prisma.$transaction(async (tx) => {
      let patient = await tx.patient.findFirst({ where: { phone: lead.phone } });
      if (!patient) {
        patient = await tx.patient.create({
          data: {
            patientCode,
            fullName: lead.fullName,
            phone: lead.phone,
            email: lead.email,
            consentAccepted: false
          }
        });
      }
      const updatedLead = await tx.crmLead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED",
          convertedPatientId: patient.id
        }
      });
      return { patient, lead: updatedLead };
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CRM_LEAD_CONVERTED",
      resourceType: "Patient",
      resourceId: result.patient.id,
      summary: `Converted CRM lead ${lead.leadCode} into patient ${result.patient.patientCode}`,
      ipAddress: req.ip
    });
    res.json(result);
  }
);
var crm_routes_default = router7;

// server/routes/cms.routes.ts
import { Router as Router8 } from "express";
import { z as z8 } from "zod";

// server/services/compliance.ts
var PRICING_PATTERNS = [
  /₹\s*\d+/i,
  /\brs\.?\s*\d+/i,
  /\binr\s*\d+/i,
  /\bdiscount\b/i,
  /\boffer\s*price\b/i,
  /\bpackage\s*price\b/i,
  /\bflat\s*\d+%\s*off\b/i,
  /\bcheap(est)?\b/i
];
var PCPNDT_PATTERNS = [
  /\bsex\s*determination\b/i,
  /\bgender\s*prediction\b/i,
  /\bboy\s*or\s*girl\b/i,
  /\bfetal\s*sex\b/i,
  /\bgender\s*reveal\b/i,
  /\bdetermine\s*gender\b/i
];
var GUARANTEE_PATTERNS = [
  /\b100%\s*(accurate|guarantee|guaranteed|sure)\b/i,
  /\bbest\s*in\s*(india|lucknow|the\s*city)\b/i,
  /\bno\.?\s*1\b/i,
  /\bnumber\s*one\b/i,
  /\bguaranteed\s*(result|diagnosis|cure)\b/i
];
var TESTIMONIAL_PATTERNS = [
  /\bpatient\s*review\b/i,
  /\b5[\s-]*star\s*rating\b/i,
  /\bsuccess\s*story\b/i,
  /\btestimonial\b/i
];
function scanMedicalContentCompliance(text) {
  const issues = [];
  const noPricingOrDiscounts = !PRICING_PATTERNS.some((re) => re.test(text));
  if (!noPricingOrDiscounts) {
    issues.push(
      "Public content policy violation: Pricing, fees, discounts, or rate references detected."
    );
  }
  const noSexDetermination = !PCPNDT_PATTERNS.some((re) => re.test(text));
  if (!noSexDetermination) {
    issues.push(
      "PCPNDT Act compliance alert: Gender prediction or sex determination phrasing detected."
    );
  }
  const noUnsupportedGuarantees = !GUARANTEE_PATTERNS.some((re) => re.test(text));
  if (!noUnsupportedGuarantees) {
    issues.push(
      "NMC ethics alert: Unsupported superiority claims or diagnostic guarantees detected."
    );
  }
  const noPromotionalTestimonials = !TESTIMONIAL_PATTERNS.some((re) => re.test(text));
  if (!noPromotionalTestimonials) {
    issues.push(
      "NMC ethics alert: Promotional testimonial or patient review language detected."
    );
  }
  return {
    passed: issues.length === 0,
    issues,
    checks: {
      noPricingOrDiscounts,
      noSexDetermination,
      noUnsupportedGuarantees,
      noPromotionalTestimonials
    }
  };
}

// server/routes/cms.routes.ts
var router8 = Router8();
var cmsDraftSchema = z8.object({
  slug: z8.string().min(2).max(120),
  pageKey: z8.string().min(2).max(60),
  title: z8.string().min(3).max(180),
  contentMarkdown: z8.string().min(10).max(2e4)
});
var serviceManageSchema = z8.object({
  name: z8.string().min(2).max(160),
  categoryId: z8.string().min(1),
  summary: z8.string().min(5).max(500),
  clinicalDescription: z8.string().min(5).max(3e3),
  preparationNotes: z8.string().min(2).max(1e3),
  durationMinutes: z8.coerce.number().int().min(10).max(120),
  requiresDoctorMorning: z8.boolean().default(false),
  isVisiblePublic: z8.boolean().default(true),
  advanceAmountInr: z8.coerce.number().int().min(0).max(5e4).default(500)
});
router8.get(
  "/content",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (_req, res) => {
    const items = await prisma.cmsContentItem.findMany({
      orderBy: { updatedAt: "desc" }
    });
    res.json({ items });
  }
);
router8.post(
  "/content",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = cmsDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid slug, pageKey, title, and content are required." });
      return;
    }
    const scan = scanMedicalContentCompliance(
      `${parsed.data.title}
${parsed.data.contentMarkdown}`
    );
    const item = await prisma.cmsContentItem.upsert({
      where: { slug: parsed.data.slug.trim() },
      update: {
        pageKey: parsed.data.pageKey.trim(),
        title: parsed.data.title.trim(),
        contentMarkdown: parsed.data.contentMarkdown.trim(),
        status: "DRAFT",
        checklistNoPrice: scan.checks.noPricingOrDiscounts,
        checklistNoSexDetermination: scan.checks.noSexDetermination,
        checklistNoGuarantee: scan.checks.noUnsupportedGuarantees,
        checklistNoFakeTestimonial: scan.checks.noPromotionalTestimonials,
        complianceIssues: scan.issues.join(" | ") || null
      },
      create: {
        slug: parsed.data.slug.trim(),
        pageKey: parsed.data.pageKey.trim(),
        title: parsed.data.title.trim(),
        contentMarkdown: parsed.data.contentMarkdown.trim(),
        status: "DRAFT",
        authorId: req.auth.userId,
        checklistNoPrice: scan.checks.noPricingOrDiscounts,
        checklistNoSexDetermination: scan.checks.noSexDetermination,
        checklistNoGuarantee: scan.checks.noUnsupportedGuarantees,
        checklistNoFakeTestimonial: scan.checks.noPromotionalTestimonials,
        complianceIssues: scan.issues.join(" | ") || null
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CMS_DRAFT_SAVED",
      resourceType: "CmsContentItem",
      resourceId: item.id,
      summary: `Saved CMS draft ${item.slug} (compliance passed: ${scan.passed})`,
      ipAddress: req.ip
    });
    res.status(201).json({ item, complianceScan: scan });
  }
);
router8.post(
  "/content/:id/advance",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const item = await prisma.cmsContentItem.findUnique({ where: { id: req.params.id } });
    if (!item) {
      res.status(404).json({ error: "CMS item not found." });
      return;
    }
    const targetStage = String(req.body?.targetStage || "");
    const scan = scanMedicalContentCompliance(`${item.title}
${item.contentMarkdown}`);
    if (!scan.passed) {
      res.status(422).json({
        error: "Cannot advance content until NMC/PCPNDT compliance checks pass.",
        issues: scan.issues
      });
      return;
    }
    if (targetStage === "MEDICAL_REVIEW") {
      const updated = await prisma.cmsContentItem.update({
        where: { id: item.id },
        data: { status: "MEDICAL_REVIEW" }
      });
      res.json({ item: updated });
      return;
    }
    if (targetStage === "COMPLIANCE_REVIEW") {
      if (req.auth.role !== "SUPER_ADMIN") {
        res.status(403).json({ error: "Only Super Admin may complete Medical Review." });
        return;
      }
      const updated = await prisma.cmsContentItem.update({
        where: { id: item.id },
        data: {
          status: "COMPLIANCE_REVIEW",
          medicalReviewerName: req.auth.fullName
        }
      });
      res.json({ item: updated });
      return;
    }
    if (targetStage === "FINAL_APPROVED" || targetStage === "PUBLISHED") {
      if (req.auth.role !== "SUPER_ADMIN") {
        res.status(403).json({
          error: "Final approval and publishing require Super Administrator authorization."
        });
        return;
      }
      const updated = await prisma.cmsContentItem.update({
        where: { id: item.id },
        data: {
          status: targetStage,
          complianceReviewerName: item.complianceReviewerName || req.auth.fullName,
          finalApproverName: req.auth.fullName,
          publishedAt: targetStage === "PUBLISHED" ? /* @__PURE__ */ new Date() : item.publishedAt
        }
      });
      await logAudit({
        actorUserId: req.auth.userId,
        actorRole: req.auth.role,
        action: `CMS_${targetStage}`,
        resourceType: "CmsContentItem",
        resourceId: updated.id,
        summary: `Moved CMS item ${updated.slug} to ${targetStage}`,
        ipAddress: req.ip
      });
      res.json({ item: updated });
      return;
    }
    res.status(400).json({ error: "Unsupported workflow transition stage." });
  }
);
router8.get(
  "/services",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (_req, res) => {
    const categories = await prisma.serviceCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        services: { orderBy: { name: "asc" } }
      }
    });
    res.json({ categories });
  }
);
router8.post(
  "/services",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = serviceManageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid service details are required." });
      return;
    }
    const scan = scanMedicalContentCompliance(
      `${parsed.data.name}
${parsed.data.summary}
${parsed.data.clinicalDescription}`
    );
    if (!scan.passed) {
      res.status(422).json({
        error: "Service copy failed public medical ethics & pricing compliance check.",
        issues: scan.issues
      });
      return;
    }
    const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const code = `SVC-${Date.now().toString().slice(-5)}`;
    const service = await prisma.diagnosticService.create({
      data: {
        slug,
        code,
        ...parsed.data,
        approvalStatus: req.auth.role === "SUPER_ADMIN" ? "PUBLISHED" : "MEDICAL_REVIEW"
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "SERVICE_CREATED",
      resourceType: "DiagnosticService",
      resourceId: service.id,
      summary: `Created diagnostic service ${service.name}`,
      ipAddress: req.ip
    });
    res.status(201).json({ service });
  }
);
router8.patch(
  "/services/:id",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = serviceManageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid service update payload." });
      return;
    }
    if (parsed.data.summary || parsed.data.clinicalDescription || parsed.data.name) {
      const scan = scanMedicalContentCompliance(
        `${parsed.data.name || ""}
${parsed.data.summary || ""}
${parsed.data.clinicalDescription || ""}`
      );
      if (!scan.passed) {
        res.status(422).json({
          error: "Updated copy failed compliance scan.",
          issues: scan.issues
        });
        return;
      }
    }
    const service = await prisma.diagnosticService.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "SERVICE_UPDATED",
      resourceType: "DiagnosticService",
      resourceId: service.id,
      summary: `Updated diagnostic service ${service.name} (public visibility: ${service.isVisiblePublic})`,
      ipAddress: req.ip
    });
    res.json({ service });
  }
);
var categoryManageSchema = z8.object({
  name: z8.string().min(2).max(120),
  description: z8.string().min(5).max(800),
  sortOrder: z8.coerce.number().int().min(1).max(100).default(10),
  isVisible: z8.boolean().default(true)
});
router8.post(
  "/categories",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = categoryManageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid category name and description are required." });
      return;
    }
    const scan = scanMedicalContentCompliance(
      `${parsed.data.name}
${parsed.data.description}`
    );
    if (!scan.passed) {
      res.status(422).json({
        error: "Category copy failed public medical ethics & pricing compliance check.",
        issues: scan.issues
      });
      return;
    }
    const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const category = await prisma.serviceCategory.create({
      data: {
        slug,
        name: parsed.data.name.trim(),
        description: parsed.data.description.trim(),
        sortOrder: parsed.data.sortOrder,
        isVisible: parsed.data.isVisible
      }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CATEGORY_CREATED",
      resourceType: "ServiceCategory",
      resourceId: category.id,
      summary: `Created service category ${category.name}`,
      ipAddress: req.ip
    });
    res.status(201).json({ category });
  }
);
router8.patch(
  "/categories/:id",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = categoryManageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid category update payload." });
      return;
    }
    if (parsed.data.name || parsed.data.description) {
      const scan = scanMedicalContentCompliance(
        `${parsed.data.name || ""}
${parsed.data.description || ""}`
      );
      if (!scan.passed) {
        res.status(422).json({
          error: "Updated category copy failed compliance scan.",
          issues: scan.issues
        });
        return;
      }
    }
    const category = await prisma.serviceCategory.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CATEGORY_UPDATED",
      resourceType: "ServiceCategory",
      resourceId: category.id,
      summary: `Updated service category ${category.name} (visible: ${category.isVisible})`,
      ipAddress: req.ip
    });
    res.json({ category });
  }
);
var cms_routes_default = router8;

// server/routes/admin.routes.ts
import { Router as Router9 } from "express";
import { z as z9 } from "zod";
var router9 = Router9();
var templateMapSchema = z9.object({
  INQUIRY_ACKNOWLEDGMENT: z9.string().max(120).optional(),
  APPOINTMENT_ACKNOWLEDGMENT: z9.string().max(120).optional(),
  BOOKING_REFERENCE: z9.string().max(120).optional(),
  PAYMENT_INSTRUCTIONS: z9.string().max(120).optional(),
  PAYMENT_ACKNOWLEDGED: z9.string().max(120).optional(),
  PAYMENT_REJECTED: z9.string().max(120).optional(),
  APPOINTMENT_CONFIRMED: z9.string().max(120).optional(),
  APPOINTMENT_REMINDER: z9.string().max(120).optional(),
  APPOINTMENT_RESCHEDULED: z9.string().max(120).optional(),
  APPOINTMENT_CANCELLED: z9.string().max(120).optional(),
  REPORT_PORTAL_NOTICE: z9.string().max(120).optional()
}).optional();
var settingsSchema = z9.object({
  primaryPhone: z9.string().max(40).optional(),
  secondaryPhone: z9.string().max(40).optional(),
  whatsappNumber: z9.string().max(40).optional(),
  officialEmail: z9.string().max(120).optional(),
  weekdayHours: z9.string().max(160).optional(),
  sundayHours: z9.string().max(160).optional(),
  slotDurationMinutes: z9.coerce.number().int().min(10).max(60).optional(),
  slotCapacityPerSlot: z9.coerce.number().int().min(1).max(10).optional(),
  maxDailyAppointments: z9.coerce.number().int().min(5).max(200).optional(),
  reservationExpiryMinutes: z9.coerce.number().int().min(5).max(180).optional(),
  morningSessionStart: z9.string().regex(/^\d{2}:\d{2}$/).optional(),
  morningSessionEnd: z9.string().regex(/^\d{2}:\d{2}$/).optional(),
  upiId: z9.string().min(3).max(120).optional(),
  upiMerchantName: z9.string().min(2).max(160).optional(),
  defaultAdvanceAmountInr: z9.coerce.number().int().min(100).max(2e4).optional(),
  n8nWebhookUrl: z9.string().max(300).optional(),
  n8nWebhookSecret: z9.string().max(200).optional(),
  n8nApiKey: z9.string().max(200).optional(),
  whatsappProvider: z9.string().max(60).optional(),
  whatsappApiUrl: z9.string().max(300).optional(),
  whatsappPhoneNumberId: z9.string().max(100).optional(),
  whatsappAccessToken: z9.string().max(400).optional(),
  whatsappWebhookSecret: z9.string().max(200).optional(),
  whatsappTemplates: templateMapSchema
});
function maskHint(val) {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.length <= 4 ? "\u2022\u2022\u2022\u2022" : `\u2022\u2022\u2022\u2022${trimmed.slice(-4)}`;
}
function sanitizeSettings(settings) {
  if (!settings) return null;
  const {
    n8nWebhookSecret,
    n8nApiKey,
    whatsappAccessToken,
    whatsappWebhookSecret,
    ...safeFields
  } = settings;
  const effectiveN8nSecret = n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || "";
  const effectiveN8nApiKey = n8nApiKey || process.env.N8N_API_KEY || "";
  const effectiveWaToken = whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const effectiveWaWebhookSecret = whatsappWebhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET || "";
  return {
    ...safeFields,
    hasN8nWebhookSecret: Boolean(effectiveN8nSecret),
    n8nWebhookSecretHint: maskHint(effectiveN8nSecret),
    hasN8nApiKey: Boolean(effectiveN8nApiKey),
    n8nApiKeyHint: maskHint(effectiveN8nApiKey),
    hasWhatsappAccessToken: Boolean(effectiveWaToken),
    whatsappAccessTokenHint: maskHint(effectiveWaToken),
    hasWhatsappWebhookSecret: Boolean(effectiveWaWebhookSecret),
    whatsappWebhookSecretHint: maskHint(effectiveWaWebhookSecret),
    whatsappTemplates: resolveWhatsAppTemplates(settings.whatsappTemplatesJson)
  };
}
var createStaffSchema = z9.object({
  email: z9.string().email(),
  fullName: z9.string().min(2).max(120),
  phone: z9.string().max(20).optional(),
  role: z9.enum(["SUPER_ADMIN", "RECEPTION"]),
  password: z9.string().min(8).max(100)
});
var holidaySchema = z9.object({
  date: z9.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z9.string().min(2).max(160)
});
router9.get(
  "/settings",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (_req, res) => {
    const settings = await prisma.clinicSetting.findUnique({ where: { id: "singleton" } });
    const holidays = await prisma.clinicHoliday.findMany({ orderBy: { date: "asc" } });
    res.json({ settings: sanitizeSettings(settings), holidays });
  }
);
router9.put(
  "/settings",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid clinic settings payload." });
      return;
    }
    const {
      n8nWebhookSecret,
      n8nApiKey,
      whatsappAccessToken,
      whatsappWebhookSecret,
      whatsappTemplates,
      ...rest
    } = parsed.data;
    if (rest.n8nWebhookUrl) {
      const n8nCheck = validateOutboundUrl(rest.n8nWebhookUrl);
      if (!n8nCheck.valid) {
        res.status(400).json({ error: `Invalid n8n webhook URL: ${n8nCheck.reason}` });
        return;
      }
    }
    if (rest.whatsappApiUrl) {
      const waCheck = validateOutboundUrl(rest.whatsappApiUrl);
      if (!waCheck.valid) {
        res.status(400).json({ error: `Invalid WhatsApp API URL: ${waCheck.reason}` });
        return;
      }
    }
    const updateData = { ...rest };
    if (typeof n8nWebhookSecret === "string" && n8nWebhookSecret.trim().length > 0) {
      updateData.n8nWebhookSecret = n8nWebhookSecret.trim();
    }
    if (typeof n8nApiKey === "string" && n8nApiKey.trim().length > 0) {
      updateData.n8nApiKey = n8nApiKey.trim();
    }
    if (typeof whatsappAccessToken === "string" && whatsappAccessToken.trim().length > 0) {
      updateData.whatsappAccessToken = whatsappAccessToken.trim();
    }
    if (typeof whatsappWebhookSecret === "string" && whatsappWebhookSecret.trim().length > 0) {
      updateData.whatsappWebhookSecret = whatsappWebhookSecret.trim();
    }
    if (whatsappTemplates) {
      const mergedTemplates = { ...DEFAULT_WHATSAPP_TEMPLATES };
      for (const key of Object.keys(mergedTemplates)) {
        const val = whatsappTemplates[key];
        if (typeof val === "string" && val.trim().length > 0) {
          mergedTemplates[key] = val.trim();
        }
      }
      updateData.whatsappTemplatesJson = JSON.stringify(mergedTemplates);
    }
    const settings = await prisma.clinicSetting.update({
      where: { id: "singleton" },
      data: updateData
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CLINIC_SETTINGS_UPDATED",
      resourceType: "ClinicSetting",
      resourceId: "singleton",
      summary: "Updated clinic contact, schedule, UPI, or automation settings",
      ipAddress: req.ip
    });
    res.json({ settings: sanitizeSettings(settings) });
  }
);
router9.post(
  "/holidays",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid YYYY-MM-DD date and reason required." });
      return;
    }
    const holiday = await prisma.clinicHoliday.upsert({
      where: { date: parsed.data.date },
      update: { reason: parsed.data.reason.trim() },
      create: { date: parsed.data.date, reason: parsed.data.reason.trim(), isFullDay: true }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "HOLIDAY_ADDED",
      resourceType: "ClinicHoliday",
      resourceId: holiday.id,
      summary: `Marked clinic holiday ${holiday.date}: ${holiday.reason}`,
      ipAddress: req.ip
    });
    res.status(201).json({ holiday });
  }
);
router9.delete(
  "/holidays/:id",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    await prisma.clinicHoliday.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }
);
router9.get("/users", requireAuth, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true
    }
  });
  res.json({ users });
});
router9.post("/users", requireAuth, requireRole("SUPER_ADMIN"), async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email, name, role, and password (min 8 chars) required." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "User with this email already exists." });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: parsed.data.fullName.trim(),
      phone: parsed.data.phone?.trim() || null,
      role: parsed.data.role,
      isActive: true
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });
  await logAudit({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "STAFF_USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    summary: `Created ${user.role} account for ${user.email}`,
    ipAddress: req.ip
  });
  res.status(201).json({ user });
});
router9.patch(
  "/users/:id/toggle-active",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
      select: { id: true, email: true, isActive: true, role: true }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "USER_STATUS_TOGGLED",
      resourceType: "User",
      resourceId: updated.id,
      summary: `Set ${updated.email} active=${updated.isActive}`,
      ipAddress: req.ip
    });
    res.json({ user: updated });
  }
);
var roleUpdateSchema = z9.object({
  role: z9.enum(["SUPER_ADMIN", "RECEPTION"])
});
router9.patch(
  "/users/:id/role",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid staff role is required." });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (existing.id === req.auth.userId && parsed.data.role !== "SUPER_ADMIN") {
      res.status(422).json({ error: "You cannot downgrade your own active Super Admin role." });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: parsed.data.role },
      select: { id: true, email: true, fullName: true, role: true, isActive: true }
    });
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "USER_ROLE_CHANGED",
      resourceType: "User",
      resourceId: updated.id,
      summary: `Changed role for ${updated.email} from ${existing.role} to ${updated.role}`,
      ipAddress: req.ip
    });
    res.json({ user: updated });
  }
);
router9.get(
  "/overview",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (_req, res) => {
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const now = /* @__PURE__ */ new Date();
    const [appointments, pendingPayments, inquiries, dueTasks, pendingReports, failedWebhooks] = await Promise.all([
      prisma.appointment.findMany({
        orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
        include: {
          service: { select: { name: true } },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, utrReference: true, amountSubmittedInr: true }
          }
        }
      }),
      prisma.payment.findMany({
        where: { status: { in: ["PENDING", "SUBMITTED", "UNDER_VERIFICATION"] } },
        orderBy: { createdAt: "desc" },
        include: {
          patient: { select: { patientCode: true, fullName: true, phone: true } },
          appointment: {
            select: { bookingReference: true, appointmentDate: true, startTime: true }
          }
        }
      }),
      prisma.crmLead.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          assignedTo: { select: { fullName: true } }
        }
      }),
      prisma.crmTask.findMany({
        where: { isCompleted: false },
        orderBy: { dueAt: "asc" },
        take: 25,
        include: {
          lead: { select: { leadCode: true, fullName: true, phone: true } }
        }
      }),
      prisma.diagnosticReport.findMany({
        where: { status: { in: ["DRAFT", "UNDER_REVIEW", "REVISED"] } },
        select: { id: true, reportCode: true, status: true, title: true }
      }),
      prisma.webhookEvent.count({ where: { status: "FAILED" } })
    ]);
    const todayAppointmentsList = appointments.filter(
      (a) => a.appointmentDate === todayStr && a.status !== "CANCELLED"
    );
    const upcomingAppointmentsList = appointments.filter(
      (a) => a.appointmentDate > todayStr && a.status !== "CANCELLED"
    );
    const confirmedAppointments = appointments.filter((a) => a.status === "CONFIRMED").length;
    const completedAppointments = appointments.filter((a) => a.status === "COMPLETED").length;
    const cancellations = appointments.filter((a) => a.status === "CANCELLED").length;
    const newInquiriesList = inquiries.filter(
      (l) => ["NEW", "FOLLOW_UP", "APPOINTMENT_REQUESTED"].includes(l.status)
    );
    const operationalAlerts = [];
    const awaitingUtrVerify = pendingPayments.filter(
      (p) => ["SUBMITTED", "UNDER_VERIFICATION"].includes(p.status)
    );
    if (awaitingUtrVerify.length > 0) {
      operationalAlerts.push({
        id: "utr-verification",
        severity: "high",
        title: `${awaitingUtrVerify.length} UPI payment submission(s) awaiting manual verification`,
        detail: "Verify UTR references against bank records before confirming slots.",
        linkTo: "/staff/payments"
      });
    }
    const newLeadCount = inquiries.filter((l) => l.status === "NEW").length;
    if (newLeadCount > 0) {
      operationalAlerts.push({
        id: "new-inquiries",
        severity: "medium",
        title: `${newLeadCount} new inquiry lead(s) require reception contact`,
        detail: "Assign and contact website/walk-in inquiries from the CRM pipeline.",
        linkTo: "/staff/crm"
      });
    }
    const overdueTasks = dueTasks.filter((t) => t.dueAt && t.dueAt < now);
    if (overdueTasks.length > 0) {
      operationalAlerts.push({
        id: "overdue-followups",
        severity: "medium",
        title: `${overdueTasks.length} CRM follow-up task(s) past due`,
        detail: "Review pending callbacks and appointment follow-ups.",
        linkTo: "/staff/crm"
      });
    }
    if (failedWebhooks > 0) {
      operationalAlerts.push({
        id: "failed-webhooks",
        severity: "medium",
        title: `${failedWebhooks} automation webhook delivery(s) failed`,
        detail: "Inspect and retry n8n webhook deliveries under Automation Logs.",
        linkTo: "/staff/admin"
      });
    }
    res.json({
      todayDate: todayStr,
      counts: {
        todayAppointments: todayAppointmentsList.length,
        upcomingAppointments: upcomingAppointmentsList.length,
        newInquiries: newInquiriesList.length,
        pendingPaymentVerifications: pendingPayments.length,
        confirmedAppointments,
        completedAppointments,
        cancellations,
        dueFollowUps: dueTasks.length,
        unpublishedReports: pendingReports.length
      },
      todayAppointmentsList: todayAppointmentsList.slice(0, 15),
      upcomingAppointmentsList: upcomingAppointmentsList.slice(0, 15),
      newInquiriesList: newInquiriesList.slice(0, 12),
      pendingPaymentsList: pendingPayments.slice(0, 12),
      dueTasks: dueTasks.slice(0, 10),
      operationalAlerts
    });
  }
);
router9.get(
  "/audit-logs",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const actionFilter = req.query.action ? String(req.query.action).trim() : "";
    const resourceTypeFilter = req.query.resourceType ? String(req.query.resourceType).trim() : "";
    const logs = await prisma.auditLog.findMany({
      where: {
        ...actionFilter ? { action: { contains: actionFilter } } : {},
        ...resourceTypeFilter ? { resourceType: resourceTypeFilter } : {}
      },
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        actor: { select: { fullName: true, email: true } }
      }
    });
    res.json({ logs });
  }
);
router9.get(
  "/automation-logs",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (_req, res) => {
    const webhooks = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 60
    });
    const whatsappLogs = await prisma.whatsAppMessageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 60
    });
    res.json({ webhooks, whatsappLogs });
  }
);
router9.post(
  "/webhooks/:id/retry",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const result = await retryWebhookEvent(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(404).json({
        error: err instanceof Error ? err.message : "Unable to retry webhook."
      });
    }
  }
);
router9.post(
  "/webhooks/retry-failed",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const result = await retryFailedWebhooks(25);
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "WEBHOOKS_BATCH_RETRIED",
      resourceType: "WebhookEvent",
      summary: `Batch retried ${result.retried} failed webhooks (succeeded: ${result.succeeded}, failed: ${result.failed})`,
      ipAddress: req.ip
    });
    res.json(result);
  }
);
router9.post(
  "/integrations/test-n8n",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const result = await testN8nConnection(req.auth.userId);
    res.json(result);
  }
);
router9.post(
  "/integrations/test-whatsapp",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    const result = await testWhatsAppConnection(req.auth.userId);
    res.json(result);
  }
);
router9.post(
  "/integrations/trigger-reminders",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const targetDate = typeof req.body?.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.targetDate) ? req.body.targetDate : void 0;
    const result = await triggerUpcomingAppointmentReminders({
      targetDate,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role
    });
    res.json(result);
  }
);
router9.post(
  "/integrations/trigger-daily-summary",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (req, res) => {
    const date = typeof req.body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? req.body.date : void 0;
    const result = await dispatchDailyReceptionSummary({
      date,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role
    });
    res.json(result);
  }
);
router9.get(
  "/analytics",
  requireAuth,
  requireRole("SUPER_ADMIN", "RECEPTION"),
  async (_req, res) => {
    const [appointments, payments, leads, reports] = await Promise.all([
      prisma.appointment.findMany({
        include: { service: { include: { category: true } } }
      }),
      prisma.payment.findMany(),
      prisma.crmLead.findMany(),
      prisma.diagnosticReport.findMany({ select: { status: true } })
    ]);
    const statusCounts = {};
    const categoryCounts = {};
    const dailyTrendMap = {};
    for (const appt of appointments) {
      statusCounts[appt.status] = (statusCounts[appt.status] || 0) + 1;
      const catName = appt.service?.category?.name || "Uncategorized";
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
      if (!dailyTrendMap[appt.appointmentDate]) {
        dailyTrendMap[appt.appointmentDate] = {
          date: appt.appointmentDate,
          appointments: 0,
          verifiedInr: 0
        };
      }
      dailyTrendMap[appt.appointmentDate].appointments += 1;
    }
    let verifiedTotalInr = 0;
    let pendingTotalInr = 0;
    for (const p of payments) {
      if (p.status === "VERIFIED") {
        verifiedTotalInr += p.amountSubmittedInr;
        if (!dailyTrendMap[p.paymentDate]) {
          dailyTrendMap[p.paymentDate] = {
            date: p.paymentDate,
            appointments: 0,
            verifiedInr: 0
          };
        }
        dailyTrendMap[p.paymentDate].verifiedInr += p.amountSubmittedInr;
      } else if (["PENDING", "SUBMITTED", "UNDER_VERIFICATION"].includes(p.status)) {
        pendingTotalInr += p.amountSubmittedInr;
      }
    }
    const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    const byCategory = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count
    }));
    const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));
    res.json({
      totals: {
        totalAppointments: appointments.length,
        verifiedTotalInr,
        pendingTotalInr,
        totalLeads: leads.length,
        convertedLeads: leads.filter((l) => l.status === "CONVERTED").length,
        publishedReports: reports.filter((r) => r.status === "PUBLISHED").length
      },
      dailyTrend,
      byCategory,
      byStatus
    });
  }
);
var admin_routes_default = router9;

// server/routes/hermes.routes.ts
import { Router as Router10 } from "express";
var router10 = Router10();
router10.use(requireHermesKey);
router10.use(async (req, res, next) => {
  if (req.method !== "GET") {
    await logAudit({
      actorRole: "HERMES_AGENT",
      action: "HERMES_PERMISSION_DENIED",
      resourceType: "HermesPolicy",
      summary: `Blocked non-GET mutation attempt ${req.method} ${req.originalUrl} (requires human approval)`,
      ipAddress: req.ip
    });
    res.status(403).json({
      error: "Hermes Agent is restricted to read-only operational summaries. Consequential actions require authorized human staff approval."
    });
    return;
  }
  next();
});
router10.get("/summary/appointments", async (req, res) => {
  const date = req.query.date ? String(req.query.date) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const [groupedByStatus, groupedByChannel] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { appointmentDate: date },
      _count: { _all: true }
    }),
    prisma.appointment.groupBy({
      by: ["bookingChannel"],
      where: { appointmentDate: date },
      _count: { _all: true }
    })
  ]);
  await logAudit({
    actorRole: "HERMES_AGENT",
    action: "HERMES_APPOINTMENT_SUMMARY",
    resourceType: "Appointment",
    summary: `Hermes queried aggregated appointment counts for ${date}`,
    ipAddress: req.ip
  });
  res.json({
    date,
    summaryByStatus: groupedByStatus.map((g) => ({
      status: g.status,
      count: g._count._all
    })),
    summaryByChannel: groupedByChannel.map((g) => ({
      channel: g.bookingChannel,
      count: g._count._all
    }))
  });
});
router10.get("/summary/inquiries", async (req, res) => {
  const [byStatus, bySource, openFollowUps] = await Promise.all([
    prisma.crmLead.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.crmLead.groupBy({
      by: ["source"],
      _count: { _all: true }
    }),
    prisma.crmTask.count({ where: { isCompleted: false } })
  ]);
  await logAudit({
    actorRole: "HERMES_AGENT",
    action: "HERMES_INQUIRY_SUMMARY",
    resourceType: "CrmLead",
    summary: "Hermes queried aggregated pending inquiry counts",
    ipAddress: req.ip
  });
  res.json({
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count._all })),
    openFollowUpTasks: openFollowUps
  });
});
router10.get("/summary/tasks", async (req, res) => {
  const [pendingPayments, openCrmTasks, newLeads, waitingVisits, unpublishedReports] = await Promise.all([
    prisma.payment.count({
      where: { status: { in: ["PENDING", "SUBMITTED", "UNDER_VERIFICATION"] } }
    }),
    prisma.crmTask.count({ where: { isCompleted: false } }),
    prisma.crmLead.count({
      where: { status: { in: ["NEW", "FOLLOW_UP", "APPOINTMENT_REQUESTED"] } }
    }),
    prisma.visit.count({ where: { status: "WAITING" } }),
    prisma.diagnosticReport.count({
      where: { status: { in: ["DRAFT", "UNDER_REVIEW", "REVISED"] } }
    })
  ]);
  await logAudit({
    actorRole: "HERMES_AGENT",
    action: "HERMES_TASKS_SUMMARY",
    resourceType: "OperationalTasks",
    summary: "Hermes queried pending operational task counts",
    ipAddress: req.ip
  });
  res.json({
    pendingPaymentVerifications: pendingPayments,
    openCrmFollowUpTasks: openCrmTasks,
    activeInquiries: newLeads,
    patientsWaitingInClinic: waitingVisits,
    reportsPendingDoctorReview: unpublishedReports
  });
});
router10.get("/services", async (req, res) => {
  const services = await prisma.diagnosticService.findMany({
    where: { isVisiblePublic: true, approvalStatus: "PUBLISHED" },
    orderBy: { name: "asc" },
    select: {
      code: true,
      slug: true,
      name: true,
      summary: true,
      preparationNotes: true,
      durationMinutes: true,
      requiresDoctorMorning: true,
      category: { select: { name: true } }
    }
  });
  await logAudit({
    actorRole: "HERMES_AGENT",
    action: "HERMES_SERVICES_READ",
    resourceType: "DiagnosticService",
    summary: `Hermes retrieved approved non-priced service directory (${services.length} services)`,
    ipAddress: req.ip
  });
  res.json({ services });
});
router10.get("/summary/reception", async (req, res) => {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const [todaysTotal, confirmedToday, pendingVerification, openInquiries] = await Promise.all([
    prisma.appointment.count({ where: { appointmentDate: today, status: { not: "CANCELLED" } } }),
    prisma.appointment.count({
      where: { appointmentDate: today, status: "CONFIRMED" }
    }),
    prisma.payment.count({
      where: { status: { in: ["PENDING", "SUBMITTED", "UNDER_VERIFICATION"] } }
    }),
    prisma.crmLead.count({ where: { status: { in: ["NEW", "FOLLOW_UP"] } } })
  ]);
  await logAudit({
    actorRole: "HERMES_AGENT",
    action: "HERMES_RECEPTION_SUMMARY",
    resourceType: "Appointment",
    summary: `Hermes queried daily reception summary for ${today}`,
    ipAddress: req.ip
  });
  res.json({
    date: today,
    todaysAppointmentsTotal: todaysTotal,
    confirmedToday,
    pendingPaymentVerifications: pendingVerification,
    openInquiries
  });
});
router10.get("/summary/operations", async (req, res) => {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const [
    appointmentsTotal,
    appointmentsToday,
    appointmentsCompleted,
    appointmentsCancelled,
    inquiriesTotal,
    leadsConverted,
    publishedReportsCount
  ] = await Promise.all([
    prisma.appointment.count(),
    prisma.appointment.count({ where: { appointmentDate: today, status: { not: "CANCELLED" } } }),
    prisma.appointment.count({ where: { status: "COMPLETED" } }),
    prisma.appointment.count({ where: { status: "CANCELLED" } }),
    prisma.crmLead.count(),
    prisma.crmLead.count({ where: { status: "CONVERTED" } }),
    prisma.diagnosticReport.count({ where: { status: "PUBLISHED" } })
  ]);
  await logAudit({
    actorRole: "HERMES_AGENT",
    action: "HERMES_OPERATIONS_REPORT",
    resourceType: "OperationalReport",
    summary: "Hermes queried aggregated non-PHI operational report",
    ipAddress: req.ip
  });
  res.json({
    date: today,
    aggregates: {
      appointmentsTotal,
      appointmentsToday,
      appointmentsCompleted,
      appointmentsCancelled,
      inquiriesTotal,
      leadsConverted,
      publishedReportsCount
    },
    privacyGuarantee: "AGGREGATE_NON_PHI_ONLY"
  });
});
router10.use(async (req, res) => {
  await logAudit({
    actorRole: "HERMES_AGENT",
    action: "HERMES_PERMISSION_DENIED",
    resourceType: "HermesPolicy",
    summary: `Blocked restricted Hermes route access: ${req.originalUrl}`,
    ipAddress: req.ip
  });
  res.status(403).json({
    error: "Access denied: Hermes Agent is strictly prohibited from accessing patient records, diagnostic reports, medical interpretation, or financial actions."
  });
});
var hermes_routes_default = router10;

// server/routes/integrations.routes.ts
import crypto11 from "crypto";
import { Router as Router11 } from "express";
import { z as z10 } from "zod";
var router11 = Router11();
function safeTimingCompare(a, b) {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto11.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
async function requireN8nAuth(req, res, next) {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" },
    select: { n8nWebhookSecret: true, n8nApiKey: true }
  });
  const secret = settings?.n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || "";
  const apiKey = settings?.n8nApiKey || process.env.N8N_API_KEY || "";
  const providedSig = String(req.headers["x-edfic-signature"] || "");
  const providedKey = String(req.headers["x-n8n-api-key"] || "");
  if (apiKey && safeTimingCompare(providedKey, apiKey)) {
    next();
    return;
  }
  if (secret && providedSig) {
    const rawBody = JSON.stringify(req.body ?? {});
    const expectedSig = crypto11.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (safeTimingCompare(providedSig, expectedSig)) {
      next();
      return;
    }
  }
  res.status(401).json({
    error: "Unauthorized n8n integration request. Valid X-EDFIC-Signature or X-N8N-API-KEY required."
  });
}
router11.post("/n8n/trigger-reminders", requireN8nAuth, async (req, res) => {
  const rawDate = req.body?.targetDate ?? req.body?.date;
  const targetDate = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : void 0;
  const result = await triggerUpcomingAppointmentReminders({
    targetDate,
    actorRole: "N8N_WORKFLOW"
  });
  res.json(result);
});
router11.post("/n8n/trigger-daily-summary", requireN8nAuth, async (req, res) => {
  const date = typeof req.body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? req.body.date : void 0;
  const result = await dispatchDailyReceptionSummary({
    date,
    actorRole: "N8N_WORKFLOW"
  });
  res.json(result);
});
var executionCallbackSchema = z10.object({
  eventId: z10.string().min(3),
  executionId: z10.string().min(1).max(120).optional(),
  status: z10.enum(["SENT", "DELIVERED", "FAILED"]),
  errorMessage: z10.string().max(400).optional()
});
router11.post("/n8n/execution-callback", requireN8nAuth, async (req, res) => {
  const parsed = executionCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid execution callback payload." });
    return;
  }
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId: parsed.data.eventId }
  });
  if (!existing) {
    res.status(404).json({ error: "Webhook event not found." });
    return;
  }
  const updated = await prisma.webhookEvent.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status === "DELIVERED" ? "SENT" : parsed.data.status,
      ...parsed.data.executionId ? { executionId: parsed.data.executionId } : {},
      ...parsed.data.errorMessage ? { lastError: parsed.data.errorMessage } : {}
    }
  });
  await logAudit({
    actorRole: "N8N_WORKFLOW",
    action: "N8N_EXECUTION_CALLBACK",
    resourceType: "WebhookEvent",
    resourceId: updated.id,
    summary: `n8n reported ${parsed.data.status} for ${updated.eventId}`,
    ipAddress: req.ip
  });
  res.json({ ok: true, eventId: updated.eventId, status: updated.status });
});
router11.get("/whatsapp/webhook", async (req, res) => {
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = String(req.query["hub.challenge"] || "");
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" },
    select: { whatsappWebhookSecret: true }
  });
  const verifyToken = settings?.whatsappWebhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET || "";
  if (mode === "subscribe" && verifyToken && safeTimingCompare(token, verifyToken)) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: "WhatsApp webhook verification failed." });
});
var whatsappStatusSchema = z10.object({
  externalMessageId: z10.string().min(1),
  status: z10.enum(["SENT", "DELIVERED", "READ", "FAILED"]),
  errorMessage: z10.string().max(400).optional()
});
router11.post("/whatsapp/webhook", async (req, res) => {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: "singleton" },
    select: { whatsappWebhookSecret: true }
  });
  const secret = settings?.whatsappWebhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET || "";
  const providedSecret = String(req.headers["x-whatsapp-webhook-secret"] || "");
  const hubSig = String(req.headers["x-hub-signature-256"] || "");
  let authorized = false;
  if (secret && safeTimingCompare(providedSecret, secret)) {
    authorized = true;
  } else if (secret && hubSig.startsWith("sha256=")) {
    const rawBody = JSON.stringify(req.body ?? {});
    const expected = "sha256=" + crypto11.createHmac("sha256", secret).update(rawBody).digest("hex");
    authorized = safeTimingCompare(hubSig, expected);
  }
  if (!authorized) {
    res.status(401).json({ error: "Unauthorized WhatsApp webhook callback." });
    return;
  }
  let parsedStatus = null;
  const direct = whatsappStatusSchema.safeParse(req.body);
  if (direct.success) {
    parsedStatus = direct.data;
  } else {
    const metaStatus = req.body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0] ?? null;
    if (metaStatus?.id && metaStatus?.status) {
      const upper = metaStatus.status.toUpperCase();
      if (["SENT", "DELIVERED", "READ", "FAILED"].includes(upper)) {
        parsedStatus = {
          externalMessageId: metaStatus.id,
          status: upper,
          errorMessage: metaStatus.errors?.[0]?.title
        };
      }
    }
  }
  if (!parsedStatus) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }
  const log = await prisma.whatsAppMessageLog.findFirst({
    where: { externalMessageId: parsedStatus.externalMessageId }
  });
  if (!log) {
    res.status(404).json({ error: "Matching WhatsApp log entry not found." });
    return;
  }
  const updated = await prisma.whatsAppMessageLog.update({
    where: { id: log.id },
    data: {
      status: parsedStatus.status,
      webhookVerified: true,
      ...parsedStatus.status === "DELIVERED" || parsedStatus.status === "READ" ? { deliveredAt: log.deliveredAt ?? /* @__PURE__ */ new Date() } : {},
      ...parsedStatus.errorMessage ? { errorMessage: parsedStatus.errorMessage } : {}
    }
  });
  await logAudit({
    actorRole: "WHATSAPP_WEBHOOK",
    action: "WHATSAPP_DELIVERY_STATUS_UPDATED",
    resourceType: "WhatsAppMessageLog",
    resourceId: updated.id,
    summary: `WhatsApp message ${parsedStatus.externalMessageId} marked ${parsedStatus.status}`,
    ipAddress: req.ip
  });
  res.json({ ok: true, logId: updated.id, status: updated.status });
});
var integrations_routes_default = router11;

// server/app.ts
async function createApp(options = {}) {
  ensureStorageDirectories();
  if (!options.skipSeed) {
    await ensureSeeded();
  }
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(requestLogger);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => Boolean(process.env.VITEST) || process.env.NODE_ENV === "test",
    message: { error: "Too many authentication attempts. Please try again shortly." }
  });
  const loginRegisterLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => Boolean(process.env.VITEST) || process.env.NODE_ENV === "test",
    message: { error: "Too many login or registration attempts. Please try again in 15 minutes." }
  });
  const publicWriteLimiter = rateLimit({
    windowMs: 10 * 60 * 1e3,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Request limit reached. Please wait a few minutes." }
  });
  const handleHealth = async (_req, res) => {
    const dbHealthy = await checkDatabaseHealth();
    const dbInitError2 = options.getDbInitError?.() || null;
    res.status(200).json({
      status: dbHealthy ? "ok" : "degraded",
      dbHealthy,
      service: "edfic-healthcare-platform",
      uptime: Math.round(process.uptime()),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: process.env.NODE_ENV || "development",
      ...dbInitError2 ? { details: "Database initialization pending or misconfigured; verify DATABASE_URL and Prisma schema." } : {}
    });
  };
  app.get("/health", handleHealth);
  app.get("/api/health", handleHealth);
  app.get("/robots.txt", (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host") || "localhost:3000"}`).replace(/\/+$/, "");
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /staff",
        "Disallow: /portal",
        "Disallow: /login",
        "Disallow: /api/",
        `Sitemap: ${baseUrl}/sitemap.xml`
      ].join("\n")
    );
  });
  app.get("/sitemap.xml", async (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host") || "localhost:3000"}`).replace(/\/+$/, "");
    const staticPaths = [
      { path: "/", priority: "1.0", changefreq: "weekly" },
      { path: "/about", priority: "0.8", changefreq: "monthly" },
      { path: "/fetal-imaging", priority: "0.9", changefreq: "weekly" },
      { path: "/general-ultrasound", priority: "0.9", changefreq: "weekly" },
      { path: "/doppler-studies", priority: "0.9", changefreq: "weekly" },
      { path: "/services", priority: "0.9", changefreq: "weekly" },
      { path: "/technology", priority: "0.7", changefreq: "monthly" },
      { path: "/doctor", priority: "0.8", changefreq: "monthly" },
      { path: "/patient-info", priority: "0.8", changefreq: "monthly" },
      { path: "/appointment-info", priority: "0.8", changefreq: "monthly" },
      { path: "/book", priority: "0.9", changefreq: "daily" },
      { path: "/faqs", priority: "0.7", changefreq: "monthly" },
      { path: "/contact", priority: "0.8", changefreq: "monthly" },
      { path: "/privacy-policy", priority: "0.4", changefreq: "yearly" },
      { path: "/terms-of-use", priority: "0.4", changefreq: "yearly" },
      { path: "/disclaimer", priority: "0.4", changefreq: "yearly" },
      { path: "/patient-consent", priority: "0.4", changefreq: "yearly" }
    ];
    let services = [];
    try {
      services = await prisma.diagnosticService.findMany({
        where: {
          isVisiblePublic: true,
          approvalStatus: "PUBLISHED",
          category: { isVisible: true }
        },
        select: { slug: true, updatedAt: true },
        orderBy: { name: "asc" }
      });
    } catch {
      services = [];
    }
    const urlsXml = [
      ...staticPaths.map(
        (u) => `  <url><loc>${baseUrl}${u.path}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      ),
      ...services.map(
        (s) => `  <url><loc>${baseUrl}/services/${s.slug}</loc><lastmod>${s.updatedAt.toISOString().slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
      )
    ].join("\n");
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`
    );
  });
  app.use("/api/v1", csrfProtection);
  app.use("/api/v1/auth/login", loginRegisterLimiter);
  app.use("/api/v1/auth/register", loginRegisterLimiter);
  app.use("/api/v1/auth", authLimiter, auth_routes_default);
  app.use("/api/v1/public/inquiries", publicWriteLimiter);
  app.use("/api/v1/public/chat", publicWriteLimiter);
  app.use("/api/v1/public", public_routes_default);
  app.use("/api/v1/appointments", appointments_routes_default);
  app.use("/api/v1/payments", payments_routes_default);
  app.use("/api/v1/patients", patients_routes_default);
  app.use("/api/v1/reports", reports_routes_default);
  app.use("/api/v1/crm", crm_routes_default);
  app.use("/api/v1/cms", cms_routes_default);
  app.use("/api/v1/admin", admin_routes_default);
  app.use("/api/v1/hermes", hermes_routes_default);
  app.use("/api/v1/integrations", integrations_routes_default);
  app.use("/api", function apiNotFoundHandler(_req, res) {
    res.status(404).json({ error: "API endpoint not found." });
  });
  const isTestEnv2 = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  if (options.isDev && options.viteServer) {
    app.use(options.viteServer.middlewares);
  } else if (!isTestEnv2) {
    const distPath = path4.resolve(process.cwd(), "dist");
    const publicPath = path4.resolve(process.cwd(), "public");
    const indexHtmlPath = path4.join(distPath, "index.html");
    if (fs3.existsSync(distPath)) {
      app.use(
        express.static(distPath, {
          index: false,
          maxAge: "1d",
          setHeaders(res, filePath) {
            if (path4.basename(filePath) === "index.html") {
              res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            }
          }
        })
      );
    }
    if (fs3.existsSync(publicPath)) {
      app.use(express.static(publicPath, { index: false, maxAge: "1d" }));
    }
    app.get("*", (_req, res) => {
      if (fs3.existsSync(indexHtmlPath)) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(indexHtmlPath);
      } else {
        res.status(503).type("text/plain").send('EDFIC frontend build not found. Run "npm run build" and restart the server.');
      }
    });
  }
  app.use(function errorHandler(err, _req, res, _next) {
    console.error("Unhandled server error:", err);
    if (res.headersSent) return;
    const message = process.env.NODE_ENV === "production" ? "An internal server error occurred." : err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  });
  return app;
}

// server.ts
var dbInitError = null;
var activeStartPromise = null;
function getCliArg(flagName) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === flagName && args[i + 1]) {
      return args[i + 1];
    }
    if (arg.startsWith(`${flagName}=`)) {
      return arg.slice(flagName.length + 1);
    }
  }
  return void 0;
}
async function createEdficApp() {
  return createApp({
    isDev: false,
    skipSeed: false,
    getDbInitError: () => dbInitError
  });
}
function startServer() {
  if (activeStartPromise) {
    return activeStartPromise;
  }
  activeStartPromise = (async () => {
    const distIndexPath = path5.resolve(process.cwd(), "dist", "index.html");
    const hasBuiltDist = fs4.existsSync(distIndexPath);
    const isDirectTsxEntry = Boolean(process.argv[1]?.endsWith("server.ts")) && process.env.NODE_ENV !== "production";
    const isProduction = process.env.NODE_ENV === "production" || !isDirectTsxEntry && hasBuiltDist;
    let viteServer;
    let isDev = !isProduction;
    if (isDev) {
      try {
        const { createServer: createViteServer } = await import("vite");
        viteServer = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa"
        });
      } catch (err) {
        console.warn(
          "Vite dev server unavailable; serving built dist/ bundle instead:",
          err instanceof Error ? err.message : err
        );
        isDev = false;
      }
    }
    const app = await createApp({
      isDev,
      viteServer,
      skipSeed: true,
      getDbInitError: () => dbInitError
    });
    const rawPort = getCliArg("--port") || process.env.PORT?.trim() || "3000";
    const host = getCliArg("--host") || process.env.HOST?.trim() || "0.0.0.0";
    const numericPort = Number(rawPort);
    const isSocketPath = Number.isNaN(numericPort) || numericPort <= 0;
    const listenTarget = isSocketPath ? rawPort : numericPort;
    const onListen = () => {
      const targetLabel = isSocketPath ? `socket ${listenTarget}` : `http://${host}:${listenTarget}`;
      console.log(
        `EDFIC Platform listening on ${targetLabel} (${process.env.NODE_ENV || (isDev ? "development" : "production")})`
      );
    };
    const server = isSocketPath ? app.listen(listenTarget, onListen) : app.listen(listenTarget, host, onListen);
    server.on("error", (err) => {
      console.error("EDFIC HTTP server error:", err);
    });
    void ensureSeeded().then(() => {
      dbInitError = null;
      console.log("EDFIC database schema & baseline data ready.");
    }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      dbInitError = message;
      console.error("EDFIC database initialization warning (HTTP server stays active):", message);
      if ((process.env.DATABASE_URL || "").startsWith("mysql://") && message.includes("protocol")) {
        console.error(
          "Hint: DATABASE_URL uses mysql:// while prisma/schema.prisma uses sqlite. Copy prisma/schema.mysql.prisma over prisma/schema.prisma and run npx prisma generate && npx prisma db push."
        );
      }
    });
    const shutdown = async (signal) => {
      console.log(`Received ${signal}, shutting down EDFIC server...`);
      const forceExitTimer = setTimeout(() => {
        console.error("Forced shutdown after 10s timeout.");
        process.exit(1);
      }, 1e4);
      forceExitTimer.unref();
      try {
        if (viteServer) {
          await viteServer.close();
        }
        server.close(async () => {
          await prisma.$disconnect();
          process.exit(0);
        });
      } catch (err) {
        console.error("Error during graceful shutdown:", err);
        process.exit(1);
      }
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    return server;
  })().catch((err) => {
    activeStartPromise = null;
    console.error("Failed to start EDFIC server:", err);
    throw err;
  });
  return activeStartPromise;
}
var isTestEnv = Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
if (!isTestEnv) {
  startServer().catch(() => {
    process.exit(1);
  });
}
export {
  createEdficApp,
  startServer
};
