# Adiciona coordenadas de textura (projeção em caixa, 1 unidade de UV = 2 m) aos mapas de modelo 3D,
# para receberem texturas PBR reais. Só o arquivo visual é regravado; a colisão (JSON) não muda.
# Uso: python(bpy) add_box_uvs.py -- <entrada.glb> <saida.glb>
import bpy, bmesh, sys
args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
UNIT = 2.0
count = 0
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new('UVMap')
    mw = o.matrix_world
    nmat = mw.to_3x3().inverted().transposed()
    for f in bm.faces:
        n = (nmat @ f.normal).normalized()
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = mw @ l.vert.co
            if ax == 2:      # chão/teto (Z do Blender = cima)
                u, v = p.x, p.y
            elif ax == 0:    # paredes viradas para X
                u, v = p.y, p.z
            else:            # paredes viradas para Y
                u, v = p.x, p.z
            l[uv].uv = (u / UNIT, v / UNIT)
        count += 1
    bm.to_mesh(me)
    bm.free()
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True, export_animations=False,
                          export_lights=False, export_cameras=False, export_texcoords=True)
print('UV OK', count)
