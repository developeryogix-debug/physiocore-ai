import type { UserProfile } from '@physiocore/types';

/** Demo profile used across pages when no real auth session is present. */
export const MOCK_PROFILE: UserProfile = {
  id: 'demo-user-001',
  email: 'demo@physiocore.ai',
  name: 'Alex Demo',
  dateOfBirth: '1990-06-15',
  gender: 'prefer_not_to_say',
  heightCm: 175,
  weightKg: 75,
  bmi: 24.5,
  fitnessLevel: 'intermediate',
  primaryGoal: 'rehabilitation',
  injuries: [
    {
      id: 'inj-001',
      bodyPart: 'knee_left',
      type: 'chronic',
      severity: 2,
      isActive: true,
      notes: 'Mild patellofemoral pain',
    },
  ],
  conditions: [],
  medications: [],
  preferences: {
    sessionDurationMinutes: 30,
    preferredIntensity: 'moderate',
    equipmentAvailable: ['yoga_mat', 'resistance_bands'],
    notificationsEnabled: true,
    language: 'en',
    timezone: 'America/New_York',
  },
  subscription: 'pro',
  createdAt: '2024-01-10T09:00:00Z',
  updatedAt: '2025-05-01T14:30:00Z',
};
