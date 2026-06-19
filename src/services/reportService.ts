import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Booking, Room } from '../types';

export const generateReceipt = (booking: Booking, room: Room | undefined, userName: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(22);
  doc.text("Kwitansi Pembayaran Karunia Kos", 14, 20);
  
  doc.setFontSize(12);
  doc.text(`ID Pesanan: ${booking.id}`, 14, 35);
  doc.text(`Tanggal Pesanan: ${format(new Date(booking.createdAt), 'dd MMM yyyy HH:mm')}`, 14, 42);
  doc.text(`Tanggal Konfirmasi: ${booking.confirmedAt ? format(new Date(booking.confirmedAt), 'dd MMM yyyy HH:mm') : 'N/A'}`, 14, 49);
  doc.text(`Status: LUNAS`, 14, 56);
  
  autoTable(doc, {
    startY: 65,
    head: [['Keterangan', 'Detail']],
    body: [
      ['Nama Penghuni', userName || 'N/A'],
      ['Nomor Kamar', room ? `Kamar ${room.number}` : 'N/A'],
      ['Durasi Sewa', `${booking.durationMonths} Bulan`],
      ['Total Pembayaran', `Rp ${booking.totalPrice.toLocaleString()}`]
    ]
  });
  
  const finalY = (doc as any).lastAutoTable.finalY || 65;
  doc.setFontSize(10);
  doc.text("Terima kasih telah menggunakan layanan Karunia Kos.", 14, finalY + 15);
  doc.text("Pusat Bantuan: 0812345789 | Email: admin@karuniakos.com", 14, finalY + 22);
  
  doc.save(`Kwitansi_${booking.id.slice(0, 8)}.pdf`);
};
