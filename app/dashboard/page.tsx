"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

type ViewType = "question" | "review" | "value"

export default function Dashboard() {
  const [allProblems, setAllProblems] = useState<any[]>([])

  const [currentView, setCurrentView] = useState<ViewType>("question")
  const [todayValue, setTodayValue] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [pressingId, setPressingId] = useState<string | null>(null)
  const [dailyHistory, setDailyHistory] = useState<any[]>([])
  const [totalAccumulated, setTotalAccumulated] = useState(0)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [explodingId, setExplodingId] = useState<string | null>(null)

  const [editingProblem, setEditingProblem] = useState<any>(null)

  const pressTimer = useRef<NodeJS.Timeout | null>(null)

  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [note, setNote] = useState("")
  const [value, setValue] = useState(0)

  const pressStartTimeRef = useRef(0)
  const pressStartPosRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  async function fetchAllProblems() {
    const user = await getUser()
    if (!user) return

    const { data } = await supabase
      .from("problems")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setAllProblems(data || [])
  }

  async function fetchTodayValue() {
    const user = await getUser()
    if (!user) return

    const today = new Date().toISOString().split("T")[0]

    const { data } = await supabase
      .from("daily_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single()

    setTodayValue(data?.total_value || 0)
  }
  async function fetchHistory() {
    const user = await getUser()
    if (!user) return

    const { data } = await supabase
      .from("daily_records")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true })

    const history = data || []
    setDailyHistory(history)

    // ✅ 计算总累计价值
    const total = history.reduce(
      (sum, item) => sum + Number(item.total_value || 0),
      0
    )

    setTotalAccumulated(total)
  }
  useEffect(() => {
    fetchAllProblems()
    fetchTodayValue()
    fetchHistory()
  }, [])
  useEffect(() => {
    setCompletingId(null)
    setExplodingId(null)
  }, [currentView])
  async function addProblem() {
    const user = await getUser()
    if (!user || !name) return

    const { data } = await supabase
      .from("problems")
      .insert({
        user_id: user.id,
        name,
        url,
        note,
        value,
        pool_type: currentView,
      })
      .select()
      .single()

    setAllProblems(prev => [data, ...prev])
  }

  async function completeProblem(problem: any) {
    setCompletingId(problem.id)
    setExplodingId(problem.id)

    if (navigator.vibrate) {
      navigator.vibrate(30)
    }

    const user = await getUser()
    if (!user) return

    const today = new Date().toISOString().split("T")[0]

    const { data } = await supabase
      .from("daily_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single()

    if (data) {
      await supabase
        .from("daily_records")
        .update({ total_value: data.total_value + problem.value })
        .eq("id", data.id)
    } else {
      await supabase.from("daily_records").insert({
        user_id: user.id,
        date: today,
        total_value: problem.value,
      })
    }

    await supabase
      .from("problems")
      .update({ pool_type: "review", status: null })
      .eq("id", problem.id)

    // ✅ 等动画播放完再刷新
    setTimeout(() => {
      setCompletingId(null)

      setAllProblems(prev =>
        prev.map(p =>
          p.id === problem.id
            ? { ...p, pool_type: "review", status: null }
            : p
        )
      )

      fetchTodayValue()
      fetchHistory()
    }, 400)
  }

  async function toggleStatus(problem: any) {
    let newStatus = null

    if (!problem.status) newStatus = "today"
    else if (problem.status === "today") newStatus = "doing"
    else newStatus = null

    await supabase
      .from("problems")
      .update({ status: newStatus })
      .eq("id", problem.id)

    setAllProblems(prev =>
      prev.map(p =>
        p.id === problem.id
          ? { ...p, status: newStatus }
          : p
      )
    )
  }
  async function drawReview() {
    const currentProblems = allProblems.filter(p => p.pool_type === "review")
    if (currentProblems.length === 0) return

    const random =
      currentProblems[Math.floor(Math.random() * currentProblems.length)]

    await supabase
      .from("problems")
      .update({
        pool_type: "question",
        note: (random.note || "") + "｜复习",
      })
      .eq("id", random.id)

    setAllProblems(prev =>
      prev.map(p =>
        p.id === random.id
          ? { ...p, pool_type: "question", note: (random.note || "") + "｜复习" }
          : p
      )
    )
  }

  // ✅ 长按开始
  function handlePressStart(problem: any, e: React.MouseEvent) {
    pressStartTimeRef.current = Date.now()
    pressStartPosRef.current = { x: e.clientX, y: e.clientY }
    isDraggingRef.current = false

    setPressingId(problem.id)

    pressTimer.current = setTimeout(() => {
      // ✅ 双重保险
      if (!isDraggingRef.current) {
        setEditingProblem(problem)
      }
      setPressingId(null)
    }, 800)
  }

  function handlePressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    setPressingId(null)

    // ✅ 松手后重置拖动状态
    isDraggingRef.current = false
  }

  async function saveEdit() {
    await supabase
      .from("problems")
      .update({
        name: editingProblem.name,
        url: editingProblem.url,
        note: editingProblem.note,
        value: editingProblem.value,
        status: editingProblem.status,
      })
      .eq("id", editingProblem.id)

    setEditingProblem(null)
    setAllProblems(prev =>
      prev.map(p =>
        p.id === editingProblem.id
          ? {
              ...p,
              name: editingProblem.name,
              url: editingProblem.url,
              note: editingProblem.note,
              value: editingProblem.value,
              status: editingProblem.status
            }
          : p
      )
    )
  }

  async function deleteProblem(id: string) {
    const confirmDelete = confirm("确定彻底删除这道题吗？")
    if (!confirmDelete) return

    await supabase.from("problems").delete().eq("id", id)

    setEditingProblem(null)
    setAllProblems(prev =>
      prev.filter(p => p.id !== id)
    )
  }

  return (
    <div className="min-h-screen text-white p-10
                    bg-gradient-to-br from-black via-zinc-900 to-black">

      {/* 顶部 */}
      <div className="mb-12 flex justify-between items-center
                      border-b border-red-800 pb-6">
        <h1 className="text-4xl text-red-500 tracking-[0.3em] font-bold">
          CONTROL PANEL
        </h1>
        <div className="text-xl text-green-400
                        border border-green-500 px-4 py-2
                        shadow-[0_0_15px_rgba(0,255,100,0.5)]">
          Value：{todayValue}
        </div>
      </div>

      {/* 池切换 */}
      <div className="flex gap-6 mb-8">
        <button
          onClick={() => setCurrentView("question")}
          className={`px-6 py-2 tracking-widest border
            ${currentView === "question"
              ? "border-red-500 text-red-400 shadow-[0_0_20px_rgba(255,0,60,0.6)]"
              : "border-gray-700 text-gray-400"}`}
        >
          QUESTION POOL
        </button>

        <button
          onClick={() => setCurrentView("review")}
          className={`px-6 py-2 tracking-widest border
            ${currentView === "review"
              ? "border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(0,100,255,0.6)]"
              : "border-gray-700 text-gray-400"}`}
        >
          REVIEW POOL
        </button>

        <button
          onClick={() => setCurrentView("value")}
          className={`px-6 py-2 tracking-widest border
            ${currentView === "value"
              ? "border-green-500 text-green-400 shadow-[0_0_20px_rgba(0,255,120,0.6)]"
              : "border-gray-700 text-gray-400"}`}
        >
          VALUE PANEL
        </button>
      </div>

      {currentView === "question" && (
        <div className="mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded
                      shadow-[0_0_20px_rgba(255,0,60,0.6)]
                      transition-all"
          >
            ＋ ADD PROBLEMS
          </button>
        </div>
      )}

      {currentView === "review" && (
        <div className="mb-8">
          <button
            onClick={drawReview}
            className="relative px-8 py-3 tracking-widest
                      border border-blue-500 text-blue-400
                      hover:bg-blue-600 hover:text-white
                      transition-all duration-300
                      shadow-[0_0_25px_rgba(0,120,255,0.6)]"
          >
            DRAW REVIEW
          </button>
        </div>
      )}

      {/* 题目卡片 */}
      {(currentView === "question" || currentView === "review") && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
          {allProblems
            .filter(p => p.pool_type === currentView)
            .map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => {
                if (!p.url) return

                // ✅ 一旦拖动，立刻标记为拖动
                isDraggingRef.current = true

                // ✅ 取消长按
                if (pressTimer.current) clearTimeout(pressTimer.current)
                setPressingId(null)

                e.dataTransfer.setData("text/uri-list", p.url)
                e.dataTransfer.setData("text/plain", p.url)
              }}
              onMouseDown={(e) => handlePressStart(p, e)}
              onMouseMove={(e) => {
                const dx = Math.abs(e.clientX - pressStartPosRef.current.x)
                const dy = Math.abs(e.clientY - pressStartPosRef.current.y)

                if (dx > 5 || dy > 5) {
                  isDraggingRef.current = true
                  if (pressTimer.current) clearTimeout(pressTimer.current)
                  setPressingId(null)
                }
              }}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onClick={(e) => {
                const pressDuration = Date.now() - pressStartTimeRef.current

                if (isDraggingRef.current) return
                if (pressDuration > 100) return
                if ((e.target as HTMLElement).closest(".no-link")) return

                if (p.url) window.open(p.url, "_blank")
              }}
              className={`
                          relative bg-zinc-900 border border-zinc-700
                          p-6 pb-16 rounded-md
                          transition-all duration-400 ease-out
                          ${completingId === p.id
                            ? "opacity-0 scale-95 translate-y-4"
                            : "hover:scale-[1.02]"}
                          shadow-[0_0_20px_rgba(255,255,255,0.05)]
                          cursor-pointer
                        `}
            >

              {/* ✅ 顶部状态条 */}
              <div
                onClick={() => toggleStatus(p)}
                className={`h-8 flex items-center justify-center text-xs tracking-widest
                  cursor-pointer transition-all no-link
                  ${
                    p.status === "doing"
                      ? "bg-red-600"
                      : p.status === "today"
                      ? "bg-blue-600"
                      : "bg-zinc-800"
                  }`}
              >
                {p.status === "doing"
                  ? "DEPLOYED"
                  : p.status === "today"
                  ? "STANDBY"
                  : "IDLE"}
              </div>
              {/* ✅ 左侧人格状态条 */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-2
                  ${
                    p.status === "doing"
                      ? "bg-red-500"
                      : p.status === "today"
                      ? "bg-blue-500"
                      : "bg-gray-700"
                  }`}
              />
              {/* ✅ 编号标签 */}
              <div className="absolute top-3 right-4 text-xs text-gray-500 tracking-widest">
                #{p.id.slice(0, 4).toUpperCase()}
              </div>
              <h2 className="text-xl text-cyan-400 font-semibold tracking-wide hover:text-cyan-300">
                {p.name}
              </h2>
              
              {/* ✅ 备注 */}
              <p>{p.note}</p>

              {/* ✅ 完成按钮 */}
              {currentView === "question" && (
                <button
                  onClick={() => completeProblem(p)}
                  className={`
                              absolute bottom-4 left-4
                              px-4 py-1 text-sm tracking-widest
                              border border-green-500
                              transition-all duration-200
                              no-link
                              ${
                                completingId === p.id
                                  ? "bg-green-500 text-white shadow-[0_0_25px_rgba(0,255,100,1)] scale-110"
                                  : "text-green-400 hover:bg-green-600 hover:text-white shadow-[0_0_15px_rgba(0,255,100,0.6)]"
                              }
                            `}
                >
                  COMPLETE
                </button>
              )}

              {/* ✅ 价值 */}
              <div className="absolute bottom-4 right-4 text-4xl font-black
                              text-yellow-400
                              drop-shadow-[0_0_8px_rgba(255,200,0,0.8)]
                              pointer-events-none">
                {p.value}
              </div>

              {/* ✅ 爆散粒子 */}
              {explodingId === p.id && (
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(12)].map((_, i) => {
                    const angle = (i / 12) * Math.PI * 2
                    const x = Math.cos(angle)
                    const y = Math.sin(angle)

                    return (
                      <span
                        key={i}
                        className="absolute w-2 h-2 bg-green-400 rounded-full animate-particle"
                        style={{
                          left: "50%",
                          top: "50%",
                          ["--x" as any]: x,
                          ["--y" as any]: y
                        }}
                      />
                    )
                  })}
                </div>
              )}
              {/* ✅ 长按充能条 */}
              <div className="absolute bottom-0 left-0 w-full h-1 overflow-hidden">
                <div
                  className="h-full bg-red-500 origin-left transition-transform duration-800"
                  style={{
                    transform: pressingId === p.id ? "scaleX(1)" : "scaleX(0)"
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ✅ 数据统计面板 */}
      {currentView === "value" && (
        <div>

          {/* ✅ VALUE ANALYSIS */}
          <div className="mt-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl text-green-400 tracking-widest">
                VALUE ANALYSIS
              </h2>

              <div className="text-lg text-yellow-400 font-bold
                              border border-yellow-500 px-4 py-2
                              shadow-[0_0_12px_rgba(255,200,0,0.6)]">
                TOTAL: {totalAccumulated.toLocaleString()}
              </div>
            </div>

            <div className="h-64 border border-zinc-800 p-4 flex gap-6">
              {/* 每日柱状图 */}
              {dailyHistory.map((d, index) => {
                const values = dailyHistory.map(x => Number(x.total_value) || 0)
                const max = Math.max(...values, 1)
                const heightPercent = (Number(d.total_value) / max) * 100

                return (
                  <div key={index} className="flex flex-col items-center justify-end h-full">

                    <div className="flex-1 flex items-end w-full justify-center relative">
                      {Number(d.total_value) > 0 && (
                        <div
                          className="absolute text-xs text-green-400 font-semibold
                                    drop-shadow-[0_0_6px_rgba(0,255,120,0.8)]"
                          style={{
                            bottom: `${heightPercent}%`,
                            transform: "translateY(-6px)"
                          }}
                        >
                          {d.total_value}
                        </div>
                      )}

                      <div
                        className="w-6 bg-green-500 transition-all duration-700"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    <div className="text-xs mt-2 text-gray-400">
                      {d.date.slice(5)}
                    </div>

                  </div>
                )
              })}
            </div>
          </div>

          {/* ✅ 累计前缀和图表 */}
          <div className="mt-16">

            <h3 className="text-xl text-blue-400 tracking-widest mb-6">
              ACCUMULATED VALUE
            </h3>

            <div className="h-48 border border-zinc-800 p-4">

              <div className="h-full flex items-end gap-6">

                {(() => {
                  let runningTotal = 0
                  const prefixValues: number[] = []

                  for (const item of dailyHistory) {
                    runningTotal += Number(item.total_value) || 0
                    prefixValues.push(runningTotal)
                  }

                  const max = Math.max(...prefixValues, 1)

                  return prefixValues.map((val, index) => {
                    const heightPercent = (val / max) * 100

                    return (
                      <div key={index} className="flex flex-col items-center h-full">

                        <div className="flex-1 flex items-end w-full justify-center relative">

                          {/* ✅ 顶部数值显示 */}
                          {val > 0 && (
                            <div
                              className="absolute text-xs text-blue-400 font-semibold
                                        drop-shadow-[0_0_6px_rgba(0,120,255,0.8)]"
                              style={{
                                bottom: `${heightPercent}%`,
                                transform: "translateY(-6px)"
                              }}
                            >
                              {val}
                            </div>
                          )}

                          {/* ✅ 柱子 */}
                          <div
                            className="w-6 bg-blue-500 transition-all duration-700"
                            style={{ height: `${heightPercent}%` }}
                          />

                        </div>

                        <div className="text-xs mt-2 text-gray-400">
                          {dailyHistory[index].date.slice(5)}
                        </div>

                      </div>
                    )
                  })
                })()}

              </div>

            </div>

          </div>

        </div>
      )}
      {/* 编辑弹窗 */}
      {editingProblem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-zinc-900 border border-red-600 p-8 w-[420px] rounded-lg
                shadow-[0_0_40px_rgba(255,0,60,0.5)]">
            <input
              className="w-full mb-4 p-2 bg-black border border-zinc-700 rounded
                         focus:border-red-500 focus:outline-none"
              value={editingProblem.name}
              onChange={(e) =>
                setEditingProblem({ ...editingProblem, name: e.target.value })
              }
            />
            <input
              className="w-full mb-4 p-2 bg-black border border-zinc-700 rounded
                         focus:border-red-500 focus:outline-none"
              value={editingProblem.url}
              onChange={(e) =>
                setEditingProblem({ ...editingProblem, url: e.target.value })
              }
            />
            <input
              className="w-full mb-4 p-2 bg-black border border-zinc-700 rounded
                         focus:border-red-500 focus:outline-none"
              value={editingProblem.note}
              onChange={(e) =>
                setEditingProblem({ ...editingProblem, note: e.target.value })
              }
            />
            <input
              className="w-full mb-4 p-2 bg-black border border-zinc-700 rounded
                         focus:border-red-500 focus:outline-none"
              type="number"
              value={editingProblem.value}
              onChange={(e) =>
                setEditingProblem({ ...editingProblem, value: Number(e.target.value) })
              }
            />

            <div className="flex justify-between mt-4">
              <button 
                onClick={() => deleteProblem(editingProblem.id)}
                className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded tracking-widest"
              >
                Delete
              </button>
              <button 
                onClick={saveEdit}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded tracking-widest"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-red-600 p-8 w-96 rounded-xl
                          shadow-[0_0_40px_rgba(255,0,60,0.4)]">

            <h2 className="text-2xl text-red-500 mb-6 tracking-widest">
              ADD PROBLEM
            </h2>

            <input
              className="w-full mb-3 p-2 bg-black border border-gray-700 rounded"
              placeholder="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="w-full mb-3 p-2 bg-black border border-gray-700 rounded"
              placeholder="link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />

            <input
              className="w-full mb-3 p-2 bg-black border border-gray-700 rounded"
              placeholder="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <input
              type="number"
              className="w-full mb-6 p-2 bg-black border border-gray-700 rounded"
              placeholder="value"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />

            <div className="flex justify-between">
              <button
                onClick={() => setShowAddModal(false)}
                className="bg-gray-600 px-4 py-2 rounded"
              >
                CANCEL
              </button>

              <button
                onClick={async () => {
                  await addProblem()
                  setShowAddModal(false)
                }}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              >
                ADD
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}