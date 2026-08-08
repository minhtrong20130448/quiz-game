"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScoresPanel } from "@/components/admin/ScoresPanel";
import { QuestionsPanel } from "@/components/admin/QuestionsPanel";

const ADMIN_PASSWORD_KEY = "adminPassword";

type Tab = "scores" | "questions";

async function verifyPassword(candidate: string): Promise<boolean> {
  const res = await fetch("/api/admin/scores", {
    headers: { "x-admin-password": candidate },
  });
  return res.ok;
}

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("scores");

  useEffect(() => {
    function checkStoredPassword() {
      const stored = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
      if (!stored) {
        setChecking(false);
        return;
      }
      verifyPassword(stored).then((ok) => {
        if (ok) setPassword(stored);
        else sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
        setChecking(false);
      });
    }

    checkStoredPassword();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setLoggingIn(true);
    try {
      const ok = await verifyPassword(passwordInput);
      if (!ok) {
        setAuthError("Sai mật khẩu.");
        return;
      }
      sessionStorage.setItem(ADMIN_PASSWORD_KEY, passwordInput);
      setPassword(passwordInput);
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    setPassword(null);
    setPasswordInput("");
  }

  if (checking) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-text-muted">Đang kiểm tra...</p>
      </main>
    );
  }

  if (!password) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <Card className="w-full">
          <h1 className="mb-4 text-xl font-bold text-text">Đăng nhập Admin</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Mật khẩu admin"
              autoFocus
              className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            {authError && <p className="text-sm text-danger">{authError}</p>}
            <Button type="submit" disabled={loggingIn} className="w-full">
              {loggingIn ? "Đang kiểm tra..." : "Đăng nhập"}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Trang Admin</h1>
        <Button variant="ghost" onClick={handleLogout}>
          Đăng xuất
        </Button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("scores")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "scores" ? "border-b-2 border-primary text-primary" : "text-text-muted"
          }`}
        >
          Kết quả người chơi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "questions" ? "border-b-2 border-primary text-primary" : "text-text-muted"
          }`}
        >
          Ngân hàng câu hỏi
        </button>
      </div>

      {activeTab === "scores" ? <ScoresPanel password={password} /> : <QuestionsPanel password={password} />}
    </main>
  );
}
