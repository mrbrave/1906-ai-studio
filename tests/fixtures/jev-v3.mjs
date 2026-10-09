import { randomUUID } from "node:crypto";
/** Deterministic response construction; never presented as live semantic classification. */
export function evaluated(body, values = {}) {
  const answers = {};
  for (const [key, q] of Object.entries(body.questions)) {
    if (q.type === "noul") {
      answers[key] = {
        type: "noul",
        noul: values[key] ?? (key === "assessment_grounding" ? 0.95 : 0),
      };
    } else if (q.type === "choice") {
      const choice =
        values[key] ??
        (Object.hasOwn(q.criteria, "unknown") ? "unknown" : "none");
      answers[key] = {
        type: "choice",
        choice,
        confidence: 1,
        probabilities: Object.fromEntries(
          Object.keys(q.criteria).map((k) => [k, k === choice ? 1 : 0]),
        ),
      };
    } else {
      const score = values[key] ?? 2,
        floor = Math.floor(score),
        fraction = score - floor;
      answers[key] = {
        type: "score",
        score,
        confidence: 0.9,
        legend: Object.fromEntries(q.criteria.map((v, i) => [i, v])),
        probabilities: Object.fromEntries(
          q.criteria.map((_, i) => [
            i,
            i === floor ? 1 - fraction : i === floor + 1 ? fraction : 0,
          ]),
        ),
      };
    }
  }
  return {
    model: "jev-1.13.0",
    answers,
    usage: { input_tokens: 3000, output_tokens: 120 },
  };
}
export function message(content, role = "assistant", id = randomUUID()) {
  return {
    id,
    role,
    content,
    conversation_id: "test",
    status: "complete",
    created_at: "2026-10-09T00:00:00.000Z",
    provider: "gemini",
    telemetry: null,
    telemetry_status: "none",
    error: null,
  };
}
/** Authored modelling example supplied for Marcus; not a diagnosis or learned observation. */
export function privateProfile(persona) {
  return {
    personaId: persona.id,
    profileRevision: persona.profileRevision ?? 1,
    schemaVersion: 1,
    source: "authored",
    latentMotivationProfile: {
      internalOnly: true,
      primary: {
        code: "status_identity",
        weight: 0.78,
        needs: [
          "professional recognition",
          "credible differentiation",
          "selective access",
        ],
        threats: [
          "commoditisation",
          "appearing inexperienced",
          "being treated as an ordinary buyer",
        ],
        preferredEvidence: [
          "expert credentials",
          "selectivity",
          "peer-level case evidence",
        ],
      },
      secondary: {
        code: "effort_avoidance",
        weight: 0.46,
        needs: ["low implementation burden", "clear next steps", "delegation"],
        threats: ["complex setup", "large time commitment"],
      },
    },
  };
}
export const marcusHistory = [
  message(
    "A competing CRM offers a similar service at approximately 200% of our price.",
    "user",
  ),
  message(
    "Price isn't really the deciding factor for me. If we're going to introduce another platform, I need to understand what makes this meaningfully better for a growth team rather than simply cheaper.",
  ),
  message(
    "Our CRM is designed to save time by simplifying the platform and making it user-friendly for teams without requiring deep technical expertise.",
    "user",
  ),
  message(
    "Reducing the technical overhead is useful, but I wouldn't want simplicity to come at the expense of the depth of information my team and I need.",
  ),
  message(
    "The CRM includes an extended analytics dashboard designed to produce information that can be shared with stakeholders.",
    "user",
  ),
  message(
    "The analytics side is more interesting to me. I'd want to see whether the output is genuinely useful at an executive level and whether it gives me anything I can't already get from our current tools.",
  ),
  message(
    "Given you were referred to us, I'd rather let the product earn your confidence than give you another sales pitch. In a short demonstration, we can show you how the CRM turns your growth data into an executive-ready analytics view while removing much of the setup and technical overhead from your team. You can then judge for yourself whether it gives you a meaningful advantage over the alternatives you're considering. Are you open to seeing it in action?",
    "user",
  ),
  message(
    "Potentially. My concern is that most platforms look impressive in a controlled demonstration. I'd need to understand whether what you're showing me translates to the kind of growth-marketing work we're actually doing.",
  ),
  message(
    "In a short demonstration, we can take a realistic growth-marketing scenario and show you exactly how the CRM turns the underlying activity into an executive-ready analytics view, what your team would actually need to do to maintain it, and where it differs from the higher-priced alternatives you're considering. You can judge the workflow and output against the standard you would expect from your team.",
    "user",
  ),
  message(
    "Using a realistic scenario would make it more relevant. I'd still want some indication that this has worked for someone operating at a comparable level before investing time in it.",
  ),
  message(
    "Rather than asking you to take our claims at face value, let's test them. Give us one realistic growth-marketing scenario your team deals with today and we'll use it in the demonstration to show you, live, how the CRM handles the workflow, what analytics it produces and how much manual work is actually required. You'll be able to compare the result directly against what you use now. There's no commitment required beyond the demonstration.",
    "user",
  ),
  message(
    "That's a better way to assess it. If you can show me that the workflow has been used successfully in a comparable growth environment, I'd be more comfortable putting one of our scenarios through it.",
  ),
];
export const marcusPitch =
  "To give you something more concrete than our own claims: we recently ran this workflow with a Head of Growth operating in a comparable environment. They used their own campaign data in the session and were able to produce the executive analytics view directly from the CRM without additional technical support. Rather than assume that result translates to your team, I'd suggest we run the same test with one of your scenarios. If it doesn't meet the standard you expect, you'll know within the demonstration. Would you be open to testing it?";
