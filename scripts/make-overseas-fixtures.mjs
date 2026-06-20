/**
 * Generates synthetic, text-based PDF fixtures for the "overseas-english" persona:
 *   1. An overseas academic transcript (Universitas Indonesia, taught in Indonesian)
 *      so the eligibility check can't confirm English-medium study and flags the
 *      English proficiency requirement.
 *   2. An IELTS Academic Test Report Form the applicant uploads to evidence English
 *      proficiency.
 *
 * Both are entirely fictional — no real personal data — and use a plain text layer
 * so the document parsers can read them. Run: node scripts/make-overseas-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function pdfEscape(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Build a minimal single-page PDF with the given lines of text. */
function buildTextPdf(lines) {
  let content = "BT\n/F1 11 Tf\n50 770 Td\n13 TL\n";
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

  return Buffer.from(pdf, "latin1");
}

function write(outPath, lines) {
  mkdirSync(dirname(outPath), { recursive: true });
  const buffer = buildTextPdf(lines);
  writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
}

write("tests/fixtures/transcript-v3/pdfs/SYNTH-INT-universitas_indonesia.pdf", [
  "UNIVERSITAS INDONESIA",
  "Official Academic Transcript / Transkrip Akademik Resmi",
  "",
  "Student Name: Diego Santos",
  "Faculty: Faculty of Engineering (Fakultas Teknik)",
  "Program: Bachelor of Engineering (Sarjana Teknik)",
  "Country of Institution: Indonesia",
  "Language of Instruction: Indonesian (Bahasa Indonesia)",
  "Period of Study: August 2013 to July 2017",
  "Completion Status: Graduated, award conferred",
  "Grade Point Average (GPA): 3.45 / 4.00",
  "",
  "Subjects and Results:",
  "Engineering Mathematics I        A",
  "Engineering Mathematics II       A-",
  "Engineering Mechanics            B+",
  "Thermodynamics                   A-",
  "Materials Science                B+",
  "Electrical Circuits              A",
  "Fluid Mechanics                  B+",
  "Engineering Design Project       A",
  "",
  "This transcript is issued in Bahasa Indonesia. The program was taught and",
  "assessed in Indonesian. No English-medium instruction is recorded.",
]);

write("tests/fixtures/language/synthetic_ielts_results.pdf", [
  "IELTS Academic - Test Report Form",
  "International English Language Testing System",
  "",
  "Candidate Name: Diego Santos",
  "Test Date: 15 March 2023",
  "Test Module: Academic",
  "Centre: Melbourne, Australia",
  "",
  "Listening:  7.5",
  "Reading:    8.0",
  "Writing:    7.0",
  "Speaking:   7.5",
  "Overall Band Score: 7.5",
  "",
  "Test Report Form Number: 23AU012345DSAN001A",
  "This is a synthetic test report form for testing purposes only.",
]);
