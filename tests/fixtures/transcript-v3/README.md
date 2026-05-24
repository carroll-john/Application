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
