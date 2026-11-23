export interface ComplianceScanResult {
  passed: boolean;
  issues: string[];
  checks: {
    noPricingOrDiscounts: boolean;
    noSexDetermination: boolean;
    noUnsupportedGuarantees: boolean;
    noPromotionalTestimonials: boolean;
  };
}

const PRICING_PATTERNS = [
  /₹\s*\d+/i,
  /\brs\.?\s*\d+/i,
  /\binr\s*\d+/i,
  /\bdiscount\b/i,
  /\boffer\s*price\b/i,
  /\bpackage\s*price\b/i,
  /\bflat\s*\d+%\s*off\b/i,
  /\bcheap(est)?\b/i,
];

const PCPNDT_PATTERNS = [
  /\bsex\s*determination\b/i,
  /\bgender\s*prediction\b/i,
  /\bboy\s*or\s*girl\b/i,
  /\bfetal\s*sex\b/i,
  /\bgender\s*reveal\b/i,
  /\bdetermine\s*gender\b/i,
];

const GUARANTEE_PATTERNS = [
  /\b100%\s*(accurate|guarantee|guaranteed|sure)\b/i,
  /\bbest\s*in\s*(india|lucknow|the\s*city)\b/i,
  /\bno\.?\s*1\b/i,
  /\bnumber\s*one\b/i,
  /\bguaranteed\s*(result|diagnosis|cure)\b/i,
];

const TESTIMONIAL_PATTERNS = [
  /\bpatient\s*review\b/i,
  /\b5[\s-]*star\s*rating\b/i,
  /\bsuccess\s*story\b/i,
  /\btestimonial\b/i,
];

export function scanMedicalContentCompliance(text: string): ComplianceScanResult {
  const issues: string[] = [];

  const noPricingOrDiscounts = !PRICING_PATTERNS.some((re) => re.test(text));
  if (!noPricingOrDiscounts) {
    issues.push(
      'Public content policy violation: Pricing, fees, discounts, or rate references detected.'
    );
  }

  const noSexDetermination = !PCPNDT_PATTERNS.some((re) => re.test(text));
  if (!noSexDetermination) {
    issues.push(
      'PCPNDT Act compliance alert: Gender prediction or sex determination phrasing detected.'
    );
  }

  const noUnsupportedGuarantees = !GUARANTEE_PATTERNS.some((re) => re.test(text));
  if (!noUnsupportedGuarantees) {
    issues.push(
      'NMC ethics alert: Unsupported superiority claims or diagnostic guarantees detected.'
    );
  }

  const noPromotionalTestimonials = !TESTIMONIAL_PATTERNS.some((re) => re.test(text));
  if (!noPromotionalTestimonials) {
    issues.push(
      'NMC ethics alert: Promotional testimonial or patient review language detected.'
    );
  }

  return {
    passed: issues.length === 0,
    issues,
    checks: {
      noPricingOrDiscounts,
      noSexDetermination,
      noUnsupportedGuarantees,
      noPromotionalTestimonials,
    },
  };
}
