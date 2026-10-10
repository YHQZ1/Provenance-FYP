import { supabaseAdmin } from "../config/database.js";

const blank = (value) => value === null || value === undefined || String(value).trim() === "";

export const signupProfile = (user) => {
  const meta = user.user_metadata || {};
  return {
    company_name: blank(meta.company_name) ? user.email?.split("@")[0] || null : meta.company_name,
    gst_number: blank(meta.gst_number) ? null : meta.gst_number,
  };
};

export const missingProfileFields = (existing, user) => {
  const profile = signupProfile(user);
  const patch = {};
  if (blank(existing.company_name) && !blank(profile.company_name)) {
    patch.company_name = profile.company_name;
  }
  if (blank(existing.gst_number) && !blank(profile.gst_number)) {
    patch.gst_number = profile.gst_number;
  }
  return patch;
};

export const authService = {
  async getOrCreateCompany(user) {
    const { data: existing } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      const patch = missingProfileFields(existing, user);
      if (!Object.keys(patch).length) return existing;
      const { data: updated, error } = await supabaseAdmin
        .from("companies")
        .update(patch)
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw new Error(`Failed to complete the company profile: ${error.message}`);
      return updated;
    }

    const { data: newCompany, error } = await supabaseAdmin
      .from("companies")
      .insert({
        id: user.id,
        email_id: user.email,
        ...signupProfile(user),
        Pibo_category: [],
        onboarding_completed: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create company: ${error.message}`);

    return newCompany;
  },
};
