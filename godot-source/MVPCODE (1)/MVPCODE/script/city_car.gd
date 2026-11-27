class_name CityCar
extends CityVehicleBase

enum State { DRIVING, HIT, STOPPED, NPC_EXITING, NPC_REACTING, NPC_RETURNING, NPC_ENTERING }

const VEHICLE_LAYER := 2

var graph: CityLaneGraph
var controller: CityTrafficController

@export var segment_id: String = ""
@export var requires_driver: bool = false
@export var texture_path: String = ""
@export var atlas_row: int = 0
@export var atlas_col: int = 0
@export var follow_gap: float = 480.0

var state: State = State.DRIVING
var state_time: float = 0.0
var progress: float = 0.0
var next_segment_id: String = ""
var turn_points: PackedVector2Array = PackedVector2Array()
var turn_progress: float = 0.0
var turn_length: float = 0.0
var node_key: String = ""
var hit_cooldown: float = 0.0
var horn_cooldown: float = 0.0
var slow_time: float = 0.0
var deadlock_time: float = 0.0
var blocked_time: float = 0.0
var hit_driver: CityNpc = null
var driver_requested: bool = false
var turn_count: int = 0
var last_limit: float = 0.0
var last_signal_limit: float = 0.0
var last_lead_limit: float = 0.0
var last_ped_limit: float = 0.0

var _probe_shape: CircleShape2D
var _probe_query: PhysicsShapeQueryParameters2D
var _npc_probe_shape: CircleShape2D
var _npc_probe_query: PhysicsShapeQueryParameters2D


func _ready() -> void:
	super._ready()
	_sprite = get_node_or_null("Sprite2D") as Sprite2D
	_setup_visual()
	_configure_queries()
	if parked:
		apply_visual(0.0)
	else:
		if graph != null and not segment_id.is_empty():
			global_position = graph.point_on_segment(segment_id, progress)
		var segment: Dictionary = graph.get_segment(segment_id) if graph != null else {}
		var facing: Vector2 = graph.direction_on_segment(segment_id) if not segment.is_empty() else Vector2.RIGHT
		heading = facing.angle()
		apply_visual(0.0)


func configure_lane(
	p_id: String,
	p_graph: CityLaneGraph,
	p_controller: CityTrafficController,
	p_segment_id: String,
	p_progress: float,
	p_speed: float,
	p_acceleration: float,
	p_braking: float,
	p_color: Color,
	p_texture_path: String,
	p_requires_driver: bool,
	p_atlas_row: int,
	p_atlas_col: int
) -> void:
	graph = p_graph
	controller = p_controller
	segment_id = p_segment_id
	progress = maxf(0.0, p_progress)
	requires_driver = p_requires_driver
	parked = false
	allows_npc_entry = false
	texture_path = p_texture_path
	atlas_row = clampi(p_atlas_row, 0, 7)
	atlas_col = clampi(p_atlas_col, 0, 3)
	follow_gap = float(CityConfig.CARS["follow_distance"])
	state = State.DRIVING
	state_time = 0.0
	blocked_time = 0.0
	next_segment_id = ""
	turn_points = PackedVector2Array()
	turn_progress = 0.0
	turn_length = 0.0
	node_key = ""
	configure_vehicle(p_id, p_speed, p_acceleration, p_braking, maxf(p_speed * 0.014, 1.2))
	paint_color = p_color
	body_color = Color.WHITE
	if graph != null and graph.get_segment(segment_id).has("length"):
		progress = clampf(progress, 0.0, float(graph.get_segment(segment_id)["length"]) - 4.0)
		global_position = graph.point_on_segment(segment_id, progress)
	if is_node_ready():
		apply_visual(0.0)


func configure_parked(
	p_id: String,
	p_position: Vector2,
	p_heading: float,
	p_color: Color,
	p_texture_path: String,
	p_atlas_row: int = 0,
	p_atlas_col: int = 0
) -> void:
	parked = true
	allows_npc_entry = true
	requires_driver = false
	texture_path = p_texture_path
	atlas_row = clampi(p_atlas_row, 0, 7)
	atlas_col = clampi(p_atlas_col, 0, 3)
	configure_vehicle(p_id, 90.0, 120.0, 220.0, 1.0)
	paint_color = p_color
	body_color = Color.WHITE
	global_position = p_position
	heading = wrapf(p_heading, -PI, PI)
	if is_node_ready():
		setup_parked_visual()


func setup_parked_visual() -> void:
	_sprite = get_node_or_null("Sprite2D") as Sprite2D
	_setup_visual()
	apply_visual(0.0)


func _configure_queries() -> void:
	_probe_shape = CircleShape2D.new()
	_probe_shape.radius = float(CityConfig.CARS["follow_distance"])
	_probe_query = PhysicsShapeQueryParameters2D.new()
	_probe_query.shape = _probe_shape
	_probe_query.collision_mask = VEHICLE_LAYER
	_probe_query.collide_with_bodies = true
	_probe_query.collide_with_areas = false
	_npc_probe_shape = CircleShape2D.new()
	_npc_probe_shape.radius = 260.0
	_npc_probe_query = PhysicsShapeQueryParameters2D.new()
	_npc_probe_query.shape = _npc_probe_shape
	_npc_probe_query.collision_mask = 1
	_npc_probe_query.collide_with_bodies = false
	_npc_probe_query.collide_with_areas = true


func _setup_visual() -> void:
	if _sprite == null:
		return
	var path: String = texture_path if not texture_path.is_empty() else "res://assests/city_assets/car-selout-64.png"
	var texture: Texture2D
	if path.contains("police"):
		var source := load(path) as Texture2D
		if source == null:
			return
		var atlas := AtlasTexture.new()
		atlas.atlas = source
		atlas.region = Rect2(float(atlas_col) * 64.0, float(atlas_row) * 64.0, 64.0, 64.0)
		texture = atlas
	else:
		texture = CityVehicleBase.painted_car_texture(path, atlas_row, atlas_col, paint_color)
	if texture == null:
		return
	_sprite.texture = texture
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST


func _physics_process(delta: float) -> void:
	hit_cooldown = maxf(0.0, hit_cooldown - delta)
	horn_cooldown = maxf(0.0, horn_cooldown - delta)
	if parked:
		forward_speed = move_toward(forward_speed, 0.0, braking_strength * delta)
		velocity = Vector2.ZERO
		apply_visual(delta)
		return

	match state:
		State.DRIVING:
			_drive(delta)
		State.HIT:
			forward_speed = move_toward(forward_speed, 0.0, braking_strength * 1.4 * delta)
			velocity = Vector2.RIGHT.rotated(heading) * forward_speed
			move_and_slide()
			_process_collisions(delta, velocity)
			if forward_speed < 5.0:
				state = State.STOPPED
				state_time = 0.0
				if hit_driver != null and hit_driver.has_method("exit_for_hit"):
					hit_driver.call("exit_for_hit")
		State.STOPPED:
			forward_speed = 0.0
			velocity = Vector2.ZERO
			state_time += delta
			if state_time > 0.5:
				state = State.NPC_EXITING
				state_time = 0.0
		State.NPC_EXITING:
			forward_speed = 0.0
			velocity = Vector2.ZERO
			if hit_driver == null or hit_driver.state == CityNpc.State.WALKING:
				if hit_driver != null and hit_driver.has_method("react_to_hit"):
					hit_driver.call("react_to_hit", 3.0)
				state = State.NPC_REACTING
				state_time = 0.0
		State.NPC_REACTING:
			forward_speed = 0.0
			velocity = Vector2.ZERO
			state_time += delta
			if state_time > 3.0:
				if hit_driver != null and hit_driver.has_method("schedule_vehicle_use"):
					hit_driver.call("schedule_vehicle_use", self, 0.0)
					state = State.NPC_RETURNING
				else:
					_resume_after_hit()
				state_time = 0.0
		State.NPC_RETURNING:
			forward_speed = 0.0
			velocity = Vector2.ZERO
			state_time += delta
			if occupant == hit_driver or (hit_driver != null and hit_driver.state == CityNpc.State.PASSENGER):
				state = State.NPC_ENTERING
				state_time = 0.0
			elif state_time > 9.0:
				_resume_after_hit()
		State.NPC_ENTERING:
			forward_speed = 0.0
			velocity = Vector2.ZERO
			state_time += delta
			if state_time > 0.6:
				_resume_after_hit()
	apply_visual(delta)


func begin_player_hit(impact: float, _source: Node) -> void:
	if hit_cooldown > 0.0 or state != State.DRIVING or parked:
		return
	var strength: float = clampf(impact / maxf(max_speed, 1.0), 0.12, 1.0)
	damage = clampf(damage + 0.3 * strength, 0.0, 1.0)
	forward_speed *= 0.45
	set_hazard(float(CityConfig.CARS["hit_cooldown"]))
	hit_driver = occupant if occupant is CityNpc else null
	state = State.HIT
	state_time = 0.0
	hit_cooldown = float(CityConfig.CARS["hit_cooldown"])
	_release_reservation()
	CityAudio.play_impact(self, strength)
	persist_state()


func _resume_after_hit() -> void:
	state = State.DRIVING
	state_time = 0.0
	deadlock_time = 0.0
	blocked_time = 0.0
	forward_speed = 0.0
	hit_driver = null
	_release_reservation()


func _drive(delta: float) -> void:
	if requires_driver and occupant == null:
		forward_speed = move_toward(forward_speed, 0.0, braking_strength * delta)
		velocity = Vector2.ZERO
		return

	_update_route()
	var limit: float = _speed_limit()
	var difference: float = limit - forward_speed
	var rate: float = acceleration if difference > 0.0 else braking_strength
	forward_speed = clampf(move_toward(forward_speed, limit, rate * delta), 0.0, max_speed)
	var braking: float = 1.0 if difference < -8.0 and forward_speed > 10.0 else 0.0
	brake_light_level = move_toward(brake_light_level, braking, delta * 5.0)
	_update_engine_audio()

	if limit < max_speed * 0.3:
		slow_time += delta
	else:
		slow_time = maxf(0.0, slow_time - delta * 2.0)
	if slow_time > 2.0 and horn_cooldown <= 0.0 and occupant != null and randf() < 0.01 * delta * 60.0:
		CityAudio.play_horn(self)
		horn_cooldown = float(CityConfig.AUDIO["horn_cooldown"])

	if forward_speed < 8.0 and limit < 8.0:
		deadlock_time += delta
	else:
		deadlock_time = maxf(0.0, deadlock_time - delta * 2.0)
	if deadlock_time > float(CityConfig.CARS["deadlock_seconds"]):
		deadlock_time = 0.0
		_release_reservation()
		turn_points = PackedVector2Array()
		turn_progress = 0.0
		turn_length = 0.0
		next_segment_id = ""
		node_key = ""

	_move_along_path(delta)


func _update_route() -> void:
	if graph == null or turn_points.size() > 1:
		return
	var segment: Dictionary = graph.get_segment(segment_id)
	if segment.is_empty():
		return
	var remaining: float = float(segment["length"]) - progress
	var end_key: String = String(segment["end_node"])
	if not _is_intersection(end_key) or remaining > float(CityConfig.CARS["intersection_lookahead"]):
		return
	if next_segment_id.is_empty():
		next_segment_id = graph.choose_next(segment_id)
	if next_segment_id.is_empty():
		return
	if controller == null or controller.has_entry(end_key, self):
		return
	if controller.can_pass(int(segment["axis"])) and remaining < 320.0:
		controller.request_entry(end_key, int(segment["axis"]), self)


func _speed_limit() -> float:
	last_signal_limit = _signal_speed_limit()
	last_lead_limit = _lead_speed_limit()
	last_ped_limit = _pedestrian_speed_limit()
	var turn_limit: float = float(CityConfig.CARS["turn_speed"]) if turn_points.size() > 1 else max_speed
	last_limit = clampf(minf(minf(minf(last_signal_limit, last_lead_limit), last_ped_limit), turn_limit), 0.0, max_speed)
	return last_limit


func _signal_speed_limit() -> float:
	if graph == null or controller == null or turn_points.size() > 1:
		return max_speed
	var segment: Dictionary = graph.get_segment(segment_id)
	if segment.is_empty():
		return max_speed
	var end_key: String = String(segment["end_node"])
	if not _is_intersection(end_key):
		return max_speed
	var remaining: float = float(segment["length"]) - progress - float(CityConfig.TRAFFIC["stop_margin"])
	if remaining > float(CityConfig.CARS["intersection_lookahead"]):
		return max_speed
	var axis: int = int(segment["axis"])
	if controller.has_entry(end_key, self):
		if controller.can_pass(axis) or remaining < 70.0:
			return max_speed
		return _braking_limit(maxf(remaining, 0.0))
	if not controller.can_pass(axis):
		return _braking_limit(remaining)
	if next_segment_id.is_empty() or remaining > 320.0:
		return max_speed
	return _braking_limit(remaining)


func _braking_limit(distance: float) -> float:
	var usable: float = maxf(0.0, distance - 22.0)
	return clampf(sqrt(2.0 * braking_strength * usable), 0.0, max_speed)


func _lead_speed_limit() -> float:
	if _probe_query == null or get_world_2d() == null:
		return max_speed
	var center: Vector2 = global_position
	var forward: Vector2 = _current_direction()
	_probe_query.transform = Transform2D(0.0, center)
	_probe_query.exclude = [get_rid()]
	var results: Array[Dictionary] = get_world_2d().direct_space_state.intersect_shape(_probe_query, 24)
	var limit: float = max_speed
	for result in results:
		var collider: Object = result.get("collider")
		if not (collider is CityVehicleBase) or collider == self:
			continue
		var other := collider as CityVehicleBase
		var other_forward := Vector2.RIGHT.rotated(other.heading)
		if other_forward.dot(forward) < 0.5:
			continue
		var offset: Vector2 = other.global_position - center
		var ahead: float = offset.dot(forward)
		var lateral: float = absf(offset.cross(forward))
		if ahead <= 0.0 or ahead >= follow_gap or lateral > float(CityConfig.CARS["lane_tolerance"]):
			continue
		var other_speed: float = maxf(other.forward_speed, 0.0)
		var desired: float = other_speed + clampf((ahead - float(CityConfig.CARS["safe_follow"])) * 0.9, -400.0, 180.0)
		if ahead < float(CityConfig.CARS["minimum_gap"]):
			desired = 0.0
		limit = minf(limit, clampf(desired, 0.0, max_speed))
	return limit


func _pedestrian_speed_limit() -> float:
	if _npc_probe_query == null or get_world_2d() == null:
		return max_speed
	var center: Vector2 = global_position
	var forward: Vector2 = _current_direction()
	_npc_probe_query.transform = Transform2D(0.0, center)
	var results: Array[Dictionary] = get_world_2d().direct_space_state.intersect_shape(_npc_probe_query, 16)
	var limit: float = max_speed
	for result in results:
		var collider: Object = result.get("collider")
		if not (collider is Node) or collider == occupant or not collider.has_method("can_be_hit_by_car"):
			continue
		if not bool(collider.call("can_be_hit_by_car")):
			continue
		var node := collider as Node2D
		var offset: Vector2 = node.global_position - center
		var ahead: float = offset.dot(forward)
		var lateral: float = absf(offset.cross(forward))
		if ahead <= 0.0 or ahead >= 260.0 or lateral > 58.0:
			continue
		limit = minf(limit, clampf((ahead - 52.0) * 0.8, 0.0, max_speed))
	return limit


func _move_along_path(delta: float) -> void:
	if graph == null:
		return
	var before: Vector2 = global_position
	var desired: Vector2
	var facing: Vector2
	var length: float = 0.0
	if turn_points.size() > 1:
		turn_progress += forward_speed * delta
		desired = graph.point_on_polyline(turn_points, turn_progress)
		facing = graph.tangent_on_polyline(turn_points, turn_progress)
	else:
		var segment: Dictionary = graph.get_segment(segment_id)
		if segment.is_empty():
			return
		length = float(segment["length"])
		progress += forward_speed * delta
		desired = graph.point_on_segment(segment_id, progress)
		facing = graph.direction_on_segment(segment_id)
	heading = wrapf(lerp_angle(heading, facing.angle(), clampf(float(CityConfig.CARS["turn_rate"]) * delta, 0.0, 1.0)), -PI, PI)
	velocity = (desired - before) / maxf(delta, 0.001)
	move_and_slide()
	_process_collisions(delta, velocity)
	var traveled: float = global_position.distance_to(before)
	var expected: float = forward_speed * delta
	if forward_speed > float(CityConfig.CARS["blocked_min_speed"]) and traveled < expected * float(CityConfig.CARS["blocked_ratio"]):
		blocked_time += delta
	else:
		blocked_time = maxf(0.0, blocked_time - delta * 2.0)
	if blocked_time > float(CityConfig.CARS["blocked_seconds"]):
		_respawn_near_camera()
		return
	var shortfall: float = desired.distance_to(global_position)
	if turn_points.size() > 1:
		turn_progress = maxf(0.0, turn_progress - shortfall)
		if turn_progress >= turn_length:
			_finish_turn()
	else:
		progress = clampf(progress - shortfall, 0.0, length)
		if progress >= length - 1.0:
			_arrive_at_end()


func _arrive_at_end() -> void:
	if graph == null:
		return
	var segment: Dictionary = graph.get_segment(segment_id)
	if segment.is_empty():
		return
	node_key = String(segment["end_node"])
	if next_segment_id.is_empty():
		next_segment_id = graph.choose_next(segment_id)
	if next_segment_id.is_empty() or not graph.get_segment(next_segment_id).has("length"):
		_respawn_near_camera()
		return
	var curve: PackedVector2Array = graph.turn_curve(segment_id, next_segment_id)
	if curve.size() < 2:
		_finish_turn()
		return
	turn_points = curve
	turn_length = graph.polyline_length(curve)
	turn_progress = 0.0


func _finish_turn() -> void:
	turn_count += 1
	_release_reservation()
	if graph != null and graph.get_segment(next_segment_id).has("length"):
		segment_id = next_segment_id
		progress = 0.0
		global_position = graph.point_on_segment(segment_id, 0.0)
		heading = graph.direction_on_segment(segment_id).angle()
	else:
		_respawn_near_camera()
	next_segment_id = ""
	turn_points = PackedVector2Array()
	turn_progress = 0.0
	turn_length = 0.0
	node_key = ""


func _release_reservation() -> void:
	if controller != null and not node_key.is_empty():
		controller.release_entry(node_key, self)


func _respawn_near_camera() -> void:
	_release_reservation()
	if graph == null:
		return
	var center: Vector2 = global_position
	var camera := get_viewport().get_camera_2d()
	if is_instance_valid(camera):
		center = camera.get_screen_center_position()
	var spawn_radius: float = float(CityConfig.CARS["spawn_radius"])
	var despawn_radius: float = float(CityConfig.CARS["despawn_radius"])
	var id: String = graph.random_segment_near(center, spawn_radius, despawn_radius)
	if id.is_empty():
		id = graph.random_segment_near(center, 0.0, despawn_radius)
	if id.is_empty():
		return
	segment_id = id
	progress = 0.0
	next_segment_id = ""
	turn_points = PackedVector2Array()
	turn_progress = 0.0
	turn_length = 0.0
	node_key = ""
	global_position = graph.point_on_segment(segment_id, 0.0)
	heading = graph.direction_on_segment(segment_id).angle()
	forward_speed = 0.0
	deadlock_time = 0.0
	blocked_time = 0.0


func _current_direction() -> Vector2:
	if turn_points.size() > 1:
		return graph.tangent_on_polyline(turn_points, turn_progress) if graph != null else Vector2.RIGHT.rotated(heading)
	if graph != null and graph.get_segment(segment_id).has("length"):
		return graph.direction_on_segment(segment_id)
	return Vector2.RIGHT.rotated(heading)


func _is_intersection(key: String) -> bool:
	return key.contains("_v")


func debug_info() -> Dictionary:
	var segment: Dictionary = graph.get_segment(segment_id) if graph != null else {}
	var axis: int = int(segment.get("axis", -1))
	var remaining: float = float(segment.get("length", 0.0)) - progress - float(CityConfig.TRAFFIC["stop_margin"])
	var contacts: Array[String] = []
	for i in get_slide_collision_count():
		var collision := get_slide_collision(i)
		var collider: Object = collision.get_collider()
		contacts.append(collider.name if collider is Node else "unknown")
	return {
		"id": vehicle_id,
		"state": State.keys()[state],
		"segment": segment_id,
		"progress": progress,
		"speed": forward_speed,
		"next": next_segment_id,
		"turning": turn_points.size() > 1,
		"occupant": occupant != null,
		"limit": last_limit,
		"signal_limit": last_signal_limit,
		"lead_limit": last_lead_limit,
		"ped_limit": last_ped_limit,
		"node_key": node_key,
		"turns": turn_count,
		"axis": axis,
		"remaining": remaining,
		"can_pass": controller != null and axis >= 0 and controller.can_pass(axis),
		"has_entry": controller != null and not node_key.is_empty() and controller.has_entry(node_key, self),
		"contacts": contacts,
		"position": global_position,
	}
