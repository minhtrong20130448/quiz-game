import * as XLSX from "xlsx";

const CANONICAL_HEADERS = [
  "topic",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "answer",
  "source",
] as const;

export interface RawImportRow {
  topic: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
  source: string;
}

export interface ValidImportRow {
  topic: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: "A" | "B" | "C" | "D";
  source: string | null;
}

/** Đọc sheet "Questions" của file .xlsx (chạy hoàn toàn trên client). */
export async function parseQuestionsSheet(file: File): Promise<RawImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets["Questions"];

  if (!sheet) {
    throw new Error('Không tìm thấy sheet "Questions" trong file.');
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (grid.length === 0) return [];

  const headerRow = grid[0].map((cell) => String(cell).trim().toLowerCase());
  const columnIndex = new Map<string, number>();
  CANONICAL_HEADERS.forEach((key) => {
    const idx = headerRow.indexOf(key);
    if (idx !== -1) columnIndex.set(key, idx);
  });

  const dataRows = grid.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ""));

  return dataRows.map((r) => {
    const row = {} as RawImportRow;
    CANONICAL_HEADERS.forEach((key) => {
      const idx = columnIndex.get(key);
      row[key] = idx !== undefined ? String(r[idx] ?? "").trim() : "";
    });
    return row;
  });
}

export function validateImportRow(
  row: RawImportRow,
  index: number,
): { data: ValidImportRow } | { error: string } {
  const topic = row.topic.trim();
  const question = row.question.trim();
  const option_a = row.option_a.trim();
  const option_b = row.option_b.trim();
  const option_c = row.option_c.trim();
  const option_d = row.option_d.trim();
  const answer = row.answer.trim().toUpperCase();
  const source = row.source.trim() || null;

  const rowNumber = index + 2; // dòng 1 là header, dữ liệu bắt đầu từ dòng 2

  if (!topic || !question || !option_a || !option_b || !option_c || !option_d) {
    return { error: `Dòng ${rowNumber}: thiếu topic/question/phương án.` };
  }
  if (!["A", "B", "C", "D"].includes(answer)) {
    return { error: `Dòng ${rowNumber}: answer phải là A/B/C/D (đang là "${row.answer}").` };
  }

  return {
    data: {
      topic,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      answer: answer as "A" | "B" | "C" | "D",
      source,
    },
  };
}

/** Tạo và tải file template-cau-hoi.xlsx (chạy hoàn toàn trên client). */
export function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  const questionsData = [
    ["topic", "question", "option_a", "option_b", "option_c", "option_d", "answer", "source"],
    ["Toán lớp 1", "1 + 1 = ?", "1", "2", "3", "4", "B", "Phép cộng cơ bản"],
    ["Toán lớp 1", "2 + 2 = ?", "3", "4", "5", "6", "B", ""],
  ];
  const questionsSheet = XLSX.utils.aoa_to_sheet(questionsData);
  XLSX.utils.book_append_sheet(wb, questionsSheet, "Questions");

  const guideData = [
    ["Hướng dẫn điền file câu hỏi"],
    [],
    ["Cột", "Bắt buộc", "Ý nghĩa"],
    ["topic", "Có", "Tên chủ đề/môn học (VD: Toán lớp 1)"],
    ["question", "Có", "Nội dung câu hỏi"],
    ["option_a", "Có", "Phương án A"],
    ["option_b", "Có", "Phương án B"],
    ["option_c", "Có", "Phương án C"],
    ["option_d", "Có", "Phương án D"],
    ["answer", "Có", "Đáp án đúng — chỉ nhận A, B, C hoặc D"],
    ["source", "Không", "Trích đáp án gốc / giải thích (có thể để trống)"],
    [],
    ["Lưu ý:"],
    ["- Không đổi tên dòng tiêu đề (dòng 1) ở sheet Questions."],
    ["- Không để trống topic/question/option_a..d/answer."],
    ["- Có thể xoá 2 dòng ví dụ trước khi điền câu hỏi thật."],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideData);
  XLSX.utils.book_append_sheet(wb, guideSheet, "Huong_dan");

  XLSX.writeFile(wb, "template-cau-hoi.xlsx");
}
