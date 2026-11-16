# Converte as armas "SKM_*.fbx" (Stein Games, CC0) para GLB do jogo.
#  - separa o carregador (com as balas) e o ferrolho/slide em peças próprias ("Magazine", "Slide") pelos pesos dos ossos,
#    para a animação de recarga; remove o esqueleto (o jogo anima as peças)
#  - material PBR glTF: cor; ORM montado a partir do RMAO (R=rugosidade, G=metal, B=oclusão -> R=AO, G=rug., B=metal);
#    normal convertida de DirectX (Unreal) para OpenGL (canal verde invertido); balas em latão
# Uso: python(bpy) convert_stein_weapons.py -- <pasta_da_arma> <nome> <saida.glb> <pasta_temp>
import bpy, sys, os, glob
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
SRC, NAME, OUT, TMP = args[:4]
os.makedirs(TMP, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
fbx = glob.glob(os.path.join(SRC, '*.fbx'))[0]
bpy.ops.import_scene.fbx(filepath=fbx)
scene = bpy.context.scene

def tex(kind):
    for f in glob.glob(os.path.join(SRC, '*')):
        if os.path.basename(f).lower().endswith(f'_{kind.lower()}.png'):
            return f
    return None

def load_px(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    return img, px, w, h

def save_img(name, px, w, h, fmt='JPEG'):
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels = px.ravel().tolist()
    img.filepath_raw = os.path.join(TMP, name + ('.jpg' if fmt == 'JPEG' else '.png'))
    img.file_format = fmt
    scene.render.image_settings.quality = 92
    img.save()
    img.pack()
    return img

# texturas
color_img = bpy.data.images.load(tex('C'))
color_img.pack()
_, rmao, w, h = load_px(tex('RMAO'))
orm = np.stack([rmao[..., 2], rmao[..., 0], rmao[..., 1], np.ones_like(rmao[..., 0])], axis=-1)
orm_img = save_img(NAME + '_orm', orm, w, h)
_, nrm, w2, h2 = load_px(tex('N'))
nrm[..., 1] = 1.0 - nrm[..., 1]
nrm[..., 3] = 1.0
nrm_img = save_img(NAME + '_normal', nrm, w2, h2)

def make_main():
    m = bpy.data.materials.new(NAME)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = color_img
    nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    to = nt.nodes.new('ShaderNodeTexImage'); to.image = orm_img; to.image.colorspace_settings.name = 'Non-Color'
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(to.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nrm_img; tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def make_brass():
    m = bpy.data.materials.new(NAME + '_brass')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.78, 0.55, 0.22, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.35
    return m

main_mat, brass = make_main(), make_brass()
meshes = [o for o in scene.objects if o.type == 'MESH']
for o in meshes:
    for i, slot in enumerate(o.material_slots):
        slot.material = brass if slot.material and 'BULLET' in slot.material.name.upper() else main_mat

# separa peças móveis pelo osso dominante de cada vértice
PARTS = {'Magazine': ('MAGAZINE', 'MAGASINE', 'BULLET'), 'Slide': ('SLIDE', 'BOLT')}
skinned = [o for o in meshes if o.vertex_groups]
for o in skinned:
    names = [g.name.upper() for g in o.vertex_groups]
    dom = []
    for v in o.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        dom.append(names[best.group] if best else '')
    for part, keys in PARTS.items():
        sel = [any(dn.startswith(k) for k in keys) and not dn.endswith('RELEASE') and dn != 'BOLT_STOP' for dn in dom]
        if not any(sel):
            continue
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='DESELECT')
        bpy.ops.object.mode_set(mode='OBJECT')
        for v, s in zip(o.data.vertices, sel):
            v.select = s
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.separate(type='SELECTED')
        bpy.ops.object.mode_set(mode='OBJECT')
        new = [x for x in bpy.context.selected_objects if x is not o][0]
        new.name = part
        dom = [d for d, s in zip(dom, sel) if not s]

# tira o esqueleto mantendo a pose de repouso
for o in [o for o in scene.objects if o.type == 'MESH']:
    for md in list(o.modifiers):
        if md.type == 'ARMATURE':
            o.modifiers.remove(md)
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
    o.vertex_groups.clear()
for o in [o for o in scene.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)
body = [o for o in scene.objects if o.name not in PARTS]
for i, o in enumerate(body):
    o.name = 'Body' if i == 0 else f'Body_{i}'
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = scene.objects[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_animations=False,
                          export_image_format='JPEG', export_jpeg_quality=90)
print('ARMA OK', NAME, [(o.name, len(o.data.vertices)) for o in scene.objects])
