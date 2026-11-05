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
 *  압력센서 1 (아날로그)     A1
 *  압력센서 2 (아날로그)     A2
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
const int PRESSURE_COUNT = 2;
const int PIN_PRESSURE[PRESSURE_COUNT] = {A1, A2};  // 압력센서 1, 2 (미연결 시 값이 떠돌 수 있음)

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
const bool USE_PRESSURE_FOR_DANGER = false;  // 압력 센서를 실제로 연결한 뒤 true

const int SERVO_OPEN_ANGLE = 90;
const int SERVO_CLOSED_ANGLE = 0;

// ---------------- 로컬 판단 기준값 ----------------
const float NOMINAL_FLOW_LPM = 10.0;
const float FLOW_DANGER_DROP_PCT = 30.0;
const float MIN_FLOW_FOR_JUDGE_LPM = 1.0;    // 입구 유량이 이 값 이상일 때만 수격 판단
const float PRESSURE_DANGER_KPA = 500.0;
const float FLOW_K_FACTOR = 7.5;             // YF-S201 기준: 주파수(Hz) = 7.5 x 유량(L/min)

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

// DFRobot SEN0257 수압센서: 압력(kPa) = (전압 - 0.483) x 250  (0.5~4.5V → 0~1000kPa)
float readPressureKpa(int pin) {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(pin);
  float volts = (sum / 8.0) * 5.0 / 1023.0;
  float kpa = (volts - 0.483) * 250.0;
  if (kpa < 0) kpa = 0;
  return kpa;
}

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
void printJson(Print &out, float inTemp, float outTemp,
               float inFlow, float outFlow,
               const float *pressure) {
  out.print(F("{\"inTemp\":"));    out.print(inTemp, 2);
  out.print(F(",\"outTemp\":"));   out.print(outTemp, 2);
  out.print(F(",\"inFlow\":"));    out.print(inFlow, 2);
  out.print(F(",\"outFlow\":"));   out.print(outFlow, 2);
  out.print(F(",\"pressure\":"));  out.print(pressure[0], 1);
  out.print(F(",\"pressure2\":")); out.print(pressure[1], 1);
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

  float pressure[PRESSURE_COUNT];
  float maxPressure = 0.0;
  for (int i = 0; i < PRESSURE_COUNT; i++) {
    pressure[i] = readPressureKpa(PIN_PRESSURE[i]);
    if (pressure[i] > maxPressure) maxPressure = pressure[i];
  }

  // 로컬 부저 경보 및 서보 밸브 작동
  bool danger = isLocalDanger(inFlow, outFlow, maxPressure);
  digitalWrite(PIN_BUZZER, danger ? HIGH : LOW);

  if (ENABLE_AUTO_VALVE_CONTROL) {
    valveServo.write(danger ? SERVO_CLOSED_ANGLE : SERVO_OPEN_ANGLE);
  }

  printJson(Serial, lastInTemp, lastOutTemp, inFlow, outFlow, pressure);   // USB -> 중계 앱
  if (ENABLE_BLUETOOTH_OUTPUT) {
    printJson(BTSerial, lastInTemp, lastOutTemp, inFlow, outFlow, pressure); // 블루투스 -> 중계 앱
  }
}
