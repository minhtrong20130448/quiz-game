# Quiz Game — Web App Trắc Nghiệm

> ⚠️ **BẮT BUỘC**: Mọi AI (Claude Code / Cursor / …) khi thực hiện bất kỳ step nào trong dự án này **phải đọc toàn bộ file README.md này trước khi viết một dòng code**, và tuân thủ nghiêm ngặt các quy tắc bên dưới. Không tự ý làm khác đi dù "tối ưu hơn" — nếu thấy cần thay đổi, phải hỏi lại người dùng trước.

---

## 1. Giới thiệu

Web app chơi quiz trắc nghiệm dùng cho **nhiều môn học/chủ đề khác nhau**. Admin import câu hỏi từ file Excel, người chơi nhập tên → chọn chủ đề → chơi từng câu → xem kết quả → xem bảng xếp hạng.

Kế hoạch chi tiết (9 step, mỗi step là 1 prompt hoàn chỉnh): **[`Plan/quiz-web-app-PLAN.md`](Plan/quiz-web-app-PLAN.md)**.
Dữ liệu câu hỏi gốc (tham khảo): **[`Data/TracNghiem.docx`](Data/TracNghiem.docx)**.

**Nguyên tắc làm việc:** đi tuần tự **Step 1 → 9** theo Plan, mỗi lần chỉ làm đúng 1 step, dừng lại để người dùng duyệt rồi mới sang step kế tiếp. Không nhảy cóc, không gộp step, không tự thêm tính năng ngoài phạm vi step đang làm.

---

## 2. Công nghệ sử dụng

| Thành phần | Lựa chọn |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Giao diện | Tailwind CSS |
| Cơ sở dữ liệu | Supabase (Postgres) |
| Đọc/ghi Excel | SheetJS (`xlsx`) |
| Hosting | Vercel (Hobby – miễn phí) |

Không đổi sang công nghệ khác (VD: Firebase, MongoDB, MUI...) trừ khi người dùng yêu cầu rõ ràng.

---

## 3. Cấu trúc thư mục

Khung thư mục (các thư mục còn trống chỉ có `.gitkeep` sẽ được điền dần theo từng step trong Plan; **Step 1 đã xong** phần nền tảng):

```
03.Quiz/
├── Plan/
│   └── quiz-web-app-PLAN.md      # Kế hoạch 9 step — nguồn sự thật duy nhất về scope
├── Data/
│   └── TracNghiem.docx           # Bộ câu hỏi gốc (tham khảo, chuyển sang Excel qua scripts/md-to-xlsx.mjs nếu cần)
├── README.md                     # File này — quy tắc bắt buộc
├── AGENTS.md / CLAUDE.md          # Next.js 16 TỰ SINH (bởi `next dev`) — trỏ tới docs trong node_modules/next/dist/docs. Không xoá.
├── src/
│   ├── app/
│   │   ├── page.tsx              # (Step 4) Trang chủ: nhập tên + chọn chủ đề
│   │   ├── quiz/                 # (Step 5) Màn chơi — hỏi từng câu, chấm điểm
│   │   ├── result/                # (Step 6) Kết quả + xem lại câu sai
│   │   ├── leaderboard/           # (Step 7) Bảng xếp hạng
│   │   ├── admin/                 # (Step 8) Trang quản trị
│   │   └── api/
│   │       ├── topics/            # (Step 3) GET danh sách chủ đề
│   │       ├── questions/         # (Step 3) GET câu hỏi theo chủ đề
│   │       ├── scores/            # (Step 7) POST lưu điểm
│   │       ├── leaderboard/       # (Step 7) GET bảng xếp hạng
│   │       └── admin/
│   │           ├── scores/        # (Step 8) GET toàn bộ lượt chơi (cần mật khẩu)
│   │           └── questions/     # (Step 8) POST import / DELETE xoá ngân hàng câu hỏi
│   ├── components/                # Component UI dùng chung (Button, Card, ProgressBar, OptionButton, ...)
│   ├── lib/
│   │   └── supabaseAdmin.ts       # (Step 1) Supabase client — CHỈ dùng server-side
│   └── styles/                    # CSS bổ sung ngoài Tailwind (nếu cần)
├── supabase/
│   └── schema.sql                 # (Step 2) SQL tạo bảng questions + scores
├── scripts/
│   └── md-to-xlsx.mjs             # (Tuỳ chọn, mục 5 trong Plan) Chuyển Data/*.md → Excel
├── public/
│   └── images/                    # Ảnh, favicon, asset tĩnh
├── .env.local.example             # (Step 1) Khai báo biến môi trường cần thiết
└── .gitignore
```

> **Step 1 đã hoàn thành** (xem mục 8 bên dưới để biết chi tiết version, lý do ghim version, và cách chạy thử).

---

## 4. Quy tắc bắt buộc khi code (AI phải tuân thủ)

1. **Bám sát Plan, đúng thứ tự step.** Mỗi lần chỉ thực hiện đúng 1 step trong `Plan/quiz-web-app-PLAN.md`. Không tự ý làm trước step sau, không gộp nhiều step vào 1 lần trừ khi người dùng yêu cầu.
2. **Không đổi tên bảng/cột DB, route API, hay cấu trúc dữ liệu** đã định nghĩa trong Plan (`questions`, `scores`, các endpoint `/api/...`) nếu không được yêu cầu.
3. **Bảo mật khoá bí mật:** `SUPABASE_SERVICE_ROLE_KEY` và `ADMIN_PASSWORD` chỉ được dùng trong API routes (server-side). **Tuyệt đối cấm** import `src/lib/supabaseAdmin.ts` vào client component (`"use client"`). Không hardcode secret trong code — luôn đọc qua `process.env`. Không commit `.env.local`.
4. **TypeScript nghiêm túc:** không dùng `any` tuỳ tiện; định nghĩa type/interface rõ ràng cho Question, Score, API response.
5. **Mobile-first, responsive:** container căn giữa, rộng tối đa ~640–800px cho các trang chơi; trang admin có thể rộng hơn cho bảng dữ liệu.
6. **Không thêm tính năng ngoài phạm vi step đang làm** (không scope creep). Không tự thêm thư viện UI ngoài Tailwind (không MUI, Ant Design, Chakra...) trừ khi được yêu cầu.
7. **Code tối giản, không comment thừa:** không viết comment giải thích cái hiển nhiên; chỉ comment khi có lý do ngầm không rõ ràng (ví dụ: vì sao bỏ qua RLS, vì sao xáo mảng theo cách cụ thể).
8. **Kiểm tra trước khi báo hoàn thành:** sau mỗi step, chạy `npm run dev` (hoặc lệnh build/test phù hợp) và xác nhận không lỗi trước khi coi step đó là xong.
9. **Không tự động deploy / push / tạo biến môi trường thật** lên Vercel hay Supabase thay người dùng — chỉ hướng dẫn, để người dùng tự làm ở Step 9 (hoặc xác nhận rõ trước khi làm thay).
10. **Dữ liệu câu hỏi luôn động từ DB**, không hardcode câu hỏi cứng trong source code (kể cả lúc test — dùng file Excel mẫu import qua admin).

---

## 5. Quy tắc thiết kế giao diện (UI/UX) — Bảng màu chủ đạo

**Phong cách:** *Vibrant Purple/Indigo* — năng động, hiện đại, kiểu gamified (giống Kahoot), thu hút mọi lứa tuổi người chơi.

### Bảng màu chính thức (dùng xuyên suốt, khai báo trong `tailwind.config`)

| Vai trò | Mã màu | Dùng cho |
|---|---|---|
| **Primary** | `#6366F1` (Indigo 500) | Nút chính, header, viền active, link |
| **Primary Dark** | `#4338CA` (Indigo 700) | Hover/active state của nút primary |
| **Secondary** | `#8B5CF6` (Violet 500) | Gradient nền, badge, điểm nhấn phụ |
| **Accent** | `#F59E0B` (Amber 500) | Điểm số, huy hiệu, ngôi sao, highlight thành tích |
| **Success** | `#22C55E` (Green 500) | Đáp án đúng, thông báo thành công |
| **Danger** | `#EF4444` (Red 500) | Đáp án sai, thông báo lỗi/xoá |
| **Background** | `#F8FAFC` (Slate 50) nền trang; gradient `from-indigo-500 to-violet-500` cho hero/header | Nền tổng thể |
| **Surface (card)** | `#FFFFFF` bo góc lớn + đổ bóng mềm | Card câu hỏi, card kết quả |
| **Text chính** | `#1E293B` (Slate 800) | Nội dung chữ |
| **Text phụ** | `#64748B` (Slate 500) | Chú thích, mô tả phụ |

### Nguyên tắc thiết kế cụ thể

- **Bo góc lớn:** `rounded-2xl` trở lên cho card, nút, ô nhập — tạo cảm giác thân thiện, mềm mại.
- **Đổ bóng mềm:** `shadow-lg`/`shadow-xl` nhẹ nhàng cho card nổi lên khỏi nền, tránh viền cứng.
- **Gradient có kiểm soát:** dùng gradient Indigo → Violet cho header/hero/nút CTA chính; phần còn lại giữ nền sáng, tránh loè loẹt.
- **Phản hồi tức thời khi chọn đáp án:** tô `Success` (xanh) cho đáp án đúng, `Danger` (đỏ) cho đáp án chọn sai, có transition/animation ngắn (scale hoặc fade, ~150–250ms) — không giật cục.
- **Thanh tiến độ (progress bar)** sinh động, dùng gradient Primary → Secondary, hiển thị rõ số câu hiện tại/tổng số.
- **Nút bấm to, dễ chạm** (tối thiểu 44px chiều cao) — ưu tiên trải nghiệm mobile.
- **Điểm số / kết quả nổi bật:** dùng màu Accent (vàng cam) + số to, có hiệu ứng nhẹ (ví dụ đếm số tăng dần) để tạo cảm giác thành tựu.
- **Font:** sans-serif rõ ràng, dễ đọc (VD: `Inter`, hoặc font mặc định của Next.js/Tailwind), cỡ chữ đủ lớn cho câu hỏi (≥16px, tiêu đề câu hỏi có thể 18–20px).
- **Trạng thái rỗng/lỗi** (chưa có câu hỏi, sai mật khẩu...) phải có thông báo rõ ràng, thân thiện, đúng tông màu (Danger/neutral), không để trắng trơn khó hiểu.
- **Nhất quán:** mọi trang (`/`, `/quiz`, `/result`, `/leaderboard`, `/admin`) dùng chung bộ màu và component từ `src/components/`, không tự chế màu mới ngoài bảng trên. Nếu cần thêm sắc thái, chỉ dùng các bậc màu liền kề trong cùng họ (VD: `indigo-400`, `violet-600`) của Tailwind.

### Cách khai báo màu trong code (Tailwind v4)

Dự án dùng **Tailwind CSS v4** — không có file `tailwind.config.ts`. Bảng màu ở trên được khai báo bằng CSS token trong **`src/styles/globals.css`** qua khối `@theme { --color-primary: ...; }`, Tailwind tự sinh các class tương ứng: `bg-primary`, `text-accent`, `border-danger`, `from-primary`, `to-secondary`, v.v. Khi cần thêm token màu mới, sửa đúng 1 chỗ này, không khai báo màu rải rác trong từng component.

---

## 6. Quy trình làm việc

1. Đọc `Plan/quiz-web-app-PLAN.md` để biết step tiếp theo cần làm.
2. Đọc README.md này (file hiện tại) để nắm quy tắc code + quy tắc thiết kế trước khi bắt tay vào step đó.
3. Thực hiện đúng phạm vi của step, theo "Tiêu chí hoàn thành" ghi trong Plan.
4. Kiểm tra chạy được (`npm run dev`, build nếu cần) trước khi báo hoàn thành step.
5. Dừng lại, chờ người dùng duyệt trước khi sang step kế tiếp.

---

## 7. Biến môi trường

Khai báo tại `.env.local.example`, gồm:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`

Không bao giờ commit file `.env.local` thật lên Git. Copy `.env.local.example` → `.env.local` rồi điền giá trị thật (chưa cần cho tới Step 3, khi bắt đầu gọi Supabase).

---

## 8. Nhật ký kỹ thuật Step 1 — version đã ghim & lý do

Tại thời điểm khởi tạo (2026-08), các gói mới nhất trên npm là bản rất mới (Next 16, React 19.2, TypeScript 7, ESLint 10, Tailwind 4.3). Một số kết hợp **chưa tương thích với nhau**, đã kiểm chứng thực tế và xử lý như sau — **không tự ý "nâng cấp lên latest"** các gói dưới đây nếu chưa kiểm tra lại tương thích:

| Gói | Version ghim | Lý do |
|---|---|---|
| `typescript` | `6.0.3` (không dùng `7.x`) | `typescript-eslint` (dependency của `eslint-config-next`) chưa hỗ trợ TypeScript 7 (bản compiler native mới) → lint crash ngay khi load config. |
| `eslint` | `9.39.5` (dist-tag `maintenance`, không dùng `10.x`) | ESLint 10 đổi API nội bộ (`scopeManager.addGlobals`), `eslint-config-next` hiện tại chưa theo kịp → lỗi `TypeError: scopeManager.addGlobals is not a function` khi chạy `eslint .`. |
| `xlsx` (SheetJS) | bản npm registry hiện tại, **không** cài từ CDN riêng của SheetJS | `npm audit` báo 1 lỗ hổng mức cao (Prototype Pollution, ReDoS), npm chưa có bản vá. Đã quyết định **chấp nhận rủi ro** vì phạm vi dùng chỉ giới hạn ở trang `/admin` (import/export Excel, có mật khẩu bảo vệ), không phơi ra người chơi thường. Nếu sau này mở rộng cho phép người dùng thường upload Excel, cần xét lại (đổi sang bản vá qua CDN SheetJS hoặc thư viện khác). |
| Tailwind CSS | `4.x` (CSS-first, không có `tailwind.config.ts`) | Đây là bản mới nhất, dùng cách khai báo theme mới (`@theme` trong CSS) — xem mục 5. |

**Cách chạy thử cục bộ:**
```
npm install
npm run dev     # http://localhost:3000
npm run build   # kiểm tra build production + typecheck + lint
npx eslint .     # chỉ lint
```

### Next.js 16 — breaking changes cần nhớ cho các step sau

Dự án dùng Next.js 16 (mới hơn nhiều so với kiến thức huấn luyện thông thường của AI). Next tự sinh `AGENTS.md`/`CLAUDE.md` ở gốc dự án (do `next dev` ghi lại mỗi lần chạy — **không xoá**, không phải file thừa) yêu cầu đọc tài liệu đóng gói sẵn trong `node_modules/next/dist/docs/` trước khi code. Hai điểm chắc chắn ảnh hưởng tới các step tiếp theo trong Plan:

- **Async Request APIs (bắt buộc từ v16):** `params` và `searchParams` trong `page.tsx`/`layout.tsx`/`route.ts` giờ luôn là `Promise` — phải `await`. Ảnh hưởng trực tiếp tới **Step 4** (trang chủ nếu dùng `searchParams`) và bất kỳ route động `[id]` nào phát sinh sau này. Các route API đọc query qua `request.nextUrl.searchParams` (Step 3, 7) không thuộc diện này (không phải là prop `searchParams` của page).
- **`next lint` đã bị gỡ bỏ**, dự án dùng thẳng ESLint flat config (`eslint.config.mjs`) — đã cấu hình sẵn ở Step 1, chạy bằng `npx eslint .`, không dùng `next lint`.

Nếu AI thực hiện step sau thấy hành vi khác với hiểu biết cũ về Next.js (13–15), hãy đọc `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` trước khi kết luận là lỗi.
