/*
 * ============================================================
 *  HEX SCADA 센서 노드 (Arduino Uno)  -  센서 연결 핀 정리
 * ============================================================
 *  모든 센서의 전원은 우노 5V / GND에서 가져옵니다. (GND는 모두 공통)
 *
 *  센서 / 부품              핀       비고
 *  ------------------------------------------------------------
 *  입구 유량센서 (신호)      D2       외부 인터럽트 INT0 (변경 금지)
 *  출구 유량센서 (신호)      D3       외부 인터럽트 INT1 (변경 금지)
 *  입구 온도 DS18B20 DATA    D8       모듈에 풀업 없으면 4.7kΩ (DATA-5V 사이)
 *  출구 온도 DS18B20 DATA    D9       모듈에 풀업 없으면 4.7kΩ (DATA-5V 사이)
 *  입구 압력센서 (아날로그)  A1       열교환기 입구 쪽 배관 → 웹 "입구 압력"
 *  출구 압력센서 (아날로그)  A2       열교환기 출구 쪽 배관 → 웹 "출구 압력"
 *  능동 부저                 D5
 *  서보 (밸브) 신호          D6
 *  블루투스 모듈 TXD         D10      (우노 RX)
 *  블루투스 모듈 RXD         D11      (우노 TX, 5V->3.3V 분압 권장)
 *  USB 시리얼 (PC 연결)      D0/D1    다른 용도로 사용 금지
 *
 *  사용 안 함(여유 핀): D4, D7, D12, D13, A0, A3, A4, A5
 *
 *  라이브러리: OneWire, DallasTemperature (Library Manager에서 설치)
 * ============================================================
 */

#include <SoftwareSerial.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Servo.h>

// ---------------- 핀 정의 (위 표와 반드시 일치) ----------------
const int PIN_FLOW_IN = 2;         // 입구 유량 (외부 인터럽트 INT0)
const int PIN_FLOW_OUT = 3;        // 출구 유량 (외부 인터럽트 INT1)
const int PIN_ONEWIRE_IN = 8;      // 입구 온도 DS18B20 DATA
const int PIN_ONEWIRE_OUT = 9;     // 출구 온도 DS18B20 DATA
const int PIN_BUZZER = 5;          // 능동 부저
const int PIN_SERVO = 6;           // 서보 신호선
const int PIN_BT_RX = 10;          // 블루투스 모듈 TXD -> 우노 10번
const int PIN_BT_TX = 11;          // 블루투스 모듈 RXD <- 우노 11번 (분압 권장)
const int PIN_PRESSURE_IN = A1;    // 입구 압력센서 (미연결 시 값이 떠돌 수 있음)
const int PIN_PRESSURE_OUT = A2;   // 출구 압력센서

SoftwareSerial BTSerial(PIN_BT_RX, PIN_BT_TX);

// 온도센서마다 별도의 1-Wire 선(핀)을 사용 -> 입구/출구가 헷갈리지 않음
OneWire oneWireIn(PIN_ONEWIRE_IN);
OneWire oneWireOut(PIN_ONEWIRE_OUT);
DallasTemperature sensorsIn(&oneWireIn);
DallasTemperature sensorsOut(&oneWireOut);
Servo valveServo;

// ---------------- 동작 옵션 ----------------
const bool ENABLE_BLUETOOTH_OUTPUT = true;   // 블루투스로도 송출할지 (USB만 쓰면 false)
const bool ENABLE_AUTO_VALVE_CONTROL = false;
const bool USE_PRESSURE_FOR_DANGER = false;  // 압력 센서 시험이 끝나 값이 정상으로 확인된 뒤 true
// 웹으로 보내는 JSON의 압력 이름.
//   false(기본): "inPressure"(입구), "outPressure"(출구)  ← 웹사이트가 쓰는 이름
//   true       : 예전 이름 "pressure"(입구), "pressure2"(출구)
//   중계 앱이 예전 이름만 알아듣는 경우(업로드 후 웹 값이 갱신되지 않을 때)에만 true로 바꾼다.
//   웹 서버(/api/ingest)는 두 방식 모두 받는다.
const bool LEGACY_JSON_KEYS = false;

const int SERVO_OPEN_ANGLE = 90;
const int SERVO_CLOSED_ANGLE = 0;

// ---------------- 로컬 판단 기준값 ----------------
const float NOMINAL_FLOW_LPM = 10.0;
const float FLOW_DANGER_DROP_PCT = 30.0;
const float MIN_FLOW_FOR_JUDGE_LPM = 1.0;    // 입구 유량이 이 값 이상일 때만 수격 판단
const float PRESSURE_DANGER_KPA = 500.0;
const float FLOW_K_FACTOR = 7.5;             // YF-S201 기준: 주파수(Hz) = 7.5 x 유량(L/min)

// ---------------- 압력센서 환산 (센서 규격에 맞게 수정) ----------------
// 출력 전압 → 압력(kPa) 직선 환산: 압력 = (전압 - V_ZERO) / (V_FULL - V_ZERO) x FULL_KPA
//  - V_ZERO  : 압력 0일 때 센서 출력 전압
//  - V_FULL  : 최대 압력일 때 센서 출력 전압
//  - FULL_KPA: 센서의 최대 측정 압력(kPa)  예) 1.2MPa = 1200kPa
// 흔한 압력 트랜스미터(0.5~4.5V 출력)라면 V_ZERO = 0.5, V_FULL = 4.5 로 바꾸고
// FULL_KPA는 센서 몸통/설명서에 적힌 최대 압력으로 바꾼다.
// ※ 지금 값(0~5V → 0~600kPa)은 예전 코드와 같은 가정이다. 이 가정에서 압력 0인데도 약 60kPa로 나오면
//    (0.5V × 120) 센서가 0.5~4.5V 형식이라는 뜻이므로 위처럼 바꿔야 한다.
const float PRESSURE_V_ZERO = 0.0;
const float PRESSURE_V_FULL = 5.0;
const float PRESSURE_FULL_KPA = 600.0;
const float ADC_REF_V = 5.0;                 // 우노 아날로그 기준 전압(5V)

// ---------------- 유량 펄스 카운터 ----------------
volatile long pulseCountIn = 0;
volatile long pulseCountOut = 0;

void onPulseIn() { pulseCountIn++; }
void onPulseOut() { pulseCountOut++; }

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 1000;

// ---------------- DS18B20 상태 ----------------
DeviceAddress addrIn, addrOut;
bool hasIn = false;
bool hasOut = false;
float lastInTemp = 0.0;    // 읽기 실패 시 직전 정상값 유지
float lastOutTemp = 0.0;

void setup() {
  Serial.begin(9600);    // USB: 중계 앱이 읽는 포트 (JSON 한 줄만 출력)
  BTSerial.begin(9600);  // 블루투스

  // DS18B20: 변환 완료를 기다리지 않는 방식 (유량 측정 주기를 흔들지 않기 위함)
  sensorsIn.begin();
  sensorsIn.setResolution(12);
  sensorsIn.setWaitForConversion(false);
  hasIn = sensorsIn.getAddress(addrIn, 0);
  sensorsIn.requestTemperatures();

  sensorsOut.begin();
  sensorsOut.setResolution(12);
  sensorsOut.setWaitForConversion(false);
  hasOut = sensorsOut.getAddress(addrOut, 0);
  sensorsOut.requestTemperatures();

  pinMode(PIN_FLOW_IN, INPUT_PULLUP);
  pinMode(PIN_FLOW_OUT, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_IN), onPulseIn, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_OUT), onPulseOut, RISING);

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  valveServo.attach(PIN_SERVO);
  valveServo.write(SERVO_OPEN_ANGLE);

  // 주의: 시작 메시지를 Serial로 출력하지 않음 (앱이 JSON 외 줄을 형식 오류로 기록함)
}

// 실제 경과 시간(초)으로 나눠서 계산 -> 주기가 흔들려도 유량이 정확함
float pulsesToLpm(long pulses, float dtSec) {
  if (dtSec <= 0) return 0.0;
  return (pulses / dtSec) / FLOW_K_FACTOR;
}

// 8회 평균 → 전압 → 압력(kPa). 환산 상수는 위 "압력센서 환산" 참고.
// 예전 map()은 정수 계산이라 소수점이 잘렸는데, 실수 계산으로 바꿔 정밀도를 높였다.
float readPressureKpa(int pin) {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(pin);
  float volts = (sum / 8.0) * ADC_REF_V / 1023.0;
  float kpa = (volts - PRESSURE_V_ZERO) / (PRESSURE_V_FULL - PRESSURE_V_ZERO) * PRESSURE_FULL_KPA;
  if (kpa < 0) kpa = 0;  // 압력 0 근처에서 생기는 미세한 음수(노이즈)는 0으로
  return kpa;
}

// 과압: 입구·출구 중 더 높은 압력(maxPressureKpa)으로 판단 — 웹 대시보드 판정과 같은 기준
bool isLocalDanger(float inFlowLpm, float outFlowLpm, float maxPressureKpa) {
  // 물이 흐르는 중일 때만 유량 감소를 수격으로 판단 (정지 상태 오탐 방지)
  bool waterHammer = false;
  if (inFlowLpm >= MIN_FLOW_FOR_JUDGE_LPM) {
    float flowDropPct = ((NOMINAL_FLOW_LPM - outFlowLpm) / NOMINAL_FLOW_LPM) * 100.0;
    waterHammer = flowDropPct >= FLOW_DANGER_DROP_PCT;
  }

  bool overPressure = USE_PRESSURE_FOR_DANGER && (maxPressureKpa > PRESSURE_DANGER_KPA);
  return waterHammer || overPressure;
}

// String 없이 바로 출력 (SRAM 절약). Serial, BTSerial 모두 Print를 상속
// 출력 예: {"inTemp":34.38,"outTemp":24.87,"inFlow":9.80,"outFlow":9.65,"inPressure":301.2,"outPressure":282.5}
void printJson(Print &out, float inTemp, float outTemp,
               float inFlow, float outFlow,
               float inPressure, float outPressure) {
  out.print(F("{\"inTemp\":"));    out.print(inTemp, 2);
  out.print(F(",\"outTemp\":"));   out.print(outTemp, 2);
  out.print(F(",\"inFlow\":"));    out.print(inFlow, 2);
  out.print(F(",\"outFlow\":"));   out.print(outFlow, 2);
  if (LEGACY_JSON_KEYS) {
    out.print(F(",\"pressure\":"));    out.print(inPressure, 1);
    out.print(F(",\"pressure2\":"));   out.print(outPressure, 1);
  } else {
    out.print(F(",\"inPressure\":"));  out.print(inPressure, 1);
    out.print(F(",\"outPressure\":")); out.print(outPressure, 1);
  }
  out.println(F("}"));
}

void loop() {
  unsigned long now = millis();
  if (now - lastSend < SEND_INTERVAL_MS) return;
  float dtSec = (now - lastSend) / 1000.0;
  lastSend = now;

  noInterrupts();
  long pIn = pulseCountIn;   pulseCountIn = 0;
  long pOut = pulseCountOut; pulseCountOut = 0;
  interrupts();

  float inFlow = pulsesToLpm(pIn, dtSec);
  float outFlow = pulsesToLpm(pOut, dtSec);

  // 부팅 때 못 찾은 온도센서는 배선이 늦게 인식될 수 있으므로 다시 찾아봄
  if (!hasIn) {
    sensorsIn.begin();
    hasIn = sensorsIn.getAddress(addrIn, 0);
  }
  if (!hasOut) {
    sensorsOut.begin();
    hasOut = sensorsOut.getAddress(addrOut, 0);
  }

  // DS18B20: 지난 주기에 시작한 변환 결과를 읽고, 다음 주기용 변환을 시작
  if (hasIn) {
    float t = sensorsIn.getTempC(addrIn);
    if (t != DEVICE_DISCONNECTED_C && t > -55.0) lastInTemp = t;
  }
  if (hasOut) {
    float t = sensorsOut.getTempC(addrOut);
    if (t != DEVICE_DISCONNECTED_C && t > -55.0) lastOutTemp = t;
  }
  sensorsIn.requestTemperatures();
  sensorsOut.requestTemperatures();

  float inPressure = readPressureKpa(PIN_PRESSURE_IN);    // A1: 입구 압력
  float outPressure = readPressureKpa(PIN_PRESSURE_OUT);  // A2: 출구 압력
  float maxPressure = max(inPressure, outPressure);

  // 로컬 부저 경보 및 서보 밸브 작동
  bool danger = isLocalDanger(inFlow, outFlow, maxPressure);
  digitalWrite(PIN_BUZZER, danger ? HIGH : LOW);

  if (ENABLE_AUTO_VALVE_CONTROL) {
    valveServo.write(danger ? SERVO_CLOSED_ANGLE : SERVO_OPEN_ANGLE);
  }

  printJson(Serial, lastInTemp, lastOutTemp, inFlow, outFlow, inPressure, outPressure);   // USB -> 중계 앱
  if (ENABLE_BLUETOOTH_OUTPUT) {
    printJson(BTSerial, lastInTemp, lastOutTemp, inFlow, outFlow, inPressure, outPressure); // 블루투스 -> 중계 앱
  }
}
