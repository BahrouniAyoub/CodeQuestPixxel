class_name PlayerCar
extends CityVehicleBase

@export var player_path: NodePath
@export var exit_marker: NodePath
@export var atlas_row: int = 0
@export var atlas_col: int = 0

var driving := false
var player_nearby := false

var _player: CharacterBody2D
var _player_camera: Camera2D
var _camera: Camera2D
var _prompt_layer: CanvasLayer
var _prompt_panel: PanelContainer
var _prompt_label: Label
var _message_left := 0.0
var _saved_layer := 0
var _saved_mask := 0
var _persist_timer := 0.0


func _ready() -> void:
	super._ready()
	_resolve_player()
	_camera = get_node_or_null("Camera2D") as Camera2D
	_sprite = get_node_or_null("Sprite2D") as Sprite2D
	_setup_visual()
	_build_prompt()
	if _player != null:
		_player_camera = _player.get_node_or_null("Camera2D") as Camera2D
	var interaction := get_node_or_null("Interaction") as Area2D
	if interaction != null:
		interaction.body_entered.connect(_on_body_entered)
		interaction.body_exited.connect(_on_body_exited)
	if _camera != null:
		_camera.enabled = false


func configure_player(
	p_player_path: NodePath,
	p_exit_marker: NodePath,
	p_vehicle_id: String,
	p_max_speed: float,
	p_acceleration: float,
	p_braking: float,
	p_steer_rate: float
) -> void:
	player_path = p_player_path
	exit_marker = p_exit_marker
	configure_vehicle(p_vehicle_id, p_max_speed, p_acceleration, p_braking, p_steer_rate, true)
	engine_brake = maxf(engine_brake, p_acceleration * 0.65)
	steer_response = 7.0
	max_steer_angle = 0.48
	min_turn_radius = 78.0
	if is_node_ready():
		_sprite = get_node_or_null("Sprite2D") as Sprite2D
		_setup_visual()
		_resolve_player()


func _setup_visual() -> void:
	if _sprite == null:
		return
	var texture := CityVehicleBase.painted_car_texture("res://assests/city_assets/car-selout-64.png", atlas_row, atlas_col, paint_color)
	if texture == null:
		return
	_sprite.texture = texture
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	apply_visual(0.0)


func _build_prompt() -> void:
	_prompt_layer = CanvasLayer.new()
	_prompt_layer.name = "PromptLayer"
	_prompt_layer.layer = 20
	add_child(_prompt_layer)

	_prompt_panel = PanelContainer.new()
	_prompt_panel.name = "DrivePrompt"
	_prompt_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.09, 0.9)
	style.border_color = Color(0.35, 0.65, 1.0)
	style.set_border_width_all(1)
	style.set_corner_radius_all(1)
	style.set_content_margin_all(2)
	_prompt_panel.add_theme_stylebox_override("panel", style)
	var width: float = float(CityConfig.UI["prompt_width"])
	var height: float = float(CityConfig.UI["prompt_height"])
	_prompt_panel.custom_minimum_size = Vector2(width, height)
	_prompt_panel.size = Vector2(width, height)

	_prompt_label = Label.new()
	_prompt_label.name = "PromptLabel"
	_prompt_label.text = "Press E to Drive · H to Honk"
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_prompt_label.add_theme_font_size_override("font_size", int(CityConfig.UI["prompt_font_size"]))
	_prompt_label.add_theme_color_override("font_color", Color.WHITE)
	_prompt_panel.add_child(_prompt_label)
	_prompt_layer.add_child(_prompt_panel)
	_prompt_panel.hide()


func _show_prompt(text: String) -> void:
	if _prompt_panel == null:
		return
	_prompt_label.text = text
	_update_prompt_position()
	_prompt_panel.show()


func _hide_prompt() -> void:
	if _prompt_panel != null:
		_prompt_panel.hide()


func _update_prompt_position() -> void:
	if _prompt_panel == null:
		return
	var viewport_size: Vector2 = get_viewport_rect().size
	var panel_size: Vector2 = _prompt_panel.size
	_prompt_panel.position = Vector2(
		(viewport_size.x - panel_size.x) * 0.5,
		viewport_size.y * 0.5 + float(CityConfig.UI["prompt_offset_y"])
	)


func _resolve_player() -> void:
	if _player == null:
		_player = get_node_or_null(player_path) as CharacterBody2D


func _process(delta: float) -> void:
	if _prompt_panel != null and _prompt_panel.visible:
		_update_prompt_position()
	if _message_left > 0.0:
		_message_left -= delta
		if _message_left <= 0.0 and player_nearby and not driving:
			_show_prompt("Press E to Drive · H to Honk")


func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = true
		if not driving:
			_show_prompt("Press E to Drive · H to Honk")


func _on_body_exited(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = false
		_hide_prompt()


func action() -> void:
	if driving:
		exit_car()
		return
	if not CharacterSettings.car_permission:
		_show_prompt("Ask Mom for the keys first")
		_message_left = 2.2
		return
	enter_car()


func enter_car() -> void:
	_resolve_player()
	if _player == null:
		return
	driving = true
	_player.set("driving", true)
	_player.set("driven_vehicle", self)
	_player.set("can_move", true)
	_saved_layer = _player.collision_layer
	_saved_mask = _player.collision_mask
	_player.collision_layer = 0
	_player.collision_mask = 0
	_player.visible = false
	if _player_camera != null:
		_player_camera.enabled = false
	if _camera != null:
		_camera.enabled = true
		_camera.make_current()
	_hide_prompt()


func exit_car() -> void:
	driving = false
	CityAudio.stop_horn(self)
	if _player != null:
		_player.global_position = _find_exit_position()
		_player.set("driving", false)
		_player.set("driven_vehicle", null)
		_player.collision_layer = _saved_layer
		_player.collision_mask = _saved_mask
		_player.visible = true
		if _player.has_method("reset_animation"):
			_player.reset_animation()
		if _player_camera != null:
			_player_camera.enabled = true
			_player_camera.make_current()
	if _camera != null:
		_camera.enabled = false
	forward_speed = 0.0
	velocity = Vector2.ZERO
	persist_state()
	if player_nearby:
		_show_prompt("Press E to Drive · H to Honk")


func _find_exit_position() -> Vector2:
	var marker := get_node_or_null(exit_marker) as Node2D
	var fallback: Vector2 = marker.global_position if marker != null else global_position + Vector2(0.0, 90.0)
	var candidates: Array[Vector2] = [
		get_door_approach(1),
		get_door_approach(0),
		fallback,
	]
	for point in candidates:
		if _is_position_safe(point):
			return point
	return fallback


func _is_position_safe(point: Vector2) -> bool:
	var circle := CircleShape2D.new()
	circle.radius = 16.0
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = circle
	query.transform = Transform2D(0.0, point)
	query.collision_mask = 3
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [get_rid()]
	return get_world_2d().direct_space_state.intersect_shape(query, 8).is_empty()


func _physics_process(delta: float) -> void:
	if not driving:
		CityAudio.stop_horn(self)
		drive(delta, -1.0 if forward_speed > 5.0 else 0.0, 0.0, 0.0)
		return

	var throttle: float = 0.0
	if Input.is_action_pressed("ui_up"):
		throttle = 1.0
	elif Input.is_action_pressed("ui_down"):
		throttle = -1.0
	if Input.is_action_just_pressed(&"horn"):
		CityAudio.start_horn(self)
	if Input.is_action_just_released(&"horn"):
		CityAudio.stop_horn(self)
	var steer_input: float = 0.0
	if Input.is_action_pressed("ui_right"):
		steer_input += 1.0
	if Input.is_action_pressed("ui_left"):
		steer_input -= 1.0
	var limit: float = max_speed if throttle >= 0.0 else reverse_speed
	drive(delta, throttle, steer_input, limit, throttle < 0.0)

	_persist_timer += delta
	if _persist_timer >= 0.5:
		_persist_timer = 0.0
		persist_state()
