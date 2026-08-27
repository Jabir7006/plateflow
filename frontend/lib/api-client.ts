export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1"

interface ErrorEnvelope {
  success: false
  statusCode: number
  message: string
  errors?: Array<{ field: string; message: string }>
}

export class ApiError extends Error {
  statusCode: number
  errors?: ErrorEnvelope["errors"]

  constructor(
    message: string,
    statusCode: number,
    errors?: ErrorEnvelope["errors"]
  ) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.errors = errors
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers, credentials, ...rest } = options

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: credentials ?? "same-origin",
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Handle 204 No Content or empty successful responses
  if (response.status === 204) {
    return undefined as unknown as T
  }

  const json = (await response.json().catch(() => null)) as
    ApiEnvelope<T> | ErrorEnvelope | null

  if (!response.ok) {
    const err = json as ErrorEnvelope | null
    throw new ApiError(
      err?.message || `Request failed with status ${response.status}`,
      err?.statusCode ?? response.status,
      err?.errors
    )
  }

  // If response is 2xx and adheres to the ApiEnvelope format
  if (json && typeof json === "object" && "success" in json) {
    if (json.success === false) {
      const err = json as ErrorEnvelope
      throw new ApiError(
        err.message || `Request failed with status ${response.status}`,
        err.statusCode ?? response.status,
        err.errors
      )
    }
    return (json as ApiEnvelope<T>).data
  }

  return json as unknown as T
}

type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
}
