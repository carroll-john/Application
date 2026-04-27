# Stakeholder Updates

Use this folder for date-stamped business updates that are easy to share over chat and Notion.

## File naming
- `YYYY-MM-DD-eligibility-note.md`

## Repository boundary
- This `application-prototype` repository should only keep lightweight stakeholder update markdown files that describe cross-team status.
- Eligibility backend implementation scripts and Notion automation should live in the dedicated eligibility backend repository to avoid coupling throwaway UI prototype code with production-bound backend tooling.

## Notion publishing
- Publish these notes to Notion from the dedicated eligibility backend repository (or ops-automation repo), not from this application repo.
- Keep the update format consistent:
  1. What shipped
  2. What is next
  3. How to provide feedback
  4. See/play link

## Where to find Notion keys
### `NOTION_TOKEN`
1. In Notion, go to **Settings & members -> Connections -> Develop or manage integrations**.
2. Create a new internal integration (or open an existing one).
3. Copy the **Internal Integration Token**.

### `NOTION_DATABASE_ID` (preferred)
1. Open your target Notion database page in browser.
2. Copy the URL.
3. The database ID is the 32-character segment in the URL (with or without dashes).
4. Share that database with your integration (top-right **... -> Add connections**).

### `NOTION_PARENT_PAGE_ID` (fallback if you don't use a database)
1. Open the parent page where you want the note created.
2. Copy the page URL.
3. Extract the page ID from the URL.
4. Share that page with your integration.

## Shell-specific environment variable setup
### PowerShell (Windows)
Use `$env:` instead of `export`:

```powershell
$env:NOTION_TOKEN = "secret_xxx"
$env:NOTION_DATABASE_ID = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# optional fallback
# $env:NOTION_PARENT_PAGE_ID = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Command Prompt (cmd.exe)
```cmd
set NOTION_TOKEN=secret_xxx
set NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Bash/zsh (macOS/Linux)
```bash
export NOTION_TOKEN=secret_xxx
export NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Quick connectivity checks
### PowerShell
```powershell
Invoke-RestMethod -Method Get -Uri "https://api.notion.com/v1/users/me" -Headers @{ "Authorization" = "Bearer $env:NOTION_TOKEN"; "Notion-Version" = "2022-06-28" }
```

### Bash
```bash
curl -sS https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28"
```

## Troubleshooting
### `object_not_found` for `/v1/databases/{id}`
If you see `Could not find database with ID ... Make sure the relevant pages and databases are shared with your integration`, check:

1. **Database ID is correct**
   - Open the database in full-page mode and copy the database URL.
   - Use the database UUID from that URL (not the integration ID).
2. **Database is shared with integration**
   - In the database page: `...` -> `Add connections` -> choose your integration.
3. **Using the right integration token**
   - `NOTION_TOKEN` must belong to the integration that has access to that database.
4. **Workspace mismatch**
   - Ensure the database and integration are in the same Notion workspace.

PowerShell verification command:

```powershell
Invoke-RestMethod -Method Get -Uri "https://api.notion.com/v1/databases/$env:NOTION_DATABASE_ID" -Headers @{ "Authorization" = "Bearer $env:NOTION_TOKEN"; "Notion-Version" = "2022-06-28" }
```
