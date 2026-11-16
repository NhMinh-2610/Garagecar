# Kiểm thử, trình diễn và kế hoạch

## 1. Môi trường và phạm vi kiểm tra

Rà soát mã nguồn ngày 28–29/10/2026 trên Windows, Python `.venv`, PostgreSQL và Node/jsdom. Backend tests tạo schema tạm `garage_test_*`; frontend tests nạp HTML/script thật vào jsdom. Không áp dụng migration vào database nghiệp vụ đang dùng trong đợt dọn code.

Kết quả bản hiện tại: **37/37 kiểm thử backend**, **58/58 kiểm thử frontend**, **435 liên kết/tệp JavaScript hợp lệ**, Ruff lint và format đạt, Prettier format đạt. Pytest có cảnh báo `python-jose` dùng `datetime.utcnow()` đã deprecated; các test vẫn đạt. [Báo cáo 10/10](../verification.md) là kết quả lịch sử, gồm các chức năng trước khi bỏ AI và vai trò HR; không dùng số liệu đó cho bản hiện tại.

## 2. Ma trận truy vết yêu cầu → kiểm thử

| Yêu cầu  | Kiểm thử tự động tiêu biểu                                                                                                     | Điều cần chứng minh                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| FR01–02  | `test_workflow.py`, `test_project_scope.py`                                                                                    | Tài khoản, phiên, liên kết, 5 vai trò, no-AI, migration HR   |
| FR03     | `test_booking_persists_and_admin_controls_status`, tests portal booking                                                        | Lịch lưu thật, quyền cập nhật trạng thái                     |
| FR04–07  | `test_quotation_consent_stock_qc_and_cashier_permissions`, `test_stale_quote_and_price_change_never_reserve_stock`             | Phê duyệt đúng phiên bản, tạo phiếu và kho nguyên tử         |
| FR06     | `test_reassigning_quote_ticket_updates_mechanic_access_for_both_workspaces`                                                    | Đổi phân công đồng bộ quyền của hai thợ                      |
| FR08     | `test_evidence_identity_privacy_and_rework_round`                                                                              | Ảnh riêng tư, đủ bằng chứng, mở lại yêu cầu lần mới          |
| FR09–11  | `test_complete_workflow_and_permissions`, `test_receipts_expenses_and_cross_role_controls`                                     | Hoàn thành/QC/thu riêng biệt, một receipt                    |
| FR10     | `test_stock_rollback_edit_and_cancel`, `test_concurrent_stock_reservation`                                                     | Thiếu tồn/đồng thời không tạo tồn âm hoặc lưu dở             |
| FR12–13  | `test_receipts_expenses_and_cross_role_controls`, `test_stock_receipt_ledger_and_revenue_date`                                 | Không tự duyệt/chi lặp, tổng hợp đúng ngày thu               |
| FR14     | `test_shifts_leave_and_ev_qualifications`, frontend ca/chứng chỉ/hồ sơ                                                         | Xung đột lịch, chứng chỉ cao áp, admin quản lý HR            |
| FR15–16  | `test_calendar_or_threshold_and_actions`, `test_exact_scope_and_stale_odometer`, `test_maintenance_review_ownership_and_dedup` | Chu kỳ, cấu hình, quyền và chống nhắc trùng                  |
| FR17     | `test_messaging.py`, tests support chat trong `portals.test.cjs`                                                               | Riêng tư, phân công, retry, đọc, giữ nháp                    |
| FR18     | PWA/cache tests, `workspace-shell.test.cjs`, `compact-modules.test.cjs`                                                        | Tài nguyên, điều hướng, bản nháp và không cache API          |
| FR19     | Chưa có                                                                                                                        | Cần app riêng và bộ kiểm thử thiết bị tương ứng              |
| NFR02/06 | `test_visit_queries_are_batched_and_find_active_work_beyond_recent_history`                                                    | Truy vấn theo lô, tìm đúng lượt; không tương đương load test |

Các file backend ở [be/tests](../../be/tests), frontend ở [tests](../../tests).

## 3. Bộ ca kiểm thử dùng khi báo cáo

| Mã   | Đầu vào/thao tác                              | Kết quả mong đợi                                                        |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------- |
| TC01 | Khách gọi API danh sách tài khoản             | 403; không trả dữ liệu tài khoản                                        |
| TC02 | Dùng token trước khi khóa tài khoản           | 401 sau khi khóa/thu hồi phiên                                          |
| TC03 | Admin tạo tài khoản `hr`                      | Bị từ chối; UI chỉ có 5 vai trò                                         |
| TC04 | Migration HR active/inactive có hồ sơ         | Giữ ID/FK, lưu audit, admin ở trạng thái khóa, token cũ không dùng được |
| TC05 | Admin chỉ có hr cập nhật hồ sơ                | Lưu được, không cần gọi API accounts/reception; lỗi giữ nháp            |
| TC06 | Khách khác mở phiếu/ảnh/hội thoại             | Bị từ chối hoặc không có trong danh sách                                |
| TC07 | Chuyển báo giá chưa duyệt                     | Không tạo phiếu hoặc trừ kho                                            |
| TC08 | Báo giá duyệt nhưng kho không đủ/giá thay đổi | Lỗi; tồn và lượt giữ nguyên trước thao tác                              |
| TC09 | Hai request cùng lấy vật tư cuối              | Không xuất vượt tồn; không tồn âm                                       |
| TC10 | Thợ xác nhận hạng mục thiếu ảnh/mã sai        | Không đánh dấu xong                                                     |
| TC11 | Mở lại hạng mục rồi dùng bằng chứng cũ        | Cần bằng chứng ở lần thực hiện mới                                      |
| TC12 | Cao áp nhưng không có chứng chỉ hợp lệ        | Không xác nhận công việc liên quan                                      |
| TC13 | Thu phiếu theo lượt trước QC                  | Bị chặn                                                                 |
| TC14 | Thu hợp lệ rồi gửi lại                        | Chỉ một receipt, tiền không nhân đôi                                    |
| TC15 | Tự duyệt đề nghị chi/nghỉ                     | Bị chặn                                                                 |
| TC16 | Phân ca trùng hoặc trùng nghỉ đã duyệt        | Bị chặn                                                                 |
| TC17 | Nhắc cùng xe/lịch/chu kỳ nhiều lần            | Không nhân đôi; khách chỉ thấy published                                |
| TC18 | Gửi tin rồi mất response và retry UUID cũ     | Một tin duy nhất, giữ nội dung để thử lại                               |
| TC19 | Refresh trong lúc gõ biểu mẫu                 | Không mất nội dung/focus đang nhập                                      |
| TC20 | Gọi `/api/ai/chat`, kiểm tra menu khách       | API 404; không còn menu/script hỏi AI                                   |
| TC21 | Cài PWA, chụp ảnh, in trên điện thoại thật    | Ghi thiết bị/trình duyệt/kết quả khi thử; chưa kết luận từ jsdom        |

## 4. Lệnh chạy kiểm tra

```powershell
.\.venv\Scripts\python.exe -m ruff check be scripts
.\.venv\Scripts\python.exe -m ruff format --check be scripts
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd run check:files
npm.cmd test
npm.cmd run format:check
```

Khi cần kiểm tra HTTP trên bản đang chạy ở DB demo: `python scripts/smoke-test.py --demo`. Script đăng nhập và đọc API; không thay các ca ghi/rollback. Không lấy kết quả HTTP/Docker cũ làm kết quả lần này.

## 5. Kịch bản demo đề xuất

Chuẩn bị DB thử riêng đã migration, `seed.py --demo`, năm tài khoản mẫu, hai phiên trình duyệt tách biệt. Ảnh minh họa có nhãn DEMO; không dùng giấy tờ hay dữ liệu khách thật. Ngày dữ liệu neo vào lần seed đầu, không tự cập nhật khi seed lại.

| Thứ tự | Vai trò/thao tác                             | Điều trình bày                                     |
| ------ | -------------------------------------------- | -------------------------------------------------- |
| 1      | Admin mở dashboard và nhóm menu              | Tổng quan 5 vai trò, nhân sự ở admin, không AI     |
| 2      | Cố vấn mở xe/lượt, lập báo giá sơ bộ         | Hồ sơ, bước tiếp theo, giá công/vật tư             |
| 3      | Khách xem và xác nhận; thợ kiểm tra kỹ       | Quyền sở hữu, phân công và chẩn đoán               |
| 4      | Cố vấn lập final; khách duyệt đúng phiên bản | Lịch sử quyết định và chi phí                      |
| 5      | Cố vấn chuyển phiếu; kiểm tra tồn trước/sau  | Giao dịch phiếu/kho và thợ được giao               |
| 6      | Thợ bắt đầu, nộp ảnh/mã, xác nhận hạng mục   | Bằng chứng, lỗi thiếu mã/ảnh và tiến độ            |
| 7      | Cố vấn QC; kế toán thu; thử gửi thu lặp      | Tách trách nhiệm, một chứng từ                     |
| 8      | Cố vấn giao xe và follow-up                  | Kết thúc lượt và chăm sóc sau sửa                  |
| 9      | Admin mở hồ sơ, ca, chứng chỉ; thợ xin nghỉ  | Nhân sự đã gộp, chặn xung đột/tự duyệt             |
| 10     | Khách xem nhắc đã công bố, nhắn cố vấn       | Bảo dưỡng theo quy tắc, hội thoại giữa người dùng  |
| 11     | Mở PWA trên thiết bị đã kiểm tra             | Cài qua trình duyệt, cần mạng, app riêng còn thiếu |

Nếu không đủ thời gian demo toàn bộ, chọn một luồng sửa hoàn chỉnh và hai tình huống bị chặn: chưa QC không thu; sai mã không hoàn thành. Phần ca/nhắc/chat dùng kịch bản có sẵn. Không sửa trực tiếp DB để bỏ qua điều kiện trong lúc trình bày.

## 6. Kế hoạch 17 tuần để đối chiếu phiếu nhiệm vụ

Đây là **khung kế hoạch**, không phải xác nhận đã làm đủ từng tuần. Không đổi ngày bắt đầu/kết thúc trong phiếu; cần đối chiếu lại lịch thực tế với GVHD. Các phần đã có dùng để rà soát/nâng chất lượng, phần app riêng cần triển khai thật.

| Tuần | Công việc                                            | Sản phẩm/mốc kiểm tra                                  |
| ---- | ---------------------------------------------------- | ------------------------------------------------------ |
| 1    | Chốt bài toán, quy trình, 5 vai trò và đối tượng app | Phạm vi, biên bản trao đổi, danh mục UC                |
| 2    | Phân tích yêu cầu và quy tắc                         | FR/NFR/BR, đặc tả use case, tiêu chí nghiệm thu        |
| 3    | Thiết kế dữ liệu, kiến trúc và giao diện             | ERD, API, wireframe, kế hoạch migration                |
| 4    | Tài khoản/quyền, môi trường và dữ liệu mẫu           | Demo đăng nhập 5 vai trò, test truy cập                |
| 5    | Xe, lịch hẹn và tiếp nhận                            | Demo mở lượt và dữ liệu liên kết                       |
| 6    | Báo giá sơ bộ/chính thức và quyết định               | Demo khách duyệt phiên bản                             |
| 7    | Phiếu sửa, kho và giao dịch                          | Test đồng thời/rollback, ledger                        |
| 8    | Ảnh/mã và nghiệm thu                                 | Demo bằng chứng và QC                                  |
| 9    | Thu–chi và doanh thu                                 | Receipt, không tự duyệt, tổng hợp kỳ                   |
| 10   | Nhân sự gộp admin                                    | Hồ sơ/ca/nghỉ/chứng chỉ, migration HR                  |
| 11   | Bảo dưỡng và nhắc hạn                                | Nguồn được xác minh, quy tắc, công bố                  |
| 12   | Hộp thư và PWA                                       | Retry, bản nháp, cache an toàn, demo điện thoại        |
| 13   | App riêng: cấu trúc, đăng nhập, API chung            | Bản cài thử và kiểm thử phiên/quyền                    |
| 14   | App riêng: luồng chính theo đối tượng đã chốt        | Demo khách/thợ phù hợp phiếu, xử lý lỗi mạng           |
| 15   | Tích hợp, kiểm thử và đánh giá thực tế               | Kết quả thiết bị, tiền/tồn, vấn đề còn lại             |
| 16   | Hoàn thiện báo cáo, sơ đồ, hướng dẫn                 | Báo cáo theo mẫu, gói source, backup/demo              |
| 17   | Tổng duyệt và bàn giao                               | Demo ổn định, slide, đối chiếu tiêu chí, xác nhận GVHD |

## 7. Sản phẩm bàn giao và việc cần bổ sung

| Sản phẩm                                      | Hiện trạng                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Source web/PWA/backend và migration           | Có trong repository; migration mới cần áp dụng khi nâng cấp DB đang dùng                        |
| Hướng dẫn đọc code/chạy/vận hành              | Có tại docs và README                                                                           |
| Yêu cầu, thiết kế, bảng dữ liệu/API, 10 sơ đồ | Có trong bộ tài liệu này                                                                        |
| Test tự động và dữ liệu demo                  | Có; ghi kết quả cuối sau chạy thực tế                                                           |
| App di động riêng                             | Chưa có; không thể coi PWA là đã hoàn thành mục này                                             |
| Số liệu khảo sát, đo hiệu năng, thiết bị thật | Chưa được cung cấp/đo đầy đủ; cần bổ sung thực nghiệm                                           |
| Báo cáo Word theo mẫu, slide, chữ ký/nhận xét | Bộ này cung cấp nội dung kỹ thuật; phần trình bày/hành chính cần hoàn thiện theo mẫu nộp cụ thể |

Mục tiêu đánh giá là đúng quy trình, quyền và dữ liệu. Số lượng test đạt không phải chứng nhận mọi tình huống production hoặc khả năng phục vụ hàng trăm người dùng đồng thời.
