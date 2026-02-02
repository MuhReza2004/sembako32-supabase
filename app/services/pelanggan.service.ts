import { supabase } from "../lib/supabase";
import { Pelanggan, PelangganFormData } from "../types/pelanggan";
import { v4 as uuidv4 } from 'uuid'; // For temporary ID generation

/* =============================
   AUTO GENERATE ID PELANGGAN
   ============================= */
const generatePelangganId = async (): Promise<string> => {
  // TODO: Implement proper sequential PLG-xxxxx generation using Supabase functions or a dedicated sequence table.
  // For now, generating a UUID to ensure uniqueness.
  return `PLG-${uuidv4().substring(0, 8).toUpperCase()}`;
};

/* =============================
   AUTO GENERATE KODE PELANGGAN
   ============================= */
export const generateKodePelanggan = async (): Promise<string> => {
  // TODO: Implement proper sequential PLG-xxxxx generation for kodePelanggan if different from idPelanggan.
  // For now, using the same temporary UUID generation.
  return `KDP-${uuidv4().substring(0, 8).toUpperCase()}`;
};

export const getNewKodePelanggan = async (): Promise<string> => {
  return await generateKodePelanggan();
};

export const addpelanggan = async (
  data: PelangganFormData,
): Promise<string> => {
  const id_pelanggan = await generatePelangganId();
  const kode_pelanggan = await generateKodePelanggan(); // Assuming a separate generation for kode_pelanggan if needed

  const { data: newPelanggan, error } = await supabase
    .from("pelanggan")
    .insert({
      ...data,
      id_pelanggan,
      kode_pelanggan, // Ensure kode_pelanggan is also set
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error adding pelanggan:", error);
    throw error;
  }
  return newPelanggan.id;
};

/* =============================
   READ
   ============================= */
export const getAllPelanggan = async (): Promise<Pelanggan[]> => {
  const { data, error } = await supabase
    .from("pelanggan")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all pelanggan:", error);
    return [];
  }
  return data as Pelanggan[];
};

export const getPelangganById = async (
  idOrIdPelanggan: string,
): Promise<Pelanggan | null> => {
  if (!idOrIdPelanggan) return null;

  // Try to get by primary key 'id' (UUID)
  let { data, error } = await supabase
    .from("pelanggan")
    .select("*")
    .eq("id", idOrIdPelanggan)
    .single();

  if (error && error.code === "PGRST116") { // No rows found by 'id', try 'id_pelanggan'
    const { data: dataByIdPelanggan, error: errorByIdPelanggan } = await supabase
      .from("pelanggan")
      .select("*")
      .eq("id_pelanggan", idOrIdPelanggan)
      .single();

    if (errorByIdPelanggan && errorByIdPelanggan.code === "PGRST116") { // No rows found by 'id_pelanggan' either
      return null;
    } else if (errorByIdPelanggan) {
      console.error("Error fetching pelanggan by id_pelanggan:", errorByIdPelanggan);
      throw errorByIdPelanggan;
    }
    data = dataByIdPelanggan;
  } else if (error) {
    console.error("Error fetching pelanggan by ID:", error);
    throw error;
  }

  return data as Pelanggan | null;
};

/* =============================
   UPDATE & DELETE
   ============================= */
export const updatePelanggan = async (
  id: string,
  data: Partial<PelangganFormData>,
): Promise<void> => {
  const { error } = await supabase
    .from("pelanggan")
    .update({ ...data })
    .eq("id", id);

  if (error) {
    console.error("Error updating pelanggan:", error);
    throw error;
  }
};

export const deletePelanggan = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("pelanggan")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting pelanggan:", error);
    throw error;
  }
};
