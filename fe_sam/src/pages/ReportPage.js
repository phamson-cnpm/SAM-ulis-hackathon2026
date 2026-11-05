
// Phiếu báo hỏng trực tuyến (mục 5.1): báo nhiều tài sản một lần, mỗi tài sản tách thành một phiếu cùng mã đợt.
import React, { useEffect, useState } from 'react';
import FormButton from '../components/FormButton';
import { Check as CheckIcon, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { assetsApi, catalogApi, refs, reportsApi } from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { dateTimeVN } from '../utils/format';
import { REPORT_STATUS } from '../utils/labels';
import {
  Button,
  Check,
  Field,
  Input,
  KV,
  Modal,
  Notice,
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui';
import { AssetPicker } from '../components/AssetPicker';
import StaffPicker from '../components/StaffPicker';

// Đoán nhóm tài sản từ tên gõ tay (tem mờ, rách) để gợi ý đúng nội dung báo hỏng
const NAME_GROUP = [
  ['điều hòa', '0416'],
  ['máy chiếu', '0404'],
  ['máy in', '0403'],
  ['máy scan', '0403'],
  ['photo', '0407'],
  ['laptop', '0402'],
  ['xách tay', '0402'],
  ['máy tính', '0401'],
  ['màn hình', '0426'],
  ['tivi', '0409'],
  ['ti vi', '0409'],
  ['loa', '0412'],
  ['micro', '0412'],
  ['tủ lạnh', '0414'],
  ['wifi', '0422'],
  ['bàn', '0420'],
  ['ghế', '0420'],
  ['tủ', '0421'],
];
const groupOf = (r) => {
  if (r.asset) return r.asset.groupCode;
  const n = r.assetName.toLowerCase();
  const hit = NAME_GROUP.find(([w]) => n.includes(w));
  return hit ? hit[1] : '';
};

/** Danh sách chọn sẵn: bấm vào mục để xổ xuống, mỗi nội dung một dòng (chọn được nhiều, bấm lại để bỏ).
 *  onOther: dòng cuối "Khác (tự nhập)" thu danh sách lại và đưa con trỏ vào ô nhập để gõ nội dung không có sẵn. */
const PickList = ({ title, items, isOn, onPick, onOther }) => {
  const [open, setOpen] = useState(false);
  const picked = items.filter((it) => isOn(typeof it === 'string' ? it : it.text)).length;
  const row = 'flex w-full items-start gap-2.5 border-b border-rule-2 px-3 py-2 text-left text-[13.5px] last:border-b-0';
  return (
    <div className="rounded-[3px] border border-[#cdd2d7] bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-[7px] text-left text-[13.5px] text-ink hover:bg-sunken"
      >
        <span>
          {title}
          {picked > 0 && <span className="ml-1.5 font-medium text-accent">· đã chọn {picked}</span>}
        </span>
        <ChevronDown size={16} className={'shrink-0 text-subtle transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <ul className="max-h-[320px] overflow-y-auto border-t border-rule-2">
          {items.map((it) => {
            const text = typeof it === 'string' ? it : it.text;
            const on = isOn(text);
            return (
              <li key={text}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => onPick(it)}
                  className={row + (on ? ' bg-accent-soft text-accent' : ' text-ink-2 hover:bg-sunken')}
                >
                  <span
                    className={
                      'mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ' +
                      (on ? 'border-accent bg-accent text-white' : 'border-[#b9c0c7] bg-surface')
                    }
                  >
                    {on && <CheckIcon size={12} strokeWidth={3} />}
                  </span>
                  <span className="flex-1">{text}</span>
                  {typeof it !== 'string' && it.urgent && <span className="shrink-0 text-[12px] text-l-red">● Khẩn cấp</span>}
                </button>
              </li>
            );
          })}
          {onOther && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOther();
                }}
                className={row + ' font-medium text-accent hover:bg-sunken'}
              >
                <Pencil size={15} className="mt-[2px] shrink-0" />
                <span className="flex-1">Khác (tự nhập)</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

/** Nhãn ô nhập dùng chung kiểu Field nhưng không bọc thẻ label (danh sách bên trong có nút bấm). */
const FieldBox = ({ label, required, className, children }) => (
  <div className={className}>
    <span className="mb-1 block text-[13px] font-medium text-ink-2">
      {label}
      {required && <span className="ml-0.5 text-l-red">*</span>}
    </span>
    {children}
  </div>
);

// Mục "Khác…" trong danh mục của Phòng QTNL không chèn vào nội dung: đã có nút Khác (tự nhập) riêng.
const isOtherItem = (t) => t.trim().toLowerCase().startsWith('khác');

const addPart = (text, part) => {
  const parts = text
    .split(/;\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.some((x) => x.toLowerCase() === part.toLowerCase())) return parts.filter((x) => x.toLowerCase() !== part.toLowerCase()).join('; ');
  return [...parts, part].join('; ');
};

let k = 0;
const blank = () => ({
  key: ++k,
  asset: null,
  noCode: false,
  assetName: '',
  location: '',
  content: '',
  situation: '',
  urgent: false,
});

const ReportPage = ({ onNavigate, initialAssetIds }) => {
  const { user } = useAuth();
  const toast = useToast();
  // Họ tên người báo tự điền theo tài khoản cá nhân đang đăng nhập. Kỹ thuật viên, lãnh đạo Phòng QTNL lập phiếu thay
  // (nhận báo qua điện thoại) thì chọn người báo từ dữ liệu cán bộ. Số điện thoại tự điền, sửa được.
  const me = refs.userById(user.id) || user;
  const canPickReporter = ['ktv', 'lanhdao_qtnl'].includes(user.role);
  const [reporter, setReporter] = useState(me);
  const [phone, setPhone] = useState(me.phone || '');
  const [rows, setRows] = useState([blank()]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [touched, setTouched] = useState(false);
  const isKtv = user.role === 'ktv';

  // Mở từ trang Tài sản đơn vị (đầu mối) với tài sản đã chọn: điền sẵn mã tem
  useEffect(() => {
    if (!initialAssetIds || !initialAssetIds.length) return;
    let alive = true;
    Promise.all(initialAssetIds.slice(0, 10).map((id) => assetsApi.get(id))).then((list) => {
      if (alive) setRows(list.map((a) => ({ ...blank(), asset: a, location: a.location })));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const problems = (r) => {
    const p = [];
    if (!r.asset && !r.noCode) p.push('Chọn mã tem, hoặc tích “Tem mờ, rách”');
    if (r.noCode && !r.assetName.trim()) p.push('Nhập tên tài sản');
    if (r.noCode && !r.location.trim()) p.push('Nhập vị trí');
    if (!r.content.trim()) p.push('Nhập nội dung báo hỏng');
    return p;
  };
  const allOk = reporter && phone.trim() && rows.every((r) => problems(r).length === 0);

  const items = rows.map((r) => ({
    assetId: r.asset?.id ?? null,
    assetName: r.asset ? r.asset.name : r.assetName.trim(),
    location: r.location.trim() || r.asset?.location || '',
    content: r.content.trim(),
    situation: r.situation.trim(),
    urgent: r.urgent,
    dup: r.asset ? reportsApi.openFor(r.asset.id) : undefined,
  }));

  const send = async () => {
    setBusy(true);
    try {
      const res = await reportsApi.createBatch(
        reporter,
        phone.trim(),
        items.map(({ dup: _d, ...it }) => it),
        user,
      );
      setDone(res);
      setConfirm(false);
      toast('success', `Đã gửi ${res.reports.length} phiếu báo hỏng, mã đợt ${res.batchCode}.`);
    } catch (e) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-[880px]">
        <PageHeader
          title="Đã gửi phiếu báo hỏng"
          description="Phòng Quản trị nguồn lực đã nhận được thông báo. Theo dõi tiến độ ở trang Phiếu của tôi."
        />
        <Panel title={`Mã đợt ${done.batchCode}`} bodyClass="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Mã phiếu</Th>
                <Th>Tài sản</Th>
                <Th>Vị trí</Th>
                <Th>Trạng thái</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {done.reports.map((r) => (
                <tr key={r.id}>
                  <Td className="num font-medium">{r.code}</Td>
                  <Td>
                    {r.assetName}
                    {r.urgent && (
                      <Pill tone="red" className="ml-2">
                        Khẩn cấp
                      </Pill>
                    )}
                  </Td>
                  <Td>{r.location}</Td>
                  <Td>{REPORT_STATUS[r.status]}</Td>
                  <Td right>
                    <FormButton source={{ type: 'case', reportId: r.id, focus: 'PH' }}>Xem phiếu</FormButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={() => onNavigate(isKtv ? 'queue' : 'my-reports')}>
            {isKtv ? 'Về hàng chờ phiếu' : 'Xem phiếu của tôi'}
          </Button>
          <Button
            onClick={() => {
              setDone(null);
              setRows([blank()]);
              setTouched(false);
            }}
          >
            Báo hỏng tiếp
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[920px]">
      <PageHeader
        title={isKtv ? 'Lập phiếu báo hỏng' : 'Báo hỏng tài sản'}
        description={
          isKtv
            ? 'Dùng khi kỹ thuật viên phát hiện hỏng lúc kiểm tra, bảo trì mà chưa có ai báo. Phiếu đi tiếp quy trình như phiếu của cán bộ.'
            : 'Mỗi tài sản một mục. Gửi một lần, phần mềm tự tách thành từng phiếu cùng một mã đợt.'
        }
      />

      <Panel title="Người báo hỏng" className="mb-4">
        <div className="grid items-start gap-x-8 gap-y-3 sm:grid-cols-2">
          {canPickReporter ? (
            <Field label="Họ tên" required hint="Mặc định là bạn; nhận báo qua điện thoại thì chọn người báo từ dữ liệu cán bộ.">
              <StaffPicker
                value={reporter}
                onChange={(p) => {
                  setReporter(p);
                  if (p) setPhone(p.phone || '');
                }}
              />
            </Field>
          ) : (
            <Field label="Họ tên" hint="Tự điền theo tài khoản đang đăng nhập.">
              <div className="flex h-9 items-center rounded-md border border-rule bg-sunken px-2.5 text-ink">
                {me.name}
                <span className="ml-1.5 truncate text-[12.5px] text-muted">{me.unit}</span>
              </div>
            </Field>
          )}
          <Field
            label="Số điện thoại"
            required
            hint="Tự điền từ dữ liệu cán bộ; gõ để sửa hoặc nhập khi chưa có. Chỉ Phòng QTNL và Phòng KHTC thấy."
          >
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          {isKtv && <KV cols={1} items={[['Nguồn', 'QTNL phát hiện']]} />}
        </div>
      </Panel>

      <div className="space-y-4">
        {rows.map((r, i) => {
          const dup = r.asset ? reportsApi.openFor(r.asset.id) : undefined;
          const errs = touched ? problems(r) : [];
          return (
            <section key={r.key} className="rounded-[3px] border border-rule bg-surface">
              <header className="flex items-center justify-between border-b border-rule-2 px-4 py-2.5">
                <h2 className="text-[15px] font-semibold">Tài sản {i + 1}</h2>
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={15} />}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    Bỏ tài sản này
                  </Button>
                )}
              </header>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  {!r.noCode ? (
                    <Field label="Mã tem" required>
                      <AssetPicker
                        value={r.asset}
                        showLight={isKtv}
                        onChange={(a) => set(r.key, { asset: a, location: a?.location ?? '' })}
                        exclude={rows.filter((x) => x.key !== r.key && x.asset).map((x) => x.asset.id)}
                      />
                    </Field>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Tên tài sản"
                        required
                        hint="Ghi rõ để kỹ thuật viên tìm, ví dụ “Điều hòa Daikin”, “Máy in HP 403”."
                      >
                        <Input value={r.assetName} onChange={(e) => set(r.key, { assetName: e.target.value })} />
                      </Field>
                      <Field label="Vị trí" required hint="Theo dạng tòa.phòng, ví dụ A1.201.">
                        <Input value={r.location} onChange={(e) => set(r.key, { location: e.target.value })} />
                      </Field>
                    </div>
                  )}
                  <div className="mt-2">
                    <Check
                      checked={r.noCode}
                      onChange={(v) => set(r.key, { noCode: v, asset: null })}
                      label="Tem mờ, rách: không đọc được mã tem"
                      hint="Kỹ thuật viên sẽ gán mã khi kiểm tra."
                    />
                  </div>
                  {dup && (
                    <Notice tone="warn" className="mt-3" title="Tài sản này đang có phiếu chưa xử lý xong">
                      Phiếu {dup.code} gửi lúc {dateTimeVN(dup.createdAt)}, trạng thái “{REPORT_STATUS[dup.status]}”.
                      Chỉ gửi tiếp nếu là sự cố mới.
                    </Notice>
                  )}
                </div>
                {r.asset && (
                  <Field
                    label="Vị trí"
                    hint="Tự điền theo mã tem. Chỉ sửa khi thiết bị đang ở nơi khác."
                    className="sm:col-span-1"
                  >
                    <Input value={r.location} onChange={(e) => set(r.key, { location: e.target.value })} />
                  </Field>
                )}
                <FieldBox label="Nội dung báo hỏng" required className="sm:col-span-2">
                  <PickList
                    title="Chọn nội dung báo hỏng"
                    items={catalogApi.faults(groupOf(r)).filter((t) => !isOtherItem(t))}
                    isOn={(t) => r.content.toLowerCase().split(/;\s*/).includes(t.toLowerCase())}
                    onPick={(t) => set(r.key, { content: addPart(r.content, t) })}
                    onOther={() => {
                      const el = document.getElementById(`bh-content-${r.key}`);
                      if (el) el.focus();
                      const cur = r.content.trim();
                      if (cur && !cur.endsWith(';')) set(r.key, { content: `${cur}; ` });
                      // Sau khi nội dung cập nhật, đưa con trỏ về cuối để gõ tiếp
                      setTimeout(() => el && el.setSelectionRange(el.value.length, el.value.length), 0);
                    }}
                  />
                  <Textarea
                    id={`bh-content-${r.key}`}
                    className="mt-1.5"
                    value={r.content}
                    onChange={(e) => set(r.key, { content: e.target.value })}
                    placeholder="Nội dung đã chọn hiện ở đây; không có trong danh sách thì bấm Khác (tự nhập) hoặc gõ ngắn vào đây."
                  />
                </FieldBox>
                <FieldBox label="Tình huống đang xảy ra" className="sm:col-span-2">
                  <PickList
                    title="Chọn tình huống đang xảy ra"
                    items={catalogApi.situations()}
                    isOn={(t) => r.situation.toLowerCase().split(/;\s*/).includes(t.toLowerCase())}
                    onPick={(it) => {
                      const next = addPart(r.situation, it.text);
                      const added = next.length > r.situation.length;
                      set(r.key, { situation: next, urgent: added && it.urgent ? true : r.urgent });
                    }}
                    onOther={() => document.getElementById(`bh-situation-${r.key}`)?.focus()}
                  />
                  <Input
                    id={`bh-situation-${r.key}`}
                    className="mt-1.5"
                    value={r.situation}
                    onChange={(e) => set(r.key, { situation: e.target.value })}
                    placeholder="Tình huống đã chọn hiện ở đây; hoặc gõ ngắn, ví dụ: chiều nay có hội nghị ở phòng này"
                  />
                </FieldBox>
                <div className="sm:col-span-2">
                  <Check
                    checked={r.urgent}
                    onChange={(v) => set(r.key, { urgent: v })}
                    label="Khẩn cấp"
                    hint="Nguy cơ mất an toàn, đang thi, đang hội nghị (mục có chấm đỏ tự tích ô này). Phiếu khẩn cấp được xếp lên đầu hàng chờ."
                  />
                </div>
                {errs.length > 0 && <p className="text-[13px] text-l-red sm:col-span-2">{errs.join('. ')}.</p>}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button icon={<Plus size={16} />} onClick={() => setRows((rs) => [...rs, blank()])}>
          Thêm tài sản
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            setTouched(true);
            if (allOk) setConfirm(true);
            else toast('error', 'Còn thông tin bắt buộc chưa nhập.');
          }}
        >
          Báo hỏng
        </Button>
      </div>

      <Modal
        open={confirm}
        title="Kiểm tra trước khi gửi"
        onClose={() => setConfirm(false)}
        width={760}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Sửa lại</Button>
            <Button variant="primary" disabled={busy} onClick={send}>
              Gửi {items.length > 1 ? `${items.length} phiếu` : 'phiếu'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-ink-2">
          <span className="font-medium text-ink">{user.name}</span>, {user.unit}, điện thoại{' '}
          <span className="num">{phone}</span>
        </p>
        <Table className="rounded-md border border-rule-2">
          <thead>
            <tr>
              <Th>Tài sản</Th>
              <Th>Vị trí</Th>
              <Th>Nội dung báo hỏng</Th>
              <Th>Tình huống</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <Td>
                  {it.assetName}
                  <div className="num text-[12.5px] text-muted">{rows[i].asset?.code ?? 'Chưa có mã tem'}</div>
                  {it.dup && (
                    <div className="text-[12.5px] text-l-amber">Đang có phiếu {it.dup.code} chưa xử lý xong</div>
                  )}
                </Td>
                <Td>{it.location}</Td>
                <Td>{it.content}</Td>
                <Td>
                  {it.situation || <span className="text-subtle">—</span>}
                  {it.urgent && (
                    <div className="mt-1">
                      <Pill tone="red">Khẩn cấp</Pill>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal>
    </div>
  );
};

export default ReportPage;
