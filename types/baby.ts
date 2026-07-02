export interface ChecklistItem {
  id: number;
  family_code: string;
  period_type: string;
  task_name: string;
  tips: string;
  is_completed: number;
}

export interface InventoryItem {
  id: number;
  family_code: string;
  section_name: string;
  item_name: string;
  brand_name: string;
  target_cnt: number;
  status: string;
  memo: string;
  hotdeal_price?: number;
}
