// Phòng KHTC: dữ liệu cán bộ (họ tên, đơn vị, số điện thoại, mã xác nhận cá nhân); cấp, đổi, thu hồi mã
// của cán bộ đầu mối từng đơn vị (chọn người từ dữ liệu cán bộ); xem nhật ký xem và xuất file theo người thao tác.
import React, { useMemo, useState } from 'react';
import { KeyRound, Plus, Search } from 'lucide-react';
import { catalogApi, focalApi, staffApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import ImportButton from '../components/ImportButton';
import { dateTimeVN, dateVN } from '../utils/format';
import { FOCAL_ACTION, FOCAL_STATUS, STAFF_GROUP } from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { TODAY } from '../config/app';
import { Button, Empty, Field, Input, Modal, Notice, PageHeader, Pill, Select, Table, Tabs, Td, Th, Textarea } from '../components/ui';
import { Pager, usePaged } from '../components/Pager';

const daysBefore = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const EXPORTS = ['xuat_excel', 'in', 'tai_word'];

const FocalAccountsPage = () => {
  const { data: list } = useApi(() => focalApi.list(), []);
  const { data: logs } = useApi(() => focalApi.logs(), []);
  const { data: staff } = useApi(() => staffApi.list(), []);
  const [tab, setTab] = useState('ma');
  const [unitFilter, setUnitFilter] = useState('all');
  const [showOld, setShowOld] = useState(false);
  const [reissue, setReissue] = useState(null);
  const [revoke, setRevoke] = useState(null);

  const active = (list || []).filter((f) => f.status === 'dang_dung');
  const units = useMemo(() => [...new Set((list || []).map((f) => f.unit))], [list]);
  const unitsWithoutCode = units.filter((u) => !active.some((f) => f.unit === u));
  const shown = (list || []).filter((f) => showOld || f.status === 'dang_dung' || unitsWithoutCode.includes(f.unit));
  const shownLogs = (logs || []).filter((l) => unitFilter === 'all' || l.unit === unitFilter);
  const since = daysBefore(TODAY, 30);
  const last30 = (logs || []).filter((l) => l.at >= since && EXPORTS.includes(l.action));
  const codePager = usePaged(shown, showOld);
  const logPager = usePaged(shownLogs, unitFilter);

  return (
    <div>
      <PageHeader
        title="Mã xác nhận, dữ liệu cán bộ"
        description="Phòng KHTC nhập dữ liệu cán bộ (gồm lãnh đạo các đơn vị, cán bộ đầu mối). Lãnh đạo Phòng QTNL, kỹ thuật viên, cán bộ đầu mối có mã xác nhận cá nhân, nhập khi bắt đầu làm việc trên tài khoản chung; nhật ký ghi tên người thao tác."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-rule bg-surface px-4 py-3">
          <p className="text-[13px] text-muted">Mã đang dùng</p>
          <p className="num text-[24px] font-semibold">
            {active.length}
            <span className="text-[14px] font-normal text-muted"> / {units.length} đơn vị</span>
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-surface px-4 py-3">
          <p className="text-[13px] text-muted">Lượt in, tải file 30 ngày qua</p>
          <p className="num text-[24px] font-semibold">{last30.length}</p>
        </div>
        <div className="rounded-lg border border-rule bg-surface px-4 py-3">
          <p className="text-[13px] text-muted">Đơn vị chưa có mã</p>
          <p className="num text-[24px] font-semibold">{unitsWithoutCode.length}</p>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'ma', label: 'Mã xác nhận', count: active.length },
          { id: 'canbo', label: 'Dữ liệu cán bộ', count: staff ? staff.length : 0 },
          { id: 'log', label: 'Nhật ký xem, xuất file', count: logs ? logs.length : 0 },
        ]}
      />

      {tab === 'canbo' ? (
        <StaffTab staff={staff || []} />
      ) : tab === 'ma' ? (
        <div className="rounded-lg border border-rule bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-2 px-3 py-2.5">
            <p className="text-[13px] text-muted">
              Đổi mã khi đơn vị thay cán bộ đầu mối; mã cũ hết hiệu lực ngay, người đang dùng mã cũ bị đăng xuất.
            </p>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} className="h-4 w-4 accent-[#1d4f73]" />
              Hiện cả mã đã thu hồi
            </label>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Đơn vị</Th>
                <Th>Cán bộ đầu mối</Th>
                <Th>Mã xác nhận</Th>
                <Th>Cấp ngày</Th>
                <Th>Truy cập gần nhất</Th>
                <Th>Trạng thái</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {codePager.pageRows.map((f) => (
                <tr key={f.id} className={f.status === 'da_thu_hoi' ? 'text-muted' : 'hover:bg-sunken'}>
                  <Td className="min-w-[200px]">{f.unit}</Td>
                  <Td className="min-w-[170px]">
                    {f.name}
                    <div className="text-[12.5px] text-muted">
                      {f.position}
                      {f.phone ? `, ${f.phone}` : ''}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className={f.status === 'dang_dung' ? 'num font-semibold tracking-wide text-ink' : 'num line-through'}>
                      {f.code}
                    </span>
                  </Td>
                  <Td className="num whitespace-nowrap">{dateVN(f.issuedAt)}</Td>
                  <Td className="num whitespace-nowrap">
                    {f.lastAccess ? dateTimeVN(f.lastAccess) : <span className="text-subtle">Chưa dùng</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Pill tone={f.status === 'dang_dung' ? 'green' : f.status === 'chua_cap' ? 'amber' : 'neutral'}>{FOCAL_STATUS[f.status]}</Pill>
                    {f.revokedAt && (
                      <div className="mt-1 text-[12px] text-muted">
                        {dateVN(f.revokedAt)}: {f.revokeReason}
                      </div>
                    )}
                  </Td>
                  <Td right className="whitespace-nowrap">
                    {f.status === 'dang_dung' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setReissue(f)}>
                          Đổi người, cấp mã mới
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRevoke(f)}>
                          Thu hồi
                        </Button>
                      </div>
                    ) : (
                      unitsWithoutCode.includes(f.unit) &&
                      !shown.some((x) => x.unit === f.unit && x.issuedAt > f.issuedAt) && (
                        <Button size="sm" variant="primary" onClick={() => setReissue(f)}>
                          Cấp mã
                        </Button>
                      )
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager pager={codePager} />
        </div>
      ) : (
        <div className="rounded-lg border border-rule bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-rule-2 p-3">
            <Select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="w-auto max-w-[340px]" aria-label="Đơn vị">
              <option value="all">Tất cả đơn vị</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
            <p className="text-[13px] text-muted">Ghi lại mọi lần nhập mã, xem danh sách, in và tải file, theo từng mã.</p>
          </div>
          {shownLogs.length === 0 ? (
            <Empty title="Chưa có lượt truy cập nào." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Thời gian</Th>
                  <Th>Đơn vị</Th>
                  <Th>Mã</Th>
                  <Th>Người dùng mã</Th>
                  <Th>Thao tác</Th>
                  <Th>Nội dung</Th>
                </tr>
              </thead>
              <tbody>
                {logPager.pageRows.map((l) => {
                  const f = (list || []).find((x) => x.id === l.focalId);
                  return (
                    <tr key={l.id}>
                      <Td className="num whitespace-nowrap">{dateTimeVN(l.at)}</Td>
                      <Td className="min-w-[180px]">{l.unit}</Td>
                      <Td className="num whitespace-nowrap">{l.code}</Td>
                      <Td className="whitespace-nowrap">{l.name || (f ? f.name : '—')}</Td>
                      <Td className="whitespace-nowrap">
                        <Pill tone={EXPORTS.includes(l.action) ? 'blue' : 'neutral'}>
                          {FOCAL_ACTION[l.action]}
                        </Pill>
                      </Td>
                      <Td className="min-w-[200px] text-ink-2">{l.detail || '—'}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <Pager pager={logPager} />
        </div>
      )}

      {reissue && <ReissueModal f={reissue} onClose={() => setReissue(null)} />}
      {revoke && <RevokeModal f={revoke} onClose={() => setRevoke(null)} />}
    </div>
  );
};

const ReissueModal = ({ f, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: staff } = useApi(() => staffApi.list(), []);
  const people = (staff || []).filter((p) => p.unit === f.unit);
  const [staffId, setStaffId] = useState(f.staffId || '');
  const [done, setDone] = useState(null);
  const picked = people.find((p) => p.id === staffId);
  const changed = picked && picked.id !== f.staffId;

  const submit = async () => {
    if (!picked) return;
    const rec = await focalApi.reissue(f.unit, { staffId: picked.id }, user);
    setDone(rec);
    toast('success', `Đã cấp mã ${rec.code} cho ${f.unit}.`);
  };

  return (
    <Modal
      open
      title={done ? 'Đã cấp mã mới' : `Cấp mã đầu mối: ${f.unit}`}
      onClose={onClose}
      width={600}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Xong
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Hủy</Button>
            <Button variant="primary" icon={<KeyRound size={16} />} disabled={!picked} onClick={submit}>
              Cấp mã mới
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3">
          <p className="text-ink-2">
            Gửi mã này cho {done.name}, {done.unit}. Người nhận nhập mã ở màn hình đăng nhập, mục Cán bộ đầu mối đơn vị.
          </p>
          <p className="num rounded-md border border-accent-line bg-accent-soft px-4 py-3 text-center text-[24px] font-semibold tracking-widest text-accent">
            {done.code}
          </p>
          {f.status === 'dang_dung' && <p className="text-[13px] text-muted">Mã cũ {f.code} đã hết hiệu lực.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {f.status === 'dang_dung' && (
            <Notice tone="warn">
              Mã đang dùng <span className="num font-semibold">{f.code}</span> sẽ bị thu hồi ngay khi cấp mã mới.
            </Notice>
          )}
          <Field
            label="Cán bộ đầu mối (chọn từ dữ liệu cán bộ)"
            required
            hint={changed ? 'Đổi người: mã cũ hết hiệu lực; lịch sử truy cập của người cũ vẫn giữ theo mã cũ.' : 'Giữ người, chỉ đổi mã.'}
          >
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Chọn cán bộ của đơn vị</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.position ? ` (${p.position})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          {picked && (
            <p className="text-[13px] text-muted">
              {picked.position || 'Chưa ghi chức vụ'}; điện thoại {picked.phone || 'chưa có'}. Sửa ở tab Dữ liệu cán bộ.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------- Dữ liệu cán bộ
const StaffTab = ({ staff }) => {
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('all');
  const [group, setGroup] = useState('all');
  const [edit, setEdit] = useState(null);
  const units = useMemo(() => [...new Set(staff.map((p) => p.unit))].sort((a, b) => a.localeCompare(b, 'vi')), [staff]);
  const s = q.trim().toLowerCase();
  const rows = staff.filter(
    (p) =>
      (unit === 'all' || p.unit === unit) &&
      (group === 'all' || p.group === group) &&
      (!s || p.name.toLowerCase().includes(s) || (p.phone || '').includes(s)),
  );
  const pager = usePaged(rows, [q, unit, group]);
  return (
    <div className="rounded-lg border border-rule bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule-2 p-3">
        <div className="relative w-full sm:w-[260px]">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo họ tên, số điện thoại" className="pl-8" />
        </div>
        <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-auto max-w-[280px]" aria-label="Đơn vị">
          <option value="all">Tất cả đơn vị</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
        <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-auto max-w-[220px]" aria-label="Nhóm">
          <option value="all">Tất cả nhóm</option>
          {Object.keys(STAFF_GROUP).map((g) => (
            <option key={g} value={g}>
              {STAFF_GROUP[g]}
            </option>
          ))}
        </Select>
        <div className="flex gap-2 sm:ml-auto">
          <ImportButton label="Nhập Excel" hint="Danh sách cán bộ: Mã số hiệu CBCCVC, Họ tên, Đơn vị, Chức vụ hiện tại (.xlsx)" />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({})}>
            Thêm cán bộ
          </Button>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Họ tên</Th>
            <Th>Đơn vị</Th>
            <Th>Chức vụ</Th>
            <Th>Số điện thoại</Th>
            <Th>Nhóm</Th>
            <Th>Mã xác nhận</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {pager.pageRows.map((p) => (
            <tr key={p.id} className="hover:bg-sunken">
              <Td className="min-w-[170px]">
                {p.name}
                {p.staffCode && <div className="num text-[12px] text-muted">{p.staffCode}</div>}
              </Td>
              <Td className="min-w-[180px]">{p.unit}</Td>
              <Td className="whitespace-nowrap">{p.position || <span className="text-subtle">—</span>}</Td>
              <Td className="num whitespace-nowrap">{p.phone || <span className="text-subtle">Chưa có</span>}</Td>
              <Td className="whitespace-nowrap">{STAFF_GROUP[p.group]}</Td>
              <Td className="whitespace-nowrap">
                {p.personalCode ? (
                  <span className="num font-semibold tracking-wide text-ink">{p.personalCode}</span>
                ) : (
                  <span className="text-subtle">—</span>
                )}
              </Td>
              <Td right>
                <Button size="sm" onClick={() => setEdit(p)}>
                  Sửa
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager pager={pager} />
      {rows.length === 0 && <Empty title="Không có cán bộ nào khớp bộ lọc." />}
      <p className="border-t border-rule-2 px-3 py-2 text-[12.5px] text-muted">
        Từ dữ liệu này phần mềm tự điền họ tên, đơn vị, số điện thoại khi báo hỏng. Mã của cán bộ đầu mối cấp ở tab Mã xác
        nhận; mã của kỹ thuật viên, lãnh đạo Phòng QTNL cấp khi thêm cán bộ.
      </p>
      {edit && <StaffModal p={edit} onClose={() => setEdit(null)} />}
    </div>
  );
};

const StaffModal = ({ p, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: units } = useApi(() => catalogApi.units(), []);
  const isNew = !p.id;
  const [v, setV] = useState({
    name: p.name || '',
    unit: p.unit || '',
    position: p.position || '',
    phone: p.phone || '',
    group: p.group || 'canbo',
  });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    if (!v.name.trim() || !v.unit) return;
    if (isNew) {
      const rec = await staffApi.create(v, user);
      toast('success', rec.code ? `Đã thêm ${rec.name}, mã xác nhận ${rec.code}.` : `Đã thêm ${rec.name}.`);
    } else {
      await staffApi.update(p.id, v.group === p.group ? { ...v, group: undefined } : v);
      toast('success', `Đã lưu ${v.name}.`);
    }
    onClose();
  };
  return (
    <Modal
      open
      title={isNew ? 'Thêm cán bộ' : `Sửa: ${p.name}`}
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" disabled={!v.name.trim() || !v.unit} onClick={save}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ tên" required>
          <Input value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Đơn vị" required>
          <Select value={v.unit} onChange={set('unit')}>
            <option value="">Chọn đơn vị</option>
            {(units || []).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Chức vụ">
          <Input value={v.position} onChange={set('position')} />
        </Field>
        <Field label="Số điện thoại">
          <Input value={v.phone} onChange={set('phone')} />
        </Field>
        {(isNew || v.group !== 'daumoi') && (
          <Field label="Nhóm" hint="Kỹ thuật viên, lãnh đạo Phòng QTNL được cấp mã xác nhận cá nhân khi lưu; chuyển khỏi Phòng QTNL thì mã hết hiệu lực.">
            <Select value={v.group} onChange={set('group')}>
              {['canbo', 'lanhdao_dv', 'ktv', 'lanhdao_qtnl', 'khtc'].map((g) => (
                <option key={g} value={g}>
                  {STAFF_GROUP[g]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
};

const RevokeModal = ({ f, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      title={`Thu hồi mã ${f.code}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={async () => {
              await focalApi.revoke(f.id, reason.trim(), user);
              toast('info', `Đã thu hồi mã của ${f.unit}. Đơn vị không xem được danh sách cho đến khi được cấp mã mới.`);
              onClose();
            }}
          >
            Thu hồi mã
          </Button>
        </>
      }
    >
      <p className="mb-3 text-ink-2">
        {f.unit}, cán bộ đầu mối {f.name}. Sau khi thu hồi, người đang dùng mã bị đăng xuất; lịch sử truy cập vẫn giữ.
      </p>
      <Field label="Lý do" required>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: cán bộ đầu mối nghỉ hưu, đơn vị chưa cử người thay" />
      </Field>
    </Modal>
  );
};

export default FocalAccountsPage;
