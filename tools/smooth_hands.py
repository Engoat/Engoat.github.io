# Lisse les modèles de main (WebXR Input Profiles) : une subdivision, armature et poids conservés.
#   blender -b --factory-startup -P smooth_hands.py
# Entrée : hands-orig/{left,right}.glb (modèles d'origine). Sortie : ../public/assets/hands/
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))
HANDS = os.path.normpath(os.path.join(HERE, "..", "public", "assets", "hands"))

for side in ("left", "right"):
    src = os.path.join(HERE, "hands-orig", f"{side}.glb")
    dst = os.path.join(HANDS, f"{side}.glb")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        me = o.data
        print(f"[mains] {side} {o.name} : {len(me.vertices)} sommets, UV : {[u.name for u in me.uv_layers]}", flush=True)
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        # subdivision placée avant l'armature, puis appliquée : les poids des os suivent
        sub = o.modifiers.new("lisse", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
        while o.modifiers[0] != sub:
            bpy.ops.object.modifier_move_up(modifier=sub.name)
        bpy.ops.object.modifier_apply(modifier=sub.name)
        bpy.ops.object.shade_smooth()
        print(f"[mains] {side} après : {len(me.vertices)} sommets", flush=True)
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_skins=True, export_image_format="NONE",
                              export_texcoords=True, export_normals=True, export_yup=True)
    print(f"[mains] {side} écrit", flush=True)
