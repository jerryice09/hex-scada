// ====================================================================
// OR-100 Heat Exchanger - HEX-SCADA 대시보드 연동용 개선 모델
// 원본(3D_열교환기.scad)에 아래 3가지를 추가:
//   1) 벤트(Vent) 노즐 — 입구측 상단 (기체 트랩 배출)
//   2) 드레인(Drain) 노즐 — 출구측 하단 (정비 시 완전 배수)
//   3) IN / OUT / VENT / DRAIN 각인 라벨 (신입 사원도 3D만 보고 구분 가능하게)
// ====================================================================

$fn = 100; // 곡면 정밀도 최상

// --- 주요 규격 수치 정의 (mm) ---
total_L         = 555;   // 전체 전장
shell_OD        = 114;   // 쉘 외경 (phi 114)
oil_port_dist   = 403;   // 상단 포트(입구/출구) 중심 간격

// 입구/출구 포트 규격 (기존과 동일)
port_thread_OD  = 26.4;  // ZG 3/4" (Rc 3/4)
port_ID         = 20;    // 포트 내경
port_height     = 25;    // 포트 높이

// 벤트/드레인 규격 (입구·출구 포트보다 작은 보조 노즐 — 실제 규격 관행 반영)
small_port_thread_OD = 13.7; // ZG 3/8" (Rc 3/8) 상당
small_port_ID         = 10;
small_port_height     = 16;

// 벤트/드레인 축방향 위치: 각 끝단 워터캡에서 안쪽으로 조금 들어온 지점
end_fitting_offset = 60; // 쉘 끝(플랜지 안쪽)에서부터의 거리

// 워터 캡 (Water Covers)
water_cap_L     = 45;
water_cap_OD    = 130;

// --- 내부 튜브 다발 규격 (신규) ---
shell_wall_t    = 4;    // 쉘 벽 두께
tube_OD         = 9;    // 튜브 외경
tube_wall_t     = 1;    // 튜브 벽 두께
tube_pitch      = 13;   // 튜브 중심 간격 (삼각 피치)
tube_sheet_t    = 6;    // 튜브시트(관판) 두께
bundle_clearance = 6;   // 쉘 내벽 ~ 튜브 다발 최외곽 여유 간격

// 라벨(각인 텍스트) 표시 여부 — 3D 프린트용으로 끌 수도 있게 옵션화
show_labels = true;
label_size  = 9;
label_depth = 0.8;

// 튜브 다발 배치 가능한 최대 반경
bundle_max_r = shell_OD/2 - shell_wall_t - bundle_clearance;
// 튜브 다발이 차지하는 길이 방향 범위 (양쪽 튜브시트 사이)
tube_span_L  = total_L - (water_cap_L * 2) - (tube_sheet_t * 2);

// 삼각(육각) 피치로 튜브 중심 좌표 목록을 만드는 함수
function tube_positions() = [
    for (row = [-9 : 9])
        for (col = [-9 : 9])
            let (
                z = row * tube_pitch * 0.866025,
                y = col * tube_pitch + (row % 2 == 0 ? 0 : tube_pitch / 2)
            )
            if (sqrt(y*y + z*z) <= bundle_max_r) [y, z]
];

module OR100_Final_Clean_Model() {
    union() {

        // ------------------------------------------------------------
        // 1. 메인 쉘 바디 (중공관 — 내부 튜브 다발이 보이도록 벽 두께만 남김)
        // ------------------------------------------------------------
        color([0.3, 0.35, 0.25]) // 카키/국방색
        union() {
            // 메인 원통 (중공 — 셸 사이드 유체가 흐르는 환형 공간 확보)
            rotate([0, 90, 0])
                difference() {
                    cylinder(h = total_L - (water_cap_L * 2), d = shell_OD, center = true);
                    cylinder(h = total_L - (water_cap_L * 2) + 2, d = shell_OD - shell_wall_t * 2, center = true);
                }

            // 쉘 양끝 플랜지
            translate([- (total_L/2 - water_cap_L - 8/2), 0, 0])
                rotate([0, 90, 0])
                    cylinder(h = 8, d = water_cap_OD, center = true);
            translate([(total_L/2 - water_cap_L - 8/2), 0, 0])
                rotate([0, 90, 0])
                    cylinder(h = 8, d = water_cap_OD, center = true);
        }

        // ------------------------------------------------------------
        // 1-1. 내부 튜브 다발 (Tube Bundle) — 실제 열교환이 일어나는 관 다발
        //      삼각 피치로 배열된 중공 튜브 여러 개 + 양끝 튜브시트(관판)
        // ------------------------------------------------------------
        color([0.75, 0.72, 0.6]) // 황동/구리 계열 (실제 튜브 재질 느낌)
        for (p = tube_positions())
            translate([0, p[0], p[1]])
                rotate([0, 90, 0])
                    difference() {
                        cylinder(h = tube_span_L, d = tube_OD, center = true, $fn = 16);
                        cylinder(h = tube_span_L + 2, d = tube_OD - tube_wall_t * 2, center = true, $fn = 16);
                    }

        // 튜브시트(관판) — 튜브 다발 양끝을 고정하는 원판, 튜브 구멍만 뚫려있음
        color([0.55, 0.55, 0.58])
        for (side = [-1, 1])
            translate([side * (tube_span_L/2 + tube_sheet_t/2), 0, 0])
                rotate([0, 90, 0])
                    difference() {
                        cylinder(h = tube_sheet_t, d = shell_OD - shell_wall_t * 2 - 1, center = true);
                        for (p = tube_positions())
                            translate([p[0], p[1], 0])
                                cylinder(h = tube_sheet_t + 2, d = tube_OD, center = true, $fn = 16);
                    }

        // ------------------------------------------------------------
        // 2. 입구/출구 포트 (좌측=입구, 우측=출구)
        // ------------------------------------------------------------
        color([0.3, 0.35, 0.25])
        {
            // 좌측 상단 포트 = 입구 (IN)
            translate([-oil_port_dist/2, 0, shell_OD/2 - 1])
                precise_port();

            // 우측 상단 포트 = 출구 (OUT)
            translate([oil_port_dist/2, 0, shell_OD/2 - 1])
                precise_port();
        }

        // ------------------------------------------------------------
        // 2-1. 벤트(Vent) — 입구측 끝단 상단, 기체 트랩 배출용 보조 노즐
        // ------------------------------------------------------------
        color([0.35, 0.4, 0.3])
        translate([-(total_L/2 - water_cap_L - end_fitting_offset), 0, shell_OD/2 - 1])
            small_port();

        // ------------------------------------------------------------
        // 2-2. 드레인(Drain) — 출구측 끝단 하단, 정비 시 완전 배수용 보조 노즐
        //      (하단 = -Z 방향이므로 180도 회전해서 아래로 향하게 배치)
        // ------------------------------------------------------------
        color([0.35, 0.4, 0.3])
        translate([(total_L/2 - water_cap_L - end_fitting_offset), 0, -(shell_OD/2 - 1)])
            rotate([180, 0, 0])
                small_port();

        // ------------------------------------------------------------
        // 3. 완전히 닫힌 양쪽 워터 캡 (채널헤드, 옆면 구멍 없는 완전 솔리드)
        // ------------------------------------------------------------
        color([0.2, 0.2, 0.2]) // 어두운 주물 색상
        {
            // 좌측 꽉 막힌 커버
            translate([-total_L/2 + water_cap_L/2, 0, 0]) {
                rotate([0, 90, 0])
                    cylinder(h = water_cap_L, d1 = water_cap_OD - 15, d2 = water_cap_OD, center = true);
            }

            // 우측 꽉 막힌 커버
            translate([total_L/2 - water_cap_L/2, 0, 0]) {
                rotate([0, 90, 0])
                    cylinder(h = water_cap_L, d1 = water_cap_OD, d2 = water_cap_OD - 15, center = true);
            }
        }

        // ------------------------------------------------------------
        // 4. 하부 마운팅 브라켓 (Base Brackets, 순수 지지대 — 배관 아님)
        // ------------------------------------------------------------
        color([0.2, 0.2, 0.2])
        {
            translate([-180, 0, -shell_OD/2 - 5])
                mounting_bracket();
            translate([180, 0, -shell_OD/2 - 5])
                mounting_bracket();
        }

        // ------------------------------------------------------------
        // 5. 상단 명판 (Nameplate)
        // ------------------------------------------------------------
        color([0.9, 0.9, 0.9])
        translate([0, 0, shell_OD/2 + 0.5])
            cube([100, 40, 1], center = true);

        // ------------------------------------------------------------
        // 6. 각인 라벨 (IN / OUT / VENT / DRAIN)
        //    작은 명판 플레이트를 각 포트 옆에 세워서 부착 (곡면 직접 각인 대신
        //    평평한 태그를 얹는 방식 — 상단 "OR-100" 명판과 동일한 원리라 왜곡이 없음)
        // ------------------------------------------------------------
        if (show_labels) {
            // IN: 입구 포트 옆, 원주방향으로 살짝 비켜서 배치
            port_label_plate("IN",    -oil_port_dist/2, angle_offset = 32);
            // OUT: 출구 포트 옆
            port_label_plate("OUT",    oil_port_dist/2, angle_offset = 32);
            // VENT: 입구측 상단, 반대쪽으로 비켜서 IN 라벨과 겹치지 않게 배치
            port_label_plate("VENT",  -(total_L/2 - water_cap_L - end_fitting_offset), angle_offset = -32);
            // DRAIN: 출구측 하단 (드레인 노즐 옆, 원주방향으로 비켜서 배치)
            port_label_plate("DRAIN",  (total_L/2 - water_cap_L - end_fitting_offset), angle_offset = 180 - 32, small_text = true);
        }
    }
}

// 입구/출구용 큰 포트
module precise_port() {
    difference() {
        cylinder(h = port_height, d = port_thread_OD, center = false);
        cylinder(h = port_height + 2, d = port_ID, center = false);
    }
}

// 벤트/드레인용 작은 포트 (입출구 포트보다 얇고 짧음 — 실제 보조노즐 규격 관행)
module small_port() {
    difference() {
        cylinder(h = small_port_height, d = small_port_thread_OD, center = false);
        cylinder(h = small_port_height + 2, d = small_port_ID, center = false);
    }
}

// 포트 옆에 붙는 작은 명판 플레이트 (상단 "OR-100" 명판과 동일한 방식 — 평면 플레이트 + 양각 텍스트)
// angle_offset: 쉘 원주 방향 각도(도 단위, 0=정상단). 포트 구멍과 겹치지 않도록 살짝 비켜서 배치.
module port_label_plate(txt, x_pos, angle_offset, small_text = false) {
    plate_w = small_text ? 34 : 24;
    plate_h = 11;
    plate_t = 1.2;
    txt_size = small_text ? 5.5 : 6;

    rotate([angle_offset, 0, 0])
        translate([x_pos, 0, shell_OD/2 + plate_t/2])
        {
            // 태그 플레이트 본체
            color([0.9, 0.9, 0.85])
                cube([plate_w, plate_h, plate_t], center = true);
            // 양각 텍스트 (플레이트 표면 위로 살짝 돌출)
            color([0.15, 0.15, 0.15])
                translate([0, 0, plate_t/2])
                    linear_extrude(height = 0.5)
                        text(txt, size = txt_size, halign = "center", valign = "center", font = "Liberation Sans:style=Bold");
        }
}

// 마운팅 브라켓 모듈
module mounting_bracket() {
    difference() {
        union() {
            cube([25, 120, 10], center = true);
            translate([0, 45, 12])
                cube([25, 10, 30], center = true);
            translate([0, -45, 12])
                cube([25, 10, 30], center = true);
        }
        translate([0, 45, 0]) cylinder(h = 20, d = 9, center = true);
        translate([0, -45, 0]) cylinder(h = 20, d = 9, center = true);
    }
}

// --- 실행 ---
OR100_Final_Clean_Model();
