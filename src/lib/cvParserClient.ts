import type { CvParserDraft } from "./documentParserRegistry";
import {
  CvParserRequestError,
  DocumentParserRequestError,
  requestParseDocument,
} from "./documentParserClient";

export {
  CvParserRequestError,
  DocumentParserRequestError,
} from "./documentParserClient";

export async function parseEmploymentExperiencesFromCv(file: File) {
  try {
    return await requestParseDocument<CvParserDraft>(file, "cv");
  } catch (error) {
    if (error instanceof DocumentParserRequestError) {
      throw new CvParserRequestError(error.message, error.status, error.code);
    }

    throw error;
  }
}

export async function parseCvForRecognition(
  file: File,
  options: { pilotInvitationToken: string },
) {
  try {
    return await requestParseDocument<CvParserDraft>(file, "cv", {
      allowAnonymousUcPreApplication: true,
      pilotInvitationToken: options.pilotInvitationToken,
    });
  } catch (error) {
    if (error instanceof DocumentParserRequestError) {
      throw new CvParserRequestError(error.message, error.status, error.code);
    }

    throw error;
  }
}

export function getCvParserErrorMessage(error: unknown) {
  if (error instanceof CvParserRequestError) {
    if (error.status === 404) {
      return "AI CV parsing isn't available on this local server. Start the local parser API (`npm run dev:cv-parser-api`) and try again.";
    }

    return error.message;
  }

  return "We saved your CV, but couldn't auto-fill employment history right now.";
}
