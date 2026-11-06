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

var body_textures:   Array = []
var top_textures:    Array = []
var bottom_textures: Array = []
var feet_textures:   Array = []
var hair_textures:   Array = []

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
