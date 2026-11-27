class_name CityVehicleBase
extends CharacterBody2D

const SPRITE_FORWARD_ANGLE := PI / 2.0
const QUERY_LAYER := 3

static var _paint_texture_cache: Dictionary = {}

@export var vehicle_id: String = ""
@export var max_speed: float = 180.0
@export var reverse_speed: float = 70.0
@export var acceleration: float = 120.0
@export var braking_strength: float = 240.0
@export var engine_brake: float = 60.0
@export var steer_rate: float = 1.1
@export var max_steer_angle: float = 0.55
@export var steer_response: float = 6.0
@export var wheelbase: float = 84.0
@export var min_turn_radius: float = 64.0
@export var collision_damage_scale: float = 1.0
@export var allows_npc_entry: bool = false
@export var restore_position: bool = false
@export var body_color: Color = Color.WHITE
@export var paint_color: Color = Color.WHITE
@export var engine_audio_enabled: bool = false
@export var engine_volume_db: float = -22.0
@export var headlight_enabled: bool = false

var heading: float = -PI / 2.0
var forward_speed: float = 0.0
var steering_angle: float = 0.0
var damage: float = 0.0
var parked: bool = false
var occupant: Node = null
var occupants: Dictionary = {}
var reservations: Dictionary = {}

var _sprite: Sprite2D
var _collision_shape: CollisionShape2D
var _damage_mark: Polygon2D
var _sprite_base_position: Vector2 = Vector2.ZERO
var _impact_cooldown: float = 0.0
var _impact_shake: float = 0.0
var _stall_left: float = 0.0
var _pedestrian_shape: CircleShape2D
var _pedestrian_query: PhysicsShapeQueryParameters2D
var _brake_lights: Array[Sprite2D] = []
var _head_lights: Array[Sprite2D] = []
var _engine_player: AudioStreamPlayer2D
var brake_light_level: float = 0.0
var _hazard_left: float = 0.0
var _light_texture_cache: GradientTexture2D


func _ready() -> void:
	add_to_group("city_vehicle")
	_sprite = get_node_or_null("Sprite2D") as Sprite2D
	_collision_shape = get_node_or_null("CollisionShape2D") as CollisionShape2D
	if _sprite != null:
		_sprite_base_position = _sprite.position
		_create_damage_mark()
		_setup_lights()
	_pedestrian_shape = CircleShape2D.new()
	_pedestrian_shape.radius = 36.0
	_pedestrian_query = PhysicsShapeQueryParameters2D.new()
	_pedestrian_query.shape = _pedestrian_shape
	_pedestrian_query.collision_mask = QUERY_LAYER
	_pedestrian_query.collide_with_bodies = false
	_pedestrian_query.collide_with_areas = true
	if engine_audio_enabled:
		_engine_player = CityAudio.create_player(self, CityAudio.engine_stream(), engine_volume_db)
		_engine_player.name = "EnginePlayer"
		_engine_player.play()
	if CityConfig.DEBUG:
		queue_redraw()
	apply_visual(0.0)


func configure_vehicle(
	p_id: String,
	p_max_speed: float,
	p_acceleration: float,
	p_braking: float,
	p_steer_rate: float,
	p_restore_position: bool = false
) -> void:
	vehicle_id = p_id
	max_speed = maxf(p_max_speed, 1.0)
	acceleration = maxf(p_acceleration, 1.0)
	braking_strength = maxf(p_braking, 1.0)
	steer_rate = maxf(p_steer_rate, 0.1)
	restore_position = p_restore_position
	restore_state()


func set_body_color(p_color: Color) -> void:
	body_color = p_color
	apply_visual(0.0)


func set_paint_color(p_color: Color) -> void:
	paint_color = p_color


static func painted_car_texture(path: String, row: int, col: int, paint: Color) -> Texture2D:
	var source := load(path) as Texture2D
	if source == null:
		return null
	var image := source.get_image()
	if image == null:
		return null
	if image.is_compressed():
		image.decompress()
	var image_width: int = image.get_width()
	var image_height: int = image.get_height()
	var x: int = clampi(col * 64, 0, maxi(0, image_width - 1))
	var y: int = clampi(row * 64, 0, maxi(0, image_height - 1))
	var width: int = mini(64, image_width - x)
	var height: int = mini(64, image_height - y)
	if width <= 0 or height <= 0:
		return null
	var region := Rect2i(x, y, width, height)
	if absf(paint.r - 1.0) < 0.01 and absf(paint.g - 1.0) < 0.01 and absf(paint.b - 1.0) < 0.01:
		var atlas := AtlasTexture.new()
		atlas.atlas = source
		atlas.region = Rect2(region)
		return atlas
	var key := "%s|%d|%d|%s" % [path, row, col, paint.to_html(false)]
	if _paint_texture_cache.has(key):
		return _paint_texture_cache[key]
	var cell := image.get_region(region)
	for py in height:
		for px in width:
			var color := cell.get_pixel(px, py)
			if color.a < 0.5:
				continue
			if color.r >= 0.35 and color.r > color.g * 1.5 and color.r > color.b * 1.25:
				var lum := maxf(color.r, maxf(color.g, color.b))
				cell.set_pixel(px, py, Color(paint.r * lum * 1.15, paint.g * lum * 1.15, paint.b * lum * 1.15, color.a))
	var texture := ImageTexture.create_from_image(cell)
	_paint_texture_cache[key] = texture
	return texture


func drive(delta: float, throttle: float, steer_input: float, speed_limit: float, allow_reverse: bool = false) -> void:
	if _stall_left > 0.0:
		_stall_left = maxf(0.0, _stall_left - delta)
		throttle = 0.0
		speed_limit = 0.0

	var limit := clampf(speed_limit, -reverse_speed, max_speed)
	var target_speed: float
	if throttle > 0.0:
		target_speed = maxf(limit, 0.0)
	elif throttle < 0.0 and allow_reverse:
		target_speed = -reverse_speed
	else:
		target_speed = 0.0

	var rate: float = engine_brake
	if absf(target_speed) > absf(forward_speed) + 0.5:
		rate = acceleration if throttle > 0.0 else engine_brake
	elif throttle < 0.0 or target_speed == 0.0:
		rate = braking_strength
	if absf(target_speed) < 0.5 and absf(forward_speed) < 0.5:
		forward_speed = 0.0
	else:
		forward_speed = move_toward(forward_speed, target_speed, rate * delta)

	var braking: float = 1.0 if throttle < 0.0 or (target_speed < forward_speed - 12.0 and forward_speed > 20.0) else 0.0
	brake_light_level = move_toward(brake_light_level, braking, delta * 5.0)
	_update_engine_audio()
	var speed_ratio: float = clampf(absf(forward_speed) / maxf(max_speed, 1.0), 0.0, 1.0)
	var steer_limit: float = max_steer_angle * (1.0 - 0.35 * speed_ratio)
	var steer_target: float = clampf(steer_input, -1.0, 1.0) * steer_limit
	if forward_speed < -1.0:
		steer_target = -steer_target
	steering_angle = move_toward(steering_angle, steer_target, steer_response * delta)

	if absf(forward_speed) > 0.5:
		var yaw: float = forward_speed / wheelbase * tan(steering_angle)
		var yaw_cap: float = absf(forward_speed) / min_turn_radius
		yaw = clampf(yaw, -yaw_cap, yaw_cap)
		heading = wrapf(heading + yaw * delta, -PI, PI)

	var slip: float = atan(tan(steering_angle) * 0.45)
	var motion_angle: float = heading + slip
	var pre_move_velocity: Vector2 = Vector2.RIGHT.rotated(motion_angle) * forward_speed
	velocity = pre_move_velocity
	move_and_slide()
	_process_collisions(delta, pre_move_velocity)
	apply_visual(delta)


func set_heading(p_direction: Vector2) -> void:
	if p_direction.length() > 0.01:
		heading = p_direction.angle()
	apply_visual(0.0)


func set_heading_angle(p_angle: float) -> void:
	heading = wrapf(p_angle, -PI, PI)
	apply_visual(0.0)


func get_heading_vector() -> Vector2:
	return Vector2.RIGHT.rotated(heading)


func apply_visual(delta: float) -> void:
	if _sprite == null:
		return
	if delta > 0.0:
		_hazard_left = maxf(0.0, _hazard_left - delta)
	var visual_rotation: float = _visual_rotation()
	_sprite.rotation = visual_rotation
	if _collision_shape != null:
		_collision_shape.rotation = visual_rotation

	if _impact_shake > 0.0:
		_impact_shake = maxf(0.0, _impact_shake - delta)
		var amount: float = _impact_shake * 7.0
		_sprite.position = _sprite_base_position + Vector2(randf_range(-amount, amount), randf_range(-amount, amount))
	else:
		_sprite.position = _sprite_base_position

	var dull: float = damage * 0.16
	_sprite.modulate = Color(
		body_color.r * (1.0 - dull),
		body_color.g * (1.0 - dull * 0.7),
		body_color.b * (1.0 - dull * 0.6),
		body_color.a
	)
	if _damage_mark != null:
		_damage_mark.color = Color(0.06, 0.06, 0.07, clampf(damage * 0.5, 0.0, 0.55))
	var brake: float = clampf(brake_light_level, 0.0, 1.0)
	var hazard: float = _hazard_brightness()
	for light in _brake_lights:
		var strength: float = maxf(brake, hazard)
		light.modulate = Color(1.0, 0.12 + 0.12 * strength, 0.12 + 0.08 * strength, 0.16 + 0.74 * strength)
	for light in _head_lights:
		light.modulate = Color(1.0, 0.93, 0.72, 0.22 + 0.28 * hazard)


func set_hazard(seconds: float) -> void:
	_hazard_left = maxf(_hazard_left, seconds)


func _hazard_brightness() -> float:
	if _hazard_left <= 0.0:
		return 0.0
	return 1.0 if fmod(Time.get_ticks_msec() / 1000.0, 0.56) < 0.28 else 0.0


func _draw() -> void:
	if not CityConfig.DEBUG or _collision_shape == null or _collision_shape.shape == null:
		return
	var shape: Shape2D = _collision_shape.shape
	if shape is RectangleShape2D:
		var size: Vector2 = (shape as RectangleShape2D).size
		draw_rect(Rect2(-size * 0.5, size), Color(1.0, 0.2, 0.2, 0.6), false, 1.0)
	elif shape is CircleShape2D:
		draw_circle(Vector2.ZERO, (shape as CircleShape2D).radius, Color(1.0, 0.2, 0.2, 0.4))


func register_impact(impact_speed: float) -> void:
	if _impact_cooldown > 0.0 or impact_speed < 24.0:
		return
	var strength: float = clampf(impact_speed / maxf(max_speed, 1.0), 0.0, 1.0)
	if strength < 0.08:
		return
	damage = clampf(damage + 0.16 * strength * collision_damage_scale, 0.0, 1.0)
	forward_speed *= 1.0 - clampf(0.45 * strength, 0.0, 0.75)
	if strength > 0.35:
		_stall_left = 0.15 + 0.25 * strength
	_impact_shake = 0.18 + 0.3 * strength
	_impact_cooldown = 0.28
	CityAudio.play_impact(self, strength)
	for value in occupants.values():
		var node: Node = value
		if is_instance_valid(node) and node.has_method("handle_vehicle_impact"):
			node.call("handle_vehicle_impact", self, strength)
	persist_state()


func is_seat_available(seat: int) -> bool:
	return not occupants.has(seat) and not reservations.has(seat)


func reserve_seat(seat: int, node: Node) -> bool:
	if not is_seat_available(seat):
		return false
	reservations[seat] = node
	return true


func clear_reservation(seat: int, node: Node) -> void:
	if reservations.get(seat) == node:
		reservations.erase(seat)


func set_occupant(seat: int, node: Node) -> void:
	occupants[seat] = node
	occupant = node
	clear_reservation(seat, node)
	persist_state()


func clear_occupant(seat: int, node: Node) -> void:
	if occupants.get(seat) == node:
		occupants.erase(seat)
	if occupant == node:
		occupant = null
		for value in occupants.values():
			occupant = value
			break
	persist_state()


func get_door_position(seat: int) -> Vector2:
	var side: float = -1.0 if seat == 0 else 1.0
	var local := Vector2(side * 42.0, 0.0)
	return global_position + local.rotated(_visual_rotation())


func get_door_approach(seat: int) -> Vector2:
	var side: float = -1.0 if seat == 0 else 1.0
	var outward: Vector2 = Vector2(side, 0.0).rotated(_visual_rotation())
	return get_door_position(seat) + outward * 34.0


func is_exit_safe(seat: int, ignore: Node = null) -> bool:
	var circle := CircleShape2D.new()
	circle.radius = 18.0
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = circle
	query.transform = Transform2D(0.0, get_door_approach(seat))
	query.collision_mask = QUERY_LAYER
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var exclude: Array[RID] = [get_rid()]
	if ignore is CollisionObject2D:
		exclude.append((ignore as CollisionObject2D).get_rid())
	query.exclude = exclude
	return get_world_2d().direct_space_state.intersect_shape(query, 8).is_empty()


func restore_state() -> void:
	if vehicle_id.is_empty():
		return
	var state: Variant = CharacterSettings.city_vehicle_states.get(vehicle_id, null)
	if not (state is Dictionary):
		return
	var stored: Dictionary = state as Dictionary
	damage = clampf(float(stored.get("damage", damage)), 0.0, 1.0)
	if stored.has("heading"):
		heading = wrapf(float(stored.get("heading", heading)), -PI, PI)
	if restore_position and stored.has("position") and stored.get("position") is Vector2:
		global_position = stored.get("position") as Vector2
	apply_visual(0.0)


func persist_state() -> void:
	if vehicle_id.is_empty():
		return
	var occupant_ids: Dictionary = {}
	for seat in occupants.keys():
		var node: Node = occupants[seat]
		if is_instance_valid(node) and node.has_method("get_npc_id"):
			occupant_ids[str(seat)] = node.call("get_npc_id")
	CharacterSettings.city_vehicle_states[vehicle_id] = {
		"damage": damage,
		"heading": heading,
		"position": global_position,
		"parked": parked,
		"occupants": occupant_ids,
	}


func _update_engine_audio() -> void:
	if _engine_player == null:
		return
	var ratio: float = clampf(absf(forward_speed) / maxf(max_speed, 1.0), 0.0, 1.0)
	_engine_player.pitch_scale = 0.75 + 0.5 * ratio
	_engine_player.volume_db = engine_volume_db + 5.0 * ratio


func _setup_lights() -> void:
	if _sprite == null:
		return
	var texture := _light_texture()
	var rear_left := _glow_sprite(Vector2(-16.0, -25.0), Color("#ff4040"), Vector2(0.8, 0.55), texture)
	var rear_right := _glow_sprite(Vector2(16.0, -25.0), Color("#ff4040"), Vector2(0.8, 0.55), texture)
	var front_left := _glow_sprite(Vector2(-16.0, 25.0), Color("#fff2c0"), Vector2(0.75, 0.55), texture)
	var front_right := _glow_sprite(Vector2(16.0, 25.0), Color("#fff2c0"), Vector2(0.75, 0.55), texture)
	_sprite.add_child(rear_left)
	_sprite.add_child(rear_right)
	_sprite.add_child(front_left)
	_sprite.add_child(front_right)
	_brake_lights = [rear_left, rear_right]
	_head_lights = [front_left, front_right]
	if headlight_enabled:
		var beam := _glow_sprite(Vector2(0.0, 34.0), Color("#fff1c4"), Vector2(3.0, 2.1), texture)
		beam.name = "HeadBeam"
		beam.z_index = -1
		_sprite.add_child(beam)


func _glow_sprite(position: Vector2, color: Color, scale_value: Vector2, texture: Texture2D) -> Sprite2D:
	var glow := Sprite2D.new()
	glow.position = position
	glow.scale = scale_value
	glow.texture = texture
	glow.centered = true
	glow.modulate = Color(color.r, color.g, color.b, 0.16)
	glow.z_index = 2
	var material := CanvasItemMaterial.new()
	material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow.material = material
	return glow


func _light_texture() -> GradientTexture2D:
	if _light_texture_cache != null:
		return _light_texture_cache
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
	_light_texture_cache = texture
	return texture


func _visual_rotation() -> float:
	return wrapf(heading - SPRITE_FORWARD_ANGLE, -PI, PI)


func _create_damage_mark() -> void:
	if _sprite == null or _sprite.get_node_or_null("DamageMark") != null:
		return
	_damage_mark = Polygon2D.new()
	_damage_mark.name = "DamageMark"
	_damage_mark.polygon = PackedVector2Array([
		Vector2(-13.0, -27.0),
		Vector2(4.0, -29.0),
		Vector2(10.0, -19.0),
		Vector2(-8.0, -17.0),
	])
	_damage_mark.color = Color(0.06, 0.06, 0.07, 0.0)
	_damage_mark.z_index = 1
	_sprite.add_child(_damage_mark)


func _process_collisions(delta: float, pre_move_velocity: Vector2) -> void:
	_impact_cooldown = maxf(0.0, _impact_cooldown - delta)
	for i in get_slide_collision_count():
		var collision := get_slide_collision(i)
		var collider: Object = collision.get_collider()
		var normal: Vector2 = collision.get_normal()
		var impact: float = absf(pre_move_velocity.dot(normal))
		if collider is CityVehicleBase:
			if self is PlayerCar and collider != self and collider.has_method("begin_player_hit") and impact > 24.0:
				collider.call("begin_player_hit", impact, self)
			continue
		register_impact(impact)

	if not (self is PlayerCar) or absf(forward_speed) < 18.0 or _pedestrian_query == null:
		return
	if _collision_shape != null and _collision_shape.shape != null:
		_pedestrian_query.shape = _collision_shape.shape
	else:
		_pedestrian_query.shape = _pedestrian_shape
	_pedestrian_query.transform = _collision_shape.global_transform if _collision_shape != null else global_transform
	var exclude: Array[RID] = [get_rid()]
	_pedestrian_query.exclude = exclude
	var results: Array[Dictionary] = get_world_2d().direct_space_state.intersect_shape(_pedestrian_query, 8)
	var hit_someone := false
	for result in results:
		var collider: Object = result.get("collider")
		if not (collider is Node) or collider == occupant or not collider.has_method("try_knockdown"):
			continue
		if collider.has_method("can_be_hit_by_car") and not bool(collider.call("can_be_hit_by_car")):
			continue
		var strength: float = clampf(absf(forward_speed) / maxf(max_speed, 1.0), 0.12, 1.0)
		collider.call("try_knockdown", pre_move_velocity.normalized(), strength, self)
		hit_someone = true
	if hit_someone:
		register_impact(absf(forward_speed) * 0.6)
