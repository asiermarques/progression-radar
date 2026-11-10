// The `check` command and the validation that `build` runs first: the Configuration is read with the same
// loadConfig() as the app, so the problems and their wording are those of the error screen.
import { ConfigError, loadConfig } from "../src/config.ts";
import { runSnapshotCommand, type Context } from "./snapshot-commands.ts";
import { skillsWarning } from "./skills.ts";

/** Every problem of the Resolved configuration; empty when it is valid. Other errors are not Configuration problems. */
export function configurationProblems(load: typeof loadConfig = loadConfig): string[] {
  try {
    load();
    return [];
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
}

/** The message that lists the problems, for `check` and `build`. */
export const problemsMessage = (problems: string[]) => `The Configuration has problems:\n- ${problems.join("\n- ")}`;

/**
 * Validates the Configuration, warns when the copied skills do not match the installed radar, and then runs the
 * snapshot check against it. Returns the exit code: 1 for any
 * Configuration problem or snapshot error, 0 otherwise (snapshot warnings do not fail it).
 */
export function runCheck(context: Context): number {
  const problems = configurationProblems(context.loadConfig);
  if (problems.length > 0) {
    context.io.err(`${problemsMessage(problems)}\nThe snapshots were not checked against it.`);
    return 1;
  }
  context.io.out("The Configuration is valid.");
  const skills = skillsWarning({ cwd: context.root, packageRoot: context.packageRoot ?? context.root });
  if (skills) context.io.err(`Warning: ${skills}`);
  return runSnapshotCommand(["check"], context);
}
