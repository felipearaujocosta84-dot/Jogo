# Melhoria dos modelos de arma simples (low-poly, sem textura): mantém a forma e as peças (Body/Magazine...)
# e acrescenta o que faltava para um visual de FPS atual:
#  - quinas chanfradas (2 segmentos) + normais ponderadas: as arestas pegam brilho em vez de facetas chapadas;
#  - UV automática e texturas PBR assadas (cor, normal, ORM) a partir de materiais procedurais por tipo:
#      metal (aço fosfatizado com desgaste brilhante nas quinas e riscos finos),
#      polímero (textura granulada fosca), borracha (empunhadura, mais escura e áspera), madeira (veios e verniz);
#  - oclusão de ambiente assada nas cavidades.
# O tipo vem do nome do material original (Metal/DarkMetal/LightMetal, Black/Main..., Wood/DarkWood) ou de
# --map nome=tipo. Uso: python(bpy) upgrade_weapon.py -- <entrada.glb> <saida.glb> <tamanho_textura> [nome=tipo ...]
import bpy, sys, math, bmesh
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, RES = args[0], args[1], int(args[2])
OVERRIDE = dict(a.split('=') for a in args[3:])

def kind_of(name):
    if name in OVERRIDE:
        return OVERRIDE[name]
    n = name.lower()
    if 'wood' in n: return 'wood'
    if 'metal' in n or 'brass' in n: return 'metal_light' if 'light' in n else 'metal'
    if 'grip' in n or 'rubber' in n: return 'rubber'
    return 'polymer'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
objs = [o for o in bpy.data.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
size = max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))
print('tamanho', round(size, 3), 'tris antes', sum(len(o.data.polygons) for o in objs))

# cores originais por material (a base de cada tipo)
base_color = {}
for m in bpy.data.materials:
    if m.use_nodes:
        b = m.node_tree.nodes.get('Principled BSDF')
        if b: base_color[m.name] = tuple(b.inputs['Base Color'].default_value)

for o in objs:
    bpy.context.view_layer.objects.active = o
    for x in objs: x.select_set(x is o)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 1e-4)
    bm.to_mesh(o.data); bm.free()
    bev = o.modifiers.new('bev', 'BEVEL')
    bev.width = size * 0.0045
    bev.segments = 2
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(35)
    bev.use_clamp_overlap = True
    bev.harden_normals = True
    wn = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    wn.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier='bev')
    bpy.ops.object.modifier_apply(modifier='wn')
    # UV nova só para as texturas assadas
    while o.data.uv_layers:
        o.data.uv_layers.remove(o.data.uv_layers[0])
    o.data.uv_layers.new(name='UVMap')

# UV conjunta (uma textura por arma)
for x in objs: x.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=0.6, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------- materiais procedurais
def build(mat, kind, col):
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    N = nt.nodes.new; L = nt.links.new
    out = N('ShaderNodeOutputMaterial'); bsdf = N('ShaderNodeBsdfPrincipled')
    L(bsdf.outputs[0], out.inputs[0])
    tc = N('ShaderNodeTexCoord')
    sc_ = 1.0 / size  # coordenadas do objeto normalizadas pelo tamanho da arma
    mp = N('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (sc_, sc_, sc_)
    L(tc.outputs['Object'], mp.inputs[0])
    # quinas: diferença entre a normal arredondada (Bevel) e a real
    bvl = N('ShaderNodeBevel'); bvl.inputs['Radius'].default_value = size * 0.006; bvl.samples = 8
    geo = N('ShaderNodeNewGeometry')
    dot = N('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
    L(bvl.outputs[0], dot.inputs[0]); L(geo.outputs['Normal'], dot.inputs[1])
    edge = N('ShaderNodeMapRange'); edge.inputs['From Min'].default_value = 0.995; edge.inputs['From Max'].default_value = 0.93
    L(dot.outputs['Value'], edge.inputs['Value'])
    # quebra a linha de desgaste com ruído
    nz = N('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 60; nz.inputs['Detail'].default_value = 6
    L(mp.outputs[0], nz.inputs['Vector'])
    wear = N('ShaderNodeMath'); wear.operation = 'MULTIPLY'; wear.use_clamp = True
    nzr = N('ShaderNodeMapRange'); nzr.inputs['From Min'].default_value = 0.42; nzr.inputs['From Max'].default_value = 0.62
    L(nz.outputs['Fac'], nzr.inputs['Value'])
    L(edge.outputs['Result'], wear.inputs[0]); L(nzr.outputs['Result'], wear.inputs[1])
    # micro relevo
    fine = N('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = {'metal': 420, 'metal_light': 420, 'anodized': 600, 'polymer': 900, 'rubber': 650, 'wood': 300}[kind]
    fine.inputs['Detail'].default_value = 4
    L(mp.outputs[0], fine.inputs['Vector'])
    bump = N('ShaderNodeBump'); bump.inputs['Distance'].default_value = size * 0.0006
    bump.inputs['Strength'].default_value = {'metal': 0.12, 'metal_light': 0.1, 'anodized': 0.08, 'polymer': 0.35, 'rubber': 0.55, 'wood': 0.25}[kind]
    L(fine.outputs['Fac'], bump.inputs['Height'])
    L(bvl.outputs[0], bump.inputs['Normal'])
    L(bump.outputs[0], bsdf.inputs['Normal'])
    # as cores originais são quase pretas (0,01–0,04): sobe para valores reais de acabamento escuro
    c = Vector(col[:3]) * 1.7 + Vector((0.012, 0.012, 0.013))
    def rgb(v):
        n = N('ShaderNodeRGB'); n.outputs[0].default_value = (v[0], v[1], v[2], 1); return n
    mix = N('ShaderNodeMix'); mix.data_type = 'RGBA'
    if kind == 'anodized':
        # alumínio anodizado: fosco acetinado, quinas gastas mostram alumínio claro
        L(wear.outputs[0], mix.inputs['Factor'])
        mix.inputs['A'].default_value = (*c, 1); mix.inputs['B'].default_value = (0.7, 0.71, 0.72, 1)
        rough = N('ShaderNodeMapRange'); L(wear.outputs[0], rough.inputs['Value'])
        rough.inputs['To Min'].default_value = 0.46; rough.inputs['To Max'].default_value = 0.28
        L(rough.outputs['Result'], bsdf.inputs['Roughness'])
        met = N('ShaderNodeMapRange'); L(wear.outputs[0], met.inputs['Value']); met.inputs['To Min'].default_value = 0.55; met.inputs['To Max'].default_value = 1.0
        L(met.outputs['Result'], bsdf.inputs['Metallic'])
    elif kind in ('metal', 'metal_light'):
        # aço fosfatizado: base escura levemente manchada + quinas em aço nu
        mott = N('ShaderNodeTexNoise'); mott.inputs['Scale'].default_value = 9; L(mp.outputs[0], mott.inputs['Vector'])
        m2 = N('ShaderNodeMix'); m2.data_type = 'RGBA'
        L(mott.outputs['Fac'], m2.inputs['Factor'])
        m2.inputs['A'].default_value = (*(c * 0.8), 1); m2.inputs['B'].default_value = (*(c * 1.15), 1)
        L(wear.outputs[0], mix.inputs['Factor']); L(m2.outputs['Result'], mix.inputs['A'])
        mix.inputs['B'].default_value = (0.62, 0.63, 0.64, 1)
        rough = N('ShaderNodeMapRange'); L(wear.outputs[0], rough.inputs['Value'])
        rough.inputs['To Min'].default_value = 0.36 if kind == 'metal' else 0.26; rough.inputs['To Max'].default_value = 0.2
        # riscos finos (ruído esticado)
        scr = N('ShaderNodeTexNoise'); scr.inputs['Scale'].default_value = 140; scr.inputs['Detail'].default_value = 2
        mp2 = N('ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (sc_ * 0.08, sc_ * 3, sc_ * 3); L(tc.outputs['Object'], mp2.inputs[0]); L(mp2.outputs[0], scr.inputs['Vector'])
        scm = N('ShaderNodeMapRange'); scm.inputs['From Min'].default_value = 0.6; scm.inputs['From Max'].default_value = 0.66; scm.inputs['To Min'].default_value = 0; scm.inputs['To Max'].default_value = -0.12
        L(scr.outputs['Fac'], scm.inputs['Value'])
        radd = N('ShaderNodeMath'); radd.operation = 'ADD'; radd.use_clamp = True
        L(rough.outputs['Result'], radd.inputs[0]); L(scm.outputs['Result'], radd.inputs[1])
        L(radd.outputs[0], bsdf.inputs['Roughness'])
        bsdf.inputs['Metallic'].default_value = 0.92
    elif kind == 'wood':
        wave = N('ShaderNodeTexWave'); wave.wave_type = 'RINGS'; wave.inputs['Scale'].default_value = 3.5; wave.inputs['Distortion'].default_value = 9; wave.inputs['Detail'].default_value = 3
        mpw = N('ShaderNodeMapping'); mpw.inputs['Scale'].default_value = (sc_ * 0.35, sc_ * 4, sc_ * 4); L(tc.outputs['Object'], mpw.inputs[0]); L(mpw.outputs[0], wave.inputs['Vector'])
        L(wave.outputs['Fac'], mix.inputs['Factor'])
        mix.inputs['A'].default_value = (*(c * 0.75), 1); mix.inputs['B'].default_value = (*(c * 1.35), 1)
        m3 = N('ShaderNodeMix'); m3.data_type = 'RGBA'; L(wear.outputs[0], m3.inputs['Factor']); L(mix.outputs['Result'], m3.inputs['A'])
        m3.inputs['B'].default_value = (*(c * 1.6), 1)
        mix = m3
        rough = N('ShaderNodeMapRange'); L(wave.outputs['Fac'], rough.inputs['Value']); rough.inputs['To Min'].default_value = 0.38; rough.inputs['To Max'].default_value = 0.55
        L(rough.outputs['Result'], bsdf.inputs['Roughness']); bsdf.inputs['Metallic'].default_value = 0
    else:
        # polímero / borracha: fosco, quinas levemente polidas pelo uso
        L(wear.outputs[0], mix.inputs['Factor'])
        mix.inputs['A'].default_value = (*(c * (0.85 if kind == 'rubber' else 1.0)), 1)
        mix.inputs['B'].default_value = (*(c * 1.45 + Vector((0.02, 0.02, 0.02))), 1)
        rough = N('ShaderNodeMapRange'); L(wear.outputs[0], rough.inputs['Value'])
        rough.inputs['To Min'].default_value = 0.82 if kind == 'rubber' else 0.62; rough.inputs['To Max'].default_value = 0.5
        L(rough.outputs['Result'], bsdf.inputs['Roughness']); bsdf.inputs['Metallic'].default_value = 0.0
    L(mix.outputs['Result'], bsdf.inputs['Base Color'])
    return bsdf

kinds = {}
for m in list(bpy.data.materials):
    if m.name not in base_color: continue
    k = kind_of(m.name); kinds[m.name] = k
    col = base_color[m.name]
    # cores dos modelos simples são muito chapadas: dá um pouco de vida (aço azulado, polímero quase preto)
    build(m, k, col)
print('tipos', kinds)

# ---------------------------------------------------------------- assar
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24
imgs = {n: bpy.data.images.new(n, RES, RES, alpha=False, float_buffer=False) for n in ('albedo', 'normal', 'rough', 'metal', 'ao')}
imgs['normal'].colorspace_settings.name = 'Non-Color'
for n in ('rough', 'metal', 'ao'): imgs[n].colorspace_settings.name = 'Non-Color'
def target(img):
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        nt = m.node_tree
        t = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
        t.name = 'BAKE'; t.image = img
        nt.nodes.active = t
for x in objs: x.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bake = sc.render.bake
bake.margin = 6
def do(img, typ, **kw):
    target(imgs[img])
    bpy.ops.object.bake(type=typ, **kw)
do('albedo', 'DIFFUSE', pass_filter={'COLOR'})
do('normal', 'NORMAL')
do('rough', 'ROUGHNESS')
do('ao', 'AO')
# metalicidade: liga temporariamente o valor na emissão
for m in bpy.data.materials:
    if m.name in kinds:
        b = m.node_tree.nodes['Principled BSDF']
        nt_ = m.node_tree; src = b.inputs['Metallic']
        if src.is_linked:
            nt_.links.new(src.links[0].from_socket, b.inputs['Emission Color'])
        else:
            b.inputs['Emission Color'].default_value = (src.default_value,) * 3 + (1,)
        b.inputs['Emission Strength'].default_value = 1
do('metal', 'EMIT')

# ORM = AO (R), rugosidade (G), metal (B)
import numpy as np
for n_, im_ in imgs.items(): print('media', n_, round(float(np.array(im_.pixels[:]).reshape(-1, 4)[:, :3].mean()), 3))
def px(n): return np.array(imgs[n].pixels[:]).reshape(RES, RES, 4)
ao = px('ao')[..., 0]; ao = 0.35 + 0.65 * ao  # suaviza a oclusão
orm = np.ones((RES, RES, 4)); orm[..., 0] = ao; orm[..., 1] = px('rough')[..., 0]; orm[..., 2] = px('metal')[..., 0]
ormimg = bpy.data.images.new('orm', RES, RES); ormimg.colorspace_settings.name = 'Non-Color'; ormimg.pixels = orm.ravel()

# grava em disco e recarrega (o exportador glTF não lê bem imagens geradas Non-Color)
import tempfile, os
tmp = tempfile.mkdtemp()
def persist(img, name, nonc):
    path = os.path.join(tmp, name + '.png')
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    new = bpy.data.images.load(path)
    if nonc: new.colorspace_settings.name = 'Non-Color'
    new.pack()
    return new
imgs['albedo'] = persist(imgs['albedo'], 'albedo', False)
imgs['normal'] = persist(imgs['normal'], 'normal', True)
ormimg = persist(ormimg, 'orm', True)
# material final único (glTF) com as texturas assadas
final = bpy.data.materials.new('weapon_pbr'); final.use_nodes = True
nt = final.node_tree; b = nt.nodes['Principled BSDF']
def tex(img, nonc=False):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    if nonc: t.image.colorspace_settings.name = 'Non-Color'
    return t
ta = tex(imgs['albedo']); nt.links.new(ta.outputs[0], b.inputs['Base Color'])
tn = tex(imgs['normal'], True); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs[0], nm.inputs['Color']); nt.links.new(nm.outputs[0], b.inputs['Normal'])
to = tex(ormimg, True); sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(to.outputs[0], sep.inputs[0])
nt.links.new(sep.outputs[1], b.inputs['Roughness']); nt.links.new(sep.outputs[2], b.inputs['Metallic'])
# oclusão no glTF: nó "glTF Material Output" com a entrada Occlusion
grp = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
if not grp.interface.items_tree:
    grp.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
g = nt.nodes.new('ShaderNodeGroup'); g.node_tree = grp; nt.links.new(sep.outputs[0], g.inputs['Occlusion'])
for o in objs:
    o.data.materials.clear(); o.data.materials.append(final)
for x in objs: x.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=90,
                          export_apply=True, export_yup=True, export_lights=False, export_cameras=False)
print('OK', OUT, 'tris depois', sum(len(o.data.polygons) for o in objs))
