import { supabaseAdmin } from "../config/database.js";

export const authenticate = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];
    const userEmail = req.headers["x-user-email"];
    const gatewayVerified = req.headers["x-gateway-verified"];

    if (userId && gatewayVerified === "true") {
      req.user = { id: userId, email: userEmail };

      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .select("*")
        .eq("id", userId)
        .single();

      if (companyError && companyError.code !== "PGRST116") {
        throw companyError;
      }

      req.company = company || null;
      return next();
    }

    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];

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

    req.user = { id: user.id, email: user.email };

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", user.id)
      .single();

    req.company = company || null;
    next();
  } catch (err) {
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
