'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { loginAdmin, requestPasswordReset } from '../services/auth';

export const Login: React.FC = () => {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSentMessage, setResetSentMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSentMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      await loginAdmin(email, password, rememberMe);
      router.replace('/dashboard');
      router.refresh();
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setErrorMessage('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please try again later or reset password.');
      } else {
        setErrorMessage(err.message || 'Failed to authenticate. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMessage('Please enter your email address first to reset your password.');
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);
    try {
      await requestPasswordReset(email);
      setResetSentMessage('Password reset link sent! Check your inbox.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to send password reset email.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#F7F8FA] flex flex-col justify-center items-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-[420px] flex flex-col items-center">
        
        {/* MR GYM Brand Logo */}
        <div className="mb-6 flex justify-center">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden shadow-sm border border-gray-100 bg-white p-1">
            <img
              src="/logo.png"
              alt="MR GYM"
              className="h-full w-full object-cover rounded-full"
              onError={(e) => {
                // Fallback text banner if image file is not found
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full bg-white rounded-xl sm:rounded-2xl border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 sm:p-8">
          
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-[26px] font-bold text-[#1F2937] tracking-tight">
              Welcome Back
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Sign in to your admin account
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {resetSentMessage && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-[#16A34A]">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{resetSentMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email Address Field */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-[#1F2937] mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., admin@mrgym.com"
                  required
                  autoComplete="email"
                  className="w-full h-11 sm:h-12 pl-10 pr-3.5 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-[#1F2937] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-11 sm:h-12 pl-10 pr-10 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#6B7280] focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className="text-xs sm:text-sm text-[#6B7280]">
                  Remember Me
                </span>
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-xs sm:text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors disabled:opacity-50"
              >
                {isResetting ? 'Sending...' : 'Forgot Password?'}
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 sm:h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-sm sm:text-base rounded-lg shadow-sm transition-all duration-150 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </div>

          </form>

          {/* Footer Security Note */}
          <div className="mt-6 pt-4 border-t border-[#F3F4F6] text-center">
            <p className="text-[11px] text-[#9CA3AF] tracking-wide">
              *Secure connection. MR GYM Administration Portal.*
            </p>
          </div>

        </div>

      </div>
    </main>
  );
};
