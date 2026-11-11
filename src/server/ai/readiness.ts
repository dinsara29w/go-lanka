import "server-only";

export type BuilderSetupIssue = "no_destinations" | "no_ai_key" | "no_spam_check";

/**
 * What the AI tour builder still needs before a visitor can use it. Shown to the site owner
 * while developing, so a disabled button never has to be guessed at.
 */
export function getBuilderSetupIssues(input: {
  destinationCount: number;
  hasSiteKey: boolean;
}): BuilderSetupIssue[] {
  const issues: BuilderSetupIssue[] = [];
  if (input.destinationCount === 0) issues.push("no_destinations");
  if (!process.env.DEEPSEEK_API_KEY?.trim()) issues.push("no_ai_key");
  if (!input.hasSiteKey || !process.env.TURNSTILE_SECRET_KEY?.trim()) issues.push("no_spam_check");
  return issues;
}
