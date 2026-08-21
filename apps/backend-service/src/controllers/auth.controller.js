import { authService } from "../services/auth.service.js";
import { supabaseAdmin } from "../config/database.js";
import { env } from "../config/env.js";

export const authController = {
  async syncUser(req, res, next) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "No token provided",
        });
      }

      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      const company = await authService.getOrCreateCompany(user);

      res.cookie("token", token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 6 * 60 * 60 * 1000,
        path: "/",
      });

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
          },
          company,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async verifyToken(req, res) {
    try {
      const token =
        req.cookies?.token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ success: false, message: "No token" });
      }

      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid token" });
      }

      res.setHeader("X-User-ID", user.id);
      res.setHeader("X-User-Email", user.email || "");
      res.setHeader("X-Gateway-Verified", "true");

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
          },
        },
      });
    } catch (error) {
      return res
        .status(401)
        .json({ success: false, message: "Verification failed" });
    }
  },

  logout(req, res) {
    res.clearCookie("token", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.json({
      success: true,
      message: "Logout successful",
    });
  },

  getCurrentUser(req, res) {
    return res.json({
      success: true,
      data: {
        user: req.user,
        company: req.company,
      },
    });
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      await authService.forgotPassword(email);
      return res.json({
        success: true,
        message: "Password reset email sent",
      });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Token and new password are required",
        });
      }

      await authService.resetPassword(token, newPassword);
      return res.json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error) {
      next(error);
    }
  },
};
