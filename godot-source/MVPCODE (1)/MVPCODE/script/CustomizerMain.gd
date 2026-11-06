
extends Control

# CHARACTER SPRITES
@onready var body_sprite: Sprite2D = $CharacterPreview/Body
@onready var bottom_sprite: Sprite2D = $CharacterPreview/Bottom
@onready var top_sprite: Sprite2D = $CharacterPreview/Top
@onready var feet_sprite: Sprite2D = $CharacterPreview/Feet
@onready var hair_sprite: Sprite2D = $CharacterPreview/Hair

# CHARACTER NAME
@onready var name_edit: LineEdit = $NameEdit

# CUSTOMIZATION VALUES
var body_index := 0
var skin_index := 0
var hair_style_index := 0
var hair_color_index := 0
var top_index := 0
var bottom_index := 0
var feet_index := 0

var character_name := ""

# ROTATION
const FRONT_DIRECTION := 0

var direction_index := 0
var auto_rotate := true
var rotate_interval := 0.2
var rotate_timer := 0.0


func _ready() -> void:

	randomize()

	# CHARACTER NAME
	name_edit.text_changed.connect(_on_name_changed)

	# ROTATION BUTTON
	$RotateButton.pressed.connect(_on_rotate_button_pressed)

	# HAIRSTYLE
	$HairstylePrev.pressed.connect(func(): _cycle("hair_style", -1))
	$HairstyleNext.pressed.connect(func(): _cycle("hair_style", 1))

	# HAIR COLOR
	$HaircolorPrev.pressed.connect(func(): _cycle("hair_color", -1))
	$HaircolorNext.pressed.connect(func(): _cycle("hair_color", 1))

	# TOP CLOTHING
	$TopPrev.pressed.connect(func(): _cycle("top", -1))
	$TopNext.pressed.connect(func(): _cycle("top", 1))

	# BOTTOM CLOTHING
	$BottomPrev.pressed.connect(func(): _cycle("bottom", -1))
	$BottomNext.pressed.connect(func(): _cycle("bottom", 1))

	# SHOES
	$FeetPrev.pressed.connect(func(): _cycle("feet", -1))
	$FeetNext.pressed.connect(func(): _cycle("feet", 1))

	# SKIN
	$SkinPrev.pressed.connect(func(): _cycle("skin", -1))
	$SkinNext.pressed.connect(func(): _cycle("skin", 1))

	# BODY TYPE
	$BodyAButton.pressed.connect(func(): _set_body(0))
	$BodyBButton.pressed.connect(func(): _set_body(1))

	# RANDOM CHARACTER
	$RandomButton.pressed.connect(_randomize_character)

	# CREATE CHARACTER
	$CreateCharacterButton.pressed.connect(create_character)

	# INITIAL APPEARANCE
	update_character()


func _on_name_changed(new_name: String) -> void:
	character_name = new_name


func _wrap(value: int, count: int) -> int:
	return (value % count + count) % count


# CHANGE CUSTOMIZATION
func _cycle(field: String, delta: int) -> void:

	match field:

		"hair_style":
			hair_style_index = _wrap(
				hair_style_index + delta,
				CharacterData.HAIR_STYLES
			)

		"hair_color":
			hair_color_index = _wrap(
				hair_color_index + delta,
				CharacterData.HAIR_COLORS
			)

		"top":
			top_index = _wrap(
				top_index + delta,
				CharacterData.CLOTHING_COUNT
			)

		"bottom":
			bottom_index = _wrap(
				bottom_index + delta,
				CharacterData.CLOTHING_COUNT
			)

		"feet":
			feet_index = _wrap(
				feet_index + delta,
				CharacterData.CLOTHING_COUNT
			)

		"skin":
			skin_index = _wrap(
				skin_index + delta,
				CharacterData.BODY_SKINS
			)

	update_character()


# CHANGE BODY TYPE
func _set_body(index: int) -> void:

	body_index = index

	update_character()


# UPDATE CHARACTER PREVIEW
func update_character() -> void:

	var d := direction_index

	body_sprite.texture = CharacterData.body_textures[body_index][skin_index][d]

	top_sprite.texture = CharacterData.top_textures[body_index][top_index][d]

	bottom_sprite.texture = CharacterData.bottom_textures[body_index][bottom_index][d]

	feet_sprite.texture = CharacterData.feet_textures[body_index][feet_index][d]

	hair_sprite.texture = CharacterData.hair_textures[hair_style_index][hair_color_index][d]


# RANDOMIZE APPEARANCE
func _randomize_character() -> void:

	body_index = randi() % 2

	skin_index = randi() % CharacterData.BODY_SKINS

	hair_style_index = randi() % CharacterData.HAIR_STYLES

	hair_color_index = randi() % CharacterData.HAIR_COLORS

	top_index = randi() % CharacterData.CLOTHING_COUNT

	bottom_index = randi() % CharacterData.CLOTHING_COUNT

	feet_index = randi() % CharacterData.CLOTHING_COUNT

	update_character()


# ROTATION BUTTON
func _on_rotate_button_pressed() -> void:

	auto_rotate = not auto_rotate


# AUTOMATIC CHARACTER ROTATION
func _process(delta: float) -> void:

	if not auto_rotate and direction_index == FRONT_DIRECTION:
		return

	rotate_timer += delta

	if rotate_timer >= rotate_interval:

		rotate_timer = 0.0

		direction_index = (direction_index + 1) % 4

		update_character()


# CREATE CHARACTER AND START GAME
func create_character() -> void:

	CharacterSettings.body_index = body_index
	CharacterSettings.skin_index = skin_index
	CharacterSettings.hair_style_index = hair_style_index
	CharacterSettings.hair_color_index = hair_color_index
	CharacterSettings.top_index = top_index
	CharacterSettings.bottom_index = bottom_index
	CharacterSettings.feet_index = feet_index

	CharacterSettings.character_name = name_edit.text.strip_edges()

	get_tree().change_scene_to_file("res://scene/Game.tscn")
