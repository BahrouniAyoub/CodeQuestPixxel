extends Node
# For now the added spritesheets are:
# 	2 Body types with 18 skintones each
#	18 Top/Bottom/Feet variations (with slight differences for both body types
#	18 hairstyles each in 12 preset colors 

const BODY_SKINS     := 18
const BODY_DIRS      := 4
const CLOTHING_COUNT := 18
const CLOTHING_DIRS  := 4
const HAIR_COLORS    := 12
const HAIR_DIRS      := 4
const HAIR_STYLES    := 18
const DIR_FRONT      := 0

# =============================================================================
# WALK ANIMATION SETTINGS
# =============================================================================
# Folder with the walk sheets (the loader finds the .png files by itself).
const WALK_PATH := "res://Character Assets walk/"

# Used only if the number of frames can't be detected automatically.
const WALK_FRAMES_FALLBACK := 6

# true:  columns are Down f0..fN, Right f0..fN, Up f0..fN, Left f0..fN
# false: columns are f0 of all dirs, f1 of all dirs, ...
const WALK_DIR_MAJOR := true

# Idle (single image per direction): [body][variant][direction]
var body_textures:   Array = []
var top_textures:    Array = []
var bottom_textures: Array = []
var feet_textures:   Array = []
var hair_textures:   Array = []

# Walk: [body][variant][direction] = Array of frames
var walk_body_textures:   Array = []
var walk_top_textures:    Array = []
var walk_bottom_textures: Array = []
var walk_feet_textures:   Array = []
var walk_hair_textures:   Array = []

# Number of walk frames per direction (detected from the sheets)
var walk_frame_count: int = WALK_FRAMES_FALLBACK


func _ready() -> void:
	body_textures.append(_slice_grid(preload( "res://Customizer Assets/Assets/Character Assets/Bodies/BodyAvar.png"), BODY_SKINS, BODY_DIRS))
	body_textures.append(_slice_grid(preload( "res://Customizer Assets/Assets/Character Assets/Bodies/BodyBvar.png"), BODY_SKINS, BODY_DIRS))

	top_textures.append(_slice_grid(preload("res://Customizer Assets/Assets/Character Assets/Top/TopA.png"), CLOTHING_COUNT, CLOTHING_DIRS))
	top_textures.append(_slice_grid(preload("res://Customizer Assets/Assets/Character Assets/Top/TopB.png"), CLOTHING_COUNT, CLOTHING_DIRS))

	bottom_textures.append(_slice_grid(preload("res://Customizer Assets/Assets/Character Assets/Bottom/BottomA.png"), CLOTHING_COUNT, CLOTHING_DIRS))
	bottom_textures.append(_slice_grid(preload("res://Customizer Assets/Assets/Character Assets/Bottom/BottomB.png"), CLOTHING_COUNT, CLOTHING_DIRS))

	feet_textures.append(_slice_grid(preload("res://Customizer Assets/Assets/Character Assets/Feet/FeetA.png"), CLOTHING_COUNT, CLOTHING_DIRS))
	feet_textures.append(_slice_grid(preload("res://Customizer Assets/Assets/Character Assets/Feet/FeetB.png"), CLOTHING_COUNT, CLOTHING_DIRS))
	
	for i in range(1, HAIR_STYLES + 1):
		var path := "res://Customizer Assets/Assets/Character Assets/Hair/hair_%02d.png" % i
		hair_textures.append(_slice_grid(load(path), HAIR_COLORS, HAIR_DIRS))

	_load_walk()


func _slice_grid(sheet: Texture2D, rows: int, cols: int) -> Array:
	var result := []
	var cell := Vector2(sheet.get_width() / float(cols), sheet.get_height() / float(rows))
	for r in rows:
		var row := []
		for c in cols:
			var at := AtlasTexture.new()
			at.atlas = sheet
			at.region = Rect2(c * cell.x, r * cell.y, cell.x, cell.y)
			row.append(at)
		result.append(row)
	return result


# =============================================================================
# WALK LOADING (finds the files by itself)
# =============================================================================
func _load_walk() -> void:
	print("[CharacterData] Loading walk sheets from: ", WALK_PATH)

	# Bodies / Top / Bottom / Feet: the first file = body type A, the second = B
	var body_files := _find_pngs(WALK_PATH + "Body")
	var top_files := _find_pngs(WALK_PATH + "Top")
	var bottom_files := _find_pngs(WALK_PATH + "Bottom")
	var feet_files := _find_pngs(WALK_PATH + "Feet")
	var hair_files := _find_pngs(WALK_PATH + "Hair")

	print("  Body files:   ", body_files)
	print("  Top files:    ", top_files)
	print("  Bottom files: ", bottom_files)
	print("  Feet files:   ", feet_files)
	print("  Hair files:   ", hair_files.size(), " found (expected ", HAIR_STYLES, ")")

	for i in 2:
		walk_body_textures.append(_walk_sheet(body_files, i, BODY_SKINS, BODY_DIRS, body_textures[i]))
		walk_top_textures.append(_walk_sheet(top_files, i, CLOTHING_COUNT, CLOTHING_DIRS, top_textures[i]))
		walk_bottom_textures.append(_walk_sheet(bottom_files, i, CLOTHING_COUNT, CLOTHING_DIRS, bottom_textures[i]))
		walk_feet_textures.append(_walk_sheet(feet_files, i, CLOTHING_COUNT, CLOTHING_DIRS, feet_textures[i]))

	for i in HAIR_STYLES:
		walk_hair_textures.append(_walk_sheet(hair_files, i, HAIR_COLORS, HAIR_DIRS, hair_textures[i]))

	print("[CharacterData] Walk frames per direction: ", walk_frame_count)


# Lists every .png in a folder (and its subfolders), in natural order
# (hair_2 before hair_10).
func _find_pngs(folder: String) -> Array[String]:
	var result: Array[String] = []
	_collect_pngs(folder, result)
	result.sort_custom(func(a: String, b: String) -> bool:
		return a.naturalnocasecmp_to(b) < 0)
	return result


func _collect_pngs(folder: String, result: Array[String]) -> void:
	var dir := DirAccess.open(folder)
	if dir == null:
		push_warning("Walk folder not found: " + folder)
		return
	for sub in dir.get_directories():
		_collect_pngs(folder.path_join(sub), result)
	for f in dir.get_files():
		# exported games list "xxx.png.import" instead of "xxx.png"
		var name: String = f.trim_suffix(".import").trim_suffix(".remap")
		if name.to_lower().ends_with(".png"):
			var full := folder.path_join(name)
			if not result.has(full):
				result.append(full)


# Loads the sheet number `index` from a list of files and slices it.
# idle_grid is the idle [row][dir] atlas list, used to detect the frame count.
func _walk_sheet(files: Array[String], index: int, rows: int, dirs: int, idle_grid: Array) -> Array:
	if index >= files.size():
		push_warning("Walk sheet number %d is missing (only %d files found)" % [index, files.size()])
		return []

	var sheet := load(files[index]) as Texture2D
	if sheet == null:
		push_warning("Could not load: " + files[index])
		return []

	# Detect how many frames each direction has:
	# walk sheet width = idle cell width * directions * frames
	var idle_cell: AtlasTexture = idle_grid[0][0]
	var frames := WALK_FRAMES_FALLBACK
	if idle_cell.region.size.x > 0.0:
		frames = maxi(1, roundi(sheet.get_width() / (idle_cell.region.size.x * dirs)))
	walk_frame_count = frames

	return _slice_walk(sheet, rows, dirs, frames)


# result[row][direction] = Array of frames
func _slice_walk(sheet: Texture2D, rows: int, dirs: int, frames_per_dir: int) -> Array:
	var result := []
	var cols := dirs * frames_per_dir
	var cell := Vector2(sheet.get_width() / float(cols), sheet.get_height() / float(rows))
	for r in rows:
		var row := []
		for d in dirs:
			var frames := []
			for f in frames_per_dir:
				var c: int = d * frames_per_dir + f if WALK_DIR_MAJOR else f * dirs + d
				var at := AtlasTexture.new()
				at.atlas = sheet
				at.region = Rect2(c * cell.x, r * cell.y, cell.x, cell.y)
				frames.append(at)
			row.append(frames)
		result.append(row)
	return result
