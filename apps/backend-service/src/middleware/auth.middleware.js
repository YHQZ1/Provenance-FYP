import { supabaseAdmin } from "../config/database.js";

const readToken = (req) => {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
};

export const authenticate = async (req, res, next) => {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const meta = user.user_metadata || {};
    req.user = {
      id: user.id,
      email: user.email,
      name: meta.full_name || meta.name || null,
    };

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    req.company = company || null;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const requireCompany = (req, res, next) => {
  if (!req.company) {
    return res.status(403).json({
      success: false,
      message: "Company profile required",
    });
  }
  next();
};
