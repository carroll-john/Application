# Australian university transcript parser fixtures - v3 document-like

This pack contains 14 synthetic PDF transcript fixtures using real Australian university names as parser targets.

The v3 rebuild removes body-level meta placeholders such as explanatory WAM/GPA display text. Where a real transcript style would omit a value, the synthetic document now omits the field or leaves the document cell blank. The body of each PDF uses normal transcript structures: student details, program or award summary, academic record rows, metrics where present, credit sections where relevant, and end-of-record markers.

Safeguards remain in place:

- visible SAMPLE watermark on every page
- small footer stating synthetic parser fixture and no official standing
- fictional students, document references, marks and award outcomes
- no university logos, seals, signatures, QR codes, barcodes, verification URLs, digital signature language or official secure-document claims
- no exact replication of an institutional branded template

Files:

- `pdfs/` contains the individual fixture PDFs
- `au_transcript_fixtures_v3_document_like_combined.pdf` combines all fixtures
- `manifest_expected_fields.json` contains expected parser fields
- `manifest_expected_fields.csv` is a flat index of fixture-level expected fields

## Turning real-world feedback into fixtures

Every "Doesn't match your transcript?" submission lands in PostHog as an
`eligibility_check_override` event carrying the disputed requirement's `requirement_id`,
`reason_code`, the applicant's suggested status, and the exact
(model / prompt / schema / rules) version tuple that produced the automated result. These are
labelled datapoints — each one is a candidate regression fixture:

1. In PostHog, filter `eligibility_check_override` events and pick a disagreement worth
   preserving (e.g. a `GPA_MET` check the applicant says should be `fail`, or a
   `QUALIFICATION_LEVEL_UNKNOWN` on a transcript that clearly states the level).
2. Recreate the document shape synthetically (never copy a real transcript): a new PDF in
   `pdfs/` following the safeguards above, reproducing the layout/wording feature that confused
   extraction (e.g. the grading-key placement, the completion-status phrasing).
3. Add a manifest entry with the ground-truth labels (`qualification_achieved`, program status,
   `metrics` WAM/GPA rows) so the regression scorecard scores extraction against it.
4. Run `npm run test:eligibility-transcripts` (dev server via
   `npm run dev:transcript-eligibility-api`, needs `OPENAI_API_KEY`). The run writes
   `results.json` + `scorecard.json`; the scorecard is stamped with the version tuple, and
   `--compare <runA> <runB>` diffs two runs when trialling a prompt or model change.

This closes the loop: production misses become permanent, scored regression coverage.
