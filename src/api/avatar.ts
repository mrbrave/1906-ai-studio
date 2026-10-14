/** Display-only user-selected emoji; never included in behavioural prompts. */
export const DEFAULT_AVATAR = "🎯";
export const AVATAR_OPTIONS = [
  "🎯",
  "👩‍💼",
  "👨‍💼",
  "🧑‍💼",
  "👩‍⚕️",
  "👨‍⚕️",
  "🧑‍🏫",
  "🧑‍🔬",
  "🧑‍💻",
  "👩‍🎨",
  "🧑‍🚀",
  "💡",
  "📊",
  "🧠",
  "🚀",
  "🌱",
  "🦊",
  "🐨",
  "🌏",
  "⭐",
  "🤝",
  "💬",
] as const;
export function avatarEmoji(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 64)
    throw new Error("Choose one emoji for this persona.");
  const text = value.trim();
  const segments = [
    ...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text),
  ];
  if (
    segments.length !== 1 ||
    !(
      /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D|[\u{E0020}-\u{E007F}])+$/u.test(
        text,
      ) ||
      /^\p{Regional_Indicator}{2}$/u.test(text) ||
      /^[#*0-9]\uFE0F?\u20E3$/u.test(text)
    ) ||
    /^(?:\p{Emoji_Modifier}|\uFE0F|\u200D)+$/u.test(text)
  )
    throw new Error("Persona avatar must be a single emoji.");
  return text;
}
