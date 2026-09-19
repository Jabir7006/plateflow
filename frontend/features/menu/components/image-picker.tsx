"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ImagePlus, Trash2, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Mirrors the backend upload guard so a bad file is rejected before it is sent.
const MAX_IMAGE_MB = 5
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif"
const ACCEPTED_TYPES = new Set(ACCEPT.split(","))

interface ImagePickerProps {
  // The image already on the item, shown until the user picks or removes one.
  existingUrl: string | null
  // A freshly chosen file, null to remove the existing image, undefined for
  // "leave as-is". The parent owns this so it can send the right request.
  value: File | null | undefined
  onChange: (value: File | null | undefined) => void
  disabled?: boolean
}

export function ImagePicker({
  existingUrl,
  value,
  onChange,
  disabled,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  // A picked File previews through an object URL, derived from the file rather
  // than stored in state so there is no setState-in-effect cascade.
  const previewUrl = useMemo(
    () => (value instanceof File ? URL.createObjectURL(value) : null),
    [value]
  )

  // Revoke the URL when the file changes or the component unmounts, so the blob
  // is not leaked.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  // What to show: the new file's preview, then (unless removal was chosen) the
  // existing image, then a placeholder.
  const shownUrl = previewUrl ?? (value === null ? null : existingUrl)
  const hasImage = shownUrl !== null

  function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, WebP or AVIF image")
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_IMAGE_MB}MB`)
      return
    }

    onChange(file)
  }

  function handleRemove() {
    setError(null)
    // Removing a not-yet-saved pick returns to "leave as-is"; removing an
    // existing image records the removal so the parent sends the delete.
    onChange(existingUrl ? null : undefined)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="size-5 text-muted-foreground/40" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus />
            {hasImage ? "Change" : "Add photo"}
          </Button>
          {hasImage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="text-muted-foreground"
              onClick={handleRemove}
            >
              <Trash2 />
              Remove
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ?? `JPEG, PNG, WebP or AVIF, up to ${MAX_IMAGE_MB}MB.`}
      </p>
    </div>
  )
}
