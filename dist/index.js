import { ensureConfigTemplate } from "./config.js";
import { getLinkedInAuthCommand, LinkedInClient } from "./linkedin-client.js";
import { getJobDetailsTool } from "./tools/job-details.js";
import { searchJobsTool } from "./tools/search-jobs.js";

export default function linkedInExtension(pi) {
  ensureConfigTemplate();
  const client = new LinkedInClient();
  const tools = [
    searchJobsTool(client),
    getJobDetailsTool(client),
  ];

  for (const tool of tools) {
    pi.registerTool(tool);
  }

  const authCommand = getLinkedInAuthCommand(client);
  pi.registerCommand(authCommand.name, {
    description: authCommand.description,
    handler: authCommand.handler,
  });
}
