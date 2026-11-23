import { execSync } from 'child_process';
import { prisma } from './lib/prisma.ts';
import { hashPassword } from './lib/security.ts';

interface SeedServiceDef {
  code: string;
  slug: string;
  name: string;
  categorySlug: string;
  summary: string;
  clinicalDescription: string;
  preparationNotes: string;
  durationMinutes: number;
  requiresDoctorMorning: boolean;
  advanceAmountInr: number;
}

const CATEGORIES = [
  {
    slug: 'obstetric-fetal-imaging',
    name: 'Obstetric & Fetal Imaging',
    description:
      'Specialized trimester-specific fetal ultrasound evaluations led by Dr. Varun Agrawal (DNB Radiology) for maternal and fetal care.',
    sortOrder: 1,
  },
  {
    slug: 'general-ultrasound',
    name: 'General Ultrasound',
    description:
      'High-resolution diagnostic ultrasonography for abdominal, renal, KUB, and general internal organ assessments.',
    sortOrder: 2,
  },
  {
    slug: 'doppler-vascular-studies',
    name: 'Doppler & Vascular Studies',
    description:
      'Color and spectral Doppler blood-flow assessments across obstetric, arterial, venous, carotid, and abdominal territories.',
    sortOrder: 3,
  },
  {
    slug: 'breast-imaging',
    name: 'Breast Imaging',
    description:
      'Dedicated high-frequency breast and axillary ultrasonography for diagnostic screening and targeted clinical evaluation.',
    sortOrder: 4,
  },
  {
    slug: 'musculoskeletal-small-parts',
    name: 'Musculoskeletal & Small Parts',
    description:
      'High-frequency linear imaging for thyroid, neck, scrotum, joints, soft tissue, and ophthalmic B-scan evaluations.',
    sortOrder: 5,
  },
  {
    slug: 'pelvic-transvaginal-ultrasound',
    name: 'Pelvic & Transvaginal Ultrasound',
    description:
      'Focused gynecological, follicular, and high-resolution 2D/3D transvaginal imaging performed with privacy and clinical sensitivity.',
    sortOrder: 6,
  },
  {
    slug: 'other-specialized-ultrasound',
    name: 'Other Specialized Ultrasound Investigations',
    description:
      'Image-guided diagnostic procedures and targeted regional ultrasound studies performed under specialist supervision.',
    sortOrder: 7,
  },
];

const SERVICES: SeedServiceDef[] = [
  // Obstetric & Fetal Imaging
  {
    code: 'OBS-NT',
    slug: 'nt-scan',
    name: 'NT Scan (Nuchal Translucency)',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'First-trimester fetal screening scan performed between 11 and 13+6 weeks of gestation.',
    clinicalDescription:
      'Evaluates nuchal translucency thickness, nasal bone visualization, crown-rump length, and early fetal anatomy as part of first-trimester screening.',
    preparationNotes: 'Bring previous dating scan and maternal blood test requisition if available. Mildly full bladder is helpful.',
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 500,
  },
  {
    code: 'OBS-ANOMALY',
    slug: 'anomaly-scan',
    name: 'Anomaly Scan (TIFFA / Level II)',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Detailed second-trimester fetal anatomical survey typically scheduled between 18 and 22 weeks.',
    clinicalDescription:
      'Systematic organ-by-organ evaluation of fetal cranial, cardiac, thoracic, abdominal, spinal, and limb development along with placental position and amniotic fluid.',
    preparationNotes: 'Carry earlier trimester ultrasound reports and obstetric prescriptions. Allow 30–45 minutes for thorough examination.',
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 700,
  },
  {
    code: 'OBS-GROWTH',
    slug: 'growth-scan',
    name: 'Growth Scan',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Third-trimester fetal biometry, presentation, placental maturity, and liquor assessment.',
    clinicalDescription:
      'Measures fetal growth parameters (BPD, HC, AC, FL), estimated fetal weight trends, fetal lie, placental localization, and amniotic fluid volume.',
    preparationNotes: 'Bring prior anomaly and dating reports for growth comparison.',
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 500,
  },
  {
    code: 'OBS-BPP',
    slug: 'bpp-biophysical-profile',
    name: 'BPP (Biophysical Profile)',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Dynamic assessment of fetal well-being combining fetal breathing, tone, movement, and amniotic fluid.',
    clinicalDescription:
      'Real-time ultrasound evaluation of fetal biophysical parameters as clinically indicated during late pregnancy.',
    preparationNotes: 'Have a light meal 60 minutes prior to the appointment unless advised otherwise.',
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 500,
  },
  {
    code: 'OBS-CERVIX',
    slug: 'cervical-length',
    name: 'Cervical Length Assessment',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Precise measurement of cervical canal length and internal os status during pregnancy.',
    clinicalDescription:
      'Assesses cervical competence and length to assist obstetricians in monitoring pregnancy progression.',
    preparationNotes: 'Empty bladder immediately prior if performed transvaginally; follow clinician instructions.',
    durationMinutes: 20,
    requiresDoctorMorning: true,
    advanceAmountInr: 500,
  },
  {
    code: 'OBS-FECHO',
    slug: 'fetal-echo',
    name: 'Fetal Echo (Fetal Echocardiography)',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Targeted evaluation of the fetal heart chambers, outflow tracts, arches, and cardiac rhythm.',
    clinicalDescription:
      'Specialist-led fetal cardiac examination indicated for detailed evaluation of cardiac anatomy and blood flow patterns, typically between 20 and 24 weeks.',
    preparationNotes: 'Carry Level II Anomaly Scan report and referring obstetrician or cardiologist notes.',
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 800,
  },
  {
    code: 'OBS-VIAB',
    slug: 'early-pregnancy-viability-scan',
    name: 'Early Pregnancy Viability Scan',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Early first-trimester confirmation of intrauterine gestation sac, fetal pole, and cardiac activity.',
    clinicalDescription:
      'Confirms gestational sac location, crown-rump dating, and early embryonic development.',
    preparationNotes: 'Drink 2–3 glasses of water 45 minutes before scan if scheduled transabdominally.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500,
  },
  {
    code: 'OBS-TWIN',
    slug: 'twin-pregnancy-scan',
    name: 'Twin Pregnancy Scan',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Dedicated dual-gestation monitoring evaluating chorionicity, amnionicity, and comparative fetal growth.',
    clinicalDescription:
      'Structured twin pregnancy ultrasound assessing twin biometry, amniotic fluid pockets, placental sharing, and Doppler indices.',
    preparationNotes: 'Carry all prior twin pregnancy records and allow extra examination time.',
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 700,
  },
  {
    code: 'OBS-L1TWIN',
    slug: 'level-1-twin-scan',
    name: 'Level 1 Twin Scan',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'First-trimester screening and chorionicity assignment for twin gestations.',
    clinicalDescription:
      'Documents twin crown-rump lengths, nuchal translucency, membrane thickness (lambda/T-sign), and early structural milestones.',
    preparationNotes: 'Bring LMP details and prior early pregnancy scans.',
    durationMinutes: 45,
    requiresDoctorMorning: true,
    advanceAmountInr: 700,
  },
  {
    code: 'OBS-AFI',
    slug: 'afi-amniotic-fluid-index',
    name: 'AFI (Amniotic Fluid Index)',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Targeted four-quadrant measurement of amniotic fluid volume and fetal presentation.',
    clinicalDescription:
      'Assesses liquor adequacy and fetal position for obstetric decision-making.',
    preparationNotes: 'No special fasting required; bring latest obstetric file.',
    durationMinutes: 20,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },
  {
    code: 'OBS-ROUTINE',
    slug: 'obstetric-routine-usg',
    name: 'Obstetric Routine USG',
    categorySlug: 'obstetric-fetal-imaging',
    summary: 'Standard pregnancy ultrasound for fetal presentation, cardiac activity, and interval check.',
    clinicalDescription:
      'Provides routine obstetric ultrasound assessment per referring clinician guidance.',
    preparationNotes: 'Bring antenatal card and prior ultrasound reports.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500,
  },

  // General Ultrasound
  {
    code: 'GEN-ABD',
    slug: 'abdomen-ultrasound',
    name: 'Abdomen Ultrasound',
    categorySlug: 'general-ultrasound',
    summary: 'Diagnostic imaging of liver, gallbladder, biliary tree, pancreas, spleen, and abdominal aorta.',
    clinicalDescription:
      'High-resolution upper abdominal evaluation for hepatobiliary, pancreatic, and splenic conditions.',
    preparationNotes: '6 hours of fasting (plain water permitted) prior to examination for optimal gallbladder evaluation.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },
  {
    code: 'GEN-KUB',
    slug: 'kub-ultrasound',
    name: 'KUB (Kidneys, Ureters & Bladder)',
    categorySlug: 'general-ultrasound',
    summary: 'Focused urinary tract ultrasound evaluating renal parenchyma, calculi, ureteric dilatation, and bladder.',
    clinicalDescription:
      'Assesses kidney size, corticomedullary differentiation, hydronephrosis, bladder wall, and post-void residual urine.',
    preparationNotes: 'Drink 3–4 glasses of water 45–60 minutes prior and hold urine until scan completion.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },

  // Doppler & Vascular Studies
  {
    code: 'DOP-STUDY',
    slug: 'doppler-study',
    name: 'Obstetric Doppler Study',
    categorySlug: 'doppler-vascular-studies',
    summary: 'Umbilical, middle cerebral artery (MCA), and uterine artery blood-flow evaluation during pregnancy.',
    clinicalDescription:
      'Color and spectral Doppler assessment evaluating fetoplacental circulation and fetal hemodynamic adaptation.',
    preparationNotes: 'Bring recent growth scan and obstetric referral slip.',
    durationMinutes: 35,
    requiresDoctorMorning: true,
    advanceAmountInr: 600,
  },
  {
    code: 'DOP-ABD',
    slug: 'abdomen-doppler',
    name: 'Abdomen Doppler',
    categorySlug: 'doppler-vascular-studies',
    summary: 'Color Doppler assessment of portal vein, hepatic veins, IVC, and mesenteric vasculature.',
    clinicalDescription:
      'Evaluates hepatic and splanchnic venous/arterial flow direction, patency, and velocity waveforms.',
    preparationNotes: '6 hours fasting recommended prior to examination.',
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600,
  },
  {
    code: 'DOP-ART',
    slug: 'arterial-doppler',
    name: 'Arterial Doppler',
    categorySlug: 'doppler-vascular-studies',
    summary: 'Upper or lower limb arterial color Doppler for peripheral vascular flow and stenosis screening.',
    clinicalDescription:
      'Assesses arterial patency, triphasic/monophasic waveform morphology, plaque, and collateral flow.',
    preparationNotes: 'Wear comfortable loose clothing; bring clinical notes.',
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600,
  },
  {
    code: 'DOP-VEN',
    slug: 'venous-doppler',
    name: 'Venous Doppler',
    categorySlug: 'doppler-vascular-studies',
    summary: 'Upper or lower limb venous Doppler for DVT exclusion and venous insufficiency mapping.',
    clinicalDescription:
      'Compression ultrasonography with color and spectral Doppler for deep venous thrombosis and saphenofemoral competence.',
    preparationNotes: 'No fasting required; inform staff of affected limb side.',
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600,
  },
  {
    code: 'DOP-CAR',
    slug: 'carotid-doppler',
    name: 'Carotid Doppler',
    categorySlug: 'doppler-vascular-studies',
    summary: 'Bilateral carotid and vertebral artery color Doppler evaluation.',
    clinicalDescription:
      'Measures intima-media thickness, atherosclerotic plaque characteristics, and peak systolic flow velocities.',
    preparationNotes: 'Wear an open-collar shirt without neck jewelry.',
    durationMinutes: 30,
    requiresDoctorMorning: false,
    advanceAmountInr: 600,
  },
  {
    code: 'DOP-REN',
    slug: 'renal-doppler',
    name: 'Renal Doppler',
    categorySlug: 'doppler-vascular-studies',
    summary: 'Bilateral renal artery and intrarenal resistive index Doppler study.',
    clinicalDescription:
      'Evaluates main renal arteries and segmental waveforms for renovascular assessment.',
    preparationNotes: '6 hours fasting with light low-gas diet the evening before helps visualization.',
    durationMinutes: 35,
    requiresDoctorMorning: false,
    advanceAmountInr: 600,
  },
  {
    code: 'DOP-IOTA',
    slug: 'iota-doppler',
    name: 'IOTA Doppler',
    categorySlug: 'doppler-vascular-studies',
    summary: 'Structured pelvic adnexal assessment utilizing IOTA ultrasound and vascular Doppler criteria.',
    clinicalDescription:
      'Standardized morphological and vascularity characterization of ovarian/adnexal findings to assist gynecological evaluation.',
    preparationNotes: 'Follow clinician instructions regarding full or empty bladder depending on transabdominal/TVS approach.',
    durationMinutes: 35,
    requiresDoctorMorning: true,
    advanceAmountInr: 600,
  },

  // Breast Imaging
  {
    code: 'BRS-USG',
    slug: 'breast-ultrasound',
    name: 'Breast Ultrasound (Bilateral / Targeted)',
    categorySlug: 'breast-imaging',
    summary: 'High-frequency sonomammography of breast parenchyma and bilateral axillae.',
    clinicalDescription:
      'Evaluates palpable lumps, focal tenderness, dense breast tissue, and axillary lymph nodes without ionizing radiation.',
    preparationNotes: 'Avoid applying talcum powder or deodorant on the chest/underarms on the day of scan. Bring prior mammogram if available.',
    durationMinutes: 30,
    requiresDoctorMorning: false,
    advanceAmountInr: 500,
  },

  // Musculoskeletal & Small Parts
  {
    code: 'SP-THY',
    slug: 'thyroid-ultrasound',
    name: 'Thyroid Ultrasound',
    categorySlug: 'musculoskeletal-small-parts',
    summary: 'High-resolution imaging of thyroid lobes, isthmus, and cervical lymph nodes.',
    clinicalDescription:
      'Evaluates thyroid volume, parenchymal echotexture, nodules (TI-RADS characterization), and parathyroid region.',
    preparationNotes: 'No fasting required; wear comfortable open-neck attire.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },
  {
    code: 'SP-SCR',
    slug: 'scrotum-ultrasound',
    name: 'Scrotum Ultrasound (with Doppler)',
    categorySlug: 'musculoskeletal-small-parts',
    summary: 'High-frequency testicular, epididymal, and pampiniform plexus evaluation.',
    clinicalDescription:
      'Assesses testicular morphology, vascularity, hydrocele, varicocele, and epididymal pathology.',
    preparationNotes: 'No fasting required.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500,
  },
  {
    code: 'SP-GEN',
    slug: 'small-parts-ultrasound',
    name: 'Small Parts Ultrasound',
    categorySlug: 'musculoskeletal-small-parts',
    summary: 'Targeted superficial high-frequency ultrasound for subcutaneous swellings, salivary glands, and lymph nodes.',
    clinicalDescription:
      'Evaluates focal soft-tissue lesions, parotid/submandibular glands, abdominal wall hernias, and superficial structures.',
    preparationNotes: 'No specific preparation needed.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },
  {
    code: 'SP-MSK',
    slug: 'msk-musculoskeletal-ultrasound',
    name: 'MSK (Musculoskeletal Ultrasound)',
    categorySlug: 'musculoskeletal-small-parts',
    summary: 'Dynamic tendon, ligament, muscle, bursa, and joint space ultrasound evaluation.',
    clinicalDescription:
      'High-resolution static and dynamic imaging of shoulder, knee, ankle, wrist, or focal musculoskeletal injuries.',
    preparationNotes: 'Wear clothing allowing easy access to the affected joint; bring prior X-ray or MRI if available.',
    durationMinutes: 30,
    requiresDoctorMorning: false,
    advanceAmountInr: 500,
  },
  {
    code: 'SP-BSCAN',
    slug: 'b-scan-ocular-ultrasound',
    name: 'B Scan (Ophthalmic Ultrasound)',
    categorySlug: 'musculoskeletal-small-parts',
    summary: 'Non-invasive ocular B-scan evaluating posterior segment, vitreous, retina, and retrobulbar space.',
    clinicalDescription:
      'Diagnostic ophthalmic ultrasonography performed gently over closed eyelids when fundus view is obscured.',
    preparationNotes: 'Remove contact lenses before the scan and avoid eye makeup.',
    durationMinutes: 20,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },
  {
    code: 'SP-NECK',
    slug: 'neck-ultrasound',
    name: 'Neck Ultrasound',
    categorySlug: 'musculoskeletal-small-parts',
    summary: 'Comprehensive soft-tissue evaluation of cervical lymph nodes, salivary glands, and neck spaces.',
    clinicalDescription:
      'High-frequency examination of anterior and lateral neck compartments.',
    preparationNotes: 'Remove necklaces prior to examination.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },

  // Pelvic & Transvaginal Ultrasound
  {
    code: 'PEL-USG',
    slug: 'pelvic-ultrasound',
    name: 'Pelvic Ultrasound',
    categorySlug: 'pelvic-transvaginal-ultrasound',
    summary: 'Transabdominal assessment of uterus, endometrium, ovaries, adnexa, and pelvic cavity.',
    clinicalDescription:
      'Evaluates uterine dimensions, fibroids, endometrial thickness, ovarian morphology, and pelvic fluid.',
    preparationNotes: 'Drink 4 glasses of water 45 minutes prior; comfortably full bladder required.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },
  {
    code: 'PEL-FOLL',
    slug: 'follicular-monitoring',
    name: 'Follicular Monitoring',
    categorySlug: 'pelvic-transvaginal-ultrasound',
    summary: 'Serial ultrasound tracking of ovarian follicular growth, ovulation, and endometrial receptivity.',
    clinicalDescription:
      'Accurate serial measurement of dominant follicle diameter and endometrial trilaminar thickness.',
    preparationNotes: 'Empty bladder right before TVS study; bring cycle day and medication details.',
    durationMinutes: 20,
    requiresDoctorMorning: false,
    advanceAmountInr: 400,
  },
  {
    code: 'PEL-TVS',
    slug: 'tvs-transvaginal-scan',
    name: 'TVS (Transvaginal Ultrasound)',
    categorySlug: 'pelvic-transvaginal-ultrasound',
    summary: 'High-resolution endovaginal pelvic and early-pregnancy diagnostic imaging.',
    clinicalDescription:
      'Provides superior near-field visualization of uterus, endometrium, ovaries, adnexa, and early gestation.',
    preparationNotes: 'Empty bladder immediately before scan. Performed with sterile probe cover and strict privacy.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500,
  },
  {
    code: 'PEL-TVSTWIN',
    slug: 'tvs-twin-pregnancy',
    name: 'TVS Twin Pregnancy',
    categorySlug: 'pelvic-transvaginal-ultrasound',
    summary: 'Focused transvaginal evaluation in early twin gestation or cervical assessment.',
    clinicalDescription:
      'High-resolution endovaginal imaging for early twin chorionicity or cervical length monitoring.',
    preparationNotes: 'Empty bladder prior to scan; bring prior obstetric records.',
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 600,
  },
  {
    code: 'PEL-TVS3D',
    slug: 'tvs-3d-scan',
    name: 'TVS 3D Scan (3D Pelvic Ultrasound)',
    categorySlug: 'pelvic-transvaginal-ultrasound',
    summary: 'Three-dimensional coronal reconstruction of the uterine cavity, septum, and adnexal anatomy.',
    clinicalDescription:
      'Volumetric 3D transvaginal ultrasound used in uterine anomaly mapping, endometrial assessment, and fertility workups.',
    preparationNotes: 'Empty bladder just prior to examination.',
    durationMinutes: 30,
    requiresDoctorMorning: true,
    advanceAmountInr: 700,
  },

  // Other Specialized Ultrasound Investigations
  {
    code: 'OTH-CHEST',
    slug: 'chest-ultrasound',
    name: 'Chest / Pleural Ultrasound',
    categorySlug: 'other-specialized-ultrasound',
    summary: 'Evaluation of pleural effusion, chest wall lesions, and pleural-based collections.',
    clinicalDescription:
      'Quantifies pleural fluid, internal septations, and guides pre-procedural marking.',
    preparationNotes: 'Carry recent chest X-ray or CT report if available.',
    durationMinutes: 25,
    requiresDoctorMorning: false,
    advanceAmountInr: 500,
  },
  {
    code: 'OTH-HEAD',
    slug: 'head-neurosonogram',
    name: 'Head Ultrasound (Neonatal Neurosonogram)',
    categorySlug: 'other-specialized-ultrasound',
    summary: 'Transfontanellar cranial ultrasound for newborns and young infants.',
    clinicalDescription:
      'Radiation-free evaluation of neonatal cerebral ventricles and intracranial anatomy via the anterior fontanelle.',
    preparationNotes: 'Feeding the infant shortly before the appointment often keeps them calm during scanning.',
    durationMinutes: 25,
    requiresDoctorMorning: true,
    advanceAmountInr: 500,
  },
  {
    code: 'OTH-FNAC',
    slug: 'fnac-guided-ultrasound',
    name: 'FNAC-Guided Ultrasound',
    categorySlug: 'other-specialized-ultrasound',
    summary: 'Real-time ultrasound guidance for targeted fine needle aspiration cytology sampling.',
    clinicalDescription:
      'Precision image guidance for thyroid, lymph node, breast, or superficial lesion sampling in coordination with pathology.',
    preparationNotes: 'Inform reception of any blood-thinning medications (aspirin, clopidogrel, anticoagulants) prior to scheduling.',
    durationMinutes: 35,
    requiresDoctorMorning: true,
    advanceAmountInr: 700,
  },
];

const INITIAL_CMS_ITEMS = [
  {
    slug: 'about-edfic',
    pageKey: 'about',
    title: 'About EDFIC - A Specialized Wing of EWA DERMA',
    contentMarkdown: `EWA Diagnostic and Fetal Imaging Centre (EDFIC) operates as a specialized diagnostic and fetal imaging wing of EWA DERMA at Unit 10, Millennium Place, Sushant Golf City, Lucknow (near Lulu Mall).

Our practice is structured around appointment-based scheduling, specialist radiologist oversight, and structured diagnostic reporting so patients receive clear clinical communication without unnecessary waiting.`,
  },
  {
    slug: 'fetal-imaging-guide',
    pageKey: 'fetal-imaging',
    title: 'Trimester-Wise Fetal Imaging Pathway',
    contentMarkdown: `Fetal imaging at EDFIC follows clinically established obstetric milestones:
- Early Pregnancy Viability (6–9 weeks): Confirmation of gestational location, dating, and cardiac activity.
- First-Trimester NT & Screening Scan (11–13+6 weeks): Nuchal translucency measurement and early anatomical check.
- Second-Trimester Anomaly Scan (18–22 weeks): Comprehensive structural survey and fetal echocardiography when indicated.
- Third-Trimester Growth & Doppler (28–36+ weeks): Interval growth biometry, liquor index, and fetoplacental Doppler studies.

EDFIC strictly adheres to the Pre-Conception and Pre-Natal Diagnostic Techniques (PCPNDT) Act & Rules. Sex determination or gender prediction is strictly prohibited and not performed or communicated under any circumstances.`,
  },
  {
    slug: 'patient-consent-policy',
    pageKey: 'patient-consent',
    title: 'Patient Consent & PCPNDT Compliance Information',
    contentMarkdown: `1. Informed Consent: Every diagnostic ultrasound or image-guided procedure is conducted with informed patient consent and clinical referral documentation where applicable.
2. PCPNDT Statutory Compliance: All obstetric ultrasound examinations at EDFIC are performed strictly in accordance with the Pre-Conception and Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994. Patients undergoing obstetric scans are required to present valid photo identification and complete Form F statutory declarations as mandated by law.
3. Diagnostic Report Confidentiality: Finalized diagnostic reports are released exclusively to the patient or authorized clinician through verified channels and the authenticated patient portal.`,
  },
  {
    slug: 'privacy-policy',
    pageKey: 'privacy-policy',
    title: 'EDFIC Privacy & Patient Data Protection Notice',
    contentMarkdown: `EDFIC collects personal and clinical information solely for appointment scheduling, diagnostic examination delivery, statutory medical compliance, and authorized report access. Patient records and diagnostic PDFs are stored in access-controlled private storage with audit logging and are never published to public URLs or shared with unauthorized third parties.`,
  },
  {
    slug: 'terms-of-use',
    pageKey: 'terms-of-use',
    title: 'Terms and Conditions',
    contentMarkdown: `Appointments at EDFIC are scheduled by time slot and confirmed upon verification of the configured UPI advance reference by reception staff. Uploading a payment screenshot or UTR initiates manual verification and does not constitute automatic confirmation until verified against clinic banking records. Medical information on this website is educational and does not substitute an in-person clinical consultation.`,
  },
  {
    slug: 'disclaimer',
    pageKey: 'disclaimer',
    title: 'Medical & Diagnostic Disclaimer',
    contentMarkdown: `1. Educational Information Only: All clinical descriptions, scan preparation guides, and blog articles published on the EDFIC website are intended strictly for general patient awareness and educational reference. They do not constitute medical advice, diagnosis, or a substitute for an in-person consultation with a qualified physician or radiologist.

2. Diagnostic Interpretation & Clinical Correlation: Ultrasound, Doppler, and image-guided findings must always be interpreted by your referring obstetrician, physician, or specialist in conjunction with your complete clinical history, physical examination, and laboratory investigations.

3. Diagnostic Limitations: While EDFIC utilizes high-resolution imaging systems and follows standardized clinical protocols, medical ultrasound has recognized technical and biological limitations (such as fetal position, maternal habitus, gestational age, and acoustic windows), and no imaging modality can guarantee the detection of every congenital or medical condition.

4. Emergency Care Notice: This website and patient portal are not monitored for acute medical emergencies. In the event of an urgent or life-threatening medical situation, please contact emergency medical services or visit the nearest hospital emergency department immediately.`,
  },
];

async function ensureSqliteTablesExist(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.startsWith('file:')) return;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ClinicSetting'"
    );
    if (rows.length === 0) {
      console.log('SQLite tables missing; running prisma db push --skip-generate...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    }
  } catch (err) {
    console.warn('SQLite schema check failed, attempting prisma db push:', err);
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  }
}

export async function ensureSeeded(): Promise<void> {
  await ensureSqliteTablesExist();
  // Ensure singleton clinic settings exist
  await prisma.clinicSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      clinicName: 'EDFIC',
      fullName: 'EWA Diagnostic and Fetal Imaging Centre',
      parentUnitName: 'A Unit of EWA DERMA',
      tagline: 'Advanced Fetal Imaging & Diagnostic Services in Lucknow.',
      addressLine: 'Unit 10, Millennium Place, Sushant Golf City',
      landmark: 'Near Lulu Mall',
      cityStateCountry: 'Lucknow, Uttar Pradesh, India',
      primaryPhone: '+91 94578 89090',
      secondaryPhone: '',
      whatsappNumber: '+91 94578 89090',
      officialEmail: 'care@ewafetalimaging.com',
      weekdayHours: 'Monday–Saturday: 9:00 AM – 8:00 PM',
      sundayHours: 'Sunday: 10:00 AM – 2:00 PM (By Appointment)',
      slotDurationMinutes: 30,
      slotCapacityPerSlot: 2,
      morningSessionStart: '09:30',
      morningSessionEnd: '13:30',
      upiId: 'edfic.lucknow@upi',
      upiMerchantName: 'EWA Diagnostic & Fetal Imaging Centre',
      defaultAdvanceAmountInr: 500,
    },
  });

  // Seed categories & services idempotently
  const catMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const record = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
      },
      create: cat,
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
        approvalStatus: 'PUBLISHED',
        advanceAmountInr: svc.advanceAmountInr,
        internalBaseFeeInr: 0,
      },
    });
  }

  // Seed initial compliance-approved CMS pages
  for (const item of INITIAL_CMS_ITEMS) {
    await prisma.cmsContentItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        pageKey: item.pageKey,
        title: item.title,
        contentMarkdown: item.contentMarkdown,
        status: 'PUBLISHED',
        checklistNoPrice: true,
        checklistNoSexDetermination: true,
        checklistNoGuarantee: true,
        checklistNoFakeTestimonial: true,
        medicalReviewerName: 'Dr. Varun Agrawal (DNB Radiology)',
        complianceReviewerName: 'EDFIC Compliance Desk',
        finalApproverName: 'Medical Director',
        publishedAt: new Date(),
      },
    });
  }

  // Seed initial role accounts ONLY if zero users exist and not explicitly disabled
  const userCount = await prisma.user.count();
  if (userCount === 0 && process.env.DISABLE_DEV_SEED !== 'true') {
    const devAccounts = [
      {
        email: 'admin@edfic.local',
        fullName: 'EDFIC Super Administrator',
        role: 'SUPER_ADMIN' as const,
        phone: '9000000001',
      },
      {
        email: 'reception@edfic.local',
        fullName: 'Front Desk Reception',
        role: 'RECEPTION' as const,
        phone: '9000000002',
      },
      {
        email: 'patient@edfic.local',
        fullName: 'Ananya Sharma (Dev Test Patient)',
        role: 'PATIENT' as const,
        phone: '9876543210',
      },
    ];

    const defaultPasswordHash = await hashPassword('Edfic@2026!');

    for (const acc of devAccounts) {
      const user = await prisma.user.create({
        data: {
          email: acc.email,
          passwordHash: defaultPasswordHash,
          fullName: acc.fullName,
          phone: acc.phone,
          role: acc.role,
          isActive: true,
        },
      });

      if (acc.role === 'PATIENT') {
        await prisma.patient.create({
          data: {
            patientCode: 'EDF-PT-1001',
            userId: user.id,
            fullName: acc.fullName,
            phone: acc.phone,
            email: acc.email,
            address: 'Sushant Golf City, Lucknow',
            consentAccepted: true,
            consentTimestamp: new Date(),
          },
        });
      }
    }
  }
}

// Allow running directly via `npm run db:seed`
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('seed.ts');

if (isDirectRun) {
  ensureSeeded()
    .then(() => {
      console.log('EDFIC seed completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('EDFIC seed failed:', err);
      process.exit(1);
    });
}
