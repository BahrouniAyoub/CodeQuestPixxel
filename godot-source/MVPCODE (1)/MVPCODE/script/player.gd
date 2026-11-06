extends CharacterBody2D

# =============================================================================
# MOVEMENT
# =============================================================================
@export_group("Movement")
@export var speed: float = 150.0
@export var run_speed_multiplier: float = 1.6
## Optional. Add an action called "run" in Project Settings > Input Map (e.g. Shift).
@export var run_action: StringName = &"run"
@export var acceleration: float = 1400.0   # how fast he gets up to speed
@export var friction: float = 1800.0       # how fast he slows down

# =============================================================================
# WALKING ANIMATION
# =============================================================================
@export_group("Walking Animation")
@export var walk_bounce: float = 1.8
@export var walk_animation_speed: float = 11.0
@export var walk_sway: float = 0.55
@export var walk_stretch: float = 0.025
@export var step_squash: float = 0.12      # tiny impact every time a foot lands
@export var lean_amount: float = 1.2       # leans into the direction he moves
@export var lean_smoothing: float = 10.0
@export var hair_drag: float = 0.6         # hair lags behind when moving
@export var hair_delay: float = 0.9        # hair bounces slightly after the body
@export_range(0.0, 1.0) var hair_freedom: float = 0.6  # 0 = hair glued to head

@export_group("Run Animation")
@export var run_bounce_boost: float = 0.7  # bigger bounce when running
@export var run_lean_boost: float = 1.2    # leans forward more when running

# =============================================================================
# IDLE ANIMATION
# =============================================================================
@export_group("Idle Animation")
@export var idle_breath_speed: float = 2.0
@export var idle_breath_amount: float = 0.35
@export var idle_stretch: float = 0.008
@export var idle_hair_sway: float = 0.35
@export var idle_body_sway: float = 0.12

# =============================================================================
# IDLE LIFE (random things he does on his own when you stop)
# =============================================================================
@export_group("Idle Life")
## Master switch for everything he does on his own.
@export var idle_fidget_enabled: bool = true
## Seconds of calm between two little "routines".
@export var fidget_min_delay: float = 3.0
@export var fidget_max_delay: float = 7.0
@export var allow_hop: bool = true
@export var allow_look_around: bool = true
## He takes a few small steps by himself now and then.
@export var allow_wander: bool = true

@export_group("Idle Life Details")
@export var sigh_duration: float = 1.5
@export var sigh_strength: float = 1.4
@export var stretch_duration: float = 2.0
@export var stretch_height: float = 0.04
@export var hop_height: float = 6.0
@export var hop_duration: float = 0.42
@export var hop_crouch: float = 0.12
@export var wiggle_height: float = 2.2     # little happy bounces
@export var wiggle_duration: float = 0.9
@export var weight_shift_amount: float = 0.8
@export var wander_speed_multiplier: float = 0.5
@export var wander_min_distance: float = 12.0
@export var wander_max_distance: float = 36.0
## He never wanders farther than this from where you left him.
@export var wander_radius: float = 70.0

# =============================================================================
# SQUASH & STRETCH (springy feel)
# =============================================================================
@export_group("Squash and Stretch")
@export var start_stretch: float = 0.8     # little pop when he starts walking
@export var stop_squash: float = 1.2       # little squash when he stops
@export var turn_pop: float = 0.45         # pop when he changes direction
@export var skid_squash: float = 1.0       # squash when he suddenly reverses
@export var spring_stiffness: float = 220.0
@export var spring_damping: float = 12.0
## His feet position. All layers stretch from this point (adjust to your sprite!).
@export var squash_pivot: Vector2 = Vector2(0.0, 12.0)

# Animation transitions
@export var animation_blend_speed: float = 14.0

# =============================================================================
# DUST
# =============================================================================
@export_group("Dust")
@export var dust_enabled: bool = true
@export var dust_offset: Vector2 = Vector2(0.0, 12.0)  # where his feet are (adjust!)
@export var dust_foot_spread: float = 3.0              # left/right foot distance
@export var dust_per_step: int = 4
@export var dust_start_amount: int = 8
@export var dust_stop_amount: int = 5
@export var dust_skid_amount: int = 10
@export var dust_size: float = 1.2
@export var dust_lifetime: float = 0.55
@export var dust_speed: float = 26.0
@export var dust_color: Color = Color(0.86, 0.80, 0.68, 0.75)
@export var dust_specks_enabled: bool = true   # tiny flying bits of dirt
@export var dust_soft: bool = false            # false = pixel dots, true = soft round puffs

# =============================================================================
# SHADOW (created automatically, turn off if you already have one)
# =============================================================================
@export_group("Shadow")
@export var enable_shadow: bool = true
@export var shadow_offset: Vector2 = Vector2(0.0, 13.0)  # adjust to his feet
@export var shadow_size: Vector2 = Vector2(1.0, 1.0)
@export var shadow_opacity: float = 0.3

# =============================================================================
# SOUNDS
# =============================================================================
@export_group("Footsteps (walking only)")
@export var footsteps_volume: float = -5.0
@export var footsteps_pitch_variation: float = 0.08
## false = a step never cuts the previous one (best for long footstep clips).
## true = every step restarts the sound (best for one-step clips).
@export var footsteps_restart_each_step: bool = false

@export_group("Action Sounds (jump, land, turn)")
## Optional. Leave empty to reuse the footsteps sound as ONE short single hit.
@export var jump_sound: AudioStream
@export var land_sound: AudioStream
@export var turn_sound: AudioStream
@export var action_sound_volume: float = -6.0
## When reusing the footsteps sound, it is cut after this many seconds.
@export var fallback_sound_length: float = 0.22

@onready var body_sprite: Sprite2D = $Body
@onready var bottom_sprite: Sprite2D = $Bottom
@onready var top_sprite: Sprite2D = $Top
@onready var feet_sprite: Sprite2D = $Feet
@onready var hair_sprite: Sprite2D = $Hair
@onready var footsteps: AudioStreamPlayer2D = $Footsteps

# CHARACTER CUSTOMIZATION
var body_index: int = 0
var skin_index: int = 0
var hair_style_index: int = 0
var hair_color_index: int = 0
var top_index: int = 0
var bottom_index: int = 0
var feet_index: int = 0

# 0 = Down, 1 = Right, 2 = Up, 3 = Left
var direction_index: int = 0

# ANIMATION VARIABLES
var walk_time: float = 0.0
var idle_time: float = 0.0
var animation_amount: float = 0.0
var run_blend: float = 0.0

var was_walking: bool = false
var last_step_count: int = 0
var foot_side: float = 1.0
var last_move_direction: Vector2 = Vector2.DOWN
var skid_cooldown: float = 0.0

var move_lean: Vector2 = Vector2.ZERO
var spring_value: float = 0.0
var spring_velocity: float = 0.0

# Idle life: routines (little random sequences)
var routines: Array = []
var routine_queue: Array = []
var routine_active: bool = false
var routine_wait: float = 0.0
var routine_changed_facing: bool = false
var last_routine: int = -1
var fidget_timer: float = 6.0
var saved_direction: int = 0

# Idle life: single fidgets
var sigh_progress: float = 0.0
var stretch_progress: float = 0.0
var shiver_progress: float = 0.0
var hair_flick_progress: float = 0.0
var weight_progress: float = 0.0
var wiggle_progress: float = 0.0
var wiggle_last_bounce: int = 0

# Idle life: hop / twirl
var hop_active: bool = false
var hop_launched: bool = false
var hop_time: float = 0.0
var hop_offset: float = 0.0
var hop_height_now: float = 6.0
var hop_duration_now: float = 0.42
var hop_strength: float = 1.0
var hop_twirl: bool = false
var spin_start: int = 0
var spin_step_sign: int = 1

# Idle life: wander
var wander_active: bool = false
var wander_direction: Vector2 = Vector2.ZERO
var wander_time_left: float = 0.0
var wander_home: Vector2 = Vector2.ZERO

var original_positions: Dictionary = {}
var original_scales: Dictionary = {}

var puff_texture: Texture2D
var speck_texture: Texture2D
var puff_scale_curve: Curve
var puff_color_ramp: Gradient
var puff_initial_ramp: Gradient
var speck_color_ramp: Gradient
var shadow_sprite: Sprite2D

var action_sound: AudioStreamPlayer2D
var action_tween: Tween
var footsteps_tween: Tween


func _ready() -> void:
	body_index = CharacterSettings.body_index
	skin_index = CharacterSettings.skin_index
	hair_style_index = CharacterSettings.hair_style_index
	hair_color_index = CharacterSettings.hair_color_index
	top_index = CharacterSettings.top_index
	bottom_index = CharacterSettings.bottom_index
	feet_index = CharacterSettings.feet_index

	footsteps.volume_db = footsteps_volume

	for sprite: Sprite2D in get_character_sprites():
		original_positions[sprite] = sprite.position
		original_scales[sprite] = sprite.scale

	setup_dust()
	setup_action_sound()
	setup_routines()

	if enable_shadow:
		create_shadow()

	wander_home = global_position
	fidget_timer = randf_range(fidget_min_delay, fidget_max_delay)

	update_sprites()


func _physics_process(delta: float) -> void:
	var real_input: Vector2 = Input.get_vector(
		"ui_left",
		"ui_right",
		"ui_up",
		"ui_down"
	)
	var player_controlled: bool = real_input.length() > 0.1
	var input_direction: Vector2 = real_input

	if player_controlled:
		# You always have control: any key cancels what he was doing on his own
		wander_home = global_position
		if routine_active or wander_active or hop_twirl:
			cancel_autonomy()
	elif wander_active:
		input_direction = wander_direction * wander_speed_multiplier
		wander_time_left -= delta

	# RUN (only if the action exists in the Input Map)
	var wants_run: bool = (
		InputMap.has_action(run_action)
		and Input.is_action_pressed(run_action)
		and player_controlled
	)
	var current_max_speed: float = speed * (run_speed_multiplier if wants_run else 1.0)

	# SKID: suddenly reversing direction while moving fast
	skid_cooldown = maxf(skid_cooldown - delta, 0.0)
	if player_controlled and velocity.length() > speed * 0.6:
		var reversing: bool = velocity.normalized().dot(input_direction.normalized()) < -0.3
		if reversing and skid_cooldown <= 0.0:
			skid_cooldown = 0.3
			spring_velocity -= skid_squash
			spawn_dust(dust_skid_amount, -velocity.normalized(), 1.5, 0.0, 55.0)
			play_action_sound("skid")

	# Smooth acceleration / friction (feels much more alive than instant speed)
	var target_velocity: Vector2 = input_direction * current_max_speed
	var rate: float = acceleration if input_direction != Vector2.ZERO else friction
	velocity = velocity.move_toward(target_velocity, rate * delta)
	move_and_slide()

	# Stop wandering when he arrives or bumps into something
	if wander_active:
		if wander_time_left <= 0.0 or get_slide_collision_count() > 0:
			end_wander()

	var speed_ratio: float = velocity.length() / maxf(speed, 0.001)
	var is_walking: bool = speed_ratio > 0.1

	run_blend = move_toward(
		run_blend,
		1.0 if (wants_run and is_walking) else 0.0,
		delta * 6.0
	)

	if input_direction.length() > 0.1:
		last_move_direction = input_direction.normalized()
		update_direction(input_direction)

	if is_walking:
		if not was_walking:
			start_walking()

		var tempo: float = clampf(speed_ratio, 0.6, 1.0)
		if speed_ratio > 1.0:
			tempo += (speed_ratio - 1.0) * 0.7

		walk_time += delta * walk_animation_speed * tempo

		animation_amount = move_toward(
			animation_amount,
			1.0,
			delta * animation_blend_speed
		)

		decay_fidgets(delta, 4.0)

		# FOOTSTEPS + DUST are synced to the animation:
		# a step happens every time a foot touches the ground.
		var step_count: int = int(walk_time / PI)
		if step_count != last_step_count:
			last_step_count = step_count
			on_footstep()

	else:
		if was_walking:
			stop_walking()

		idle_time += delta

		animation_amount = move_toward(
			animation_amount,
			0.0,
			delta * animation_blend_speed
		)

		decay_fidgets(delta, 1.0)

		if not player_controlled:
			try_start_routine(delta)

	if not player_controlled:
		update_routine(delta)

	was_walking = is_walking

	animate_character(delta)


func get_character_sprites() -> Array[Sprite2D]:
	return [
		body_sprite,
		bottom_sprite,
		top_sprite,
		feet_sprite,
		hair_sprite
	]


# =============================================================================
# WALKING EVENTS
# =============================================================================
func start_walking() -> void:
	# Start the step cycle on the ground, with a little forward pop
	walk_time = 0.0
	last_step_count = 0
	spring_velocity += start_stretch
	spawn_dust(dust_start_amount, last_move_direction, 1.3, 0.0)


func stop_walking() -> void:
	var was_running: bool = run_blend > 0.4
	spring_velocity -= stop_squash * (1.5 if was_running else 1.0)

	if was_running:
		spawn_dust(dust_stop_amount * 2, last_move_direction, 1.5, 0.0, 55.0)
	else:
		spawn_dust(dust_stop_amount, last_move_direction, 0.8, 0.0)

	fidget_timer = randf_range(1.5, fidget_max_delay)

	stop_footsteps(true)


func on_footstep() -> void:
	foot_side *= -1.0
	spring_velocity -= step_squash * (1.0 + run_blend)

	play_footstep()

	var amount: int = int(round(float(dust_per_step) * (1.0 + run_blend)))
	spawn_dust(amount, last_move_direction, 1.0 + run_blend * 0.5, foot_side * dust_foot_spread)


# =============================================================================
# SOUND
# =============================================================================
func setup_action_sound() -> void:
	# A separate player, so jump / land / turn never touch the footsteps sound.
	action_sound = AudioStreamPlayer2D.new()
	action_sound.name = "ActionSound"
	action_sound.bus = footsteps.bus
	action_sound.max_distance = footsteps.max_distance
	action_sound.attenuation = footsteps.attenuation
	add_child(action_sound)


func play_footstep() -> void:
	if footsteps.stream == null:
		return

	if footsteps_tween != null and footsteps_tween.is_valid():
		footsteps_tween.kill()

	var volume: float = footsteps_volume + run_blend * 2.0
	if wander_active:
		volume -= 2.0   # a bit softer when he strolls by himself

	if footsteps.playing and not footsteps_restart_each_step:
		footsteps.volume_db = volume
		return

	footsteps.pitch_scale = 1.0 + randf_range(
		-footsteps_pitch_variation,
		footsteps_pitch_variation
	)
	footsteps.volume_db = volume + randf_range(-1.5, 0.5)
	footsteps.play()


func stop_footsteps(fade: bool) -> void:
	if not footsteps.playing:
		return

	if footsteps_tween != null and footsteps_tween.is_valid():
		footsteps_tween.kill()

	if fade:
		footsteps_tween = create_tween()
		footsteps_tween.tween_property(footsteps, "volume_db", -40.0, 0.08)
		footsteps_tween.tween_callback(footsteps.stop)
	else:
		footsteps.stop()


## One single sound for an action: "jump", "land", "turn", "bounce" or "skid".
func play_action_sound(kind: String) -> void:
	if action_sound == null:
		return

	var custom: AudioStream = null
	var pitch: float = 1.0
	var volume: float = 0.0
	var length: float = fallback_sound_length

	match kind:
		"jump":
			custom = jump_sound
			pitch = 1.25
			volume = -1.0
			length = fallback_sound_length * 0.65
		"land":
			custom = land_sound
			pitch = 0.85
			volume = 1.5
		"turn":
			custom = turn_sound
			pitch = 1.5
			volume = -8.0
			length = fallback_sound_length * 0.45
		"bounce":
			pitch = 1.1
			volume = -6.0
			length = fallback_sound_length * 0.55
		"skid":
			pitch = 0.7
			volume = 0.0

	var stream: AudioStream = custom if custom != null else footsteps.stream
	if stream == null:
		return

	if action_tween != null and action_tween.is_valid():
		action_tween.kill()

	action_sound.stream = stream
	action_sound.pitch_scale = pitch + randf_range(-0.05, 0.05)
	action_sound.volume_db = action_sound_volume + volume + randf_range(-1.0, 1.0)
	action_sound.play()

	# Reusing the footsteps clip: keep only the first short hit, with a tiny fade
	if custom == null:
		action_tween = create_tween()
		action_tween.tween_interval(maxf(length - 0.05, 0.01))
		action_tween.tween_property(action_sound, "volume_db", -40.0, 0.05)
		action_tween.tween_callback(action_sound.stop)


# =============================================================================
# IDLE LIFE: ROUTINES (little random sequences, never the same twice in a row)
# =============================================================================
func setup_routines() -> void:
	routines = [
		{"weight": 3.0, "steps": ["sigh"]},
		{"weight": 2.0, "steps": ["stretch"]},
		{"weight": 1.5, "steps": ["shiver"]},
		{"weight": 2.0, "steps": ["weight_shift", "hair_flick"]},
		{"weight": 2.5, "steps": ["hop"]},
		{"weight": 1.5, "steps": ["hop", "hop"]},
		{"weight": 1.5, "steps": ["twirl"]},
		{"weight": 1.0, "steps": ["big_hop", "wiggle"]},
		{"weight": 2.0, "steps": ["wiggle"]},
		{"weight": 2.5, "steps": ["look", "look"]},
		{"weight": 2.0, "steps": ["look", "hop"]},
		{"weight": 1.5, "steps": ["shiver", "look", "sigh"]},
		{"weight": 3.0, "steps": ["wander"]},
		{"weight": 1.5, "steps": ["wander", "look", "wiggle"]},
		{"weight": 1.0, "steps": ["wander", "wander"]},
		{"weight": 1.0, "steps": ["stretch", "wander", "hop"]},
	]


func routine_allowed(steps: Array) -> bool:
	for step: Variant in steps:
		var s: String = step
		if (s == "hop" or s == "big_hop" or s == "twirl") and not allow_hop:
			return false
		if s == "look" and not allow_look_around:
			return false
		if s == "wander" and not allow_wander:
			return false
	return true


func try_start_routine(delta: float) -> void:
	if not idle_fidget_enabled or routine_active:
		return

	fidget_timer -= delta
	if fidget_timer > 0.0:
		return

	start_random_routine()


func start_random_routine() -> void:
	var candidates: Array[int] = []
	var total: float = 0.0

	for i: int in routines.size():
		if i == last_routine:
			continue
		var steps: Array = routines[i]["steps"]
		if not routine_allowed(steps):
			continue
		candidates.append(i)
		total += float(routines[i]["weight"])

	if candidates.is_empty():
		fidget_timer = randf_range(fidget_min_delay, fidget_max_delay)
		return

	var roll: float = randf() * total
	var chosen: int = candidates[0]
	for i: int in candidates:
		roll -= float(routines[i]["weight"])
		if roll <= 0.0:
			chosen = i
			break

	var chosen_steps: Array = routines[chosen]["steps"]
	last_routine = chosen
	routine_queue = chosen_steps.duplicate()
	routine_active = true
	routine_wait = 0.0
	routine_changed_facing = false


func update_routine(delta: float) -> void:
	if not routine_active:
		return

	# Wait while he is walking by himself
	if wander_active:
		return

	if routine_wait > 0.0:
		routine_wait -= delta
		return

	if routine_queue.is_empty():
		finish_routine()
		return

	var action: String = routine_queue.pop_front()
	routine_wait = run_routine_action(action)


func finish_routine() -> void:
	routine_active = false
	fidget_timer = randf_range(fidget_min_delay, fidget_max_delay)

	# If he looked around, he turns back to where he was facing
	if routine_changed_facing:
		restore_facing()


func cancel_autonomy() -> void:
	routine_queue.clear()
	routine_active = false
	routine_wait = 0.0
	routine_changed_facing = false
	wander_active = false
	hop_twirl = false   # the jump finishes, but you control his direction


## Starts one step of a routine and returns how long to wait before the next one.
func run_routine_action(action: String) -> float:
	match action:
		"sigh":
			sigh_progress = 1.0
			return sigh_duration + 0.2
		"stretch":
			stretch_progress = 1.0
			return stretch_duration + 0.2
		"shiver":
			shiver_progress = 1.0
			return 0.8
		"hair_flick":
			hair_flick_progress = 1.0
			return 0.8
		"weight_shift":
			weight_progress = 1.0
			return 1.7
		"wiggle":
			wiggle_progress = 1.0
			wiggle_last_bounce = 0
			return wiggle_duration + 0.15
		"hop":
			start_hop(1.0, 1.0, false)
			return hop_crouch + hop_duration + 0.25
		"big_hop":
			start_hop(1.6, 1.25, false)
			return hop_crouch + hop_duration * 1.25 + 0.3
		"twirl":
			start_hop(1.2, 1.4, true)
			return hop_crouch + hop_duration * 1.4 + 0.3
		"look":
			do_look()
			return randf_range(0.8, 1.4)
		"wander":
			start_wander()
			return 0.35
	return 0.0


# =============================================================================
# IDLE LIFE: LOOK / TURN
# =============================================================================
func do_look() -> void:
	if not routine_changed_facing:
		saved_direction = direction_index
		routine_changed_facing = true

	var options: Array[int] = [0, 1, 2, 3]
	options.erase(direction_index)
	var picked: int = options.pick_random()

	direction_index = picked
	update_sprites()
	turn_effect()


func restore_facing() -> void:
	routine_changed_facing = false
	if direction_index == saved_direction:
		return

	direction_index = saved_direction
	update_sprites()
	turn_effect()


## A noticeable little "turn": pop, tiny dust and one soft sound.
func turn_effect() -> void:
	spring_velocity += turn_pop * 1.6
	spawn_dust(2, Vector2.ZERO, 0.5, 0.0, 180.0)
	play_action_sound("turn")


# =============================================================================
# IDLE LIFE: HOP / TWIRL
# =============================================================================
func start_hop(height_mult: float, duration_mult: float, twirl: bool) -> void:
	stop_footsteps(false)   # footsteps never play during a jump

	hop_active = true
	hop_launched = false
	hop_time = -hop_crouch
	hop_strength = height_mult
	hop_height_now = hop_height * height_mult
	hop_duration_now = hop_duration * duration_mult
	hop_twirl = twirl

	# He spins using his 4 direction sprites: Down -> Left -> Up -> Right
	if twirl:
		spin_start = direction_index
		spin_step_sign = 1 if randf() < 0.5 else -1

	spring_velocity -= 0.8 + 0.4 * height_mult   # crouch before jumping


func update_hop(delta: float) -> void:
	if not hop_active:
		hop_offset = 0.0
		return

	hop_time += delta

	if hop_time < 0.0:
		return

	if not hop_launched:
		hop_launched = true
		spring_velocity += 1.2 + 0.4 * hop_strength   # stretch as he leaves the ground
		spawn_dust(int(3.0 * hop_strength), Vector2.ZERO, 0.8, 0.0, 180.0)
		play_action_sound("jump")

	var u: float = hop_time / maxf(hop_duration_now, 0.01)

	if u >= 1.0:
		hop_active = false
		hop_offset = 0.0
		on_land()
		return

	hop_offset = hop_height_now * 4.0 * u * (1.0 - u)

	if hop_twirl:
		var order: Array[int] = [0, 3, 2, 1]
		var start_index: int = order.find(spin_start)
		var step: int = int(u * 4.0)
		var face: int = order[posmod(start_index + spin_step_sign * step, 4)]
		if face != direction_index:
			direction_index = face
			update_sprites()


func on_land() -> void:
	spring_velocity -= 1.0 + 0.4 * hop_strength
	spawn_dust(int(9.0 * hop_strength), Vector2.ZERO, 1.2, 0.0, 180.0)
	play_action_sound("land")

	# A full twirl ends facing where he started
	if hop_twirl:
		hop_twirl = false
		if direction_index != spin_start:
			direction_index = spin_start
			update_sprites()


# =============================================================================
# IDLE LIFE: WANDER (small steps by himself)
# =============================================================================
func start_wander() -> void:
	# Walking decides his facing, so he doesn't turn back afterwards
	routine_changed_facing = false

	var directions: Array[Vector2] = [
		Vector2.LEFT,
		Vector2.RIGHT,
		Vector2.UP,
		Vector2.DOWN,
		Vector2(1.0, 1.0).normalized(),
		Vector2(-1.0, 1.0).normalized(),
		Vector2(1.0, -1.0).normalized(),
		Vector2(-1.0, -1.0).normalized()
	]

	var to_home: Vector2 = wander_home - global_position
	var chosen: Vector2 = directions.pick_random()
	if to_home.length() > wander_radius:
		chosen = to_home.normalized()   # too far away, come back a little

	var distance: float = randf_range(wander_min_distance, wander_max_distance)
	wander_direction = chosen
	wander_time_left = distance / maxf(speed * wander_speed_multiplier, 1.0)
	wander_active = true


func end_wander() -> void:
	wander_active = false


# =============================================================================
# SINGLE FIDGET DECAY
# =============================================================================
func decay_fidgets(delta: float, rate: float) -> void:
	sigh_progress = move_toward(sigh_progress, 0.0, delta * rate / maxf(sigh_duration, 0.01))
	stretch_progress = move_toward(stretch_progress, 0.0, delta * rate / maxf(stretch_duration, 0.01))
	shiver_progress = move_toward(shiver_progress, 0.0, delta * rate / 0.6)
	hair_flick_progress = move_toward(hair_flick_progress, 0.0, delta * rate / 0.7)
	weight_progress = move_toward(weight_progress, 0.0, delta * rate / 1.6)
	wiggle_progress = move_toward(wiggle_progress, 0.0, delta * rate / maxf(wiggle_duration, 0.01))


# =============================================================================
# DIRECTION + SPRITES
# =============================================================================
func update_direction(input_direction: Vector2) -> void:
	var new_direction: int = direction_index

	if absf(input_direction.x) > absf(input_direction.y):
		if input_direction.x > 0.0:
			new_direction = 1
		else:
			new_direction = 3
	else:
		if input_direction.y < 0.0:
			new_direction = 2
		else:
			new_direction = 0

	if direction_index != new_direction:
		direction_index = new_direction
		spring_velocity += turn_pop
		update_sprites()


func update_sprites() -> void:
	body_sprite.texture = CharacterData.body_textures[
		body_index
	][skin_index][direction_index]

	bottom_sprite.texture = CharacterData.bottom_textures[
		body_index
	][bottom_index][direction_index]

	top_sprite.texture = CharacterData.top_textures[
		body_index
	][top_index][direction_index]

	feet_sprite.texture = CharacterData.feet_textures[
		body_index
	][feet_index][direction_index]

	hair_sprite.texture = CharacterData.hair_textures[
		hair_style_index
	][hair_color_index][direction_index]


# =============================================================================
# IDLE + WALKING ANIMATION
# =============================================================================
func animate_character(delta: float) -> void:
	# SPRING (squash & stretch with a little wobble)
	spring_velocity += (
		-spring_value * spring_stiffness
		- spring_velocity * spring_damping
	) * delta
	spring_value += spring_velocity * delta
	spring_value = clampf(spring_value, -0.14, 0.14)

	# HOP
	update_hop(delta)

	# SMOOTH MOVEMENT (for leaning and hair drag)
	var move_ratio: Vector2 = velocity / maxf(speed, 0.001)
	move_lean = move_lean.lerp(move_ratio, 1.0 - exp(-lean_smoothing * delta))

	# WALK / RUN values
	var bounce: float = walk_bounce * (1.0 + run_blend * run_bounce_boost)
	var sway: float = walk_sway * (1.0 + run_blend * 0.5)
	var lean: float = lean_amount * (1.0 + run_blend * run_lean_boost)

	var walk_wave: float = sin(walk_time)
	var walk_bob: float = absf(walk_wave) * bounce
	var walk_horizontal: float = walk_wave * sway
	var walking_stretch: float = sin(walk_time * 2.0) * walk_stretch
	var hair_walk_bob: float = absf(sin(walk_time - hair_delay)) * bounce

	# IDLE FIDGET SHAPES
	var sigh_bump: float = 0.0
	if sigh_progress > 0.0:
		sigh_bump = sin((1.0 - sigh_progress) * PI) * sigh_strength

	var stretch_bump: float = 0.0
	if stretch_progress > 0.0:
		stretch_bump = sin((1.0 - stretch_progress) * PI)

	var shiver_x: float = 0.0
	if shiver_progress > 0.0:
		shiver_x = sin(idle_time * 70.0) * 0.35 * shiver_progress

	var weight_x: float = 0.0
	if weight_progress > 0.0:
		weight_x = sin((1.0 - weight_progress) * TAU) * weight_shift_amount

	var hair_flick_x: float = 0.0
	if hair_flick_progress > 0.0:
		var flick_phase: float = 1.0 - hair_flick_progress
		hair_flick_x = sin(flick_phase * TAU * 2.0) * 1.5 * sin(flick_phase * PI)

	# Little happy bounces in place
	var wiggle_lift: float = 0.0
	if wiggle_progress > 0.0:
		var wiggle_phase: float = (1.0 - wiggle_progress) * 3.0
		wiggle_lift = absf(sin(wiggle_phase * PI)) * wiggle_height
		var bounce_index: int = int(wiggle_phase)
		if bounce_index != wiggle_last_bounce:
			wiggle_last_bounce = bounce_index
			spring_velocity -= 0.5
			spawn_dust(1, Vector2.ZERO, 0.4, 0.0, 180.0)
			play_action_sound("bounce")

	# IDLE BREATHING (inhale a bit faster than exhale, like real breathing)
	var breath_phase: float = idle_time * idle_breath_speed
	var breathing: float = (
		sin(breath_phase)
		+ 0.25 * sin(breath_phase * 2.0)
		+ sigh_bump
	)

	var idle_bob: float = breathing * idle_breath_amount + stretch_bump * 0.6
	var breathing_stretch: float = breathing * idle_stretch + stretch_bump * stretch_height

	var body_sway: float = sin(idle_time * 0.8) * idle_body_sway
	var hair_sway: float = sin(idle_time * 1.3 + 0.5) * idle_hair_sway

	# BLEND WALKING AND IDLE
	var idle_amount: float = 1.0 - animation_amount

	var final_bob: float = (
		walk_bob * animation_amount
		+ idle_bob * idle_amount
	)

	var final_horizontal: float = (
		walk_horizontal * animation_amount
		+ (body_sway + shiver_x + weight_x) * idle_amount
	)

	var final_stretch: float = (
		walking_stretch * animation_amount
		+ breathing_stretch * idle_amount
		+ spring_value
	)

	var hair_bob: float = (
		hair_walk_bob * animation_amount
		+ idle_bob * idle_amount
	)

	# EVERYTHING MOVES AS ONE SOLID BLOCK
	# Body, clothes and feet share exactly the same offset and the same
	# scale pivot, so they can never separate and show the body underneath.
	var lift: float = final_bob + hop_offset + wiggle_lift

	var shared_offset: Vector2 = Vector2(
		final_horizontal + move_lean.x * lean,
		-lift
	)

	var scale_factor: Vector2 = Vector2(1.0 - final_stretch, 1.0 + final_stretch)

	# Only the hair gets a small extra motion on top
	var hair_extra: Vector2 = Vector2(
		hair_sway * idle_amount - move_lean.x * hair_drag + hair_flick_x,
		(final_bob - hair_bob) - move_lean.y * hair_drag * 0.5
	) * hair_freedom

	for sprite: Sprite2D in get_character_sprites():
		var original_position: Vector2 = original_positions[sprite]
		var original_scale: Vector2 = original_scales[sprite]

		# Scale every layer around the same point (his feet)
		var scaled_position: Vector2 = squash_pivot + (original_position - squash_pivot) * scale_factor

		var layer_offset: Vector2 = shared_offset
		if sprite == hair_sprite:
			layer_offset += hair_extra

		sprite.position = scaled_position + layer_offset
		sprite.scale = original_scale * scale_factor

	# SHADOW (shrinks and fades when he is lifted off the ground)
	if shadow_sprite != null:
		var shadow_scale: float = clampf(1.0 - lift * 0.05, 0.4, 1.0)
		shadow_sprite.position = shadow_offset + Vector2(final_horizontal * 0.3, 0.0)
		shadow_sprite.scale = shadow_size * shadow_scale
		shadow_sprite.modulate.a = shadow_opacity * shadow_scale


func reset_animation() -> void:
	cancel_autonomy()

	walk_time = 0.0
	idle_time = 0.0
	animation_amount = 0.0
	run_blend = 0.0
	last_step_count = 0
	was_walking = false
	move_lean = Vector2.ZERO
	spring_value = 0.0
	spring_velocity = 0.0
	sigh_progress = 0.0
	stretch_progress = 0.0
	shiver_progress = 0.0
	hair_flick_progress = 0.0
	weight_progress = 0.0
	wiggle_progress = 0.0
	hop_active = false
	hop_offset = 0.0

	stop_footsteps(false)

	animate_character(0.0)


# =============================================================================
# DUST
# =============================================================================
func setup_dust() -> void:
	puff_texture = make_puff_texture()
	speck_texture = make_speck_texture()

	# Puffs grow while they fade (like real dust expanding)
	puff_scale_curve = Curve.new()
	puff_scale_curve.add_point(Vector2(0.0, 0.5))
	puff_scale_curve.add_point(Vector2(0.25, 1.0))
	puff_scale_curve.add_point(Vector2(1.0, 1.7))

	# Each puff picks a random shade between light and dark dust
	puff_initial_ramp = Gradient.new()
	puff_initial_ramp.set_color(0, Color(dust_color.r, dust_color.g, dust_color.b, 1.0).lightened(0.15))
	puff_initial_ramp.set_color(1, Color(dust_color.r, dust_color.g, dust_color.b, 1.0).darkened(0.2))

	# Fade out over the lifetime
	puff_color_ramp = Gradient.new()
	puff_color_ramp.set_color(0, Color(1.0, 1.0, 1.0, dust_color.a))
	puff_color_ramp.add_point(0.4, Color(1.0, 1.0, 1.0, dust_color.a * 0.7))
	puff_color_ramp.set_color(puff_color_ramp.get_point_count() - 1, Color(1.0, 1.0, 1.0, 0.0))

	speck_color_ramp = Gradient.new()
	speck_color_ramp.set_color(0, Color(
		dust_color.r * 0.8, dust_color.g * 0.8, dust_color.b * 0.8, 1.0
	))
	speck_color_ramp.set_color(1, Color(
		dust_color.r * 0.8, dust_color.g * 0.8, dust_color.b * 0.8, 0.0
	))


func make_puff_texture() -> Texture2D:
	if dust_soft:
		var gradient: Gradient = Gradient.new()
		gradient.set_color(0, Color.WHITE)
		gradient.set_color(1, Color(1.0, 1.0, 1.0, 0.0))

		var soft_texture: GradientTexture2D = GradientTexture2D.new()
		soft_texture.gradient = gradient
		soft_texture.fill = GradientTexture2D.FILL_RADIAL
		soft_texture.fill_from = Vector2(0.5, 0.5)
		soft_texture.fill_to = Vector2(1.0, 0.5)
		soft_texture.width = 16
		soft_texture.height = 16
		return soft_texture

	# Tiny pixel-art round dot
	var image: Image = Image.create_empty(5, 5, false, Image.FORMAT_RGBA8)
	for x: int in 5:
		for y: int in 5:
			if Vector2(x, y).distance_to(Vector2(2.0, 2.0)) <= 2.2:
				image.set_pixel(x, y, Color.WHITE)
	return ImageTexture.create_from_image(image)


func make_speck_texture() -> Texture2D:
	var image: Image = Image.create_empty(2, 2, false, Image.FORMAT_RGBA8)
	image.fill(Color.WHITE)
	return ImageTexture.create_from_image(image)


func spawn_dust(
	amount: int,
	move_direction: Vector2,
	strength: float,
	x_offset: float,
	spread: float = 40.0
) -> void:
	if not dust_enabled:
		return

	var parent: Node = get_parent()
	if parent == null:
		return

	var origin: Vector2 = global_position + dust_offset + Vector2(x_offset, 0.0)

	# Kicked backwards and a little upwards
	var kick: Vector2 = Vector2(
		-move_direction.x,
		-move_direction.y * 0.5 - 0.5
	).normalized()

	# --- Soft puffs ---
	var puffs: CPUParticles2D = CPUParticles2D.new()
	puffs.amount = maxi(amount, 1)
	puffs.lifetime = dust_lifetime
	puffs.one_shot = true
	puffs.explosiveness = 0.9
	puffs.randomness = 0.5
	puffs.local_coords = false   # puffs stay in the world, he walks away from them
	puffs.texture = puff_texture
	puffs.texture_filter = (
		CanvasItem.TEXTURE_FILTER_LINEAR
		if dust_soft
		else CanvasItem.TEXTURE_FILTER_NEAREST
	)
	puffs.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE
	puffs.emission_sphere_radius = 2.5
	puffs.direction = kick
	puffs.spread = spread
	puffs.gravity = Vector2(0.0, -6.0)
	puffs.initial_velocity_min = dust_speed * 0.3 * strength
	puffs.initial_velocity_max = dust_speed * strength
	puffs.damping_min = 25.0
	puffs.damping_max = 50.0
	puffs.scale_amount_min = 0.5 * dust_size
	puffs.scale_amount_max = 1.0 * dust_size * strength
	puffs.scale_amount_curve = puff_scale_curve
	puffs.color_initial_ramp = puff_initial_ramp
	puffs.color_ramp = puff_color_ramp
	emit_particles(puffs, parent, origin)

	# --- Tiny flying specks of dirt ---
	if dust_specks_enabled:
		var specks: CPUParticles2D = CPUParticles2D.new()
		specks.amount = maxi(amount, 1) * 2
		specks.lifetime = dust_lifetime * 0.8
		specks.one_shot = true
		specks.explosiveness = 1.0
		specks.randomness = 0.6
		specks.local_coords = false
		specks.texture = speck_texture
		specks.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		specks.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE
		specks.emission_sphere_radius = 2.0
		specks.direction = kick
		specks.spread = minf(spread + 30.0, 180.0)
		specks.gravity = Vector2(0.0, 45.0)
		specks.initial_velocity_min = dust_speed * 0.8 * strength
		specks.initial_velocity_max = dust_speed * 1.8 * strength
		specks.damping_min = 15.0
		specks.damping_max = 30.0
		specks.scale_amount_min = 0.6
		specks.scale_amount_max = 1.2
		specks.color_ramp = speck_color_ramp
		emit_particles(specks, parent, origin)


func emit_particles(particles: CPUParticles2D, parent: Node, origin: Vector2) -> void:
	particles.z_index = z_index
	parent.add_child(particles)
	parent.move_child(particles, get_index())   # draw behind the character
	particles.global_position = origin
	particles.finished.connect(particles.queue_free)
	particles.emitting = true


# =============================================================================
# SHADOW
# =============================================================================
func create_shadow() -> void:
	var gradient: Gradient = Gradient.new()
	gradient.set_color(0, Color(0.0, 0.0, 0.0, 1.0))
	gradient.set_color(1, Color(0.0, 0.0, 0.0, 0.0))

	var shadow_texture: GradientTexture2D = GradientTexture2D.new()
	shadow_texture.gradient = gradient
	shadow_texture.fill = GradientTexture2D.FILL_RADIAL
	shadow_texture.fill_from = Vector2(0.5, 0.5)
	shadow_texture.fill_to = Vector2(1.0, 0.5)
	shadow_texture.width = 28
	shadow_texture.height = 10

	shadow_sprite = Sprite2D.new()
	shadow_sprite.name = "ProceduralShadow"
	shadow_sprite.texture = shadow_texture
	shadow_sprite.position = shadow_offset
	shadow_sprite.modulate.a = shadow_opacity

	add_child(shadow_sprite)
	move_child(shadow_sprite, 0)   # behind all the character layers
