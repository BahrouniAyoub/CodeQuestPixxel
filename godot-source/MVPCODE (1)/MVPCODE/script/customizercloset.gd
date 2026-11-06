
extends Control

# CHARACTER PREVIEW
@onready var body_sprite: Sprite2D = $CharacterPreview/Body
@onready var bottom_sprite: Sprite2D = $CharacterPreview/Bottom
@onready var top_sprite: Sprite2D = $CharacterPreview/Top
@onready var feet_sprite: Sprite2D = $CharacterPreview/Feet
@onready var hair_sprite: Sprite2D = $CharacterPreview/Hair

@onready var name_edit: LineEdit = $NameEdit

# REAL PLAYER IN THE ROOM
var player: CharacterBody2D = null

# CLOTHING VALUES
var top_index: int = 0
var bottom_index: int = 0
var feet_index: int = 0

# KEEP THE PLAYER'S ORIGINAL BODY AND HAIR
var body_index: int = 0
var skin_index: int = 0
var hair_style_index: int = 0
var hair_color_index: int = 0

# ROTATION (PREVIEW ONLY)
const FRONT_DIRECTION: int = 0

var direction_index: int = 0
var auto_rotate: bool = true
var rotate_interval: float = 0.2
var rotate_timer: float = 0.0


func _ready() -> void:
	randomize()

	# FIND THE REAL PLAYER
	player = get_tree().get_first_node_in_group("player") as CharacterBody2D

	if player == null:
		push_warning("No player found! Add your player to the 'player' group.")
	else:
		load_player_appearance()

	# NAME
	name_edit.text_changed.connect(_on_name_changed)

	# ROTATION
	$RotateButton.pressed.connect(_on_rotate_button_pressed)

	# TOP CLOTHING
	$TopPrev.pressed.connect(func(): _cycle("top", -1))
	$TopNext.pressed.connect(func(): _cycle("top", 1))

	# BOTTOM CLOTHING
	$BottomPrev.pressed.connect(func(): _cycle("bottom", -1))
	$BottomNext.pressed.connect(func(): _cycle("bottom", 1))

	# SHOES
	$FeetPrev.pressed.connect(func(): _cycle("feet", -1))
	$FeetNext.pressed.connect(func(): _cycle("feet", 1))

	# RANDOM OUTFIT
	$RandomButton.pressed.connect(_randomize_outfit)

	# CLOSE CUSTOMIZER
	$CreateCharacterButton.pressed.connect(_close_customizer)

	update_character()


func load_player_appearance() -> void:
	if player == null:
		return

	body_index = player.body_index
	skin_index = player.skin_index
	hair_style_index = player.hair_style_index
	hair_color_index = player.hair_color_index

	top_index = player.top_index
	bottom_index = player.bottom_index
	feet_index = player.feet_index

	name_edit.text = CharacterSettings.character_name


func _on_name_changed(new_name: String) -> void:
	CharacterSettings.character_name = new_name


func _wrap(value: int, count: int) -> int:
	return (value % count + count) % count


# CHANGE CLOTHES AND UPDATE THE REAL PLAYER IMMEDIATELY
func _cycle(field: String, delta: int) -> void:

	match field:
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

	update_character()
	update_real_player()


# UPDATE THE PREVIEW
func update_character() -> void:

	var d: int = direction_index

	body_sprite.texture = CharacterData.body_textures[body_index][skin_index][d]

	top_sprite.texture = CharacterData.top_textures[body_index][top_index][d]

	bottom_sprite.texture = CharacterData.bottom_textures[body_index][bottom_index][d]

	feet_sprite.texture = CharacterData.feet_textures[body_index][feet_index][d]

	hair_sprite.texture = CharacterData.hair_textures[hair_style_index][hair_color_index][d]


# UPDATE THE PLAYER IN THE ROOM
func update_real_player() -> void:

	if player == null:
		return

	player.top_index = top_index
	player.bottom_index = bottom_index
	player.feet_index = feet_index

	# Keep the player's current facing direction.
	player.update_sprites()


# RANDOM CLOTHES ONLY
func _randomize_outfit() -> void:

	top_index = randi() % CharacterData.CLOTHING_COUNT
	bottom_index = randi() % CharacterData.CLOTHING_COUNT
	feet_index = randi() % CharacterData.CLOTHING_COUNT

	update_character()
	update_real_player()


# ROTATE PREVIEW
func _on_rotate_button_pressed() -> void:
	auto_rotate = not auto_rotate


func _process(delta: float) -> void:

	if not auto_rotate and direction_index == FRONT_DIRECTION:
		return

	rotate_timer += delta

	if rotate_timer >= rotate_interval:

		rotate_timer = 0.0
		direction_index = (direction_index + 1) % 4

		update_character()


# CLOSE WITHOUT LEAVING THE ROOM
func _close_customizer() -> void:
	hide()
