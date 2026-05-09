// Browser-safe agent clients — no Node.js imports.
// The server-side @physiocore/orchestrator package is intentionally excluded from the app bundle.
export { generateFeedback } from '../lib/agents/feedbackClient.js';
export { generateNutritionPlan } from '../lib/agents/nutritionClient.js';
export { assessPatient } from '../lib/agents/clinicalClient.js';
export { analyzeBehavior } from '../lib/agents/behaviorClient.js';
export { analyzeFrames } from '../lib/agents/poseAnalyzer.js';
