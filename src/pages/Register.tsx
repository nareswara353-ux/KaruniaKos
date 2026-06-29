import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { UserPlus, Mail, Lock, User, Phone } from 'lucide-react';
import { motion } from 'motion/react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: fullName });
      
      // Initial Firestore profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        role: 'user',
        displayName: fullName,
        phone: phone,
        createdAt: new Date().toISOString(),
      });
      
      await sendEmailVerification(user);
      navigate('/verify-email');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            <UserPlus className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Permintaan Akses</h1>
          <p className="text-slate-500 text-sm font-medium">Daftarkan profil Anda untuk mulai menjelajah.</p>
        </div>

        {error && (
          <div className="bg-danger/5 text-danger px-4 py-3 rounded-xl text-xs border border-danger/10 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                required 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Andi Budiman"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-slate-700"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nomor Telepon</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="tel" 
                required 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-slate-700"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email Akun</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-slate-700"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-slate-700"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3.5 shadow-xl shadow-blue-500/10"
          >
            {loading ? 'Membuat Identitas...' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs font-medium">
          Sudah terdaftar? <Link to="/login" className="text-primary font-bold hover:underline">Masuk di sini</Link>
        </p>
      </motion.div>
    </div>
  );
}
