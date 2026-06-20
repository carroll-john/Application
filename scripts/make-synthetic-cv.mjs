/**
 * Generates a synthetic, text-based CV PDF for the synthetic funnel bot to upload.
 *
 * The person and history are entirely fictional — no real personal data — but the
 * employment dates are clean and chronological (one current role) so the CV parser's
 * employment auto-fill produces records that pass submission validation. Run with
 * `node scripts/make-synthetic-cv.mjs`; output goes to tests/fixtures/cv/.
 */
import { writeFileSync } from "node:fs";

const lines = [
  "ALEX MORGAN",
  "Melbourne VIC  |  alex.morgan@example.com  |  0400 000 000",
  "",
  "PROFESSIONAL SUMMARY",
  "Business analyst with 10+ years across financial services and",
  "education technology. Skilled in stakeholder management, data",
  "analysis, and process improvement.",
  "",
  "EMPLOYMENT HISTORY",
  "Senior Business Analyst - Acme Corporation",
  "March 2020 to Present, Melbourne VIC",
  "Lead analyst for the customer platform; own requirements and",
  "reporting for a team of twelve.",
  "",
  "Business Analyst - Globex Pty Ltd",
  "February 2017 to February 2020, Sydney NSW",
  "Delivered process improvements across the operations group.",
  "",
  "Junior Analyst - Initech Australia",
  "January 2014 to January 2017, Brisbane QLD",
  "Supported reporting and data-quality initiatives.",
  "",
  "EDUCATION",
  "Bachelor of Commerce - Monash University, 2010 to 2013",
  "",
  "SKILLS",
  "SQL, Python, Tableau, stakeholder engagement, agile delivery.",
];

function pdfEscape(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

let content = "BT\n/F1 12 Tf\n50 760 Td\n14 TL\n";
for (const line of lines) {
  content += `(${pdfEscape(line)}) Tj\nT*\n`;
}
content += "ET\n";

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, index) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets) {
  pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

const outPath = "tests/fixtures/cv/synthetic_cv_alex_morgan.pdf";
writeFileSync(outPath, Buffer.from(pdf, "latin1"));
console.log(`Wrote ${outPath} (${Buffer.byteLength(pdf)} bytes)`);
