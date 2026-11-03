/**
 * TranslateSense Constants
 */

export const PROVIDERS = {
  CHROME_AI: 'chrome_ai',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  EDGE_AI: 'edge_ai',
};

export const PROVIDER_NAMES = {
  chrome_ai: 'Chrome Local AI',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  edge_ai: 'Edge Built-in AI',
};

export const STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ALREADY_EXISTS: 'already_exists',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  CANCELLING: 'cancelling',
};

export const BUILDERS = {
  GUTENBERG: 'gutenberg',
  ELEMENTOR: 'elementor',
  CLASSIC: 'classic',
};

export const DEFAULT_BATCH_SIZE = 5;
export const DEFAULT_POLL_INTERVAL = 5000;

