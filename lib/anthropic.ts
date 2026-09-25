import Anthropic from "@anthropic-ai/sdk";

const API_KEY = process.env.ANTHROPIC_API_KEY;

export function isAnthropicConfigured(): boolean {
  return Boolean(API_KEY);
}

let client: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: API_KEY });
  return client;
}
