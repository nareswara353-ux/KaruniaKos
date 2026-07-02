import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smartphone, CreditCard, CheckCircle, Upload } from 'lucide-react';
import { Booking } from '../types';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { doc, updateDoc, addDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Swal from 'sweetalert2';

interface QRPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export function QRPaymentModal({ isOpen, onClose, booking }: QRPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'DANA' | 'OVO'>('DANA');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [isExpired, setIsExpired] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { width, height } = useWindowSize();

  useEffect(() => {
    if (isOpen && booking) {
      if (booking.status === 'confirmed') {
        setIsSuccess(true);
      } else if (!isSuccess && !isExpired) {
        setQrCodeUrl(null);
        handleGenerateQR(selectedMethod);
      }
    }
  }, [isOpen, booking, selectedMethod]);

  useEffect(() => {
    if (isOpen && booking && !isSuccess && !isExpired) {
      // reset timer on open if not success or expired
      setTimeLeft(15 * 60);
      setIsExpired(false);
      setIsSuccess(booking.status === 'confirmed');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isSuccess || isExpired) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isSuccess, isExpired]);

  useEffect(() => {
    if (!isOpen || !booking || isSuccess || isExpired) return;

    const q = query(collection(db, 'payments'), where('bookingId', '==', booking.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const payment = change.doc.data();
          if (payment.status === 'confirmed') {
            setIsSuccess(true);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [isOpen, booking, isSuccess, isExpired]);

  const handleGenerateQR = (method: 'DANA' | 'OVO') => {
    setIsLoading(true);
    setTimeout(() => {
      const amount = booking?.totalPrice || 0;
      const qrData = `${method}_PAYMENT_${booking?.id}_AMOUNT_${amount}`;
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`);
      setIsLoading(false);
    }, 600);
  };

  const simulateSuccessfulPayment = async () => {
    if (!booking) return;
    setIsLoading(true);
    try {
        await updateDoc(doc(db, 'bookings', booking.id), {
           proofUrl: 'paid_via_qr' 
        });

        const q = query(collection(db, 'payments'), where('bookingId', '==', booking.id));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            await addDoc(collection(db, 'payments'), {
               bookingId: booking.id,
               userUid: booking.userUid,
               amount: booking.totalPrice,
               status: 'pending',
               proofUrl: 'paid_via_qr',
               createdAt: new Date().toISOString()
            });
        } else {
            for (const d of snap.docs) {
                await updateDoc(d.ref, { proofUrl: 'paid_via_qr' });
            }
        }
        
        await addDoc(collection(db, 'notifications'), {
           userUid: 'admin',
           title: 'Pembayaran Baru',
           message: `Ada pembayaran QR baru untuk pesanan #${booking.id.slice(0, 8)} sebesar Rp ${booking.totalPrice.toLocaleString()}.`,
           read: false,
           createdAt: new Date().toISOString()
        });

        setIsSuccess(true);
    } catch (err) {
        Swal.fire('Gagal', 'Gagal memproses pembayaran simulasi.', 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const uploadManualProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !booking) return;
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await updateDoc(doc(db, 'bookings', booking.id), {
           proofUrl: base64String 
        });
        
        const q = query(collection(db, 'payments'), where('bookingId', '==', booking.id));
        const snap = await getDocs(q);
        if (snap.empty) {
            await addDoc(collection(db, 'payments'), {
               bookingId: booking.id,
               userUid: booking.userUid,
               amount: booking.totalPrice,
               status: 'pending',
               proofUrl: base64String,
               createdAt: new Date().toISOString()
            });
        } else {
            for (const d of snap.docs) {
                await updateDoc(d.ref, { proofUrl: base64String });
            }
        }

        await addDoc(collection(db, 'notifications'), {
           userUid: 'admin',
           title: 'Bukti Transfer Diunggah',
           message: `Bukti transfer manual diunggah untuk pesanan #${booking.id.slice(0, 8)}.`,
           read: false,
           createdAt: new Date().toISOString()
        });

        setIsSuccess(true);
      };
      reader.readAsDataURL(file);
    } catch (err) {
        Swal.fire('Gagal', 'Gagal mengunggah bukti pembayaran.', 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !booking) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-100 flex flex-col items-center justify-end md:justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
        {isSuccess && <Confetti width={width} height={height} recycle={false} numberOfPieces={400} gravity={0.2} />}
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-t-3xl md:rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative overflow-hidden mt-auto md:mt-0 max-h-[90vh] overflow-y-auto flex flex-col">
          <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center py-8 space-y-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Menunggu Konfirmasi!</h2>
              <p className="text-slate-500 font-medium">Pembayaran Anda telah tercatat dan sedang menunggu verifikasi dari admin.</p>
              <button 
                onClick={onClose}
                className="w-full mt-6 py-3.5 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">
                Tutup
              </button>
            </motion.div>
          ) : isExpired ? (
            <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8 space-y-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Waktu Habis</h2>
              <p className="text-slate-500 font-medium">Sesi pembayaran telah kedaluwarsa. Silakan ulangi pembayaran.</p>
              <button 
                onClick={onClose}
                className="w-full mt-6 py-3.5 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors">
                Tutup
              </button>
            </motion.div>
          ) : (
            <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">Selesaikan Pembayaran</h2>
                  <p className={`text-sm font-bold animate-pulse mt-1 ${timeLeft > 300 ? 'text-emerald-500' : timeLeft > 60 ? 'text-amber-500' : 'text-red-500'}`}>Sisa Waktu: {formatTime(timeLeft)}</p>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-red-500 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 md:space-y-6">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setSelectedMethod('DANA')}
                    className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      selectedMethod === 'DANA' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'
                    }`}>
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mb-2">
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <span className={`font-bold text-sm ${selectedMethod === 'DANA' ? 'text-blue-700' : 'text-slate-600'}`}>DANA</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedMethod('OVO')}
                    className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      selectedMethod === 'OVO' ? 'border-purple-500 bg-purple-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'
                    }`}>
                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mb-2">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <span className={`font-bold text-sm ${selectedMethod === 'OVO' ? 'text-purple-700' : 'text-slate-600'}`}>OVO</span>
                  </button>
                </div>

                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tagihan</p>
                  <p className="text-2xl font-bold text-slate-900">Rp {booking.totalPrice.toLocaleString()}</p>
                </div>

                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center relative">
                  {isLoading || !qrCodeUrl ? (
                    <div className="flex flex-col items-center space-y-4 py-8">
                      <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
                      <p className="text-sm font-bold text-slate-400">Memproses...</p>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4 text-center">
                      <motion.div 
                        animate={{ boxShadow: ['0px 0px 0px rgba(59,130,246,0)', '0px 0px 20px rgba(59,130,246,0.3)', '0px 0px 0px rgba(59,130,246,0)'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 relative">
                        <img src={qrCodeUrl} alt="QR Code" className="w-45 h-45" />
                      </motion.div>
                      <div className="space-y-4">
                        <div className="text-left bg-slate-50 p-4 rounded-xl text-xs font-medium text-slate-600 border border-slate-100">
                          <p className="font-bold text-slate-800 tracking-tight mb-2">Cara Bayar:</p>
                          <ol className="list-decimal list-inside space-y-1.5">
                              <li>Buka aplikasi <span className="font-bold">{selectedMethod}</span></li>
                              <li>Pilih menu <span className="font-bold">Scan QR</span> atau <span className="font-bold">Bayar</span></li>
                              <li>Arahkan kamera ke QR Code di atas</li>
                              <li>Pastikan nominal <span className="font-bold">Rp {booking?.totalPrice.toLocaleString()}</span> & konfirmasi</li>
                          </ol>
                        </div>
                        <button 
                          onClick={simulateSuccessfulPayment}
                          className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-colors">
                          Simulasi: Saya Sudah Scan QR
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">ATAU</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>
                  
                  <label className="cursor-pointer border-2 border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50 text-slate-600 w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>Unggah Bukti Manual</span>
                    <input type="file" accept="image/*" className="hidden" onChange={uploadManualProof} disabled={isLoading} />
                  </label>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
