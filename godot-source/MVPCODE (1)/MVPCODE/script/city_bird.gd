class_name CityBird
extends Node2D

@export var fly_speed: float = 90.0
@export var chirp_interval: float = 3.0

var _wing_left: Polygon2D
var _wing_right: Polygon2D
var _body: Polygon2D
var _chirp_left := 1.5
var _flap := 0.0
var _min_x := -4000.0
var _max_x := 4000.0


func _ready() -> void:
	_body = _ellipse(9.0, 4.0, Color("#20242b"))
	add_child(_body)
	_wing_left = Polygon2D.new()
	_wing_left.polygon = PackedVector2Array([Vector2.ZERO, Vector2(-16.0, -9.0), Vector2(-13.0, 4.0)])
	_wing_left.color = Color("#2b3038")
	add_child(_wing_left)
	_wing_right = Polygon2D.new()
	_wing_right.polygon = PackedVector2Array([Vector2.ZERO, Vector2(16.0, -9.0), Vector2(13.0, 4.0)])
	_wing_right.color = Color("#2b3038")
	add_child(_wing_right)
	_chirp_left = randf_range(0.8, chirp_interval)


func configure(p_min_x: float, p_max_x: float, p_speed: float, p_scale: float) -> void:
	_min_x = p_min_x
	_max_x = p_max_x
	fly_speed = p_speed
	scale = Vector2(p_scale, p_scale)


func _process(delta: float) -> void:
	global_position.x += fly_speed * delta
	if global_position.x > _max_x:
		global_position.x = _min_x
	_flap += delta * 9.0
	var lift: float = sin(_flap) * 7.0
	_wing_left.rotation = deg_to_rad(-22.0 + lift)
	_wing_right.rotation = deg_to_rad(22.0 - lift)
	_body.position.y = sin(_flap * 0.5) * 2.0
	_chirp_left -= delta
	if _chirp_left <= 0.0:
		_chirp_left = randf_range(chirp_interval * 0.6, chirp_interval * 1.5)
		CityAudio.play_chirp(self)


func _ellipse(radius_x: float, radius_y: float, color: Color) -> Polygon2D:
	var polygon := Polygon2D.new()
	var points := PackedVector2Array()
	for i in 16:
		var angle := TAU * float(i) / 16.0
		points.append(Vector2(cos(angle) * radius_x, sin(angle) * radius_y))
	polygon.polygon = points
	polygon.color = color
	return polygon
