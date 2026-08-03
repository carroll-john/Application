import {
  handleApiRequest,
  type NodeRequestLike,
  type NodeResponseLike,
} from "../_shared/nodeWebHandler.js";
import { assessmentError } from "./server.js";

export function assessmentHandler(
  defaultPath: string,
  handleWebRequest: (request: Request) => Promise<Response>,
) {
  return async (request: Request | NodeRequestLike, response?: NodeResponseLike) =>
    handleApiRequest(request, response, {
      defaultPath,
      endHeadWithoutBody: true,
      handleWebRequest: async (webRequest) => {
        try {
          return await handleWebRequest(webRequest);
        } catch (error) {
          return assessmentError(error);
        }
      },
      unsupportedResponse: () => assessmentError(new Error("Unsupported request")),
    });
}
