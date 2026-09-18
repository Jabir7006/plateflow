// First letter of the first two words, uppercased: "Jabir Ahmad" -> "JA".
// Falls back to "?" when the name has no usable letters, so an avatar never
// renders an empty circle.
export function getInitials(fullName: string): string {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return initials || "?"
}
