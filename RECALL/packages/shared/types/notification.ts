export interface Notification {
  id: string;
  user_id: string;
  link_id?: string | null;
  type: 'reminder' | 'urgent' | 'digest';
  sent_at: string;
  opened: boolean;
}
