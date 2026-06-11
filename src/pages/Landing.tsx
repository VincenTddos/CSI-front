import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ShieldCheck, MapPin, BellRing, BarChart3, Wifi, Camera, Mic, Watch,
  ArrowRight, Cpu, HeartPulse, Lock, Users, Building2, Stethoscope, Clock,
  AlertTriangle, CheckCircle2, Phone, Network, Database, ClipboardList,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { CsiScene } from '../components/landing/CsiScene';
import { Esp32Photo } from '../components/landing/Esp32Photo';
import { Reveal } from '../components/landing/Reveal';
import { LiveSignal } from '../components/landing/LiveSignal';
import { ActivityDemo } from '../components/landing/ActivityDemo';
import { ZoneMap } from '../components/landing/ZoneMap';
import { EscalationDemo } from '../components/landing/EscalationDemo';

export function Landing() {
  const navigate = useNavigate();
  const { user } = useUser();
  const start = () => navigate(user ? '/realtime' : '/login');
  const CONTACT = 'mailto:vincent6244@gmail.com?subject=Wi-Care 預約展示';

  return (
    <div className="relative min-h-screen bg-white text-slate-800">
      {/* 導覽列 */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#007AFF] rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-lg text-slate-900">Wi-Care</span>
              <span className="hidden sm:block text-[10px] text-slate-400">智慧長照監控系統</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={CONTACT} className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2">預約展示</a>
            <button onClick={() => navigate('/login')}
              className="text-sm font-medium text-white bg-[#2C363F] hover:bg-[#1E252B] px-4 py-2 rounded-lg transition-colors">登入系統</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="bg-gradient-to-b from-[#EEF4FB] to-white">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-medium text-[#007AFF] mb-6">
                <Stethoscope className="w-3.5 h-3.5" /> 為長照機構與醫院打造
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.15] text-slate-900">
                非接觸式跌倒守護，<br /><span className="text-[#007AFF]">不裝鏡頭也能 24 小時照看</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-lg text-slate-600 mt-6 leading-relaxed">
                Wi-Care 以 Wi-Fi 訊號感測技術，為照護機構提供即時跌倒警報、活動監測與管理報表——
                保護病患隱私、減輕護理人力、用現有 Wi-Fi 即可部署。
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <button onClick={start}
                  className="group flex items-center justify-center gap-2 bg-[#007AFF] hover:bg-[#0066CC] text-white font-semibold px-7 py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-colors">
                  進入系統 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <a href={CONTACT}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium px-7 py-3.5 rounded-xl transition-colors">
                  <Phone className="w-4 h-4" /> 預約展示
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <p className="text-xs text-slate-400 mt-5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> 無鏡頭・無錄音・無穿戴　|　符合個資保護原則
              </p>
            </Reveal>
          </div>
          <Reveal delay={200}><CsiScene /></Reveal>
        </div>
      </header>

      {/* 機構痛點 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">照護機構正面臨的挑戰</h2>
          <p className="text-slate-500 mt-3">傳統監測方式難以兼顧安全、隱私與人力</p>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: AlertTriangle, title: '跌倒事故頻繁', desc: '跌倒是高齡者事故傷害死亡的主要原因之一，且常於無人時段發生。' },
            { icon: Clock, title: '夜間人力不足', desc: '夜班護理人力有限，難以同時即時掌握每間房的狀況。' },
            { icon: Camera, title: '攝影機侵犯隱私', desc: '影像監控雖能偵測，卻嚴重侵犯病患與長者的隱私與尊嚴。' },
            { icon: Watch, title: '穿戴依從性低', desc: '長者常忘記配戴或抗拒穿戴裝置，且需充電維護。' },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              <div className="h-full p-6 rounded-2xl border border-slate-100 bg-slate-50">
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-4">
                  <c.icon className="w-5 h-5 text-slate-500" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{c.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-6">資料來源：衛生福利部統計（實際引用數據請依最新公告核實）</p>
      </section>

      {/* 核心價值 */}
      <section className="bg-[#F8FAFC] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Wi-Care 帶來的改變</h2>
            <p className="text-slate-500 mt-3">把感測資料變成即時行動與管理決策</p>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: BellRing, title: '即時跌倒警報', desc: '偵測到跌倒立即通知護理站與家屬，縮短反應時間。' },
              { icon: ShieldCheck, title: '未確認自動升級', desc: '警報逾時無人確認，自動再通知，避免漏接。' },
              { icon: BarChart3, title: '護理站集中儀表板', desc: '一個畫面掌握全機構即時狀態與歷史報表。' },
              { icon: HeartPulse, title: '減輕照護負擔', desc: '系統 24 小時值守，讓人力聚焦於真正需要的時刻。' },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 70}>
                <div className="h-full p-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                    <c.icon className="w-5 h-5 text-[#007AFF]" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{c.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 能力佐證：即時演示 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">系統如何運作</h2>
          <p className="text-slate-500 mt-3">即時演示：從感測訊號、活動辨識、分區掌握到警報通報</p>
        </Reveal>
        <div className="space-y-16 lg:space-y-24">
          {/* ① 感測 —— 演示在左 */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <Reveal><LiveSignal /></Reveal>
            <Reveal delay={120}>
              <div>
                <h3 className="text-xl font-bold text-slate-900">① 感測：Wi-Fi 訊號變化</h3>
                <p className="text-slate-600 mt-3 leading-relaxed">
                  ESP32 感測器持續擷取 Wi-Fi 子載波。人體一移動，訊號隨即抖動，系統將其量化為
                  0–100 的移動分數，作為後續判斷依據。無需鏡頭、可穿牆、不受光線影響。
                </p>
              </div>
            </Reveal>
          </div>

          {/* ② 辨識 —— 演示在右 */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <Reveal className="lg:order-2"><ActivityDemo /></Reveal>
            <Reveal delay={120} className="lg:order-1">
              <div>
                <h3 className="text-xl font-bold text-slate-900">② 辨識：六級活動分類</h3>
                <p className="text-slate-600 mt-3 leading-relaxed">
                  移動分數會對應到睡眠、靜坐、行走到激烈活動等六個等級。一旦分數在短時間內異常飆高，
                  系統即判定為跌倒風險，立即觸發後續通報流程。
                </p>
              </div>
            </Reveal>
          </div>

          {/* ③ 分區 —— 演示在左 */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <Reveal><ZoneMap /></Reveal>
            <Reveal delay={120}>
              <div>
                <h3 className="text-xl font-bold text-slate-900">③ 分區：多裝置分區偵測</h3>
                <p className="text-slate-600 mt-3 leading-relaxed">
                  在客廳、臥室、浴室分別佈署感測器，每台各顧一區。系統即時呈現長者所在房間，
                  掌握日常動線，連異常久未活動也能及早察覺。
                </p>
              </div>
            </Reveal>
          </div>

          {/* ④ 通報 —— 演示在右 */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <Reveal className="lg:order-2"><EscalationDemo /></Reveal>
            <Reveal delay={120} className="lg:order-1">
              <div>
                <h3 className="text-xl font-bold text-slate-900">④ 通報：警報自動升級</h3>
                <p className="text-slate-600 mt-3 leading-relaxed">
                  偵測到跌倒後，系統立即推播護理站。若 30 秒內無人確認，警報自動升級轉通知家屬，
                  層層接力直到有人回應，確保緊急狀況不漏接、不延誤。
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 比較表 */}
      <section className="bg-[#F8FAFC] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">為什麼選擇 Wi-Care</h2>
            <p className="text-slate-500 mt-3">與傳統監測方案的比較</p>
          </Reveal>
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="text-left p-4 font-medium">比較項目</th>
                    <th className="p-4 font-medium">攝影機監控</th>
                    <th className="p-4 font-medium">穿戴裝置</th>
                    <th className="p-4 font-bold text-[#007AFF] bg-blue-50">Wi-Care</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-center">
                  {[
                    ['病患隱私', '低（有影像）', '中', '高（無影像/聲音）'],
                    ['長者依從性', '—', '低（需配戴充電）', '高（完全無感）'],
                    ['安裝佈線', '需佈線/電源', '免', '免（用現有 Wi-Fi）'],
                    ['夜間/盲區', '受光線影響', '可', '可（穿牆、不受光線）'],
                    ['單點成本', '高', '中', '低（< NT$300/台）'],
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="text-left p-4 font-medium text-slate-700">{row[0]}</td>
                      <td className="p-4 text-slate-500">{row[1]}</td>
                      <td className="p-4 text-slate-500">{row[2]}</td>
                      <td className="p-4 font-semibold text-slate-800 bg-blue-50/50">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 依角色價值 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">為每個角色設計</h2>
          <p className="text-slate-500 mt-3">護理人員、家屬、管理者各取所需</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: HeartPulse, color: 'text-blue-500 bg-blue-50', role: '護理人員', items: ['即時跌倒/異常警報', '住民健康記錄管理', '減輕巡房與夜班負擔'] },
            { icon: Building2, color: 'text-green-500 bg-green-50', role: '家屬', items: ['遠端安心查看狀態', '健康日誌與趨勢', '跌倒事件即時通知'] },
            { icon: Users, color: 'text-purple-500 bg-purple-50', role: '管理者', items: ['全機構即時儀表板', '管理報表與資料匯出', '帳號權限與稽核'] },
          ].map((c, i) => (
            <Reveal key={c.role} delay={i * 80}>
              <div className="h-full p-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${c.color}`}>
                  <c.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-3">{c.role}</h3>
                <ul className="space-y-2">
                  {c.items.map(it => (
                    <li key={it} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 隱私與資安（深色強調） */}
      <section className="bg-[#2C363F] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <Lock className="w-11 h-11 text-green-400 mx-auto mb-5" />
            <h2 className="text-3xl font-bold text-white">隱私與資訊安全，醫療等級的堅持</h2>
            <p className="text-slate-400 mt-3 max-w-2xl mx-auto">為病患與機構守住最重要的底線</p>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Camera, title: '無影像', desc: '不使用任何攝影機' },
              { icon: Mic, title: '無錄音', desc: '不收集任何聲音' },
              { icon: Lock, title: '資料加密', desc: '雲端傳輸與儲存加密' },
              { icon: ShieldCheck, title: '權限控管', desc: '角色分級存取與稽核' },
            ].map((c) => (
              <Reveal key={c.title}>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <c.icon className="w-7 h-7 text-green-400 mx-auto mb-3" />
                  <h3 className="font-bold text-white">{c.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mt-8">
            CSI 僅擷取 Wi-Fi 頻道物理特徵，不含可識別個人身分之資訊；應於取得受照護者同意後使用，並遵循當地隱私法規。
          </p>
        </div>
      </section>

      {/* 部署與架構 + 硬體 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <Reveal><Esp32Photo /></Reveal>
          <Reveal delay={120}>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs text-[#007AFF] mb-5">
                <Network className="w-3.5 h-3.5" /> 簡單部署，快速上線
              </div>
              <h2 className="text-3xl font-bold text-slate-900">用現有 Wi-Fi，一房一台即可</h2>
              <p className="text-slate-600 mt-4 leading-relaxed">
                每間房放置一台 ESP32-S3 感測器，透過機構現有的 Wi-Fi 即可運作，免額外佈線、免穿戴裝置。
                資料集中至雲端，護理站與管理者可同時監看多房間、多床位。
              </p>
              <div className="grid grid-cols-2 gap-3 mt-7">
                {[
                  { icon: Wifi, k: '連接', v: '現有 Wi-Fi / BLE' },
                  { icon: Cpu, k: '感測器', v: 'ESP32-S3（< NT$300）' },
                  { icon: Database, k: '資料', v: '雲端集中・加密' },
                  { icon: Activity, k: '採集', v: '10 Hz 即時' },
                ].map((x) => (
                  <div key={x.k} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <x.icon className="w-5 h-5 text-[#007AFF] shrink-0" />
                    <div><p className="text-[11px] text-slate-400">{x.k}</p><p className="text-sm font-medium text-slate-800">{x.v}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 功能模組總覽 */}
      <section className="bg-[#F8FAFC] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">完整的照護管理平台</h2>
            <p className="text-slate-500 mt-3">從即時監控到管理決策，一站到位</p>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Activity, t: '即時監控' }, { icon: BellRing, t: '警報通知' },
              { icon: Users, t: '住民管理' }, { icon: HeartPulse, t: '每日健康' },
              { icon: ClipboardList, t: '例行健檢' }, { icon: BarChart3, t: '管理報表' },
              { icon: MapPin, t: '智慧分析' }, { icon: ShieldCheck, t: '帳號權限' },
            ].map((m, i) => (
              <Reveal key={m.t} delay={i * 50}>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <m.icon className="w-5 h-5 text-[#007AFF]" />
                  </div>
                  <span className="font-medium text-slate-700">{m.t}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 導入流程 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">導入流程</h2>
          <p className="text-slate-500 mt-3">四步驟，從評估到上線</p>
        </Reveal>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: '1', t: '需求諮詢', d: '了解機構房型、床位與照護需求。' },
            { n: '2', t: '場域評估', d: '現場勘查 Wi-Fi 環境並規劃感測器佈點。' },
            { n: '3', t: '部署校正', d: '安裝感測器、連接雲端並進行環境校正。' },
            { n: '4', t: '訓練上線', d: '人員教育訓練，正式啟用即時監測。' },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="relative h-full p-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="w-9 h-9 rounded-full bg-[#007AFF] text-white font-bold flex items-center justify-center mb-4">{s.n}</div>
                <h3 className="font-bold text-slate-900 mb-2">{s.t}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 最終 CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <Reveal>
          <div className="rounded-3xl bg-[#007AFF] p-10 md:p-14 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white">為您的機構導入智慧守護</h2>
            <p className="text-blue-100 mt-3">立即進入系統體驗，或預約專人展示與場域評估。</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <button onClick={start} className="bg-white text-[#007AFF] font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors">進入系統</button>
              <a href={CONTACT} className="bg-[#0059c0] text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-[#004ba0] transition-colors flex items-center justify-center gap-2"><Phone className="w-4 h-4" /> 預約展示</a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 頁尾 + 誠實聲明 */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Activity className="w-4 h-4 text-[#007AFF]" />
            <span className="font-medium text-slate-600">Wi-Care 智慧長照監控系統</span>
          </div>
          <p className="text-xs text-slate-400">© 2026 Wi-Care Team · 台北商業大學資訊管理系專題</p>
          <p className="text-[11px] text-slate-400 max-w-2xl mx-auto">
            ※ 本系統為學術專題原型，尚未取得醫療器材認證，現階段僅供研究與展示用途，不作為醫療診斷依據。
          </p>
        </div>
      </footer>
    </div>
  );
}
