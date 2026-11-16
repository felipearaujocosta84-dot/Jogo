# Retargeting de animações Mixamo (FBX, 67 ossos, centímetros) para o rig dos personagens do jogo (21 ossos).
# Método: para cada osso, a variação de orientação em espaço de mundo em relação à T-pose da fonte é aplicada
# sobre a T-pose do alvo (os dois rigs estão em T-pose no repouso) — cancela as diferenças de eixos/rolagem dos ossos.
#  - altura do quadril escalada pela razão das pernas; deslocamento horizontal (root motion) removido, mantendo o balanço;
#  - "Turning" e "Strafing": o giro progressivo é removido (o ciclo fecha sem salto); (vira passos de giro no lugar; o jogo gira o personagem);
#  - versões espelhadas (lado direito) geradas trocando lados e refletindo as rotações.
# Grava as ações no .blend do personagem, exporta o GLB e um JSON com a velocidade real de cada ciclo (anti-deslize).
# Uso: python(bpy) retarget_mixamo.py -- <rig.blend> <pasta_fbx> <saida.glb> <saida.blend> <saida.json>
import bpy, sys, os, json, math
from mathutils import Matrix, Quaternion, Vector

args = sys.argv[sys.argv.index('--') + 1:]
RIG, FBX_DIR, OUT_GLB, OUT_BLEND, OUT_JSON = args[:5]

# o Strafing acelera e desacelera dentro do ciclo: o resto do deslocamento (até 45 cm) tiraria o corpo de cima
# da cápsula de colisão — fica só uma fração dele (balanço)
KEEP_SWAY = {'Strafing.fbx': 0.2}
CLIPS = [  # (arquivo, nome no jogo, espelhar, remover giro)
    ('Run_Forward.fbx', 'Run_Forward', False, False),
    ('Sprint_Backward.fbx', 'Sprint_Backward', False, False),
    ('Stepping_Backward.fbx', 'Stepping_Backward', False, False),
    ('Strafing.fbx', 'Strafe_Left', False, True),
    ('Strafing.fbx', 'Strafe_Right', True, True),
    ('Walk_Left.fbx', 'Walk_Left', False, False),
    ('Walk_Left.fbx', 'Walk_Right', True, False),
    ('Turning.fbx', 'Turning', False, True),
    ('Turning.fbx', 'Turning_Mirror', True, True),
]
MAP = {
    'Hips': 'Hips', 'Spine': 'Spine1', 'Chest': 'Spine2', 'Neck': 'Neck', 'Head': 'Head',
    'Shoulder.L': 'LeftShoulder', 'UpperArm.L': 'LeftArm', 'ForeArm.L': 'LeftForeArm', 'Hand.L': 'LeftHand',
    'Shoulder.R': 'RightShoulder', 'UpperArm.R': 'RightArm', 'ForeArm.R': 'RightForeArm', 'Hand.R': 'RightHand',
    'UpLeg.L': 'LeftUpLeg', 'Leg.L': 'LeftLeg', 'Foot.L': 'LeftFoot', 'Toe.L': 'LeftToeBase',
    'UpLeg.R': 'RightUpLeg', 'Leg.R': 'RightLeg', 'Foot.R': 'RightFoot', 'Toe.R': 'RightToeBase',
}

def mirror_name(n):
    return n.replace('Left', '§').replace('Right', 'Left').replace('§', 'Right')

def mirror_q(q):
    # reflexão no plano YZ (x -> -x): (w, x, y, z) -> (w, x, -y, -z)
    return Quaternion((q.w, q.x, -q.y, -q.z))

def rot_of(m):
    return m.to_3x3().normalized().to_quaternion()

bpy.ops.wm.open_mainfile(filepath=RIG)
scene = bpy.context.scene
scene.render.fps = 30
tgt = bpy.data.objects['Armature']
existing_actions = {a.name for a in bpy.data.actions} - {c[1] for c in CLIPS}
order = []
def visit(b):
    order.append(b.name)
    for c in b.children:
        visit(c)
for b in tgt.data.bones:
    if b.parent is None:
        visit(b)
order = [n for n in order if n in MAP]
t_rest = {n: tgt.data.bones[n].matrix_local.copy() for n in MAP}
t_hips_rest = t_rest['Hips'].translation.copy()
meta = {}

for fname, clip, mirror, unturn in CLIPS:
    path = os.path.join(FBX_DIR, fname)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    src = [o for o in new if o.type == 'ARMATURE'][0]
    sact = src.animation_data.action
    f0, f1 = int(sact.frame_range[0]), int(sact.frame_range[1])
    Ms = src.matrix_world.copy()
    pre = 'mixamorig:'
    s_rest = {b.name: Ms @ b.matrix_local for b in src.data.bones}
    s_hips_rest = s_rest[pre + 'Hips'].translation.copy()
    ratio = t_hips_rest.z / s_hips_rest.z

    # amostra o quadril (posição e direção) para remover deslocamento e giro
    hip_xy, hip_yaw = [], []
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        m = Ms @ src.pose.bones[pre + 'Hips'].matrix
        hip_xy.append(Vector((m.translation.x, m.translation.y)))
        fwd = m.to_3x3() @ Vector((0, 0, 1))
        hip_yaw.append(math.atan2(fwd.x, -fwd.y))
    n = len(hip_xy)
    T = (f1 - f0) / 30.0
    travel = (hip_xy[-1] - hip_xy[0]) * ratio
    yaw_total = math.atan2(math.sin(hip_yaw[-1] - hip_yaw[0]), math.cos(hip_yaw[-1] - hip_yaw[0]))

    old = bpy.data.actions.get(clip)  # rodar de novo sobre um .blend já convertido substitui o clipe
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(clip)
    tgt.animation_data_create()
    tgt.animation_data.action = act
    for pb in tgt.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    for i, f in enumerate(range(f0, f1 + 1)):
        scene.frame_set(f)
        t = i / max(1, n - 1)
        # tira o deslocamento linear (o jogo move o personagem) e, no giro, a rotação acumulada
        drift = hip_xy[0] + (hip_xy[-1] - hip_xy[0]) * t
        unyaw = Quaternion((0, 0, 1), -yaw_total * t) if unturn else Quaternion()
        for tname in order:
            sname = pre + (mirror_name(MAP[tname]) if mirror else MAP[tname])
            sp = Ms @ src.pose.bones[sname].matrix
            delta = rot_of(sp) @ rot_of(s_rest[sname]).inverted()
            delta = unyaw @ delta
            if mirror:
                delta = mirror_q(delta)
            want_rot = delta @ rot_of(t_rest[tname])
            pb = tgt.pose.bones[tname]
            if tname == 'Hips':
                p = sp.translation.copy()
                k = KEEP_SWAY.get(fname, 1.0)
                local = Vector(((p.x - drift.x) * k, (p.y - drift.y) * k, p.z - s_hips_rest.z))
                local = unyaw @ local
                if mirror:
                    local.x = -local.x
                pos = t_hips_rest + local * ratio
            else:
                pos = (tgt.pose.bones[tname].parent.matrix @ (tgt.data.bones[tname].parent.matrix_local.inverted() @ t_rest[tname])).translation
            pb.matrix = Matrix.LocRotScale(pos, want_rot, Vector((1, 1, 1)))
            bpy.context.view_layer.update()
            pb.keyframe_insert('rotation_quaternion', frame=i)
            if tname == 'Hips':
                pb.keyframe_insert('location', frame=i)
    act.use_fake_user = True
    speed = travel.length / T if T > 0 else 0
    # direção do deslocamento no espaço do personagem (frente = -Y do Blender = +Z no jogo; esquerda = +X)
    dx, dy = travel.x * (-1 if mirror else 1), travel.y
    meta[clip] = {'frames': n, 'seconds': round(T, 3), 'speed': round(speed, 3),
                  'dir': [round(-dx / (travel.length or 1), 2), round(-dy / (travel.length or 1), 2)],
                  'turnDeg': round(math.degrees(yaw_total) * (-1 if mirror else 1), 1)}
    print('CLIP', clip, json.dumps(meta[clip]), flush=True)
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if a.name not in existing_actions and a.name not in meta and a is not act and 'mixamo' in a.name:
            bpy.data.actions.remove(a)

# limpa pose e restos do import
tgt.animation_data.action = bpy.data.actions['Idle']
for pb in tgt.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
for a in list(bpy.data.actions):
    if 'mixamo' in a.name.lower():
        bpy.data.actions.remove(a)
# o FBX traz texturas/malhas próprias: descarta tudo que ficou sem uso
bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
json.dump(meta, open(OUT_JSON, 'w'), indent=1)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_yup=True, export_apply=False,
                          export_animations=True, export_animation_mode='ACTIONS', export_def_bones=True,
                          export_force_sampling=True, export_frame_range=False, export_reset_pose_bones=True,
                          export_skins=True, export_lights=False, export_cameras=False, export_image_format='AUTO')
print('RETARGET OK', sorted(a.name for a in bpy.data.actions))
