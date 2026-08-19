// src/components/Auth.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(''); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { email: formData.email, password: formData.password }
      : { username: formData.username, email: formData.email, password: formData.password };

    try {
      // SECURED: Using dynamic environment variable
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      navigate('/join');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-zinc-50 flex flex-col items-center justify-center overflow-hidden font-sans">
      
      {/* ULTRA MINIMAL BACKGROUND GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"></div>

      {/* TOP LOGO REDIRECT */}
      <div className="absolute top-8 left-8 z-20">
        <div 
          onClick={() => navigate('/')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded bg-[#111111] border border-zinc-800 flex items-center justify-center transition-colors group-hover:border-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-50">
            Collab<span className="text-blue-500 font-semibold">Space</span>
          </span>
        </div>
      </div>

      {/* AUTH CARD */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[380px] p-8 bg-[#111111] border border-zinc-800 rounded-2xl shadow-2xl relative z-10"
      >
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-zinc-50 tracking-tight mb-2">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-sm text-zinc-400">
            {isLogin ? 'Enter your details to access your workspace.' : 'Sign up to start collaborating in real-time.'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-2 text-red-400 text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  required={!isLogin}
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="username"
                  className="w-full bg-black text-zinc-50 px-4 py-2.5 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-600 text-sm"
                  placeholder="e.g., CodeNinja"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              className="w-full bg-black text-zinc-50 px-4 py-2.5 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-600 text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="w-full bg-black text-zinc-50 px-4 py-2.5 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-600 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-200 text-black font-semibold rounded-lg transition-colors text-sm mt-2 flex justify-center items-center h-10 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ username: '', email: '', password: '' });
            }} 
            className="text-zinc-50 hover:underline font-medium transition-colors outline-none"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </motion.div>
      
    </div>
  );
}

export default Auth;