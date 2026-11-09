// Shared helpers for the database scripts. Keeping URL parsing and the
// pooled/direct guard in one place means backup, restore, and verification all
// fail the same way when handed a connection string they cannot safely use.

export interface DatabaseTarget {
  host: string;
  database: string;
  pooled: boolean;
}

export function parseDatabaseTarget(connectionString: string): DatabaseTarget {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Connection string is not a valid URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(
      `Expected a postgres connection string, got ${url.protocol}`
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database) {
    throw new Error("Connection string must include a host and database name");
  }

  return {
    host: url.hostname,
    database,
    // Neon's pooled endpoint includes "-pooler" in the hostname. pg_dump and
    // pg_restore must use the direct endpoint; pgBouncer can break their
    // session-level operations.
    pooled: url.hostname.includes("-pooler"),
  };
}

// Safe to log: never includes the username, password, or query parameters.
export function describeTarget(connectionString: string): string {
  const target = parseDatabaseTarget(connectionString);
  return `${target.host}/${target.database}${target.pooled ? " (pooled)" : ""}`;
}

export function requireDirectTarget(
  connectionString: string,
  variableName: string
): DatabaseTarget {
  const target = parseDatabaseTarget(connectionString);

  if (target.pooled) {
    throw new Error(
      `${variableName} is a pooled connection. Use the direct (unpooled) ` +
        "connection string for pg_dump/pg_restore."
    );
  }

  return target;
}
