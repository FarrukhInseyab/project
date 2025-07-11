import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogIn, UserPlus, Mail, Lock, User, Building, Eye, EyeOff, Sparkles, KeyRound, ArrowLeft } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const { signIn, signUp, resetPassword, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (mode === 'signup') {
        await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          company: formData.company
        });
      } else if (mode === 'login') {
        await signIn(formData.email, formData.password);
      } else if (mode === 'forgot') {
        await resetPassword(formData.email);
        setError('');
        alert('Password reset instructions have been sent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-3 sm:p-4 mobile-container">
      <div className="max-w-md w-full">
        {/* Header with back button for forgot password */}
        <div className="text-center mb-6 sm:mb-8">
          {mode === 'forgot' && (
            <button 
              onClick={() => setMode('login')}
              className="absolute left-4 top-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
            <img 
              src="/go-ar-logo.png" 
              alt="Go-AR Logo" 
              className="h-10 sm:h-12 w-auto"
            />
            <div className="h-6 sm:h-8 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Document AI Studio
              </h1>
            </div>
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            {mode === 'signup' && 'Create your account'}
            {mode === 'login' && 'Welcome back'}
            {mode === 'forgot' && (
              <span className="text-blue-600 font-medium">Reset your password</span>
            )}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 mobile-input touch-manipulation"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Company (Optional)
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 mobile-input touch-manipulation"
                      placeholder="Enter your company name"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 mobile-input touch-manipulation"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {mode !== 'forgot' && <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 mobile-input touch-manipulation"
                  placeholder="Enter your password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {loading && (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              )}
              {!loading && mode === 'signup' && (
                <UserPlus className="w-5 h-5 mr-2" />
              )}
              {!loading && mode === 'login' && (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {!loading && mode === 'forgot' && (
                <KeyRound className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Please wait...' : 
               mode === 'signup' ? 'Create Account' : mode === 'login' ? 'Sign In' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-4 sm:mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setFormData({ email: '', password: '', full_name: '', company: '' });
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium touch-manipulation"
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
            
            {mode === 'login' && (
              <button
                onClick={() => {
                  setMode('forgot');
                  setError('');
                }}
                className="block mt-2 text-sm text-gray-500 hover:text-gray-700 touch-manipulation"
              >
                Forgot your password?
              </button>
            )}
          </div>

          {/* Features Preview */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">What you'll get:</span>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 flex-shrink-0"></div>
                <span>AI-powered document tag extraction</span>
              </div>
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 flex-shrink-0"></div>
                <span>Smart data mapping and population</span>
              </div>
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2 flex-shrink-0"></div>
                <span>Template library and reusable workflows</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};