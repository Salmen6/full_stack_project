import React, { useState } from 'react';
import '../index.css';

import { useNavigate } from 'react-router-dom';
import ExamService from '../services/ExamService';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, HelpCircle } from 'lucide-react';

const InputField = ({ label, type = 'text', value, onChange, placeholder, error, id }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
          {id === 'login' ? <User size={18} /> : <Lock size={18} />}
        </div>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`block w-full pl-10 pr-10 py-2.5 rounded-lg border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all duration-200
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'}
          `}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p className="flex items-center text-xs text-red-600 mt-1 animate-fadeIn">
          <AlertCircle size={12} className="mr-1" /> {error}
        </p>
      )}
    </div>
  );
};

const Login = () => {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('loading');

    try {
      // --- FILE B LOGIC ---
      const user = await ExamService.login(loginInput, password);
      login(user);
      navigate(user.redirect);
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <img
  src="/fsegs.png"
  alt="University Logo"
  className="mx-auto mb-4 w-64 h-auto object-contain"
/>

          
          <p className="text-slate-600">Enter your University ID and password</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <InputField
            id="login"
            label="University ID or Email"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            placeholder="e.g. s1234567"
            error={error && !loginInput ? error : ''}
          />

          <InputField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            error={error && !password ? error : ''}
          />

          {error && (
            <div className="flex items-center text-red-600 text-sm mt-1">
              <AlertCircle size={14} className="mr-1" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-[0.98]"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2" size={18} />
                Authenticating...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="ml-2 -mr-1" size={18} />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 mt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-sm gap-2">
          <a href="#" className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors">
            <HelpCircle size={16} className="mr-1.5" />
            Need Help?
          </a>
          <div className="flex gap-4">
            <a href="#" className="text-slate-500 hover:text-slate-900">Privacy Policy</a>
            <a href="#" className="text-slate-500 hover:text-slate-900">Terms of Use</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
