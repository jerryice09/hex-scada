import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { COLORS } from "../data/constants";

// ------------------------------------------------------------
// 3D 모델: 실습실 열교환기 설비를 사진에 맞춰 Blender로 모델링한 파일(heat_exchanger_photo_match.blend)을
// 웹용 GLB로 변환한 것. (흰색 앵글 랙 + 상단 쉘-튜브 열교환기 + 수조·냄비·히터·펌프·유량계·배관)
//  - 노드 "HX_EXCHANGER": 열교환기 본체 (쉘, 플랜지, 노즐, 새들, 드레인, 좌측 끝단 밸브·압력계)
//  - 노드 "HX_FACILITY" : 주변 설비 (랙, 수조, 냄비, 히터, 펌프, 유량계, 배관·호스)
//  → "열교환기만 보기"에서는 HX_FACILITY만 숨기면 된다.
// 단위는 m, Y-up (Blender Z-up 좌표를 glTF 내보내기에서 자동 변환).
// ------------------------------------------------------------
const MODEL_URL = "/models/heat_exchanger_rig.glb";

// 상태 핀 위치 (m). Blender 좌표 (x, y, z) → 여기서는 (x, z, -y).
//  in   : 왼쪽 상단 노즐 (황동 어댑터 윗면)
//  out  : 오른쪽 상단 노즐
//  vent : 왼쪽 끝단 벤트 밸브 (바로 옆이 압력계 → 배관 압력과 연동)
//  drain: 쉘 하단 드레인 플러그
const PIN_POSITIONS = {
  in: [-0.423, 1.326, -0.065],
  out: [0.123, 1.326, -0.065],
  vent: [-0.545, 1.162, -0.065],
  drain: [-0.07, 1.058, -0.062],
};

// 3D 뷰 위에 항상 떠 있는 짧은 라벨 텍스트 (핀이 작아서 안 보이는 문제 보완)
// 언어 무관하게 영문 약어로 고정 표기 (IN/OUT/VENT/DRAIN)
const PIN_SHORT_LABELS = { in: "IN", out: "OUT", vent: "VENT", drain: "DRAIN" };

// 라벨을 핀에서 살짝 띄워 모델과 겹치지 않게 배치.
// 상단 포트는 위로, 벤트는 왼쪽 위로(IN 라벨과 겹치지 않게), 드레인은 아래로.
const LABEL_OFFSETS = {
  in: [0, 0.045, 0],
  out: [0, 0.045, 0],
  vent: [-0.045, 0.02, 0],
  drain: [0, -0.025, 0],
};

const statusColorHex = (level) => (level >= 3 ? 0xdc2626 : level === 2 ? 0xea580c : level === 1 ? 0xca8a04 : 0x16a34a);
const statusColorCss = (level) => (level >= 3 ? "#dc2626" : level === 2 ? "#ea580c" : level === 1 ? "#ca8a04" : "#16a34a");

export default function HeatExchanger3D({ levels, t }) {
  const mountRef = useRef(null);
  const [loadPct, setLoadPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // "facility": 설비 전체 보기 / "exchanger": 열교환기만 보기
  const [view, setView] = useState("facility");

  // 최신 levels를 애니메이션 루프(requestAnimationFrame)에서도 읽을 수 있게 ref로 보관
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  // 보기 전환은 useEffect 밖(버튼)에서 일어나므로, 3D 장면 쪽 함수를 ref로 연결해 둔다.
  const applyViewRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

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

    // 라벨(IN/OUT/VENT/DRAIN) 오버레이 렌더러 — 항상 화면에 보이는 2D 텍스트 태그
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

    // 핀(포트 상태 마커) + 항상 보이는 라벨 태그
    const pinMeshes = {};
    const labelDivs = {};
    Object.entries(PIN_POSITIONS).forEach(([key, pos]) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.009, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x000000, roughness: 0.4 })
      );
      mesh.position.set(...pos);
      mesh.renderOrder = 10;
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
    let facilityNode = null;
    const boxes = {};
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder); // 용량을 줄이려고 meshopt로 압축된 형상을 해제
    loader.load(
      MODEL_URL,
      (gltf) => {
        model = gltf.scene;
        scene.add(model);
        facilityNode = model.getObjectByName("HX_FACILITY");
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

    // 애니메이션 루프: 카메라 이동(트윈) + 컨트롤 감쇠 + 핀 색상/점멸 + 라벨 배지 색상
    let raf;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);

      if (tween) {
        const k = Math.min(1, (performance.now() - tween.t0) / 700);
        const e = 1 - Math.pow(1 - k, 3); // ease-out
        camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
        if (k >= 1) tween = null;
      }
      controls.update();

      const lv = levelsRef.current;
      const time = clock.getElapsedTime();
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
      Object.values(pinMeshes).forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
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

  const VIEW_OPTIONS = [
    { key: "facility", label: t("view_facility") },
    { key: "exchanger", label: t("view_exchanger") },
  ];

  return (
    <div className="relative w-full" style={{ height: 460 }}>
      <div ref={mountRef} className="w-full h-full rounded-lg" style={{ background: COLORS.panelMuted }} />

      {/* 보기 전환: 설비 전체 / 열교환기만 */}
      <div className="absolute top-3 left-3 flex rounded-md overflow-hidden shadow-sm" style={{ border: `1px solid ${COLORS.panelBorderLit}`, background: COLORS.panel }}>
        {VIEW_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setView(o.key)}
            aria-pressed={view === o.key}
            disabled={loading || loadError}
            className="text-xs font-semibold px-3 py-1.5"
            style={{
              background: view === o.key ? COLORS.cyan : "transparent",
              color: view === o.key ? "#ffffff" : COLORS.textPrimary,
            }}
          >
            {o.label}
          </button>
        ))}
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
  );
}

export { PIN_POSITIONS };
