import type { UserProfile, AgentContext } from '@physiocore/types';
import { randomUUID } from 'crypto';

export function createAgentContext(userProfile: UserProfile, sessionId?: string): AgentContext {
  return {
    userProfile,
    sessionId: sessionId ?? randomUUID(),
    timestamp: new Date().toISOString(),
    requestId: randomUUID(),
  };
}

export interface OrchestratorConfig {
  anthropicApiKey?: string;
  fhirBaseUrl?: string;
  enabledAgents: {
    pose: boolean;
    feedback: boolean;
    nutrition: boolean;
    clinical: boolean;
    behavior: boolean;
  };
}

export const defaultOrchestratorConfig: OrchestratorConfig = {
  enabledAgents: {
    pose: true,
    feedback: true,
    nutrition: true,
    clinical: true,
    behavior: true,
  },
};
