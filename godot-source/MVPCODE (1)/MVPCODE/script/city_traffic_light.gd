class_name CityTrafficLight
extends Node2D

@export var axis: int = 0
@export var intersection_id: String = ""
@export var facing: int = 0

var _state := ""
var _lamps: Dictionary = {}
var _light: PointLight2D
var _controller: CityTrafficController


func _ready() -> void:
	_controller = get_tree().get_first_node_in_group("traffic_controller") as CityTrafficController
	var visual := Node2D.new()
	visual.name = "Visual"
	visual.rotation = _facing_rotation()
	add_child(visual)

	var pole := Polygon2D.new()
	pole.position = Vector2(0.0, 20.0)
	pole.polygon = _rect(-3.0, -22.0, 6.0, 52.0)
	pole.color = Color("#2c313a")
	visual.add_child(pole)

	var box := Polygon2D.new()
	box.position = Vector2(0.0, -10.0)
	box.polygon = _rect(-12.0, -28.0, 24.0, 56.0)
	box.color = Color("#181c23")
	visual.add_child(box)

	_lamps["red"] = _add_lamp(visual, Vector2(0.0, -27.0), Color("#ff5555"))
	_lamps["yellow"] = _add_lamp(visual, Vector2(0.0, -10.0), Color("#ffd45c"))
	_lamps["green"] = _add_lamp(visual, Vector2(0.0, 7.0), Color("#5bff92"))

	_light = PointLight2D.new()
	_light.texture = _glow_texture()
	_light.texture_scale = 1.35
	_light.energy = 1.2
	_light.position = Vector2(0.0, -10.0)
	add_child(_light)

	_update_state(true)


func _process(_delta: float) -> void:
	if _controller == null or not is_instance_valid(_controller):
		_controller = get_tree().get_first_node_in_group("traffic_controller") as CityTrafficController
	_update_state(false)


func set_configuration(p_intersection_id: String, p_axis: int, p_facing: int) -> void:
	intersection_id = p_intersection_id
	axis = clampi(p_axis, 0, 1)
	facing = wrapi(p_facing, 0, 4)
	if is_node_ready():
		var visual := get_node_or_null("Visual") as Node2D
		if visual != null:
			visual.rotation = _facing_rotation()


func _facing_rotation() -> float:
	return 0.0


func _add_lamp(parent: Node2D, position: Vector2, color: Color) -> Polygon2D:
	var glow := _circle(12.0, Color(color.r, color.g, color.b, 0.18))
	glow.position = position
	parent.add_child(glow)

	var ring := _circle(8.0, Color("#0f1218"))
	ring.position = position
	parent.add_child(ring)

	var lamp := _circle(5.5, Color("#303640"))
	lamp.position = position
	parent.add_child(lamp)
	return lamp


func _circle(radius: float, color: Color) -> Polygon2D:
	var polygon := Polygon2D.new()
	var points := PackedVector2Array()
	for i in 16:
		var angle := TAU * float(i) / 16.0
		points.append(Vector2(cos(angle), sin(angle)) * radius)
	polygon.polygon = points
	polygon.color = color
	return polygon


func _rect(x: float, y: float, width: float, height: float) -> PackedVector2Array:
	return PackedVector2Array([
		Vector2(x, y),
		Vector2(x + width, y),
		Vector2(x + width, y + height),
		Vector2(x, y + height),
	])


func _glow_texture() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.set_color(0, Color.WHITE)
	gradient.set_color(1, Color(1.0, 1.0, 1.0, 0.0))
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	texture.width = 64
	texture.height = 64
	return texture


func _update_state(force: bool) -> void:
	var next_state: String = _controller.state_for_axis(axis) if _controller != null else "red"
	if next_state == _state and not force:
		return
	_state = next_state

	var colors := {
		"red": Color("#ff5555"),
		"yellow": Color("#ffd45c"),
		"green": Color("#5bff92"),
	}
	for lamp_state in _lamps.keys():
		var lamp: Polygon2D = _lamps[lamp_state]
		lamp.color = colors[lamp_state] if lamp_state == _state else Color("#303640")

	var active: Color = colors[_state]
	_light.color = active
	_light.position = Vector2(0.0, -27.0) if _state == "red" else Vector2(0.0, 7.0) if _state == "green" else Vector2(0.0, -10.0)
