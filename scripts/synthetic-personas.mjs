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
      cv: null,
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
      cv: null,
    },
    behavior: { dropOffAt: null },
  },
};

export function getPersona(key) {
  return personas[key] ?? personas["career-changer"];
}
