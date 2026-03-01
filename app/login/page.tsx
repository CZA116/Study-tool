"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!email || !password) {
      alert("请输入邮箱和密码")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      alert("注册成功！现在可以登录")
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      alert("请输入邮箱和密码")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      window.location.href = "/dashboard"
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black text-white">

      <div className="bg-zinc-900/80 backdrop-blur-md p-10 rounded-xl border border-red-600 shadow-[0_0_40px_rgba(255,0,60,0.3)] w-80">

        <h1 className="text-3xl font-bold text-center mb-8 text-red-500 tracking-widest">
          STUDY SYSTEM
        </h1>

        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 p-3 w-full 
          bg-black 
          border border-red-500 
          text-white 
          placeholder-gray-500
          rounded 
          focus:outline-none 
          focus:ring-2 
          focus:ring-red-500
          transition-all"
        />

        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 p-3 w-full 
          bg-black 
          border border-red-500 
          text-white 
          placeholder-gray-500
          rounded 
          focus:outline-none 
          focus:ring-2 
          focus:ring-red-500
          transition-all"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 
          py-2 rounded mb-3 
          transition-all 
          shadow-[0_0_20px_rgba(255,0,60,0.5)]"
        >
          {loading ? "处理中..." : "登录"}
        </button>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-zinc-700 hover:bg-zinc-600 
          py-2 rounded 
          transition-all"
        >
          注册
        </button>

      </div>
    </div>
  )
}