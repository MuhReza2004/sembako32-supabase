import { supabase } from "../lib/supabase";
import { Supplier, SupplierFormData } from "@/app/types/suplyer";

/* ======================
   CREATE
====================== */
export const addSupplier = async (data: SupplierFormData): Promise<string> => {
  const { data: newSupplier, error } = await supabase
    .from("suppliers")
    .insert({
      ...data,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error adding supplier:", error);
    throw error;
  }
  return newSupplier.id;
};

/* ======================
   READ
====================== */
export const getAllSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*");

  if (error) {
    console.error("Error fetching all suppliers:", error);
    return [];
  }
  return data as Supplier[];
};

export const getSupplierById = async (id: string): Promise<Supplier | null> => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") { // No rows found
      return null;
    }
    console.error("Error fetching supplier by ID:", error);
    throw error;
  }
  return data as Supplier;
};

/* ======================
   UPDATE
====================== */
export const updateSupplier = async (
  id: string,
  data: Partial<SupplierFormData>,
): Promise<void> => {
  const { error } = await supabase
    .from("suppliers")
    .update({ ...data })
    .eq("id", id);

  if (error) {
    console.error("Error updating supplier:", error);
    throw error;
  }
};

/* ======================
   DELETE
====================== */
export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting supplier:", error);
    throw error;
  }
};
