// src/utils/alertSound.js
// ------------------------------------------------------------
// Web Audio API 기반 경고음(비프) 유틸리티.
//
// 브라우저 자동재생 정책: AudioContext는 사용자의 첫 클릭/터치/키 입력 같은
// "제스처" 이벤트 이전에는 소리를 내지 못하거나 suspended 상태로 생성된다.
// 그래서 이 모듈은
//   1) 모듈 스코프에서 document에 1회성 상호작용 리스너를 등록해두고
//   2) 첫 상호작용이 감지되면 AudioContext를 생성/resume해서 "unlock" 처리하고
//   3) unlock되기 전에 playAlertSound()가 호출되면 조용히 무시(스킵)한다.
// 이렇게 하면 호출부(App.jsx)는 "지금 재생 가능한지"를 신경 쓰지 않고
// 그냥 playAlertSound()만 호출하면 된다.
// ------------------------------------------------------------

let audioCtx = null;
let unlocked = false;
let unlockListenersAttached = false;

function createContext() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null; // 이 브라우저는 Web Audio API를 지원하지 않음
  audioCtx = new Ctx();
  return audioCtx;
}

function handleFirstInteraction() {
  const ctx = createContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  unlocked = true;
  removeUnlockListeners();
}

function removeUnlockListeners() {
  document.removeEventListener("click", handleFirstInteraction);
  document.removeEventListener("touchstart", handleFirstInteraction);
  document.removeEventListener("keydown", handleFirstInteraction);
}

// App이 마운트되는 시점에 1회 호출해서 리스너를 준비해둔다.
// (모듈이 import되는 시점에 바로 등록해도 되지만, 명시적으로 초기화 함수를
// 두면 SSR 등 document가 없는 환경에서도 안전하게 건너뛸 수 있다.)
export function initAlertSound() {
  if (unlockListenersAttached || typeof document === "undefined") return;
  unlockListenersAttached = true;
  document.addEventListener("click", handleFirstInteraction);
  document.addEventListener("touchstart", handleFirstInteraction);
  document.addEventListener("keydown", handleFirstInteraction);
}

export function isAlertSoundUnlocked() {
  return unlocked;
}

/**
 * 짧은 2음 경고 비프음을 재생한다.
 * - 사용자의 첫 상호작용 이전이면 아무 것도 하지 않고 조용히 리턴한다.
 * - muted=true면 재생하지 않는다 (호출부에서 음소거 토글 상태를 넘겨줌).
 */
export function playAlertSound({ muted = false } = {}) {
  if (muted) return;
  if (!unlocked) return; // 아직 사용자 상호작용 전 — 자동재생 정책상 재생 불가

  const ctx = createContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const beep = (startOffset, freq, duration) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now + startOffset);

    // 클릭 노이즈 방지를 위한 짧은 어택/릴리즈 램프
    gain.gain.setValueAtTime(0, now + startOffset);
    gain.gain.linearRampToValueAtTime(0.18, now + startOffset + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + startOffset + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.02);
  };

  // 삐-삐 2음 경고음 (급박한 느낌을 위해 두 번째 음을 살짝 더 높게)
  beep(0, 880, 0.14);
  beep(0.18, 1046.5, 0.16);
}
