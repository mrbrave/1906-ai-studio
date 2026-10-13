/** Display-only user-selected emoji; never included in behavioural prompts. */
export const DEFAULT_AVATAR = "🎯";
export const AVATAR_OPTIONS = [
  "🎯", "👩‍💼", "👨‍💼", "🧑‍💼", "👩‍⚕️", "👨‍⚕️", "🧑‍🏫",
  "🧑‍🔬", "🧑‍💻", "👩‍🎨", "🧑‍🚀", "💡", "📊", "🧠",
  "🚀", "🌱", "🦊", "🐨", "🌏", "⭐", "🤝", "💬",
] as const;
export function avatarEmoji(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 24)
    throw new Error("Choose one emoji for this persona.");
  const text = value.trim();
  const segments = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)];
  if (
    segments.length !== 1 ||
    !(/\p{Extended_Pictographic}/u.test(text) || /^\p{Regional_Indicator}{2}$/u.test(text))
  )
    throw new Error("Persona avatar must be a single emoji.");
  return text;
}
