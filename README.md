# 열교환기 통합 안전 검지 시스템 (HEX-SCADA)

여수석유화학고등학교 · 제4회 NAVER OGQ마켓 AI Competition (AI × 산업혁신 트랙)

## 사용한 외부 API · 프레임워크 · 오픈소스 (README 명시 의무 항목)

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

### AI 도구 사용 내역
- **Claude (Anthropic)** — 대시보드 UI/로직 설계, Vercel 서버리스 함수 및 ESP32 스케치 초안 작성, 리팩터링(파일 분할), 구현 이슈 분석 등 전 과정에서 "바이브 코딩" 방식으로 활용함. 사람이 요구사항을 지시하고 검토·수정하는 방식으로 진행했으며, 센서 캘리브레이션 값 등 실측이 필요한 부분은 AI가 자리표시자(placeholder)로 남기고 실제 값은 사용자가 채워 넣음.

## 폴더 구조

```
src/
  data/
    constants.js        # 색상, 임계값 기본값, 시나리오, SOP 절차 등 정적 데이터
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
  tabs/
    MonitorTab.jsx    # 🖥 메인 모니터링
    RiskTab.jsx        # 📊 위험도 분석
    DiagramTab.jsx       # 🏭 설비 구조도
    HistoryTab.jsx         # 📋 사고 이력
    SettingsTab.jsx          # ⚙ 설정
  App.jsx              # 최상위 컴포넌트 — 상태관리 + 탭 라우팅 + 시뮬레이션 루프
api/
  _redis.js            # Upstash Redis REST API 호출 공용 헬퍼
  ingest.js              # ESP32 → 센서값 수신 엔드포인트
  sensors.js               # 프론트엔드 → 최신 센서값 조회 엔드포인트
hardware/
  hex_scada_esp32_node.ino  # ESP32 센서 노드 펌웨어
```

## 로컬 실행

이 폴더 자체가 이미 완전한 Vite 프로젝트입니다 (package.json, index.html, vite.config.js 포함).

```bash
npm install
npm run dev       # http://localhost:5173 에서 확인
npm run build     # dist/ 에 정적 빌드 산출물 생성
```

## GitHub에 올리기

```bash
cd hex-scada
git init
git add .
git commit -m "feat: 열교환기 통합 안전 검지 시스템 HEX-SCADA"
git branch -M main
git remote add origin https://github.com/<본인계정>/hex-scada.git
git push -u origin main
```

## 웹페이지로 배포하기 (택 1)

### 방법 A — Vercel (가장 간단, 대회 제출용으로 추천)
1. https://vercel.com 에 GitHub 계정으로 로그인
2. "Add New… → Project" → 방금 올린 `hex-scada` 저장소 선택
3. Framework Preset은 자동으로 "Vite"가 잡힘 → 그대로 **Deploy** 클릭
4. 몇 십 초 후 `https://hex-scada-xxxx.vercel.app` 같은 실제 접속 가능한 URL 발급
   → 이 URL을 대회 "③ 프로덕트 URL" 제출란에 그대로 사용하면 됨
5. 이후 `main` 브랜치에 push할 때마다 자동으로 재배포됨

### 방법 B — Netlify
1. https://app.netlify.com → "Add new site → Import an existing project"
2. GitHub의 `hex-scada` 저장소 선택
3. Build command: `npm run build`, Publish directory: `dist` (Netlify가 자동 감지)
4. Deploy 클릭 → `https://hex-scada-xxxx.netlify.app` 발급

### 방법 C — GitHub Pages (무료, 별도 서비스 가입 불필요)
이 저장소에는 `.github/workflows/deploy.yml`이 이미 포함되어 있어 `main`에 push하면
GitHub Actions가 자동으로 빌드 후 GitHub Pages에 배포합니다.
1. GitHub 저장소 → **Settings → Pages** → "Build and deployment" 소스를
   **GitHub Actions**로 설정
2. `main` 브랜치에 push (또는 저장소의 Actions 탭에서 워크플로를 수동 실행)
3. 배포 완료 후 `https://<계정>.github.io/hex-scada/` 로 접속 가능
4. ⚠️ `vite.config.js`의 기본값은 `base: "/"` (Vercel/Netlify용)입니다. GitHub Pages를 쓸 경우에는
   `base: "/저장소명/"` (예: `"/hex-scada/"`)으로 **직접 바꿔야** 화면이 정상적으로 뜹니다.
   (Vercel/Netlify로 배포할 때는 그대로 `"/"`를 유지하세요.)

## ESP32로 실시간 하드웨어 값 연동하기

```
ESP32(센서) --HTTPS POST(1초)--> /api/ingest --저장--> Redis(Upstash)
브라우저(대시보드) --GET(1초)--> /api/sensors --조회--> Redis
```

### 1. Redis(Upstash) 붙이기
1. Vercel 프로젝트 대시보드 → **Storage** 탭 → **Marketplace** → Redis 계열(Upstash) 선택 → Create/Install
2. 프로젝트에 연결하면 `KV_REST_API_URL`, `KV_REST_API_TOKEN` (또는 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) 환경변수가 자동으로 추가됨 — 이름은 통합 버전에 따라 다를 수 있으니 Settings → Environment Variables에서 실제 이름을 확인

### 2. API 인증키 설정
1. Vercel 프로젝트 → Settings → Environment Variables
2. `INGEST_API_KEY` 라는 이름으로 아무 임의의 긴 문자열(예: 32자 랜덤 문자열)을 값으로 추가
3. 이 값을 아래 3번 ESP32 스케치의 `API_KEY`에 **그대로** 복사

### 3. 라이브러리 설치 (Arduino IDE)
도구 → 라이브러리 관리에서 아래 3개 설치:
- **DHT sensor library** (Adafruit)
- **Adafruit Unified Sensor** (위 라이브러리의 의존성)
- **ESP32Servo** (Kevin Harrington / madhephaestus)

### 4. ESP32 스케치 업로드
1. `hardware/hex_scada_esp32_node.ino`를 Arduino IDE로 열기
2. `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL`(본인 Vercel 배포 주소 + `/api/ingest`), `API_KEY`를 채움
3. `readOutTempC`(출구 온도 센서 없음, 임시로 입구값 반환) / `readPressureKpa`(압력 센서 없음, 자리표시자) /
   `readFlamePercent`(반전 방향 확인 필요) / `pulsesToLpm`의 K-factor는 **실제 부품에 맞게 검증·교체 필요**
   (자세한 내용은 스케치 상단 주석 참고)
4. 서보로 실제 밸브를 자동 개폐하고 싶다면 `SERVO_OPEN_ANGLE`/`SERVO_CLOSED_ANGLE`을 실측 후
   `ENABLE_AUTO_VALVE_CONTROL`을 `true`로 변경 (기본값 `false` — 검증 전 자동 구동 금지)
5. 보드에 업로드 후 시리얼 모니터로 `전송 결과: 200 ...`가 찍히는지 확인

### 5. 대시보드에서 켜기
1. 배포된 사이트 접속 → **⚙ 설정** 탭
2. "데이터 소스" 카드에서 **🔌 실시간 하드웨어(ESP32) 사용 중** 으로 전환
3. 정상 수신되면 헤더에 "ESP32 연결됨"이 초록색으로 표시되고, 센서 카드 값이 실제 값으로 바뀜
4. 5초 이상 새 데이터가 안 오면 자동으로 "ESP32 연결 끊김"으로 표시됨 (화면은 마지막 값을 유지)

### 참고
- 능동 부저는 클라우드 연결 여부와 무관하게 ESP32에서 로컬로 위험을 판단해 울립니다
  (WiFi가 끊겨도 현장 경보는 동작 — `KNOWN_ISSUES.md` "2.8 알림 채널" 항목 일부 보완).
- 로컬 판단 기준값(`NOMINAL_FLOW_LPM` 등)은 대시보드 설정 탭의 임계값과 별개로 스케치에 하드코딩되어
  있습니다. 대시보드에서 임계값을 바꾸면 스케치 쪽 값도 수동으로 맞춰야 서로 일치합니다.
- 시뮬레이션 모드에서는 기존처럼 시나리오 버튼으로 데모 가능. 하드웨어 모드에서는 시뮬레이터 버튼이 자동으로 비활성화됨.
- ESP8266을 쓴다면 `WiFi.h`/`HTTPClient.h`/`WiFiClientSecure.h` 대신 `ESP8266WiFi.h`/`ESP8266HTTPClient.h`/`WiFiClientSecureBearSSL.h`로 바꿔야 함 (핀 배치도 보드에 맞게 조정).
- `client.setInsecure()`는 데모/실습용 간이 설정입니다. 실제 운영에서는 인증서 검증을 적용하는 것이 안전합니다.

## 하드웨어 구성 (BOM, Bill of Materials)

실제 실습에 사용한 부품 목록입니다. 역할 표시가 "(확인 필요)"인 항목은 현재 `hardware/hex_scada_esp32_node.ino`
스케치에 아직 반영되어 있지 않아, 정확한 배선·용도를 알려주시면 코드에 반영하겠습니다.

| 부품 | 역할(추정) |
|---|---|
| 열교환기 | 실습용 쉘-튜브형 열교환기 본체 |
| 뉴스노우맨 스팀해빙기 SS-6000 | 열교환기 입구측 고온 스팀(열원) 공급 |
| 아두이노 유량측정센서 (G1/2 Brass, YF-S201) | 입구/출구 유량 측정 |
| DHT-22(AM2302) 온습도센서 모듈 | ✅ 구현됨 — 입구 온도 측정 (출구 온도용 센서는 아직 없어 자리표시자로 대체 중, `hardware/hex_scada_esp32_node.ino` 상단 주석 참고) |
| 아두이노 화염 불꽃 감지 센서 모듈 | ✅ 구현됨 — 화재/불꽃 감지, 대시보드 "화염 감지(%)" 지표로 사용 (기존에 있던 가스 농도 센서/지표는 삭제함) |
| 적외선(IR) 송수신 센서 모듈 | (확인 필요) — 용도 미확정으로 아직 스케치에 배선 안 함 |
| 무지개 디지털 서보 DS3120MG 20Kg 방수 | ✅ 구현됨 — 밸브 개폐 액추에이터. 단, 안전상 기본값은 자동 제어 비활성화(`ENABLE_AUTO_VALVE_CONTROL = false`) |
| 아두이노 능동 부저 5V | ✅ 구현됨 — 클라우드 연결과 무관하게 ESP32에서 로컬로 위험 판단 후 경보 (화면에만 의존하는 문제 보완) |
| Nextion HMI LCD 4.3인치 (감압식 터치) | 현장용 로컬 터치스크린 — 웹 대시보드와 별개의 독립 표시장치로 추정 |
| 샌디스크 울트라 Class10 SD 메모리카드 + SD 카드 모듈 | 로컬 데이터 로깅 (서버에 이력이 남지 않는 문제 보완, `KNOWN_ISSUES.md` 2.10 참고) |
| DM704 막대 저항 | 회로 보호/전류 제한용 |
| 점퍼케이블 20핀 세트 | 배선 연결 |
| 실리콘 호스 / 스테인리스 / 테프론 테이프 | 배관 연결 및 누수 방지 (실습 배관 자재) |
| 스카치 투명 양면 테이프 / 열수축 튜브 와이어 | 센서·배선 고정 및 절연 마감 |

## 3D 설비 모델 (설비 구조도 탭)

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

`.scad` 파일을 수정한 뒤 새 STL을 만들려면 OpenSCAD에서 열어 F6(렌더링) 후
File → Export → Export as STL로 내보내고, `public/models/heat_exchanger.stl`을 덮어쓰면 됩니다.

## 참고

- 이 저장소는 [MIT 라이선스](./LICENSE)로 공개되어 있습니다 (대회 요강 6장 가점 요소 "오픈소스 공개").
- 이 구조는 실제 GitHub 저장소/Vite·CRA 프로젝트를 전제로 합니다.
- Claude.ai 아티팩트 미리보기는 파일 하나만 실행하는 방식이라, 이렇게 여러 파일로
  쪼갠 버전은 아티팩트에서 바로 미리보기가 되지 않습니다. 실제 프로젝트에 옮겨 실행해주세요.
- 실제 구현 시 반드시 검토해야 할 항목은 `KNOWN_ISSUES.md`를 참고하세요.
