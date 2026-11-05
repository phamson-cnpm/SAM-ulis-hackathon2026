// Nút Hoàn thành ở bước Chờ in và ký: phiếu dự toán đã in, đủ chữ ký, tài sản đã sửa xong thì kết thúc hồ sơ.
// Dùng ở hồ sơ phiếu và ở thẻ Chờ in và ký của mục Dự toán.
import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { estimatesApi } from '../utils/api';
import { useToast } from '../utils/ToastContext';
import { Button, FilePick, Modal, Notice } from './ui';

const FinishEstimateModal = ({ est, onClose }) => {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const signed = est.status === 'da_ky_du';
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await estimatesApi.complete(est.id, file);
      toast('success', `Đã hoàn thành hồ sơ theo dự toán ${est.code}; người báo hỏng nhận thông báo đã xử lý xong.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={`Hoàn thành hồ sơ: ${est.code}`}
      onClose={onClose}
      width={580}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" icon={<CheckCircle2 size={16} />} disabled={busy} onClick={save}>
            Hoàn thành
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-ink-2">
          Phiếu dự toán đã in, đủ chữ ký Lãnh đạo Phòng QTNL, Lãnh đạo Phòng KHTC, Ban Giám hiệu và tài sản đã sửa xong.
          Bấm Hoàn thành để kết thúc hồ sơ: phiếu báo hỏng chuyển Hoàn thành, người báo hỏng nhận thông báo; tài sản hỏng
          lại thì báo phiếu mới như bình thường.
        </p>
        {!signed && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">
              Bản quét có đủ chữ ký <span className="font-normal text-muted">(chưa có thì đính kèm sau ở hồ sơ)</span>
            </p>
            <FilePick value={file} onChange={setFile} />
          </div>
        )}
        <Notice title="Chi phí thực tế nhập sau, khi có chứng từ">
          Hồ sơ chuyển sang thẻ Chờ chi phí thực tế của mục Dự toán; đến lúc đó đèn của tài sản tính theo số dự toán, mang
          nhãn Tạm tính.
        </Notice>
        {err && <p className="text-[13.5px] text-l-red">{err}</p>}
      </div>
    </Modal>
  );
};

export default FinishEstimateModal;
