export function synthesisFixture() {
  return {
    name: "Marcus Vance-Ross",
    role: "Head of Growth Marketing",
    budget_sensitivity: "Medium",
    profile: {
      industry: "B2B software",
      background:
        "Leads a growth team. Wants useful executive reporting without extra technical work.",
      goals: [
        "Understand campaign performance",
        "Make reporting useful for executive decisions",
      ],
      painPoints: ["Manual reporting work"],
      buyingMotivations: ["Meaningful improvement over current tools"],
      typicalObjections: ["Does simple mean less analytical depth?"],
      preferredEvidence: [
        "Comparable growth-team examples",
        "A realistic campaign workflow",
      ],
      communicationStyle:
        "Brief, direct and curious. Challenges vague claims without making a speech.",
      examplePhrases: [
        "What would that tell me that I can't see today?",
        "Yes, let's try it with one campaign.",
      ],
      provenance: {
        industry: "provided",
        background: "provided",
        goals: "provided",
        painPoints: "provided",
        buyingMotivations: "provided",
        typicalObjections: "provided",
        preferredEvidence: "provided",
        communicationStyle: "inferred",
        examplePhrases: "inferred",
      },
    },
    review: {
      identitySources: {
        name: "provided",
        role: "provided",
        budget_sensitivity: "inferred",
      },
      notes: [
        "Budget sensitivity was not specified; Medium is a working assumption.",
        "Current tools and internal approval requirements are unknown.",
      ],
    },
  };
}
