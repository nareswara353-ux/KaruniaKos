import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, addDoc, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Room, Booking, Complaint, Payment, User } from '../types';
import { useAdminData } from '../hooks/useAdminData';
import { showToast, showConfirm } from '../lib/toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useAuth } from '../lib/AuthContext';
import { LayoutDashboard, Users, DoorOpen, CreditCard, MessageSquare, Plus, Edit2, Trash2, Check, X, FileDown, Eye, TrendingUp, LogOut, Bell, Filter, Calendar, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, differenceInDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, differenceInHours } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { ConfirmPaymentModal } from '../components/ConfirmPaymentModal';

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const { rooms, bookings, payments, complaints, users, notifications, loading } = useAdminData();
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'rooms' | 'residents' | 'payments' | 'complaints' | 'notifications'>('overview');
  const [currentMonth, setCurrentMonth] = useState(new Date());
                const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingLatePaymentReminders, setSendingLatePaymentReminders] = useState(false);

  const [confirmingBookingId, setConfirmingBookingId] = useState<{ id: string, roomId: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  
  // Filtering States for Payments
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<string>('all');
  const [paymentStartDate, setPaymentStartDate] = useState<string>('');
  const [paymentEndDate, setPaymentEndDate] = useState<string>('');
  const [paymentMinAmount, setPaymentMinAmount] = useState<string>('');
  const [paymentMaxAmount, setPaymentMaxAmount] = useState<string>('');
  
  // Specific Tab for Confirmation
  const [paymentSubTab, setPaymentSubTab] = useState<'pending' | 'rejected'>('pending');

  // Form States
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ number: '', type: '', price: 0, capacity: 1, status: 'available', description: '' });
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);

  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [completingBooking, setCompletingBooking] = useState<{id: string, roomId: string} | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  
  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    try {
      await updateDoc(doc(db, 'rooms', editingRoom.id), {
        number: editingRoom.number,
        type: editingRoom.type,
        price: editingRoom.price,
        status: editingRoom.status,
        description: editingRoom.description
      });
            setEditingRoom(null);
    } catch (error) {
      showToast('Error updating room', 'error');
    }
  };

  const confirmDeleteRoom = async () => {
    if (!deletingRoom) return;
    
    const activeBooking = bookings.find(b => b.roomId === deletingRoom.id && ['confirmed', 'completed', 'pending_payment'].includes(b.status));
    
    if (activeBooking && activeBooking.status === 'confirmed') {
        showToast('Kamar sedang terisi, tidak dapat dihapus!', 'warning');
        setDeletingRoom(null);
        return;
    }

    try {
      await deleteDoc(doc(db, 'rooms', deletingRoom.id));
      
      // cancel pending bookings related to this room
      const pendingBookings = bookings.filter(b => b.roomId === deletingRoom.id);
      for (const b of pendingBookings) {
          if (b.id) {
             await updateDoc(doc(db, 'bookings', b.id), { status: 'cancelled' });
          }
      }

            setDeletingRoom(null);
    } catch (error) {
      showToast('Error deleting room', 'error');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: editingUser.displayName,
        email: editingUser.email,
        role: editingUser.role
      });
            setEditingUser(null);
    } catch (error) {
      showToast('Error updating user', 'error');
    }
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      if (deletingUser.uid) {
        await deleteDoc(doc(db, 'users', deletingUser.uid));
      }

      // Delete related bookings and free up rooms
      const userBookings = bookings.filter(b => b.userUid === deletingUser.uid);
      for (const b of userBookings) {
        if (b.id) {
          await deleteDoc(doc(db, 'bookings', b.id));
          if (b.roomId && b.status === 'confirmed') {
             await updateDoc(doc(db, 'rooms', b.roomId), { status: 'available' });
          }
        }
      }

      // Delete related payments
      const userPayments = payments.filter(p => p.userUid === deletingUser.uid);
      for (const p of userPayments) {
        if (p.id) {
          await deleteDoc(doc(db, 'payments', p.id));
        }
      }

      // Delete related complaints
      const userComplaints = complaints.filter(c => c.userUid === deletingUser.uid);
      for (const c of userComplaints) {
          if (c.id) {
              await deleteDoc(doc(db, 'complaints', c.id));
          }
      }

      // Delete related notifications
      // Let's assume notifications array state isn't available but we can query them or just leave as is, since notifications are user-scoped anyway. Wait, admin can see all complaints.
      // Notifications aren't mapped in admin but let's query and delete to be safe.
      const notificationsSnap = await getDocs(query(collection(db, 'notifications'), where('userUid', '==', deletingUser.uid)));
      for (const n of notificationsSnap.docs) {
          await deleteDoc(doc(db, 'notifications', n.id));
      }

      setDeletingUser(null);
    } catch (error) {
      showToast('Error deleting user', 'error');
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const roomData = { ...newRoom, images: ['https://picsum.photos/seed/room/800/600'] };
      await addDoc(collection(db, 'rooms'), roomData);
      setIsAddingRoom(false);
      // Refresh
      const roomsSnap = await getDocs(collection(db, 'rooms'));
          } catch (error) {
      showToast('Error adding room', 'error');
    }
  };

  const confirmBooking = async (id: string, roomId: string, confirmDate: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    try {
      await updateDoc(doc(db, 'bookings', id), { 
        status: 'confirmed',
        confirmedAt: confirmDate
      });
      await updateDoc(doc(db, 'rooms', roomId), { status: 'occupied' });
      
      // Cancel other pending bookings for the same room
      const otherBookings = bookings.filter(b => b.roomId === roomId && b.id !== id && b.status === 'pending_payment');
      for (const ob of otherBookings) {
         await updateDoc(doc(db, 'bookings', ob.id), { status: 'cancelled' });
         const otherPayment = payments.find(p => p.bookingId === ob.id && p.status === 'pending');
         if (otherPayment) {
           await updateDoc(doc(db, 'payments', otherPayment.id), { status: 'rejected' });
         }
      }

      // Also update payment record if exists
      const relatedPayment = payments.find(p => p.bookingId === id && p.status === 'pending');
      if (relatedPayment) {
        await updateDoc(doc(db, 'payments', relatedPayment.id), {
          status: 'confirmed',
          confirmedAt: new Date().toISOString()
        });
              } else {
              }
      
      // Notify User in-app
      await addDoc(collection(db, 'notifications'), {
        userUid: booking.userUid,
        title: 'Pembayaran Dikonfirmasi',
        message: `Pembayaran untuk pesanan kamar Anda telah berhasil dikonfirmasi. Tanggal masuk Anda tercatat pada ${confirmDate}.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      // Implement automatic email notifications (Simulated Third-Party API Call)
      try {
        const userEmail = users.find(u => u.uid === booking.userUid)?.email;
        if (userEmail) {
           await fetch('https://api.emailjs.com/api/v1.0/email/send', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               service_id: 'default_service',
               template_id: 'payment_confirmed',
               user_id: 'YOUR_PUBLIC_KEY',
               template_params: {
                 to_email: userEmail,
                 message: `Pembayaran untuk kamar berhasil dikonfirmasi.`
               }
             })
           }).catch(() => {}); // silently fail for now
        }
      } catch (e) {
        // Mock fallback
      }

      // Update local state
                  setConfirmingBookingId(null);
      showToast("Pembayaran berhasil dikonfirmasi!", 'success');
    } catch (error: any) {
      showToast("Gagal mengonfirmasi pesanan: " + error.message, 'success');
    }
  };

  const rejectBooking = async (id: string, roomId: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    if (!roomId) {
      showToast("Gagal: Data roomId tidak valid!", 'success');
      return;
    }

    let step = "start";
    try {
      step = "updateRoom";
      const otherActiveBookings = bookings.filter(b => b.roomId === roomId && b.id !== id && (b.status === 'confirmed'));
      if (otherActiveBookings.length === 0) {
        await updateDoc(doc(db, 'rooms', roomId), { status: 'available' });
      }

      step = "updatePayment";
      // Reject payment if exists
      const relatedPayment = payments.find(p => p.bookingId === id && p.status === 'pending');
      if (relatedPayment) {
        await updateDoc(doc(db, 'payments', relatedPayment.id), { status: 'rejected' });
              }
      
      step = "updateBooking";
      await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });

      step = "addNotification";
      // Notify User
      await addDoc(collection(db, 'notifications'), {
        userUid: booking.userUid,
        title: 'Pesanan Dibatalkan',
        message: `Maaf, pesanan Anda untuk Kamar ${rooms.find(r => r.id === roomId)?.number} telah dibatalkan oleh Admin.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      step = "setState";
      // Update local state
            if (otherActiveBookings.length === 0) {
              }
      showToast("Data berhasil dibatalkan!", 'success');
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal (${step}, 'success'): ` + error.message);
    }
  };

  const deleteRejectedBooking = async (id: string, paymentId?: string) => {
    try {
      if (paymentId) {
        // Hapus payment history jika ada
        await deleteDoc(doc(db, 'payments', paymentId));
              }
      await deleteDoc(doc(db, 'bookings', id));
            showToast("Data berhasil dihapus!", 'success');
    } catch (error: any) {
      showToast("Gagal menghapus data: " + error.message, 'success');
    }
  };

  const resetAllPendingBookings = async () => {
    try {
      const pBookings = bookings.filter(b => b.status === 'pending_payment');
      for (const booking of pBookings) {
        const relatedPayment = payments.find(p => p.bookingId === booking.id && p.status === 'pending');
        if (relatedPayment) {
          await deleteDoc(doc(db, 'payments', relatedPayment.id));
        }
        await deleteDoc(doc(db, 'bookings', booking.id));

        // Notify User
        await addDoc(collection(db, 'notifications'), {
          userUid: booking.userUid,
          title: 'Pesanan Ditolak',
          message: `Maaf, pesanan Anda untuk Kamar ${rooms.find(r => r.id === booking.roomId)?.number} telah ditolak oleh Admin.`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }

                  
      setIsResetModalOpen(false);
      showToast("Data telah dihapus", 'success');
    } catch (error: any) {
      showToast("Gagal mereset data: " + error.message, 'error');
    }
  };

  const completeBooking = async (id: string, roomId: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    if (!roomId) {
      showToast("Gagal: Data roomId tidak valid!", 'success');
      return;
    }

    let step = "start";
    try {
      step = "updateBooking";
      await updateDoc(doc(db, 'bookings', id), { 
        status: 'completed',
      });
      step = "updateRoom";
      await updateDoc(doc(db, 'rooms', roomId), { status: 'available' });

      step = "addNotification";
      // Notify User
      await addDoc(collection(db, 'notifications'), {
        userUid: booking.userUid,
        title: 'Masa Sewa Selesai',
        message: `Masa sewa Anda untuk Kamar ${rooms.find(r => r.id === roomId)?.number} telah selesai. Kamar kini kembali tersedia.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      step = "setState";
                  showToast("Masa sewa ditandai selesai.", 'success');
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal (${step}, 'success'): ` + error.message);
    }
  };

  const resolveComplaint = async (id: string) => {
    const note = prompt("Masukkan catatan penyelesaian:");
    if (!note) return;
    try {
      await updateDoc(doc(db, 'complaints', id), { status: 'resolved', adminNote: note });
      
      const complaint = complaints.find(c => c.id === id);
      if (complaint) {
         await addDoc(collection(db, 'notifications'), {
           userUid: complaint.userUid,
           title: 'Keluhan Telah Diselesaikan',
           message: `Keluhan Anda "${complaint.title}" telah diselesaikan. Catatan admin: ${note}`,
           read: false,
           createdAt: new Date().toISOString()
         });
      }

          } catch (error) {
      showToast("Gagal menyelesaikan keluhan", 'error');
    }
  };

  const downloadReport = () => {
    const doc = new jsPDF();
    doc.text('Karunia Kos - Laporan Pendapatan', 14, 15);
    doc.text(`Dibuat pada: ${format(new Date(), 'PPP')}`, 14, 25);

    const confirmedPayments = payments.filter(p => p.status === 'confirmed');

    const data = confirmedPayments.map(p => {
      const booking = bookings.find(b => b.id === p.bookingId);
      const room = rooms.find(r => r.id === booking?.roomId);
      return [
        p.id.slice(0, 8),
        users.find(u => u.uid === p.userUid)?.displayName || p.userUid.slice(0, 8),
        room ? room.number : 'N/A',
        'Rp ' + p.amount.toLocaleString(),
        p.confirmedAt ? format(new Date(p.confirmedAt), 'yyyy-MM-dd') : format(new Date(p.createdAt), 'yyyy-MM-dd')
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['ID Transaksi', 'Penghuni', 'Kamar', 'Nominal', 'Tanggal']],
      body: data,
    });

    const total = confirmedPayments.reduce((acc, curr) => acc + curr.amount, 0);

    doc.text(`Total Pendapatan: Rp ${total.toLocaleString()}`, 14, (doc as any).lastAutoTable.finalY + 15);
    doc.save('laporan-karunia-kos.pdf');
  };

  const sendDueReminders = async () => {
    setSendingReminders(true);
    let count = 0;
    try {
      const activeBookings = bookings.filter(b => b.status === 'confirmed');
      const today = new Date();

      for (const booking of activeBookings) {
        const checkInDate = new Date(booking.startDate);
        const endDate = addMonths(checkInDate, booking.durationMonths);
        const daysToDue = differenceInDays(endDate, today);

        // Notify if due within 7 days
        if (daysToDue <= 7 && daysToDue >= 0) {
          // Check if notification already sent recently (optional improvement)
          await addDoc(collection(db, 'notifications'), {
            userUid: booking.userUid,
            title: 'Pengingat Pembayaran',
            message: `Masa sewa Anda untuk kamar ${rooms.find(r => r.id === booking.roomId)?.number || ''} akan berakhir dlm ${daysToDue} hari (${format(endDate, 'dd MMM yyyy')}). Silakan lakukan perpanjangan.`,
            read: false,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      showToast("Otomatisasi pengingat berhasil dikirim.", 'success');
    } catch (error) {
      console.error("Error sending reminders:", error);
      showToast("Gagal mengirim pengingat", 'error');
    } finally {
      setSendingReminders(false);
    }
  };

  const sendLatePaymentReminders = async () => {
    setSendingLatePaymentReminders(true);
    let count = 0;
    try {
      const pendingBookings = bookings.filter(b => b.status === 'pending_payment');
      const today = new Date();

      for (const booking of pendingBookings) {
        const createdAt = new Date(booking.createdAt);
        const daysSinceCreated = differenceInDays(today, createdAt);

        // Notify if created more than 3 days ago
        if (daysSinceCreated > 3) {
          await addDoc(collection(db, 'notifications'), {
            userUid: booking.userUid,
            title: 'Pembayaran Terlambat',
            message: `Pesanan kamar ${rooms.find(r => r.id === booking.roomId)?.number || ''} Anda belum dibayar selama lebih dari 3 hari. Mohon segera selesaikan pembayaran.`,
            read: false,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      showToast("Berhasil mengirim notifikasi keterlambatan", 'success');
    } catch (error) {
      console.error("Error sending payment reminders:", error);
      showToast("Gagal mengirim pengingat pembayaran", 'error');
    } finally {
      setSendingLatePaymentReminders(false);
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

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Mengakses Pusat Kendali...</div>;

  // --- Calendar Logic ---
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(booking => {
      if (booking.status !== 'confirmed') return false;
      const start = new Date(booking.startDate);
      const end = addMonths(start, booking.durationMonths);
      return isWithinInterval(date, { start, end });
    });
  };

  const currentMtdMonth = new Date().getMonth();
  const currentMtdYear = new Date().getFullYear();
  const totalRevenue = payments.filter(p => {
    if (p.status !== 'confirmed') return false;
    const dateToUse = p.confirmedAt ? new Date(p.confirmedAt) : new Date(p.createdAt);
    return dateToUse.getMonth() === currentMtdMonth && dateToUse.getFullYear() === currentMtdYear;
  }).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-10">
      {/* Admin Sidebar Navigation */}
      <aside className="lg:w-64 shrink-0 flex flex-col space-y-1">
        <div className="p-4 mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Manajemen</p>
        </div>
        {[
          { id: 'overview', icon: LayoutDashboard, label: 'Ringkasan' },
          { id: 'calendar', icon: Calendar, label: 'Kalender Booking' },
          { id: 'rooms', icon: DoorOpen, label: 'Manajemen Kamar' },
          { id: 'residents', icon: Users, label: 'Penghuni' },
          { id: 'payments', icon: CreditCard, label: 'Pendapatan & Bayar' },
          { id: 'complaints', icon: MessageSquare, label: 'Keluhan' },
          { id: 'notifications', icon: Bell, label: 'Notifikasi' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`w-full flex items-center space-x-3 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id 
              ? 'bg-blue-50 text-primary border border-blue-100 shadow-sm' 
              : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent'
            }`}
          >
            <tab.icon className="w-5 h-5 shadow-sm" />
            <span>{tab.label}</span>
          </button>
        ))}
        
        <div className="pt-8 mt-4 border-t border-slate-100 space-y-1">
          <button 
            onClick={downloadReport}
            className="w-full flex items-center space-x-3 px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900 transition-all border border-transparent"
          >
            <FileDown className="w-5 h-5" />
            <span>Ekspor Laporan</span>
          </button>
          
          <button 
            onClick={logout}
            className="w-full flex items-center space-x-3 px-6 py-3.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all border border-transparent"
          >
            <LogOut className="w-5 h-5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Section */}
      <main className="flex-1 min-w-0 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-minimal p-6 flex flex-col justify-between h-32">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                    <TrendingUp className="w-3 h-3 text-success" />
                    Pendapatan (MTD)
                  </span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">Rp {totalRevenue.toLocaleString()}</p>
                </div>
                <div className="card-minimal p-6 flex flex-col justify-between h-32">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Tingkat Penghuni</span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{rooms.length > 0 ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100) : 0}%</p>
                </div>
                <div className="card-minimal p-6 flex flex-col justify-between h-32">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Menunggu Bayar</span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{bookings.filter(b => b.status === 'pending_payment').length}</p>
                </div>
              </div>

              <div className="bg-blue-600 rounded-3xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl shadow-blue-200">
                <div className="space-y-2 text-center md:text-left">
                   <h3 className="text-xl font-bold">Otomatisasi Pengingat</h3>
                   <p className="text-blue-100 text-sm max-w-md">Kirim notifikasi otomatis ke penghuni yang masa sewanya akan berakhir dlm 7 hari ke depan.</p>
                </div>
                <button 
                  onClick={sendDueReminders}
                  disabled={sendingReminders}
                  className="bg-white text-blue-600 px-8 py-3.5 rounded-2xl font-bold hover:bg-blue-50 transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {sendingReminders ? 'Mengirim...' : 'Kirim Pengingat Sekarang'}
                </button>
              </div>

              <div className="bg-amber-500 rounded-3xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl shadow-amber-200">
                <div className="space-y-2 text-center md:text-left">
                   <h3 className="text-xl font-bold">Pengingat Keterlambatan</h3>
                   <p className="text-amber-100 text-sm max-w-md">Kirim notifikasi otomatis ke penghuni dengan pesanan pending lebih dari 3 hari.</p>
                </div>
                <button 
                  onClick={sendLatePaymentReminders}
                  disabled={sendingLatePaymentReminders}
                  className="bg-white text-amber-600 px-8 py-3.5 rounded-2xl font-bold hover:bg-amber-50 transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {sendingLatePaymentReminders ? 'Mengirim...' : 'Kirim Pengingat Pembayaran'}
                </button>
              </div>

              <div className="card-minimal overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight">Arus Pendapatan Terbaru</h3>
                  <button className="text-[10px] font-bold text-primary uppercase tracking-widest">Detail</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-50">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ref ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penghuni</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm font-medium">
                      {payments.filter(p => p.status === 'confirmed').sort((a,b) => {
                        const dateA = new Date(a.confirmedAt || a.createdAt).getTime();
                        const dateB = new Date(b.confirmedAt || b.createdAt).getTime();
                        return dateB - dateA;
                      }).slice(0, 5).map(payment => (
                        <tr key={payment.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">#{payment.id.slice(0, 8).toUpperCase()}</td>
                          <td className="px-6 py-4 text-slate-700">{users.find(u => u.uid === payment.userUid)?.displayName || `usr_${payment.userUid.slice(0, 6)}`}</td>
                          <td className="px-6 py-4 text-right font-bold text-success">Rp {payment.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-800">Kalender Kamar</h2>
                <div className="flex items-center space-x-4">
                  <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  <span className="text-lg font-bold text-slate-700 w-32 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                  <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                  {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day, idx) => (
                    <div key={idx} className="py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-l border-t border-slate-100">
                  {calendarDays.map((day, idx) => {
                    const dayBookings = getBookingsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <div key={idx} className={`min-h-30 p-2 border-r border-b border-slate-100 transition-colors hover:bg-slate-50 ${!isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'bg-white text-slate-700'}`}>
                        <div className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full mb-2 ${isToday ? 'bg-primary text-white' : ''}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayBookings.slice(0, 3).map((b, bIdx) => (
                            <div key={bIdx} className="text-[10px] p-1 rounded bg-blue-50 text-blue-700 font-medium truncate" title={`Kamar ${rooms.find(r => r.id === b.roomId)?.number} - ${users.find(u => u.uid === b.userUid)?.displayName}`}>
                              K.{rooms.find(r => r.id === b.roomId)?.number}
                            </div>
                          ))}
                          {dayBookings.length > 3 && (
                            <div className="text-[10px] text-slate-500 font-bold px-1">+{dayBookings.length - 3} lagi</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'rooms' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Inventaris Kamar</h2>
                <button 
                  onClick={() => setIsAddingRoom(true)}
                  className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kamar Baru</span>
                </button>
              </div>

              {isAddingRoom && (
                <form onSubmit={handleAddRoom} className="bg-white p-8 rounded-3xl border-2 border-primary/20 shadow-xl grid grid-cols-2 gap-6">
                  <input placeholder="Nomor Kamar (misal: 101)" required className="bg-slate-50 border-none rounded-xl p-4" onChange={e => setNewRoom({...newRoom, number: e.target.value})} />
                  <input placeholder="Tipe (misal: Single Standard)" required className="bg-slate-50 border-none rounded-xl p-4" onChange={e => setNewRoom({...newRoom, type: e.target.value})} />
                  <input placeholder="Harga Bulanan" type="number" required className="bg-slate-50 border-none rounded-xl p-4" onChange={e => setNewRoom({...newRoom, price: parseInt(e.target.value)})} />
                  <input placeholder="Kapasitas (Orang)" type="number" required min="1" className="bg-slate-50 border-none rounded-xl p-4" onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})} />
                  <select className="bg-slate-50 border-none rounded-xl p-4 col-span-2" onChange={e => setNewRoom({...newRoom, status: e.target.value as any})} >
                    <option value="available">Tersedia</option>
                    <option value="maintenance">Perbaikan</option>
                  </select>
                  <textarea placeholder="Deskripsi" className="col-span-2 bg-slate-50 border-none rounded-xl p-4" rows={2} onChange={e => setNewRoom({...newRoom, description: e.target.value})} />
                  <div className="col-span-2 flex justify-end space-x-4">
                    <button type="button" onClick={() => setIsAddingRoom(false)} className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Batal</button>
                    <button type="submit" className="bg-primary text-white font-bold px-8 py-3 rounded-xl shadow-lg">Simpan Kamar</button>
                  </div>
                </form>
              )}

              {editingRoom && (
                <form onSubmit={handleUpdateRoom} className="bg-white p-8 rounded-3xl border-2 border-amber-500/20 shadow-xl grid grid-cols-2 gap-6">
                  <input placeholder="Nomor Kamar" required className="bg-slate-50 border-none rounded-xl p-4" value={editingRoom.number} onChange={e => setEditingRoom({...editingRoom, number: e.target.value})} />
                  <input placeholder="Tipe" required className="bg-slate-50 border-none rounded-xl p-4" value={editingRoom.type} onChange={e => setEditingRoom({...editingRoom, type: e.target.value})} />
                  <input placeholder="Harga Bulanan" type="number" required className="bg-slate-50 border-none rounded-xl p-4" value={editingRoom.price} onChange={e => setEditingRoom({...editingRoom, price: parseInt(e.target.value)})} />
                  <input placeholder="Kapasitas (Orang)" type="number" required min="1" className="bg-slate-50 border-none rounded-xl p-4" value={editingRoom.capacity || 1} onChange={e => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value)})} />
                  <select className="bg-slate-50 border-none rounded-xl p-4 col-span-2" value={editingRoom.status} onChange={e => setEditingRoom({...editingRoom, status: e.target.value as any})} >
                    <option value="available">Tersedia</option>
                    <option value="maintenance">Perbaikan</option>
                  </select>
                  <textarea placeholder="Deskripsi" className="col-span-2 bg-slate-50 border-none rounded-xl p-4" rows={2} value={editingRoom.description || ''} onChange={e => setEditingRoom({...editingRoom, description: e.target.value})} />
                  <div className="col-span-2 flex justify-end space-x-4">
                    <button type="button" onClick={() => setEditingRoom(null)} className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Batal</button>
                    <button type="submit" className="bg-amber-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg">Update Kamar</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {rooms.map((room) => (
                  <div key={room.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="bg-slate-800 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm">
                        {room.number}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        room.status === 'available' ? 'bg-green-100 text-green-600' :
                        room.status === 'occupied' && bookings.find(b => b.roomId === room.id && b.status === 'confirmed' && b.willRenew === false) ? 'bg-orange-100 text-orange-600' :
                        room.status === 'occupied' ? 'bg-blue-100 text-blue-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {room.status === 'available' ? 'Tersedia' : room.status === 'occupied' && bookings.find(b => b.roomId === room.id && b.status === 'confirmed' && b.willRenew === false) ? 'Akan Kosong' : room.status === 'occupied' ? 'Terisi' : 'Perbaikan'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{room.type} • {room.capacity || 1} ORG</p>
                      <h3 className="text-lg font-bold text-slate-800 italic">Rp {room.price.toLocaleString()}/bln</h3>
                      {room.status === 'occupied' && (
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-2 bg-blue-50 px-2 py-1 inline-block rounded">
                          PENGHUNI: {users.find(u => u.uid === bookings.find(b => b.roomId === room.id && b.status === 'confirmed')?.userUid)?.displayName || 'TIDAK DIKETAHUI'}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                       <button 
                         disabled={room.status === 'occupied'}
                         onClick={async () => {
                           if (room.status === 'occupied') return;
                           const newStatus = room.status === 'available' ? 'maintenance' : 'available';
                           try {
                             await updateDoc(doc(db, 'rooms', room.id), { status: newStatus });
                           } catch (err) {
                             console.error("Gagal", err);
                           }
                         }}
                         className={`flex-1 min-w-30 font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl flex items-center justify-center transition-colors ${
                           room.status === 'occupied' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
                           room.status === 'available' ? 'bg-amber-50 hover:bg-amber-100 text-amber-600' :
                           'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                         }`}
                       >
                         {room.status === 'available' ? 'Perbaikan' : 'Tersedia'}
                       </button>
                       <button onClick={() => {
                          setEditingRoom(room);
                          setIsAddingRoom(false);
                       }} className="w-12 bg-slate-50 hover:bg-slate-100 py-3 rounded-xl text-slate-600 font-bold flex items-center justify-center transition-colors">
                        <Edit2 className="w-4 h-4" />
                       </button>
                       <button onClick={() => setDeletingRoom(room)} className="w-12 bg-red-50 hover:bg-red-100 py-3 rounded-xl text-red-600 font-bold flex items-center justify-center transition-colors">
                        <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

           {activeTab === 'payments' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
               
               <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                 <div className="flex bg-slate-100 p-1 rounded-xl">
                   <button 
                     onClick={() => setPaymentSubTab('pending')}
                     className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${paymentSubTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     Menunggu Konfirmasi
                   </button>
                   <button 
                     onClick={() => setPaymentSubTab('rejected')}
                     className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${paymentSubTab === 'rejected' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     Ditolak / Dibatalkan
                   </button>
                 </div>
                 
                 {paymentSubTab === 'pending' && bookings.filter(b => b.status === 'pending_payment').length > 0 && (
                   <button 
                     onClick={() => setIsResetModalOpen(true)}
                     className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-red-100"
                     title="Batalkan/Reset semua pesanan yang menunggu konfirmasi"
                   >
                     <Trash2 className="w-4 h-4" />
                     Reset Semua
                   </button>
                 )}
               </div>

               {paymentSubTab === 'pending' ? (
                 <div className="space-y-4">
                   {bookings.filter(b => b.status === 'pending_payment').length === 0 ? (
                     <p className="text-slate-400 text-center py-12 font-medium bg-slate-50 rounded-3xl border border-dashed border-slate-200">Tidak ada pembayaran yang perlu dikonfirmasi saat ini.</p>
                   ) : (
                     bookings.filter(b => b.status === 'pending_payment').map(booking => {
                       const resident = users.find(u => u.uid === booking.userUid);
                       const paymentProof = payments.find(p => p.bookingId === booking.id && p.status === 'pending')?.proofUrl || booking.proofUrl;
                       
                       return (
                        <div key={booking.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8">
                          <div className="flex items-center space-x-6">
                             <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-primary font-bold text-xl uppercase shadow-inner">
                               {resident?.displayName?.[0] || '?' }
                             </div>
                             <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Penghuni / Resident</span>
                               </div>
                               <p className="font-bold text-xl text-slate-900 tracking-tight">{resident?.displayName || `User_${booking.userUid.slice(0, 6)}`}</p>
                               <p className="text-xs text-slate-500 font-medium">Memesan Kamar {rooms.find(r => r.id === booking.roomId)?.number || '?'}</p>
                             </div>
                          </div>

                          <div className="flex flex-col md:items-end space-y-4">
                            <div className="text-right">
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tagihan</span>
                               <p className="font-black text-2xl text-slate-900 tracking-tighter">Rp {booking.totalPrice.toLocaleString()}</p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              {paymentProof ? (
                                paymentProof === 'paid_via_qr' ? (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-4 py-2 flex items-center gap-1.5 rounded-xl border border-blue-100 uppercase tracking-widest"><Check className="w-3.5 h-3.5" />QR IS SCANNED</span>
                                ) : (
                                  <button 
                                    onClick={() => setPreviewImage(paymentProof)} 
                                    className="flex items-center gap-2 text-xs font-bold text-primary bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all"
                                  >
                                    <Eye className="w-4 h-4" />
                                    LIHAT BUKTI TRANSFER
                                  </button>
                                )
                              ) : (
                                <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">BELUM UNGGAH BUKTI</span>
                              )}

                              <div className="flex gap-2">
                                <button 
                                  onClick={() => confirmBooking(booking.id, booking.roomId, new Date().toISOString())}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all shadow-lg shadow-emerald-100"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Konfirmasi</span>
                                </button>
                                <button 
                                  onClick={() => rejectBooking(booking.id, booking.roomId)} 
                                  className="bg-white border border-slate-200 p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                                  title="Tolak Pesanan"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                       );
                     })
                   )}
                 </div>
               ) : (
                 <div className="space-y-4">
                   {bookings.filter(b => b.status === 'cancelled').length === 0 ? (
                     <p className="text-slate-400 text-center py-12 font-medium bg-slate-50 rounded-3xl border border-dashed border-slate-200">Tidak ada pesanan yang ditolak atau dibatalkan.</p>
                   ) : (
                     bookings.filter(b => b.status === 'cancelled').map(booking => {
                       const resident = users.find(u => u.uid === booking.userUid);
                       const paymentProofId = payments.find(p => p.bookingId === booking.id && p.status === 'rejected')?.id;
                       
                       return (
                        <div key={booking.id} className="bg-red-50/30 p-8 rounded-3xl border border-red-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8 opacity-80">
                          <div className="flex items-center space-x-6">
                             <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-500 font-bold text-xl uppercase">
                               {resident?.displayName?.[0] || '?' }
                             </div>
                             <div className="space-y-1">
                               <p className="font-bold text-xl text-slate-800">{resident?.displayName || `User_${booking.userUid.slice(0, 6)}`}</p>
                               <p className="text-xs text-red-400 font-bold uppercase tracking-widest">Kamar {rooms.find(r => r.id === booking.roomId)?.number || '?'} • Dibatalkan</p>
                             </div>
                          </div>

                          <div className="flex flex-col md:items-end space-y-4">
                            <div className="text-right">
                               <p className="font-black text-xl text-slate-800 line-through decoration-red-400 decoration-2">Rp {booking.totalPrice.toLocaleString()}</p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => deleteRejectedBooking(booking.id, paymentProofId)}
                                className="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
                                title="Hapus Data Menyeluruh"
                              >
                                <Trash2 className="w-4 h-4" />
                                Hapus Permanen
                              </button>
                            </div>
                          </div>
                        </div>
                       );
                     })
                   )}
                 </div>
               )}

                <h2 className="text-2xl font-bold text-slate-800 pt-8 mt-8 border-t border-slate-100">Riwayat Transaksi</h2>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-end mb-4 transition-colors">
                  <div className="flex-1 space-y-1 w-full">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                    <select 
                      value={paymentFilterStatus} 
                      onChange={e => setPaymentFilterStatus(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                    >
                      <option value="all" className="dark:bg-slate-800">Semua Status</option>
                      <option value="confirmed" className="dark:bg-slate-800">Berhasil</option>
                      <option value="pending" className="dark:bg-slate-800">Menunggu Review</option>
                      <option value="rejected" className="dark:bg-slate-800">Ditolak</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1 w-full">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dari Tanggal</label>
                    <input 
                      type="date" 
                      value={paymentStartDate} 
                      onChange={e => setPaymentStartDate(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                    />
                  </div>
                  <div className="flex-1 space-y-1 w-full">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sampai Tanggal</label>
                    <input 
                      type="date" 
                      value={paymentEndDate} 
                      onChange={e => setPaymentEndDate(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                    />
                  </div>
                  <div className="flex-1 space-y-1 w-full flex gap-2">
                    <div className="w-1/2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min. Harga</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={paymentMinAmount} 
                        onChange={e => setPaymentMinAmount(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max. Harga</label>
                      <input 
                        type="number" 
                        placeholder="Maks"
                        value={paymentMaxAmount} 
                        onChange={e => setPaymentMaxAmount(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredPayments.length === 0 ? (
                    <p className="text-slate-400 text-center py-12">Pencarian tidak menemukan transaksi yang cocok.</p>
                  ) : (
                    filteredPayments.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(payment => (
                      <div key={payment.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-6 opacity-80">
                         <div className="flex items-center space-x-4">
                           <div className={`p-2 rounded-xl border ${payment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : payment.status === 'pending' ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                              <CreditCard className="w-5 h-5" />
                           </div>
                           <div>
                             <p className="font-bold text-slate-800">Rp {payment.amount.toLocaleString()}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{users.find(u => u.uid === payment.userUid)?.displayName || 'User'}</p>
                           </div>
                         </div>
                         <div className="text-right">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${payment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : payment.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                             {payment.status === 'confirmed' ? 'Berhasil' : payment.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                           </span>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{format(new Date(payment.createdAt), 'dd MMM yyyy')}</p>
                         </div>
                      </div>
                    ))
                  )}
                </div>

               <h2 className="text-2xl font-bold text-slate-800 pt-8 mt-8 border-t border-slate-100">Pesanan Aktif (Berjalan)</h2>
               <div className="space-y-4">
                 {bookings.filter(b => b.status === 'confirmed').length === 0 ? (
                   <p className="text-slate-400 text-center py-12">Belum ada penyewa aktif saat ini.</p>
                 ) : (
                   bookings.filter(b => b.status === 'confirmed').map(booking => (
                     <div key={booking.id} className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm flex items-center justify-between gap-6">
                       <div className="space-y-1">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kamar & Penghuni</span>
                         <p className="font-bold tracking-widest text-sm text-slate-800">Kamar {rooms.find(r => r.id === booking.roomId)?.number} • {users.find(u => u.uid === booking.userUid)?.displayName || booking.userUid.slice(0, 8)}</p>
                       </div>
                       <div className="space-y-1">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Masa Sewa</span>
                         <p className="font-bold text-slate-800">{booking.durationMonths} Bulan</p>
                       </div>
                       <div className="flex space-x-3">
                         <button 
                          onClick={() => setCompletingBooking({id: booking.id, roomId: booking.roomId})}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold flex items-center space-x-2 transition-all"
                        >
                           <Check className="w-5 h-5" />
                           <span>Tandai Selesai</span>
                         </button>
                         <button 
                          onClick={() => rejectBooking(booking.id, booking.roomId)}
                          className="bg-white border border-slate-200 text-red-500 hover:bg-red-50 px-6 py-3 rounded-2xl font-bold flex items-center space-x-2 transition-all"
                        >
                           <X className="w-5 h-5" />
                           <span>Batalkan</span>
                         </button>
                       </div>
                     </div>
                   ))
                 )}
               </div>
            </motion.div>
          )}

          {activeTab === 'complaints' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
               <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-slate-800">Keluhan Penghuni</h2>
                 <button 
                   onClick={async () => {
                     // Trigger a re-fetch or visual refresh feedback
                     const complaintsSnap = await getDocs(collection(db, 'complaints'));
                                          showToast("Memuat ulang keluhan...", 'success');
                   }}
                   className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl transition-colors font-bold text-sm"
                 >
                   <RefreshCw className="w-4 h-4" />
                   <span>Refresh</span>
                 </button>
               </div>
               <div className="space-y-4">
                 {complaints.length === 0 ? (
                   <p className="text-slate-400 text-center py-12">Semua aman. Belum ada keluhan.</p>
                 ) : (
                   complaints.sort((a, b) => a.status === 'pending' ? -1 : 1).map(complaint => (
                     <div key={complaint.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                       <div className="flex justify-between items-center">
                         <div className="flex items-center space-x-3">
                           <div className={`p-2 rounded-xl ${complaint.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                             <MessageSquare className="w-5 h-5" />
                           </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                               <h3 className="font-bold text-slate-800">{complaint.title}</h3>
                               {complaint.status === 'pending' && differenceInHours(new Date(), new Date(complaint.createdAt)) > 48 && (
                                 <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-red-100 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Urgent
                                 </span>
                               )}
                            </div>
                         </div>
                         <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            complaint.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                         }`}>
                           {complaint.status === 'pending' ? 'Menunggu' : 'Selesai'}
                         </span>
                       </div>
                       <p className="text-slate-500 text-sm pl-12">{complaint.description}</p>
                       <div className="flex justify-between items-center pl-12 pt-4">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PENGHUNI: {users.find(u => u.uid === complaint.userUid)?.displayName || complaint.userUid.slice(0, 8)}</p>
                          {complaint.status === 'pending' && (
                            <button 
                              onClick={() => resolveComplaint(complaint.id)}
                              className="text-xs font-bold uppercase tracking-widest bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-900 transition-all"
                            >
                              Tandai Selesai
                            </button>
                          )}
                       </div>
                     </div>
                   ))
                 )}
               </div>
            </motion.div>
          )}

          {activeTab === 'residents' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
               <h2 className="text-2xl font-bold text-slate-800">Direktori Penghuni</h2>

               {editingUser && (
                <form onSubmit={handleUpdateUser} className="bg-white p-8 rounded-3xl border-2 border-amber-500/20 shadow-xl grid grid-cols-2 gap-6 mb-6">
                  <input placeholder="Nama" required className="bg-slate-50 border-none rounded-xl p-4" value={editingUser.displayName} onChange={e => setEditingUser({...editingUser, displayName: e.target.value})} />
                  <input placeholder="Email" type="email" required className="bg-slate-50 border-none rounded-xl p-4" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                  <select className="col-span-2 bg-slate-50 border-none rounded-xl p-4" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} >
                    <option value="user">Penghuni</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="col-span-2 flex justify-end space-x-4">
                    <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Batal</button>
                    <button type="submit" className="bg-amber-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg">Update Penghuni</button>
                  </div>
                </form>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {users.map(u => (
                    <div key={u.uid} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-6">
                       <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-bold text-xl uppercase tracking-widest shadow-inner">
                         {u.displayName?.[0] || '?' }
                       </div>
                       <div className="flex-1 space-y-1">
                          <h4 className="font-bold text-slate-800">{u.displayName}</h4>
                          <p className="text-xs text-slate-400">{u.email}</p>
                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded bg-blue-50 uppercase tracking-widest">{u.role === 'admin' ? 'Admin' : 'Penghuni'}</span>
                            {bookings.filter(b => b.userUid === u.uid && b.status === 'confirmed').map(b => (
                              <span key={b.id} className="text-[10px] font-bold text-emerald-600 px-2 py-0.5 rounded bg-emerald-50 uppercase tracking-widest mt-1 block w-fit">
                                Kamar {rooms.find(r => r.id === b.roomId)?.number}
                              </span>
                            ))}
                          </div>
                       </div>
                       <div className="flex flex-col space-y-2">
                          <button onClick={() => setEditingUser(u)} className="text-slate-400 hover:text-slate-600"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeletingUser(u)} className="text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}
          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-800">Notifikasi Admin</h2>
              
              <div className="space-y-4">
                {notifications.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 text-slate-500 rounded-3xl border border-slate-100 font-bold uppercase tracking-widest text-sm">
                    Belum ada notifikasi
                  </div>
                ) : (
                  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((notif: any, i: number) => (
                    <motion.div 
                      key={notif.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`p-6 rounded-3xl border transition-all ${notif.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100 shadow-sm'}`}
                    >
                       <h3 className="font-bold text-slate-800">{notif.title}</h3>
                       <p className="text-slate-600 mt-2">{notif.message}</p>
                       <p className="text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">{format(new Date(notif.createdAt), 'dd MMM yyyy HH:mm')}</p>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deletingRoom && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.95 }} 
                animate={{ scale: 1 }} 
                exit={{ scale: 0.95 }} 
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Hapus Kamar {deletingRoom.number}?</h3>
                  <p className="text-slate-500 text-sm">Tindakan ini tidak dapat dibatalkan. Data kamar akan dihapus secara permanen.</p>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    onClick={() => setDeletingRoom(null)} 
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmDeleteRoom} 
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deletingUser && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.95 }} 
                animate={{ scale: 1 }} 
                exit={{ scale: 0.95 }} 
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Hapus Penghuni {deletingUser.displayName}?</h3>
                  <p className="text-slate-500 text-sm">Tindakan ini tidak dapat dibatalkan. Data penghuni akan dihapus secara permanen.</p>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    onClick={() => setDeletingUser(null)} 
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmDeleteUser} 
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isResetModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.95 }} 
                animate={{ scale: 1 }} 
                exit={{ scale: 0.95 }} 
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">apakah yakin ingin menghapus semua data?</h3>
                  <p className="text-slate-500 text-sm">Semua data pesanan yang berstatus menunggu konfirmasi akan dihapus permanen dan kamar akan tersedia kembali.</p>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    onClick={() => setIsResetModalOpen(false)} 
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                  >
                    batal
                  </button>
                  <button 
                    onClick={resetAllPendingBookings} 
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                  >
                    setuju
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {completingBooking && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.95 }} 
                animate={{ scale: 1 }} 
                exit={{ scale: 0.95 }} 
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Selesaikan Masa Sewa?</h3>
                  <p className="text-slate-500 text-sm">Pesanan ini akan ditandai selesai dan kamar akan dikembalikan menjadi tersedia.</p>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    onClick={() => setCompletingBooking(null)} 
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => {
                       completeBooking(completingBooking.id, completingBooking.roomId);
                       setCompletingBooking(null);
                    }} 
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
                  >
                    Ya, Selesaikan
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmPaymentModal 
          isOpen={!!confirmingBookingId}
          onClose={() => setConfirmingBookingId(null)}
          onConfirm={confirmBooking}
          booking={confirmingBookingId ? bookings.find(b => b.id === confirmingBookingId.id) || null : null}
          user={confirmingBookingId ? users.find(u => u.uid === bookings.find(b => b.id === confirmingBookingId.id)?.userUid) || null : null}
          room={confirmingBookingId ? rooms.find(r => r.id === confirmingBookingId.roomId) || null : null}
          paymentRecord={confirmingBookingId ? payments.find(p => p.bookingId === confirmingBookingId.id && p.status === 'pending') || null : null}
        />

        <AnimatePresence>
          {previewImage && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setPreviewImage(null)}
            >
              <motion.div 
                initial={{ scale: 0.95 }} 
                animate={{ scale: 1 }} 
                exit={{ scale: 0.95 }} 
                className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">Pratinjau Bukti Transfer</h3>
                  <button onClick={() => setPreviewImage(null)} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-50 min-h-75">
                  <img src={previewImage} alt="Bukti Transfer" loading="lazy" className="max-w-full rounded-xl object-contain" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {successMessage && (
             <motion.div
               initial={{ opacity: 0, y: 50, scale: 0.9 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: 20, scale: 0.9 }}
               className="fixed bottom-8 right-8 z-50 bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold"
             >
               <div className="bg-white/20 p-1.5 rounded-full">
                 <Check className="w-5 h-5 text-white" />
               </div>
               {successMessage}
             </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
