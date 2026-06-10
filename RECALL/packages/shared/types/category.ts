export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  color: string;
  is_default: boolean;
}
