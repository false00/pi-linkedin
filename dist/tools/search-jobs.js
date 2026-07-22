import { Type } from "@sinclair/typebox";
import { jsonResult } from "../tool-runtime.js";
import { buildTool } from "./shared.js";

function notifyGuestAccess(ctx, payload) {
  if (payload?.access?.mode !== "guest") {
    return;
  }

  ctx?.ui?.notify?.(
    "LINKEDIN GUEST MODE: Results may be incomplete. Update ~/.config/pi-linkedin/.env with LINKEDIN_LI_AT or LINKEDIN_COOKIE, then rerun /linkedin_auth.",
    "warning",
  );
}

export function searchJobsTool(client) {
  return buildTool({
    name: "linkedin_search_jobs",
    label: "Search LinkedIn Jobs",
    description: "Search LinkedIn's public jobs pages using a resume or explicit query, rank matches, and optionally enrich the top results with public detail-page data.",
    parameters: Type.Object({
      resume_text: Type.Optional(Type.String({ description: "Candidate resume text or career summary used to derive search terms and fit scoring." })),
      query: Type.Optional(Type.String({ description: "Explicit search keywords or title. Overrides the derived resume query when provided." })),
      location: Type.Optional(Type.String({ description: "Optional location such as 'United States' or 'Austin, TX'." })),
      posted_within_days: Type.Optional(Type.Integer({ description: "Optional recency filter in days, for example 7 or 30." })),
      limit: Type.Optional(Type.Integer({ description: "Maximum number of jobs to return, from 1 to 25." })),
      start: Type.Optional(Type.Integer({ description: "Optional LinkedIn result offset for pagination." })),
      include_details: Type.Optional(Type.Boolean({ description: "Whether to fetch public detail pages for the top-ranked results." })),
    }),
    run: async ({ params, signal, onUpdate, ctx }) => {
      const payload = await client.searchJobs({
        resumeText: params.resume_text,
        query: params.query,
        location: params.location,
        postedWithinDays: params.posted_within_days,
        limit: params.limit,
        start: params.start,
        includeDetails: params.include_details,
      }, signal, onUpdate);
      notifyGuestAccess(ctx, payload);
      return jsonResult(payload);
    },
  });
}
