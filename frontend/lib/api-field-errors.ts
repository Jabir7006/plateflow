import { ApiError } from "@/lib/api-client"

// Server-side validation failures arrive as a generic envelope plus per-field
// errors whose paths are prefixed with the request segment they came from
// ("body.fullName"). Strips the prefix and keeps only the entries that map
// onto one of the given form fields, so callers can feed them straight into
// react-hook-form setError.
export function extractFieldErrors(
  error: unknown,
  fieldNames: readonly string[]
): Array<{ field: string; message: string }> {
  if (!(error instanceof ApiError) || !error.errors?.length) {
    return []
  }

  const names = new Set(fieldNames)

  return error.errors.flatMap(({ field, message }) => {
    const name = field.replace(/^body\./, "")
    return names.has(name) ? [{ field: name, message }] : []
  })
}
