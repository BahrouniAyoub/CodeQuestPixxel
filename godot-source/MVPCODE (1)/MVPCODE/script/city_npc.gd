class_name CityNpc
extends Node2D

enum State { WALKING, KNOCKED, RECOVERING, BOARDING_APPROACH, BOARDING_ANIM, PASSENGER, EXITING }

@export var speed: float = 42.0
@export var wait_time: float = 0.8
@export var route: Array[Vector2] = []
@export var scale_value: float = 3.0
@export var fps: float = 8.0
@export var npc_id: String = ""
@export var use_vehicles: bool = true
@export var vehicle_check_radius: float = 220.0
@export var passenger_dwell_time: float = 6.0

var _sprites := {}
var _body_index := 0
var _skin_index := 0
var _top_index := 0
var _bottom_index := 0
var _feet_index := 0
var _hair_style := 0
var _hair_color := 0
var _index := 0
var _wait_left := 0.0
var _frame := -1
var _frame_time := 0.0
var _direction := 0
var state: State = State.WALKING

var _hitbox: Area2D
var _knock_velocity := Vector2.ZERO
var _knock_elapsed := 0.0
var _car_overlap_left := 0.0
var _recover_elapsed := 0.0
var _pose_blend := 0.0
var _pose_sign := 1.0
var _visual_scale := 1.0
var _visual_alpha := 1.0

var vehicle: CityVehicleBase = null
var seat := 1
var _seat_reserved := false
var _vehicle_check_left := 1.5
var _scheduled_vehicle: CityVehicleBase = null
var _scheduled_delay := 0.0
var _passenger_time_left := 0.0
var _vehicle_anim_time := 0.0
var _returning_after_crash := false
var _protected_by_traffic := false
var _defer_vehicle_return := false


func _ready() -> void:
	randomize()
	_roll_look()
	_build_sprites()
	_build_hitbox()
	_start()
	restore_vehicle_state.call_deferred()


func configure(
	p_route: Array[Vector2],
	p_speed: float = 42.0,
	p_wait_time: float = 0.8,
	p_scale: float = 3.0,
	p_id: String = "",
	p_use_vehicles: bool = true,
	p_dwell_time: float = 6.0
) -> void:
	route = p_route
	speed = p_speed
	wait_time = p_wait_time
	scale_value = p_scale
	npc_id = p_id
	use_vehicles = p_use_vehicles
	passenger_dwell_time = p_dwell_time
	if is_node_ready():
		_start()


func get_npc_id() -> String:
	return npc_id


func configure_driver(
	p_vehicle: CityVehicleBase,
	p_seat: int,
	p_id: String,
	p_dwell_time: float = 999999.0
) -> bool:
	if not is_instance_valid(p_vehicle) or not is_node_ready():
		return false
	if state != State.WALKING or vehicle != null:
		return false
	if p_vehicle.occupants.has(p_seat) or p_vehicle.reservations.has(p_seat):
		return false
	route = []
	npc_id = p_id
	use_vehicles = false
	passenger_dwell_time = maxf(p_dwell_time, 999999.0)
	vehicle = p_vehicle
	seat = p_seat
	state = State.PASSENGER
	_passenger_time_left = maxf(1.0, passenger_dwell_time)
	visible = false
	_set_hitbox_enabled(false)
	p_vehicle.set_occupant(p_seat, self)
	persist_npc_state()
	return true


func handle_vehicle_impact(p_vehicle: CityVehicleBase, strength: float) -> void:
	if state != State.PASSENGER or vehicle != p_vehicle:
		return
	if _returning_after_crash:
		return

	var damaged_vehicle := vehicle
	var exit_point: Vector2 = damaged_vehicle.get_door_approach(seat)
	var away: Vector2 = exit_point - damaged_vehicle.global_position
	if away.length() < 1.0:
		away = Vector2.RIGHT.rotated(randf_range(-PI, PI))
	damaged_vehicle.clear_occupant(seat, self)
	vehicle = null
	_seat_reserved = false

	global_position = exit_point
	visible = true
	_set_hitbox_enabled(true)
	_protected_by_traffic = true
	_visual_alpha = 1.0
	_visual_scale = 1.0
	_pose_sign = -1.0 if away.x < 0.0 else 1.0
	_frame = -1

	if p_vehicle is PlayerCar:
		state = State.KNOCKED
		_knock_velocity = away.normalized() * (130.0 + 210.0 * clampf(strength, 0.0, 1.0))
		_knock_elapsed = 0.0
		_car_overlap_left = 0.6
		_pose_blend = 1.0
		_scheduled_vehicle = damaged_vehicle
		_scheduled_delay = 3.0
		_returning_after_crash = true
	else:
		state = State.EXITING
		_vehicle_anim_time = 0.0
		_visual_alpha = 0.0
		_visual_scale = 0.5
		_pose_blend = 0.0
		_scheduled_vehicle = damaged_vehicle
		_scheduled_delay = float(CityConfig.NPC["reboard_delay"])
		_defer_vehicle_return = false
		_returning_after_crash = false

	_apply_textures()
	_apply_pose()
	persist_npc_state()


func get_hitbox_rid() -> RID:
	return _hitbox.get_rid() if _hitbox != null else RID()


func can_be_hit_by_car() -> bool:
	return state == State.WALKING and not _protected_by_traffic


func exit_for_hit() -> void:
	if state != State.PASSENGER or vehicle == null:
		return
	var damaged_vehicle: CityVehicleBase = vehicle
	var exit_point: Vector2 = damaged_vehicle.get_door_approach(seat)
	damaged_vehicle.clear_occupant(seat, self)
	vehicle = null
	_seat_reserved = false
	global_position = exit_point
	visible = true
	_set_hitbox_enabled(true)
	state = State.EXITING
	_vehicle_anim_time = 0.0
	_visual_alpha = 0.0
	_visual_scale = 0.5
	_pose_blend = 0.0
	_pose_sign = -1.0 if damaged_vehicle.global_position.x > exit_point.x else 1.0
	_protected_by_traffic = true
	_defer_vehicle_return = true
	_scheduled_vehicle = null
	_scheduled_delay = 0.0
	_apply_textures()
	_apply_pose()


func react_to_hit(seconds: float) -> void:
	if state != State.WALKING:
		return
	_wait_left = maxf(_wait_left, seconds)
	_pose_blend = 0.0
	_pose_sign = -_pose_sign if _pose_sign != 0.0 else 1.0
	_protected_by_traffic = true
	_frame = -1
	_apply_textures()
	_apply_pose()


func prepare_for_vehicle_removal() -> void:
	if is_instance_valid(vehicle):
		if _seat_reserved:
			vehicle.clear_reservation(seat, self)
		if vehicle.occupants.get(seat, null) == self:
			vehicle.clear_occupant(seat, self)
	vehicle = null
	_seat_reserved = false
	_scheduled_vehicle = null
	_scheduled_delay = 0.0
	_returning_after_crash = false
	_protected_by_traffic = false
	state = State.WALKING


func _roll_look() -> void:
	_body_index = randi_range(0, maxi(0, CharacterData.body_textures.size() - 1))
	_skin_index = randi_range(0, maxi(0, CharacterData.body_textures[_body_index].size() - 1)) if CharacterData.body_textures.size() > 0 else 0
	_top_index = randi_range(0, maxi(0, CharacterData.top_textures[_body_index].size() - 1)) if CharacterData.top_textures.size() > 0 else 0
	_bottom_index = randi_range(0, maxi(0, CharacterData.bottom_textures[_body_index].size() - 1)) if CharacterData.bottom_textures.size() > 0 else 0
	_feet_index = randi_range(0, maxi(0, CharacterData.feet_textures[_body_index].size() - 1)) if CharacterData.feet_textures.size() > 0 else 0
	_hair_style = randi_range(0, maxi(0, CharacterData.hair_textures.size() - 1))
	_hair_color = randi_range(0, maxi(0, CharacterData.hair_textures[_hair_style].size() - 1)) if CharacterData.hair_textures.size() > 0 else 0


func _build_sprites() -> void:
	for layer in ["Bottom", "Body", "Feet", "Top", "Hair"]:
		var sprite := Sprite2D.new()
		sprite.name = layer
		sprite.scale = Vector2(scale_value, scale_value)
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.z_index = 2
		add_child(sprite)
		_sprites[layer] = sprite


func _build_hitbox() -> void:
	_hitbox = Area2D.new()
	_hitbox.name = "Hitbox"
	_hitbox.collision_layer = 1
	_hitbox.collision_mask = 0
	var shape := CircleShape2D.new()
	shape.radius = 18.0
	var collision := CollisionShape2D.new()
	collision.shape = shape
	_hitbox.add_child(collision)
	add_child(_hitbox)


func _start() -> void:
	if route.size() > 0:
		global_position = route[0]
		_index = 1 % route.size()
		if route.size() > 1:
			_direction = _direction_from(route[1] - route[0])
	_apply_textures()
	_apply_pose()


func _process(delta: float) -> void:
	if state != State.WALKING and state != State.BOARDING_APPROACH:
		return
	if _wait_left > 0.0 and state == State.WALKING:
		return
	_frame_time += delta
	if _frame_time >= 1.0 / maxf(fps, 0.1):
		_frame_time = 0.0
		if _frame < 0:
			_frame = 0
		else:
			_frame += 1
		_apply_textures()


func _physics_process(delta: float) -> void:
	match state:
		State.KNOCKED:
			_update_knocked(delta)
		State.RECOVERING:
			_update_recovering(delta)
		State.BOARDING_APPROACH:
			_update_boarding_approach(delta)
		State.BOARDING_ANIM:
			_update_boarding_animation(delta)
		State.PASSENGER:
			_update_passenger(delta)
		State.EXITING:
			_update_exiting(delta)
		_:
			_update_walking(delta)


func _update_walking(delta: float) -> void:
	if _scheduled_vehicle != null:
		if _scheduled_delay > 0.0:
			_scheduled_delay -= delta
			if _scheduled_delay > 0.0:
				return
		if not is_instance_valid(_scheduled_vehicle):
			_scheduled_vehicle = null
			_returning_after_crash = false
		else:
			var scheduled := _scheduled_vehicle
			var seat_value := _pick_free_seat(scheduled)
			if seat_value >= 0 and begin_vehicle_entry(scheduled, seat_value):
				_scheduled_vehicle = null
				_returning_after_crash = false
			else:
				_scheduled_delay = 1.0

	_vehicle_check_left -= delta
	if _vehicle_check_left <= 0.0:
		_vehicle_check_left = randf_range(1.2, 2.4)
		_try_find_parked_vehicle()

	if route.size() < 2:
		return
	if _wait_left > 0.0:
		_wait_left -= delta
		if _wait_left <= 0.0:
			_frame = -1
			_apply_textures()
		return

	var target := route[_index]
	var direction := target - global_position
	if direction.length() < 6.0:
		_index = (_index + 1) % route.size()
		_wait_left = wait_time
		_frame = -1
		_apply_textures()
		return

	var step := direction.normalized()
	_direction = _direction_from(step)
	global_position += step * speed * delta


func try_knockdown(direction: Vector2, strength: float, source: Node) -> bool:
	if not (source is PlayerCar):
		return false
	if state == State.KNOCKED:
		_car_overlap_left = maxf(_car_overlap_left, 0.35)
		return false
	if state != State.WALKING:
		return false
	if _protected_by_traffic and source is CityCar:
		return false

	state = State.KNOCKED
	_knock_velocity = direction.normalized() * (110.0 + 220.0 * clampf(strength, 0.0, 1.0))
	_knock_elapsed = 0.0
	_car_overlap_left = 0.4
	_frame = -1
	_pose_sign = -1.0 if (absf(direction.x) > absf(direction.y) and direction.x < 0.0) else 1.0
	_pose_blend = 1.0
	_visual_alpha = 1.0
	_visual_scale = 1.0
	_apply_textures()
	_apply_pose()
	return true


func _update_knocked(delta: float) -> void:
	_knock_elapsed += delta
	_car_overlap_left -= delta
	global_position += _knock_velocity * delta
	_knock_velocity = _knock_velocity.move_toward(Vector2.ZERO, 240.0 * delta)
	_pose_blend = 1.0
	_apply_pose()
	if _knock_elapsed > 1.1 and _car_overlap_left <= 0.0:
		state = State.RECOVERING
		_recover_elapsed = 0.0


func _update_recovering(delta: float) -> void:
	_recover_elapsed += delta
	_pose_blend = 1.0 - clampf(_recover_elapsed / 0.7, 0.0, 1.0)
	_apply_pose()
	if _recover_elapsed < 0.7:
		return
	state = State.WALKING
	_pose_blend = 0.0
	_frame = -1
	_apply_textures()
	_apply_pose()


func schedule_vehicle_use(p_vehicle: CityVehicleBase, p_delay: float) -> void:
	if not is_instance_valid(p_vehicle):
		return
	_scheduled_vehicle = p_vehicle
	_scheduled_delay = maxf(0.0, p_delay)


func begin_vehicle_entry(p_vehicle: CityVehicleBase, p_seat: int) -> bool:
	if state != State.WALKING or vehicle != null or not is_instance_valid(p_vehicle):
		return false
	if not p_vehicle.reserve_seat(p_seat, self):
		return false
	vehicle = p_vehicle
	seat = p_seat
	_seat_reserved = true
	state = State.BOARDING_APPROACH
	_frame = -1
	_apply_textures()
	return true


func _update_boarding_approach(delta: float) -> void:
	if not is_instance_valid(vehicle):
		_cancel_vehicle_use()
		return
	var approach: Vector2 = vehicle.get_door_approach(seat)
	var to_door: Vector2 = approach - global_position
	if to_door.length() > 8.0:
		var step := to_door.normalized()
		var move_speed: float = minf(speed * 0.9, to_door.length() / maxf(delta, 0.001))
		global_position += step * move_speed * delta
		_direction = _direction_from(step)
		return
	_direction = _direction_from(vehicle.global_position - global_position)
	_apply_textures()
	state = State.BOARDING_ANIM
	_vehicle_anim_time = 0.0


func _update_boarding_animation(delta: float) -> void:
	if not is_instance_valid(vehicle):
		_cancel_vehicle_use()
		return
	_vehicle_anim_time += delta
	var t: float = clampf(_vehicle_anim_time / 0.5, 0.0, 1.0)
	_visual_alpha = 1.0 - t
	_visual_scale = 1.0 - 0.5 * t
	_apply_pose()
	if t < 1.0:
		return
	visible = false
	_set_hitbox_enabled(false)
	state = State.PASSENGER
	_seat_reserved = false
	vehicle.set_occupant(seat, self)
	_passenger_time_left = maxf(1.0, passenger_dwell_time)
	persist_npc_state()


func _update_passenger(delta: float) -> void:
	if not is_instance_valid(vehicle):
		_cancel_vehicle_use()
		return
	if _passenger_time_left > 0.0:
		_passenger_time_left -= delta
		return
	var options := [seat, 1 - seat]
	for candidate in options:
		var seat_value: int = int(candidate)
		if seat_value != seat and not vehicle.is_seat_available(seat_value):
			continue
		if not vehicle.is_exit_safe(seat_value, self):
			continue
		seat = seat_value
		global_position = vehicle.get_door_approach(seat)
		_direction = _direction_from(vehicle.global_position - global_position)
		_apply_textures()
		visible = true
		_set_hitbox_enabled(true)
		state = State.EXITING
		_vehicle_anim_time = 0.0
		_visual_alpha = 0.0
		_visual_scale = 0.5
		_pose_blend = 0.0
		_apply_pose()
		return
	_passenger_time_left = 1.0


func _update_exiting(delta: float) -> void:
	if not is_instance_valid(vehicle):
		_cancel_vehicle_use()
		return
	_vehicle_anim_time += delta
	var t: float = clampf(_vehicle_anim_time / 0.5, 0.0, 1.0)
	_visual_alpha = t
	_visual_scale = 0.5 + 0.5 * t
	_apply_pose()
	if t < 1.0:
		return
	vehicle.clear_occupant(seat, self)
	vehicle = null
	_returning_after_crash = false
	state = State.WALKING
	_visual_alpha = 1.0
	_visual_scale = 1.0
	_pose_blend = 0.0
	_frame = -1
	_apply_textures()
	_apply_pose()
	if _defer_vehicle_return:
		_defer_vehicle_return = false
		_scheduled_vehicle = null
		_scheduled_delay = 0.0
		persist_npc_state()
		return
	_protected_by_traffic = false
	persist_npc_state()


func _try_find_parked_vehicle() -> void:
	if state != State.WALKING or vehicle != null or not use_vehicles:
		return
	if randf() > 0.12:
		return
	for node in get_tree().get_nodes_in_group("city_vehicle"):
		if not (node is CityVehicleBase):
			continue
		var candidate := node as CityVehicleBase
		if not candidate.allows_npc_entry:
			continue
		if candidate.global_position.distance_to(global_position) > vehicle_check_radius:
			continue
		var picked := _pick_free_seat(candidate)
		if picked >= 0 and begin_vehicle_entry(candidate, picked):
			return


func _pick_free_seat(p_vehicle: CityVehicleBase) -> int:
	var preferred: int = 1 if global_position.x >= p_vehicle.global_position.x else 0
	var order := [preferred, 1 - preferred]
	for value in order:
		var candidate: int = int(value)
		if p_vehicle.is_seat_available(candidate):
			return candidate
	return -1


func _cancel_vehicle_use() -> void:
	if vehicle != null and _seat_reserved:
		vehicle.clear_reservation(seat, self)
	vehicle = null
	_seat_reserved = false
	_returning_after_crash = false
	state = State.WALKING
	visible = true
	_set_hitbox_enabled(true)
	_visual_alpha = 1.0
	_visual_scale = 1.0
	_pose_blend = 0.0
	_apply_pose()


func restore_vehicle_state() -> void:
	if npc_id.is_empty() or vehicle != null:
		return
	await get_tree().process_frame
	var stored: Variant = CharacterSettings.city_npc_states.get(npc_id, null)
	if not (stored is Dictionary):
		return
	var data: Dictionary = stored as Dictionary
	if String(data.get("state", "")) != "passenger":
		return
	var vehicle_id := String(data.get("vehicle_id", ""))
	var seat_value: int = int(data.get("seat", 1))
	for node in get_tree().get_nodes_in_group("city_vehicle"):
		if not (node is CityVehicleBase):
			continue
		var candidate := node as CityVehicleBase
		if candidate.vehicle_id != vehicle_id:
			continue
		var current: Variant = candidate.occupants.get(seat_value, null)
		if current != null and current != self:
			return
		vehicle = candidate
		seat = clampi(seat_value, 0, 1)
		candidate.set_occupant(seat, self)
		state = State.PASSENGER
		visible = false
		_set_hitbox_enabled(false)
		_passenger_time_left = maxf(1.0, passenger_dwell_time)
		return


func persist_npc_state() -> void:
	if npc_id.is_empty():
		return
	var vehicle_id := vehicle.vehicle_id if vehicle != null else ""
	CharacterSettings.city_npc_states[npc_id] = {
		"state": "passenger" if state == State.PASSENGER else "walking",
		"vehicle_id": vehicle_id,
		"seat": seat,
	}


func _direction_from(direction: Vector2) -> int:
	if absf(direction.x) > absf(direction.y):
		return 1 if direction.x > 0.0 else 3
	return 0 if direction.y > 0.0 else 2


func _apply_textures() -> void:
	if _sprites.is_empty():
		return
	var walking := _frame >= 0
	_sprites["Body"].texture = _pick(CharacterData.walk_body_textures, CharacterData.body_textures, _body_index, _skin_index, _direction, _frame, walking)
	_sprites["Bottom"].texture = _pick(CharacterData.walk_bottom_textures, CharacterData.bottom_textures, _body_index, _bottom_index, _direction, _frame, walking)
	_sprites["Top"].texture = _pick(CharacterData.walk_top_textures, CharacterData.top_textures, _body_index, _top_index, _direction, _frame, walking)
	_sprites["Feet"].texture = _pick(CharacterData.walk_feet_textures, CharacterData.feet_textures, _body_index, _feet_index, _direction, _frame, walking)
	_sprites["Hair"].texture = _pick(CharacterData.walk_hair_textures, CharacterData.hair_textures, _hair_style, _hair_color, _direction, _frame, walking)


func _pick(walk_root: Array, idle_root: Array, a: int, b: int, d: int, frame: int, walking: bool) -> Texture2D:
	if walking:
		var frames: Variant = _cell(walk_root, a, b, d)
		if frames is Array:
			var list := frames as Array
			if not list.is_empty():
				return list[posmod(frame, list.size())] as Texture2D
	var idle: Variant = _cell(idle_root, a, b, d)
	if idle is Texture2D:
		return idle as Texture2D
	return null


func _cell(root: Array, a: int, b: int, d: int) -> Variant:
	if a < 0 or a >= root.size():
		return null
	var first: Array = root[a]
	if b < 0 or b >= first.size():
		return null
	var second: Array = first[b]
	if d < 0 or d >= second.size():
		return null
	return second[d]


func _set_hitbox_enabled(enabled: bool) -> void:
	if _hitbox == null:
		return
	_hitbox.collision_layer = 1 if enabled else 0
	_hitbox.monitoring = enabled
	_hitbox.monitorable = enabled


func _apply_pose() -> void:
	if _sprites.is_empty():
		return
	var grey: float = 1.0 - _pose_blend * 0.25
	for value in _sprites.values():
		var sprite: Sprite2D = value as Sprite2D
		sprite.rotation = _pose_blend * _pose_sign * PI / 2.0
		sprite.scale = Vector2(scale_value, scale_value) * _visual_scale
		sprite.modulate = Color(grey, grey, grey, _visual_alpha)
