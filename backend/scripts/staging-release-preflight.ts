import {
  FULL_COMMIT_SHA,
  StagingPreflightError,
  verifyStagingRelease,
} from "./lib/staging-release-preflight.js";

function requireToken(
  name: "PLATEFLOW_RENDER_API_KEY" | "PLATEFLOW_NEON_API_KEY"
) {
  const token = process.env[name]?.trim();
  if (!token) {
    throw new StagingPreflightError(
      `Set ${name} through your private credential store`
    );
  }
  return token;
}

async function main() {
  const [flag, value, ...extra] = process.argv.slice(2);
  if (
    flag !== "--sha" ||
    !value ||
    !FULL_COMMIT_SHA.test(value) ||
    extra.length
  ) {
    throw new StagingPreflightError(
      "Usage: pnpm --filter backend release:preflight:staging --sha <40-character master SHA>"
    );
  }

  const { sha, ciRunUrl } = await verifyStagingRelease({
    sha: value.toLowerCase(),
    renderApiKey: requireToken("PLATEFLOW_RENDER_API_KEY"),
    neonApiKey: requireToken("PLATEFLOW_NEON_API_KEY"),
    fetch: globalThis.fetch,
  });
  console.log(`Staging release preflight passed for ${sha}\n${ciRunUrl}`);
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof StagingPreflightError
      ? error.message
      : "Staging release preflight failed unexpectedly"
  );
  process.exitCode = 1;
}
