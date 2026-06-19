import Swal from 'sweetalert2';

export const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
  Swal.fire({
    icon: type,
    title: message,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end'
  });
};

export const showConfirm = async (
  title: string,
  text: string,
  confirmText = 'Ya, Hapus'
): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: confirmText,
    cancelButtonText: 'Batal'
  });
  return result.isConfirmed;
};
