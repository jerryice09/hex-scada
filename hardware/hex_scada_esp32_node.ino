/*
  hex_scada_esp32_node.ino
  열교환기 통합 안전 검지 시스템 — ESP32 센서 노드 (v2, 실제 보유 부품 기준)

  사용 부품 (BOM, README.md "하드웨어 구성" 참고):
    - DHT-22(AM2302) 온습도 센서 모듈       → 온도 측정 (입구 온도 1개소만 측정 가능, 아래 주석 참고)
    - 화염 불꽃 감지 센서 모듈                → 화염 감지 강도 (0~100%로 정규화, 대시보드의 "화염 감지" 지표)
    - 아두이노 유량측정센서 (G1/2 Brass, YF-S201) → 입구/출구 유량 (펄스 카운팅, 기존과 동일)
    - 아두이노 능동 부저 5V                   → 위험 감지 시 현장 청각 경보 (클라우드 연결과 무관하게 로컬에서도 동작)
    - 무지개 디지털 서보 DS3120MG             → 밸브 개폐 액추에이터 (기본은 비활성화 — 아래 안전 안내 필독)
    - 적외선(IR) 송수신 센서 모듈             → 용도 미확정. 아래 TODO 참고, 현재 배선 안 함

  ⚠ 현재 BOM에는 "출구 온도" 센서와 "배관 압력" 센서가 없습니다.
     - 출구 온도: 아래 readOutTempC()는 임시로 입구 온도값을 그대로 반환합니다(자리표시자).
       DHT-22를 하나 더 구매해 출구측에 부착하는 것을 권장합니다.
     - 배관 압력: 아래 readPressureKpa()는 아날로그 자리표시자입니다. 실제 압력 센서 구매 전까지는
       참고용으로만 쓰고, 대시보드의 "과압" 판단은 신뢰하지 마세요.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>          // 라이브러리 매니저에서 "DHT sensor library" (Adafruit) + "Adafruit Unified Sensor" 설치 필요
#include <ESP32Servo.h>    // 라이브러리 매니저에서 "ESP32Servo" (Kevin Harrington) 설치 필요

// ---------------- 본인 환경에 맞게 수정 ----------------
const char* WIFI_SSID = "your-wifi-ssid";
const char* WIFI_PASSWORD = "your-wifi-password";
const char* SERVER_URL = "https://hex-scada.vercel.app/api/ingest";
const char* API_KEY = "hex-scada-2026-secret-9f83a1";
// -------------------------------------------------------

// ⚠ 안전 스위치: 서보로 실제 밸브를 자동 제어할지 여부.
// 기본값 false. 서보 개폐 각도(OPEN_ANGLE/CLOSED_ANGLE)를 실제 밸브 기구에 맞게
// 검증하고, 스팀(고온) 없이 물로만 먼저 테스트한 뒤에 true로 바꾸는 것을 강력히 권장합니다.
const bool ENABLE_AUTO_VALVE_CONTROL = false;

// ---------------- 핀 배치 ----------------
const int PIN_DHT22 = 4;          // DHT-22 데이터 핀
const int PIN_FLOW_IN = 26;       // 입구 유량센서 펄스 (G1/2 Brass)
const int PIN_FLOW_OUT = 27;      // 출구 유량센서 펄스 (YF-S201)
const int PIN_FLAME_ANALOG = 34;  // 화염센서 아날로그 출력 (ADC1, 입력 전용 핀)
const int PIN_FLAME_DIGITAL = 14; // 화염센서 디지털 출력 (참고용, 모듈 포텐셔미터로 임계값 조정됨)
const int PIN_PRESSURE = 32;      // 압력 센서 자리표시자 (ADC1) — 현재 BOM에 실제 압력센서 없음
const int PIN_BUZZER = 25;        // 능동 부저 (디지털 출력)
const int PIN_SERVO = 33;         // 서보(DS3120MG) 신호선 (PWM)
// IR 송수신 모듈: 용도 미확정으로 미배선. 확정되면 여기에 핀 추가.

#define DHT_TYPE DHT22
DHT dht(PIN_DHT22, DHT_TYPE);
Servo valveServo;

// 서보 개폐 각도 — 실제 밸브·링크 기구에 맞게 반드시 재보정하세요.
const int SERVO_OPEN_ANGLE = 90;
const int SERVO_CLOSED_ANGLE = 0;

// 대시보드(src/data/constants.js DEFAULT_THRESHOLDS)와 동일하게 유지해야 하는 로컬 판단 기준값.
// (ESP32는 JS 상수를 직접 가져올 수 없어 값을 이중으로 관리합니다. 대시보드 설정 탭에서
//  임계값을 바꾸면 이 값들도 수동으로 맞춰줘야 로컬 부저/서보 판단이 대시보드와 일치합니다.)
const float NOMINAL_FLOW_LPM = 10.0;
const float FLOW_DANGER_DROP_PCT = 30.0;   // 30% 이상 감소 시 위험(워터해머링)
const float PRESSURE_DANGER_KPA = 500.0;   // 500kPa 초과 시 위험(과압) — 압력센서 미장착 상태에서는 참고용
const float FLAME_DANGER_PERCENT = 90.0;   // 화염 강도 90% 초과 시 위험(화재) — DEFAULT_THRESHOLDS.flame.max(15) * 6

volatile long pulseCountIn = 0;
volatile long pulseCountOut = 0;
void IRAM_ATTR onPulseIn() { pulseCountIn++; }
void IRAM_ATTR onPulseOut() { pulseCountOut++; }

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 1000; // 대시보드 폴링 주기(1초)와 맞춤

void setup() {
  Serial.begin(115200);

  dht.begin();

  pinMode(PIN_FLOW_IN, INPUT_PULLUP);
  pinMode(PIN_FLOW_OUT, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_IN), onPulseIn, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_OUT), onPulseOut, RISING);

  pinMode(PIN_FLAME_DIGITAL, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  valveServo.attach(PIN_SERVO);
  valveServo.write(SERVO_OPEN_ANGLE); // 기동 시 "정상 운전 = 밸브 열림" 상태로 초기화

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi 연결 중");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi 연결됨: " + WiFi.localIP().toString());
}

// 1초간 누적된 펄스 수 → L/min 근사치. kFactor는 센서 데이터시트/실측 보정값으로 교체.
float pulsesToLpm(long pulses, float kFactor) {
  return pulses / kFactor;
}

// DHT-22로 실제 온도 측정 (입구 온도). 읽기 실패 시 NAN 반환 → 상위에서 처리.
float readInTempC() {
  float t = dht.readTemperature();
  return t; // 실패 시 NAN (isnan()으로 체크)
}

// ⚠ 자리표시자: 출구 온도용 센서가 아직 없어 입구 온도를 그대로 반환합니다.
// 대시보드의 "열교환 이상"(입출구 온도 동시 급변) 판단은 이 상태에서는 사실상 작동하지 않습니다.
// DHT-22를 하나 더 달면 이 함수를 실제 측정으로 교체하세요.
float readOutTempC(float inTempFallback) {
  return inTempFallback;
}

// 화염센서 아날로그 원시값 → 0~100% 정규화.
// ⚠ 모듈에 따라 "불꽃이 가까울수록 전압이 낮아지는" 경우가 많습니다.
//    아래는 그 가정(낮을수록 위험)으로 반전(invert)한 예시이니, 실제 모듈로
//    라이터를 가까이/멀리 대보며 시리얼 출력을 확인하고 map()의 방향을 맞추세요.
float readFlamePercent(int pin) {
  int raw = analogRead(pin); // ESP32 ADC: 0~4095
  int inverted = 4095 - raw; // 값이 작을수록(불꽃 근접) → 백분율은 커지도록 반전
  float pct = (inverted / 4095.0) * 100.0;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

// TODO: 실제 압력 센서 장착 후 데이터시트 기준 변환식으로 교체
float readPressureKpa(int pin) {
  int raw = analogRead(pin);
  return map(raw, 0, 4095, 0, 6000) / 10.0;
}

// 로컬(오프라인) 위험 판단: WiFi/클라우드가 끊겨도 부저는 동작하도록 ESP32에서 직접 계산.
// 대시보드의 evaluateStatus()를 간소화한 버전이며, 출구온도 미측정으로 "열교환 이상"은 제외됨.
bool isLocalDanger(float outFlowLpm, float pressureKpa, float flamePercent) {
  float flowDropPct = ((NOMINAL_FLOW_LPM - outFlowLpm) / NOMINAL_FLOW_LPM) * 100.0;
  bool waterHammer = flowDropPct >= FLOW_DANGER_DROP_PCT;
  bool overPressure = pressureKpa > PRESSURE_DANGER_KPA;
  bool fireDetected = flamePercent > FLAME_DANGER_PERCENT;
  return waterHammer || overPressure || fireDetected;
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  noInterrupts();
  long pIn = pulseCountIn;
  pulseCountIn = 0;
  long pOut = pulseCountOut;
  pulseCountOut = 0;
  interrupts();

  float inFlow = pulsesToLpm(pIn, 7.5);    // TODO: G1/2 Brass 보정계수로 교체
  float outFlow = pulsesToLpm(pOut, 7.5);  // TODO: YF-S201 보정계수로 교체

  float inTemp = readInTempC();
  if (isnan(inTemp)) {
    Serial.println("DHT-22 읽기 실패 — 이번 주기 값은 이전 값을 유지하거나 재시도 필요");
    inTemp = 0; // TODO: 재시도 로직 또는 마지막 정상값 유지 로직으로 개선 권장
  }
  float outTemp = readOutTempC(inTemp);
  float pressure = readPressureKpa(PIN_PRESSURE);
  float flame = readFlamePercent(PIN_FLAME_ANALOG);

  // ---- 로컬 부저 경보 (WiFi 상태와 무관하게 항상 동작) ----
  bool danger = isLocalDanger(outFlow, pressure, flame);
  digitalWrite(PIN_BUZZER, danger ? HIGH : LOW);

  // ---- 서보 밸브 제어 (기본 비활성화, ENABLE_AUTO_VALVE_CONTROL로만 활성화) ----
  if (ENABLE_AUTO_VALVE_CONTROL) {
    valveServo.write(danger ? SERVO_CLOSED_ANGLE : SERVO_OPEN_ANGLE);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi 끊김 — 클라우드 전송은 건너뛰지만 로컬 부저/서보는 계속 동작합니다.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // 데모/실습용 간이 설정. 운영 환경에서는 인증서 검증을 권장합니다.

  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  String json = "{";
  json += "\"inTemp\":" + String(inTemp, 2) + ",";
  json += "\"outTemp\":" + String(outTemp, 2) + ",";
  json += "\"inFlow\":" + String(inFlow, 2) + ",";
  json += "\"outFlow\":" + String(outFlow, 2) + ",";
  json += "\"pressure\":" + String(pressure, 1) + ",";
  json += "\"flame\":" + String(flame, 1);
  json += "}";

  int code = http.POST(json);
  Serial.printf("전송 결과: %d, %s (로컬위험판단=%s)\n", code, json.c_str(), danger ? "위험" : "정상");
  http.end();
}
