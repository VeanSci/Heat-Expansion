import React, { useState, useRef, useEffect, useMemo } from "react";

/* ============================================================
   🌡️ 열팽창 시뮬레이션 (Thermal Expansion Simulator)
   4개 탭: 고체 / 액체 / 바이메탈 / 온도계
   - 선팽창계수(α, ×10^-6 /℃) 기준, 부피팽창 ≈ 3α
   ============================================================ */

/* ---------- 물질 데이터 ---------- */
// alpha = 선팽창계수 (×10^-6 /℃)
const SOLIDS = [
  { id: "diamond", name: "다이아몬드", icon: "💎", alpha: 1.1, color: "#bfeaff" },
  { id: "pyrex", name: "내열 유리", icon: "🪟", alpha: 3.3, color: "#cfe8d8" },
  { id: "glass", name: "일반유리", icon: "🪞", alpha: 9, color: "#d8e4ec" },
  { id: "iron", name: "철", icon: "🔩", alpha: 12, color: "#9aa0a6" },
  { id: "copper", name: "구리", icon: "🥉", alpha: 17, color: "#d98a5b" },
  { id: "silver", name: "은", icon: "🥈", alpha: 19, color: "#cdd2d6" },
  { id: "aluminum", name: "알루미늄", icon: "🛢️", alpha: 23, color: "#c7ccd1" },
  { id: "plastic", name: "플라스틱", icon: "🧱", alpha: 80, color: "#e2b15e" },
];

// 액체 부피팽창계수 β (×10^-4 /℃)
const LIQUIDS = [
  { id: "water", name: "물", icon: "💧", beta: 2.1, color: "#5aa9e6" },
  { id: "ethanol", name: "에탄올", icon: "🧪", beta: 11, color: "#9bd1a6" },
];

// 바이메탈용 금속 (선팽창계수)
const BIMETAL_METALS = [
  { id: "iron", name: "철", icon: "🔩", alpha: 12, color: "#9aa0a6" },
  { id: "copper", name: "구리", icon: "🥉", alpha: 17, color: "#d98a5b" },
  { id: "aluminum", name: "알루미늄", icon: "🛢️", alpha: 23, color: "#c7ccd1" },
  { id: "silver", name: "은", icon: "🥈", alpha: 19, color: "#cdd2d6" },
];

// 온도계 종류 (측정 범위, 색)
const THERMOMETERS = [
  { id: "alcohol", name: "알코올 온도계", icon: "🌡️", min: -115, max: 78, color: "#e2574c" },
  { id: "mercury", name: "수은 온도계", icon: "🔭", min: -39, max: 357, color: "#9aa0a6" },
  { id: "kerosene", name: "등유 온도계", icon: "🔵", min: -40, max: 150, color: "#4c7fe2" },
];

const T_MIN = 20;
const T_MAX = 300;

/* ---------- 작은 UI 헬퍼 ---------- */
const Panel = ({ children, style }) => (
  <div
    style={{
      background: "var(--panel)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: 18,
      boxShadow: "0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px rgba(0,0,0,.18)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Btn = ({ children, onClick, active, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      cursor: disabled ? "not-allowed" : "pointer",
      border: "1px solid var(--line)",
      background: active ? "var(--accent)" : "var(--chip)",
      color: active ? "#0c1116" : "var(--ink)",
      fontWeight: 700,
      padding: "8px 14px",
      borderRadius: 10,
      fontSize: 13,
      opacity: disabled ? 0.45 : 1,
      transition: "transform .12s ease, background .2s ease",
      fontFamily: "inherit",
    }}
    onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(.95)")}
    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
  >
    {children}
  </button>
);

/* 온도 슬라이더 + 알코올램프 세기 공용 컨트롤 */
function HeatControl({ temp, setTemp, label = "🌡️ 온도" }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>🔥 알코올램프 세기</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>
          {label}: {Math.round(temp)} ℃
        </span>
      </div>
      <input
        type="range"
        min={T_MIN}
        max={T_MAX}
        value={temp}
        onChange={(e) => setTemp(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#ff7a45", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
        <span>{T_MIN}℃</span>
        <span>{T_MAX}℃</span>
      </div>
    </div>
  );
}

/* 가열 정도(0~1)에 따라 빛나는 색 */
function heatColor(base, t) {
  const k = Math.min(1, (t - T_MIN) / (T_MAX - T_MIN));
  // base색 → 붉은 가열색으로 보간
  const hot = [255, 90, 40];
  const c = base.match(/\w\w/g).map((h) => parseInt(h, 16));
  const mix = c.map((v, i) => Math.round(v * (1 - k * 0.7) + hot[i] * k * 0.7));
  return `rgb(${mix.join(",")})`;
}

/* ---------- 입자모형 (가열될수록 진동 폭 ↑, 간격 ↑) ---------- */
function ParticleModel({ temp, color, cols = 7, rows = 7 }) {
  const k = Math.min(1, (temp - T_MIN) / (T_MAX - T_MIN));
  const gap = 18 + k * 10; // 간격 증가 = 팽창
  const amp = 1 + k * 5;   // 진동 폭
  const size = cols * gap + 24;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(id);
  }, []);
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const phase = (r * cols + c) * 1.3 + tick * 0.5;
      const dx = Math.sin(phase) * amp;
      const dy = Math.cos(phase * 1.1) * amp;
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={12 + c * gap + dx}
          cy={12 + r * gap + dy}
          r={5}
          fill={heatColor(color.replace("#", ""), temp)}
          opacity={0.92}
        />
      );
    }
  }
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} style={{ maxWidth: "100%" }}>
        {dots}
      </svg>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        입자 간격·진동이 온도에 따라 커집니다
      </div>
    </div>
  );
}

/* ================= 1) 고체 열팽창 ================= */
function SolidTab() {
  const [temp, setTemp] = useState(T_MIN);
  const [mat, setMat] = useState(null);
  const [showParticle, setShowParticle] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const dT = temp - T_MIN;
  // 부피팽창 ≈ 3α·ΔT,  부피 = 100·(1 + 3αΔT)
  const volume = mat ? 100 * (1 + 3 * mat.alpha * 1e-6 * dT) : 100;
  const scale = mat ? 1 + mat.alpha * 1e-6 * dT * 60 : 1; // 시각 과장 배율

  const reset = () => { setMat(null); setTemp(T_MIN); setShowParticle(false); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong>📌 고체 열팽창</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => setShowParticle((s) => !s)} active={showParticle}>✨ 입자모형</Btn>
            <Btn onClick={reset}>초기화</Btn>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          아래 물질을 클릭하거나 가운데 영역으로 드래그하세요.
        </p>

        {/* 시각 영역 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const id = e.dataTransfer.getData("text/plain");
            const m = SOLIDS.find((s) => s.id === id);
            if (m) setMat(m);
          }}
          style={{
            height: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            border: dragOver ? "2px dashed var(--accent)" : "2px dashed var(--line)",
            background: "radial-gradient(circle at 50% 40%, rgba(255,140,80,.08), transparent 70%)",
          }}
        >
          {!mat ? (
            <span style={{ color: "var(--muted)" }}>물질을 선택하세요</span>
          ) : showParticle ? (
            <ParticleModel temp={temp} color={mat.color} />
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
                {/* 가열 전 원래 크기 (같은 모양의 잔상) */}
                <div
                  style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 64,
                    opacity: scale > 1.001 ? 0.28 : 0,
                    filter: "grayscale(1) brightness(1.6)",
                    transition: "opacity .25s ease",
                    pointerEvents: "none",
                  }}
                >
                  {mat.icon}
                </div>
                {/* 팽창하는 물체 */}
                <div
                  style={{
                    position: "absolute", inset: 0,
                    transform: `scale(${scale})`,
                    transformOrigin: "center",
                    transition: "transform .25s ease, filter .25s ease",
                    filter: `drop-shadow(0 0 ${(temp - T_MIN) / 5}px rgba(255,90,40,${Math.min(0.9, (temp - T_MIN) / 200)}))`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64,
                  }}
                >
                  {mat.icon}
                </div>
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
                흐린 잔상 = 가열 전 원래 크기 · 변화가 잘 보이도록 과장했습니다
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <HeatControl temp={temp} setTemp={setTemp} />
        </div>
      </Panel>

      {/* 사이드: 정보 + 물질 칸 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>🌡️ 온도: <b>{Math.round(temp)} ℃</b></div>
            <div>🪨 물질: <b>{mat ? `${mat.icon} ${mat.name}` : "-"}</b></div>
            <div>📏 부피: <b>{volume.toFixed(2)}</b></div>
          </div>
        </Panel>
        <Panel>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>🧰 물질 도구칸</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {SOLIDS.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                onClick={() => setMat(s)}
                style={{
                  cursor: "grab",
                  padding: "8px 6px",
                  borderRadius: 10,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "1px solid var(--line)",
                  background: mat?.id === s.id ? "var(--accent)" : "var(--chip)",
                  color: mat?.id === s.id ? "#0c1116" : "var(--ink)",
                }}
              >
                <div style={{ fontSize: 20 }}>{s.icon}</div>
                {s.name}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================= 2) 액체 열팽창 (조립식) ================= */
// 도구칸 항목
const LIQUID_TOOLS = [
  { id: "tub", name: "수조", icon: "🪣", kind: "tub" },
  { id: "flask", name: "삼각플라스크", icon: "⚗️", kind: "flask" },
  { id: "water", name: "물", icon: "💧", kind: "liquid", liquidId: "water" },
  { id: "ethanol", name: "에탄올", icon: "🧪", kind: "liquid", liquidId: "ethanol" },
  { id: "stopper", name: "고무마개", icon: "🟫", kind: "stopper" },
  { id: "tube", name: "유리관", icon: "🥢", kind: "tube" },
];

const emptyFlask = () => ({ placed: false, liquid: null, stopper: false, tube: false });

function LiquidTab() {
  const [temp, setTemp] = useState(T_MIN);
  const [showParticle, setShowParticle] = useState(false);
  const [hasTub, setHasTub] = useState(false);
  const [tubFilled, setTubFilled] = useState(false);
  const [flasks, setFlasks] = useState([emptyFlask(), emptyFlask()]); // [left, right]
  const [overTarget, setOverTarget] = useState(null); // "tub" | "flask-0" | "flask-1" | null

  const dT = temp - T_MIN;
  const fillBase = 0.55;
  const riseOf = (l) => l ? Math.min(0.4, l.beta * 1e-4 * dT * 1.4) : 0;

  // 완성 여부: 수조+수조물+두 플라스크 모두 액체+마개+관
  const flaskReady = (f) => f.placed && f.liquid && f.stopper && f.tube;
  const bothPlaced = flasks[0].placed && flasks[1].placed;
  const ready = hasTub && tubFilled && flasks.every(flaskReady);

  // 현재 진행 단계 안내
  const step = !hasTub ? "1️⃣ 수조를 가운데로 드래그하세요"
    : !bothPlaced ? "2️⃣ 삼각플라스크를 수조 안 좌·우로 드래그하세요"
    : !tubFilled ? "3️⃣ 수조에 물(💧)을 부어 채우세요"
    : !flasks[0].liquid || !flasks[1].liquid ? "4️⃣ 각 플라스크에 물·에탄올을 드래그하세요"
    : !flasks[0].stopper || !flasks[1].stopper ? "5️⃣ 각 플라스크에 고무마개를 드래그하세요"
    : !flasks[0].tube || !flasks[1].tube ? "6️⃣ 각 플라스크에 유리관을 드래그하세요"
    : "7️⃣ 준비 완료! 아래 슬라이더로 가열하세요";

  const reset = () => {
    setHasTub(false); setTubFilled(false); setFlasks([emptyFlask(), emptyFlask()]);
    setTemp(T_MIN); setShowParticle(false);
  };

  // 슬롯에 도구 적용 (조립 규칙 검증)
  const applyTool = (target, toolId) => {
    const tool = LIQUID_TOOLS.find((t) => t.id === toolId);
    if (!tool) return;

    if (tool.kind === "tub") { if (!hasTub) setHasTub(true); return; }
    if (!hasTub) return; // 수조 먼저

    const m = /^flask-(\d)$/.exec(target);

    // 수조에 물 붓기: 플라스크 2개 설치 후, 물을 수조(빈 영역)에 드래그
    if (tool.kind === "liquid" && tool.liquidId === "water" && target === "tub") {
      if (bothPlaced && !tubFilled) setTubFilled(true);
      return;
    }

    // flask 슬롯 대상
    if (tool.kind === "flask") {
      // 빈 슬롯에 플라스크 설치
      if (m) {
        const i = +m[1];
        setFlasks((fs) => fs.map((f, idx) => idx === i && !f.placed ? { ...f, placed: true } : f));
      }
      return;
    }
    if (!m) return;
    const i = +m[1];
    setFlasks((fs) => fs.map((f, idx) => {
      if (idx !== i || !f.placed) return f;
      if (tool.kind === "liquid" && !f.liquid) {
        if (!tubFilled) return f; // 수조 물 먼저
        return { ...f, liquid: LIQUIDS.find((x) => x.id === tool.liquidId) };
      }
      if (tool.kind === "stopper" && f.liquid && !f.stopper) return { ...f, stopper: true };
      if (tool.kind === "tube" && f.stopper && !f.tube) return { ...f, tube: true };
      return f;
    }));
  };

  const dropHandler = (target) => (e) => {
    e.preventDefault(); setOverTarget(null);
    applyTool(target, e.dataTransfer.getData("text/plain"));
  };

  const heatTemp = ready ? temp : T_MIN;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong>📌 액체 열팽창</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => setShowParticle((s) => !s)} active={showParticle} disabled={!ready}>✨ 입자모형</Btn>
            <Btn onClick={reset}>초기화</Btn>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--accent)", marginTop: 0, fontWeight: 700 }}>{step}</p>

        {/* 조립/실험 영역 */}
        <div
          onDragOver={(e) => { e.preventDefault(); if (!hasTub || (bothPlaced && !tubFilled)) setOverTarget("tub"); }}
          onDragLeave={() => setOverTarget(null)}
          onDrop={dropHandler("tub")}
          style={{
            position: "relative", height: 340, borderRadius: 14,
            border: overTarget === "tub" ? "2px dashed var(--accent)" : "2px dashed var(--line)",
            background: "radial-gradient(circle at 50% 70%, rgba(90,169,230,.08), transparent 70%)",
            display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden",
          }}
        >
          {!hasTub ? (
            <div style={{ alignSelf: "center", color: "var(--muted)" }}>여기로 수조(🪣)를 드래그하세요</div>
          ) : showParticle && ready ? (
            <div style={{ alignSelf: "center", display: "flex", gap: 30 }}>
              {flasks.map((f, i) => (
                <ParticleModel key={i} temp={heatTemp} color={f.liquid.color} cols={5} rows={5} />
              ))}
            </div>
          ) : (
            <LiquidBench
              flasks={flasks}
              tubFilled={tubFilled}
              temp={heatTemp}
              fillBase={fillBase}
              riseOf={riseOf}
              overTarget={overTarget}
              setOverTarget={setOverTarget}
              onDropSlot={dropHandler}
            />
          )}
        </div>

        <div style={{ marginTop: 14, opacity: ready ? 1 : 0.4, pointerEvents: ready ? "auto" : "none" }}>
          <HeatControl temp={temp} setTemp={setTemp} />
        </div>
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>🌡️ 온도: <b>{Math.round(heatTemp)} ℃</b></div>
            {flasks.map((f, i) => (
              <div key={i}>
                {i === 0 ? "왼쪽" : "오른쪽"} {f.liquid ? `${f.liquid.icon} ${f.liquid.name}` : "(비어있음)"}:
                {" "}<b>{f.liquid ? (100 * (1 + f.liquid.beta * 1e-4 * (heatTemp - T_MIN))).toFixed(2) : "-"}</b>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>🧰 실험 도구칸 (드래그해서 조립)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {LIQUID_TOOLS.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                style={{
                  cursor: "grab", padding: "10px 6px", borderRadius: 10, textAlign: "center",
                  fontSize: 13, fontWeight: 700, border: "1px solid var(--line)", background: "var(--chip)",
                }}
              >
                <div style={{ fontSize: 22 }}>{t.icon}</div>
                {t.name}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
            에탄올이 물보다 훨씬 많이 팽창합니다.
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* 수조 + 두 플라스크 조립대 */
function LiquidBench({ flasks, tubFilled, temp, fillBase, riseOf, overTarget, setOverTarget, onDropSlot }) {
  const boiling = temp > 60; // 가열 시 수조 물 끓는 표시
  return (
    <svg width="100%" height="340" viewBox="0 0 420 340" style={{ position: "absolute", inset: 0 }}>
      {/* 수조 벽 */}
      <rect x="30" y="150" width="360" height="170" rx="10"
        fill="rgba(150,200,235,.06)" stroke="#7fb0cc" strokeWidth="3" />

      {/* 수조 안 물 (플라스크보다 뒤에 그려 잠긴 효과) */}
      {tubFilled && (
        <>
          <rect x="33" y="178" width="354" height="139" rx="8" fill="#5aa9e6" opacity="0.30" />
          <line x1="33" y1="180" x2="387" y2="180" stroke="#9fd0f0" strokeWidth="2" opacity="0.6" />
          {/* 끓는 기포 */}
          {boiling && [70, 150, 210, 270, 350].map((bx, k) => (
            <circle key={k} cx={bx + (k % 2) * 12} cy={300 - (k * 13) % 40} r={2.5 + (k % 3)}
              fill="#cdeaff" opacity="0.7">
              <animate attributeName="cy" values="305;185" dur={`${1.4 + (k % 3) * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.7;0" dur={`${1.4 + (k % 3) * 0.4}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </>
      )}
      <text x="210" y="335" textAnchor="middle" fontSize="11" fill="#8a9aa8">
        🪣 수조 {tubFilled ? "(물 채움)" : ""}
      </text>

      {/* 두 플라스크 슬롯 */}
      {flasks.map((f, i) => {
        const cx = i === 0 ? 130 : 290; // 좌/우 중심
        return (
          <BenchFlask
            key={i}
            cx={cx}
            slot={`flask-${i}`}
            flask={f}
            temp={temp}
            fillBase={fillBase}
            riseOf={riseOf}
            highlight={overTarget === `flask-${i}`}
            setOverTarget={setOverTarget}
            onDropSlot={onDropSlot}
          />
        );
      })}
    </svg>
  );
}

/* 조립대 위 개별 플라스크 (slot 단위 드롭 타겟) */
function BenchFlask({ cx, slot, flask, temp, fillBase, riseOf, highlight, setOverTarget, onDropSlot }) {
  const dx = cx - 120; // 기본 도형이 cx=120 기준이라 평행이동
  const liquid = flask.liquid;
  const fill = fillBase + riseOf(liquid);
  const tubeTopY = 60, tubeEndY = 250;
  const tubeReadTop = 72, tubeReadBase = 165;
  const tubeLevel = tubeReadBase - (fill - 0.55) / 0.4 * (tubeReadBase - tubeReadTop);
  const clipId = `bclip-${slot}`;

  return (
    <g
      transform={`translate(${dx},40)`}
      onDragOver={(e) => { e.preventDefault(); setOverTarget(slot); }}
      onDragLeave={() => setOverTarget(null)}
      onDrop={onDropSlot(slot)}
    >
      {/* 드롭 타겟 영역 (투명, 넉넉히) */}
      <rect x="55" y="20" width="130" height="270" fill="transparent"
        stroke={highlight ? "var(--accent)" : "transparent"} strokeDasharray="5 4" strokeWidth="2" rx="10" />

      {!flask.placed ? (
        <text x="120" y="160" textAnchor="middle" fontSize="12" fill="#8a9aa8">
          ⚗️ 플라스크
        </text>
      ) : (
        <>
          <defs>
            <clipPath id={clipId}>
              <path d="M107 98 L107 130 Q107 138 103 150 L72 250 Q69 266 90 268 L150 268
                       Q171 266 168 250 L137 150 Q133 138 133 130 L133 98 Z" />
            </clipPath>
          </defs>

          {/* 유리관 (마개+관 모두 있을 때만 표시) */}
          {flask.tube && (
            <>
              <rect x="113" y={tubeTopY} width="14" height={tubeEndY - tubeTopY} rx="7"
                fill="rgba(230,240,248,.10)" stroke="#aac4d4" strokeWidth="2" />
              {liquid && (
                <rect x="116" y={tubeLevel} width="8" height={tubeEndY - 2 - tubeLevel}
                  fill={liquid.color} opacity="0.95" style={{ transition: "y .3s ease, height .3s ease" }} />
              )}
            </>
          )}

          {/* 플라스크 안 액체 */}
          {liquid && (
            <rect x="60" y="170" width="120" height="110" fill={liquid.color} opacity="0.85"
              clipPath={`url(#${clipId})`} />
          )}

          {/* 플라스크 몸통 */}
          <path d="M106 96 L106 130 Q106 138 102 150 L70 250 Q67 268 90 270 L150 270
                   Q173 268 170 250 L138 150 Q134 138 134 130 L134 96 Z"
            fill="rgba(200,220,235,.16)" stroke="#aac4d4" strokeWidth="2.5" />
          <path d="M103 96 L137 96" stroke="#aac4d4" strokeWidth="3" strokeLinecap="round" />

          {/* 고무마개 */}
          {flask.stopper && (
            <>
              <rect x="105" y="90" width="30" height="15" rx="3" fill="#7a5c43" />
              <rect x="105" y="90" width="30" height="5" rx="2.5" fill="#8d6b4e" />
            </>
          )}

          {/* 불꽃 */}
          <text x="120" y="292" textAnchor="middle" fontSize={16 + (temp - T_MIN) / 16}
            opacity={Math.min(1, (temp - T_MIN) / 30)}>🔥</text>
        </>
      )}
    </g>
  );
}

/* ================= 3) 바이메탈 ================= */
function BimetalTab() {
  const [temp, setTemp] = useState(T_MIN);
  const [top, setTop] = useState(null);    // 위층 금속
  const [bottom, setBottom] = useState(null); // 아래층 금속
  const [overSlot, setOverSlot] = useState(null);

  const dT = temp - T_MIN;
  const both = top && bottom;
  // 휨각: 팽창 차이에 비례. 팽창 큰 쪽이 바깥(볼록) → 작은 쪽으로 휜다.
  const diff = both ? top.alpha - bottom.alpha : 0;
  const angle = both ? diff * dT * 0.0011 * 90 : 0; // deg, 시각용 스케일
  const CONTACT_ANGLE = 35; // 아래로 이 각도만큼 휘면 접점에 닿음
  // 아래로 휨(양수)은 접점에서 막혀 더 휘지 못함. 위로 휨(음수)은 -60까지.
  const contact = both && angle >= CONTACT_ANGLE;
  const clampedAngle = Math.max(-60, Math.min(CONTACT_ANGLE, angle));
  const siren = contact; // 접점에 닿는 순간 회로가 연결되어 사이렌 작동
  const direction = !both ? "-" : Math.abs(clampedAngle) < 0.5 ? "변화 없음"
    : clampedAngle > 0 ? "아래로 휨 (위층이 더 팽창)" : "위로 휨 (아래층이 더 팽창)";

  // 곡선 휨 path 생성: 고정점(x0,y0)에서 길이 L의 띠가 균일 곡률로 휜다.
  // bend>0 이면 아래로 볼록. 두께 th의 띠 두 겹(위/아래) 좌표 배열 반환.
  const buildStrip = (x0, y0, L, th, bend, offset) => {
    const N = 24;
    // 총 휨각(rad). clampedAngle(deg)을 호의 누적 각으로 사용
    const totalA = (bend * Math.PI) / 180;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N;            // 0~1 (호 길이 비율)
      const a = totalA * s;       // 누적 접선각
      // 호를 따라가는 중심선 좌표 (수치적분 근사)
      // 시작 접선은 수평(+x). 곡률 일정 → 위치는 적분으로.
      // 단순화: 반지름 R = L/totalA, 원호 파라미터화
      let cx, cy;
      if (Math.abs(totalA) < 1e-4) {
        cx = x0 + L * s; cy = y0;
      } else {
        const R = L / totalA;
        cx = x0 + R * Math.sin(a);
        cy = y0 + R * (1 - Math.cos(a));
      }
      // 법선 방향으로 두께 오프셋
      const nx = -Math.sin(a), ny = Math.cos(a);
      top.push([cx + nx * offset, cy + ny * offset]);
      bot.push([cx + nx * (offset + th), cy + ny * (offset + th)]);
    }
    const pts = top.concat(bot.reverse());
    return "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L") + " Z";
  };

  const X0 = 60, Y0 = 100, LEN = 200, TH = 8;
  const topPath = buildStrip(X0, Y0, LEN, TH, clampedAngle, -TH);
  const botPath = buildStrip(X0, Y0, LEN, TH, clampedAngle, 0);

  const reset = () => { setTop(null); setBottom(null); setTemp(T_MIN); };

  const onDropSlot = (slot) => (e) => {
    e.preventDefault(); setOverSlot(null);
    const id = e.dataTransfer.getData("text/plain");
    const m = BIMETAL_METALS.find((x) => x.id === id);
    if (!m) return;
    slot === "top" ? setTop(m) : setBottom(m);
  };

  const Slot = ({ slot, val, label }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setOverSlot(slot); }}
      onDragLeave={() => setOverSlot(null)}
      onDrop={onDropSlot(slot)}
      style={{
        flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700,
        border: overSlot === slot ? "2px dashed var(--accent)" : "1px dashed var(--line)",
        background: "var(--chip)", textAlign: "center",
        color: val ? "var(--ink)" : "var(--muted)",
      }}
    >
      {label}: {val ? `${val.icon} ${val.name}` : "장착 안됨"}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong>📌 바이메탈</strong>
          <Btn onClick={reset}>초기화</Btn>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          금속을 위·아래 슬롯에 드래그해 장착한 뒤 알코올램프로 가열하세요.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Slot slot="top" val={top} label="위층" />
          <Slot slot="bottom" val={bottom} label="아래층" />
        </div>

        {/* 휨 시각화 */}
        <div style={{
          height: 240, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 14, border: "2px dashed var(--line)",
          background: siren ? "rgba(255,80,60,.10)" : "radial-gradient(circle at 50% 80%,rgba(255,140,80,.08),transparent 70%)",
          transition: "background .3s",
        }}>
          <svg width="320" height="200" viewBox="0 0 320 200">
            {/* 고정 받침 */}
            <rect x="40" y="88" width="22" height="44" fill="#666" rx="3" />
            {/* 바이메탈 스트립 (곡선으로 휨) */}
            <path d={topPath} fill={top ? heatColor(top.color.replace("#", ""), temp) : "#888"}
              style={{ transition: "d .3s ease" }} />
            <path d={botPath} fill={bottom ? heatColor(bottom.color.replace("#", ""), temp) : "#aaa"}
              style={{ transition: "d .3s ease" }} />
            {/* 사이렌 접점 (고정 단자) — 아래로 휜 끝이 여기 닿으면 멈추고 사이렌 작동 */}
            <line x1="248" y1="174" x2="248" y2="163" stroke="#445" strokeWidth="3" />
            <circle cx="248" cy="161" r="6" fill={siren ? "#ff4040" : "#445"} >
              {siren && <animate attributeName="r" values="6;9;6" dur="0.5s" repeatCount="indefinite" />}
            </circle>
            {/* 불꽃 (이모지) */}
            <text x="160" y="172" textAnchor="middle" fontSize={20 + (temp - T_MIN) / 12}
              opacity={Math.min(1, (temp - T_MIN) / 30)}>🔥</text>
          </svg>
        </div>

        <div style={{ marginTop: 14 }}>
          <HeatControl temp={temp} setTemp={setTemp} />
        </div>
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>🌡️ 온도: <b>{Math.round(temp)} ℃</b></div>
            <div>↩️ 휨각: <b>{both ? `${clampedAngle.toFixed(1)}°` : "-"}</b></div>
            <div>🧭 방향: <b>{direction}</b></div>
            <div>🔔 사이렌: <b style={{ color: siren ? "#ff5a5a" : "var(--ink)" }}>{siren ? "울림!" : "꺼짐"}</b></div>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
            팽창이 큰 금속이 바깥쪽으로 더 늘어나 반대쪽으로 휩니다.
          </div>
        </Panel>
        <Panel>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>🧰 금속 도구칸</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {BIMETAL_METALS.map((m) => (
              <div
                key={m.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", m.id)}
                style={{
                  cursor: "grab", padding: "10px 6px", borderRadius: 10, textAlign: "center",
                  fontSize: 12, fontWeight: 700, border: "1px solid var(--line)", background: "var(--chip)",
                }}
              >
                <div style={{ fontSize: 20 }}>{m.icon}</div>
                {m.name}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================= 4) 온도계 ================= */
function ThermometerTab() {
  const [temp, setTemp] = useState(T_MIN);
  const [therm, setTherm] = useState(null);
  const [maxT, setMaxT] = useState(T_MIN);
  const [overStand, setOverStand] = useState(false);

  useEffect(() => { setMaxT((m) => Math.max(m, temp)); }, [temp]);

  // 측정값: 온도계 범위로 클램프
  const reading = therm ? Math.max(therm.min, Math.min(therm.max, temp)) : null;
  const overRange = therm && temp > therm.max;

  const reset = () => { setTherm(null); setTemp(T_MIN); setMaxT(T_MIN); };

  // 액주 높이 (범위 대비)
  const liquidPct = therm
    ? Math.max(0, Math.min(1, (reading - therm.min) / (therm.max - therm.min)))
    : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong>📌 온도계</strong>
          <Btn onClick={reset}>초기화</Btn>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          온도계를 스탠드로 드래그해 장착한 뒤 알코올램프로 가열하세요.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setOverStand(true); }}
          onDragLeave={() => setOverStand(false)}
          onDrop={(e) => {
            e.preventDefault(); setOverStand(false);
            const id = e.dataTransfer.getData("text/plain");
            const t = THERMOMETERS.find((x) => x.id === id);
            if (t) { setTherm(t); setMaxT(temp); }
          }}
          style={{
            height: 320, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 14,
            border: overStand ? "2px dashed var(--accent)" : "2px dashed var(--line)",
            background: "radial-gradient(circle at 50% 70%,rgba(255,140,80,.08),transparent 70%)",
          }}
        >
          {!therm ? (
            <span style={{ color: "var(--muted)" }}>⚠️ 온도계 없음 — 스탠드에 장착하세요</span>
          ) : (
            <svg width="120" height="300" viewBox="0 0 120 300">
              {/* 스탠드 */}
              <rect x="10" y="260" width="100" height="10" rx="3" fill="#555" />
              <rect x="18" y="40" width="6" height="225" fill="#777" />
              {/* 유리관 */}
              <rect x="52" y="20" width="16" height="210" rx="8" fill="#0e1318" stroke="#aac4d4" strokeWidth="2" />
              {/* 액주 */}
              <rect x="55" y={20 + (1 - liquidPct) * 190} width="10" height={liquidPct * 190 + 20}
                fill={therm.color} rx="5" style={{ transition: "all .3s ease" }} />
              {/* 구부 */}
              <circle cx="60" cy="240" r="14" fill={therm.color} />
              {/* 불꽃 (이모지) */}
              <text x="60" y="280" textAnchor="middle" fontSize={18 + (temp - T_MIN) / 14}
                opacity={Math.min(1, (temp - T_MIN) / 30)}>🔥</text>
            </svg>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <HeatControl temp={temp} setTemp={setTemp} />
        </div>
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>🌡️ 실제 온도: <b>{Math.round(temp)} ℃</b></div>
            <div>📈 측정값: <b>{therm ? `${Math.round(reading)} ℃` : "-"}</b></div>
            <div>🔬 온도계: <b>{therm ? `${therm.icon} ${therm.name}` : "없음"}</b></div>
            <div>📊 최고: <b>{therm ? `${Math.round(Math.min(therm.max, maxT))} ℃` : "-"}</b></div>
          </div>
          {overRange && (
            <div style={{ color: "#ff7a45", fontSize: 12, marginTop: 8, fontWeight: 700 }}>
              ⚠️ 측정 범위({therm.max}℃)를 초과했습니다!
            </div>
          )}
          {therm && (
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
              측정 범위: {therm.min}℃ ~ {therm.max}℃
            </div>
          )}
        </Panel>
        <Panel>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>🧰 온도계 도구칸</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {THERMOMETERS.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                onClick={() => { setTherm(t); setMaxT(temp); }}
                style={{
                  cursor: "grab", padding: "10px 12px", borderRadius: 10,
                  fontSize: 13, fontWeight: 700, border: "1px solid var(--line)",
                  background: therm?.id === t.id ? "var(--accent)" : "var(--chip)",
                  color: therm?.id === t.id ? "#0c1116" : "var(--ink)",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                {t.name}
                <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.8 }}>{t.min}~{t.max}℃</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================= 메인 앱 ================= */
const TABS = [
  { id: "solid", label: "🪨 고체", comp: SolidTab },
  { id: "liquid", label: "💧 액체", comp: LiquidTab },
  { id: "bimetal", label: "🔩 바이메탈", comp: BimetalTab },
  { id: "thermo", label: "🌡️ 온도계", comp: ThermometerTab },
];

function ThermalExpansionApp() {
  const [tab, setTab] = useState("solid");
  const Active = TABS.find((t) => t.id === tab).comp;

  return (
    <div
      style={{
        "--bg": "#0c1116",
        "--panel": "#151c24",
        "--chip": "#1d2731",
        "--line": "#2b3742",
        "--ink": "#e8eef3",
        "--muted": "#8a9aa8",
        "--accent": "#ffb454",
        minHeight: "100vh",
        background: "radial-gradient(1200px 600px at 70% -10%, #1a2530, var(--bg))",
        color: "var(--ink)",
        fontFamily: "'Pretendard', 'Noto Sans KR', system-ui, sans-serif",
        padding: "24px 18px 60px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 30, margin: "0 0 4px", letterSpacing: -0.5 }}>
            🌡️ 열팽창 시뮬레이션
          </h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>
            고체 · 액체 · 바이메탈 · 온도계 — 가열하며 부피 변화를 관찰하세요
          </p>
        </header>

        {/* 탭 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: "1 1 auto",
                padding: "12px 10px",
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: tab === t.id ? "var(--accent)" : "var(--panel)",
                color: tab === t.id ? "#0c1116" : "var(--ink)",
                fontWeight: 800,
                fontSize: 15,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background .2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Active />

        <footer style={{ marginTop: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
          교육용 시뮬레이션 · 부피 변화는 관찰이 쉽도록 시각적으로 과장되어 있습니다
        </footer>
      </div>
    </div>
  );
}

export default ThermalExpansionApp;
