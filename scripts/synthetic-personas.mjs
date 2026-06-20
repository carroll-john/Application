/**
 * Personas for the synthetic funnel bot.
 *
 * Each persona supplies the values the bot types into the journey, so a run
 * produces a believable applicant rather than generic "Synth Test" data — which
 * is what makes the dashboards (course_provider, eligibility_outcome, parser
 * outcomes, drop-off) and session replays actually useful.
 *
 * Field notes:
 * - A regex/string value picks that specific <option> (e.g. citizenship); `null`
 *   lets the bot pick the first valid option, which is fine for "any value".
 * - `documents.transcript` / `documents.cv` are optional file paths. Provide real
 *   PDF/DOCX files to exercise the transcript + CV parsers and the AI eligibility
 *   check; leave null to skip uploads (the happy path doesn't require them).
 * - `tertiary.country` (regex/string) is set on the qualification when present; an
 *   overseas, non-English-medium country makes the English proficiency check
 *   mandatory, which `languageTest` then satisfies.
 * - `languageTest` (optional) makes the bot add an English language test record
 *   (type/name/year + results document) — used when English proficiency must be
 *   evidenced.
 * - `accreditation` (optional) makes the bot add a professional accreditation
 *   (name/status + optional document). An AHPRA registration name (e.g. "Registered
 *   Nurse") is itself accepted as proof of English proficiency, so it satisfies the
 *   English check without a language test.
 * - `behavior.dropOffAt` makes the persona abandon at a step instead of
 *   submitting, so the funnel shows realistic drop-off. One of:
 *   "section1" | "qualifications" | "review" | null (completes).
 *
 * Add personas freely — `PERSONA=<key>` selects one (default: career-changer).
 */
export const personas = {
  "career-changer": {
    label: "Career changer, working full-time, undecided → completes",
    profile: {
      title: null,
      firstName: "Robin",
      lastName: "Carver",
      gender: null,
      dob: "1989-04-12",
      phone: "0400111222",
      citizenship: /Australian Citizen/i,
      residentialAddress: "10 La Trobe Street, Melbourne VIC 3000",
      language: null,
      aboriginalStatus: null,
      schoolLevel: /Year 12/i,
      parents: "2",
    },
    eligibility: { pick: "last" }, // most-qualified answers → likely eligible
    tertiary: {
      institution: "Monash University",
      country: /Australia/i,
      level: /Bachelor/i,
      course: "Bachelor of Commerce",
    },
    documents: {
      // Required to submit; also exercises the transcript parser + AI eligibility.
      transcript: "tests/fixtures/transcript-v3/pdfs/AU-TX-V3-002_monash_university.pdf",
      // Exercises the CV parser + employment auto-fill.
      cv: "tests/fixtures/cv/synthetic_cv_alex_morgan.pdf",
    },
    behavior: { dropOffAt: null },
  },

  "school-leaver": {
    label: "Recent school leaver, hesitant → drops off at qualifications",
    profile: {
      title: null,
      firstName: "Jaylen",
      lastName: "Ng",
      gender: null,
      dob: "2006-09-01",
      phone: "0400222333",
      citizenship: /Australian Citizen/i,
      residentialAddress: "55 George Street, Sydney NSW 2000",
      language: null,
      aboriginalStatus: null,
      schoolLevel: /Year 12/i,
      parents: "2",
    },
    eligibility: { pick: "last" },
    tertiary: null,
    documents: { transcript: null, cv: null },
    behavior: { dropOffAt: "qualifications" },
  },

  "international-applicant": {
    label: "International applicant → completes (exercises citizenship breakdown)",
    profile: {
      title: null,
      firstName: "Mei",
      lastName: "Tan",
      gender: null,
      dob: "1995-02-20",
      phone: "0400333444",
      citizenship: /International/i,
      residentialAddress: "8 Adelaide Terrace, Perth WA 6000",
      language: null,
      aboriginalStatus: null,
      schoolLevel: /Year 12/i,
      parents: "2",
    },
    eligibility: { pick: "last" },
    tertiary: {
      institution: "National University of Singapore",
      country: null,
      level: /Bachelor/i,
      course: "Bachelor of Science",
    },
    documents: {
      // Required to submit; a different fixture than the career-changer for variety.
      transcript: "tests/fixtures/transcript-v3/pdfs/AU-TX-V3-001_the_university_of_melbourne.pdf",
      cv: "tests/fixtures/cv/synthetic_cv_alex_morgan.pdf",
    },
    behavior: { dropOffAt: null },
  },

  "overseas-english": {
    label:
      "Overseas grad, non-English transcript → adds English test → completes",
    profile: {
      title: null,
      firstName: "Diego",
      lastName: "Santos",
      gender: null,
      dob: "1994-07-22",
      phone: "0400555666",
      citizenship: /International/i,
      residentialAddress: "200 Spencer Street, Melbourne VIC 3000",
      language: null,
      aboriginalStatus: null,
      schoolLevel: /Year 12/i,
      parents: "2",
    },
    eligibility: { pick: "last" },
    tertiary: {
      institution: "Universitas Indonesia",
      // Overseas + non-English-medium, so the English proficiency check is mandatory.
      country: /^Indonesia$/i,
      level: /Bachelor/i,
      course: "Bachelor of Engineering",
    },
    documents: {
      // Transcript is taught in Indonesian, so it can't evidence English on its own.
      transcript: "tests/fixtures/transcript-v3/pdfs/SYNTH-INT-universitas_indonesia.pdf",
      cv: "tests/fixtures/cv/synthetic_cv_alex_morgan.pdf",
    },
    // Evidences English proficiency once the transcript can't (uploads IELTS results).
    languageTest: {
      type: "IELTS",
      name: "IELTS Academic",
      year: "2023",
      document: "tests/fixtures/language/synthetic_ielts_results.pdf",
    },
    behavior: { dropOffAt: null },
  },

  "ahpra-nurse": {
    label:
      "Overseas grad, non-English transcript → AHPRA registration evidences English → completes",
    profile: {
      title: null,
      firstName: "Priya",
      lastName: "Sharma",
      gender: null,
      dob: "1992-03-15",
      phone: "0400777888",
      citizenship: /International/i,
      residentialAddress: "120 Collins Street, Melbourne VIC 3000",
      language: null,
      aboriginalStatus: null,
      schoolLevel: /Year 12/i,
      parents: "2",
    },
    eligibility: { pick: "last" },
    tertiary: {
      institution: "Universitas Indonesia",
      // Overseas + non-English-medium, so the English proficiency check is mandatory.
      country: /^Indonesia$/i,
      level: /Bachelor/i,
      course: "Bachelor of Nursing",
    },
    documents: {
      // Transcript is taught in Indonesian, so it can't evidence English on its own.
      transcript: "tests/fixtures/transcript-v3/pdfs/SYNTH-INT-universitas_indonesia.pdf",
      cv: "tests/fixtures/cv/synthetic_cv_alex_morgan.pdf",
    },
    // Evidences English proficiency via an AHPRA registration instead of a language
    // test — the registration name is recognised as proof on its own.
    accreditation: {
      name: "Registered Nurse",
      status: "Active",
    },
    behavior: { dropOffAt: null },
  },
};

export function getPersona(key) {
  return personas[key] ?? personas["career-changer"];
}
