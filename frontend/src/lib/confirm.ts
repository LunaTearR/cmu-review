import Swal from 'sweetalert2'

const BRAND = '#7c5cff'
const NEUTRAL = '#94a3b8'
const DANGER = '#ef4444'

interface SubmitOpts {
  title?: string
  text?: string
  confirmText?: string
  cancelText?: string
}

export async function confirmSubmit(opts: SubmitOpts = {}): Promise<boolean> {
  const r = await Swal.fire({
    icon: 'question',
    title: opts.title ?? 'ยืนยันการส่งข้อมูล?',
    text: opts.text ?? 'ตรวจสอบข้อมูลให้แน่ใจก่อนส่งนะ',
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'ยืนยัน',
    cancelButtonText: opts.cancelText ?? 'ย้อนกลับ',
    confirmButtonColor: BRAND,
    cancelButtonColor: NEUTRAL,
    reverseButtons: true,
    focusCancel: false,
  })
  return r.isConfirmed
}

export async function confirmDiscard(): Promise<boolean> {
  const r = await Swal.fire({
    icon: 'warning',
    title: 'ออกจากฟอร์ม?',
    text: 'มีข้อมูลที่กรอกไว้ ถ้าออกตอนนี้ข้อมูลจะหายนะ ยืนยันจะออกไหม?',
    showCancelButton: true,
    confirmButtonText: 'ออกเลย',
    cancelButtonText: 'กรอกต่อ',
    confirmButtonColor: DANGER,
    cancelButtonColor: NEUTRAL,
    reverseButtons: true,
    focusCancel: true,
  })
  return r.isConfirmed
}
