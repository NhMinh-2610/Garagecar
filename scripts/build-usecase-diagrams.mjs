/* Sơ đồ use case nhóm theo tác nhân; cùng mã UC có thể được chi tiết thành a/b. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "docs/report/diagrams");
fs.mkdirSync(dir, { recursive: true });
const escape = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function diagram(filename, title, subtitle, actors, cases, notes) {
  const width = 1100,
    firstY = 175,
    step = 78,
    height = firstY + cases.length * step + 155;
  const boundary = { x: 240, y: 100, w: 620, h: cases.length * step + 80 };
  const actorY = firstY + ((cases.length - 1) * step) / 2;
  const rows = [];
  const text = (x, y, value, size = 21, anchor = "middle", cls = "") =>
    rows.push(
      `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-family="Segoe UI, Arial, sans-serif" class="${cls}">${escape(value)}</text>`,
    );
  rows.push(`<rect width="${width}" height="${height}" fill="white"/>`);
  text(40, 42, title, 27, "start", "title");
  text(40, 73, subtitle, 16, "start", "muted");
  rows.push(
    `<rect x="${boundary.x}" y="${boundary.y}" width="${boundary.w}" height="${boundary.h}" rx="4" fill="#fff" stroke="#47617f" stroke-width="2"/>`,
  );
  text(550, 130, "Hệ thống GarageCar", 20, "middle", "title");
  for (const [index, actor] of actors.entries()) {
    const x = index === 0 ? 105 : 995;
    const targetX = index === 0 ? 350 : 750;
    const startX = index === 0 ? 129 : 971;
    const headY = actorY - 38;
    for (const [i, c] of cases.entries()) {
      if (c.actors.includes(index))
        rows.push(
          `<line x1="${startX}" y1="${actorY}" x2="${targetX}" y2="${firstY + i * step}" stroke="#42617d" stroke-width="1.5"/>`,
        );
    }
    rows.push(
      `<g fill="none" stroke="#203f60" stroke-width="2.3"><circle cx="${x}" cy="${headY}" r="13"/><path d="M${x} ${headY + 13}v45 M${x - 24} ${actorY}h48 M${x} ${headY + 58}l-21 31 M${x} ${headY + 58}l21 31"/></g>`,
    );
    actor.forEach((part, i) => text(x, actorY + 74 + i * 23, part, 18));
  }
  for (const [i, c] of cases.entries()) {
    const y = firstY + i * step;
    rows.push(
      `<ellipse cx="550" cy="${y}" rx="200" ry="30" fill="#edf4fd" stroke="#47617f" stroke-width="1.5"/>`,
    );
    text(550, y + 7, `${c.id} · ${c.label}`, 19);
  }
  notes.forEach((note, i) =>
    text(40, boundary.y + boundary.h + 42 + i * 24, note, 15, "start", "muted"),
  );
  fs.writeFileSync(
    path.join(dir, filename),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>${escape(title)}</title><style>text{fill:#19334e}.title{font-weight:bold}.muted{fill:#52667d}</style>${rows.join("\n")}</svg>\n`,
  );
}

diagram(
  "11-use-case-khach-co-van.svg",
  "Sơ đồ use case 1 · Khách hàng và cố vấn",
  "Các đường nối biểu thị tác nhân có thể thực hiện use case trong phạm vi được phép.",
  [["Khách hàng"], ["Cố vấn", "dịch vụ"]],
  [
    { id: "UC02a", label: "Gửi yêu cầu đặt lịch", actors: [0] },
    { id: "UC14", label: "Theo dõi xe và tiến độ", actors: [0] },
    { id: "UC03a", label: "Xác nhận báo giá", actors: [0, 1] },
    { id: "UC13", label: "Trao đổi qua hộp thư", actors: [0, 1] },
    { id: "UC12a", label: "Xem nhắc bảo dưỡng", actors: [0] },
    { id: "UC02b", label: "Tiếp nhận và lập lượt dịch vụ", actors: [1] },
    { id: "UC03b", label: "Lập báo giá theo phiên bản", actors: [1] },
    { id: "UC04a", label: "Phân công kiểm tra kỹ", actors: [1] },
    { id: "UC05", label: "Chuyển báo giá thành phiếu", actors: [1] },
    { id: "UC07", label: "Nghiệm thu và giao xe", actors: [1] },
    { id: "UC12b", label: "Quản lý và công bố nhắc hạn", actors: [1] },
  ],
  [
    "Đặt lịch có thể thực hiện công khai; với UC03a, cố vấn ghi nhận căn cứ khách đã xác nhận.",
    "Khách xem dữ liệu của mình; cố vấn xử lý theo quyền và phạm vi hội thoại được phân công.",
  ],
);

diagram(
  "12-use-case-tho-ke-toan.svg",
  "Sơ đồ use case 2 · Kỹ thuật viên và kế toán",
  "Các thao tác vẫn phụ thuộc phân công, trạng thái nghiệp vụ và quyền đang được cấp.",
  [["Kỹ thuật viên"], ["Kế toán"]],
  [
    { id: "UC04b", label: "Kiểm tra và ghi chẩn đoán", actors: [0] },
    { id: "UC06", label: "Thực hiện phiếu và nộp bằng chứng", actors: [0] },
    { id: "UC09a", label: "Tra cứu vật tư", actors: [0] },
    { id: "UC12c", label: "Xem bảo dưỡng xe được giao", actors: [0] },
    { id: "UC11a", label: "Xem lịch làm và gửi đơn nghỉ", actors: [0, 1] },
    { id: "UC08", label: "Thu tiền và xem chứng từ", actors: [1] },
    { id: "UC10a", label: "Lập và ghi chi đề nghị", actors: [1] },
    { id: "UC10b", label: "Xem báo cáo doanh thu", actors: [1] },
  ],
  [
    "Thợ cập nhật công việc được giao; kế toán ghi nhận thu đủ khi phiếu đáp ứng điều kiện.",
    "Đề nghị chi chỉ được ghi chi sau khi quản trị viên khác người lập phê duyệt.",
  ],
);

diagram(
  "13-use-case-quan-tri.svg",
  "Sơ đồ use case 3 · Quản trị viên",
  "Quyền mặc định có thể bị khóa bớt cho từng tài khoản.",
  [["Quản trị viên"]],
  [
    { id: "UC01", label: "Quản lý tài khoản và quyền", actors: [0] },
    { id: "UC02b", label: "Quản lý xe và tiếp nhận", actors: [0] },
    { id: "UC03b", label: "Lập và theo dõi báo giá", actors: [0] },
    { id: "UC04a–07", label: "Điều phối, nghiệm thu và giao xe", actors: [0] },
    { id: "UC09", label: "Quản lý vật tư và danh mục", actors: [0] },
    { id: "UC08–10", label: "Thu tiền, duyệt chi và báo cáo", actors: [0] },
    { id: "UC11", label: "Quản lý nhân sự, ca và chứng chỉ", actors: [0] },
    { id: "UC12", label: "Quản lý lịch và nhắc bảo dưỡng", actors: [0] },
    { id: "UC13", label: "Phân công và trả lời hội thoại", actors: [0] },
  ],
  [
    "Nhân sự là chức năng của quản trị viên, không phải một vai trò đăng nhập riêng.",
    "Việc tự duyệt chi, nghỉ phép hoặc tự xác minh chứng chỉ bị giới hạn theo quy tắc nghiệp vụ.",
  ],
);
console.log("Đã tạo ba sơ đồ use case.");
