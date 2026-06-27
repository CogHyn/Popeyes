export const config = {
  groqApiKey: import.meta.env.VITE_GROQ_API_KEY,
  groqModel: import.meta.env.VITE_GROQ_MODEL || 'qwen/qwen3-32b',
  tavilyApiKey: import.meta.env.VITE_TAVILY_API_KEY,
};

export function requireConfigValue(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required config: ${name}`);
  }

  return value.trim();
}
