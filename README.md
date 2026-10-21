# 열교환기 기반 산업 안전 SCADA 시스템 (HEX-SCADA)

> AI × 산업혁신 트랙 · 제4회 NAVER OGQ마켓 AI Competition
> 여수석유화학고등학교

---

## 🎯 미션

> 우리는 석유화학 플랜트 현장 운전원이 열교환기 유량·온도 이상을 육안으로, 정기 점검 주기에만 의존해 확인해야 하는 상황에서 겪는 사고 징후를 뒤늦게 발견하는 문제를, 아두이노 센서 기반 실시간 이상 감지·원인 진단 SCADA 시스템으로 없앤다.

## 📊 북극성 지표

| 항목 | 내용 |
|---|---|
| **지표** | 센서 데이터 기반 위험 시나리오 정확 진단율 (%) |
| **정의** | 워터해머링 · 과압 · 열교환이상, 3개 시나리오 재현 테스트에서 시스템이 올바른 원인 진단 문구까지 정확히 출력한 비율 |
| **현재 값** | 판단 로직 구현 완료. 3개 시나리오 모두 원인 진단 문구·SOP·사고 이력까지 자동 출력되며, 시뮬레이터 기준 오탐(노이즈로 인한 잘못된 진단)도 직접 검증·수정함 |
| **다음 목표** | 실제 ESP32 하드웨어로 3개 시나리오를 물리적으로 재현했을 때도 100% 정확 진단 (현재는 시뮬레이터 기준 검증 완료, 실제 장비 재현 테스트는 진행 예정) |

> ⚠️ "현재 값" 항목은 코드 기준으로 정리한 내용입니다. 실제 하드웨어로 3개 시나리오를 직접
> 재현해본 결과가 있다면 그 수치로 바꿔서 채워주세요.

## 👥 팀 구성

| 이름 | 담당 | 세부 업무 |
|---|---|---|
| 김지원 | 코드 · 발표 | 판단 로직 및 SCADA 대시보드(React·Tailwind·Recharts) 구현, 발표 자료·피치 영상 제작 |
| 김채강 | 아두이노 · 인터뷰 | 센서 배선 및 캘리브레이션, 현직자·멘토 인터뷰를 통한 현장 요구사항 수집 |
| 박민준 | 아두이노 · 인터뷰 | 회로 구성 및 센서 테스트, 현직자·멘토 인터뷰를 통한 현장 요구사항 수집 |

## 📐 팀 규칙

1. 안전과 직결된 로직인 만큼, 최선을 다해 사회에 좋은 영향을 줄 수 있도록 한다.
2. 의견이 갈릴 때는 감정이 아니라 근거와 데이터뿐만 아니라 전문가의 의견을 들어보며 다수결로 정한다.
3. 각자 맡은 역할에 책임감을 갖고 최선을 다하며, 진행 상황을 서로 솔직하게 공유한다.

## 🗓 주간 리듬

- **팀 회의**: 매주 일요일 저녁
- **멘토링**: 매주 수요일 (OGQ 엔지니어 멘토 배정 세션)
- **산출물 제출**: 매주 월요일

---

## 문제 정의

열교환기는 유량이 줄어들면 응축수가 배관에 쌓여 급격한 압력 충격인 워터해머링이 발생해 배관과
설비를 손상시킬 수 있습니다. 가연성 유체나 기체가 누출된 상태에서 점화원이 있으면 특정 농도
구간에서 화재나 폭발로 번질 수도 있습니다. 실제로 여천 NCC에서는 시험 운전 중 과압과 설비
이상이 겹쳐 인명피해까지 발생했습니다.

그런데도 현장에서는 여전히 작업자가 계기판을 육안으로 확인하고 수기로 기록하는 방식에 의존하는
경우가 많아, 유량이 서서히 줄어들거나 압력이 조금씩 오르는 초기 징후를 놓치기 쉽고, 근무 교대
사이 인수인계 과정에서 이상 신호가 누락되기도 합니다. 이상이 감지된 뒤에도 어떤 절차로 대응해야
하는지 매뉴얼을 찾는 데 시간이 걸려 초동 대응이 늦어지는 것도 문제입니다.

HEX-SCADA는 이 문제를 실제 센서 하드웨어(ESP32)와 무료 클라우드 인프라만으로 해결합니다.
값을 보여주는 데서 그치지 않고, 위험이 감지되면 원인을 자동으로 진단하고 상황별 대응 절차(SOP)를
즉시 화면에 띄워 숙련도가 낮은 신입 운전원도 바로 조치할 수 있도록 만들었습니다.

## 아키텍처

```
[ESP32 + 센서(DHT-22 온도 · 유량 · 압력)]
            │ HTTPS POST (1초마다)
            ▼
[Vercel 서버리스 함수 /api/ingest] ───────▶ [Upstash Redis]
                                                  │
                                     GET (1초마다) │
                                                  ▼
[React 대시보드 (Vercel 정적 호스팅)] ◀───────────┘
            │
            ├─ 판단 로직 (calculations.js) — 임계값 비교로 정상/주의/경고/위험 4단계 산출
            ├─ SOP 자동 팝업 + 사고 이력 기록 (우선순위 정렬, 인지완료 처리)
            ├─ AI 고장 예측 타이머 — 최근 10개 포인트 선형회귀
            ├─ 3D 설비 구조도 — OpenSCAD 실측 모델 + Three.js 인터랙티브 뷰어
            ├─ 📖 운영 매뉴얼 탭 (한국어/영어/베트남어)
            └─ 다국어 UI (KO/EN/VI 실시간 전환)
```

하드웨어 모드가 꺼져 있으면 ESP32 없이도 내장 시뮬레이터(지터 + 5초 이징 전환 시나리오)로
동일한 판단 로직을 시연할 수 있습니다.

## 사용 스택

**Frontend**: React 18, Vite, Tailwind CSS, Recharts, Three.js
**Backend**: Vercel 서버리스 함수(Node.js), Upstash Redis(REST API)
**Hardware**: ESP32, DHT-22(AM2302), 유량센서(G1/2 Brass·YF-S201), 능동 부저, DS3120MG 서보모터
**설계 도구**: OpenSCAD (열교환기 실측 3D 모델링)
**배포/호스팅**: Vercel (Hobby 무료 플랜), GitHub

전체 오픈소스 패키지 목록과 라이선스는 [부록 A](#부록-a--사용한-외부-api--프레임워크--오픈소스)를 참고하세요.

## 실행 방법

```bash
git clone https://github.com/<본인계정>/hex-scada.git
cd hex-scada
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/ 에 정적 빌드 산출물 생성
```

배포는 Vercel 기준으로, GitHub 저장소 연결 후 자동 빌드됩니다. 상세 절차는
[부록 C](#부록-c--웹페이지로-배포하기)를 참고하세요. ESP32 실시간 연동은
[부록 D](#부록-d--esp32로-실시간-하드웨어-값-연동하기)를 참고하세요.

## AI 사용 내역

**Claude (Anthropic)** — 대시보드 UI/로직 설계, Vercel 서버리스 함수 및 ESP32 스케치 초안 작성,
리팩터링(파일 분할), 구현 이슈 분석·수정 등 전 과정에서 "바이브 코딩" 방식으로 활용했습니다.
사람이 요구사항을 지시하고 검토·수정하는 방식으로 진행했으며, 센서 캘리브레이션 값 등 실측이
필요한 부분은 AI가 자리표시자(placeholder)로 남기고 실제 값은 사용자가 채워 넣었습니다.
전체 대화 기록(문제 정의 → 구현 → 버그 발견 → 시뮬레이션 검증 → 수정)은 요청 시 공유 가능합니다.

## 라이선스

이 저장소는 [MIT 라이선스](./LICENSE)로 공개되어 있습니다 (대회 요강 6장 가점 요소 "오픈소스 공개").

---

# 부록

아래는 위 필수 템플릿을 보충하는 상세 자료입니다.

## 부록 A — 사용한 외부 API · 프레임워크 · 오픈소스

> 대회 요강 5.2.1 ⑤ "외부 사용 내역" 및 3.1 "공개 원칙"에 따라, 이 프로젝트에서 사용한
> 모든 외부 API·프레임워크·오픈소스 패키지·AI 도구를 아래에 빠짐없이 명시합니다.

### 프레임워크 · 빌드 도구
| 이름 | 용도 | 라이선스 |
|---|---|---|
| [React](https://react.dev/) 18.3.1 | UI 프레임워크 | MIT |
| [Vite](https://vitejs.dev/) 5.3.1 | 개발 서버 / 번들러 | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) 4.3.1 | Vite용 React 플러그인 | MIT |
| [Tailwind CSS](https://tailwindcss.com/) 3.4.4 | 유틸리티 CSS 프레임워크 | MIT |
| [PostCSS](https://postcss.org/) 8.4.38 / [Autoprefixer](https://github.com/postcss/autoprefixer) 10.4.19 | CSS 빌드 파이프라인 | MIT |

### 오픈소스 라이브러리
| 이름 | 용도 | 라이선스 |
|---|---|---|
| [Recharts](https://recharts.org/) 2.12.7 | 온도·유량 추이 라인 차트 | MIT |
| [lucide-react](https://lucide.dev/) 0.383.0 | UI 아이콘 세트 | ISC |
| [three.js](https://threejs.org/) 0.160 | 설비 구조도 탭의 인터랙티브 3D 열교환기 뷰어 (STL 로드 + OrbitControls) | MIT |

### 외부 API · 클라우드 서비스
| 이름 | 용도 | 비고 |
|---|---|---|
| [Vercel](https://vercel.com/) | 정적 사이트 호스팅 + 서버리스 함수(`/api/*`) 실행 | Hobby(무료) 플랜 사용 |
| [Upstash Redis](https://upstash.com/) (Vercel Marketplace 경유) | ESP32가 전송한 실시간 센서값 저장소 (`/api/ingest`, `/api/sensors`가 REST API로 호출) | Free 플랜 사용 |
| [GitHub](https://github.com/) | 소스코드 저장소, GitHub Actions(선택 배포 워크플로) | — |

### 하드웨어 펌웨어에서 사용한 라이브러리 (`hardware/hex_scada_esp32_node.ino`)
| 이름 | 용도 | 비고 |
|---|---|---|
| `WiFi.h` | ESP32 WiFi 연결 | Arduino-ESP32 core에 내장 |
| `HTTPClient.h` | Vercel `/api/ingest`로 HTTPS POST 전송 | Arduino-ESP32 core에 내장 |
| `WiFiClientSecure.h` | TLS(HTTPS) 클라이언트 | Arduino-ESP32 core에 내장 |
| [DHT sensor library](https://github.com/adafruit/DHT-sensor-library) (Adafruit) | DHT-22(AM2302) 온도 읽기 | MIT — Arduino Library Manager에서 설치 |
| [Adafruit Unified Sensor](https://github.com/adafruit/Adafruit_Sensor) | 위 DHT 라이브러리의 의존 라이브러리 | Apache-2.0 |
| [ESP32Servo](https://github.com/madhephaestus/ESP32Servo) | DS3120MG 서보(밸브 액추에이터) 제어 | LGPL-2.1 — Arduino Library Manager에서 설치 |

## 부록 B — 폴더 구조

```
src/
  data/
    constants.js        # 색상, 임계값 기본값, 시나리오, SOP 절차 등 정적 데이터
    i18n.js               # 한국어/영어/베트남어 번역 사전
    manual.js               # 열교환기 운영 매뉴얼 (3개 언어)
  utils/
    calculations.js      # 상태 판단, Risk Score, 고장 예측, 센서 오류 판정 등 순수 함수
  styles/
    scada.css            # 커스텀 keyframe 애니메이션 (Tailwind로 표현 불가능한 부분만)
  components/
    SensorCard.jsx        # 센서 카드 (정상/주의/경고/위험/FAULT)
    SopModal.jsx           # 위험 감지 시 뜨는 SOP 절차 팝업
    Toast.jsx               # 하단 토스트 알림
    RiskGauge.jsx            # Risk Score 원형 게이지
    ThresholdRow.jsx          # 설정 탭의 임계값 입력 행
    HeatExchanger3D.jsx        # Three.js 기반 3D 열교환기 뷰어
  tabs/
    MonitorTab.jsx    # 🖥 메인 모니터링
    RiskTab.jsx        # 📊 위험도 분석
    DiagramTab.jsx       # 🏭 설비 구조도 (3D)
    HistoryTab.jsx         # 📋 사고 이력
    ManualTab.jsx            # 📖 운영 매뉴얼
    SettingsTab.jsx          # ⚙ 설정
  App.jsx              # 최상위 컴포넌트 — 상태관리 + 탭 라우팅 + 다국어 + 시뮬레이션 루프
api/
  _redis.js            # Upstash Redis REST API 호출 공용 헬퍼
  ingest.js              # ESP32 → 센서값 수신 엔드포인트
  sensors.js               # 프론트엔드 → 최신 센서값 조회 엔드포인트
hardware/
  hex_scada_esp32_node.ino  # ESP32 센서 노드 펌웨어
  3d/heat_exchanger.scad      # 열교환기 실측 3D 모델 원본 (OpenSCAD)
public/
  models/heat_exchanger.stl # 웹 3D 뷰어용으로 변환한 STL
```

## 부록 C — 웹페이지로 배포하기

### 방법 A — Vercel (가장 간단, 대회 제출용으로 추천)
1. https://vercel.com 에 GitHub 계정으로 로그인
2. "Add New… → Project" → `hex-scada` 저장소 선택
3. Framework Preset은 자동으로 "Vite"가 잡힘 → 그대로 **Deploy** 클릭
4. 몇 십 초 후 `https://hex-scada-xxxx.vercel.app` 같은 실제 접속 가능한 URL 발급
   → 이 URL을 대회 "③ 프로덕트 URL" 제출란에 그대로 사용
5. 이후 `main` 브랜치에 push할 때마다 자동으로 재배포됨

### 방법 B — Netlify
1. https://app.netlify.com → "Add new site → Import an existing project"
2. GitHub의 `hex-scada` 저장소 선택
3. Build command: `npm run build`, Publish directory: `dist`
4. Deploy 클릭 → `https://hex-scada-xxxx.netlify.app` 발급

### 방법 C — GitHub Pages
`.github/workflows/deploy.yml`이 포함되어 있어 `main` push 시 자동 배포됩니다.
1. GitHub 저장소 → **Settings → Pages** → 소스를 **GitHub Actions**로 설정
2. `main` 브랜치에 push
3. `https://<계정>.github.io/hex-scada/` 로 접속 가능
4. ⚠️ `vite.config.js`의 기본값은 `base: "/"` (Vercel/Netlify용)입니다. GitHub Pages를 쓸 경우
   `base: "/저장소명/"`으로 직접 바꿔야 합니다.

## 부록 D — ESP32로 실시간 하드웨어 값 연동하기

```
ESP32(센서) --HTTPS POST(1초)--> /api/ingest --저장--> Redis(Upstash)
브라우저(대시보드) --GET(1초)--> /api/sensors --조회--> Redis
```

### 1. Redis(Upstash) 붙이기
1. Vercel 프로젝트 대시보드 → **Storage** 탭 → **Marketplace** → Redis 계열(Upstash) 선택 → Create/Install
2. 연결하면 `KV_REST_API_URL`/`KV_REST_API_TOKEN` (또는 `UPSTASH_REDIS_REST_URL`/`TOKEN`) 환경변수가
   자동 추가됨 — 정확한 이름은 Settings → Environment Variables에서 확인

### 2. API 인증키 설정
1. Vercel 프로젝트 → Settings → Environment Variables
2. `INGEST_API_KEY` 이름으로 임의의 긴 문자열을 값으로 추가
3. 이 값을 ESP32 스케치의 `API_KEY`에 그대로 복사

### 3. 라이브러리 설치 (Arduino IDE)
**DHT sensor library**(Adafruit) · **Adafruit Unified Sensor** · **ESP32Servo**(madhephaestus)

### 4. ESP32 스케치 업로드
1. `hardware/hex_scada_esp32_node.ino`를 Arduino IDE로 열기
2. `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL`(Vercel 배포 주소 + `/api/ingest`), `API_KEY` 입력
3. `readOutTempC`/`readPressureKpa`/`pulsesToLpm`의 K-factor는 실제 부품에 맞게
   검증·교체 필요 (스케치 상단 주석 참고)
4. 서보로 실제 밸브를 자동 개폐하려면 각도 실측 후 `ENABLE_AUTO_VALVE_CONTROL`을 `true`로 변경
   (기본값 `false` — 검증 전 자동 구동 금지)
5. 업로드 후 시리얼 모니터로 `전송 결과: 200 ...` 확인

### 5. 대시보드에서 켜기
배포된 사이트 → **⚙ 설정** 탭 → "데이터 소스" 카드에서 **🔌 실시간 하드웨어(ESP32) 사용 중**으로 전환

### 참고
- 능동 부저는 클라우드 연결 여부와 무관하게 ESP32에서 로컬로 위험을 판단해 울립니다.
- 로컬 판단 기준값은 대시보드 임계값과 별개로 스케치에 하드코딩되어 있어, 임계값을 바꾸면
  스케치 쪽도 수동으로 맞춰야 합니다.
- `client.setInsecure()`는 데모/실습용 간이 설정입니다. 실제 운영에서는 인증서 검증을 권장합니다.

## 부록 E — 다국어 지원 (대회 요강 6장 가점 요소)

헤더 우측의 **KO / EN / VI** 버튼으로 한국어·영어·베트남어 3개 언어를 실시간 전환할 수 있습니다.
탭 이름, 센서 라벨, 상태 표시, SOP 3개 시나리오(제목+4단계 전체), 위험 진단 문구, 시나리오 이름,
버튼, 토스트 알림, 📖 매뉴얼 탭 전체까지 화면 핵심 텍스트를 `src/data/i18n.js`와
`src/data/manual.js`에서 키-값 사전으로 관리합니다.

베트남어를 포함한 이유: 국내 제조업 현장에는 베트남 국적 근로자 비중이 높아, 외국인 근로자도
SOP(표준대응절차)를 언어 장벽 없이 이해할 수 있도록 하기 위함입니다.

## 부록 F — 📖 매뉴얼 탭

신입 사원이 열교환기를 어떻게 가동·정지·대응해야 하는지 안내하는 매뉴얼 탭입니다.
내용은 `src/data/manual.js`의 `MANUAL_SECTIONS`에서 언어별로 관리하며, 이 파일을 수정하면
매뉴얼 탭 화면에 그대로 반영됩니다. 별도 API 키나 외부 서비스 설정 없이 바로 작동합니다.

포함된 내용: 장비 개요 · 가동 전 점검사항 · 가동 절차 · 정상 운전 범위 · 정지 절차 ·
이상 상황 대응(SOP) 요약 · 자주 묻는 질문(FAQ)

## 부록 G — 3D 설비 모델 (설비 구조도 탭)

`설비 구조도` 탭은 추상적인 SVG 배관도 대신, 학생이 OpenSCAD로 실측 규격에 맞춰 직접
모델링한 열교환기 3D 모델을 그대로 불러와서 보여줍니다. 신입 사원도 실물과 동일한 형태로
입구·출구·벤트·드레인 위치를 익힐 수 있게 하기 위함입니다.

- 원본 설계 파일: `hardware/3d/heat_exchanger.scad` (OpenSCAD)
- 규격: 전장 555mm, 쉘 외경 114mm, 내부에 육각 피치로 배열된 튜브 다발(약 60개) 포함
- 포트: IN(입구)·OUT(출구)·VENT(벤트)·DRAIN(드레인) 4곳에 실제 각인 라벨 태그 모델링
- 웹에는 `public/models/heat_exchanger.stl`로 변환해서 로드하며, three.js `STLLoader` +
  `OrbitControls`로 마우스 드래그 회전·휠 줌이 가능한 인터랙티브 3D 뷰로 렌더링합니다.
- 각 포트 위치에는 실시간 센서 상태(정상/주의/경고/위험)에 따라 색이 바뀌는 핀을 표시하며,
  위험 상태에서는 점멸 효과가 들어갑니다.

`.scad` 파일을 수정한 뒤 새 STL을 만들려면 OpenSCAD에서 F6(렌더링) 후
File → Export → Export as STL로 내보내고, `public/models/heat_exchanger.stl`을 덮어쓰면 됩니다.

## 부록 H — 하드웨어 구성 (BOM, Bill of Materials)

실제 실습에 사용한 부품 목록입니다. 역할 표시가 "(확인 필요)"인 항목은 아직 스케치에
반영되어 있지 않습니다.

| 부품 | 역할 |
|---|---|
| 열교환기 | 실습용 쉘-튜브형 열교환기 본체 |
| 뉴스노우맨 스팀해빙기 SS-6000 | 열교환기 입구측 고온 스팀(열원) 공급 |
| 아두이노 유량측정센서 (G1/2 Brass, YF-S201) | 입구/출구 유량 측정 |
| DHT-22(AM2302) 온습도센서 모듈 | ✅ 구현됨 — 입구 온도 측정 (출구 온도용 센서는 아직 없어 자리표시자로 대체 중) |
| 적외선(IR) 송수신 센서 모듈 | (확인 필요) — 용도 미확정으로 아직 스케치에 배선 안 함 |
| 무지개 디지털 서보 DS3120MG 20Kg 방수 | ✅ 구현됨 — 밸브 개폐 액추에이터 (기본값은 안전상 자동 제어 비활성화) |
| 아두이노 능동 부저 5V | ✅ 구현됨 — 클라우드 연결과 무관하게 로컬 판단 후 경보 |
| Nextion HMI LCD 4.3인치 (감압식 터치) | 현장용 로컬 터치스크린 — 웹 대시보드와 별개의 독립 표시장치로 추정 |
| 샌디스크 울트라 Class10 SD 메모리카드 + SD 카드 모듈 | 로컬 데이터 로깅 (서버에 이력이 남지 않는 문제 보완) |
| DM704 막대 저항 | 회로 보호/전류 제한용 |
| 점퍼케이블 20핀 세트 | 배선 연결 |
| 실리콘 호스 / 스테인리스 / 테프론 테이프 | 배관 연결 및 누수 방지 |
| 스카치 투명 양면 테이프 / 열수축 튜브 와이어 | 센서·배선 고정 및 절연 마감 |

## 참고

- Claude.ai 아티팩트 미리보기는 파일 하나만 실행하는 방식이라, 여러 파일로 쪼갠 이 프로젝트는
  아티팩트에서 바로 미리보기가 되지 않습니다. 실제 프로젝트에 옮겨 실행해주세요.
- 실제 구현 시 반드시 검토해야 할 항목은 `KNOWN_ISSUES.md`를 참고하세요.
