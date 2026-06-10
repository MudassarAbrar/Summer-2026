export interface User {
  id: string;
  email: string;
  display_name?: string | null;
  created_at: string;
  streak_count: number;
  notif_enabled: boolean;
}
