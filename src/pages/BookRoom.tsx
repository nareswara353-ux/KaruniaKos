import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, updateDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Room } from '../types';
import { Calendar, CreditCard, Shield, ChevronLeft, Check, AlertCircle, Clock, ArrowRight, Bookmark, BookmarkCheck, Users } from 'lucide-react';
import { Player } from '@lottiefiles/react-lottie-player';
import { motion } from 'motion/react';
import { addMonths, format, eachDayOfInterval, isValid, isSameDay } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { showToast } from '../lib/toast';

export default function BookRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [occupiedDates, setOccupiedDates] = useState<Date[]>([]);
  const [parsedSelectedDate, setParsedSelectedDate] = useState<Date>(new Date());

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bookingId || !user || !room) return;
    setProofUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Create a Payment record
        await addDoc(collection(db, 'payments'), {
          bookingId,
          userUid: user.uid,
          amount: room.price * duration,
          status: 'pending',
          proofUrl: base64String,
          createdAt: new Date().toISOString(),
        });

        // Update booking to show payment is being reviewed
        await updateDoc(doc(db, 'bookings', bookingId), {
          proofUrl: base64String
        });
        
        setProofUploaded(true);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      showToast('Gagal mengunggah bukti pembayaran', 'error');
    } finally {
      setProofUploading(false);
    }
  };

  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId) return;
      try {
        const docRef = doc(db, 'rooms', roomId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const roomData = { id: docSnap.id, ...docSnap.data() } as Room;
          if (roomData.status !== 'available' && roomData.status !== 'occupied') {
            showToast('Kamar ini sedang tidak bisa dipesan.', 'info');
            navigate('/');
            return;
          }
          setRoom(roomData);
        } else {
          // Mock if not found
          setRoom({ 
            id: roomId, 
            number: 'MOCK-1', 
            type: 'Kamar Standard', 
            price: 500000, 
            status: 'available', 
            description: 'Ini adalah kamar contoh untuk pengembangan.', 
            images: [] 
          });
        }
        
        // Fetch occupied dates
        const q = query(collection(db, 'bookings'), where('roomId', '==', roomId), where('status', 'in', ['confirmed', 'completed', 'pending_payment']));
        const snaps = await getDocs(q);
        let blocked: Date[] = [];
        snaps.docs.forEach(doc => {
           const data = doc.data();
           const start = new Date(data.startDate);
           const end = addMonths(start, data.durationMonths || 1);
           if (isValid(start) && isValid(end)) {
              blocked = [...blocked, ...eachDayOfInterval({ start, end })];
           }
         });
         setOccupiedDates(blocked);

      } catch (error) {
        console.error("Error fetching room:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomId]);

  const [isBookmarked, setIsBookmarked] = useState(false);

  // Check if room is bookmarked when component mounts or user changes
  useEffect(() => {
    if (!user || !roomId) return;
    
    const checkBookmark = async () => {
      try {
        const q = query(
          collection(db, 'bookmarks'),
          where('userId', '==', user.uid),
          where('roomId', '==', roomId)
        );
        const snapshot = await getDocs(q);
        setIsBookmarked(!snapshot.empty);
      } catch (error) {
        console.error('Error checking bookmark:', error);
      }
    };
    
    checkBookmark();
  }, [user, roomId]);

  const toggleBookmark = async () => {
    if (!user || !roomId || !room) return;
    
    try {
      if (isBookmarked) {
        // Remove bookmark
        const q = query(
          collection(db, 'bookmarks'),
          where('userId', '==', user.uid),
          where('roomId', '==', roomId)
        );
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) {
          await deleteDoc(doc.ref);
        }
        setIsBookmarked(false);
      } else {
        // Add bookmark
        await addDoc(collection(db, 'bookmarks'), {
          userId: user.uid,
          roomId: roomId,
          roomNumber: room.number,
          createdAt: new Date().toISOString()
        });
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      showToast('Gagal mengubah bookmark', 'error');
    }
  };

  const handleBooking = async () => {
    if (!room || !user) return;
    if (auth.currentUser) {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        navigate('/verify-email');
        return;
      }
    }

    setSubmitting(true);
    try {
      const requestedStart = new Date(startDate);
      const requestedEnd = addMonths(requestedStart, duration);
      const requestedInterval = eachDayOfInterval({ start: requestedStart, end: requestedEnd });
      
      const isOverlapping = requestedInterval.some(date => occupiedDates.some(occupied => isSameDay(date, occupied)));
      
      if (isOverlapping) {
        showToast('Durasi dan tanggal yang Anda pilih tumpang tindih dengan pesanan penyewa lain. Silakan ubah tanggal masuk atau durasi kos.', 'warning');
        setSubmitting(false);
        return;
      }

      const totalPrice = room.price * duration;
      const vaNumber = '988' + Math.floor(Math.random() * 9000000000 + 1000000000);
      
      const bookingData = {
        userUid: user.uid,
        roomId: room.id,
        startDate,
        durationMonths: duration,
        totalPrice,
        status: 'pending_payment',
        vaNumber,
        createdAt: new Date().toISOString(),
      };
      
      const docRef = await addDoc(collection(db, 'bookings'), bookingData);
      setBookingId(docRef.id);
      
      // The room status remains 'available' or 'occupied'. Date picker handles scheduling conflicts.
      // Room status is only strictly toggled when admin confirms or cancels the booking explicitly.
      
      // Notify Admin
      await addDoc(collection(db, 'notifications'), {
        userUid: 'admin',
        title: 'Pesanan Kamar Baru',
        message: `${user.displayName} telah memesan kamar ${room.number}`,
        read: false,
        createdAt: new Date().toISOString(),
      });

      setSuccess(true);
    } catch (error) {
      showToast('Pendaftaran gagal. Silakan periksa koneksi Anda.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Menyiapkan kamar Anda...</div>;
  if (!room) return <div className="p-12 text-center text-red-500 font-bold">Kamar tidak ditemukan.</div>;

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-12 shadow-2xl border border-slate-100 text-center space-y-8"
        >
          <div className="mx-auto mb-6 flex justify-center">
             <Player
                autoplay
                keepLastFrame
                src="https://lottie.host/825dc98a-1a8a-4db3-bad9-eddc0f3e69ca/M2e4Bts19u.json"
                style={{ height: '120px', width: '120px' }}
             />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-slate-800 tracking-tight">Pesanan Berhasil!</h1>
            <p className="text-slate-500">Reservasi Anda untuk Kamar {room.number} hampir selesai.</p>
          </div>
          
          <div className="bg-slate-50 p-8 rounded-2xl space-y-6 text-left border border-slate-100">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Pesanan Anda</span>
              <p className="font-mono text-lg font-bold text-slate-800">#{bookingId.toUpperCase().slice(0, 10)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jumlah Bayar</span>
              <p className="text-3xl font-bold text-primary-dark tracking-tight">Rp {(room.price * duration).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border-t-4 border-primary-dark shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Virtual Account (Bank BNI)</span>
                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Menunggu</span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-2xl font-mono font-bold text-slate-800 tracking-[0.2em]">988{Math.floor(Math.random() * 90000000) + 10000000}</p>
                <button className="text-primary font-bold text-sm hover:underline">Salin</button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 mt-4 text-center">
              <p className="text-sm font-bold text-slate-700 mb-4">Sudah transfer? Unggah bukti pembayaran Anda.</p>
              {proofUploaded ? (
                <div className="bg-green-50 text-green-600 p-3 rounded-lg font-bold text-sm border border-green-100 flex items-center justify-center space-x-2">
                  <Check className="w-5 h-5" />
                  <span>Bukti terunggah</span>
                </div>
              ) : (
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-xl font-bold transition-all block">
                  {proofUploading ? 'Mengunggah...' : 'Pilih File Bukti'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={proofUploading} />
                </label>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-slate-200"
            >
              Ke Dashboard
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl transition-all"
            >
              Unduh Kwitansi PDF
            </button>
          </div>
          
          <div className="flex items-center justify-center space-x-2 text-[10px] text-slate-400 uppercase tracking-widest pt-4 font-bold">
            <Shield className="w-4 h-4" />
            <span>Enkripsi aman aktif untuk sesi ini</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <button 
        onClick={() => navigate(-1)}
        className="inline-flex items-center space-x-2 text-slate-500 hover:text-slate-900 font-semibold transition-colors group mb-4"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs uppercase tracking-widest">Kembali ke katalog</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
        {/* Room Detail Preview */}
        <div className="lg:col-span-3 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card-minimal overflow-hidden"
          >
            <div className="h-[300px] relative bg-slate-100 flex items-center justify-center">
              <div className="text-slate-300 text-6xl font-bold opacity-20 select-none">
                Kamar {room.number}
              </div>
              <div className="absolute top-6 left-6 flex gap-2">
                <span className="bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm">
                  {room.type}
                </span>
                {room.capacity && (
                  <span className="bg-white/90 backdrop-blur-sm text-slate-800 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Users className="w-3 h-3" /> {room.capacity} Org
                  </span>
                )}
              </div>
            </div>
            <div className="p-10 space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Kamar {room.number}</h1>
                  <p className="text-slate-500 font-medium">{room.type} di Karunia Kos</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-slate-900 leading-none">Rp {room.price.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Per Bulan</p>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-slate-600 leading-relaxed text-sm italic font-medium">"{room.description}"</p>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dapur</span>
                  <p className="text-xs font-bold text-slate-700">Dapur Mini</p>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penyimpanan</span>
                  <p className="text-xs font-bold text-slate-700">Lemari</p>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kamar Mandi</span>
                  <p className="text-xs font-bold text-slate-700">Kamar Mandi Dalam</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Checkout Card */}
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card-minimal p-10 space-y-8 sticky top-24"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Detail Reservasi</h2>
              <p className="text-slate-500 text-sm">Pilih tanggal masuk dan durasi tinggal.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tanggal Masuk</label>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center">
                  <DayPicker 
                    mode="single"
                    required
                    selected={parsedSelectedDate}
                    onSelect={(date) => {
                      if (date) {
                         setParsedSelectedDate(date);
                         setStartDate(format(date, 'yyyy-MM-dd'));
                      }
                    }}
                    disabled={[
                      { before: new Date() },
                      ...occupiedDates
                    ]}
                    modifiers={{
                       occupied: occupiedDates
                    }}
                    modifiersStyles={{
                       occupied: { textDecoration: 'line-through', color: '#ef4444'}
                    }}
                  />
                  <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-start text-xs text-slate-500 font-medium bg-white p-3 rounded-xl shadow-sm border border-slate-100 gap-2 max-w-sm text-center sm:text-left">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>Tanggal yang dicoret merah atau di masa lalu tidak dapat dipilih karena telah dipesan.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Durasi Tinggal</label>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 3, 6, 12].map((m) => (
                    <div key={m} className="relative group">
                      <button
                        onClick={() => setDuration(m)}
                        className={`w-full py-3 rounded-xl font-bold text-xs transition-all border ${
                          duration === m 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {m} Bulan
                      </button>
                      {m >= 3 && (
                        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] rounded py-1 px-2 pointer-events-none -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 font-bold tracking-widest shadow-lg">
                          Diskon menarik menanti!
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Amenities Summary */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ringkasan Fasilitas</span>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold">Dapur Mini</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold">Kamar Mandi Dalam</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold">Lemari</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold">WiFi Gratis</span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>Tarif Bulanan</span>
                  <span>Rp {room.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>Periode Sewa</span>
                  <span>{format(parsedSelectedDate, 'dd MMM yy')} - {format(addMonths(parsedSelectedDate, duration), 'dd MMM yy')}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>Durasi</span>
                  <span>{duration}x</span>
                </div>
                <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-xl">
                  <span className="font-bold text-slate-900">Total Harga</span>
                  <span className="font-bold text-primary">Rp {(room.price * duration).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3 items-start">
                <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  Pembayaran Anda diamankan oleh Karunia Kos Escrow. Dana hanya dilepaskan setelah berhasil check-in.
                </p>
              </div>

              <button 
                onClick={handleBooking}
                disabled={submitting}
                className="w-full btn-primary py-4 text-base shadow-xl shadow-blue-500/10 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Konfirmasi Reservasi'}
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button
                onClick={toggleBookmark}
                className="w-full mt-4 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-colors shadow-sm"
              >
                {isBookmarked ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
                {isBookmarked ? 'Tersimpan untuk nanti' : 'Ingatkan saya nanti'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
