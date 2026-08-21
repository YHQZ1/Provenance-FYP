import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');

    if (accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token')
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <style>{`
        @keyframes float1 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(180deg); }
          100% { transform: translateY(0px) rotate(360deg); }
        }

        @keyframes float2 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-40px) rotate(180deg); }
          100% { transform: translateY(0px) rotate(360deg); }
        }

        @keyframes float3 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(180deg); }
          100% { transform: translateY(0px) rotate(360deg); }
        }

        .bg-circle1 {
          position: absolute;
          top: 10%;
          left: 10%;
          width: 200px;
          height: 200px;
          background: linear-gradient(45deg, var(--accent-blue-s), var(--accent-green-s));
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.3;
          animation: float1 6s ease-in-out infinite;
        }

        .bg-circle2 {
          position: absolute;
          top: 60%;
          right: 15%;
          width: 150px;
          height: 150px;
          background: linear-gradient(45deg, var(--accent-purple-s), var(--accent-orange-s));
          border-radius: 50%;
          filter: blur(30px);
          opacity: 0.2;
          animation: float2 8s ease-in-out infinite;
        }

        .bg-circle3 {
          position: absolute;
          bottom: 20%;
          left: 50%;
          width: 180px;
          height: 180px;
          background: linear-gradient(45deg, var(--accent-green-s), var(--accent-blue-s));
          border-radius: 50%;
          filter: blur(35px);
          opacity: 0.25;
          animation: float3 7s ease-in-out infinite;
        }
      `}</style>

      <div className="bg-circle1" />
      <div className="bg-circle2" />
      <div className="bg-circle3" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="p-card max-w-md w-full mx-4"
      >
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center mx-auto mb-4"
            style={{ width: 64, height: 64, backgroundColor: 'var(--accent-green-s)', borderRadius: '16px' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2.5L19.5 7.5V16.5L12 21.5L4.5 16.5V7.5L12 2.5Z" stroke="var(--accent-green)" strokeWidth="2" fill="var(--bg-base)" />
              <path d="M12 7V12.5L15.5 14.75" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: 'Syne, serif', color: 'var(--text-primary)' }}
          >
            Set new password
          </h1>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {errorMessage ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 p-3 rounded-md text-sm"
              style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)' }}
            >
              {errorMessage}
            </motion.div>
          ) : success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 p-3 rounded-md text-sm flex items-center gap-2"
              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }}
            >
              <Check className="w-4 h-4" />
              Password updated successfully!
            </motion.div>
          ) : null}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-input pr-10"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="p-input pr-10"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Updating...' : 'Set Password'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
