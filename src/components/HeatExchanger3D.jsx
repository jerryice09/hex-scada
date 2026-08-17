import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { COLORS } from "../data/constants";

// ------------------------------------------------------------
// OpenSCAD 모델(hardware/3d/model_v2.scad) 기준 실측 좌표(mm).
// OpenSCAD는 Z-up 좌표계라 좌표값을 그대로 쓰고, Three.js 쪽 그룹을
// X축으로 -90도 회전시켜서 Y-up으로 맞춘다 (아래 useEffect 참고).
// 좌표를 바꾸려면 .scad 파일의 oil_port_dist / end_fitting_offset 값과 맞춰야 한다.
// ------------------------------------------------------------
const PIN_POSITIONS = {
  in: [-201.5, 0, 57],
  out: [201.5, 0, 57],
  vent: [-172.5, 0, 57],
  drain: [172.5, 0, -57],
  flame: [0, 0, 66],
};

// 3D 뷰 위에 항상 떠 있는 짧은 라벨 텍스트 (핀이 작아서 안 보이는 문제 보완)
// 언어 무관하게 영문 약어로 고정 표기 (IN/OUT/VENT/DRAIN/FLAME)
const PIN_SHORT_LABELS = {
  in: "IN",
  out: "OUT",
  vent: "VENT",
  drain: "DRAIN",
  flame: "FLAME",
};

// 라벨을 핀 위치에서 살짝 띄워서 모델과 겹치지 않게 배치 (상단 포트는 위로, 하단 드레인은 아래로)
const LABEL_POSITIONS = {
  in: [-201.5, 0, 82],
  out: [201.5, 0, 82],
  vent: [-172.5, 0, 82],
  drain: [172.5, 0, -82],
  flame: [0, 0, 92],
};

export default function HeatExchanger3D({ levels, t }) {
  const mountRef = useRef(null);
  const pinMeshesRef = useRef({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 최신 levels를 애니메이션 루프(useEffect 밖 requestAnimationFrame)에서도 읽을 수 있게 ref로 보관
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 1, 5000);
    // 하단의 DRAIN 핀까지 기본 화면에서 보이도록 카메라를 살짝 낮춰서 비스듬히 내려다보게 설정
    camera.position.set(480, 260, 680);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // 라벨(IN/OUT/VENT/DRAIN/FLAME) 오버레이 렌더러 — 항상 화면에 보이는 2D 텍스트 태그
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(mount.clientWidth, mount.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.left = "0px";
    labelRenderer.domElement.style.pointerEvents = "none"; // 드래그 회전을 가리지 않도록
    mount.appendChild(labelRenderer.domElement);

    // 조명
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(300, 500, 400);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    fillLight.position.set(-400, -200, -300);
    scene.add(fillLight);

    // 컨트롤 (마우스 드래그 회전 / 휠 줌)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 250;
    controls.maxDistance = 1400;
    controls.target.set(0, 0, 0);

    // 모델 + 핀을 담을 그룹: OpenSCAD(Z-up) → Three.js(Y-up) 변환
    const modelGroup = new THREE.Group();
    modelGroup.rotation.x = -Math.PI / 2;
    scene.add(modelGroup);

    // 핀(포트 상태 마커) + 항상 보이는 라벨 태그 생성
    const pinMeshes = {};
    const labelDivs = {};
    Object.entries(PIN_POSITIONS).forEach(([key, pos]) => {
      const geo = new THREE.SphereGeometry(7, 20, 20);
      const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x000000, roughness: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      modelGroup.add(mesh);
      pinMeshes[key] = mesh;

      const div = document.createElement("div");
      div.textContent = PIN_SHORT_LABELS[key];
      div.style.cssText =
        "padding:2px 7px;border-radius:999px;font-size:10px;font-family:monospace;font-weight:700;" +
        "white-space:nowrap;border:1px solid rgba(15,23,42,0.15);box-shadow:0 1px 4px rgba(15,23,42,0.25);" +
        "transform:translate(-50%,-100%);letter-spacing:0.03em;";
      const label = new CSS2DObject(div);
      const lp = LABEL_POSITIONS[key];
      label.position.set(lp[0], lp[1], lp[2]);
      modelGroup.add(label);
      labelDivs[key] = div;
    });
    pinMeshesRef.current = pinMeshes;

    // STL 로드
    const loader = new STLLoader();
    let meshRef = null;
    loader.load(
      "/models/heat_exchanger.stl",
      (geometry) => {
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: 0x5b6b46, roughness: 0.55, metalness: 0.25 });
        const mesh = new THREE.Mesh(geometry, material);
        modelGroup.add(mesh);
        meshRef = mesh;
        setLoading(false);
      },
      undefined,
      () => {
        setLoading(false);
        setLoadError(true);
      }
    );

    // 애니메이션 루프: 컨트롤 감쇠 갱신 + 핀 색상/점멸 + 라벨 배지 색상 실시간 반영
    let raf;
    const statusColor = (level) => {
      if (level >= 3) return 0xdc2626;
      if (level === 2) return 0xea580c;
      if (level === 1) return 0xca8a04;
      return 0x16a34a;
    };
    const statusColorCss = (level) => {
      if (level >= 3) return "#dc2626";
      if (level === 2) return "#ea580c";
      if (level === 1) return "#ca8a04";
      return "#16a34a";
    };
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();

      const lv = levelsRef.current;
      const t = clock.getElapsedTime();
      Object.entries(pinMeshes).forEach(([key, mesh]) => {
        const level = lv ? lv[key] || 0 : 0;
        const color = statusColor(level);
        mesh.material.color.setHex(color);

        const div = labelDivs[key];
        const cssColor = statusColorCss(level);
        div.style.background = cssColor;
        div.style.color = "#ffffff";

        if (level >= 3) {
          // 위험 상태 핀 + 라벨 모두 점멸 + 확대/축소
          const pulse = 0.6 + Math.abs(Math.sin(t * 4)) * 0.6;
          mesh.material.emissive.setHex(0xdc2626);
          mesh.material.emissiveIntensity = pulse;
          const s = 1 + Math.abs(Math.sin(t * 4)) * 0.35;
          mesh.scale.set(s, s, s);
          div.style.opacity = String(0.55 + Math.abs(Math.sin(t * 4)) * 0.45);
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
      if (!mount) return;
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
      renderer.dispose();
      Object.values(pinMeshes).forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      if (meshRef) {
        meshRef.geometry.dispose();
        meshRef.material.dispose();
      }
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      if (mount.contains(labelRenderer.domElement)) mount.removeChild(labelRenderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full" style={{ height: 420 }}>
      <div ref={mountRef} className="w-full h-full rounded-lg" style={{ background: "#f1f5f9" }} />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-mono" style={{ color: COLORS.textDim }}>
          {t("loading_3d")}
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-mono" style={{ color: COLORS.danger }}>
          {t("load_error_3d")} (/models/heat_exchanger.stl)
        </div>
      )}
      <div className="absolute bottom-2 right-3 text-[10px] font-mono" style={{ color: COLORS.textDim }}>
        {t("drag_hint")}
      </div>
    </div>
  );
}

export { PIN_POSITIONS };
