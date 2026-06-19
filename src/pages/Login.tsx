import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { LogIn, Mail, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Standard Firebase email/password authentication
      await signInWithEmailAndPassword(auth, email, password);
      
      // Navigation is handled by ProtectedRoute based on user role in Firestore
      // The context or ProtectedRoute will redirect based on the user's role
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError("Kredensial tidak valid. Silakan periksa kembali email dan kata sandi Anda.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Login dengan Email/Password belum diaktifkan. Silakan buka Firebase Console > Authentication > Sign-in method, lalu aktifkan 'Email/Password'.");
      } else if (err.code === 'auth/user-not-found') {
        setError("Akun tidak ditemukan. Silakan daftar terlebih dahulu.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      
      // Navigation is handled by ProtectedRoute based on user role in Firestore
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-minimal p-10 space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="bg-primary w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-blue-50">
            <LogIn className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Akses Identitas</h1>
          <p className="text-slate-500 text-sm font-medium">Masuk dengan aman ke portal penghuni Anda.</p>
        </div>

        {error && (
          <div className="bg-danger/5 text-danger px-4 py-3 rounded-xl text-xs border border-danger/10 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email / Username</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email atau Username"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-slate-700"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-slate-700"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3.5 shadow-xl shadow-blue-500/10"
          >
            {loading ? 'Mengautentikasi...' : 'Masuk Sekarang'}
          </button>
        </form>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
            <span className="bg-white px-2 text-slate-300 tracking-[0.2em]">Penyedia Eksternal</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-3 text-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
          <span>Google Workspace</span>
        </button>

        <p className="text-center text-slate-500 text-xs font-medium">
          Baru di platform ini? <Link to="/register" className="text-primary font-bold hover:underline">Minta akses</Link>
        </p>
      </motion.div>
    </div>
  );
}
