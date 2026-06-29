import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Room } from '../types';
import { Link } from 'react-router-dom';
import { CheckCircle2, Star, MapPin, ArrowRight, Coffee, Shirt, Bath, Phone, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Landing() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const q = query(collection(db, 'rooms'), where('status', '==', 'available'), limit(6));
        const querySnapshot = await getDocs(q);
        const roomsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));

        // Ensure we load rooms properly
        if (roomsData.length > 0) {
          setRooms(roomsData);
        }
      } catch (error) {
        console.error("Error fetching rooms:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="relative h-[450px] flex items-center bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-slate-800" />
        <div className="relative z-10 p-12 lg:p-20 text-left text-white space-y-8 w-full">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <span className="bg-primary/90 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Pengalaman Hunian Premium
            </span>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight text-white">
              Hunian Nyaman. <br />
              <span className="text-primary-light">Tanpa Ribet.</span>
            </h1>
            <p className="text-base md:text-lg text-slate-300 font-medium max-w-xl">
              Tingkatkan pengalaman indekos Anda dengan manajemen minimalis Karunia Kos dan sistem pemesanan yang mulus.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-4"
          >
            <Link to="/register" className="btn-primary py-4 px-8 text-base shadow-xl shadow-blue-500/20">
              Cari Kamar Sekarang
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Fasilitas */}
      <section className="space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Fasilitas Prioritas</h2>
            <p className="text-slate-500 dark:text-white" >Fasilitas andalan untuk kenyamanan ekstra Anda sehari-hari.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-100 flex items-start space-x-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="bg-orange-50 p-4 rounded-xl text-orange-500 group-hover:scale-110 transition-transform">
              <Coffee className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Dapur Mini</h3>
              <p className="text-slate-500 text-sm mt-1">Fasilitas memasak lebih praktis setiap saat.</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-slate-100 flex items-start space-x-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="bg-blue-50 p-4 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
              <Shirt className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Lemari</h3>
              <p className="text-slate-500 text-sm mt-1">Penyimpanan luas, aman dan tetap rapi.</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-slate-100 flex items-start space-x-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="bg-teal-50 p-4 rounded-xl text-teal-500 group-hover:scale-110 transition-transform">
              <Bath className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Kamar Mandi Dalam</h3>
              <p className="text-slate-500 text-sm mt-1">Privasi maksimal dengan kebersihan ekstra.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      <section className="space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-800">Kamar Tersedia</h2>
            <p className="text-slate-500">Pilih kamar terbaik yang sesuai dengan kebutuhan Anda.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room, idx) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="relative h-48 bg-slate-100 flex items-center justify-center border-b border-slate-50 overflow-hidden">
                <div className="text-slate-300 text-3xl font-bold opacity-30 select-none">
                  Kamar {room.number}
                </div>
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="bg-white/90 backdrop-blur-sm text-slate-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                    {room.type}
                  </span>
                  {room.capacity && (
                    <span className="bg-white/90 backdrop-blur-sm text-slate-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <Users className="w-3 h-3" /> {room.capacity}
                    </span>
                  )}
                </div>
                <div className="absolute top-4 right-4 flex items-center space-x-1.5 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  <div className={`w-2 h-2 rounded-full ${room.status === 'available' ? 'bg-emerald-500' : room.status === 'occupied' ? 'bg-blue-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    {room.status === 'available' ? 'Tersedia' : room.status === 'occupied' ? 'Terisi' : 'Perawatan'}
                  </span>
                </div>
                <div className="absolute bottom-4 right-4 bg-primary text-white font-bold px-3 py-1 rounded-lg">
                  Rp {room.price.toLocaleString()}/bln
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-slate-900">Kamar {room.number}</h3>
                  <div className="flex items-center space-x-1 text-amber-500">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-xs font-bold">5.0</span>
                  </div>
                </div>
                <p className="text-slate-500 text-sm h-10 overflow-hidden line-clamp-2">
                  {room.description}
                </p>
                <Link
                  to={`/book/${room.id}`}
                  className="block w-full bg-slate-900 hover:bg-slate-800 text-white text-center py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  Pesan Kamar
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info Lokasi & Kontak */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 mt-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
          <div className="flex items-center space-x-6 w-full md:w-1/2">
            <div className="bg-white p-4 rounded-2xl shadow-sm text-primary">
              <MapPin className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">Lokasi Kos</h3>
              <p className="text-slate-600 font-medium tracking-wide">Jl.Lapangan Remaja, Kecamatan Buaran</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full md:w-1/2 gap-4">
            <div className="flex items-center space-x-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm text-primary">
                <Phone className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">Kontak Pemilik</h3>
                <p className="text-slate-600 font-medium tracking-wide">0812345789</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="https://wa.me/62812345789?text=Halo%20Admin%2C%20saya%20ingin%20request%20jadwal%20survey%20lokasi%20Kosan%20untuk%20tanggal%3A"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm whitespace-nowrap"
              >
                Survey Lokasi
              </a>
              <a
                href="https://wa.me/62812345789"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm whitespace-nowrap"
              >
                Hubungi Pemilik
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-white border border-slate-100 rounded-3xl p-16 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          <div className="space-y-4">
            <div className="bg-primary/5 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Pembayaran Mulus</h3>
            <p className="text-slate-500 leading-relaxed text-sm">Sistem virtual account otomatis untuk konfirmasi mudah dan transaksi aman.</p>
          </div>
          <div className="space-y-4">
            <div className="bg-primary/5 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Pusat Resolusi</h3>
            <p className="text-slate-500 leading-relaxed text-sm">Ajukan dan pantau keluhan secara langsung dari portal penghuni khusus Anda.</p>
          </div>
          <div className="space-y-4">
            <div className="bg-primary/5 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard Pintar</h3>
            <p className="text-slate-500 leading-relaxed text-sm">Pelacakan okupansi real-time dan laporan keuangan untuk pemilik properti.</p>
          </div>
        </div>
      </section>
      {/* Testimonials */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-16 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
          <div className="w-full md:w-1/3 space-y-4">
            <h2 className="text-3xl font-bold text-white tracking-tight">Kisah Penghuni</h2>
            <p className="text-slate-400">Dengarkan pengalaman langsung dari penghuni yang telah merasakan kenyamanan Karunia Kos.</p>
          </div>
          <div className="w-full md:w-2/3">
            <TestimonialSlider />
          </div>
        </div>
      </section>
    </div>
  );
}

const testimonials = [
  { text: "Kosan paling nyaman yang pernah saya tempati. Fasilitas lengkap dan ibu kos sangat ramah!", author: "Budi Santoso", role: "Mahasiswa" },
  { text: "Lingkungan tenang, cocok untuk pekerja work from anywhere. Internetnya juga ngebut.", author: "Siti Rahma", role: "Freelancer" },
  { text: "Keamanan 24 jam bikin tenang. Harganya juga sangat bersahabat untuk fasilitas mewah ini.", author: "Andi Wijaya", role: "Karyawan" }
];

function TestimonialSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-48 bg-slate-800/50 rounded-2xl p-8 border border-slate-700 backdrop-blur-sm overflow-hidden flex flex-col justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div className="flex gap-1 text-amber-400">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="w-4 h-4 fill-current" />
            ))}
          </div>
          <p className="text-lg text-slate-200 font-medium italic">"{testimonials[current].text}"</p>
          <div>
            <p className="text-slate-100 font-bold">{testimonials[current].author}</p>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">{testimonials[current].role}</p>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-6 right-8 flex space-x-2">
        {testimonials.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-all ${current === idx ? 'bg-primary w-4' : 'bg-slate-600'}`}
          />
        ))}
      </div>
    </div>
  );
}
