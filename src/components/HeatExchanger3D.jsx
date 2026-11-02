import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { COLORS } from "../data/constants";

// ------------------------------------------------------------
// 3D 모델: 실습실 열교환기 설비를 사진에 맞춰 Blender로 모델링한 파일(hardware/3d/heat_exchanger_photo_match.blend)을
// 웹용 GLB로 변환한 것. (흰색 앵글 랙 + 상단 쉘-튜브 열교환기 + 수조·냄비·히터·펌프·유량계·배관)
//  - 노드 "HX_EXCHANGER": 열교환기 본체 (쉘, 플랜지, 노즐, 새들, 드레인, 좌측 끝단 밸브·압력계)
//  - 노드 "HX_FACILITY" : 주변 설비 (랙, 수조, 냄비, 히터, 펌프, 유량계, 배관·호스)
//  → "열교환기만 보기"에서는 HX_FACILITY만 숨기면 된다.
// 단위는 m, Y-up. 아래 좌표는 Blender 좌표(x, y, z)를 B()로 three.js 좌표(x, z, -y)로 바꿔서 쓴다.
// ------------------------------------------------------------
const MODEL_URL = "/models/heat_exchanger_rig.glb";
const B = (x, y, z) => [x, z, -y];

// 상태 핀 위치 — 팀 공정 흐름 영상(HEX-SENTINEL 발표자료) 기준
//  in     : 온수 입구 — 쉘 오른쪽 위 노즐 (히터 냄비에서 올라온 온수가 들어옴)
//  inCold : 냉각수 입구 — 쉘 왼쪽 위 노즐 (수조 쪽 펌프에서 올라온 냉각수가 들어옴)
//  out    : 출구 — 왼쪽 끝단 밸브 (열교환을 마친 물이 수조로 내려감)
//  vent   : 벤트 — 쉘 상단 가운데 (두 입구 사이, 드레인 바로 위)
//  drain  : 드레인 — 쉘 하단 드레인 플러그
const PIN_POSITIONS = {
  in: B(0.123, 0.065, 1.326),
  inCold: B(-0.423, 0.065, 1.326),
  out: B(-0.545, 0.065, 1.136),
  vent: B(-0.07, 0.065, 1.262),
  drain: B(-0.07, 0.062, 1.058),
};

// 3D 뷰 위에 항상 떠 있는 짧은 라벨 (언어 무관하게 영문 약어로 고정)
const PIN_SHORT_LABELS = { in: "HOT IN", inCold: "COLD IN", out: "OUT", vent: "VENT", drain: "DRAIN" };

// 라벨을 핀에서 살짝 띄워 모델과 겹치지 않게 배치 (상단은 위로, 출구는 왼쪽으로, 드레인은 아래로)
const LABEL_OFFSETS = {
  in: [0, 0.045, 0],
  inCold: [0, 0.045, 0],
  out: [-0.07, 0.0, 0],
  vent: [0, 0.03, 0],
  drain: [0, -0.025, 0],
};

// ------------------------------------------------------------
// 공정 흐름 (팀 발표 영상 "데우고, 식히고, 다시 돈다"와 같은 4단계)
// 경로 좌표는 Blender 모델의 실제 배관 커브(downpipe·outlet·hose·bridge)에서 꺾이는 점만 뽑은 것.
// 점 순서 = 물이 흐르는 방향 (선 위를 흐르는 빛도 이 방향으로 움직인다)
// ------------------------------------------------------------
const FLOWS = [
  {
    id: 1, // ① 온수: 히터 냄비 → 오른쪽 위 노즐(HOT IN)
    color: "#ef4444",
    paths: [[B(0.245, -0.241, 0.331), B(0.245, -0.241, 0.457), B(0.245, -0.382, 0.457), B(0.123, -0.382, 0.457), B(0.123, -0.382, 1.355), B(0.123, 0.065, 1.355), B(0.123, 0.065, 1.321)]],
    chipAt: B(0.123, -0.382, 0.82),
  },
  {
    id: 2, // ② 냉각수: 수조 쪽 펌프 → 왼쪽 위 노즐(COLD IN)
    color: "#38bdf8",
    paths: [[B(-0.423, 0.146, 0.655), B(-0.423, -0.386, 0.56), B(-0.423, -0.386, 1.356), B(-0.423, 0.065, 1.356), B(-0.423, 0.065, 1.321)]],
    chipAt: B(-0.423, -0.386, 0.86),
  },
  {
    id: 3, // ③ 열교환 후: 왼쪽 끝단 출구(OUT) → 수조
    color: "#a78bfa",
    paths: [[B(-0.545, 0.065, 1.136), B(-0.596, 0.065, 1.136), B(-0.596, -0.38, 1.136), B(-0.596, -0.38, 0.653), B(-0.396, -0.38, 0.653), B(-0.396, 0.11, 0.716)]],
    chipAt: B(-0.596, -0.38, 1.06),
  },
  {
    id: 4, // ④ 분배·순환: 수조 물 → 호스 → 첫 번째 냄비, 티(Tee)에서 다리 배관으로 두 번째 냄비
    color: "#34d399",
    paths: [
      { smooth: true, pts: [B(-0.592, -0.245, 0.473), B(-0.419, -0.205, 0.487), B(-0.21, -0.13, 0.491), B(-0.091, -0.157, 0.457), B(0.003, -0.193, 0.356)] },
      [B(0.016, -0.166, 0.331), B(0.016, -0.166, 0.41), B(0.271, -0.166, 0.41), B(0.271, -0.166, 0.306)],
    ],
    chipAt: B(-0.42, -0.21, 0.42),
  },
];
const FLOW_STEP_DELAY = 1.3; // 단계 사이 간격(초) — 영상처럼 ①→④ 순서로 하나씩 그려짐
const FLOW_DRAW_TIME = 1.1; // 한 단계 선이 다 그려지는 데 걸리는 시간(초)

const statusColorHex = (level) => (level >= 3 ? 0xdc2626 : level === 2 ? 0xea580c : level === 1 ? 0xca8a04 : 0x16a34a);
const statusColorCss = (level) => (level >= 3 ? "#dc2626" : level === 2 ? "#ea580c" : level === 1 ? "#ca8a04" : "#16a34a");

// 흐름 선 위를 지나가는 빛(밝은 띠) 텍스처. 텍스처를 선 방향으로 밀어서 물이 흐르는 방향을 보여준다.
function makeStripeTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 4;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, "rgb(205,205,205)");
  grad.addColorStop(0.55, "rgb(205,205,205)");
  grad.addColorStop(0.8, "rgb(255,255,255)");
  grad.addColorStop(1, "rgb(205,205,205)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 꺾인 배관(직선 구간들) 또는 부드러운 호스(곡선)를 하나의 3D 경로로 만든다.
function makeCurve(path) {
  const smooth = !Array.isArray(path) && path.smooth;
  const pts = (Array.isArray(path) ? path : path.pts).map((p) => new THREE.Vector3(...p));
  if (smooth) return new THREE.CatmullRomCurve3(pts);
  const cp = new THREE.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) cp.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  return cp;
}

export default function HeatExchanger3D({ levels, t }) {
  const mountRef = useRef(null);
  const [loadPct, setLoadPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // "facility": 설비 전체 보기 / "exchanger": 열교환기만 보기
  const [view, setView] = useState("facility");
  // 공정 흐름 보기 on/off, 강조할 단계(null이면 전체)
  const [flowOn, setFlowOn] = useState(false);
  const [focusStep, setFocusStep] = useState(null);

  // 애니메이션 루프(requestAnimationFrame)에서 최신 값을 읽을 수 있게 ref로 보관
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const flowRef = useRef({ on: false, focus: null, startedAt: 0 });
  const chipTextRef = useRef({});
  chipTextRef.current = Object.fromEntries(FLOWS.map((f) => [f.id, t(`flow_${f.id}_chip`)]));
  // 보기 전환·흐름 재생은 useEffect 밖(버튼)에서 일어나므로, 3D 장면 쪽 함수를 ref로 연결해 둔다.
  const applyViewRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const clockRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.01, 50);
    camera.position.set(1.4, 1.9, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    // 금속 재질(황동·스테인리스·아연도금)은 주변 반사가 있어야 실물처럼 보이므로 실내 환경광을 깔아준다.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envTex;
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(-1.5, 3, 2.8);
    scene.add(keyLight);

    // 라벨 오버레이 렌더러 — 항상 화면에 보이는 2D 텍스트 태그
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(mount.clientWidth, mount.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.left = "0px";
    labelRenderer.domElement.style.pointerEvents = "none"; // 드래그 회전을 가리지 않도록
    mount.appendChild(labelRenderer.domElement);

    // 컨트롤 (마우스 드래그 회전 / 휠 줌)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.8, 0);

    // ---- 상태 핀 + 항상 보이는 라벨 ----
    const pinMeshes = {};
    const labelDivs = {};
    const pinLabels = [];
    Object.entries(PIN_POSITIONS).forEach(([key, pos]) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.009, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x000000, roughness: 0.4 })
      );
      mesh.position.set(...pos);
      scene.add(mesh);
      pinMeshes[key] = mesh;

      const div = document.createElement("div");
      div.textContent = PIN_SHORT_LABELS[key];
      div.style.cssText =
        "padding:2px 7px;border-radius:999px;font-size:10px;font-family:monospace;font-weight:700;" +
        "white-space:nowrap;border:1px solid rgba(15,23,42,0.15);box-shadow:0 1px 4px rgba(15,23,42,0.25);" +
        `transform:translate(-50%,${key === "drain" ? "0" : "-100%"});letter-spacing:0.03em;`;
      const label = new CSS2DObject(div);
      const off = LABEL_OFFSETS[key];
      label.position.set(pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]);
      scene.add(label);
      labelDivs[key] = div;
      pinLabels.push(label);
    });

    // ---- 공정 흐름 선 (처음엔 숨김, "공정 흐름 보기"를 누르면 나타남) ----
    // 배관보다 살짝 굵은 색 튜브 + 바깥쪽 은은한 빛(글로우) 튜브. 랙·냄비에 가려지지 않도록 항상 맨 위에 그린다.
    const stripeBase = makeStripeTexture();
    const flowGroup = new THREE.Group();
    flowGroup.visible = false;
    scene.add(flowGroup);
    const flowItems = FLOWS.map((flow) => {
      const parts = flow.paths.map((path) => {
        const curve = makeCurve(path);
        const len = curve.getLength();
        const segs = Math.max(24, Math.round(len * 160));
        const coreGeo = new THREE.TubeGeometry(curve, segs, 0.011, 10, false);
        const glowGeo = new THREE.TubeGeometry(curve, segs, 0.024, 10, false);
        const tex = stripeBase.clone();
        tex.needsUpdate = true;
        tex.repeat.set(len / 0.07, 1);
        const coreMat = new THREE.MeshBasicMaterial({ color: flow.color, map: tex, transparent: true, depthTest: false, depthWrite: false });
        const glowMat = new THREE.MeshBasicMaterial({ color: flow.color, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false });
        const core = new THREE.Mesh(coreGeo, coreMat);
        const glow = new THREE.Mesh(glowGeo, glowMat);
        core.renderOrder = 21;
        glow.renderOrder = 20;
        flowGroup.add(glow, core);
        return { core, glow, tex };
      });
      // 단계 이름 칩 ("① 온수 (가열)" 등)
      const chip = document.createElement("div");
      chip.style.cssText =
        `padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;color:${flow.color};` +
        `background:rgba(10,15,30,0.82);border:1px solid ${flow.color};box-shadow:0 0 10px ${flow.color}66;transform:translate(-50%,-50%);`;
      const chipObj = new CSS2DObject(chip);
      chipObj.position.set(...flow.chipAt);
      flowGroup.add(chipObj);
      return { flow, parts, chip, chipObj };
    });

    // ---- 카메라를 특정 영역(설비 전체 / 열교환기)에 맞추는 함수 ----
    // 비스듬히 앞-오른쪽-위에서 내려다보는 방향을 유지한 채, 상자가 화면에 꽉 차는 거리까지 부드럽게 이동한다.
    const VIEW_DIR = new THREE.Vector3(0.38, 0.32, 1).normalize();
    let tween = null;
    const fitTo = (box, instant) => {
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      // 상자의 8개 꼭짓점을 카메라 화면 좌표로 옮겨 보고, 모든 꼭짓점이 화면 안(가로·세로 모두)에 들어오는
      // 가장 가까운 거리를 계산한다. 화면이 넓든(PC) 좁든(휴대폰) 비율에 맞춰 꽉 차게 보인다.
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const tanH = tanV * camera.aspect;
      const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), VIEW_DIR).normalize();
      const camUp = new THREE.Vector3().crossVectors(VIEW_DIR, camRight).normalize();
      let dist = 0;
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
        const depth = c.dot(VIEW_DIR); // 카메라 쪽으로 튀어나온 정도
        dist = Math.max(dist, depth + Math.abs(c.dot(camRight)) / tanH, depth + Math.abs(c.dot(camUp)) / tanV);
      }
      dist *= 1.1; // 가장자리 여백(라벨이 잘리지 않도록)
      const toPos = center.clone().addScaledVector(VIEW_DIR, dist);
      controls.minDistance = radius * 0.6;
      controls.maxDistance = radius * 6;
      if (instant) {
        camera.position.copy(toPos);
        controls.target.copy(center);
        tween = null;
      } else {
        tween = { t0: performance.now(), fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget: center };
      }
    };

    // ---- GLB 로드 ----
    let model = null;
    const boxes = {};
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder); // 용량을 줄이려고 meshopt로 압축된 형상을 해제
    loader.load(
      MODEL_URL,
      (gltf) => {
        model = gltf.scene;
        scene.add(model);
        const facilityNode = model.getObjectByName("HX_FACILITY");
        const exchangerNode = model.getObjectByName("HX_EXCHANGER");
        boxes.facility = new THREE.Box3().setFromObject(model);
        boxes.exchanger = exchangerNode ? new THREE.Box3().setFromObject(exchangerNode) : boxes.facility;
        applyViewRef.current = (v, instant) => {
          if (facilityNode) facilityNode.visible = v === "facility";
          fitTo(boxes[v] || boxes.facility, instant);
        };
        applyViewRef.current(viewRef.current, true);
        setLoading(false);
      },
      (e) => {
        if (e.total) setLoadPct(Math.round((e.loaded / e.total) * 100));
      },
      () => {
        setLoading(false);
        setLoadError(true);
      }
    );

    // ---- 애니메이션 루프 ----
    let raf;
    const clock = new THREE.Clock();
    clockRef.current = clock;
    let prev = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const dt = time - prev;
      prev = time;

      // 카메라 이동(트윈)
      if (tween) {
        const k = Math.min(1, (performance.now() - tween.t0) / 700);
        const e = 1 - Math.pow(1 - k, 3); // ease-out
        camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
        if (k >= 1) tween = null;
      }
      controls.update();

      // 상태 핀 색상/점멸
      const lv = levelsRef.current;
      Object.entries(pinMeshes).forEach(([key, mesh]) => {
        const level = lv ? lv[key] || 0 : 0;
        mesh.material.color.setHex(statusColorHex(level));
        const div = labelDivs[key];
        div.style.background = statusColorCss(level);
        div.style.color = "#ffffff";
        if (level >= 3) {
          // 위험 상태 핀 + 라벨 모두 점멸 + 확대/축소
          const wave = Math.abs(Math.sin(time * 4));
          mesh.material.emissive.setHex(0xdc2626);
          mesh.material.emissiveIntensity = 0.6 + wave * 0.6;
          const s = 1 + wave * 0.5;
          mesh.scale.set(s, s, s);
          div.style.opacity = String(0.55 + wave * 0.45);
        } else {
          mesh.material.emissiveIntensity = 0;
          mesh.scale.set(1, 1, 1);
          div.style.opacity = "1";
        }
      });

      // 공정 흐름: ①→④ 순서로 선이 그려지고, 다 그려진 선 위로는 빛이 흐름 방향으로 계속 움직인다.
      const fs = flowRef.current;
      flowGroup.visible = fs.on;
      pinLabels.forEach((l) => (l.visible = !fs.on)); // 흐름 보기 중에는 핀 라벨을 숨겨 화면을 깔끔하게
      if (!fs.on) {
        flowItems.forEach(({ chipObj }) => (chipObj.visible = false)); // 2D 칩은 그룹을 숨겨도 남을 수 있어 직접 숨김
      } else {
        const since = time - fs.startedAt;
        flowItems.forEach(({ flow, parts, chip, chipObj }, idx) => {
          const progress = THREE.MathUtils.clamp((since - idx * FLOW_STEP_DELAY) / FLOW_DRAW_TIME, 0, 1);
          const dim = fs.focus != null && fs.focus !== flow.id; // 다른 단계를 강조 중이면 흐리게
          parts.forEach(({ core, glow, tex }) => {
            [core, glow].forEach((m) => {
              const count = m.geometry.index.count;
              m.geometry.setDrawRange(0, Math.floor((count / 6) * progress) * 6);
            });
            core.material.opacity = dim ? 0.12 : 0.95;
            glow.material.opacity = dim ? 0.03 : 0.22;
            tex.offset.x -= dt * 1.6;
          });
          const text = chipTextRef.current[flow.id];
          if (chip.textContent !== text) chip.textContent = text;
          chipObj.visible = progress > 0.6;
          chip.style.opacity = dim ? "0.25" : "1";
        });
      }

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    // 리사이즈 대응
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      applyViewRef.current = null;
      clockRef.current = null;
      Object.values(pinMeshes).forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      flowItems.forEach(({ parts }) =>
        parts.forEach(({ core, glow, tex }) => {
          core.geometry.dispose();
          glow.geometry.dispose();
          core.material.dispose();
          glow.material.dispose();
          tex.dispose();
        })
      );
      stripeBase.dispose();
      if (model) {
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
            Object.values(mat).forEach((v) => v && v.isTexture && v.dispose());
            mat.dispose();
          });
        });
      }
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      if (mount.contains(labelRenderer.domElement)) mount.removeChild(labelRenderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 버튼으로 보기를 바꾸면 3D 장면에 반영 (모델 로드 전이면 로드 직후 viewRef 값으로 적용됨)
  useEffect(() => {
    if (applyViewRef.current) applyViewRef.current(view, false);
  }, [view]);

  // 흐름 재생: 시작 시각을 지금으로 바꾸면 애니메이션 루프가 ①부터 다시 그린다.
  const restartFlow = () => {
    flowRef.current.startedAt = clockRef.current ? clockRef.current.getElapsedTime() : 0;
  };
  const toggleFlow = () => {
    const next = !flowOn;
    setFlowOn(next);
    setFocusStep(null);
    flowRef.current.on = next;
    flowRef.current.focus = null;
    if (next) {
      setView("facility"); // 흐름은 냄비·수조까지 이어지므로 설비 전체 보기로 전환
      restartFlow();
    }
  };
  const chooseView = (v) => {
    setView(v);
    if (v === "exchanger" && flowOn) {
      // 열교환기만 보기에서는 주변 설비가 숨겨져 흐름 선이 허공에 뜨므로 흐름 보기를 끈다
      setFlowOn(false);
      flowRef.current.on = false;
    }
  };
  const chooseStep = (id) => {
    const next = focusStep === id ? null : id;
    setFocusStep(next);
    flowRef.current.focus = next;
  };

  const VIEW_OPTIONS = [
    { key: "facility", label: t("view_facility") },
    { key: "exchanger", label: t("view_exchanger") },
  ];
  const disabled = loading || loadError;

  return (
    <div>
      <div className="relative w-full" style={{ height: 460 }}>
        <div ref={mountRef} className="w-full h-full rounded-lg" style={{ background: COLORS.panelMuted }} />

        {/* 상단 컨트롤: 보기 전환(설비 전체 / 열교환기만) + 공정 흐름 보기 */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="flex rounded-md overflow-hidden shadow-sm pointer-events-auto" style={{ border: `1px solid ${COLORS.panelBorderLit}`, background: COLORS.panel }}>
            {VIEW_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => chooseView(o.key)}
                aria-pressed={view === o.key}
                disabled={disabled}
                className="text-xs font-semibold px-3 py-1.5"
                style={{ background: view === o.key ? COLORS.cyan : "transparent", color: view === o.key ? "#ffffff" : COLORS.textPrimary }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggleFlow}
            aria-pressed={flowOn}
            disabled={disabled}
            className="text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm pointer-events-auto flex items-center gap-1.5"
            style={{
              background: flowOn ? "linear-gradient(90deg,#ef4444,#38bdf8,#a78bfa,#34d399)" : COLORS.panel,
              color: flowOn ? "#ffffff" : COLORS.textPrimary,
              border: `1px solid ${flowOn ? "transparent" : COLORS.panelBorderLit}`,
              textShadow: flowOn ? "0 1px 2px rgba(0,0,0,0.45)" : "none",
            }}
          >
            <span aria-hidden>🌊</span> {t("flow_toggle")}
          </button>
          {flowOn && (
            <button
              onClick={restartFlow}
              className="text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm pointer-events-auto"
              style={{ background: COLORS.panel, color: COLORS.textPrimary, border: `1px solid ${COLORS.panelBorderLit}` }}
            >
              ↻ {t("flow_replay")}
            </button>
          )}
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-mono" style={{ color: COLORS.textDim }}>
            {t("loading_3d")} {loadPct > 0 ? `${loadPct}%` : ""}
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-mono" style={{ color: COLORS.danger }}>
            {t("load_error_3d")} ({MODEL_URL})
          </div>
        )}
        <div className="absolute bottom-2 right-3 text-[10px] font-mono" style={{ color: COLORS.textDim }}>
          {t("drag_hint")}
        </div>
      </div>

      {/* 공정 흐름 단계 설명 — 누르면 그 단계만 강조 (다시 누르면 전체) */}
      {flowOn && (
        <div className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {FLOWS.map((f) => {
              const active = focusStep === f.id;
              const dimmed = focusStep != null && !active;
              return (
                <button
                  key={f.id}
                  onClick={() => chooseStep(f.id)}
                  aria-pressed={active}
                  className="text-left rounded-md px-3 py-2.5 flex gap-3 transition-opacity"
                  style={{
                    background: COLORS.panelSoft,
                    border: `1px solid ${active ? f.color : COLORS.panelBorder}`,
                    boxShadow: active ? `0 0 0 1px ${f.color}, 0 0 14px ${f.color}55` : "none",
                    opacity: dimmed ? 0.45 : 1,
                  }}
                >
                  <span className="text-xl font-black leading-none font-mono" style={{ color: f.color }}>
                    {f.id}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
                      {t(`flow_${f.id}_title`)}
                    </span>
                    <span className="text-[11px] leading-snug" style={{ color: COLORS.textDim }}>
                      {t(`flow_${f.id}_desc`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] font-mono mt-1.5" style={{ color: COLORS.textDim }}>
            {t("flow_hint")}
          </p>
        </div>
      )}
    </div>
  );
}

export { PIN_POSITIONS, FLOWS };
