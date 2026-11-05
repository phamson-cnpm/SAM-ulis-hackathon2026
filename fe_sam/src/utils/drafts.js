// Bản nháp đang soạn (dự toán) lưu trên trình duyệt đang dùng: lỡ đóng tab hồ sơ hoặc tải lại trang vẫn mở lại được.
// Gửi xong hoặc bấm Bỏ bản nháp thì xóa. Trình duyệt chặn bộ nhớ (chế độ riêng tư) thì bỏ qua, không báo lỗi.
const PREFIX = 'sam:nhap:';

export const loadDraft = (key) => {
  if (!key) return null;
  try {
    const v = window.localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

export const saveDraft = (key, data) => {
  if (!key) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch {
    /* bộ nhớ trình duyệt không dùng được */
  }
};

export const clearDraft = (key) => {
  if (!key) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* bộ nhớ trình duyệt không dùng được */
  }
};

/** Khóa bản nháp dự toán mới của một hồ sơ, theo từng tài khoản (máy dùng chung không lẫn của người khác). */
export const newEstimateDraftKey = (userId, reportId) => `${userId}:du-toan-moi:${reportId}`;
/** Khóa bản nháp khi sửa dự toán bị trả lại. */
export const editEstimateDraftKey = (userId, estimateId) => `${userId}:du-toan-sua:${estimateId}`;

/** Giờ lưu bản nháp theo giờ máy: "08:52 05/11". */
export const draftTimeVN = (iso) => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(t.getHours())}:${p(t.getMinutes())} ${p(t.getDate())}/${p(t.getMonth() + 1)}`;
};
