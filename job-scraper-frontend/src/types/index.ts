export interface Job {
  title: string;
  company: string;
  location: string;
  platform: string;
  link: string;
  description?: string;
}

/** API response for application history (snake_case) */
export interface ApplicationHistoryItem {
  id: number;
  user_id: number;
  job_title: string;
  company: string;
  platform: string;
  job_link: string;
  job_description?: string;
  applied_date: string;
  status: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string | null;
  profile_image: string | null;
  bio: string | null;
  skills: string | null;
  resume: string | null;
}

// Application status options
export const APPLICATION_STATUSES = [
  "Applied",
  "Screening", 
  "Interview",
  "Offer",
  "Rejected",
  "Ghosted"
] as const;

export type ApplicationStatus = typeof APPLICATION_STATUSES[number];
