export const TIER_OPTIONS = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-'] as const;
export type Tier = typeof TIER_OPTIONS[number];
