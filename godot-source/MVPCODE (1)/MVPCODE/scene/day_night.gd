
extends Node2D

@export var day_duration: float = 1200.0
@export var starting_hour: float = 8.0

@export var clock_margin_right: float = 25.0
@export var clock_margin_top: float = 20.0

@onready var clock_label: Label = $ClockLabel
@onready var canvas_modulate: CanvasModulate = $"../CanvasModulate"

var game_time: float
var camera: Camera2D


func _ready():
	game_time = starting_hour
	camera = get_viewport().get_camera_2d()

	clock_label.add_theme_font_size_override("font_size", 14)
	clock_label.add_theme_color_override("font_color", Color.WHITE)
	clock_label.add_theme_color_override("font_shadow_color", Color.BLACK)
	clock_label.add_theme_constant_override("shadow_offset_x", 2)
	clock_label.add_theme_constant_override("shadow_offset_y", 2)

	clock_label.z_index = 100
	clock_label.size = Vector2(90, 25)

	update_day_night()


func _process(delta):
	game_time += (24.0 / day_duration) * delta
	game_time = fmod(game_time, 24.0)

	# Get the active camera
	if not is_instance_valid(camera):
		camera = get_viewport().get_camera_2d()

	# Keep clock at the camera's upper-right corner
	if is_instance_valid(camera):
		var viewport_size = get_viewport_rect().size
		var zoom = camera.zoom

		var visible_size = viewport_size / zoom
		var camera_position = camera.get_screen_center_position()

		clock_label.global_position = Vector2(
			camera_position.x + visible_size.x / 2.0 - clock_margin_right - clock_label.size.x,
			camera_position.y - visible_size.y / 2.0 + clock_margin_top
		)

	update_day_night()


func update_day_night():
	clock_label.text = get_clock_text()

	var target_color: Color

	if game_time < 5.0:
		target_color = Color("#29334f")
	elif game_time < 7.0:
		target_color = Color("#29334f").lerp(
			Color("#f5b98c"), (game_time - 5.0) / 2.0
		)
	elif game_time < 9.0:
		target_color = Color("#f5b98c").lerp(
			Color.WHITE, (game_time - 7.0) / 2.0
		)
	elif game_time < 16.0:
		target_color = Color.WHITE
	elif game_time < 19.0:
		target_color = Color.WHITE.lerp(
			Color("#e99b70"), (game_time - 16.0) / 3.0
		)
	elif game_time < 21.0:
		target_color = Color("#e99b70").lerp(
			Color("#29334f"), (game_time - 19.0) / 2.0
		)
	else:
		target_color = Color("#29334f")

	canvas_modulate.color = canvas_modulate.color.lerp(
		target_color,
		1.0 - exp(-0.5 * get_process_delta_time())
	)


func get_clock_text() -> String:
	var hours = int(game_time)
	var minutes = int((game_time - hours) * 60.0)

	return "%02d:%02d" % [hours, minutes]
