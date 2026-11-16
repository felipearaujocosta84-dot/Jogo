# Uso: python(bpy) lod.py -- <rig.blend> <saida.glb> <razão decimate> <tamanho textura>
# Versão leve do personagem riggado: menos polígonos (pesos preservados pelo Decimate) e texturas 1024.
import bpy, sys
args = sys.argv[sys.argv.index('--') + 1:]
src, out, ratio, tex = args[0], args[1], float(args[2]), int(args[3])
bpy.ops.wm.open_mainfile(filepath=src)
body = bpy.data.objects['Body']
bpy.context.view_layer.objects.active = body
for o in bpy.context.scene.objects:
    o.select_set(o is body)
before = len(body.data.vertices)
if ratio < 1:
    d = body.modifiers.new('Decimate', 'DECIMATE')
    d.ratio = ratio
    d.use_collapse_triangulate = True
    bpy.ops.object.modifier_move_to_index(modifier='Decimate', index=0)
    bpy.ops.object.modifier_apply(modifier='Decimate')
for img in bpy.data.images:
    if img.size[0] > tex:
        img.scale(tex, tex)
        img.pack()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=False,
                          export_animations=True, export_animation_mode='ACTIONS', export_def_bones=True,
                          export_force_sampling=True, export_frame_range=False, export_reset_pose_bones=True,
                          export_skins=True, export_lights=False, export_cameras=False, export_image_format='JPEG', export_jpeg_quality=88)
print('LOD OK', before, '->', len(body.data.vertices))
