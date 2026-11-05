
// Danh sách phiếu dự toán. Kỹ thuật viên theo dõi phiếu của mình: phiếu bị lãnh đạo phòng trả lại (thẻ Bị trả lại, mở
// sẵn khi có phiếu), hồ sơ đã nhận mà chưa gửi dự toán (mở lại khi lỡ đóng tab hồ sơ), xem lại mọi phiếu ở thẻ Tất cả;
// Phòng KHTC đối chiếu chi phí với chứng từ.
import React, { useMemo, useState } from 'react';
import FormButton from '../components/FormButton';
import FinishEstimateModal from '../components/FinishEstimateModal';
import { refs, estimatesApi, exportLogApi } from '../utils/api';
import { downloadXlsx } from '../utils/xlsx';
import { estimatesSheets } from '../utils/exportSheets';
import { useToast } from '../utils/ToastContext';
import { TODAY } from '../config/app';
import { Download } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { countedCost } from '../utils/lights';
import { dateTimeVN, dateVN, money } from '../utils/format';
import { ESTIMATE_STATUS } from '../utils/labels';
import { voucherGroups, voucherKey } from '../utils/vouchers';
import { useAuth } from '../utils/AuthContext';
import { draftTimeVN, loadDraft, newEstimateDraftKey } from '../utils/drafts';
import { Button, Check, Empty, Notice, PageHeader, Pill, ReadOnlyTag, statusSince, Table, Tabs, Td, Th, WaitDays } from '../components/ui';
import { LightBadge } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';

// qtnl: phiếu Cần kiểm tra lại nằm ở thẻ Bị trả lại (việc của kỹ thuật viên), không nằm ở thẻ Chờ lãnh đạo phòng
const inTab = (e, t, qtnl) =>
  t === 'cho'
    ? e.status === 'cho_lanh_dao' || (!qtnl && e.status === 'can_kiem_tra_lai')
    : t === 'ky'
      ? e.status === 'da_xac_nhan'
      : t === 'thucte'
        ? e.status === 'da_ky_du' && !e.actualEnteredAt
        : t === 'xong'
          ? !!e.actualEnteredAt
          : t === 'tatca'
            ? true
            : e.status === 'khong_dong_y';

const STEP = { chua_bien_ban: 'Chưa lập biên bản kiểm tra', chua_du_toan: 'Chưa gửi dự toán' };

const WAITING = ['cho_lanh_dao', 'can_kiem_tra_lai', 'da_xac_nhan'];

const EstimatesPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const isKhtc = user.role === 'khtc';
  const toast = useToast();
  const isQtnl = user.role === 'ktv' || user.role === 'lanhdao_qtnl';
  const { data } = useApi(() => estimatesApi.list(), []);
  const { data: unsentData } = useApi(() => (isQtnl ? estimatesApi.unsent() : Promise.resolve([])), []);
  const { data: returnedData } = useApi(() => (isQtnl ? estimatesApi.returned() : Promise.resolve([])), []);
  const [mine, setMine] = useState(user.role === 'ktv');
  const [finish, setFinish] = useState(null); // phiếu đang bấm Hoàn thành (thẻ Chờ in và ký)
  const unsent = useMemo(
    () => (unsentData || []).filter((x) => !mine || x.report.technicianId === user.id),
    [unsentData, mine, user.id],
  );
  const returned = useMemo(
    () => (returnedData || []).filter((x) => !mine || x.technicianId === user.id),
    [returnedData, mine, user.id],
  );
  // Kỹ thuật viên có phiếu bị trả lại thì mở sẵn thẻ Bị trả lại
  const [picked, setTab] = useState(null);
  const tab =
    picked ?? (isKhtc ? 'thucte' : user.role === 'ktv' ? (returned.length ? 'tralai' : 'chua') : 'cho');
  const unsentPager = usePaged(unsent, [tab, mine]);
  const returnedPager = usePaged(returned, [tab, mine]);

  const base = useMemo(() => (data || []).filter((e) => !mine || e.createdBy === user.id), [data, mine, user.id]);
  const rows = base.filter((e) => inTab(e, tab, isQtnl));
  const vouchers = useMemo(() => voucherGroups(data), [data]);
  const pager = usePaged(rows, [tab, mine]);
  const n = (t) =>
    t === 'chua' ? unsent.length : t === 'tralai' ? returned.length : base.filter((e) => inTab(e, t, isQtnl)).length;
  const TAB_LABEL = {
    ...(isQtnl ? { tralai: 'Bị trả lại', chua: 'Chưa gửi lãnh đạo' } : {}),
    cho: 'Chờ lãnh đạo phòng',
    ky: 'Chờ in và ký',
    thucte: 'Chờ chi phí thực tế',
    xong: 'Đã có chứng từ',
    khong: 'Không đồng ý',
    tatca: 'Tất cả',
  };

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        `SAM_phieu-du-toan_${TODAY}`,
        estimatesSheets(rows, {
          assetOf: refs.assetById,
          nameOf: (id) => refs.userById(id)?.name ?? '',
          tabLabel: `mục ${TAB_LABEL[tab]}${mine ? ', phiếu tôi lập' : ''}`,
        }),
      );
      exportLogApi.log(user, 'xuat_excel', `Phiếu dự toán, mục ${TAB_LABEL[tab]} (${rows.length} phiếu)`);
      toast('success', `Đã tải file Excel ${rows.length} phiếu.`);
    } catch (e) {
      toast('error', `Không tạo được file Excel: ${e.message}`);
    }
  };

  return (
    <div>
      <PageHeader
        title={isKhtc ? 'Đối chiếu chi phí sửa chữa' : 'Dự toán sửa chữa, thay thế'}
        description={
          isKhtc
            ? 'Phòng KHTC không nhập chi phí mà đối chiếu số Phòng QTNL nhập với chứng từ thanh toán. Khoản còn ở dạng dự toán thì đề nghị kỹ thuật viên cập nhật số thực tế.'
            : 'Mỗi tài sản một phiếu để tính đèn đúng. Chi phí chỉ có hai trạng thái: dự toán trước khi sửa và thực tế khi có chứng từ.'
        }
        actions={
          <>
            {isKhtc && <ReadOnlyTag title="Phòng KHTC xem, đối chiếu số Phòng QTNL nhập; không sửa phiếu dự toán" />}
            <Button
              icon={<Download size={16} />}
              onClick={exportXlsx}
              disabled={tab === 'chua' || tab === 'tralai' || !rows.length}
              title="Tải danh sách đang xem"
            >
              Tải Excel (.xlsx)
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            ...Object.keys(TAB_LABEL).map((id) => ({ id, label: TAB_LABEL[id], count: n(id), alert: id === 'tralai' })),
          ]}
        />
        {user.role === 'ktv' && (
          <div className="mb-4">
            <Check checked={mine} onChange={setMine} label="Chỉ phiếu tôi lập" />
          </div>
        )}
      </div>
      {isKhtc && tab === 'thucte' && n('thucte') > 0 && (
        <Notice tone="warn" className="mb-4" title={`${n('thucte')} phiếu đã ký đủ nhưng chưa có số thực tế`}>
          Đèn của các tài sản này đang tính theo dự toán và mang nhãn “Tạm tính”.
        </Notice>
      )}
      {tab === 'tralai' ? (
        <ReturnedList rows={returnedPager.pageRows} pager={returnedPager} loaded={!!returnedData} onNavigate={onNavigate} />
      ) : tab === 'chua' ? (
        <UnsentList
          rows={unsentPager.pageRows}
          pager={unsentPager}
          loaded={!!unsentData}
          userId={user.id}
          onNavigate={onNavigate}
        />
      ) : (
        <div className="rounded-[3px] border border-rule bg-surface">
          {data && rows.length === 0 ? (
            <Empty title="Không có phiếu nào." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Số phiếu</Th>
                  <Th>Ngày lập</Th>
                  <Th>Tài sản</Th>
                  <Th right>Dự toán (đ)</Th>
                  <Th right>Tính vào đèn (đ)</Th>
                  <Th right>Thực tế (đ)</Th>
                  <Th>Chứng từ</Th>
                  <Th>Đèn sau phiếu</Th>
                  <Th>Trạng thái</Th>
                  <Th>Người lập</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pager.pageRows.map((e) => {
                  const a = refs.assetById(e.assetId);
                  const total = e.lines.reduce((s, l) => s + l.estimate, 0);
                  const actual = e.actualEnteredAt ? e.lines.reduce((s, l) => s + (l.actual ?? 0), 0) : null;
                  return (
                    <tr
                      key={e.id}
                      className="cursor-pointer hover:bg-sunken"
                      onClick={() =>
                        e.reportId
                          ? onNavigate('case', { reportId: e.reportId })
                          : onNavigate('asset', { assetId: e.assetId })
                      }
                    >
                      <Td className="num font-medium whitespace-nowrap">
                        {e.code}
                        {e.locked && (
                          <div>
                            <Pill tone="red">Bị khóa</Pill>
                          </div>
                        )}
                      </Td>
                      <Td className="num whitespace-nowrap">{dateVN(e.createdAt)}</Td>
                      <Td className="min-w-[200px]">
                        {a?.name}
                        <div className="num text-[12.5px] text-muted">
                          {a?.code}, {a?.location}
                        </div>
                      </Td>
                      <Td right>{money(total)}</Td>
                      <Td right>{money(countedCost(e.lines).cost)}</Td>
                      <Td right>{actual === null ? <span className="text-subtle">—</span> : money(actual)}</Td>
                      <Td className="text-[13px] whitespace-nowrap">
                        {e.voucherNo ?? <span className="text-subtle">Chưa có</span>}
                        {e.voucherNo &&
                          (() => {
                            const v = vouchers[voucherKey(e.voucherNo)];
                            if (!v) return null;
                            return (
                              <>
                                {v.count > 1 && <div className="text-[12px] text-muted">Hóa đơn gộp {v.count} mã</div>}
                                {v.total !== null && v.sum !== v.total && (
                                  <div>
                                    <Pill tone="amber">
                                      Các mã {money(v.sum)} / hóa đơn {money(v.total)} đ
                                    </Pill>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                      </Td>
                      <Td>
                        <LightBadge code={e.lightAfter} size="sm" />
                      </Td>
                      <Td className="whitespace-nowrap">
                        {ESTIMATE_STATUS[e.status]}
                        {(WAITING.includes(e.status) || (e.status === 'da_ky_du' && !e.actualEnteredAt)) && (
                          <div>
                            <WaitDays since={statusSince(e)} />
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">{refs.userById(e.createdBy)?.name}</Td>
                      <Td right>
                        <div className="flex flex-col items-end gap-1.5">
                          {e.reportId && (
                            <FormButton source={{ type: 'case', reportId: e.reportId, focus: 'DT' }}>Biểu mẫu</FormButton>
                          )}
                          {tab === 'ky' && user.role === 'ktv' && e.reportId && (
                            <Button
                              size="sm"
                              variant="primary"
                              title="Đã in, đủ chữ ký và sửa xong: kết thúc hồ sơ"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setFinish(e);
                              }}
                            >
                              Hoàn thành
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <Pager pager={pager} />
        </div>
      )}
      {finish && <FinishEstimateModal est={finish} onClose={() => setFinish(null)} />}
    </div>
  );
};

/** Thẻ Bị trả lại: dự toán, biên bản hư hỏng toàn phần lãnh đạo phòng trả lại; mở hồ sơ để sửa, gửi lại. */
const ReturnedList = ({ rows, pager, loaded, onNavigate }) => (
  <>
    <Notice tone="warn" className="mb-4" title="Phiếu bị lãnh đạo phòng trả lại, cần làm lại">
      Đọc lý do trả lại, mở hồ sơ để sửa dự toán rồi gửi lại, hoặc lập lại biên bản. Gửi lại xong thì phiếu ra khỏi thẻ
      này. Có phiếu mới bị trả lại thì chuông báo và số đỏ hiện ở mục Dự toán trên menu.
    </Notice>
    <div className="rounded-[3px] border border-rule bg-surface">
      {loaded && rows.length === 0 ? (
        <Empty title="Không có phiếu nào bị trả lại." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Phiếu bị trả lại</Th>
              <Th>Phiếu báo hỏng</Th>
              <Th>Tài sản</Th>
              <Th>Lý do trả lại</Th>
              <Th>Trả lại lúc</Th>
              <Th>Kỹ thuật viên</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const a = x.assetId ? refs.assetById(x.assetId) : null;
              const open = () =>
                x.reportId ? onNavigate('case', { reportId: x.reportId }) : onNavigate('asset', { assetId: x.assetId });
              return (
                <tr key={x.id} className="cursor-pointer hover:bg-sunken" onClick={open}>
                  <Td className="whitespace-nowrap">
                    <span className="num font-medium">{x.code}</span>
                    <div className="text-[12.5px] text-muted">
                      {x.kind === 'du_toan' ? 'Dự toán' : 'Biên bản hư hỏng toàn phần'}
                    </div>
                  </Td>
                  <Td className="num whitespace-nowrap">
                    {x.report?.code ?? '—'}
                    {x.report?.urgent && (
                      <div>
                        <Pill tone="red">Khẩn cấp</Pill>
                      </div>
                    )}
                  </Td>
                  <Td className="min-w-[180px]">
                    {a?.name || x.report?.assetName}
                    {a && <div className="num text-[12.5px] text-muted">{a.code}</div>}
                  </Td>
                  <Td className="min-w-[200px] font-medium text-l-red">{x.reason}</Td>
                  <Td className="whitespace-nowrap">
                    {x.at && <span className="num">{dateTimeVN(x.at)}</span>}
                    {x.by && <div className="text-[12.5px] text-muted">{refs.userById(x.by)?.name}</div>}
                    {x.at && (
                      <div>
                        <WaitDays since={x.at.slice(0, 10)} />
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{refs.userById(x.technicianId)?.name}</Td>
                  <Td right>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        open();
                      }}
                    >
                      {x.kind === 'du_toan' ? 'Sửa, gửi lại' : 'Lập lại biên bản'}
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pager pager={pager} />
    </div>
  </>
);

/** Thẻ Chưa gửi lãnh đạo: hồ sơ đã nhận mà chưa gửi dự toán; bấm để mở lại hồ sơ làm tiếp. */
const UnsentList = ({ rows, pager, loaded, userId, onNavigate }) => (
  <>
    <Notice className="mb-4" title="Hồ sơ đã nhận, chưa gửi dự toán cho lãnh đạo phòng">
      Lỡ đóng tab hồ sơ thì mở lại ở đây để làm tiếp. Dự toán đang soạn tự lưu trên máy này, mở lại hồ sơ là còn nguyên;
      gửi rồi thì phiếu chuyển sang thẻ Chờ lãnh đạo phòng, xem lại mọi phiếu ở thẻ Tất cả.
    </Notice>
    <div className="rounded-[3px] border border-rule bg-surface">
      {loaded && rows.length === 0 ? (
        <Empty title="Không có hồ sơ nào đang dở." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Phiếu báo hỏng</Th>
              <Th>Ngày báo</Th>
              <Th>Tài sản</Th>
              <Th>Nội dung báo hỏng</Th>
              <Th>Đang dở ở bước</Th>
              <Th>Kỹ thuật viên</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ report: r, step, inspection }) => {
              const a = r.assetId ? refs.assetById(r.assetId) : null;
              const draft = step === 'chua_du_toan' ? loadDraft(newEstimateDraftKey(userId, r.id)) : null;
              const open = () => onNavigate('case', { reportId: r.id });
              return (
                <tr key={r.id} className="cursor-pointer hover:bg-sunken" onClick={open}>
                  <Td className="num font-medium whitespace-nowrap">
                    {r.code}
                    {r.urgent && (
                      <div>
                        <Pill tone="red">Khẩn cấp</Pill>
                      </div>
                    )}
                  </Td>
                  <Td className="num whitespace-nowrap">{dateVN(r.createdAt)}</Td>
                  <Td className="min-w-[200px]">
                    {a?.name || r.assetName}
                    <div className="num text-[12.5px] text-muted">{[a?.code, r.location].filter(Boolean).join(', ')}</div>
                  </Td>
                  <Td className="min-w-[180px] text-[13px]">{r.content}</Td>
                  <Td className="whitespace-nowrap">
                    {STEP[step]}
                    {inspection && <div className="num text-[12.5px] text-muted">Biên bản {inspection.code}</div>}
                    {draft && (
                      <div>
                        <Pill tone="blue">Có bản nháp, lưu {draftTimeVN(draft.savedAt)}</Pill>
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{refs.userById(r.technicianId)?.name}</Td>
                  <Td right>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        open();
                      }}
                    >
                      Mở hồ sơ
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pager pager={pager} />
    </div>
  </>
);

export default EstimatesPage;
