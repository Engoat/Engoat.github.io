# Matières usées du cockpit, avec Blender 5 et Cycles.
#   blender -b --factory-startup -P bake_wear.py -- [taille] [échantillons]
# Entrée : ../scratch/wear-in.glb, exporté par la page avec ?export (window.__exportWear()).
# Sorties dans ../public/assets/wear/ :
#   cockpit.glb (géométrie biseautée, deux dépliages), color.webp, roughness.webp, ao.webp
#
# Pour chaque matériau de la palette, un même principe :
#   - arêtes vives : le nœud Bevel de Cycles donne la normale « arrondie » ; là où elle
#     s'écarte de la vraie normale, on est sur une arête, et la peinture s'use (le métal
#     apparaît), en taches irrégulières tirées d'un bruit ;
#   - creux : l'ombre ambiante (nœud AO) dépose une saleté légère, plus mate ;
#   - les métaux nus (chrome, vis) ne s'écaillent pas : ils ne prennent que la saleté.
import bpy, sys, os, time, math
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SIZE = int(args[0]) if len(args) > 0 else 2048
SAMPLES = int(args[1]) if len(args) > 1 else 32
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "assets", "wear"))
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
def log(*a): print(f"[usure {time.time() - t0:6.1f}s]", *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "..", "scratch", "wear-in.glb"), merge_vertices=True)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = "cockpit_use"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = obj.data
log("objets :", len(meshes), "faces :", len(me.polygons), "matériaux :", [m.name for m in me.materials])

# --- nettoyage, ombrage lissé selon l'angle, puis biseau des arêtes vives
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.dissolve_degenerate(threshold=1e-6)
bpy.ops.mesh.delete_loose()
bpy.ops.object.mode_set(mode="OBJECT")
if me.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
bev = obj.modifiers.new("biseau", "BEVEL")
bev.width = 0.0012; bev.segments = 2; bev.limit_method = "ANGLE"; bev.angle_limit = math.radians(35)
bev.use_clamp_overlap = True
wn = obj.modifiers.new("normales", "WEIGHTED_NORMAL"); wn.keep_sharp = True
for m in list(obj.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)
log("biseau fait, faces :", len(me.polygons))

# --- dépliage propre à la cuisson (deuxième jeu de coordonnées)
uv = me.uv_layers.new(name="usure")
me.uv_layers.active = uv
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
margin = 4 / SIZE
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, area_weight=0.0, correct_aspect=True)
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(margin=margin, rotate=True)
bpy.ops.object.mode_set(mode="OBJECT")
log("dépliage fait")

# --- le shader d'usure, dans chaque matériau
METALS = {"chrome", "bolt"}
# sous la peinture : l'aluminium nu, clair ; sous le noir, un gris de plastique usé
WORN_UNDER = {"paint": (0.62, 0.63, 0.62), "paintDark": (0.58, 0.59, 0.58), "frame": (0.62, 0.63, 0.62),
              "bezel": (0.20, 0.20, 0.20), "black": (0.17, 0.17, 0.17)}
# les cerclages et pièces noires s'écaillent beaucoup moins que la peinture claire (taches plus rares)
SPOTS = {"bezel": (0.56, 0.70), "black": (0.56, 0.70)}
targets = {}
for mat in me.materials:
    nt = mat.node_tree; N = nt.nodes; L = nt.links
    bsdf = next(n for n in N if n.type == "BSDF_PRINCIPLED")
    base = tuple(bsdf.inputs["Base Color"].default_value)
    rough = bsdf.inputs["Roughness"].default_value
    for s in ("Base Color", "Roughness"):
        for l in list(bsdf.inputs[s].links): L.remove(l)
    tex = N.new("ShaderNodeTexCoord")
    geo = N.new("ShaderNodeNewGeometry")
    # arête : écart entre la normale biseautée et la vraie normale
    bevn = N.new("ShaderNodeBevel"); bevn.samples = 16; bevn.inputs["Radius"].default_value = 0.006
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    L.new(bevn.outputs["Normal"], dot.inputs[0]); L.new(geo.outputs["Normal"], dot.inputs[1])
    edge = N.new("ShaderNodeMapRange"); edge.inputs["From Min"].default_value = 0.998; edge.inputs["From Max"].default_value = 0.975
    L.new(dot.outputs["Value"], edge.inputs["Value"])
    # taches irrégulières
    noise = N.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 70; noise.inputs["Detail"].default_value = 8
    L.new(tex.outputs["Object"], noise.inputs["Vector"])
    spots = N.new("ShaderNodeMapRange")
    spots.inputs["From Min"].default_value, spots.inputs["From Max"].default_value = SPOTS.get(mat.name, (0.38, 0.55))
    L.new(noise.outputs["Fac"], spots.inputs["Value"])
    # saleté dans les creux
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.samples = 32; ao.inputs["Distance"].default_value = 0.04
    # une arête rentrante (pied d'un cadran sur la planche) est dans l'ombre : la peinture n'y
    # s'use pas. On ne garde que les arêtes saillantes, bien dégagées.
    exposed = N.new("ShaderNodeMapRange"); exposed.inputs["From Min"].default_value = 0.82; exposed.inputs["From Max"].default_value = 0.95
    L.new(ao.outputs["AO"], exposed.inputs["Value"])
    wear0 = N.new("ShaderNodeMath"); wear0.operation = "MULTIPLY"; wear0.use_clamp = True
    L.new(edge.outputs["Result"], wear0.inputs[0]); L.new(spots.outputs["Result"], wear0.inputs[1])
    wear = N.new("ShaderNodeMath"); wear.operation = "MULTIPLY"; wear.use_clamp = True
    L.new(wear0.outputs["Value"], wear.inputs[0]); L.new(exposed.outputs["Result"], wear.inputs[1])
    inv = N.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
    L.new(ao.outputs["AO"], inv.inputs[1])
    noise2 = N.new("ShaderNodeTexNoise"); noise2.inputs["Scale"].default_value = 18; noise2.inputs["Detail"].default_value = 4
    L.new(tex.outputs["Object"], noise2.inputs["Vector"])
    # seuls les vrais creux se salissent : on ignore la faible occultation des surfaces ouvertes
    crease = N.new("ShaderNodeMapRange"); crease.inputs["From Min"].default_value = 0.2; crease.inputs["From Max"].default_value = 0.6
    L.new(inv.outputs["Value"], crease.inputs["Value"])
    grime = N.new("ShaderNodeMath"); grime.operation = "MULTIPLY"; grime.use_clamp = True
    L.new(crease.outputs["Result"], grime.inputs[0]); L.new(noise2.outputs["Fac"], grime.inputs[1])
    # couleur : peinture -> métal dessous, puis assombrie par la saleté
    under = WORN_UNDER.get(mat.name, base[:3])
    mixw = N.new("ShaderNodeMix"); mixw.data_type = "RGBA"
    mixw.inputs["A"].default_value = base; mixw.inputs["B"].default_value = (*under, 1)
    if mat.name not in METALS: L.new(wear.outputs["Value"], mixw.inputs["Factor"])
    else: mixw.inputs["Factor"].default_value = 0
    dirt = N.new("ShaderNodeMix"); dirt.data_type = "RGBA"; dirt.blend_type = "MULTIPLY"
    dirt.inputs["B"].default_value = (0.62, 0.58, 0.52, 1)
    L.new(grime.outputs["Value"], dirt.inputs["Factor"]); L.new(mixw.outputs["Result"], dirt.inputs["A"])
    L.new(dirt.outputs["Result"], bsdf.inputs["Base Color"])
    # rugosité : le métal mis à nu est plus lisse, la saleté plus mate
    rmix = N.new("ShaderNodeMix"); rmix.data_type = "FLOAT"
    rmix.inputs["A"].default_value = rough; rmix.inputs["B"].default_value = 0.32
    if mat.name not in METALS: L.new(wear.outputs["Value"], rmix.inputs["Factor"])
    else: rmix.inputs["Factor"].default_value = 0
    radd = N.new("ShaderNodeMath"); radd.operation = "MULTIPLY_ADD"; radd.use_clamp = True
    L.new(grime.outputs["Value"], radd.inputs[0]); radd.inputs[1].default_value = 0.25
    L.new(rmix.outputs["Result"], radd.inputs[2])
    L.new(radd.outputs["Value"], bsdf.inputs["Roughness"])
    # pour la cuisson de la couleur, le métal ne doit pas l'effacer
    bsdf.inputs["Metallic"].default_value = 0.0
    # image cible, sur le second dépliage
    img_node = N.new("ShaderNodeTexImage"); img_node.name = "CIBLE"
    uvn = N.new("ShaderNodeUVMap"); uvn.uv_map = "usure"
    L.new(uvn.outputs["UV"], img_node.inputs["Vector"])
    targets[mat.name] = img_node

def target(img):
    for mat in me.materials:
        n = targets[mat.name]; n.image = img
        for x in mat.node_tree.nodes: x.select = False
        n.select = True; mat.node_tree.nodes.active = n

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.render.bake.margin = 6
sc.render.bake.margin_type = "EXTEND"
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True); bpy.context.view_layer.objects.active = obj
world = bpy.data.worlds.new("w"); sc.world = world

def bake(kind, samples, colorspace, **kw):
    img = bpy.data.images.new(kind, SIZE, SIZE, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colorspace
    target(img)
    sc.cycles.samples = samples
    bpy.ops.object.bake(type=kind, use_clear=True, margin=6, target="IMAGE_TEXTURES", **kw)
    return img

def save(img, name):
    img.filepath_raw = os.path.join(OUT, name)
    img.file_format = "WEBP"
    sc.render.image_settings.quality = 90
    img.save()

log("cuisson de la couleur,", SAMPLES, "échantillons")
save(bake("DIFFUSE", SAMPLES, "sRGB", pass_filter={"COLOR"}), "color.webp")
log("cuisson de la rugosité")
save(bake("ROUGHNESS", SAMPLES, "Non-Color"), "roughness.webp")
log("cuisson de l'ombre ambiante")
save(bake("AO", max(SAMPLES * 2, 64), "Non-Color"), "ao.webp")
log("images écrites")

# --- export : géométrie biseautée, deux dépliages, noms des matériaux, sans images
for mat in me.materials:
    nt = mat.node_tree
    nt.nodes.remove(targets[mat.name])
me.uv_layers.active = me.uv_layers[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "cockpit.glb"), export_format="GLB", use_selection=True,
                          export_image_format="NONE", export_texcoords=True, export_normals=True, export_yup=True,
                          export_apply=True, export_lights=False, export_cameras=False)
log("cockpit.glb écrit")
