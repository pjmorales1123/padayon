// Shares the same learner choices across Home, Chat, and Live Demo.
export interface LearnerProfileOption {
  id: string;
  name: string;
}

export const LEARNER_PROFILES_STORAGE_KEY = "padayon_profiles";

export const DEFAULT_LEARNER_PROFILES: LearnerProfileOption[] = [
  { id: "demo-user-id", name: "Demo Student" },
  { id: "demo-new-student", name: "Maria · Brand new" },
  { id: "demo-bisaya-learner", name: "Juan · Cebuano-first" },
  { id: "demo-english-advanced", name: "Alex · Advanced" },
  { id: "demo-struggling-student", name: "Bea · Needs support" },
];

export function mergeLearnerProfiles(
  savedProfiles: LearnerProfileOption[],
  selectedProfile?: LearnerProfileOption,
): LearnerProfileOption[] {
  const profiles = [...DEFAULT_LEARNER_PROFILES];

  for (const profile of [...savedProfiles, ...(selectedProfile ? [selectedProfile] : [])]) {
    if (profile.id && profile.name && !profiles.some((existing) => existing.id === profile.id)) {
      profiles.push(profile);
    }
  }

  return profiles;
}

export function readSavedLearnerProfiles(): LearnerProfileOption[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(LEARNER_PROFILES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLearnerProfiles(profiles: LearnerProfileOption[]) {
  localStorage.setItem(LEARNER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}
