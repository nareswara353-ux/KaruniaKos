import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { Booking, User, Room, Payment } from '../types';
import { format } from 'date-fns';

interface ConfirmPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (bookingId: string, roomId: string, confirmDate: string) => void;
  booking: Booking | null;
  user: User | null;
  room: Room | null;
  paymentRecord: Payment | null;
}

export function ConfirmPaymentModal({ isOpen, onClose, onConfirm, booking, user, room, paymentRecord }: ConfirmPaymentModalProps) {
  const [confirmDate, setConfirmDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  if (!isOpen || !booking || !user || !room) return null;

  const proofUrl = paymentRecord?.proofUrl || booking.proofUrl;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Konfirmasi Pembayaran</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-red-500 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penghuni</p>
                <p className="font-bold text-lg text-slate-800">{user.displayName}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kamar</p>
                <p className="font-bold text-lg text-slate-800">{room.number}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bukti Transfer</p>
               {proofUrl ? (
                 <a href={proofUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 aspect-video relative group">
                   <img src={proofUrl} alt="Bukti Transfer" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                     <span className="text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">Lihat Penuh</span>
                   </div>
                 </a>
               ) : (
                 <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 text-sm font-medium">
                   Belum ada bukti yang dilampirkan.
                 </div>
               )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal Efektif Masuk (Mulai Sewa)</label>
              <input 
                type="date" 
                value={confirmDate}
                onChange={e => setConfirmDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
              <p className="text-xs text-slate-500">Tanggal ini akan menjadi acuan tagihan bulan berikutnya.</p>
            </div>

            <div className="flex space-x-4 pt-4 border-t border-slate-100">
              <button 
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={() => onConfirm(booking.id, room.id, confirmDate)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-emerald-500 shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Sahkan & Konfirmasi
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
