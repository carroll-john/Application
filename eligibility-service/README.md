# Eligibility Service

Standalone transcript eligibility service that the app proxy (`/api/evaluate-transcript-eligibility`) can call.

## What it provides

- `POST /api/evaluate` multipart endpoint (`file` + `context`)
- Optional bearer-token protection via `SERVICE_API_TOKEN`
- OpenAI-backed transcript extraction + eligibility evaluation
- Four-status outcomes:
  - `eligible`
  - `conditionally_eligible`
  - `ineligible`
  - `insufficient_data`

## Local setup

1. Install dependencies

```bash
cd eligibility-service
npm install
```

2. Configure env

```bash
cp .env.example .env
```

Set at least:

- `OPENAI_API_KEY`
- `SERVICE_API_TOKEN` (recommended)

3. Run

```bash
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:8080/healthz
```

## Connect the app to this service

In the app environment:

- `ELIGIBILITY_SERVICE_URL=http://127.0.0.1:8080/api/evaluate`
- `ELIGIBILITY_SERVICE_TOKEN=<same value as SERVICE_API_TOKEN>`

Restart the app after env changes.

## Smoke test service directly

```bash
curl -X POST "http://127.0.0.1:8080/api/evaluate" \
  -H "Authorization: Bearer YOUR_SERVICE_API_TOKEN" \
  -F "file=@/Users/jc/Downloads/synthetic_australian_university_transcripts_real_universities_combined.pdf" \
  -F 'context={"courseCode":"MDA900","courseTitle":"Master of Data Analytics","completed":true}'
```

## Deploy

- Render blueprint: `render.yaml`
- Docker image: `Dockerfile`

