import type { CvParserErrorCode } from "./errors.js";
import { isUcPreApplicationParseRequest } from "../../src/lib/ucPreApplicationParseContract.js";

type ParserAuthKind = "authenticated" | "open" | "unauthenticated";

export function getCvParserAccessError(
  authKind: ParserAuthKind,
  request: Request,
  isDeployed: boolean,
): CvParserErrorCode | null {
  const isAnonymousUcPreApplication = isUcPreApplicationParseRequest(request);

  if (authKind === "open" && isDeployed && !isAnonymousUcPreApplication) {
    return "CV_PARSER_NOT_CONFIGURED";
  }

  if (authKind === "unauthenticated" && !isAnonymousUcPreApplication) {
    return "CV_PARSER_UNAUTHORIZED";
  }

  return null;
}
