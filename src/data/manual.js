// ============================================================
// manual.js — 열교환기(OR-100) 신입 사원용 운영 매뉴얼 (한국어/영어/베트남어)
// src/tabs/ManualTab.jsx에서 현재 선택된 화면 언어(locale)에 맞춰 표시한다.
// ============================================================

export const MANUAL_SECTIONS = {
  ko: [
    {
      id: "overview",
      title: "1. 장비 개요",
      body: [
        "본 장비(OR-100)는 쉘-튜브(Shell & Tube)형 열교환기입니다. 고온 유체가 튜브 다발 내부를 흐르고, 그 열이 쉘(외피) 안의 냉각 유체로 전달되는 구조입니다.",
        "전장 555mm, 쉘 외경 114mm이며, 내부에 약 60개의 튜브가 육각(삼각) 피치로 배열되어 있습니다.",
        "포트는 총 4곳입니다: 입구(IN, 좌측 상단) · 출구(OUT, 우측 상단) · 벤트(VENT, 입구측 상단 보조 노즐) · 드레인(DRAIN, 출구측 하단 보조 노즐).",
        "각 포트의 정확한 위치는 대시보드의 '설비 구조도' 탭에서 3D 모델로 직접 돌려보며 확인할 수 있습니다.",
      ],
    },
    {
      id: "pre-check",
      title: "2. 가동 전 점검사항",
      body: [
        "① 배관 연결부(입구·출구·벤트·드레인)에 누유·누수 흔적이 없는지 육안으로 확인합니다.",
        "② 드레인 밸브가 완전히 닫혀 있는지 확인합니다 (열린 채로 가동하면 압력이 형성되지 않습니다).",
        "③ 벤트 밸브는 가동 초기에 살짝 열어두어 배관 내 공기를 빼는 것을 권장합니다.",
        "④ 대시보드(메인 모니터링 탭)에서 센서 6종(입구·출구 온도, 입구·출구 유량, 배관 압력, 화염 감지)이 모두 '정상' 또는 'SENSOR FAULT' 표시 없이 정상 수신되는지 확인합니다.",
        "⑤ 하드웨어 모드(⚙ 설정 탭)가 켜져 있는지, ESP32 연결 상태가 '연결됨'인지 확인합니다.",
      ],
    },
    {
      id: "startup",
      title: "3. 가동 절차",
      body: [
        "① 드레인 밸브를 완전히 닫습니다.",
        "② 입구 밸브를 서서히 개방하여 고온 유체를 천천히 공급합니다. 급격히 열면 워터해머링(수격 현상)이 발생할 수 있습니다.",
        "③ 출구 온도가 서서히 상승하며 정상 범위(30~40℃)에 들어오는지 확인합니다.",
        "④ 배관 압력이 정상 범위(200~400kPa)에서 안정되는지 확인합니다.",
        "⑤ 벤트에서 공기 빠지는 소리가 멎고 유체만 나오면 벤트 밸브를 잠급니다.",
        "⑥ 대시보드 상단 '시스템 상태'가 정상(초록)인지 최종 확인 후 정상 운전으로 전환합니다.",
      ],
    },
    {
      id: "normal-range",
      title: "4. 정상 운전 범위 (기본값)",
      body: [
        "입구 온도: 65 ~ 75℃",
        "출구 온도: 30 ~ 40℃",
        "입구 유량: 8 ~ 12 L/min",
        "출구 유량: 8 ~ 12 L/min",
        "배관 압력: 200 ~ 400 kPa",
        "화염 감지: 0 ~ 15%",
        "※ 이 값은 현장 여건에 따라 ⚙ 설정 탭에서 관리자가 조정할 수 있으며, 조정 시 매뉴얼의 이 수치와 실제 화면 표시값이 다를 수 있습니다. 항상 대시보드에 표시되는 '정상 범위'를 최종 기준으로 삼으세요.",
      ],
    },
    {
      id: "shutdown",
      title: "5. 정지 절차",
      body: [
        "① 입구 밸브를 서서히 닫아 유체 공급을 중단합니다.",
        "② 출구 유량이 0에 가까워질 때까지 기다립니다.",
        "③ 드레인 밸브를 열어 배관 내 잔류 응축수를 완전히 배출합니다 (겨울철 동파 방지에도 중요).",
        "④ 배관 압력이 대기압 수준으로 떨어졌는지 확인합니다.",
        "⑤ 정비/장기 미가동 시에는 드레인 밸브를 열어둔 상태로 둡니다.",
      ],
    },
    {
      id: "emergency",
      title: "6. 이상 상황 대응 (SOP 요약)",
      body: [
        "대시보드가 위험을 감지하면 화면에 4단계 대응 절차 팝업이 자동으로 뜹니다. 아래는 그 요약입니다.",
        "",
        "[워터해머링] 응축수가 축적되어 배관에 압력 충격이 발생하는 현상.",
        "  1) 출구 드레인 밸브 즉시 개방  2) 입구 증기 공급 50% 감소  3) 설비 담당자 즉시 연락  4) 배관 압력 정상화 확인 후 재가동",
        "",
        "[화염 감지] 설비 주변에서 화염/불꽃이 감지된 상태.",
        "  1) 해당 구역 즉시 대피  2) 소화기·소화전 위치 확인 및 초동 진화 준비  3) 가능하면 전원/공급 즉시 차단  4) 119 및 안전관리자 동시 연락",
        "",
        "[과압] 배관 압력이 500kPa를 초과한 상태.",
        "  1) 압력 릴리프 밸브(벤트) 작동 확인  2) 공급 차단  3) 압력 강하 모니터링  4) 원인 파악 후 재기동 승인",
        "",
        "[열교환 이상] 입구·출구 온도가 동시에 비정상 범위로 벗어난 상태 (누출 또는 내부 파손 의심).",
        "  1) 유량 밸브 점검  2) 튜브 내부 오염 여부 확인  3) 열교환 효율 재측정  4) 정비팀 투입",
      ],
    },
    {
      id: "faq",
      title: "7. 자주 묻는 질문",
      body: [
        "Q. 대시보드에 'SENSOR FAULT'가 뜨면 어떻게 하나요?",
        "A. 해당 센서 값이 물리적으로 불가능한 범위입니다. 배선 연결과 센서 자체 고장 여부를 점검하세요. 이 센서는 판단 로직에서 자동으로 제외되므로, 나머지 센서만으로 상태를 계속 모니터링할 수 있습니다.",
        "",
        "Q. 벤트와 드레인의 차이는 무엇인가요?",
        "A. 벤트는 배관 내 '기체(공기)'를 빼는 상단 노즐이고, 드레인은 배관 내 '액체(응축수)'를 빼는 하단 노즐입니다. 위치와 용도가 반대입니다.",
        "",
        "Q. 경보음이 계속 울리는데 어떻게 끄나요?",
        "A. SOP 팝업의 [확인 — 조치 완료] 버튼을 눌러야 멈춥니다. 단순히 소리만 끄고 조치를 안 하면 안전하지 않으므로, 실제 조치를 완료한 뒤에 눌러야 합니다.",
        "",
        "Q. ESP32 연결이 끊기면 대시보드는 어떻게 되나요?",
        "A. 화면은 마지막으로 받은 값을 유지하며 '연결 끊김'으로 표시됩니다. 다만 능동 부저는 클라우드 연결과 무관하게 ESP32 자체적으로 위험을 판단해 울리므로, 최소한의 현장 경보는 유지됩니다.",
      ],
    },
  ],

  en: [
    {
      id: "overview",
      title: "1. Equipment Overview",
      body: [
        "This unit (OR-100) is a shell-and-tube heat exchanger. Hot fluid flows inside the tube bundle, and that heat is transferred to the cooling fluid inside the shell (outer casing).",
        "Overall length 555mm, shell outer diameter 114mm, with about 60 tubes arranged inside in a hexagonal (triangular) pitch pattern.",
        "There are 4 ports in total: Inlet (IN, upper left) · Outlet (OUT, upper right) · Vent (VENT, auxiliary nozzle on the inlet-side top) · Drain (DRAIN, auxiliary nozzle on the outlet-side bottom).",
        "You can check the exact location of each port by rotating the 3D model directly in the '3D Diagram' tab of the dashboard.",
      ],
    },
    {
      id: "pre-check",
      title: "2. Pre-Start Checklist",
      body: [
        "① Visually check the piping connections (inlet, outlet, vent, drain) for any signs of leakage.",
        "② Confirm the drain valve is fully closed (if left open, pressure cannot build up during operation).",
        "③ It is recommended to slightly open the vent valve at the start to release trapped air from the piping.",
        "④ On the dashboard (Monitoring tab), confirm all 6 sensors (inlet/outlet temperature, inlet/outlet flow, pipe pressure, flame detection) are receiving data normally with no 'Normal' warning missing or 'SENSOR FAULT' shown.",
        "⑤ Confirm the hardware mode (⚙ Settings tab) is on and the ESP32 connection status shows 'Connected'.",
      ],
    },
    {
      id: "startup",
      title: "3. Startup Procedure",
      body: [
        "① Fully close the drain valve.",
        "② Slowly open the inlet valve to gradually supply the hot fluid. Opening it too quickly can cause water hammer.",
        "③ Confirm the outlet temperature rises gradually and enters the normal range (30~40℃).",
        "④ Confirm the pipe pressure stabilizes within the normal range (200~400kPa).",
        "⑤ Once the sound of air escaping from the vent stops and only fluid comes out, close the vent valve.",
        "⑥ Do a final check that the 'System Status' at the top of the dashboard is Normal (green), then switch to normal operation.",
      ],
    },
    {
      id: "normal-range",
      title: "4. Normal Operating Range (Defaults)",
      body: [
        "Inlet Temperature: 65 ~ 75℃",
        "Outlet Temperature: 30 ~ 40℃",
        "Inlet Flow: 8 ~ 12 L/min",
        "Outlet Flow: 8 ~ 12 L/min",
        "Pipe Pressure: 200 ~ 400 kPa",
        "Flame Detection: 0 ~ 15%",
        "※ These values can be adjusted by an administrator in the ⚙ Settings tab to match site conditions, so the figures shown here in the manual may differ from what's actually displayed on screen. Always treat the 'Normal Range' shown live on the dashboard as the final reference.",
      ],
    },
    {
      id: "shutdown",
      title: "5. Shutdown Procedure",
      body: [
        "① Slowly close the inlet valve to stop the fluid supply.",
        "② Wait until the outlet flow approaches 0.",
        "③ Open the drain valve to fully discharge any residual condensate in the piping (also important for preventing freeze damage in winter).",
        "④ Confirm the pipe pressure has dropped to atmospheric level.",
        "⑤ For maintenance or extended shutdown, leave the drain valve open.",
      ],
    },
    {
      id: "emergency",
      title: "6. Emergency Response (SOP Summary)",
      body: [
        "When the dashboard detects a hazard, a 4-step response procedure popup appears automatically on screen. Below is a summary.",
        "",
        "[Water Hammer] Condensate accumulates and causes a pressure shock in the piping.",
        "  1) Open the outlet drain valve immediately  2) Reduce inlet steam supply by 50%  3) Contact the equipment manager immediately  4) Confirm pressure has normalized before restarting",
        "",
        "[Fire Detected] Flame/fire has been detected near the equipment.",
        "  1) Evacuate the area immediately  2) Locate fire extinguishers/hydrants and prepare initial suppression  3) Cut power/supply immediately if possible  4) Contact 119 (fire dept.) and the safety manager simultaneously",
        "",
        "[Over Pressure] Pipe pressure has exceeded 500kPa.",
        "  1) Verify the pressure relief valve (vent) is operating  2) Cut off the supply  3) Monitor pressure drop  4) Approve restart only after identifying the cause",
        "",
        "[Heat Exchange Fault] Inlet and outlet temperatures have both deviated abnormally at the same time (possible leak or internal damage).",
        "  1) Inspect the flow valve  2) Check for internal tube contamination  3) Re-measure heat exchange efficiency  4) Dispatch the maintenance team",
      ],
    },
    {
      id: "faq",
      title: "7. Frequently Asked Questions",
      body: [
        "Q. What should I do if the dashboard shows 'SENSOR FAULT'?",
        "A. That sensor's reading is physically impossible. Check the wiring connection and whether the sensor itself has failed. This sensor is automatically excluded from the judgment logic, so the system keeps monitoring status using the remaining sensors.",
        "",
        "Q. What's the difference between the vent and the drain?",
        "A. The vent is the top nozzle used to release 'gas (air)' from the piping, while the drain is the bottom nozzle used to release 'liquid (condensate)'. Their positions and purposes are opposite.",
        "",
        "Q. The alarm keeps sounding — how do I turn it off?",
        "A. It only stops when you press the [Confirm — Action Complete] button in the SOP popup. Simply muting the sound without taking action is unsafe, so only press it after you've actually completed the response.",
        "",
        "Q. What happens to the dashboard if the ESP32 loses connection?",
        "A. The screen keeps showing the last received values and displays 'Disconnected'. However, the active buzzer keeps working based on the ESP32's own local judgment regardless of cloud connectivity, so a minimum level of on-site alarm is maintained.",
      ],
    },
  ],

  vi: [
    {
      id: "overview",
      title: "1. Tổng quan thiết bị",
      body: [
        "Thiết bị này (OR-100) là bộ trao đổi nhiệt kiểu ống chùm (Shell & Tube). Chất lỏng nóng chảy bên trong chùm ống, và nhiệt lượng đó được truyền sang chất lỏng làm mát bên trong vỏ (shell).",
        "Tổng chiều dài 555mm, đường kính ngoài vỏ 114mm, bên trong có khoảng 60 ống được bố trí theo kiểu lục giác (tam giác).",
        "Có tổng cộng 4 cổng: Đầu vào (IN, trên bên trái) · Đầu ra (OUT, trên bên phải) · Van xả khí (VENT, vòi phụ ở phía trên bên đầu vào) · Van xả đáy (DRAIN, vòi phụ ở phía dưới bên đầu ra).",
        "Bạn có thể kiểm tra chính xác vị trí từng cổng bằng cách xoay mô hình 3D trực tiếp trong tab 'Mô hình 3D' của bảng điều khiển.",
      ],
    },
    {
      id: "pre-check",
      title: "2. Kiểm tra trước khi vận hành",
      body: [
        "① Kiểm tra bằng mắt các mối nối đường ống (đầu vào, đầu ra, van xả khí, van xả đáy) xem có dấu hiệu rò rỉ hay không.",
        "② Xác nhận van xả đáy đã đóng hoàn toàn (nếu để mở, áp suất sẽ không hình thành trong quá trình vận hành).",
        "③ Nên hé mở van xả khí lúc mới khởi động để xả khí còn tồn trong đường ống.",
        "④ Trên bảng điều khiển (tab Giám sát), xác nhận cả 6 cảm biến (nhiệt độ đầu vào/ra, lưu lượng đầu vào/ra, áp suất đường ống, phát hiện lửa) đều nhận dữ liệu bình thường, không có cảnh báo 'LỖI CẢM BIẾN'.",
        "⑤ Xác nhận chế độ phần cứng (tab ⚙ Cài đặt) đang bật và trạng thái kết nối ESP32 hiển thị 'Đã kết nối'.",
      ],
    },
    {
      id: "startup",
      title: "3. Quy trình khởi động",
      body: [
        "① Đóng hoàn toàn van xả đáy.",
        "② Mở từ từ van đầu vào để cấp chất lỏng nóng một cách từ từ. Mở quá nhanh có thể gây ra hiện tượng búa nước.",
        "③ Xác nhận nhiệt độ đầu ra tăng dần và đi vào khoảng bình thường (30~40℃).",
        "④ Xác nhận áp suất đường ống ổn định trong khoảng bình thường (200~400kPa).",
        "⑤ Khi tiếng khí thoát ra từ van xả khí dừng lại và chỉ còn chất lỏng chảy ra, hãy đóng van xả khí lại.",
        "⑥ Kiểm tra lần cuối 'Trạng thái hệ thống' ở đầu bảng điều khiển là Bình thường (màu xanh) trước khi chuyển sang vận hành bình thường.",
      ],
    },
    {
      id: "normal-range",
      title: "4. Khoảng vận hành bình thường (giá trị mặc định)",
      body: [
        "Nhiệt độ đầu vào: 65 ~ 75℃",
        "Nhiệt độ đầu ra: 30 ~ 40℃",
        "Lưu lượng đầu vào: 8 ~ 12 L/phút",
        "Lưu lượng đầu ra: 8 ~ 12 L/phút",
        "Áp suất đường ống: 200 ~ 400 kPa",
        "Phát hiện lửa: 0 ~ 15%",
        "※ Các giá trị này có thể được quản trị viên điều chỉnh trong tab ⚙ Cài đặt tùy theo điều kiện hiện trường, vì vậy số liệu trong sổ tay này có thể khác với giá trị thực tế hiển thị trên màn hình. Luôn lấy 'Khoảng bình thường' hiển thị trực tiếp trên bảng điều khiển làm chuẩn cuối cùng.",
      ],
    },
    {
      id: "shutdown",
      title: "5. Quy trình dừng máy",
      body: [
        "① Đóng từ từ van đầu vào để ngừng cấp chất lỏng.",
        "② Chờ cho đến khi lưu lượng đầu ra gần bằng 0.",
        "③ Mở van xả đáy để xả hết nước ngưng còn tồn trong đường ống (cũng quan trọng để tránh đóng băng vào mùa đông).",
        "④ Xác nhận áp suất đường ống đã giảm xuống mức áp suất khí quyển.",
        "⑤ Khi bảo trì hoặc ngừng vận hành dài ngày, hãy để van xả đáy ở trạng thái mở.",
      ],
    },
    {
      id: "emergency",
      title: "6. Xử lý tình huống bất thường (Tóm tắt SOP)",
      body: [
        "Khi bảng điều khiển phát hiện nguy hiểm, cửa sổ quy trình xử lý 4 bước sẽ tự động hiện lên màn hình. Dưới đây là tóm tắt.",
        "",
        "[Búa nước] Hiện tượng nước ngưng tích tụ gây ra sốc áp suất trong đường ống.",
        "  1) Mở van xả đáy đầu ra ngay lập tức  2) Giảm 50% nguồn cấp hơi đầu vào  3) Liên hệ ngay người phụ trách thiết bị  4) Xác nhận áp suất đã ổn định trước khi khởi động lại",
        "",
        "[Phát hiện lửa] Đã phát hiện lửa/tia lửa quanh khu vực thiết bị.",
        "  1) Sơ tán khu vực ngay lập tức  2) Xác định vị trí bình chữa cháy và chuẩn bị dập lửa ban đầu  3) Ngắt nguồn điện/nguồn cấp ngay nếu có thể  4) Gọi 119 và liên hệ quản lý an toàn cùng lúc",
        "",
        "[Quá áp] Áp suất đường ống vượt quá 500kPa.",
        "  1) Xác nhận van xả áp (van xả khí) đang hoạt động  2) Ngắt nguồn cấp  3) Theo dõi mức giảm áp suất  4) Chỉ phê duyệt khởi động lại sau khi xác định nguyên nhân",
        "",
        "[Lỗi trao đổi nhiệt] Nhiệt độ đầu vào và đầu ra cùng lệch khỏi khoảng bình thường (nghi ngờ rò rỉ hoặc hư hỏng bên trong).",
        "  1) Kiểm tra van lưu lượng  2) Kiểm tra ô nhiễm bên trong ống  3) Đo lại hiệu suất trao đổi nhiệt  4) Điều động đội bảo trì",
      ],
    },
    {
      id: "faq",
      title: "7. Câu hỏi thường gặp",
      body: [
        "Hỏi: Nếu bảng điều khiển hiển thị 'SENSOR FAULT' thì phải làm gì?",
        "Đáp: Giá trị cảm biến đó nằm ngoài phạm vi vật lý có thể xảy ra. Hãy kiểm tra kết nối dây điện và khả năng cảm biến bị hỏng. Cảm biến này sẽ tự động bị loại khỏi logic phán đoán, nên hệ thống vẫn tiếp tục giám sát trạng thái bằng các cảm biến còn lại.",
        "",
        "Hỏi: Sự khác biệt giữa van xả khí và van xả đáy là gì?",
        "Đáp: Van xả khí là vòi phía trên dùng để xả 'khí (không khí)' trong đường ống, còn van xả đáy là vòi phía dưới dùng để xả 'chất lỏng (nước ngưng)'. Vị trí và mục đích của chúng ngược nhau.",
        "",
        "Hỏi: Còi báo động cứ kêu mãi, làm sao để tắt?",
        "Đáp: Chỉ dừng khi bạn nhấn nút [Xác nhận — Đã xử lý xong] trong cửa sổ SOP. Chỉ tắt tiếng mà không thực sự xử lý thì không an toàn, nên chỉ nhấn nút này sau khi đã thực sự hoàn thành việc xử lý.",
        "",
        "Hỏi: Nếu ESP32 mất kết nối thì bảng điều khiển sẽ ra sao?",
        "Đáp: Màn hình sẽ giữ nguyên giá trị nhận được lần cuối và hiển thị 'Mất kết nối'. Tuy nhiên còi báo động vẫn hoạt động dựa trên phán đoán cục bộ của chính ESP32 bất kể kết nối đám mây, nên vẫn duy trì mức cảnh báo tối thiểu tại hiện trường.",
      ],
    },
  ],
};

// 챗봇/외부 연동 등에서 평문으로 필요할 때 사용 (locale 미지정 시 한국어)
export function manualAsPlainText(locale = "ko") {
  const sections = MANUAL_SECTIONS[locale] || MANUAL_SECTIONS.ko;
  return sections.map((s) => `## ${s.title}\n${s.body.join("\n")}`).join("\n\n");
}
