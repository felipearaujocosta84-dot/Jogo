# Uso: <python com bpy 4.x> convert_maps.py -- <pasta_dos_glb_originais> <saida_glb> <saida_json> [ids,separados]
# Gera public/assets/maps/<id>.glb (visual) e <id>.json (colisão + nascimentos). Ver public/assets/CREDITS.md.
# Converte os mapas GLB do kit para o jogo:
#  - GLB visual otimizado (malhas unidas por material, escala em metros, sem luzes/câmeras/marcadores)
#  - JSON de colisão (caixas AABB em coordenadas do jogo/Babylon) + pontos de nascimento
# Uso: blender python convert_maps.py -- <pasta_dos_glb> <pasta_saida_glb> <pasta_saida_json>
import bpy, bmesh, sys, os, json, math, re
import mathutils
from mathutils.bvhtree import BVHTree
from collections import defaultdict

S = 0.35  # metros por unidade do arquivo
args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT_GLB, OUT_JSON = args[0], args[1], args[2]
ONLY = args[3].split(',') if len(args) > 3 else None

MAPS = {
    'city-crossroads-battle-map.glb': 'city_crossroads',
    'desert-outpost-battle-map.glb': 'desert_outpost',
    'jungle-ruins-arena.glb': 'jungle_ruins',
    'snowy-bunker-battle-map.glb': 'snowy_bunker',
    'warehouse-yard-arena.glb': 'warehouse_yard',
}

# peças sem colisão (marcadores, efeitos, tecidos finos, água, fios)
SKIP = re.compile(r'marker|camera|capturepoint|_area\b|spawnarea|arrow_|light|glow|fire|flame|wire|cable|rope|banner|flag|water|pond_ice_?$|smoke|steam|beam_light|screen', re.I)
# materiais que não colidem
SKIP_MAT = re.compile(r'^(fire|lampglow|lightred|water)$', re.I)

SURF = [('metal', r'metal|iron|paint|rubber|gold|glass|cargl|olive'), ('wood', r'wood|burlap|crate|pallet'),
        ('sand', r'sand|soil|snow|grass|foliage|ice|adobe'), ('concrete', r'concrete|asphalt|sidewalk|yard|cream|plaster|brick'),
        ('stone', r'stone|rock|crystal')]
SURF_IDX = {'sand': 0, 'stone': 1, 'concrete': 2, 'wood': 3, 'metal': 4}


def surface_of(mat_name):
    for s, pat in SURF:
        if re.search(pat, mat_name or '', re.I):
            return s
    return 'concrete'


def to_game(v):
    """Blender (Z para cima) -> coordenadas do Babylon depois do carregador glTF: (-x, z, -y) * S."""
    return (-v[0] * S, v[2] * S, -v[1] * S)


def loose_parts(bm):
    seen = set()
    parts = []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack = [f]
        seen.add(f.index)
        comp = []
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf)
        parts.append(comp)
    return parts


def greedy_rects(cells):
    """cells: set de (i, j). Retorna retângulos (i0, j0, i1, j1) inclusivos."""
    rects = []
    left = set(cells)
    for (i, j) in sorted(cells, key=lambda c: (c[1], c[0])):
        if (i, j) not in left:
            continue
        i1 = i
        while (i1 + 1, j) in left:
            i1 += 1
        j1 = j
        while all((k, j1 + 1) in left for k in range(i, i1 + 1)):
            j1 += 1
        for jj in range(j, j1 + 1):
            for ii in range(i, i1 + 1):
                left.discard((ii, jj))
        rects.append((i, j, i1, j1))
    return rects


def voxelize(verts, faces, res, zq, fixed_lo=False):
    """Colunas verticais: intervalos sólidos por coluna (raios de baixo para cima)."""
    bvh = BVHTree.FromPolygons(verts, faces)
    xs = [v[0] for v in verts]; ys = [v[1] for v in verts]; zs = [v[2] for v in verts]
    x0, x1, y0, y1, z0, z1 = min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)
    ni = max(1, int(math.ceil((x1 - x0) / res))); nj = max(1, int(math.ceil((y1 - y0) / res)))
    groups = defaultdict(set)
    up = mathutils.Vector((0, 0, 1))
    for i in range(ni):
        for j in range(nj):
            x = x0 + (i + 0.5) * res; y = y0 + (j + 0.5) * res
            origin = mathutils.Vector((x, y, z0 - 0.5))
            hits = []
            guard = 0
            while guard < 40:
                guard += 1
                loc, nor, idx, dist = bvh.ray_cast(origin, up, (z1 + 1) - origin.z)
                if loc is None:
                    break
                if abs(nor.z) > 0.08:
                    hits.append((loc.z, nor.z))
                origin = mathutils.Vector((x, y, loc.z + 1e-3))
            inside = None
            for z, nz in hits:
                if nz < 0:  # entra no sólido (face de baixo)
                    if inside is None:
                        inside = z
                else:  # sai pelo topo
                    a = inside if inside is not None else min(z - 0.6 / S, z0)
                    a = max(a, z - 6.0 / S) if inside is None else a
                    if fixed_lo:
                        a = z0 - 0.3 / S
                    lo = math.floor(a / zq) * zq; hi = math.ceil(z / zq) * zq
                    if hi - lo > 1e-6:
                        groups[(round(lo, 4), round(hi, 4))].add((i, j))
                    inside = None
    boxes = []
    for (lo, hi), cells in groups.items():
        for (i0, j0, i1, j1) in greedy_rects(cells):
            boxes.append(((x0 + i0 * res, y0 + j0 * res, lo), (x0 + (i1 + 1) * res, y0 + (j1 + 1) * res, hi)))
    return boxes


def process(fname, mid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, fname))
    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()

    # portões das bases (abrem no início da partida no jogo original) e portas fechadas: removidos,
    # assim as bases têm saída e os interiores (prédio, bunker, cabanas, templo) ficam jogáveis
    REMOVE = re.compile(r'^(spawngate|door_(front|back|upper)|bunker_door_(east|west)$|bunker_doorlight|radarhut_._door$|templedoor|balconydoor)', re.I)
    removed = [o.name for o in scene.objects if REMOVE.search(o.name)]
    for o in [o for o in scene.objects if REMOVE.search(o.name)]:
        bpy.data.objects.remove(o, do_unlink=True)
    print(f'[{mid}] removidos {len(removed)}: {sorted(set(re.sub(r"[_.]?[0-9]+$", "", n) for n in removed))[:12]}')

    # ------------------------------------------------ nascimentos
    spawns = {'T': [], 'CT': []}
    for o in scene.objects:
        n = o.name.lower()
        if o.type == 'EMPTY' and 'spawn' in n and 'area' not in n and ('red' in n or 'blue' in n):
            spawns['T' if 'red' in n else 'CT'].append(o.matrix_world.translation.copy())

    # ------------------------------------------------ colisão
    boxes = []  # (min, max, surf) em unidades Blender
    stats = defaultdict(int)
    for o in [o for o in scene.objects if o.type == 'MESH']:
        if SKIP.search(o.name):
            stats['skip_name'] += 1
            continue
        eo = o.evaluated_get(deps)
        me = eo.to_mesh()
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.transform(o.matrix_world)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        mats = [m.name if m else '' for m in o.data.materials]
        for comp in loose_parts(bm):
            mat_names = [mats[f.material_index] if f.material_index < len(mats) else '' for f in comp]
            main = max(set(mat_names), key=mat_names.count) if mat_names else ''
            if SKIP_MAT.match(main or ''):
                stats['skip_mat'] += 1
                continue
            vset = {v.index: v.co.copy() for f in comp for v in f.verts}
            vs = list(vset.values())
            mn = mathutils.Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
            mx = mathutils.Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
            d = mx - mn
            dm = (d.x * S, d.y * S, d.z * S)
            if max(dm) < 0.15 or (min(dm[0], dm[1]) < 0.06 and dm[2] < 1.3):
                stats['tiny'] += 1
                continue
            # volume (malhas fechadas) para saber se a peça é uma caixa alinhada
            vol = 0.0
            for f in comp:
                vv = [v.co for v in f.verts]
                for k in range(1, len(vv) - 1):
                    vol += vv[0].dot(vv[k].cross(vv[k + 1])) / 6.0
            aabb = max(1e-9, d.x * d.y * d.z)
            ratio = abs(vol) / aabb
            surf = surface_of(main)
            if 0.86 < ratio < 1.12:
                boxes.append((tuple(mn), tuple(mx), surf, o.name))
                stats['box'] += 1
                continue
            # peça irregular: colunas
            idx = {k: n for n, k in enumerate(vset)}
            verts = [vset[k] for k in vset]
            faces = [[idx[v.index] for v in f.verts] for f in comp]
            big = d.x * d.y * S * S > 120
            res = (0.5 if big else 0.18) / S
            for a, b in voxelize(verts, faces, res, (0.12 if big else 0.08) / S, fixed_lo=big):
                boxes.append((a, b, surf, o.name))
            stats['vox_part'] += 1
        bm.free()
        eo.to_mesh_clear()

    # ------------------------------------------------ caixas em coordenadas do jogo
    out_boxes = []
    names = []
    for a, b, surf, oname in boxes:
        p, q = to_game(a), to_game(b)
        lo = [min(p[i], q[i]) for i in range(3)]; hi = [max(p[i], q[i]) for i in range(3)]
        if hi[1] < 0.02:
            continue
        out_boxes.append([round(v * 100) for v in lo] + [round(v * 100) for v in hi] + [SURF_IDX[surf]])
        names.append(oname)

    # limites (todas as malhas visuais)
    allv = []
    for o in scene.objects:
        if o.type == 'MESH':
            for c in o.bound_box:
                allv.append(to_game(o.matrix_world @ mathutils.Vector(c)))
    bx = (min(v[0] for v in allv), max(v[0] for v in allv)); bz = (min(v[2] for v in allv), max(v[2] for v in allv))

    # nascimentos: pontos livres perto dos marcadores (5+ por equipe), virados para o centro
    def ground_at(x, z, top):
        g = None
        for bb in out_boxes:
            if bb[0] / 100 <= x <= bb[3] / 100 and bb[2] / 100 <= z <= bb[5] / 100:
                t = bb[4] / 100
                if t <= top + 0.6 and (g is None or t > g):
                    g = t
        return g

    def free(x, y, z):
        r = 0.36
        for bb in out_boxes:
            if bb[0] / 100 < x + r and bb[3] / 100 > x - r and bb[2] / 100 < z + r and bb[5] / 100 > z - r and bb[1] / 100 < y + 1.8 and bb[4] / 100 > y + 0.08:
                return False
        return True

    out_sp = {}
    for team, pts in spawns.items():
        gp = [to_game(p) for p in pts]
        cx = sum(p[0] for p in gp) / len(gp); cz = sum(p[2] for p in gp) / len(gp); cy = sum(p[1] for p in gp) / len(gp)
        cands = [(p[0], p[2]) for p in gp]
        for rad in (1.2, 2.4, 3.6, 4.8):
            for k in range(10):
                a = k / 10 * math.pi * 2
                cands.append((cx + math.cos(a) * rad, cz + math.sin(a) * rad))
        chosen = []
        for (x, z) in cands:
            if not (bx[0] + 1.2 < x < bx[1] - 1.2 and bz[0] + 1.2 < z < bz[1] - 1.2):
                continue
            y = ground_at(x, z, cy)
            if y is None or abs(y - cy) > 0.6 or not free(x, y, z):
                continue
            if any(math.hypot(x - c[0], z - c[2]) < 1.1 for c in chosen):
                continue
            yaw = math.degrees(math.atan2(-x, -z))
            chosen.append((x, y, z, yaw))
            if len(chosen) >= 8:
                break
        out_sp[team] = [{'x': round(x, 2), 'y': round(y + 0.05, 2), 'z': round(z, 2), 'yaw': round(yaw)} for x, y, z, yaw in chosen]

    data = {'id': mid, 'scale': S, 'bounds': [round(bx[0], 2), round(bx[1], 2), round(bz[0], 2), round(bz[1], 2)], 'spawns': out_sp, 'boxes': out_boxes}
    with open(os.path.join(OUT_JSON, '..', 'debug_' + mid + '.json'), 'w') as fh:
        json.dump(names, fh)
    with open(os.path.join(OUT_JSON, mid + '.json'), 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    print(f'[{mid}] caixas {len(out_boxes)} stats {dict(stats)} spawns T {len(out_sp["T"])} CT {len(out_sp["CT"])} bounds {data["bounds"]}')

    # ------------------------------------------------ GLB visual otimizado
    for o in list(scene.objects):
        if o.type in ('LIGHT', 'CAMERA') or (o.type == 'MESH' and re.search(r'marker|camera_overview', o.name, re.I)):
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in scene.objects if o.type == 'MESH']
    for o in scene.objects:
        o.select_set(False)
    # torna dados únicos (instâncias compartilhadas) e aplica transformações
    for o in meshes:
        if o.data.users > 1:
            o.data = o.data.copy()
    bpy.context.view_layer.objects.active = meshes[0]
    for o in meshes:
        o.select_set(True)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = mid
    obj.scale = (S, S, S)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(scene.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_GLB, mid + '.glb'), export_format='GLB', export_yup=True,
                              export_apply=True, export_animations=False, export_lights=False, export_cameras=False)
    print(f'[{mid}] glb objetos {len([o for o in scene.objects if o.type == "MESH"])}')


for fname, mid in MAPS.items():
    if ONLY and mid not in ONLY:
        continue
    process(fname, mid)
