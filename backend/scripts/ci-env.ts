import { randomBytes } from "node:crypto";
import { appendFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// CI creates its own settings rather than inheriting a developer's .env or any
// deployment credentials. The database host/name are fixed to the job service.
export function createCIEnvironment(
  input: NodeJS.ProcessEnv
): Record<string, string> {
  if (input.GITHUB_ACTIONS !== "true") {
    throw new Error("CI environment setup requires GitHub Actions");
  }

  const password = input.CI_POSTGRES_PASSWORD;
  if (!password || /[\r\n]/.test(password)) {
    throw new Error(
      "CI_POSTGRES_PASSWORD must be a nonempty, single-line value"
    );
  }

  const port = input.CI_DATABASE_PORT ?? "5432";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("CI_DATABASE_PORT must be a valid TCP port");
  }

  const databaseURL =
    `postgresql://plateflow_ci:${encodeURIComponent(password)}` +
    `@127.0.0.1:${Number(port)}/plateflow_ci`;
  const token = () => randomBytes(32).toString("hex");

  return {
    DATABASE_URL: databaseURL,
    DIRECT_URL: databaseURL,
    TEST_DATABASE_URL: databaseURL,
    APP_URL: "http://127.0.0.1:3000",
    BACKEND_URL: "http://127.0.0.1:4000",
    NEXT_PUBLIC_API_URL: "/api/v1",
    NEXT_PUBLIC_WS_URL: "http://127.0.0.1:4000",
    CLOUDINARY_CLOUD_NAME: "plateflow-ci",
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "plateflow-ci",
    CLOUDINARY_API_KEY: token(),
    CLOUDINARY_API_SECRET: token(),
    RESEND_API_KEY: `re_ci_${token()}`,
    MAIL_FROM: "PlateFlow CI <ci@example.invalid>",
    SEED_MANAGER_EMAIL: "ci@example.invalid",
    SEED_MANAGER_PASSWORD: token(),
    ACCESS_TOKEN_SECRET: token(),
    REFRESH_TOKEN_SECRET: token(),
  };
}

export function exportCIEnvironment(input: NodeJS.ProcessEnv): void {
  const settings = createCIEnvironment(input);
  const destination = input.GITHUB_ENV;
  if (
    !destination ||
    !isAbsolute(destination) ||
    !statSync(destination, { throwIfNoEntry: false })?.isFile()
  ) {
    throw new Error(
      "GITHUB_ENV must name an existing GitHub Actions environment file"
    );
  }

  // Workflow commands are consumed by the runner before subsequent log lines.
  // Mask the password and all generated credentials/DSNs before exporting them.
  const privateValues = [
    input.CI_POSTGRES_PASSWORD!,
    ...Object.entries(settings)
      .filter(([key]) =>
        /SECRET|PASSWORD|API_KEY|DATABASE_URL|DIRECT_URL/.test(key)
      )
      .map(([, value]) => value),
  ];
  for (const value of new Set(privateValues)) {
    const escaped = value
      .replace(/%/g, "%25")
      .replace(/\r/g, "%0D")
      .replace(/\n/g, "%0A");
    console.log(`::add-mask::${escaped}`);
  }

  appendFileSync(
    destination,
    Object.entries(settings)
      .map(([key, value]) => `${key}=${value}\n`)
      .join("")
  );
  console.log(
    "Disposable CI configuration exported; no deployment credentials needed."
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    exportCIEnvironment(process.env);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
