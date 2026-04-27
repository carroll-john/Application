# Stakeholder Updates

Use this folder for date-stamped business updates that are easy to share over chat and Notion.

## File naming
- `YYYY-MM-DD-eligibility-note.md`

## Publishing directly to Notion
You can publish a note directly (no copy/paste) with:

```bash
NOTION_TOKEN=your_integration_token \
NOTION_DATABASE_ID=your_database_id \
npm run notion:publish-note -- --file docs/stakeholder-updates/2026-04-27-eligibility-note.md
```

Optional title override:

```bash
NOTION_TOKEN=your_integration_token \
NOTION_DATABASE_ID=your_database_id \
npm run notion:publish-note -- \
  --file docs/stakeholder-updates/2026-04-27-eligibility-note.md \
  --title "Eligibility Check Project Update"
```

The script creates a new page in the target database and prints the new Notion URL.
