extends Node2D

enum State { IDLE, WALK, BUSY }

@export_group("Movement")
@export var walk_speed := 48.0
@export var acceleration := 180.0
@export var min_walk_distance := 40.0
@export var max_walk_distance := 150.0
## Optional global-space floor rectangle. Leave size at 0 to disable.
@export var walk_bounds := Rect2()
@export_range(0.0, 1.0) var spot_chance := 0.35
var can_move: bool = true
@export_group("Walls")
@export_flags_2d_physics var wall_mask := 1
@export var foot_radius := 6.0
@export var wall_margin := 6.0

@export_group("Behaviour")
@export var min_idle_time := 1.0
@export var max_idle_time := 3.5
@export_range(0.0, 1.0) var hum_chance := 0.20
@export_range(0.0, 1.0) var tidy_chance := 0.15
@export_range(0.0, 1.0) var hair_chance := 0.10
@export_range(0.0, 1.0) var sigh_chance := 0.10
@export_range(0.0, 1.0) var tap_chance := 0.08
@export_range(0.0, 1.0) var look_chance := 0.12

@export_group("Sprite")
@export var auto_feet_pivot := true

var sprite: AnimatedSprite2D
var state := State.IDLE
var facing := "down"
var path: Array[Vector2] = []
var current_speed := 0.0
var idle_timer := 1.5
var pending_action := ""

# procedural pose (tweened by actions)
var pose_scale := Vector2.ONE
var pose_rot := 0.0
var pose_offset := Vector2.ZERO

var _base_scale := Vector2.ONE
var _time := 0.0
var _breath_amp := 1.0
var _sprite_h := 32.0
var _shape := CircleShape2D.new()
var _puff: CPUParticles2D
var _puff_tex: Texture2D
var _note_tex: Texture2D


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

	_puff_tex = _make_puff_texture()
	_note_tex = _make_note_texture()
	_build_puff()
	_enter_idle()


# ---------------------------------------------------------------- visuals
func _process(delta: float) -> void:
	_time += delta
	var moving := state == State.WALK
	_breath_amp = move_toward(_breath_amp, 0.0 if moving else 1.0, delta * 3.0)

	# slower, softer breathing than the father
	var b := sin(_time * 1.8) * _breath_amp
	var breath := Vector2(1.0 - b * 0.006, 1.0 + b * 0.016)
	var sway := sin(_time * 0.7) * 0.008 * _breath_amp

	sprite.scale = _base_scale * pose_scale * breath
	sprite.rotation = pose_rot + sway
	sprite.position = pose_offset


func _pose(s: Vector2, r: float, o: Vector2, dur: float,
		trans := Tween.TRANS_SINE) -> Tween:
	var tw := create_tween().set_parallel(true).set_trans(trans).set_ease(Tween.EASE_OUT)
	tw.tween_property(self, "pose_scale", s, dur)
	tw.tween_property(self, "pose_rot", r, dur)
	tw.tween_property(self, "pose_offset", o, dur)
	return tw


func _reset_pose(dur := 0.3) -> void:
	await _pose(Vector2.ONE, 0.0, Vector2.ZERO, dur).finished


func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout


# ---------------------------------------------------------------- logic
func _physics_process(delta: float) -> void:
	match state:
		State.IDLE:
			idle_timer -= delta
			if idle_timer <= 0.0:
				_choose_action()
		State.WALK:
			_walk_step(delta)


func _choose_action() -> void:
	# sometimes go to a spot in the house
	if randf() < spot_chance and _go_to_random_spot():
		return

	var r := randf()
	var acc := hum_chance
	if r < acc:
		_do_hum(); return
	acc += tidy_chance
	if r < acc:
		_do_tidy(); return
	acc += hair_chance
	if r < acc:
		_do_fix_hair(); return
	acc += sigh_chance
	if r < acc:
		_do_sigh(); return
	acc += tap_chance
	if r < acc:
		_do_foot_tap(); return
	acc += look_chance
	if r < acc:
		_do_look_around(); return
	_start_wander()


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


func _head_pos() -> Vector2:
	return Vector2(0, -_sprite_h * 0.9)


# ---------------------------------------------------------------- walking
func _start_wander() -> void:
	for i in 14:
		var cand: Vector2 = global_position + Vector2.from_angle(randf() * TAU) \
				* randf_range(min_walk_distance, max_walk_distance)
		var p := _make_path(cand)
		if not p.is_empty():
			_begin_path(p)
			return
	_enter_idle()


func _go_to_random_spot() -> bool:
	var spots := get_tree().get_nodes_in_group("mother_spot")
	if spots.is_empty():
		return false
	spots.shuffle()
	for s in spots:
		var spot := s as Node2D
		if spot == null or spot.global_position.distance_to(global_position) < 12.0:
			continue
		var p := _make_path(spot.global_position)
		if p.is_empty():
			continue
		pending_action = str(spot.get_meta("action", "tidy"))
		var f := str(spot.get_meta("face", ""))
		if f != "":
			facing = f   # applied when she arrives
		_begin_path(p, f)
		return true
	return false


## Builds an L-shaped route (horizontal then vertical, or the opposite).
func _make_path(dest: Vector2) -> Array[Vector2]:
	var options: Array = []
	var a := Vector2(dest.x, global_position.y)
	var b := Vector2(global_position.x, dest.y)
	options.append([a, dest])
	options.append([b, dest])
	options.shuffle()
	for o in options:
		var corner: Vector2 = o[0]
		if _path_clear(global_position, corner) and _path_clear(corner, dest):
			var res: Array[Vector2] = []
			if corner.distance_to(global_position) > 2.0:
				res.append(corner)
			res.append(dest)
			return res
	return []


var _arrive_face := ""

func _begin_path(p: Array[Vector2], arrive_face := "") -> void:
	path = p
	_arrive_face = arrive_face
	state = State.BUSY
	# small turn pause before walking, like a real person
	var dir := path[0] - global_position
	facing = _facing_from(dir)
	_play_idle()
	await _wait(randf_range(0.1, 0.25))
	sprite.play("walk_" + facing)
	state = State.WALK


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
	if path.is_empty():
		_stop_walk()
		return

	var target: Vector2 = path[0]
	var to := target - global_position
	var dist := to.length()

	if dist < 1.5:
		global_position = target
		path.pop_front()
		if path.is_empty():
			_stop_walk()
		else:
			# corner: turn and keep walking
			facing = _facing_from(path[0] - global_position)
			sprite.play("walk_" + facing)
		return

	var dir := to / dist
	var last_leg := path.size() == 1

	var desired := walk_speed
	if last_leg and dist < 16.0:
		desired = maxf(walk_speed * dist / 16.0, 10.0)
	current_speed = move_toward(current_speed, desired, acceleration * delta)

	var step: Vector2 = dir * minf(current_speed * delta, dist)
	var next: Vector2 = global_position + step
	var ahead: Vector2 = next + dir * 3.0

	if (_is_blocked(ahead) and not _is_blocked(global_position)) or not _in_bounds(ahead):
		path.clear()
		pending_action = ""
		_stop_walk()
		return

	global_position = next
	sprite.speed_scale = clampf(current_speed / walk_speed, 0.3, 1.2)


func _stop_walk() -> void:
	state = State.BUSY
	current_speed = 0.0
	sprite.speed_scale = 1.0
	if _arrive_face != "":
		facing = _arrive_face
	_play_idle()
	pose_scale = Vector2(1.02, 0.98)
	await _reset_pose(0.25)

	if pending_action != "":
		var act := pending_action
		pending_action = ""
		match act:
			"cook": _do_cook()
			"hum": _do_hum()
			_: _do_tidy()
		return
	_enter_idle()


# ---------------------------------------------------------------- actions
func _do_hum() -> void:
	state = State.BUSY
	_play_idle()
	var side := 1.0
	for i in randi_range(4, 7):
		side = -side
		_pose(Vector2(1.0, 1.01), side * 0.04, Vector2(side * 0.6, 0), 0.5)
		if i % 2 == 0:
			_spawn_note()
		await _wait(0.5)
	await _reset_pose(0.4)
	_enter_idle()


func _do_tidy() -> void:
	state = State.BUSY
	_play_idle()
	var lean := 1.0 if facing == "right" else -1.0
	for i in randi_range(2, 4):
		await _pose(Vector2(1.02, 0.9), lean * 0.12, Vector2(0, 1.5), 0.4).finished
		await _wait(0.15)
		# wiping motion
		for j in 2:
			await _pose(Vector2(1.02, 0.9), lean * 0.06, Vector2(lean * 1.2, 1.5), 0.15).finished
			await _pose(Vector2(1.02, 0.9), lean * 0.14, Vector2(-lean * 1.2, 1.5), 0.15).finished
		await _reset_pose(0.35)
		await _wait(0.2)
	_enter_idle()


func _do_cook() -> void:
	state = State.BUSY
	facing = "up"
	_play_idle()
	var side := 1.0
	for i in 10:
		side = -side
		await _pose(Vector2.ONE, side * 0.035, Vector2(side * 0.8, 0), 0.22).finished
		if i == 4:
			# quick glance to the side, then back to the pot
			facing = "left" if randf() < 0.5 else "right"
			_play_idle()
			await _wait(0.6)
			facing = "up"
			_play_idle()
	await _reset_pose(0.3)
	_enter_idle()


func _do_fix_hair() -> void:
	state = State.BUSY
	_play_idle()
	await _pose(Vector2.ONE, 0.1, Vector2(0.8, 0), 0.25).finished
	for i in 2:
		await _pose(Vector2(1.0, 1.01), 0.14, Vector2(1.0, -0.5), 0.12).finished
		await _pose(Vector2.ONE, 0.07, Vector2(0.8, 0), 0.12).finished
	await _wait(0.2)
	await _reset_pose(0.35)
	_enter_idle()


func _do_sigh() -> void:
	state = State.BUSY
	_play_idle()
	# inhale
	await _pose(Vector2(0.99, 1.04), 0.0, Vector2(0, -1.0), 0.7).finished
	await _wait(0.2)
	# exhale with a small breath puff
	_emit_puff()
	await _pose(Vector2(1.02, 0.96), 0.03, Vector2(0, 1.0), 0.8).finished
	await _wait(0.3)
	await _reset_pose(0.5)
	_enter_idle()


func _do_foot_tap() -> void:
	state = State.BUSY
	_play_idle()
	await _pose(Vector2.ONE, 0.0, Vector2.ZERO, 0.2).finished
	for i in randi_range(3, 5):
		await _pose(Vector2(1.0, 0.985), 0.0, Vector2(0, 0.6), 0.1).finished
		await _pose(Vector2.ONE, 0.0, Vector2.ZERO, 0.1).finished
		await _wait(0.12)
	_enter_idle()


func _do_look_around() -> void:
	state = State.BUSY
	var dirs := ["down", "up", "left", "right"]
	for i in randi_range(2, 3):
		dirs.erase(facing)
		facing = dirs[randi() % dirs.size()]
		_play_idle()
		await _wait(randf_range(0.5, 1.0))
	_enter_idle()


# ---------------------------------------------------------------- effects
func _make_puff_texture() -> Texture2D:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.width = 16
	tex.height = 16
	return tex


## Tiny music note drawn in code (round head + stem + flag).
func _make_note_texture() -> Texture2D:
	var img := Image.create(8, 12, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var c := Color(1, 1, 1, 1)
	for x in range(1, 5):
		for y in range(8, 11):
			img.set_pixel(x, y, c)          # head
	for y in range(1, 10):
		img.set_pixel(4, y, c)              # stem
	img.set_pixel(5, 1, c)
	img.set_pixel(6, 2, c)
	img.set_pixel(6, 3, c)                  # flag
	return ImageTexture.create_from_image(img)


func _spawn_note() -> void:
	var n := Sprite2D.new()
	n.texture = _note_tex
	n.modulate = Color(1.0, 0.9, 0.6, 0.0)
	n.position = _head_pos() + Vector2(randf_range(-4, 4), -2)
	n.z_index = 3
	add_child(n)
	var end_pos := n.position + Vector2(randf_range(-10, 10), -22)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(n, "position", end_pos, 1.4).set_trans(Tween.TRANS_SINE)
	tw.tween_property(n, "modulate:a", 1.0, 0.25)
	tw.tween_property(n, "rotation", randf_range(-0.4, 0.4), 1.4)
	tw.chain().tween_property(n, "modulate:a", 0.0, 0.5)
	tw.chain().tween_callback(n.queue_free)


func _build_puff() -> void:
	var fade := Gradient.new()
	fade.set_color(0, Color(1, 1, 1, 0.35))
	fade.set_color(1, Color(1, 1, 1, 0.0))
	var grow := Curve.new()
	grow.add_point(Vector2(0, 0.4))
	grow.add_point(Vector2(1, 1.2))

	_puff = CPUParticles2D.new()
	_puff.texture = _puff_tex
	_puff.one_shot = true
	_puff.emitting = false
	_puff.amount = 6
	_puff.lifetime = 0.9
	_puff.explosiveness = 0.6
	_puff.spread = 25.0
	_puff.initial_velocity_min = 8.0
	_puff.initial_velocity_max = 18.0
	_puff.damping_min = 10.0
	_puff.damping_max = 20.0
	_puff.gravity = Vector2(0, -6)
	_puff.scale_amount_min = 0.3
	_puff.scale_amount_max = 0.6
	_puff.scale_amount_curve = grow
	_puff.color_ramp = fade
	_puff.z_index = 2
	add_child(_puff)


func _emit_puff() -> void:
	var f := Vector2.DOWN
	match facing:
		"up": f = Vector2.UP
		"left": f = Vector2.LEFT
		"right": f = Vector2.RIGHT
	_puff.position = Vector2(0, -_sprite_h * 0.75) + f * 4.0
	_puff.direction = f
	_puff.restart()
	_puff.emitting = true
