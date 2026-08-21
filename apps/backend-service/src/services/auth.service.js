import { supabaseAdmin } from "../config/database.js";
import { env } from "../config/env.js";

export const authService = {
  async getOrCreateCompany(user) {
    const { data: existing } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", user.id)
      .single();

    if (existing) return existing;

    const { data: newCompany, error } = await supabaseAdmin
      .from("companies")
      .insert({
        id: user.id,
        email_id: user.email,
        company_name:
          user.user_metadata?.company_name || user.email?.split("@")[0],
        gst_number: user.user_metadata?.gst_number || null,
        Pibo_category: [],
        onboarding_completed: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create company: ${error.message}`);

    return newCompany;
  },

  async forgotPassword(email) {
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.FRONTEND_URL}/reset-password`,
    });

    if (error) throw new Error(`Failed to send reset email: ${error.message}`);

    return true;
  },

  async resetPassword(token, newPassword) {
    const {
      data: { user },
      error: verifyError,
    } = await supabaseAdmin.auth.getUser(token);

    if (verifyError || !user) throw new Error("Invalid or expired reset token");

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateError)
      throw new Error(`Failed to update password: ${updateError.message}`);

    return true;
  },
};
