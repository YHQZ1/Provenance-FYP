import { authService } from "../services/auth.service.js";
import { supabaseAdmin } from "../config/database.js";

const readToken = (req) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return req.body?.token || null;
};

export const authController = {
  // Called after sign-in so every user has a company record before loading data.
  async syncUser(req, res, next) {
    try {
      const token = readToken(req);
      if (!token) {
        return res.status(400).json({ success: false, message: "No token provided" });
      }

      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
      }

      const company = await authService.getOrCreateCompany(user);

      return res.json({
        success: true,
        data: { user: { id: user.id, email: user.email }, company },
      });
    } catch (error) {
      next(error);
    }
  },

  // Sessions live in the Supabase client. This clears the cookie older builds set.
  logout(req, res) {
    res.clearCookie("token", { path: "/" });
    return res.json({ success: true, message: "Logout successful" });
  },

  getCurrentUser(req, res) {
    return res.json({
      success: true,
      data: { user: req.user, company: req.company },
    });
  },
};
