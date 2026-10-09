/** Ids and titles of the demo investigations, for routing and metadata on the server. */
export const SEED_IDS = ["sycophancy-model-x", "tool-use-reliability", "long-context-degradation", "instruction-following"] as const;

export const SEED_TITLES: Record<string, string> = {
  "sycophancy-model-x": "Sycophancy in Model X",
  "tool-use-reliability": "Tool-use reliability",
  "long-context-degradation": "Long-context degradation",
  "instruction-following": "Instruction following",
};
