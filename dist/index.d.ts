export default function linkedInExtension(pi: {
  registerTool(tool: unknown): void;
  registerCommand?(name: string, options: { description: string; handler: (...args: unknown[]) => unknown }): void;
}): void;
