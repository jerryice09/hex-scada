# ============================================================
# export_glb.py — 설비 3D 모델(.blend) → 웹 뷰어용 GLB 변환 스크립트
#
# 사용법 (Blender 파이썬 모듈 bpy 필요: `pip install bpy`, Python 3.11)
#   python export_glb.py -- heat_exchanger_photo_match.blend heat_exchanger_rig_raw.glb
#   npx @gltf-transform/cli optimize heat_exchanger_rig_raw.glb ../../public/models/heat_exchanger_rig.glb \
#       --compress meshopt --texture-compress false --simplify false --instance false --flatten false --join false
#
# 하는 일
#   - 조명·카메라·스튜디오 바닥 제거 (웹 뷰어가 자체 조명 사용)
#   - 파이프·호스 등 커브를 메쉬로 변환
#   - 열교환기 본체는 "HX_EXCHANGER", 주변 설비는 "HX_FACILITY" 노드 아래로 묶음
#     → 웹에서 "열교환기만 보기" 시 HX_FACILITY만 숨긴다 (--flatten false 로 이 구조를 유지해야 함)
#   - 텍스처 512px 축소, 랙 기둥 BEVEL 제거로 용량 절감 (원본 18.7MB → 최종 약 0.9MB)
#   - 원본 .blend 파일은 저장하지 않으므로 변경되지 않는다
# 상태 핀(IN/OUT/VENT/DRAIN) 좌표는 src/components/HeatExchanger3D.jsx 의 PIN_POSITIONS 에서 관리한다.
# ============================================================
import sys, re, bpy
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src, use_scripts=False)
scene = bpy.context.scene
base = lambda n: re.sub(r"\.\d{3}$", "", n)

# 1) 웹 뷰어에 필요 없는 것 제거: 조명·카메라(뷰어가 자체 조명 사용), 무한 바닥
for o in list(scene.objects):
    if o.type in {"LIGHT", "CAMERA"} or base(o.name) == "Studio floor":
        bpy.data.objects.remove(o, do_unlink=True)

# 1-b) 랙 기둥(구멍 뚫린 앵글)은 모서리 둥글림(BEVEL) 때문에 정점이 기둥 하나당 11만 개가 넘는다.
#      화면에서는 거의 차이가 없으므로 기둥만 BEVEL을 빼서 용량을 크게 줄인다.
for o in scene.objects:
    if base(o.name) == "White slotted angle rack upright":
        for m in list(o.modifiers):
            if m.type == "BEVEL": o.modifiers.remove(m)

# 2) 커브(파이프·호스·케이블 등)를 메쉬로 굳힘 — 내보내기 누락 방지
dg = bpy.context.evaluated_depsgraph_get()
coll = bpy.data.collections.new("Export"); scene.collection.children.link(coll)
for o in list(scene.objects):
    if o.type == "CURVE":
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        if len(me.polygons) == 0:
            bpy.data.objects.remove(o, do_unlink=True); continue
        no = bpy.data.objects.new(o.name, me); no.matrix_world = o.matrix_world.copy()
        coll.objects.link(no)
        bpy.data.objects.remove(o, do_unlink=True)

# 3) 열교환기 본체 vs 주변 설비 그룹 분리
HX = ["Glossy dark-green cylindrical shell","Green cast flange inner plate","Narrow black gasket joint","Outer green flange plate",
      "Rounded green cast end cap","Weathered brass flange edge","Flange stud","Flange washer","Flange hex nut","Galvanized mounting base",
      "Angled sheet-metal saddle leg","Saddle base bolt","Brass saddle retaining band","Saddle clamp stud","Shell top green nozzle",
      "Brass top nozzle adaptor forged union nut","Brass top nozzle adaptor socket shoulder","Brass top nozzle adaptor exposed thread",
      "Bottom drain socket","Bottom black drain plug","Black left end valve body","Black valve lever","Pressure gauge fitting",
      "Black pressure gauge housing","White gauge dial","Gauge black dial tick","Gauge needle"]
def empty(name, loc=(0,0,0)):
    e = bpy.data.objects.new(name, None); e.location = loc; coll.objects.link(e); return e
g_hx, g_fac = empty("HX_EXCHANGER"), empty("HX_FACILITY")
for o in list(scene.objects):
    if o in (g_hx, g_fac) or o.parent is not None: continue
    if o.type not in {"MESH"}: continue
    mw = o.matrix_world.copy()
    o.parent = g_hx if base(o.name) in HX else g_fac
    o.matrix_world = mw
n_hx = sum(1 for o in g_hx.children); n_fac = sum(1 for o in g_fac.children)


# 4) 텍스처 1024 → 512 로 축소 (웹 로딩 속도)
for img in bpy.data.images:
    if img.packed_file and img.size[0] > 512:
        img.scale(512, max(1, img.size[1] * 512 // img.size[0]))

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_image_format="JPEG", export_jpeg_quality=85,
                          export_yup=True, export_cameras=False, export_lights=False, export_extras=False, use_visible=False)
print("DONE hx", n_hx, "fac", n_fac)
