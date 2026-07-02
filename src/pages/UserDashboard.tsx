import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useUserData } from '../hooks/useUserData';
import { generateReceipt } from '../services/reportService';
import { cancelUserBooking } from '../services/bookingService';
import { showToast, showConfirm } from '../lib/toast';
import { useAuth } from '../lib/AuthContext';
import { Booking, Complaint, Payment, Notification, Room } from '../types';
import { Calendar, MessageSquare, CreditCard, Clock, CheckCircle, AlertCircle, Send, User, Bell, LogOut, Trash2, Filter, Download, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInHours, addMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { QRPaymentModal } from '../components/QRPaymentModal';

export default function UserDashboard() {
  const { user, profile, logout } = useAuth();
              const { bookings, complaints, notifications, payments, rooms, loading } = useUserData(user?.uid);
  const [activeTab, setActiveTab] = useState<'bookings' | 'complaints' | 'notifications' | 'payments' | 'rules'>('bookings');
  const [expandedBookings, setExpandedBookings] = useState<string[]>([]);
  
  // QR Payment State
  const [qrPaymentBooking, setQrPaymentBooking] = useState<Booking | null>(null);
  
  // Filtering States for Payments
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<string>('all');
  const [paymentStartDate, setPaymentStartDate] = useState<string>('');
  const [paymentEndDate, setPaymentEndDate] = useState<string>('');
  const [paymentMinAmount, setPaymentMinAmount] = useState<string>('');
  const [paymentMaxAmount, setPaymentMaxAmount] = useState<string>('');

  // New Complaint State
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (auth.currentUser) {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        showToast('Akun Anda belum diverifikasi. Silakan cek email Anda untuk verifikasi.', 'warning');
        return;
      }
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        userUid: user.uid,
        title: complaintTitle,
        description: complaintDesc,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      await addDoc(collection(db, 'notifications'), {
         userUid: 'admin',
         title: 'Keluhan Baru',
         message: `Penghuni ${user.email} mengirimkan keluhan: ${complaintTitle}`,
         read: false,
         createdAt: new Date().toISOString()
      });

      setComplaintTitle('');
      setComplaintDesc('');
      setShowComplaintForm(false);
      
      const complaintsQ = query(collection(db, 'complaints'), where('userUid', '==', user.uid));
      const complaintsSnap = await getDocs(complaintsQ);
          } catch (error) {
      showToast('Gagal mengirimkan keluhan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    const isConfirmed = await showConfirm('Konfirmasi', 'Apakah Anda yakin?');
    if (!isConfirmed) return;
    try {
      await deleteDoc(doc(db, 'complaints', id));
      
    } catch (error) {
      showToast('Gagal menghapus keluhan', 'error');
    }
  };

  const filteredPayments = useMemo(() => payments.filter(p => {
    let matches = true;
    if (paymentFilterStatus !== 'all' && p.status !== paymentFilterStatus) matches = false;
    if (paymentStartDate && new Date(p.createdAt) < new Date(paymentStartDate)) matches = false;
    if (paymentEndDate) {
      const end = new Date(paymentEndDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(p.createdAt) > end) matches = false;
    }
    if (paymentMinAmount && p.amount < Number(paymentMinAmount)) matches = false;
    if (paymentMaxAmount && p.amount > Number(paymentMaxAmount)) matches = false;
    return matches;
  }), [payments, paymentFilterStatus, paymentStartDate, paymentEndDate, paymentMinAmount, paymentMaxAmount]);

  const cancelBooking = async (bookingId: string) => {
    const isConfirmed = await showConfirm('Batal Pesanan?', 'Apakah anda yakin ingin membatalkan pesanan kamar ini?', 'Ya, Batalkan');
    
    if (isConfirmed) {
      try {
        const pendingPayment = payments.find(p => p.bookingId === bookingId && p.status === 'pending');
        await cancelUserBooking(bookingId, pendingPayment?.id);
        showToast('Pesanan dibatalkan', 'success');
      } catch (err) {
        showToast('Gagal membatalkan pesanan.', 'error');
      }
    }
  };

  const toggleAutoRenew = async (bookingId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        willRenew: !current
      });
    } catch (err) {
      showToast('Gagal memperbarui preferensi sewa.', 'error');
    }
  };

  
  if (loading) return <div className="p-8 text-center">Memuat dashboard...</div>;

  return (
    <div className="flex flex-col md:flex-row gap-10">
      {/* Sidebar Navigation */}
      <aside className="md:w-64 w-full shrink-0 flex flex-col space-y-2">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-blue-100">
            {profile?.displayName?.[0] || 'U'}
          </div>
          <h2 className="font-bold text-slate-900 line-clamp-1">{profile?.displayName || 'Penghuni'}</h2>
          <p className="text-[11px] text-slate-500 font-medium truncate w-full">{user?.email}</p>
        </div>

        {[
          { id: 'bookings', icon: Calendar, label: 'Pesanan Saya' },
          { id: 'payments', icon: CreditCard, label: 'Pembayaran' },
          { id: 'rules', icon: ClipboardList, label: 'Aturan Kos' },
          { id: 'notifications', icon: Bell, label: 'Notifikasi' },
          { id: 'complaints', icon: MessageSquare, label: 'Keluhan' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-3 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id 
                ? 'bg-blue-50 text-primary border border-blue-100' 
                : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent'
            }`}>
            <tab.icon className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}

        <div className="pt-4 mt-2">
           <button 
             onClick={logout}
             className="w-full flex items-center space-x-3 px-6 py-3.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all border border-transparent"
           >
             <LogOut className="w-5 h-5" />
             <span>Keluar</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'bookings' ? (
            <motion.div 
              key="bookings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Riwayat Pesanan</h1>
              </div>
              
              {bookings.length === 0 ? (
                <div className="card-minimal p-16 text-center space-y-4">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                    <CreditCard className="w-10 h-10 text-slate-300" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-400">Tidak ada pesanan aktif</h3>
                    <p className="text-slate-400 text-sm">Temukan kamar impian Anda di katalog kami.</p>
                  </div>
                  <Link to="/" className="inline-block btn-primary">Lihat Kamar</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {bookings.map((booking) => (
                    <motion.div 
                      layout
                      key={booking.id}
                      className="card-minimal p-6 space-y-4 hover:border-slate-300">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kamar & Ref</span>
                          <h3 className="text-sm font-bold text-slate-900 border-b pb-1">Kamar {rooms.find(r => r.id === booking.roomId)?.number || booking.roomId}</h3>
                          <p className="font-mono text-xs font-bold text-slate-500">#{booking.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <motion.span 
                          animate={booking.status === 'pending_payment' ? { scale: [1, 1.05, 1], opacity: [1, 0.8, 1] } : {}}
                          transition={booking.status === 'pending_payment' ? { repeat: Infinity, duration: 2 } : {}}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          booking.status === 'confirmed' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-success dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800' :
                          booking.status === 'pending_payment' ? 'bg-amber-50 dark:bg-amber-900/30 text-warning dark:text-amber-400 border border-amber-100 dark:border-amber-800' :
                          booking.status === 'cancelled' ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-800' :
                          'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700'
                        }`}>
                          {booking.status === 'confirmed' ? 'Confirmed' : booking.status === 'pending_payment' ? 'Pending Payment' : booking.status === 'cancelled' ? 'Cancelled' : booking.status === 'completed' ? 'Completed' : booking.status}
                        </motion.span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-50">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal Masuk</span>
                          <p className="text-sm font-bold text-slate-700">{format(new Date(booking.startDate), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Durasi</span>
                          <p className="text-sm font-bold text-slate-700">{booking.durationMonths} Bulan</p>
                        </div>
                      </div>

                      {/* Timeline Tracker */}
                      {booking.status !== 'cancelled' && (
                        <div className="py-4 w-full px-2">
                          <div className="flex items-center justify-between relative z-0">
                            <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-100 -z-10"></div>
                            <div className="absolute left-0 top-4 h-0.5 bg-primary -z-10 transition-all duration-500" style={{ width: booking.status === 'completed' ? '100%' : booking.status === 'confirmed' ? '100%' : '50%' }}></div>
                            
                            <div className="flex flex-col items-center space-y-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-primary text-white shadow-md shadow-blue-100">1</div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dipesan</span>
                            </div>
                            <div className="flex flex-col items-center space-y-2">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${['pending_payment', 'confirmed', 'completed'].includes(booking.status)? 'bg-primary text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-400'}`}>2</div>
                               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bayar</span>
                            </div>
                            <div className="flex flex-col items-center space-y-2">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${['confirmed', 'completed'].includes(booking.status)? 'bg-primary text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-400'}`}>3</div>
                               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aktif</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-slate-50 pt-4"></div>
                      
                      {booking.status === 'pending_payment' && differenceInHours(new Date(), new Date(booking.createdAt)) > 72 && (
                        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-bold flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Segera bayar! Pesanan ini akan dibatalkan otomatis dalam {Math.max(0, 96 - differenceInHours(new Date(), new Date(booking.createdAt)))} jam.</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Harga</span>
                          <p className="font-bold text-primary text-lg">Rp {booking.totalPrice.toLocaleString()}</p>
                        </div>
                        {booking.status === 'pending_payment' && (
                          <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-3">
                            <button 
                               onClick={() => cancelBooking(booking.id)}
                               className="bg-white border border-red-200 hover:bg-red-50 text-red-500 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer w-full sm:w-auto">
                               Cancel
                            </button>
                            <button 
                               onClick={() => setQrPaymentBooking(booking)}
                               className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-xl text-white font-bold text-sm transition-colors cursor-pointer w-full sm:w-auto text-center">
                               Pay Now (QR)
                            </button>
                          </div>
                        )}
                        {booking.status === 'confirmed' && (
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors w-full sm:w-auto">
                              <input 
                                type="checkbox" 
                                className="rounded text-primary focus:ring-primary w-4 h-4"
                                checked={booking.willRenew !== false} // default true
                                onChange={() => toggleAutoRenew(booking.id, booking.willRenew !== false)}/>
                              <span className="text-xs font-bold text-slate-600">Perpanjang bulan depan</span>
                            </label>
                            <button onClick={() => generateReceipt(booking, rooms.find(r => r.id === booking.roomId), profile?.displayName || user?.email || 'N/A')} className="text-sm font-bold text-slate-600 bg-slate-100 px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors flex items-center space-x-1 w-full sm:w-auto justify-center">
                              <Download className="w-4 h-4 flex-shrink-0" />
                              <span>Download Invoice</span>
                            </button>
                            <Link to="/#rooms" className="text-sm font-bold text-primary hover:text-primary-dark transition-colors px-2 py-2 text-center w-full sm:w-auto">Kamar</Link>
                          </div>
                        )}
                        <button 
                          onClick={() => setExpandedBookings(prev => prev.includes(booking.id) ? prev.filter(id => id !== booking.id) : [...prev, booking.id])}
                          className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors py-2 border-t border-slate-50">
                          {expandedBookings.includes(booking.id) ? (
                            <><ChevronUp className="w-4 h-4"/> Sembunyikan Detail</>
                          ) : (
                            <><ChevronDown className="w-4 h-4"/> Lihat Detail</>
                          )}
                        </button>

                        {expandedBookings.includes(booking.id) && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-slate-50 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Checkout</span>
                                 <span className="text-sm font-bold text-slate-700">
                                   {format(addMonths(new Date(booking.startDate), booking.durationMonths), 'MMM d, yyyy')}
                                 </span>
                               </div>
                               <div>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tgl Konfirmasi</span>
                                 <span className="text-sm font-bold text-slate-700">
                                   {booking.confirmedAt ? format(new Date(booking.confirmedAt), 'MMM d, yyyy HH:mm') : '-'}
                                 </span>
                               </div>
                            </div>
                            <div>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Riwayat Pembayaran</span>
                               {payments.filter(p => p.bookingId === booking.id).length > 0 ? (
                                 <div className="space-y-2">
                                    {payments.filter(p => p.bookingId === booking.id).map(p => (
                                       <div key={p.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${p.status === 'confirmed' ? 'bg-success' : p.status === 'pending' ? 'bg-warning' : 'bg-red-500'}`} />
                                            <span className="text-xs font-bold text-slate-700">Rp {p.amount.toLocaleString()}</span>
                                          </div>
                                          <span className="text-[10px] text-slate-400 font-medium">{format(new Date(p.createdAt), 'dd/MM/yyyy')}</span>
                                       </div>
                                    ))}
                                 </div>
                               ) : (
                                 <p className="text-xs text-slate-400 font-medium italic">Belum ada pembayaran.</p>
                               )}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'payments' ? (
            <motion.div 
              key="payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Riwayat Pembayaran</h1>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                  <select 
                    value={paymentFilterStatus} 
                    onChange={e => setPaymentFilterStatus(e.target.value)}
                    className="w-full border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                    <option value="all">Semua Status</option>
                    <option value="confirmed">Berhasil</option>
                    <option value="pending">Menunggu Review</option>
                    <option value="rejected">Ditolak</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dari Tanggal</label>
                  <input 
                    type="date" 
                    value={paymentStartDate} 
                    onChange={e => setPaymentStartDate(e.target.value)}
                    className="w-full border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"/>
                </div>
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sampai Tanggal</label>
                  <input 
                    type="date" 
                    value={paymentEndDate} 
                    onChange={e => setPaymentEndDate(e.target.value)}
                    className="w-full border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"/>
                </div>
                <div className="flex-1 space-y-1 w-full flex gap-2">
                  <div className="w-1/2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min. Harga</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={paymentMinAmount} 
                      onChange={e => setPaymentMinAmount(e.target.value)}
                      className="w-full border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"/>
                  </div>
                  <div className="w-1/2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max. Harga</label>
                    <input 
                      type="number" 
                      placeholder="Maks"
                      value={paymentMaxAmount} 
                      onChange={e => setPaymentMaxAmount(e.target.value)}
                      className="w-full border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"/>
                  </div>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-4">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                    <CreditCard className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400">Belum ada pembayaran</h3>
                  <p className="text-slate-400 text-sm">Pencarian tidak menemukan transaksi yang cocok.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPayments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(payment => (
                    <div key={payment.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start space-x-6 justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-2xl ${payment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-500' : payment.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-lg">Rp {payment.amount.toLocaleString()}</h4>
                          <span className="text-xs text-slate-500 font-medium tracking-wide">Ref: #{payment.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2 mt-4 sm:mt-0">
                         <span className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap ${
                          payment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          payment.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {payment.status === 'confirmed' ? 'Dikonfirmasi' : payment.status === 'pending' ? 'Menunggu Review' : 'Ditolak'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{format(new Date(payment.createdAt), 'dd MMM yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'notifications' ? (
            <motion.div 
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifikasi</h1>
              </div>

              {notifications.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-4">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                    <Bell className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400">Belum ada notifikasi</h3>
                  <p className="text-slate-400 text-sm">Status pesanan dan pengingat akan muncul di sini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(note => (
                    <div key={note.id} className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start space-x-4 ${!note.read ? 'border-l-4 border-l-primary' : ''}`}>
                      <div className="bg-blue-50 p-2.5 rounded-xl text-primary">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-800">{note.title}</h4>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{format(new Date(note.createdAt), 'dd MMM HH:mm')}</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{note.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'complaints' ? (
            <motion.div 
              key="complaints"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Resolusi</h1>
                <button 
                  onClick={() => setShowComplaintForm(!showComplaintForm)}
                  className="btn-primary flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Ajukan Keluhan</span>
                </button>
              </div>

            <AnimatePresence>
              {showComplaintForm && (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleSubmitComplaint}
                  className="bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-xl space-y-6 overflow-hidden">
                  <h3 className="text-xl font-bold text-slate-800">Apa yang bisa kami bantu?</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Judul / Subjek</label>
                      <input 
                        required
                        value={complaintTitle}
                        onChange={(e) => setComplaintTitle(e.target.value)}
                        placeholder="misal: Keran bocor, AC tidak dingin"
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary-dark transition-all"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Deskripsi Detail</label>
                      <textarea 
                        required
                        rows={4}
                        value={complaintDesc}
                        onChange={(e) => setComplaintDesc(e.target.value)}
                        placeholder="Mohon jelaskan masalah Anda secara detail..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary-dark transition-all resize-none"/>
                    </div>
                    <div className="flex justify-end space-x-4">
                      <button 
                        type="button" 
                        onClick={() => setShowComplaintForm(false)}
                        className="px-6 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-100 transition-all font-bold tracking-widest text-xs uppercase">
                        Batal
                      </button>
                      <button 
                        type="submit"
                        disabled={submitting}
                        className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg inline-flex items-center space-x-2">
                        <Send className="w-4 h-4" />
                        <span>{submitting ? 'Mengirim...' : 'Kirim Keluhan'}</span>
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {complaints.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-4">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-400">Semua terlihat baik!</h3>
                <p className="text-slate-400 text-sm">Tidak ada keluhan aktif atau lama yang ditemukan.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <div key={complaint.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-2xl ${
                        complaint.status === 'pending' ? 'bg-amber-50 text-amber-500' :
                        complaint.status === 'in_progress' ? 'bg-blue-50 text-blue-500' :
                        'bg-green-50 text-green-500'
                      }`}>
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-800 text-lg">{complaint.title}</h3>
                        <p className="text-slate-500 text-sm">{complaint.description}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest pt-2">Diajukan pada {format(new Date(complaint.createdAt), 'PPP')}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-3">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                        complaint.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                        complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {complaint.status === 'pending' ? 'Menunggu' : complaint.status === 'resolved' ? 'Selesai' : complaint.status}
                      </span>
                      {complaint.status === 'pending' && (
                        <button 
                          onClick={() => handleDeleteComplaint(complaint.id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-1"
                          title="Hapus Keluhan">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {complaint.adminNote && (
                        <div className="bg-slate-50 p-3 rounded-xl max-w-xs text-xs italic text-slate-600 border border-slate-100">
                          <span className="font-bold block mb-1">Tanggapan Admin:</span>
                          {complaint.adminNote}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </motion.div>
          ) : activeTab === 'rules' ? (
             <motion.div 
              key="rules"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Aturan Kos Eksplisit</h1>
              </div>
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
                 <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">1. Penggunaan Listrik</h3>
                    <p className="text-slate-600">Sewa sudah termasuk listrik standar (Laptop, HP, Kipas Angin). Membawa elektronik tambahan berdaya besar (diatas 100 Watt) seperti Rice Cooker, Dispenser, atau TV tabung akan dikenakan biaya tambahan sebesar <span className="font-bold text-slate-800">Rp 50.000/bulan</span>.</p>
                 </div>
                 <div className="border-t border-slate-100 pt-6">
                    <h3 className="font-bold text-slate-800 text-lg mb-2">2. Tamu & Jam Malam</h3>
                    <p className="text-slate-600">Tamu lawan jenis dilarang masuk ke dalam kamar. Jam malam gerbang dikunci pada pukul <span className="font-bold text-slate-800">23:00 WIB</span>. Jika ada keperluan mendadak pulang larut malam harap konfirmasi ke Admin.</p>
                 </div>
                 <div className="border-t border-slate-100 pt-6">
                    <h3 className="font-bold text-slate-800 text-lg mb-2">3. Kebersihan</h3>
                    <p className="text-slate-600">Wajib menjaga kebersihan kamar masing-masing dan area umum (pantry, parkiran). Dilarang meninggalkan sampah menumpuk di depan pintu kamar melewati 1x24 jam.</p>
                 </div>
                 <div className="border-t border-slate-100 pt-6">
                    <h3 className="font-bold text-slate-800 text-lg mb-2">4. Fasilitas</h3>
                    <p className="text-slate-600">Penyewa wajib memelihara fasilitas kamar dengan baik. Kerusakan fasilitas akibat kelalaian penyewa (seperti coretan di tembok, kasur sobek) akan dikenakan denda penggantian sesuai dengan nilai kerusakan saat Anda checkout.</p>
                 </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <QRPaymentModal 
        isOpen={!!qrPaymentBooking}
        onClose={() => setQrPaymentBooking(null)}
        booking={qrPaymentBooking}
      />
    </div>
  );
}
