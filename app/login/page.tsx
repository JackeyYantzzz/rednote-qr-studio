"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("本地演示模式无需登录，请直接进入管理后台。");
      return;
    }
    setLoading(true);
    setMessage("");
    const next = new URLSearchParams(window.location.search).get("next") || "/admin";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    setMessage(error ? error.message : "登录链接已发送，请检查邮箱。");
  }

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <BrandMark />
          <Link className="button-ghost" href="/">
            <ArrowLeft size={16} /> 返回
          </Link>
        </div>
        <section className="surface rounded-[30px] p-7 sm:p-9">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#f5ecdf]">
            <Mail size={22} />
          </div>
          <h1 className="mt-6 text-3xl font-black">管理员登录</h1>
          <p className="mt-2 leading-7 text-[#746d65]">
            使用 ADMIN_EMAIL 或 ADMIN_EMAILS 白名单中的邮箱接收安全登录链接。
          </p>
          <form className="mt-7" onSubmit={submit}>
            <label className="field-label" htmlFor="email">
              管理员邮箱
            </label>
            <input
              autoComplete="email"
              className="field"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
            <button className="button-primary mt-4 w-full" disabled={loading} type="submit">
              {loading ? "正在发送…" : "发送登录链接"}
            </button>
          </form>
          {message && (
            <p className="mt-4 rounded-2xl bg-[#f7f2ec] p-4 text-sm leading-6">{message}</p>
          )}
          {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
            <Link className="button-secondary mt-4 w-full" href="/admin">
              进入本地演示后台
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
