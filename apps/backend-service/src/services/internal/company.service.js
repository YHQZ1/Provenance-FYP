import { supabaseAdmin } from "../../config/database.js";

export const createCompany = async (userId, data) => {
  const { data: result, error } = await supabaseAdmin
    .from("companies")
    .insert({
      id: userId,
      company_name: data.company_name,
      gst_number: data.gst_number || null,
      Pibo_category: data.Pibo_category || [],
      email_id: data.email_id,
      onboarding_completed: true,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const updateCompany = async (userId, updates) => {
  const allowedFields = [
    "company_name",
    "gst_number",
    "Pibo_category",
    "onboarding_completed",
  ];
  const filteredUpdates = {};

  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) return null;

  const { data: result, error } = await supabaseAdmin
    .from("companies")
    .update(filteredUpdates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const getCompanyById = async (companyId) => {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
};
