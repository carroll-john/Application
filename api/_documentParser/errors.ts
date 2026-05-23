export type CvParserErrorCode =
  | "CV_PARSER_METHOD_NOT_ALLOWED"
  | "CV_PARSER_NOT_CONFIGURED"
  | "CV_PARSER_UNAUTHORIZED"
  | "CV_PARSER_RATE_LIMITED"
  | "CV_PARSER_FILE_REQUIRED"
  | "CV_PARSER_FILE_UNSUPPORTED"
  | "CV_PARSER_FILE_TOO_LARGE"
  | "CV_PARSER_TEXT_FILE_EMPTY"
  | "CV_PARSER_UPSTREAM_FAILED"
  | "CV_PARSER_UPSTREAM_RATE_LIMITED"
  | "CV_PARSER_UPSTREAM_TIMEOUT"
  | "CV_PARSER_UPSTREAM_UNAVAILABLE"
  | "CV_PARSER_RESPONSE_TRUNCATED"
  | "CV_PARSER_RESPONSE_INVALID"
  | "CV_PARSER_RESPONSE_UNREADABLE"
  | "CV_PARSER_UNEXPECTED_FAILURE"
  | "CV_PARSER_UNSUPPORTED_REQUEST_SHAPE";

const CV_PARSER_ERROR_DEFINITIONS: Record<
  CvParserErrorCode,
  { message: string; status: number }
> = {
  CV_PARSER_METHOD_NOT_ALLOWED: {
    message: "Method not allowed.",
    status: 405,
  },
  CV_PARSER_NOT_CONFIGURED: {
    message: "AI CV parsing is not configured on this deployment.",
    status: 503,
  },
  CV_PARSER_UNAUTHORIZED: {
    message: "Sign in before parsing a CV.",
    status: 401,
  },
  CV_PARSER_RATE_LIMITED: {
    message: "You've parsed too many CVs in a short window. Please wait a moment.",
    status: 429,
  },
  CV_PARSER_FILE_REQUIRED: {
    message: "Attach a CV file before parsing.",
    status: 400,
  },
  CV_PARSER_FILE_UNSUPPORTED: {
    message: "Use a PDF, DOC, DOCX, or TXT file for CV parsing.",
    status: 400,
  },
  CV_PARSER_FILE_TOO_LARGE: {
    message: "Choose a file smaller than 5 MB.",
    status: 400,
  },
  CV_PARSER_TEXT_FILE_EMPTY: {
    message: "This text file appears to be empty. Upload a CV with content.",
    status: 400,
  },
  CV_PARSER_UPSTREAM_FAILED: {
    message: "We couldn't parse this CV right now. Please try again.",
    status: 502,
  },
  CV_PARSER_UPSTREAM_RATE_LIMITED: {
    message: "The parser is busy right now. Please try again shortly.",
    status: 502,
  },
  CV_PARSER_UPSTREAM_TIMEOUT: {
    message: "The parser took too long to respond. Please try again.",
    status: 502,
  },
  CV_PARSER_UPSTREAM_UNAVAILABLE: {
    message: "The parser is temporarily unavailable. Please try again shortly.",
    status: 502,
  },
  CV_PARSER_RESPONSE_TRUNCATED: {
    message:
      "The parser response was cut off for this CV. Please try again or upload a shorter file.",
    status: 502,
  },
  CV_PARSER_RESPONSE_INVALID: {
    message: "The parser did not return employment data in the expected format.",
    status: 502,
  },
  CV_PARSER_RESPONSE_UNREADABLE: {
    message: "The parser returned an unreadable response.",
    status: 502,
  },
  CV_PARSER_UNEXPECTED_FAILURE: {
    message: "Unexpected parser failure.",
    status: 500,
  },
  CV_PARSER_UNSUPPORTED_REQUEST_SHAPE: {
    message: "Unsupported request shape.",
    status: 500,
  },
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

export function errorResponse(code: CvParserErrorCode) {
  const definition = CV_PARSER_ERROR_DEFINITIONS[code];

  return jsonResponse(
    {
      code,
      error: definition.message,
    },
    definition.status,
  );
}
