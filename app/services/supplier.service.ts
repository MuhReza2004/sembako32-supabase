import { supabase } from "../lib/supabase";
import { Supplier, SupplierFormData } from "@/app/types/supplier";

const generateSupplierCode = async (): Promise<string> => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("kode")
    .order("kode", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    return "SUP-001";
  }

  const lastCode = data.kode;
  const lastNumber = parseInt(lastCode.split("-")[1]);
  const newNumber = lastNumber + 1;
  const newCode = `SUP-${newNumber.toString().padStart(3, "0")}`;

  return newCode;
};

/* ======================
   CREATE
====================== */
export const addSupplier = async (
  data: Omit<SupplierFormData, "kode">,
): Promise<string> => {
  const { data: existingSupplier, error: existingError } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("nama", data.nama)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingSupplier) {
    throw new Error("Nama supplier sudah terdaftar.");
  }

  const kode = await generateSupplierCode();

  const { data: newSupplier, error } = await supabase
    .from("suppliers")
    .insert({
      ...data,
      kode,
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
