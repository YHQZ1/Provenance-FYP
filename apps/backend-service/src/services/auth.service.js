import { supabaseAdmin } from "../config/database.js";

export const authService = {
  async getOrCreateCompany(user) {
    const { data: existing } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) return existing;

    const { data: newCompany, error } = await supabaseAdmin
      .from("companies")
      .insert({
        id: user.id,
        email_id: user.email,
        company_name: user.user_metadata?.company_name || user.email?.split("@")[0],
        gst_number: user.user_metadata?.gst_number || null,
        Pibo_category: [],
        onboarding_completed: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create company: ${error.message}`);

    return newCompany;
  },
};
