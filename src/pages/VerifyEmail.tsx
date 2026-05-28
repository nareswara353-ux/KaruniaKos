import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { auth } from '../lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { Mail, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function VerifyEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Continuously check if email is verified
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          navigate('/dashboard');
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [navigate]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p>Akses ditolak. Silakan login terlebih dahulu.</p>
        <Link to="/login" className="text-primary mt-4">Ke Halaman Login</Link>
      </div>
    );
  }

  if (user.emailVerified) {
    navigate('/dashboard');
    return null;
  }

  const handleResend = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setMessage('Email verifikasi telah dikirim ulang. Silakan cek kotak masuk atau folder spam Anda.');
      }
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setError('Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mengirim ulang.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-minimal p-10 space-y-8 text-center"
      >
        <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="text-amber-600 w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Verifikasi Email Anda</h1>
        
        <p className="text-slate-600 font-medium">
          Kami telah mengirimkan tautan verifikasi ke email <span className="font-bold">{user.email}</span>.
        </p>
        <p className="text-slate-500 text-sm">
          Silakan klik tautan tersebut untuk mengaktifkan akun Anda agar dapat memesan kamar dan menggunakan semua fitur aplikasi.
        </p>

        {message && (
          <div className="bg-success/10 text-success p-3 rounded-xl text-sm font-medium">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-danger/10 text-danger p-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <button 
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="w-full btn-primary py-3.5"
          >
            {loading ? 'Mengirim Ulang...' : 'Kirim Ulang Email Verifikasi'}
          </button>
          
          <Link to="/dashboard" className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 font-medium text-sm transition-colors py-2">
            Tetap ke Dashboard (Fitur Terbatas) <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
