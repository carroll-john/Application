export const UC_PRE_APPLICATION_PARSE_FLOW = "uc-pre-application";

export function addUcPreApplicationParseFlow(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}flow=${UC_PRE_APPLICATION_PARSE_FLOW}`;
}

export function isUcPreApplicationParseRequest(request: Request) {
  return (
    new URL(request.url).searchParams.get("flow") ===
    UC_PRE_APPLICATION_PARSE_FLOW
  );
}
