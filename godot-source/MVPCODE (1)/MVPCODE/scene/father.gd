
extends Node2D

signal sneezed

enum State { IDLE, WALK, BUSY }

@export_group("Movement")
@export var walk_speed := 55.0
@export var acceleration := 220.0
@export var min_walk_distance := 40.0
@export var max_walk_distance := 160.0
@export var walk_bounds := Rect2()

@export_group("Walls")
@export_flags_2d_physics var wall_mask := 1
@export var foot_radius := 6.0
@export var wall_margin := 6.0

@export_group("Behaviour")
@export var min_idle_time := 1.5
@export var max_idle_time := 5.0
@export_range(0.0, 1.0) var sneeze_chance := 0.15
@export_range(0.0, 1.0) var look_chance := 0.20
@export_range(0.0, 1.0) var stretch_chance := 0.08

@export_group("Sprite")
@export var auto_feet_pivot := true

var can_move: bool = true

var sprite: AnimatedSprite2D
var state := State.IDLE
var facing := "down"
var target := Vector2.ZERO
var current_speed := 0.0
var idle_timer := 2.0

var pose_scale := Vector2.ONE
var pose_rot := 0.0
var pose_offset := Vector2.ZERO
var shake := 0.0

var _base_scale := Vector2.ONE
var _time := 0.0
var _breath_amp := 1.0
var _sprite_h := 32.0
var _shape := CircleShape2D.new()
var _dust: CPUParticles2D


func _ready() -> void:
	randomize()
	sprite = $AnimatedSprite2D
	_base_scale = sprite.scale
	_shape.radius = foot_radius + wall_margin

	var tex := sprite.sprite_frames.get_frame_texture("idle", 0)
	if tex:
		_sprite_h = tex.get_height()

	if auto_feet_pivot:
		sprite.centered = true
		sprite.offset = Vector2(0, -_sprite_h / 2.0)
		sprite.position = Vector2.ZERO

	_build_dust()
	_enter_idle()


# ---------------------------------------------------------------- visuals

func _process(delta: float) -> void:
	_time += delta

	var moving := state == State.WALK
	_breath_amp = move_toward(_breath_amp, 0.0 if moving else 1.0, delta * 3.0)

	var b := sin(_time * 2.2) * _breath_amp
	var breath := Vector2(1.0 - b * 0.008, 1.0 + b * 0.018)
	var sway := sin(_time * 0.9) * 0.012 * _breath_amp

	var jitter := Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake

	sprite.scale = _base_scale * pose_scale * breath
	sprite.rotation = pose_rot + sway
	sprite.position = pose_offset + jitter


func _pose(s: Vector2, r: float, o: Vector2, dur: float,
		trans := Tween.TRANS_SINE) -> Tween:
	var tw := create_tween().set_parallel(true).set_trans(trans).set_ease(Tween.EASE_OUT)
	tw.tween_property(self, "pose_scale", s, dur)
	tw.tween_property(self, "pose_rot", r, dur)
	tw.tween_property(self, "pose_offset", o, dur)
	return tw


func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout


# ---------------------------------------------------------------- logic

func _physics_process(delta: float) -> void:
	if not can_move:
		current_speed = 0.0
		return

	match state:
		State.IDLE:
			idle_timer -= delta
			if idle_timer <= 0.0:
				_choose_action()

		State.WALK:
			_walk_step(delta)


func _choose_action() -> void:
	if not can_move:
		return

	var r := randf()

	if r < sneeze_chance:
		_do_sneeze()
	elif r < sneeze_chance + look_chance:
		_do_look_around()
	elif r < sneeze_chance + look_chance + stretch_chance:
		_do_stretch()
	else:
		_start_walk()


func _enter_idle() -> void:
	state = State.IDLE
	current_speed = 0.0
	sprite.speed_scale = 1.0
	_play_idle()
	idle_timer = randf_range(min_idle_time, max_idle_time)


func _play_idle() -> void:
	sprite.play("idle" if facing == "down" else "idle_" + facing)


func _facing_from(dir: Vector2) -> String:
	if abs(dir.x) > abs(dir.y):
		return "right" if dir.x > 0.0 else "left"
	return "down" if dir.y > 0.0 else "up"


func _facing_vec() -> Vector2:
	match facing:
		"up": return Vector2.UP
		"left": return Vector2.LEFT
		"right": return Vector2.RIGHT
	return Vector2.DOWN


# ---------------------------------------------------------------- walking

func _start_walk() -> void:
	if not can_move:
		return

	var t = _pick_target()

	if t == null:
		_enter_idle()
		return

	target = t
	facing = _facing_from(target - global_position)
	sprite.play("walk_" + facing)
	state = State.WALK


func _pick_target():
	for i in 14:
		var cand: Vector2 = global_position + Vector2.from_angle(randf() * TAU) \
				* randf_range(min_walk_distance, max_walk_distance)

		if _path_clear(global_position, cand):
			return cand

	return null


func _path_clear(from: Vector2, to: Vector2) -> bool:
	var dist := from.distance_to(to)
	var steps := int(dist / 6.0) + 1

	for i in range(1, steps + 1):
		var p := from.lerp(to, float(i) / steps)

		if _is_blocked(p) or not _in_bounds(p):
			return false

	return true


func _in_bounds(p: Vector2) -> bool:
	return walk_bounds.size == Vector2.ZERO or walk_bounds.has_point(p)


func _is_blocked(gpos: Vector2) -> bool:
	var q := PhysicsShapeQueryParameters2D.new()
	q.shape = _shape
	q.transform = Transform2D(0.0, gpos)
	q.collision_mask = wall_mask
	q.collide_with_bodies = true

	return not get_world_2d().direct_space_state.intersect_shape(q, 1).is_empty()


func _walk_step(delta: float) -> void:
	if not can_move:
		return

	var to := target - global_position
	var dist := to.length()

	if dist < 2.0:
		_stop_walk()
		return

	var dir := to / dist

	var desired := walk_speed

	if dist < 14.0:
		desired = maxf(walk_speed * dist / 14.0, 12.0)

	current_speed = move_toward(current_speed, desired, acceleration * delta)

	var step: Vector2 = dir * minf(current_speed * delta, dist)
	var next: Vector2 = global_position + step
	var ahead: Vector2 = next + dir * 3.0

	if (_is_blocked(ahead) and not _is_blocked(global_position)) or not _in_bounds(ahead):
		_stop_walk()
		return

	global_position = next
	sprite.speed_scale = clampf(current_speed / walk_speed, 0.3, 1.2)


func _stop_walk() -> void:
	state = State.BUSY
	current_speed = 0.0
	sprite.speed_scale = 1.0
	_play_idle()

	pose_scale = Vector2(1.03, 0.97)

	await _pose(Vector2.ONE, 0.0, Vector2.ZERO, 0.25).finished

	if not can_move:
		return

	_enter_idle()


# ---------------------------------------------------------------- actions

func _do_look_around() -> void:
	state = State.BUSY

	var dirs := ["down", "up", "left", "right"]

	for i in randi_range(2, 3):
		if not can_move:
			return

		dirs.erase(facing)
		facing = dirs[randi() % dirs.size()]
		_play_idle()
		pose_rot = randf_range(-0.05, 0.05)

		_pose(Vector2.ONE, 0.0, Vector2.ZERO, 0.3)
		await _wait(randf_range(0.6, 1.2))

		if not can_move:
			return

	_enter_idle()


func _do_stretch() -> void:
	state = State.BUSY
	_play_idle()

	var back := -1.0 if facing != "left" else 1.0

	await _pose(Vector2(0.96, 1.08), back * 0.05, Vector2(0, -0.5), 0.7).finished
	if not can_move: return

	await _wait(0.6)
	if not can_move: return

	await _pose(Vector2(1.03, 0.96), 0.0, Vector2.ZERO, 0.2).finished
	if not can_move: return

	await _pose(Vector2.ONE, 0.0, Vector2.ZERO, 0.3).finished
	if not can_move: return

	_enter_idle()


func _do_sneeze() -> void:
	state = State.BUSY
	_play_idle()

	var back := -1.0 if facing != "left" else 1.0

	for i in 2:
		if not can_move: return

		await _pose(Vector2(0.98, 1.05 + i * 0.02),
				back * 0.07 * (i + 1),
				Vector2(0, -1.0 - i), 0.35).finished

		if not can_move: return

		await _wait(0.12)
		if not can_move: return

	await _wait(0.1)
	if not can_move: return

	shake = 2.5
	_emit_dust()
	sneezed.emit()

	await _pose(Vector2(1.1, 0.88), -back * 0.2, Vector2(0, 2), 0.06,
			Tween.TRANS_QUAD).finished

	if not can_move: return

	create_tween().tween_property(self, "shake", 0.0, 0.25)

	await _wait(0.15)
	if not can_move: return

	await _pose(Vector2.ONE, 0.0, Vector2.ZERO, 0.5, Tween.TRANS_ELASTIC).finished
	if not can_move: return

	for i in 2:
		await _pose(Vector2(1.0, 1.03), 0.0, Vector2(0, -0.5), 0.1).finished
		if not can_move: return

		await _pose(Vector2.ONE, 0.0, Vector2.ZERO, 0.1).finished
		if not can_move: return

	await _wait(0.4)
	if not can_move: return

	_enter_idle()


# ---------------------------------------------------------------- dust

func _build_dust() -> void:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))

	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.width = 24
	tex.height = 24

	var fade := Gradient.new()
	fade.set_color(0, Color(0.86, 0.80, 0.70, 0.75))
	fade.set_color(1, Color(0.86, 0.80, 0.70, 0.0))

	var grow := Curve.new()
	grow.add_point(Vector2(0, 0.6))
	grow.add_point(Vector2(1, 1.6))

	_dust = CPUParticles2D.new()
	_dust.texture = tex
	_dust.one_shot = true
	_dust.emitting = false
	_dust.amount = 22
	_dust.lifetime = 0.8
	_dust.explosiveness = 0.95
	_dust.spread = 40.0
	_dust.initial_velocity_min = 35.0
	_dust.initial_velocity_max = 80.0
	_dust.damping_min = 40.0
	_dust.damping_max = 70.0
	_dust.gravity = Vector2(0, -12)
	_dust.scale_amount_min = 0.4
	_dust.scale_amount_max = 1.0
	_dust.scale_amount_curve = grow
	_dust.color_ramp = fade
	_dust.z_index = 2

	add_child(_dust)


func _emit_dust() -> void:
	var f := _facing_vec()
	_dust.position = Vector2(0, -_sprite_h * 0.7) + f * 6.0
	_dust.direction = f
	_dust.restart()
	_dust.emitting = true
