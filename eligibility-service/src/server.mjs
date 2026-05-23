import express from "express";
import multer from "multer";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const REQUIRED_RESPONSE_FIELDS = [
  "confidence",
  "manualReviewRequired",
  "missingInformation",
  "outcome",
  "recommendedNextStep",
  "requirementsChecked",
];

const app = express();
const upload = multer({
  limits: { fileSize: MAX_FILE_BYTES },
  storage: multer.memoryStorage(),
});

function parseJsonSafely(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

function parseContext(rawContext) {
  if (!rawContext || typeof rawContext !== "string") {
    return {};
  }
  const parsed = parseJsonSafely(rawContext, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function extractStructuredOutput(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.output_parsed && typeof payload.output_parsed === "object") {
    return payload.output_parsed;
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    const parsed = parseJsonSafely(payload.output_text.trim(), null);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (!item || typeof item !== "object" || item.type !== "message") {
        continue;
      }

      if (!Array.isArray(item.content)) {
        continue;
      }

      for (const contentItem of item.content) {
        if (!contentItem || typeof contentItem !== "object") {
          continue;
        }

        if (contentItem.parsed && typeof contentItem.parsed === "object") {
          return contentItem.parsed;
        }

        if (typeof contentItem.text === "string" && contentItem.text.trim()) {
          const parsed = parseJsonSafely(contentItem.text.trim(), null);
          if (parsed && typeof parsed === "object") {
            return parsed;
          }
        }
      }
    }
  }

  return null;
}

function ensureRequiredFields(result) {
  if (!result || typeof result !== "object") {
    return false;
  }
  return REQUIRED_RESPONSE_FIELDS.every((field) => field in result);
}

function applyAssessmentDefaults(assessment, context) {
  return {
    checkedAt:
      typeof assessment.checkedAt === "string" && assessment.checkedAt.trim()
        ? assessment.checkedAt
        : new Date().toISOString(),
    confidence:
      typeof assessment.confidence === "number" ? assessment.confidence : 0.5,
    manualReviewRequired:
      typeof assessment.manualReviewRequired === "boolean"
        ? assessment.manualReviewRequired
        : true,
    missingInformation: Array.isArray(assessment.missingInformation)
      ? assessment.missingInformation
      : [],
    outcome:
      assessment.outcome === "eligible" ||
      assessment.outcome === "conditionally_eligible" ||
      assessment.outcome === "ineligible" ||
      assessment.outcome === "insufficient_data"
        ? assessment.outcome
        : "insufficient_data",
    programCode:
      typeof assessment.programCode === "string" && assessment.programCode.trim()
        ? assessment.programCode.trim()
        : typeof context.courseCode === "string"
          ? context.courseCode
          : undefined,
    programTitle:
      typeof assessment.programTitle === "string" && assessment.programTitle.trim()
        ? assessment.programTitle.trim()
        : typeof context.courseTitle === "string"
          ? context.courseTitle
          : undefined,
    recommendedNextStep:
      typeof assessment.recommendedNextStep === "string" &&
      assessment.recommendedNextStep.trim()
        ? assessment.recommendedNextStep.trim()
        : "Provide additional evidence and route to manual admissions review.",
    requirementsChecked: Array.isArray(assessment.requirementsChecked)
      ? assessment.requirementsChecked
      : [],
    rulesVersion:
      typeof assessment.rulesVersion === "string" && assessment.rulesVersion.trim()
        ? assessment.rulesVersion.trim()
        : "v1",
    serviceVersion: process.env.SERVICE_VERSION?.trim() || "v1",
    applicantDetails: assessment.applicantDetails,
    academicPerformance: assessment.academicPerformance,
    englishLanguageEvidence: assessment.englishLanguageEvidence,
    studyDetails: assessment.studyDetails,
  };
}

function requireServiceToken(req, res, next) {
  const expectedToken = process.env.SERVICE_API_TOKEN?.trim();
  if (!expectedToken) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({
      code: "ELIGIBILITY_SERVICE_UNAUTHORIZED",
      error: "Missing bearer token.",
    });
  }

  const provided = auth.slice("Bearer ".length).trim();
  if (provided !== expectedToken) {
    return res.status(403).json({
      code: "ELIGIBILITY_SERVICE_FORBIDDEN",
      error: "Invalid bearer token.",
    });
  }

  return next();
}

async function evaluateTranscript({
  fileBuffer,
  filename,
  mimeType,
  context,
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const contextText = JSON.stringify(context ?? {});
  const isText = mimeType === "text/plain";

  const content = [
    {
      type: "input_text",
      text: `Program context:\n${contextText}`,
    },
    {
      type: "input_text",
      text: "Assess transcript evidence conservatively and never guess missing values.",
    },
  ];

  if (isText) {
    content.push({
      type: "input_text",
      text: `Transcript content:\n${fileBuffer.toString("utf8").trim()}`,
    });
  } else {
    content.push({
      type: "input_file",
      filename,
      file_data: `data:${mimeType};base64,${arrayBufferToBase64(fileBuffer)}`,
    });
  }

  const body = {
    model,
    max_output_tokens: 2500,
    instructions:
      "You are an admissions eligibility evaluator. Use only evidence present in the transcript. If data is missing or uncertain, return insufficient_data and unknown requirement statuses.",
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "transcript_eligibility_assessment",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: REQUIRED_RESPONSE_FIELDS,
          properties: {
            checkedAt: { type: "string" },
            confidence: { type: "number" },
            manualReviewRequired: { type: "boolean" },
            missingInformation: { type: "array", items: { type: "string" } },
            outcome: {
              type: "string",
              enum: [
                "eligible",
                "conditionally_eligible",
                "ineligible",
                "insufficient_data",
              ],
            },
            programCode: { type: "string" },
            programTitle: { type: "string" },
            recommendedNextStep: { type: "string" },
            rulesVersion: { type: "string" },
            requirementsChecked: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "requirement", "status", "explanation"],
                properties: {
                  id: { type: "string" },
                  requirement: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["pass", "fail", "unknown"],
                  },
                  explanation: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    tools: isText ? [] : [{ type: "code_interpreter", container: { type: "auto" } }],
    tool_choice: isText ? undefined : "auto",
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const upstreamError =
      payload &&
      typeof payload === "object" &&
      payload.error &&
      typeof payload.error === "object" &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "OpenAI request failed.";
    throw new Error(upstreamError);
  }

  const parsed = extractStructuredOutput(payload);
  if (!parsed || !ensureRequiredFields(parsed)) {
    throw new Error("Eligibility model response was incomplete or invalid.");
  }

  return applyAssessmentDefaults(parsed, context);
}

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    tokenProtected: Boolean(process.env.SERVICE_API_TOKEN?.trim()),
  });
});

app.post(
  "/api/evaluate",
  requireServiceToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          code: "ELIGIBILITY_FILE_REQUIRED",
          error: "Transcript file is required.",
        });
      }

      const context = parseContext(req.body?.context);
      const result = await evaluateTranscript({
        fileBuffer: file.buffer,
        filename: file.originalname || "transcript",
        mimeType: file.mimetype || "application/octet-stream",
        context,
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(502).json({
        code: "ELIGIBILITY_SERVICE_EVALUATION_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Eligibility evaluation failed unexpectedly.",
      });
    }
  },
);

const port = Number.parseInt(process.env.PORT || "8080", 10);
app.listen(port, () => {
  console.log(`eligibility-service listening on port ${port}`);
});

