# Modelos 3D originais dos cosméticos (acessórios de arma e peças de personagem), gerados por código.
# Formas reais (chanfros, cilindros, cascas com espessura), materiais PBR por nome:
#   Paint  = cor do item (o jogo troca a cor por variante)   Black = polímero preto   Metal = aço
#   Strap  = fita/nylon   Rubber = borracha   Lens = vidro/lente   Emit = brilho (ponto vermelho, laser)
# Peças de personagem são encaixadas em cada modelo (medidas tiradas da malha do .blend) e exportadas por equipe:
#   public/assets/cosmetics/<peça>_<CT|T>.glb   — cada malha se chama "nome@Osso" (o jogo prende àquele osso).
# Acessórios de arma: public/assets/attachments/<peça>.glb, no espaço da arma do jogo
#   (+Z cano, +Y cima; origem = ponto de encaixe; ver WeaponAttachments.ts).
# Uso: python(bpy) cosmetic_models.py -- <ct_rig.blend> <t_rig.blend> <pasta public/assets>
import bpy, bmesh, sys, os, math, json
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
RIGS = {'CT': args[0], 'T': args[1]}
OUT = args[2]

# ====================================================================== medidas dos personagens

def measure(path):
    bpy.ops.wm.open_mainfile(filepath=path)
    body = bpy.data.objects['Body']; arm = bpy.data.objects['Armature']
    vg = {g.index: g.name for g in body.vertex_groups}
    M = body.matrix_world
    pts = {}
    for v in body.data.vertices:
        if not v.groups: continue
        b = max(v.groups, key=lambda g: g.weight)
        pts.setdefault(vg[b.group], []).append(M @ v.co)
    def bbox(names):
        P = [p for n in names for p in pts.get(n, [])]
        return [min(p[i] for p in P) for i in range(3)], [max(p[i] for p in P) for i in range(3)]
    hmin, hmax = bbox(['Head'])
    head = pts['Head'] + pts['Neck']
    # frente do rosto na altura do nariz (sem a aba do capacete)
    band = [p for p in head if abs(p.x) < 0.035 and 1.62 < p.z < 1.66]
    face_y = min(p.y for p in band)
    mouth = [p for p in head if abs(p.x) < 0.035 and 1.585 < p.z < 1.62]
    mouth_y = min(p.y for p in mouth)
    cmin, cmax = bbox(['Chest'])
    back = [p for p in pts['Chest'] if 1.15 < p.z < 1.4 and abs(p.x) < 0.1]
    back_y = max(p.y for p in back)
    front = [p for p in pts['Chest'] if 1.25 < p.z < 1.4 and 0.05 < p.x < 0.16]
    front_y = min(p.y for p in front)
    bones = {b.name: (Vector(b.head_local), Vector(b.tail_local)) for b in arm.data.bones}
    knees = {}
    for side, sgn in (('L', 1), ('R', -1)):
        kz = bones['Leg.' + side][0].z
        near = [p for p in pts['Leg.' + side] + pts['UpLeg.' + side] if abs(p.z - kz) < 0.035]
        fy = min(p.y for p in near)
        cx = sum(p.x for p in near) / len(near)
        knees[side] = [cx, fy, kz]
    hipz = 0.76
    hip = [p for p in pts['UpLeg.R'] + pts['Hips'] if abs(p.z - hipz) < 0.04 and p.x < 0]
    hip_x = min(p.x for p in hip)
    hip_y = sum(p.y for p in hip) / len(hip)
    return {
        'head_min': hmin, 'head_max': hmax, 'face_y': face_y, 'mouth_y': mouth_y,
        'chest_min': cmin, 'chest_max': cmax, 'back_y': back_y, 'front_y': front_y,
        'knees': knees, 'hip': [hip_x, hip_y, hipz]
    }

FIT = {t: measure(p) for t, p in RIGS.items()}
print('MEDIDAS', json.dumps(FIT, default=lambda v: list(v))[:800])

# ====================================================================== ferramentas de modelagem

MATS = {}
def mat(name):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    spec = {
        'Paint': ((0.3, 0.32, 0.22), 0.0, 0.62),
        'Black': ((0.025, 0.026, 0.028), 0.0, 0.55),
        'Metal': ((0.32, 0.33, 0.34), 1.0, 0.32),
        'Strap': ((0.05, 0.05, 0.045), 0.0, 0.85),
        'Rubber': ((0.018, 0.018, 0.02), 0.0, 0.9),
        'Lens': ((0.02, 0.05, 0.06), 0.0, 0.04),
        'Emit': ((1.0, 0.05, 0.03), 0.0, 0.3),
        'Fabric': ((0.2, 0.21, 0.15), 0.0, 0.9),
    }[name]
    b.inputs['Base Color'].default_value = (*spec[0], 1)
    b.inputs['Metallic'].default_value = spec[1]
    b.inputs['Roughness'].default_value = spec[2]
    if name == 'Lens':
        b.inputs['Alpha'].default_value = 0.45
        m.blend_method = 'BLEND'
    if name == 'Emit':
        b.inputs['Emission Color'].default_value = (1.0, 0.08, 0.04, 1)
        b.inputs['Emission Strength'].default_value = 4
    MATS[name] = m
    return m

PARTS = []

def finish(o, m, bevel=0.0, seg=2, smooth=True, sub=0):
    o.data.materials.clear(); o.data.materials.append(mat(m))
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True)
    if bevel > 0:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(40)
        b.use_clamp_overlap = True; b.harden_normals = True
        bpy.ops.object.modifier_apply(modifier='b')
    if sub:
        s = o.modifiers.new('s', 'SUBSURF'); s.levels = sub; s.render_levels = sub
        bpy.ops.object.modifier_apply(modifier='s')
    if smooth:
        bpy.ops.object.shade_smooth()
        if bevel > 0 or not sub:
            w = o.modifiers.new('w', 'WEIGHTED_NORMAL'); w.keep_sharp = True
            bpy.ops.object.modifier_apply(modifier='w')
    PARTS.append(o)
    return o

def box(size, loc, m='Black', bevel=0.002, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m, bevel)

def cyl(r, depth, loc, m='Black', axis='Y', verts=32, bevel=0.0015, r2=None):
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.object, m, bevel)

def torus(R, r, loc, m='Black', axis='Y'):
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=40, minor_segments=10)
    return finish(bpy.context.object, m, 0)

def shell(rx, ry, rz, center, cut_z, thick, m='Paint', front_cut=None, rot_x=0.0):
    """Casca elipsoidal (capacete): metade superior acima de cut_z (relativo), com espessura."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0, 0))
    o = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = [v for v in bm.verts if v.co.z < cut_z or (front_cut is not None and v.co.y < -front_cut[0] and v.co.z < front_cut[1])]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(o.data); bm.free()
    o.scale = (rx, ry, rz); bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = (rot_x, 0, 0); o.location = center
    bpy.ops.object.transform_apply(location=True, rotation=True)
    s = o.modifiers.new('t', 'SOLIDIFY'); s.thickness = thick; s.offset = 1
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='t')
    return finish(o, m, 0.003, 2)

def strap_ring(center, rx, ry, z_tilt, width, thick, m='Strap', seg=40, arc=(0, 2 * math.pi)):
    """Faixa (tira) elíptica em volta de algo: anel achatado."""
    bm = bmesh.new()
    a0, a1 = arc
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        c, s = math.cos(a), math.sin(a)
        ring = []
        for (dr, dz) in ((0, -width / 2), (0, width / 2), (thick, width / 2), (thick, -width / 2)):
            x = (rx + dr) * c; y = (ry + dr) * s
            z = dz + z_tilt * y
            ring.append(bm.verts.new((center[0] + x, center[1] + y, center[2] + z)))
        rings.append(ring)
    for i in range(seg):
        for k in range(4):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % 4], rings[i + 1][(k + 1) % 4], rings[i + 1][k]))
    me = bpy.data.meshes.new('ring'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('ring', me); bpy.context.scene.collection.objects.link(o)
    return finish(o, m, 0)

def reset():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes): bpy.data.meshes.remove(me)
    PARTS.clear()

def export(path, groups):
    """groups: {nome_da_malha: [partes]} — junta cada grupo numa malha e exporta."""
    objs = []
    for name, parts in groups.items():
        if not parts: continue
        for x in bpy.context.selected_objects: x.select_set(False)
        for p in parts: p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1: bpy.ops.object.join()
        o = bpy.context.object; o.name = name; o.data.name = name
        objs.append(o)
    for x in bpy.context.selected_objects: x.select_set(False)
    for o in objs: o.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_lights=False, export_cameras=False, export_materials='EXPORT')
    tris = sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in objs)
    print('EXPORT', os.path.relpath(path, OUT), 'tris', tris)
    # remove da cena (nomes repetidos ganhariam sufixo .001 na próxima peça)
    for o in objs:
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.meshes.remove(me)

def take():
    """Partes criadas desde a última chamada."""
    p = list(PARTS); PARTS.clear(); return p

# ====================================================================== acessórios de arma
# espaço da arma no jogo: +Z cano (Blender -Y), +Y cima (Blender +Z). Origem = encaixe.
# Abaixo: f = frente (Blender -Y), u = cima (Blender Z).
def F(f, u=0.0, x=0.0):
    return (x, -f, u)

def rail_mount(length, base=0.0):
    box((0.026, length, 0.008), F(0, base + 0.004), 'Black', 0.001)
    for k in (-1, 1):
        box((0.004, length * 0.9, 0.006), F(0, base + 0.006, k * 0.014), 'Metal', 0.0008)

def att_reddot():
    rail_mount(0.045)
    box((0.03, 0.05, 0.012), F(0, 0.014), 'Black', 0.003)
    cyl(0.017, 0.052, F(0, 0.038), 'Black', 'Y', 32, 0.002)
    cyl(0.0185, 0.008, F(0.024, 0.038), 'Black', 'Y', 32, 0.001)
    cyl(0.0185, 0.008, F(-0.024, 0.038), 'Black', 'Y', 32, 0.001)
    cyl(0.0145, 0.002, F(0.025, 0.038), 'Lens', 'Y', 32, 0)
    cyl(0.0145, 0.002, F(-0.025, 0.038), 'Lens', 'Y', 32, 0)
    cyl(0.0012, 0.001, F(0.0, 0.038), 'Emit', 'Y', 12, 0)
    cyl(0.006, 0.012, F(0.0, 0.038, 0.02), 'Black', 'X', 16, 0.001)   # botão de brilho
    cyl(0.006, 0.01, F(0.004, 0.058), 'Black', 'Z', 16, 0.001)      # regulagem de altura
    export(f'{OUT}/attachments/reddot.glb', {'reddot': take()})

def att_holo():
    rail_mount(0.07)
    box((0.034, 0.095, 0.016), F(0, 0.016), 'Black', 0.004)
    box((0.012, 0.03, 0.032), F(-0.03, 0.04, 0.019), 'Black', 0.003)
    box((0.012, 0.03, 0.032), F(-0.03, 0.04, -0.019), 'Black', 0.003)
    # capuz da janela
    box((0.044, 0.006, 0.042), F(0.03, 0.045), 'Black', 0.002)
    box((0.044, 0.006, 0.042), F(-0.002, 0.045), 'Black', 0.002)
    box((0.044, 0.038, 0.005), F(0.014, 0.068), 'Black', 0.002)
    for k in (-1, 1): box((0.005, 0.038, 0.04), F(0.014, 0.045, k * 0.021), 'Black', 0.0015)
    box((0.034, 0.002, 0.03), F(0.029, 0.046), 'Lens', 0)
    torus(0.006, 0.0006, F(0.03, 0.046), 'Emit', 'Y')
    cyl(0.0008, 0.0012, F(0.031, 0.046), 'Emit', 'Y', 10, 0)
    for k in range(3): box((0.008, 0.006, 0.004), F(-0.035 + k * 0.01, 0.026, 0.0), 'Rubber', 0.001)  # botões
    export(f'{OUT}/attachments/holo.glb', {'holo': take()})

def att_scope4x():
    rail_mount(0.06)
    for f in (-0.028, 0.028):
        box((0.03, 0.016, 0.03), F(f, 0.02), 'Black', 0.002)
        torus(0.0175, 0.003, F(f, 0.04), 'Black', 'Y')
    cyl(0.016, 0.1, F(0.0, 0.04), 'Paint', 'Y', 40, 0.002)
    cyl(0.022, 0.035, F(0.065, 0.04), 'Paint', 'Y', 40, 0.002, r2=0.016)   # objetiva
    cyl(0.022, 0.01, F(0.086, 0.04), 'Paint', 'Y', 40, 0.0015)
    cyl(0.019, 0.03, F(-0.062, 0.04), 'Paint', 'Y', 40, 0.002, r2=0.016)   # ocular
    cyl(0.02, 0.012, F(-0.082, 0.04), 'Rubber', 'Y', 40, 0.002)
    cyl(0.019, 0.002, F(0.092, 0.04), 'Lens', 'Y', 40, 0)
    cyl(0.016, 0.002, F(-0.089, 0.04), 'Lens', 'Y', 40, 0)
    cyl(0.009, 0.014, F(0.0, 0.062), 'Paint', 'Z', 24, 0.0015)          # torre de elevação
    cyl(0.009, 0.014, F(0.0, 0.04, 0.022), 'Paint', 'X', 24, 0.0015)    # torre de deriva
    for k in range(8):
        a = k * math.pi / 4
        box((0.0015, 0.002, 0.012), (0.0095 * math.cos(a), -0.0095 * math.sin(a), 0.062), 'Metal', 0)
    export(f'{OUT}/attachments/scope4x.glb', {'scope4x': take()})

def att_pistol_dot():
    box((0.022, 0.034, 0.008), F(0, 0.004), 'Black', 0.002)
    # janela aberta inclinada
    box((0.024, 0.006, 0.022), F(0.012, 0.018), 'Black', 0.0015)
    box((0.004, 0.012, 0.018), F(0.006, 0.016, 0.01), 'Black', 0.001)
    box((0.004, 0.012, 0.018), F(0.006, 0.016, -0.01), 'Black', 0.001)
    box((0.018, 0.0015, 0.016), F(0.014, 0.019), 'Lens', 0)
    cyl(0.0009, 0.001, F(0.0145, 0.019), 'Emit', 'Y', 10, 0)
    export(f'{OUT}/attachments/pistol_dot.glb', {'pistol_dot': take()})

def att_suppressor(name, r, length):
    cyl(r * 0.8, 0.02, F(0.01), 'Metal', 'Y', 32, 0.001)               # adaptador
    cyl(r, length, F(0.02 + length / 2), 'Black', 'Y', 40, 0.002)
    cyl(r * 1.02, 0.012, F(0.02 + 0.006), 'Black', 'Y', 40, 0.0015)
    cyl(r * 1.02, 0.012, F(0.02 + length - 0.006), 'Black', 'Y', 40, 0.0015)
    for k in range(5):
        torus(r * 1.003, 0.0012, F(0.04 + k * (length - 0.04) / 5), 'Black', 'Y')
    cyl(r * 0.25, 0.004, F(0.02 + length + 0.001), 'Rubber', 'Y', 20, 0)
    export(f'{OUT}/attachments/{name}.glb', {name: take()})

def att_compensator():
    cyl(0.0125, 0.055, F(0.0275), 'Metal', 'Y', 32, 0.0015)
    for k in range(3):
        for s in (-1, 1):
            box((0.006, 0.007, 0.009), F(0.015 + k * 0.012, 0.0, s * 0.011), 'Black', 0.0008)
    box((0.01, 0.025, 0.006), F(0.035, 0.011), 'Black', 0.0008)
    export(f'{OUT}/attachments/compensator.glb', {'compensator': take()})

def att_vgrip():
    box((0.022, 0.04, 0.012), F(0, -0.006), 'Black', 0.002)
    cyl(0.015, 0.085, F(0, -0.052), 'Black', 'Z', 32, 0.002, r2=0.0165)
    for k in range(6):
        torus(0.016, 0.0016, F(0, -0.025 - k * 0.011), 'Rubber', 'Z')
    cyl(0.018, 0.008, F(0, -0.095), 'Black', 'Z', 32, 0.002)
    export(f'{OUT}/attachments/vgrip.glb', {'vgrip': take()})

def att_agrip():
    box((0.022, 0.07, 0.01), F(0, -0.005), 'Black', 0.002)
    box((0.02, 0.075, 0.03), F(-0.008, -0.022), 'Black', 0.004, rot=(math.radians(-25), 0, 0))
    box((0.018, 0.02, 0.022), F(0.03, -0.02), 'Black', 0.003)
    export(f'{OUT}/attachments/agrip.glb', {'agrip': take()})

def att_flashlight(name, r, length, under=False):
    # lanterna: lateral direita do guarda-mão (origem na face de encaixe, corpo em +X) ou embaixo (pistola)
    if under:
        box((0.024, length * 0.6, 0.012), F(0.01, -0.006), 'Black', 0.002)
        cyl(r, length, F(0.01, -0.012 - r), 'Black', 'Y', 32, 0.0015)
        cyl(r * 0.85, 0.002, F(0.01 + length / 2 + 0.001, -0.012 - r), 'Lens', 'Y', 32, 0)
    else:
        box((0.012, 0.03, 0.02), F(0, 0, 0.006), 'Black', 0.002)
        cyl(r, length, F(0.01, 0, 0.012 + r), 'Black', 'Y', 32, 0.0015)
        cyl(r * 1.25, 0.03, F(0.01 + length / 2 - 0.012, 0, 0.012 + r), 'Black', 'Y', 32, 0.002, r2=r)
        cyl(r * 1.1, 0.002, F(0.01 + length / 2 + 0.003, 0, 0.012 + r), 'Lens', 'Y', 32, 0)
        cyl(r * 0.6, 0.012, F(0.01 - length / 2 - 0.004, 0, 0.012 + r), 'Rubber', 'Y', 24, 0.001)
        for k in range(5): torus(r * 1.01, 0.0009, F(-0.02 + k * 0.008, 0, 0.012 + r), 'Black', 'Y')
    export(f'{OUT}/attachments/{name}.glb', {name: take()})

def att_laser():
    box((0.012, 0.03, 0.022), F(0, 0, 0.006), 'Black', 0.002)
    box((0.026, 0.07, 0.032), F(0.006, 0, 0.025), 'Paint', 0.004)
    cyl(0.0045, 0.006, F(0.044, 0.006, 0.025), 'Metal', 'Y', 20, 0.0005)
    cyl(0.0035, 0.002, F(0.0475, 0.006, 0.025), 'Emit', 'Y', 16, 0)
    cyl(0.006, 0.006, F(0.044, -0.007, 0.025), 'Metal', 'Y', 20, 0.0005)
    cyl(0.005, 0.002, F(0.0475, -0.007, 0.025), 'Lens', 'Y', 16, 0)
    box((0.016, 0.012, 0.006), F(-0.02, 0.0, 0.042), 'Rubber', 0.001)
    export(f'{OUT}/attachments/laser.glb', {'laser': take()})

# ====================================================================== peças do personagem

def head_frame(fit):
    mn, mx = fit['head_min'], fit['head_max']
    c = Vector(((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2))
    half = Vector(((mx[0] - mn[0]) / 2, (mx[1] - mn[1]) / 2, (mx[2] - mn[2]) / 2))
    return c, half, mx[2]

def helmet(fit, kind):
    c, half, top = head_frame(fit)
    rx, ry = half.x + 0.022, half.y + 0.02
    rz = (top - c.z) + 0.018
    center = (c.x, c.y + 0.004, c.z - 0.01)
    # casco: corte alto nas orelhas (tipo moderno), aba frontal acima dos olhos
    shell(rx, ry, rz + 0.01, center, 0.05, 0.012, 'Paint', front_cut=(0.55, 0.42), rot_x=math.radians(-4))
    # borda emborrachada
    strap_ring((center[0], center[1], center[2] + 0.006), rx + 0.002, ry + 0.002, -0.08, 0.012, 0.005, 'Rubber', arc=(math.radians(200), math.radians(340)))
    # trilhos laterais e suporte frontal
    for s in (-1, 1):
        box((0.008, 0.11, 0.022), (c.x + s * (rx + 0.008), c.y + 0.0, c.z + 0.03), 'Black', 0.002, rot=(math.radians(8), 0, 0))
        for k in range(4): box((0.006, 0.006, 0.026), (c.x + s * (rx + 0.012), c.y - 0.04 + k * 0.025, c.z + 0.032), 'Metal', 0.0008)
    box((0.06, 0.012, 0.04), (c.x, c.y - ry - 0.004, c.z + rz * 0.62), 'Black', 0.003, rot=(math.radians(-25), 0, 0))
    # velcro / painéis
    box((0.07, 0.05, 0.004), (c.x, c.y + 0.0, top + 0.026), 'Fabric', 0.001)
    box((0.06, 0.004, 0.035), (c.x, c.y + ry + 0.006, c.z + rz * 0.55), 'Fabric', 0.001, rot=(math.radians(20), 0, 0))
    # jugular
    for s in (-1, 1):
        box((0.012, 0.004, 0.11), (c.x + s * (half.x - 0.005), c.y + 0.005, c.z - 0.085), 'Strap', 0.0008)
    parts = take()
    if kind == 'comms':
        for s in (-1, 1):
            cyl(0.045, 0.034, (c.x + s * (rx + 0.03), c.y + 0.005, c.z - 0.035), 'Paint', 'X', 36, 0.006)
            cyl(0.036, 0.012, (c.x + s * (rx + 0.006), c.y + 0.005, c.z - 0.035), 'Rubber', 'X', 36, 0.004)
            box((0.012, 0.02, 0.06), (c.x + s * (rx + 0.03), c.y + 0.005, c.z + 0.02), 'Black', 0.002)
        cyl(0.003, 0.09, (c.x - rx - 0.04, c.y - 0.06, c.z - 0.06), 'Black', 'Y', 12, 0)   # microfone
        cyl(0.008, 0.016, (c.x - rx - 0.04, c.y - 0.11, c.z - 0.06), 'Rubber', 'Y', 16, 0.002)
        parts += take()
    if kind == 'nvg':
        y0 = c.y - ry - 0.03; z0 = c.z + rz * 0.42
        box((0.05, 0.04, 0.03), (c.x, y0, z0), 'Black', 0.004)
        for s in (-1, 1):
            cyl(0.018, 0.075, (c.x + s * 0.03, y0 - 0.05, z0 - 0.045), 'Paint', 'Y', 32, 0.003)
            cyl(0.016, 0.002, (c.x + s * 0.03, y0 - 0.088, z0 - 0.045), 'Lens', 'Y', 32, 0)
            cyl(0.02, 0.012, (c.x + s * 0.03, y0 - 0.015, z0 - 0.045), 'Rubber', 'Y', 32, 0.002)
        box((0.09, 0.03, 0.018), (c.x, y0 - 0.035, z0 - 0.018), 'Paint', 0.004)
        box((0.07, 0.11, 0.05), (c.x, c.y + ry + 0.02, c.z + 0.02), 'Paint', 0.008)  # bateria atrás
        parts += take()
    return parts

def face_shell(c, fy, rx, rz, cz, keep_y, extra, top=0.9, bottom=-0.95, thick=0.006, m='Paint'):
    """Casca rente ao rosto: parte frontal de um elipsoide (y < keep_y no espaço unitário)."""
    ry = abs(fy - c.y) + extra
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1)
    o = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = [v for v in bm.verts if v.co.y > keep_y or v.co.z > top or v.co.z < bottom]
    bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(o.data); bm.free()
    o.scale = (rx, ry, rz); o.location = (c.x, c.y, cz)
    bpy.ops.object.transform_apply(location=True, scale=True)
    s = o.modifiers.new('t', 'SOLIDIFY'); s.thickness = thick; s.offset = 1
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='t')
    finish(o, m, 0.002)
    def surf(dx, dz):
        k = 1 - (dx / rx) ** 2 - ((dz - cz) / rz) ** 2
        return c.y - ry * math.sqrt(max(0.0, k))
    return surf

def mask_half(fit):
    c, half, _ = head_frame(fit)
    fy = fit['mouth_y']
    surf = face_shell(c, fy, 0.088, 0.062, 1.598, -0.32, 0.01, top=0.75)
    # respiros e costura central
    for k in range(3):
        for s_ in (-1, 1):
            box((0.006, 0.004, 0.022), (c.x + s_ * (0.018 + k * 0.012), surf(s_ * (0.018 + k * 0.012), 1.585) - 0.002, 1.585), 'Black', 0.001)
    box((0.006, 0.006, 0.05), (c.x, surf(0, 1.6) - 0.002, 1.6), 'Black', 0.001)
    for s_ in (-1, 1):
        box((0.008, 0.11, 0.012), (c.x + s_ * 0.082, c.y + 0.02, 1.625), 'Strap', 0.001)
    return take()

def mask_bandana(fit):
    c, half, _ = head_frame(fit)
    fy = fit['mouth_y']
    face_shell(c, fy, 0.098, 0.068, 1.592, -0.05, 0.007, top=0.62, thick=0.004)
    o = PARTS[-1]
    # ponta triangular caindo sobre o peito
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts:
        if v.co.z < 1.56 and v.co.y < c.y - 0.03:
            v.co.z -= (1.56 - v.co.z) * 1.3 * max(0.0, 1 - abs(v.co.x - c.x) / (half.x * 0.9))
            v.co.y -= 0.01
    bm.to_mesh(o.data); bm.free()
    return take()

def mask_gas(fit):
    c, half, _ = head_frame(fit)
    fy = fit['face_y']
    surf = face_shell(c, fy, 0.092, 0.09, 1.625, -0.2, 0.018, thick=0.008)
    for s_ in (-1, 1):
        y = surf(s_ * 0.034, 1.665)
        cyl(0.023, 0.01, (c.x + s_ * 0.034, y - 0.01, 1.662), 'Black', 'Y', 32, 0.002)
        cyl(0.02, 0.002, (c.x + s_ * 0.034, y - 0.0155, 1.662), 'Lens', 'Y', 32, 0)
    y = surf(0, 1.59)
    cyl(0.022, 0.028, (c.x, y - 0.01, 1.59), 'Black', 'Y', 32, 0.003, r2=0.018)
    for k in range(4): box((0.026, 0.003, 0.003), (c.x, y - 0.025, 1.582 + k * 0.006), 'Metal', 0)
    yf = surf(0.055, 1.585)
    cyl(0.028, 0.045, (c.x + 0.062, yf - 0.018, 1.582), 'Metal', 'Y', 32, 0.003)   # filtro
    for k in range(4): torus(0.0285, 0.0012, (c.x + 0.062, yf - 0.005 - k * 0.009, 1.582), 'Metal', 'Y')
    strap_ring((c.x, c.y + 0.01, 1.66), half.x + 0.004, half.y + 0.004, 0.25, 0.014, 0.003, 'Strap', arc=(math.radians(-25), math.radians(205)))
    return take()

def glasses(fit, goggles=False):
    c, half, _ = head_frame(fit)
    ez = 1.668
    fy = fit['face_y'] + 0.012
    w = half.x * 0.62
    if goggles:
        box((w * 2 + 0.02, 0.022, 0.045), (c.x, fy - 0.012, ez), 'Paint', 0.008)
        box((w * 2 + 0.006, 0.004, 0.036), (c.x, fy - 0.025, ez), 'Lens', 0.002)
        strap_ring((c.x, c.y + 0.01, ez + 0.012), half.x * 0.86, half.y * 0.95, 0.0, 0.022, 0.003, 'Strap', arc=(math.radians(-15), math.radians(195)))
    else:
        for s_ in (-1, 1):
            box((w * 0.95, 0.004, 0.032), (c.x + s_ * w * 0.52, fy - 0.012, ez), 'Lens', 0.003, rot=(0, 0, s_ * math.radians(-8)))
            box((0.006, half.y * 0.95, 0.007), (c.x + s_ * (w + 0.008), fy + half.y * 0.45, ez + 0.006), 'Paint', 0.0015)
        box((w * 2.05, 0.008, 0.007), (c.x, fy - 0.012, ez + 0.019), 'Paint', 0.002)
        box((0.012, 0.008, 0.01), (c.x, fy - 0.01, ez - 0.004), 'Paint', 0.002)
    return take()

def headset(fit):
    c, half, top = head_frame(fit)
    for s_ in (-1, 1):
        cyl(0.04, 0.03, (c.x + s_ * (half.x + 0.018), c.y + 0.008, 1.645), 'Paint', 'X', 36, 0.006)
        cyl(0.034, 0.01, (c.x + s_ * (half.x + 0.002), c.y + 0.008, 1.645), 'Rubber', 'X', 36, 0.003)
    # a faixa acima: arco no plano XZ
    bm = bmesh.new()
    rows = []
    R = (half.x + 0.022); H = top - 1.645 + 0.016
    for i in range(33):
        a = math.pi * i / 32
        x = c.x + R * math.cos(a); z = 1.645 + H * math.sin(a)
        rows.append([bm.verts.new((x, c.y + 0.008 + dy, z)) for dy in (-0.012, 0.012)])
    for i in range(32):
        bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
    me = bpy.data.meshes.new('band'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('band', me); bpy.context.scene.collection.objects.link(o)
    s = o.modifiers.new('t', 'SOLIDIFY'); s.thickness = 0.006
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='t')
    finish(o, 'Black', 0.001)
    cyl(0.003, 0.1, (c.x - half.x - 0.03, c.y - 0.05, 1.615), 'Black', 'Y', 12, 0)
    cyl(0.008, 0.016, (c.x - half.x - 0.03, c.y - 0.1, 1.615), 'Rubber', 'Y', 16, 0.002)
    return take()

def backpack(fit, kind):
    by = fit['back_y'] - 0.005
    if kind == 'assault':
        box((0.28, 0.14, 0.4), (0, by + 0.07, 1.24), 'Paint', 0.025)
        box((0.24, 0.05, 0.22), (0, by + 0.16, 1.2), 'Paint', 0.015)
        for z in (1.12, 1.2, 1.28): box((0.25, 0.006, 0.02), (0, by + 0.188, z), 'Strap', 0.001)
        for s in (-1, 1):
            box((0.06, 0.12, 0.16), (s * 0.165, by + 0.07, 1.16), 'Paint', 0.012)
            box((0.05, 0.02, 0.36), (s * 0.08, by - 0.004, 1.26), 'Strap', 0.003)
        box((0.2, 0.02, 0.03), (0, by + 0.145, 1.44), 'Black', 0.004)
        return take()
    if kind == 'hydro':
        box((0.2, 0.06, 0.34), (0, by + 0.03, 1.24), 'Paint', 0.022)
        cyl(0.006, 0.3, (0.1, by + 0.01, 1.3), 'Rubber', 'Z', 12, 0)
        box((0.18, 0.006, 0.02), (0, by + 0.062, 1.3), 'Strap', 0.001)
        box((0.18, 0.006, 0.02), (0, by + 0.062, 1.18), 'Strap', 0.001)
        return take()
    # rádio
    box((0.26, 0.11, 0.34), (0, by + 0.055, 1.24), 'Paint', 0.02)
    box((0.16, 0.06, 0.2), (0.0, by + 0.135, 1.26), 'Black', 0.01)
    for k in range(4): box((0.12, 0.003, 0.012), (0, by + 0.166, 1.2 + k * 0.03), 'Metal', 0.0008)
    cyl(0.005, 0.5, (0.08, by + 0.09, 1.62), 'Black', 'Z', 12, 0)
    cyl(0.009, 0.04, (0.08, by + 0.09, 1.38), 'Rubber', 'Z', 16, 0.002)
    cyl(0.004, 0.36, (-0.08, by + 0.09, 1.55), 'Black', 'Z', 10, 0)
    return take()

def chest_radio(fit):
    fy = fit['front_y'] - 0.003
    box((0.07, 0.04, 0.12), (0.11, fy - 0.02, 1.34), 'Paint', 0.008)
    box((0.06, 0.03, 0.1), (0.11, fy - 0.045, 1.335), 'Black', 0.006)
    cyl(0.004, 0.14, (0.125, fy - 0.045, 1.45), 'Rubber', 'Z', 12, 0)
    cyl(0.007, 0.012, (0.095, fy - 0.045, 1.395), 'Metal', 'Z', 16, 0.001)
    box((0.04, 0.004, 0.03), (0.11, fy - 0.061, 1.33), 'Lens', 0.002)
    return take()

def kneepad(fit, side):
    k = fit['knees'][side]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1)
    o = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = [v for v in bm.verts if v.co.y > -0.25]
    bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(o.data); bm.free()
    o.scale = (0.065, 0.05, 0.085); o.location = (k[0], k[1] + 0.03, k[2] + 0.005)
    bpy.ops.object.transform_apply(location=True, scale=True)
    s = o.modifiers.new('t', 'SOLIDIFY'); s.thickness = 0.012; s.offset = 1
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='t')
    finish(o, 'Paint', 0.004)
    for dz in (-0.045, 0.045):
        strap_ring((k[0], k[1] + 0.06, k[2] + dz), 0.062, 0.062, 0.0, 0.016, 0.004, 'Strap', arc=(math.radians(-30), math.radians(210)))
    return take()

def hip_pouch(fit):
    h = fit['hip']
    box((0.05, 0.12, 0.15), (h[0] - 0.02, h[1], h[2]), 'Paint', 0.012)
    box((0.055, 0.1, 0.05), (h[0] - 0.023, h[1], h[2] + 0.06), 'Paint', 0.01)
    box((0.004, 0.03, 0.06), (h[0] - 0.048, h[1], h[2] + 0.02), 'Strap', 0.001)
    box((0.03, 0.02, 0.2), (h[0] + 0.01, h[1] + 0.03, h[2] + 0.06), 'Strap', 0.002)
    return take()

# ====================================================================== geração

bpy.ops.wm.read_factory_settings(use_empty=True)
for k in list(MATS): del MATS[k]
reset()
att_reddot(); att_holo(); att_scope4x(); att_pistol_dot()
att_suppressor('suppressor', 0.019, 0.16); att_suppressor('pistol_suppressor', 0.0155, 0.12)
att_compensator(); att_vgrip(); att_agrip()
att_flashlight('flashlight', 0.0125, 0.12); att_flashlight('pistol_light', 0.011, 0.06, under=True)
att_laser()

for team, fit in FIT.items():
    S = lambda name: f'{OUT}/cosmetics/{name}_{team}.glb'
    export(S('helmet_ballistic'), {'helmet@Head': helmet(fit, 'ballistic')})
    export(S('helmet_comms'), {'helmet@Head': helmet(fit, 'comms')})
    export(S('helmet_nvg'), {'helmet@Head': helmet(fit, 'nvg')})
    export(S('mask_half'), {'mask@Head': mask_half(fit)})
    export(S('mask_bandana'), {'mask@Head': mask_bandana(fit)})
    export(S('mask_gas'), {'mask@Head': mask_gas(fit)})
    export(S('glasses_ballistic'), {'glasses@Head': glasses(fit)})
    export(S('goggles'), {'glasses@Head': glasses(fit, True)})
    export(S('headset'), {'headset@Head': headset(fit)})
    export(S('backpack_assault'), {'pack@Chest': backpack(fit, 'assault')})
    export(S('backpack_hydro'), {'pack@Chest': backpack(fit, 'hydro')})
    export(S('backpack_radio'), {'pack@Chest': backpack(fit, 'radio')})
    export(S('chest_radio'), {'radio@Chest': chest_radio(fit)})
    export(S('kneepads'), {'pad@Leg.L': kneepad(fit, 'L'), 'pad@Leg.R': kneepad(fit, 'R')})
    export(S('hip_pouch'), {'pouch@UpLeg.R': hip_pouch(fit)})
json.dump(FIT, open(f'{OUT}/cosmetics/fit.json', 'w'), indent=1, default=list)
print('COSMETICOS OK')
