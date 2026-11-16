# Animações do personagem (sobre o rig criado por rig_character.py) e exportação GLB para o Babylon.js.
# Cada animação é feita nos controles (IK de mãos e pés + coluna) e depois "assada" nos ossos que deformam.
# Uso: python(bpy) animate.py -- <rig.blend> <saida.glb> <saida_animado.blend>
import bpy, sys, math
from mathutils import Vector, Quaternion, Euler

args = sys.argv[sys.argv.index('--') + 1:]
BLEND, OUT_GLB, OUT_BLEND = args[:3]
bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
sc.render.fps = 30
arm = bpy.data.objects['Armature']
pb = arm.pose.bones
DEFORM = [b.name for b in arm.data.bones if b.use_deform]
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')

rest_hand = {s: pb[f'IK_Hand.{s}'].bone.head_local.copy() for s in 'LR'}
sh_z = pb['UpperArm.L'].bone.head_local.z

# poses das mãos (posição absoluta no espaço do peito em repouso)
HOLD = {
    'low': {'R': Vector((-0.13, -0.22, sh_z - 0.29)), 'L': Vector((-0.02, -0.46, sh_z - 0.33))},
    'aim': {'R': Vector((-0.12, -0.2, sh_z - 0.12)), 'L': Vector((-0.04, -0.5, sh_z - 0.11))},
    'run': {'R': Vector((-0.12, -0.2, sh_z - 0.33)), 'L': Vector((0.04, -0.36, sh_z - 0.2))},
    'mag': {'R': Vector((-0.12, -0.22, sh_z - 0.24)), 'L': Vector((-0.08, -0.3, sh_z - 0.42))},
    'pouch': {'R': Vector((-0.12, -0.22, sh_z - 0.24)), 'L': Vector((0.08, -0.2, sh_z - 0.45))},
}

# limita cada alvo ao alcance real do braço (ombro em repouso), para o IK nunca esticar demais
REACH = {sd: (pb[f'UpperArm.{sd}'].bone.length + pb[f'ForeArm.{sd}'].bone.length) * 0.97 for sd in 'LR'}
SHOULDER = {sd: pb[f'UpperArm.{sd}'].bone.head_local.copy() for sd in 'LR'}
for P in HOLD.values():
    for sd in 'LR':
        d = P[sd] - SHOULDER[sd]
        if d.length > REACH[sd]:
            P[sd] = SHOULDER[sd] + d.normalized() * REACH[sd]

def lerp(a, b, t):
    return a + (b - a) * t

def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def local_vec(name, v):
    return pb[name].bone.matrix_local.to_3x3().inverted() @ Vector(v)

def local_rot(name, euler_deg):
    R = pb[name].bone.matrix_local.to_3x3().to_quaternion()
    qw = Euler([math.radians(a) for a in euler_deg], 'XYZ').to_quaternion()
    return R.inverted() @ qw @ R

def reset():
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_quaternion = (1, 0, 0, 0)
        for c in b.constraints:
            c.influence = 1.0

KEYED = set()

def key(name, frame, loc=None, rot=None):
    b = pb[name]
    if loc is not None:
        b.location = local_vec(name, loc)
        b.keyframe_insert('location', frame=frame)
    if rot is not None:
        b.rotation_quaternion = local_rot(name, rot)
        b.keyframe_insert('rotation_quaternion', frame=frame)
    KEYED.add(name)

def hands(frame, pose_l, pose_r=None, off=(0, 0, 0)):
    for s, P in (('L', pose_l), ('R', pose_r or pose_l)):
        target = HOLD[P][s]
        key(f'IK_Hand.{s}', frame, loc=(target - rest_hand[s]) + Vector(off))

def hands_mix(frame, a, b, t, off=(0, 0, 0)):
    for s in 'LR':
        target = HOLD[a][s].lerp(HOLD[b][s], ease(t))
        key(f'IK_Hand.{s}', frame, loc=(target - rest_hand[s]) + Vector(off))

def body(frame, hips=(0, 0, 0), hips_rot=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0)):
    key('Hips', frame, loc=hips, rot=hips_rot)
    key('Spine', frame, rot=spine)
    key('Chest', frame, rot=chest)
    key('Neck', frame, rot=neck)
    key('Head', frame, rot=head)

def feet(frame, l=(0, 0, 0), r=(0, 0, 0), lrot=(0, 0, 0), rrot=(0, 0, 0)):
    key('IK_Foot.L', frame, loc=l, rot=lrot)
    key('IK_Foot.R', frame, loc=r, rot=rrot)

def set_influence(frame, chains, value):
    for name in chains:
        for c in pb[name].constraints:
            c.influence = value
            c.keyframe_insert('influence', frame=frame)

def stance(frame, depth=0.0):
    # pé esquerdo um pouco à frente (postura de tiro)
    feet(frame, l=(0.02, -0.08, 0), r=(-0.02, 0.1, 0), rrot=(0, 0, 18))

# ------------------------------------------------------------------ animações
def anim_idle(N=60):
    for f in range(0, N + 1, 3):
        p = f / N
        br = math.sin(p * 2 * math.pi)
        body(f, hips=(0.008 * math.sin(p * 2 * math.pi), 0, -0.006 + 0.004 * br), hips_rot=(0, 0, 2 * math.sin(p * 2 * math.pi)),
             spine=(1.5 * br, 0, 0), chest=(1.2 * br, 0, 0), head=(-2 + 2 * math.sin(p * 4 * math.pi), 3 * math.sin(p * 2 * math.pi), 0))
        hands(f, 'low', off=(0, 0, 0.008 * br))
        stance(f)
    return N

def foot_cycle(p, stride, stance_frac, lift):
    """Ciclo de um pé (andar no lugar): apoio leva o pé para trás; balanço traz para frente levantando."""
    if p < stance_frac:
        q = p / stance_frac
        return -stride / 2 + stride * q, 0.0, 0.0
    q = (p - stance_frac) / (1 - stance_frac)
    y = stride / 2 - stride * ease(q)
    z = lift * math.sin(q * math.pi)
    pitch = -25 * math.sin(q * math.pi) * (1 if q < 0.6 else 0.4)
    return y, z, pitch

def locomotion(N, stride, stance_frac, lift, bob, drop, lean, hold, sway):
    for f in range(0, N + 1, 1):
        p = f / N
        for s, ph in (('L', 0.0), ('R', 0.5)):
            y, z, pitch = foot_cycle((p + ph) % 1, stride, stance_frac, lift)
            key(f'IK_Foot.{s}', f, loc=(0, y, z), rot=(pitch, 0, 0))
        b = math.cos(p * 4 * math.pi)
        body(f, hips=(sway * math.sin(p * 2 * math.pi), 0, -drop - bob * (0.5 - 0.5 * b)), hips_rot=(0, 0, 6 * math.sin(p * 2 * math.pi)),
             spine=(lean, 0, 0), chest=(lean * 0.4, -5 * math.sin(p * 2 * math.pi), 0), head=(-lean * 0.8, 3 * math.sin(p * 2 * math.pi), 0))
        hands(f, hold, off=(0, 0, 0.012 * b))
    return N

def anim_walk():
    return locomotion(30, stride=0.56, stance_frac=0.6, lift=0.09, bob=0.025, drop=0.02, lean=4, hold='low', sway=0.02)

def anim_run():
    return locomotion(20, stride=0.95, stance_frac=0.4, lift=0.2, bob=0.045, drop=0.06, lean=13, hold='run', sway=0.015)

def anim_crouch(N=40):
    for f in range(0, N + 1, 4):
        p = f / N
        br = math.sin(p * 2 * math.pi)
        body(f, hips=(0, 0.06, -0.36 + 0.005 * br), hips_rot=(8, 0, 0), spine=(14 + br, 0, 0), chest=(6 + br, 0, 0), head=(-16, 0, 0))
        feet(f, l=(0.02, -0.16, 0), r=(-0.02, 0.18, 0), lrot=(0, 0, 0), rrot=(-15, 0, 15))
        hands(f, 'aim', off=(0, 0.02, -0.06 + 0.006 * br))
    return N

def anim_jump(N=36):
    for f in range(0, N + 1):
        t = f
        if t <= 8:  # agacha para tomar impulso
            k = ease(t / 8)
            lift, crouch, tuck = 0, -0.16 * k, 0
        elif t <= 12:  # impulso
            k = ease((t - 8) / 4)
            lift, crouch, tuck = 0.12 * k, -0.16 * (1 - k), 0
        elif t <= 28:  # no ar
            k = (t - 12) / 16
            lift = 0.12 + 0.42 * math.sin(k * math.pi)
            crouch, tuck = 0, 0.16 * math.sin(k * math.pi)
        else:  # aterrissagem amortecida
            k = (t - 28) / 8
            lift, crouch, tuck = 0, -0.2 * math.sin(k * math.pi * 0.5 + (math.pi * 0.5 if k > 0.5 else 0)) * (1 - k) - 0.0, 0
            crouch = -0.2 * (1 - ease(k))
        body(f, hips=(0, 0, lift + crouch), hips_rot=(-crouch * 40, 0, 0), spine=(4 - crouch * 30, 0, 0), chest=(2, 0, 0), head=(crouch * 20, 0, 0))
        feet(f, l=(0, -0.04 - tuck * 0.3, max(0, lift - 0.02) + tuck), r=(0, 0.06 - tuck * 0.2, max(0, lift - 0.02) + tuck * 0.7),
             lrot=(-tuck * 60, 0, 0), rrot=(-tuck * 40, 0, 0))
        hands(f, 'low', off=(0, 0, -crouch * 0.2 + tuck * 0.1))
    return N

def anim_aim(N=60):
    for f in range(0, N + 1, 3):
        p = f / N
        br = math.sin(p * 2 * math.pi)
        body(f, hips=(0, 0, -0.02), hips_rot=(0, 0, 20), spine=(4 + 0.6 * br, 0, -8), chest=(3, 0, -10), neck=(0, 0, 8), head=(8, 0, 10))
        hands(f, 'aim', off=(0.003 * math.sin(p * 4 * math.pi), 0, 0.004 * br))
        stance(f)
    return N

def anim_shoot(N=12):
    for f in range(0, N + 1):
        k = (f % 6) / 6.0
        recoil = math.exp(-k * 7) * (1 if f < N else 0) if f % 6 != 0 or True else 0
        recoil = math.exp(-((f % 6) / 6.0) * 6.0)
        body(f, hips=(0, 0, -0.02), hips_rot=(0, 0, 20), spine=(4 - 2.5 * recoil, 0, -8), chest=(3 - 3 * recoil, 0, -10), neck=(0, 0, 8), head=(8 - 2 * recoil, 0, 10))
        hands(f, 'aim', off=(0, 0.045 * recoil, 0.018 * recoil))
        stance(f)
    return N

def anim_reload(N=66):
    seq = [(0, 'aim', 'aim'), (8, 'low', 'low'), (18, 'mag', 'mag'), (28, 'pouch', 'pouch'), (40, 'mag', 'mag'), (46, 'mag', 'mag'), (56, 'low', 'low'), (66, 'aim', 'aim')]
    for f in range(0, N + 1, 2):
        for i in range(len(seq) - 1):
            if seq[i][0] <= f <= seq[i + 1][0]:
                a, b = seq[i], seq[i + 1]
                t = (f - a[0]) / max(1, b[0] - a[0])
                tilt = 0.04 if 8 <= f <= 56 else 0.0
                slap = 0.03 * math.sin(math.pi * min(1, max(0, (f - 44) / 4))) if 44 <= f <= 48 else 0
                hands_mix(f, a[1], b[1], t, off=(0, 0, slap))
                break
        look = ease(min(1, f / 10)) * (1 - ease(max(0, (f - 52) / 12)))
        body(f, hips=(0, 0, -0.02), hips_rot=(0, 0, 14), spine=(6 + 4 * look, 0, -6), chest=(3 + 4 * look, 0, -8), head=(8 + 18 * look, 0, 6))
        stance(f)
    return N

def anim_death(N=45):
    arm_chains = ['ForeArm.L', 'ForeArm.R', 'Hand.L', 'Hand.R']
    set_influence(0, arm_chains, 1.0)
    set_influence(6, arm_chains, 0.0)
    for f in range(0, N + 1):
        k = ease(f / 26)
        knees = ease(min(1, f / 10))
        settle = ease(max(0, (f - 26) / 8))
        body(f, hips=(0.03 * k, 0.32 * k, -0.18 * knees * (1 - k) - 0.62 * k - 0.04 * settle), hips_rot=(-78 * k - 4 * settle, 0, 6 * k),
             spine=(-10 * k + 6 * knees * (1 - k), 0, 4 * k), chest=(-8 * k, 0, 0), neck=(-10 * k, 0, 0), head=(-18 * k + 6 * settle, 20 * k, 0))
        feet(f, l=(0.02, -0.12 * k, 0.05 * k * (1 - settle)), r=(-0.04, -0.02 * k, 0.12 * k * (1 - settle)), lrot=(30 * k, 0, 0), rrot=(40 * k, 0, 10 * k))
        hands(f, 'low')
        # braços soltos (FK) caindo para os lados
        key('UpperArm.L', f, rot=(0, 30 * k - 50 * (1 - k), 0) if False else (0, -60 + 40 * k, -20 * k))
        key('UpperArm.R', f, rot=(0, 60 - 40 * k, 20 * k))
        key('ForeArm.L', f, rot=(0, 0, 25 * k))
        key('ForeArm.R', f, rot=(0, 0, -25 * k))
    return N

ANIMS = [('Idle', anim_idle), ('Walk', anim_walk), ('Run', anim_run), ('Jump', anim_jump), ('Crouch', anim_crouch),
         ('Aim', anim_aim), ('Shoot', anim_shoot), ('Reload', anim_reload), ('Death', anim_death)]

baked = []
for name, fn in ANIMS:
    reset()
    arm.animation_data_create()
    ctrl = bpy.data.actions.new(name + '_ctrl')
    arm.animation_data.action = ctrl
    KEYED.clear()
    n = fn()
    # interpolação linear entre chaves densas; laços fecham na mesma pose
    for fc in ctrl.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
    sc.frame_start, sc.frame_end = 0, n
    for b in arm.data.bones:
        b.select = b.name in DEFORM
    bpy.ops.nla.bake(frame_start=0, frame_end=n, step=1, only_selected=True, visual_keying=True, clear_constraints=False,
                     clear_parents=False, use_current_action=False, bake_types={'POSE'})
    act = arm.animation_data.action
    act.name = name
    act.use_fake_user = True
    # mantém só os canais dos ossos que deformam
    for fc in list(act.fcurves):
        if not any(f'pose.bones["{d}"]' in fc.data_path for d in DEFORM):
            act.fcurves.remove(fc)
    baked.append((name, n, len(act.fcurves)))
    bpy.data.actions.remove(ctrl)
    arm.animation_data.action = None

# remove controles e restrições (o arquivo final tem só o esqueleto que deforma + animações assadas)
reset()
for b in pb:
    for c in list(b.constraints):
        b.constraints.remove(c)
bpy.ops.object.mode_set(mode='EDIT')
for b in list(arm.data.edit_bones):
    if not b.use_deform and b.name != 'Root':
        arm.data.edit_bones.remove(b)
bpy.ops.object.mode_set(mode='OBJECT')
arm.animation_data.action = bpy.data.actions['Idle']
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_yup=True, export_apply=False,
                          export_animations=True, export_animation_mode='ACTIONS', export_def_bones=True,
                          export_force_sampling=True, export_frame_range=False, export_reset_pose_bones=True,
                          export_skins=True, export_lights=False, export_cameras=False, export_image_format='AUTO')
print('ANIM OK', baked)
