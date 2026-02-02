export type OrderItem = {
  product_id: string;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
};

export type Order = {
  id: string;
  buyer_name: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_by: string;
  created_at: string | null;
};
