import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Menu, X, Home, LayoutDashboard, LogOut, ShieldCheck, Bell, Sun, Moon, Bookmark } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [bookmarkedCount, setBookmarkedCount] = React.useState(0);

  React.useEffect(() => {
    const updateBookmarks = () => {
      const b = localStorage.getItem('bookmarkedRooms');
      setBookmarkedCount(b ? JSON.parse(b).length : 0);
    };
    updateBookmarks();
    window.addEventListener('bookmarksUpdated', updateBookmarks);
    return () => window.removeEventListener('bookmarksUpdated', updateBookmarks);
  }, []);

  React.useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors">
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center text-white font-bold w-8 h-8">
              K
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Karunia Kos</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-slate-600 hover:text-primary transition-colors text-sm font-medium">Beranda</Link>
            
            {bookmarkedCount > 0 && (
              <div className="relative group cursor-pointer text-slate-500 hover:text-primary transition-colors">
                <Bookmark className="w-5 h-5 mx-2" />
                <span className="absolute -top-1.5 -right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full pointer-events-none">
                  {bookmarkedCount}
                </span>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 hidden group-hover:block z-60 text-sm text-center">
                   <p className="text-slate-600 font-medium">Ada {bookmarkedCount} kamar yang Anda simpan.</p>
                   <Link to="/#rooms" className="text-primary font-bold hover:underline block mt-2 text-xs">Lihat Kamar</Link>
                </div>
              </div>
            )}
            
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-500 hover:text-primary transition-colors p-1">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {user && (
              <>
                <Link to="/dashboard" className="text-slate-600 hover:text-primary transition-colors text-sm font-medium">Dashboard</Link>
                {isAdmin && (
                  <Link to="/admin" className="text-primary hover:text-primary-dark transition-colors text-sm font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Panel Admin</span>
                  </Link>
                )}
              </>
            )}
            
            {!user ? (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-slate-600 hover:text-primary transition-colors text-sm font-medium">Masuk</Link>
                <Link to="/register" className="btn-primary">
                  Daftar Sekarang
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="relative group">
                  <button className="text-slate-500 hover:text-primary transition-colors relative p-2">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 hidden group-hover:block z-60">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Notifikasi Terbaru</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                        <p className="text-xs font-bold text-slate-800">Selamat datang di Karunia Kos!</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Baru saja</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl space-y-1">
                        <p className="text-xs font-bold text-blue-800">Pengingat Pembayaran</p>
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">2 jam yang lalu</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-slate-600 hover:text-red-600 transition-colors text-sm font-medium">
                  <LogOut className="w-4 h-4" />
                  <span>Keluar</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 md:hidden">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-500 hover:text-primary transition-colors p-2">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* Mobile Menu Toggle */}
            <button className="text-slate-600" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-slate-50 border-b border-slate-200 overflow-hidden">
            <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
              <Link to="/" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-primary font-medium py-2 border-b border-slate-100">Beranda</Link>
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-primary font-medium py-2 border-b border-slate-100">Dashboard</Link>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setIsOpen(false)} className="text-primary-dark font-bold py-2 border-b border-slate-100">Panel Admin</Link>
                  )}
                  <button onClick={() => { handleLogout(); setIsOpen(false); }} className="text-red-600 font-medium py-2 text-left">Keluar</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-primary font-medium py-2 border-b border-slate-100">Masuk</Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="bg-primary text-white px-4 py-2 rounded-lg text-center font-medium">Daftar Sekarang</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
