import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { login } from '../services/authService';

interface LoginProps {
  campaignId: string;
  onLoginSuccess: (email: string, contactName?: string, clientName?: string) => void;
}

const Login: React.FC<LoginProps> = ({ campaignId, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loginInfo, setLoginInfo] = useState<{ contactName?: string; clientName?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await login(email, campaignId);
      
      if (result.success) {
        setLoginInfo({ contactName: result.contactName, clientName: result.clientName });
        setShowSuccess(true);
        
        // Short delay to show success message
        setTimeout(() => {
          onLoginSuccess(email, result.contactName, result.clientName);
        }, 1500);
      } else {
        setError(result.error || 'Access denied.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Granted!</h2>
          <p className="text-slate-500">
            Welcome{loginInfo?.contactName ? `, ${loginInfo.contactName}` : ''}!
            {loginInfo?.clientName && (
              <span className="block text-sm mt-1 text-indigo-600">{loginInfo.clientName}</span>
            )}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading campaign...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-indigo-200">
            C
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
          <p className="text-slate-500 mt-2">
            Enter your email to access the review dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@company.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Access Campaign
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-center text-xs text-slate-400">
            Only authorized contacts can access this campaign.
            <br />
            If you need access, please contact your agency representative.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

