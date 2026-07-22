import { Type } from "@sinclair/typebox";
import { jsonResult } from "../tool-runtime.js";
import { buildTool } from "./shared.js";

function notifyGuestAccess(ctx, payload) {
  if (payload?.access?.mode !== "guest") {
    return;
  }

  ctx?.ui?.notify?.(
    "LINKEDIN GUEST MODE: This job view may be missing fields. Update ~/.config/pi-linkedin/.env with LINKEDIN_LI_AT or LINKEDIN_COOKIE, then rerun /linkedin_auth.",
    "warning",
  );
}

export function getJobDetailsTool(client) {
  return buildTool({
    name: "linkedin_get_job_details",
    label: "Get LinkedIn Job Details",
    description: "Fetch a public LinkedIn job page and return structured details, with optional fit scoring against a candidate resume.",
    parameters: Type.Object({
      url: Type.Optional(Type.String({ description: "Public LinkedIn job URL." })),
      job_id: Type.Optional(Type.String({ description: "Numeric LinkedIn job identifier, used when url is not provided." })),
      resume_text: Type.Optional(Type.String({ description: "Optional candidate resume text used to score this single job." })),
    }),
    run: async ({ params, signal, onUpdate, ctx }) => {
      const payload = await client.getJobDetails({
        url: params.url,
        jobId: params.job_id,
        resumeText: params.resume_text,
      }, signal, onUpdate);
      notifyGuestAccess(ctx, payload);
      return jsonResult(payload);
    },
  });
}
