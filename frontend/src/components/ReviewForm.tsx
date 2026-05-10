import { useState } from "react";
import type { CreateReviewPayload } from "@/types/review";
import { Rating } from "./Rating";
import { ApiError } from "@/api/client";
import { input as inputStyle } from "@/theme";

interface Props {
  courseId: number;
  onSubmit: (payload: CreateReviewPayload) => Promise<void>;
}

const GRADES = ["A", "B+", "B", "C+", "C", "D+", "D", "F", "W", ""];
const CURRENT_YEAR = new Date().getFullYear() + 543;

const field: React.CSSProperties = {
  display: "block",
  marginBottom: "0.25rem",
  fontWeight: 700,
  fontSize: "0.875rem",
  color: "var(--cmu-text-sub)",
};
const selectStyle: React.CSSProperties = { ...inputStyle, width: "auto" };

export function ReviewForm({ courseId: _courseId, onSubmit }: Props) {
  const [rating, setRating] = useState(0);
  const [grade, setGrade] = useState("");
  const [academicYear, setAcademicYear] = useState(CURRENT_YEAR);
  const [semester, setSemester] = useState(1);
  const [content, setContent] = useState("");
  const [programPreset, setProgramPreset] = useState("");
  const [programCustom, setProgramCustom] = useState("");
  const program = programPreset === "อื่นๆ" ? programCustom : programPreset;
  const [categoryPreset, setCategoryPreset] = useState("");
  const [categoryCustom, setCategoryCustom] = useState("");
  const category = categoryPreset === "อื่นๆ" ? categoryCustom : categoryPreset;
  const [professor, setProfessor] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError("กรุณาให้คะแนนดาว");
      return;
    }
    if (content.trim().length < 10) {
      setError("รีวิวต้องมีอย่างน้อย 10 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        rating,
        grade,
        academic_year: academicYear,
        semester,
        content: content.trim(),
        program,
        category,
        professor,
        reviewer_name: reviewerName.trim() || undefined,
      });
      setSuccess(true);
      setRating(0);
      setGrade("");
      setContent("");
      setProgramPreset("");
      setProgramCustom("");
      setCategoryPreset("");
      setCategoryCustom("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError("คุณได้รีวิววิชานี้ในเทอมนี้แล้ว");
        else if (err.status === 429)
          setError("ส่งรีวิวบ่อยเกินไป กรุณารอสักครู่");
        else setError(err.message);
      } else {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        style={{
          padding: "1rem",
          background: "var(--cmu-success-bg)",
          borderRadius: 8,
          border: "1px solid var(--cmu-success-border)",
          color: "var(--cmu-success)",
          fontWeight: 600,
        }}
      >
        ขอบคุณสำหรับรีวิว!{" "}
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--cmu-success)",
            textDecoration: "underline",
            fontWeight: 600,
          }}
          onClick={() => setSuccess(false)}
        >
          รีวิวอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
    >
      <div>
        <label style={field}>แนะนำให้คนอื่นลงเรียนไหม?</label>
        <Rating value={rating} onChange={setRating} />
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <label style={field}>เกรดที่ได้</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={selectStyle}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g || "— ไม่ระบุ —"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={field}>ปีการศึกษา *</label>
          <input
            type="number"
            value={academicYear}
            min={2560}
            max={CURRENT_YEAR}
            onChange={(e) => setAcademicYear(Number(e.target.value))}
            style={{ ...inputStyle, width: 100 }}
          />
        </div>
        <div>
          <label style={field}>ภาคเรียน *</label>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            style={selectStyle}
          >
            <option value={1}>1 (เทอมแรก)</option>
            <option value={2}>2 (เทอมสอง)</option>
            <option value={3}>3 (ซัมเมอร์)</option>
          </select>
        </div>
        <div>
          <label style={field}>ประเภทหลักสูตร</label>
          <select
            value={programPreset}
            onChange={(e) => setProgramPreset(e.target.value)}
            style={selectStyle}
          >
            <option value="">— ไม่ระบุ —</option>
            <option value="ภาคปกติ">ภาคปกติ</option>
            <option value="ภาคพิเศษ">ภาคพิเศษ</option>
            <option value="นานาชาติ">นานาชาติ</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
          {programPreset === "อื่นๆ" && (
            <input
              type="text"
              value={programCustom}
              onChange={(e) => setProgramCustom(e.target.value)}
              placeholder="ระบุประเภทหลักสูตร"
              style={{ ...inputStyle, marginTop: "0.25rem" }}
            />
          )}
        </div>
        <div>
          <label style={field}>หมวดหมู่</label>
          <select
            value={categoryPreset}
            onChange={(e) => setCategoryPreset(e.target.value)}
            style={selectStyle}
          >
            <option value="">— ไม่ระบุ —</option>
            <option value="หมวดวิชาบังคับ">หมวดวิชาบังคับ</option>
            <option value="หมวดวิชาเอกเลือก">หมวดวิชาเอกเลือก</option>
            <option value="หมวดวิชาเลือกทั่วไป">หมวดวิชาเลือกทั่วไป(GE)</option>
            <option value="หมวดวิชาฟรี">หมวดวิชาฟรี</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
          {categoryPreset === "อื่นๆ" && (
            <input
              type="text"
              value={categoryCustom}
              onChange={(e) => setCategoryCustom(e.target.value)}
              placeholder="หมวดหมู่ (เช่น หมวดวิชาบังคับ, หมวดวิชาเอกเลือก, หมวดวิชาฟรี)"
              style={{ ...inputStyle, marginTop: "0.25rem" }}
            />
          )}
        </div>
        <div>
          <label style={field}>อาจารย์ผู้สอน</label>
          <input
            value={professor}
            onChange={(e) => setProfessor(e.target.value)}
            placeholder="ชื่ออาจารย์ผู้สอน (ถ้ามากกว่าหนึ่งคน ให้คั่นด้วย ,)"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={field}>ชื่อที่แสดง (ไม่บังคับ)</label>
          <input
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            maxLength={100}
            placeholder="เช่น นักศึกษาปี 2, นิรนาม, ..."
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={field}>รีวิว * ({content.length}/2000)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="เขียนรีวิววิชานี้ เช่น เนื้อหา ความยาก ความสนุก ประโยชน์ที่ได้รับ..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {error && (
        <div
          style={{
            color: "var(--cmu-error)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "0.625rem 1.5rem",
          background: loading ? "var(--cmu-text-muted)" : "var(--cmu-primary)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700,
          alignSelf: "flex-start",
          transition: "background 0.15s",
        }}
      >
        {loading ? "กำลังส่ง..." : "ส่งรีวิว"}
      </button>
    </form>
  );
}
