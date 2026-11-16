# Rigging completo de um personagem humanoide em T-pose (malha única, sem esqueleto) + animações.
# Uso: python(bpy) rig_character.py -- <entrada.glb> <saida.glb> <saida.blend> <relatorio.json>
import bpy, sys, json, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT_GLB, OUT_BLEND, OUT_REPORT = args[:4]
H = 1.80  # altura final (m)
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = FPS
obj = [o for o in scene.objects if o.type == 'MESH'][0]
obj.name = 'Body'
for o in list(scene.objects):
    if o is not obj:
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# ------------------------------------------------------------------ 1. normalização (sem alterar proporções)
# o modelo olha para +X; a convenção do Blender/glTF é olhar para -Y (vira +Z no glTF)
obj.matrix_world = Matrix.Rotation(-math.pi / 2, 4, 'Z') @ obj.matrix_world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
V = np.array([v.co[:] for v in obj.data.vertices])
h0 = V[:, 2].max() - V[:, 2].min()
s = H / h0
V = V * s
V[:, 2] -= V[:, 2].min()
torso = V[(V[:, 2] > 0.45 * H) & (V[:, 2] < 0.7 * H) & (np.abs(V[:, 0]) < 0.12 * H)]
cx, cy = torso[:, 0].mean(), torso[:, 1].mean()
V[:, 0] -= cx
V[:, 1] -= cy
for i, v in enumerate(obj.data.vertices):
    v.co = V[i]
obj.data.update()
X, Y, Z = V[:, 0], V[:, 1], V[:, 2]
rep = {'scale': s, 'verts': len(V)}

# ------------------------------------------------------------------ 2. pontos anatômicos a partir da geometria
def sl(mask):
    return V[mask]

marks = {}
for side, sg in (('L', 1), ('R', -1)):
    sx = sg * X
    tip = sx.max()
    step = 0.01
    t = tip
    edge = None
    prof = []
    while t > 0.05:
        m = (sx <= t) & (sx > t - step)
        if m.sum() > 3:
            zz = Z[m]
            span = zz.max() - zz.min()
            prof.append((t, span, (zz.max() + zz.min()) / 2, (Y[m].max() + Y[m].min()) / 2, Y[m].max() - Y[m].min()))
            if span > 0.33 and edge is None:
                edge = t
                break
        t -= step
    prof = np.array(prof)
    sh_x = edge - 0.11
    L = tip - sh_x
    # pulso: seção mais fina entre 68% e 84% do braço
    cand = prof[(prof[:, 0] < sh_x + 0.84 * L) & (prof[:, 0] > sh_x + 0.66 * L)]
    w_t = cand[np.argmin(cand[:, 1] + cand[:, 4]), 0] if len(cand) else sh_x + 0.76 * L
    def armpt(tt):
        k = np.argmin(np.abs(prof[:, 0] - tt))
        return prof[k, 2], prof[k, 3]
    sz, sy = armpt(edge + 0.03)  # altura/profundidade do braço logo fora do tronco
    el_t = sh_x + (w_t - sh_x) * 0.56
    ez, ey = armpt(el_t)
    wz, wy = armpt(w_t)
    marks[side] = {
        'shoulder': (sg * sh_x, sy, sz), 'elbow': (sg * el_t, ey, ez), 'wrist': (sg * w_t, wy, wz),
        'tip': (sg * tip, armpt(tip - 0.02)[1], armpt(tip - 0.02)[0]), 'torso_edge': sg * edge
    }

# virilha: primeira altura (subindo) em que há material no meio entre as pernas
crotch = None
for zz in np.arange(0.25 * H, 0.62 * H, 0.004):
    m = (Z > zz) & (Z < zz + 0.006) & (np.abs(X) < 0.012)
    if m.sum() >= 2:
        crotch = zz
        break
hip_z = crotch + 0.075
ank_z = 0.085
for side, sg in (('L', 1), ('R', -1)):
    def legc(zz):
        m = (Z > zz - 0.015) & (Z < zz + 0.015) & (sg * X > 0.01) & (sg * X < 0.3)
        p = V[m]
        return ((p[:, 0].max() + p[:, 0].min()) / 2, (p[:, 1].max() + p[:, 1].min()) / 2)
    hx, hy = legc(crotch - 0.04)
    knee_z = ank_z + (hip_z - ank_z) * 0.62
    kx, ky = legc(knee_z)
    ax, ay = legc(ank_z + 0.06)
    foot = V[(Z < 0.06) & (sg * X > 0.02)]
    toe_y = foot[:, 1].min()
    heel_y = foot[:, 1].max()
    marks[side].update({
        'hip': (hx, hy, hip_z), 'knee': (kx, ky + 0.015, knee_z), 'ankle': (ax, ay + 0.02, ank_z),
        'ball': (ax, ay + (toe_y - ay) * 0.62, 0.035), 'toe': (ax, toe_y + 0.01, 0.03), 'heel_y': heel_y
    })

def ycenter(zz, half=0.12):
    m = (Z > zz - 0.02) & (Z < zz + 0.02) & (np.abs(X) < half)
    p = V[m]
    return (p[:, 1].max() + p[:, 1].min()) / 2 if len(p) else 0.0

sh_z = (marks['L']['shoulder'][2] + marks['R']['shoulder'][2]) / 2
pelvis_z = hip_z + 0.01
spine_z = pelvis_z + 0.13
chest_z = spine_z + 0.16
neck_z = sh_z + 0.035
head_z = neck_z + 0.10
top_z = Z.max()
marks['center'] = {'pelvis': pelvis_z, 'spine': spine_z, 'chest': chest_z, 'neck': neck_z, 'head': head_z, 'top': top_z, 'crotch': crotch}
rep['landmarks'] = {k: ({kk: (list(map(lambda x: round(float(x), 3), vv)) if isinstance(vv, tuple) else round(float(vv), 3)) for kk, vv in v.items()}) for k, v in marks.items()}

# ------------------------------------------------------------------ 3. esqueleto
arm_data = bpy.data.armatures.new('Rig')
arm = bpy.data.objects.new('Armature', arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones

def bone(name, head, tail, parent=None, deform=True, connect=False, roll=0.0):
    b = eb.new(name)
    b.head = Vector(head)
    b.tail = Vector(tail)
    b.roll = roll
    b.use_deform = deform
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    return b

c = marks['center']
bone('Root', (0, 0, 0), (0, 0.25, 0), deform=False)
bone('Hips', (0, ycenter(c['pelvis']), c['pelvis']), (0, ycenter(c['spine']), c['spine']), 'Root')
bone('Spine', (0, ycenter(c['spine']), c['spine']), (0, ycenter(c['chest']), c['chest']), 'Hips', connect=True)
bone('Chest', (0, ycenter(c['chest']), c['chest']), (0, ycenter(c['neck'], 0.08), c['neck']), 'Spine', connect=True)
bone('Neck', (0, ycenter(c['neck'], 0.08), c['neck']), (0, ycenter(c['head'], 0.08), c['head']), 'Chest', connect=True)
bone('Head', (0, ycenter(c['head'], 0.08), c['head']), (0, ycenter(c['head'], 0.08), c['top']), 'Neck', connect=True)
for side, sg in (('L', 1), ('R', -1)):
    m = marks[side]
    sh, el, wr, tip = Vector(m['shoulder']), Vector(m['elbow']), Vector(m['wrist']), Vector(m['tip'])
    clav_h = Vector((sg * 0.035, sh.y - 0.01, sh.z + 0.015))
    bone(f'Shoulder.{side}', clav_h, sh, 'Chest')
    bone(f'UpperArm.{side}', sh, el, f'Shoulder.{side}', connect=True)
    bone(f'ForeArm.{side}', el, wr, f'UpperArm.{side}', connect=True)
    bone(f'Hand.{side}', wr, tip, f'ForeArm.{side}', connect=True)
    hp, kn, an, ba, to = Vector(m['hip']), Vector(m['knee']), Vector(m['ankle']), Vector(m['ball']), Vector(m['toe'])
    bone(f'UpLeg.{side}', hp, kn, 'Hips')
    bone(f'Leg.{side}', kn, an, f'UpLeg.{side}', connect=True)
    bone(f'Foot.{side}', an, ba, f'Leg.{side}', connect=True)
    bone(f'Toe.{side}', ba, to, f'Foot.{side}', connect=True)
# rolagem coerente: eixo X local das juntas de dobra (joelho/cotovelo)
for b in eb:
    if b.name.startswith(('UpLeg', 'Leg', 'Foot', 'Toe', 'Hips', 'Spine', 'Chest', 'Neck', 'Head')):
        b.align_roll(Vector((0, -1, 0)) if not b.name.startswith(('Foot', 'Toe')) else Vector((0, 0, 1)))
    elif b.name.startswith(('UpperArm', 'ForeArm', 'Hand', 'Shoulder')):
        b.align_roll(Vector((0, 0, 1)))

# controles de IK (não deformam; não vão para o arquivo final)
for side, sg in (('L', 1), ('R', -1)):
    m = marks[side]
    an = Vector(m['ankle'])
    fb = bone(f'IK_Foot.{side}', an, Vector(m['ball']), 'Root', deform=False)
    fb.align_roll(Vector((0, 0, 1)))
    bone(f'Pole_Leg.{side}', Vector((an.x, -0.6, Vector(m['knee']).z)), Vector((an.x, -0.7, Vector(m['knee']).z)), 'Root', deform=False)
    # mãos: posição de "pronto" segurando o fuzil, relativas ao peito
    # mão direita: punho do fuzil (palma para dentro); esquerda: guarda-mão por baixo
    hpos = Vector((-0.13, -0.22, sh_z - 0.29)) if side == 'R' else Vector((-0.02, -0.46, sh_z - 0.33))
    hb = bone(f'IK_Hand.{side}', hpos, hpos + Vector((0, -0.12, 0)), 'Chest', deform=False)
    hb.align_roll(Vector((-1, 0, 0)) if side == 'R' else Vector((0.5, 0, -0.85)))
    ppos = Vector((-0.6, 0.15, sh_z - 0.55)) if side == 'R' else Vector((0.35, -0.3, sh_z - 0.75))
    bone(f'Pole_Arm.{side}', ppos, ppos + Vector((0, 0.1, 0)), 'Chest', deform=False)
bpy.ops.object.mode_set(mode='OBJECT')
rep['bones'] = [b.name for b in arm_data.bones if b.use_deform]

# ------------------------------------------------------------------ 4. pesos (skinning)
deform = [b for b in arm_data.bones if b.use_deform]
names = [b.name for b in deform]
heads = np.array([(arm.matrix_world @ b.head_local)[:] for b in deform])
tails = np.array([(arm.matrix_world @ b.tail_local)[:] for b in deform])

def seg_dist(P, a, b):
    ab = b - a
    t = np.clip(((P - a) @ ab) / max(1e-9, ab @ ab), 0, 1)
    proj = a + t[:, None] * ab
    return np.linalg.norm(P - proj, axis=1)

def ramp(x, a, b):
    return np.clip((x - a) / (b - a), 0, 1)

n = len(V)
W = np.zeros((n, len(deform)))
for j, nm in enumerate(names):
    d = seg_dist(V, heads[j], tails[j])
    w = 1.0 / np.power(d + 0.012, 5)
    side = nm[-1] if nm.endswith(('.L', '.R')) else None
    if side:
        sg = 1 if side == 'L' else -1
        w *= ramp(sg * X, -0.015, 0.02)  # nada atravessa para o outro lado
    edgeL = abs(marks['L']['torso_edge'])
    if nm.startswith(('UpperArm', 'ForeArm', 'Hand')):
        w *= ramp(np.abs(X), edgeL - 0.07, edgeL - 0.01) * ramp(Z, sh_z - 0.3, sh_z - 0.18)
    if nm.startswith('Shoulder'):
        w *= ramp(Z, sh_z - 0.25, sh_z - 0.12)
    if nm.startswith(('UpLeg', 'Leg', 'Foot', 'Toe')):
        w *= 1 - ramp(Z, hip_z + 0.02, hip_z + 0.1)
    if nm.startswith(('Leg', 'Foot', 'Toe')):
        w *= 1 - ramp(Z, marks['L']['knee'][2] + 0.12, marks['L']['knee'][2] + 0.2)
    if nm == 'Head':
        w *= ramp(Z, c['neck'] + 0.03, c['neck'] + 0.07)
    if nm == 'Neck':
        w *= ramp(Z, sh_z - 0.12, sh_z - 0.04)
    if nm.startswith(('Spine', 'Chest', 'Hips', 'Neck', 'Head')):
        # tronco não puxa as mãos/antebraços
        w *= 1 - ramp(np.abs(X), edgeL + 0.02, edgeL + 0.12)
    W[:, j] = w
W += 1e-12
W /= W.sum(axis=1, keepdims=True)

# vértices duplicados nas costuras de UV (mesma posição) precisam ter pesos idênticos, senão a malha abre
_, weld = np.unique(np.round(V / 2e-5).astype(np.int64), axis=0, return_inverse=True)
weld = weld.ravel()
nweld = weld.max() + 1
def unify(W):
    acc = np.zeros((nweld, W.shape[1]))
    np.add.at(acc, weld, W)
    cnt = np.bincount(weld, minlength=nweld)[:, None]
    return (acc / cnt)[weld]
rep['seam_vertices'] = int(n - nweld)
# suavização sobre a malha (transições nas juntas: ombro, cotovelo, quadril, joelho), com as costuras unidas
edges = weld[np.array([e.vertices[:] for e in obj.data.edges])]
edges = edges[edges[:, 0] != edges[:, 1]]
W = unify(W)
Wu = np.zeros((nweld, W.shape[1]))
np.add.at(Wu, weld, W)
Wu /= np.bincount(weld, minlength=nweld)[:, None]
nbr_sum = np.zeros_like(Wu)
deg = np.bincount(edges.ravel(), minlength=nweld).astype(float)[:, None] + 1e-9
for it in range(6):
    nbr_sum[:] = 0
    np.add.at(nbr_sum, edges[:, 0], Wu[edges[:, 1]])
    np.add.at(nbr_sum, edges[:, 1], Wu[edges[:, 0]])
    Wu = 0.5 * Wu + 0.5 * nbr_sum / deg
    Wu /= Wu.sum(axis=1, keepdims=True)
W = Wu[weld]
# no máximo 4 ossos por vértice (padrão glTF/Babylon)
idx = np.argsort(-W, axis=1)[:, :4]
W4 = np.take_along_axis(W, idx, axis=1)
W4[W4 < 0.01] = 0
W4 /= W4.sum(axis=1, keepdims=True)
groups = {nm: obj.vertex_groups.new(name=nm) for nm in names}
for i in range(n):
    for k in range(4):
        if W4[i, k] > 0:
            groups[names[idx[i, k]]].add([i], float(W4[i, k]), 'REPLACE')
obj.parent = arm
mod = obj.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
rep['weights'] = {nm: int((W4 * (idx == j)).sum(axis=1).astype(bool).sum()) for j, nm in enumerate(names)}

# ------------------------------------------------------------------ 5. restrições de IK
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
for b in pb:
    b.rotation_mode = 'QUATERNION'
iks = {}
for side in ('L', 'R'):
    for chain, tgt, pole, end in ((f'ForeArm.{side}', f'IK_Hand.{side}', f'Pole_Arm.{side}', f'Hand.{side}'),
                                  (f'Leg.{side}', f'IK_Foot.{side}', f'Pole_Leg.{side}', f'Foot.{side}')):
        k = pb[chain].constraints.new('IK')
        k.target = arm; k.subtarget = tgt
        k.pole_target = arm; k.pole_subtarget = pole
        k.chain_count = 2
        iks[chain] = k
        cr = pb[end].constraints.new('COPY_ROTATION')
        cr.target = arm; cr.subtarget = tgt
        iks[end] = cr

def best_pole_angle(chain):
    """Escolhe o ângulo de pólo que não torce o osso (menor diferença para o alinhamento mínimo)."""
    k = iks[chain]
    upper = pb[chain].parent
    best, bv = 0, 9
    for ang in (-90, 0, 90, 180):
        k.pole_angle = math.radians(ang)
        bpy.context.view_layer.update()
        rest = upper.bone.matrix_local.to_3x3()
        posed = (arm.matrix_world.to_3x3().inverted() @ upper.matrix.to_3x3())
        q = rest.col[1].rotation_difference(posed.col[1])
        expect = q.to_matrix() @ rest.col[0]
        v = expect.angle(posed.col[0])
        if v < bv:
            best, bv = ang, v
    k.pole_angle = math.radians(best)
    return best

rep['pole_angles'] = {ch: best_pole_angle(ch) for ch in iks if ch.startswith(('ForeArm', 'Leg'))}
bpy.ops.object.mode_set(mode='OBJECT')

json.dump(rep, open(OUT_REPORT, 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print('RIG OK', json.dumps(rep['pole_angles']))
