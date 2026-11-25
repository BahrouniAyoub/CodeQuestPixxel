class_name DialogueManagerExampleBalloon
extends CanvasLayer

## Dialogue resource
@export var dialogue_resource: DialogueResource

## Starting cue
@export var start_from_cue: String = ""

## Automatically start dialogue
@export var auto_start: bool = false

## Block other input during dialogue
@export var will_block_other_input: bool = true

## Press E to advance
@export var next_action: StringName = &"ui_accept"


## Skip typing
@export var skip_action: StringName = &"ui_cancel"

## Dialogue size
@export_range(0.2, 1.0, 0.05) var balloon_scale: float = 1.0

## Close dialogue when player leaves the father's collision
@export var close_when_player_leaves: bool = true


@onready var audio_stream_player: AudioStreamPlayer = %AudioStreamPlayer
@onready var talk_sound_player: AudioStreamPlayer = get_node_or_null("%TalkSoundPlayer") as AudioStreamPlayer
@onready var balloon: Control = %Balloon
@onready var panel: Control = get_node_or_null("%PanelContainer") as Control
@onready var character_label: RichTextLabel = %CharacterLabel
@onready var speaker_initial: Label = get_node_or_null("%SpeakerInitial") as Label
@onready var dialogue_label: DialogueLabel = %DialogueLabel
@onready var continue_hint: Label = get_node_or_null("%ContinueHint") as Label
@onready var responses_menu: DialogueResponsesMenu = %ResponsesMenu
@onready var progress: Polygon2D = %Progress


var temporary_game_states: Array = []
var is_waiting_for_input: bool = false
var will_hide_balloon: bool = false
var locals: Dictionary = {}

var _locale: String = TranslationServer.get_locale()
var _dialogue_closed: bool = false
var _active_actionable: Area2D = null
var _balloon_entered: bool = false
var _is_closing: bool = false
var _panel_tween: Tween
var talk_sound_timer: Timer
var _talk_streams: Dictionary = {}
var _voice_key := "default"
var _blip_index := 0

var mutation_cooldown: Timer = Timer.new()


## Current dialogue line
var dialogue_line: DialogueLine:
	set(value):
		if value:
			dialogue_line = value
			apply_dialogue_line()
		else:
			is_waiting_for_input = false
			_dialogue_closed = true
			_animate_balloon_out()

	get:
		return dialogue_line


func _ready() -> void:

	# Hide the balloon initially
	balloon.hide()

	# Make the balloon smaller
	balloon.scale = Vector2.ONE * balloon_scale
	balloon.pivot_offset = balloon.size / 2.0

	if is_instance_valid(panel):
		panel.pivot_offset = Vector2(0.0, maxf(panel.size.y, 1.0) / 2.0)

	# Connect Dialogue Manager mutations
	Engine.get_singleton("DialogueManager").mutated.connect(_on_mutated)

	# Set response menu input
	if responses_menu.next_action.is_empty():
		responses_menu.next_action = next_action

	# Mutation timer
	mutation_cooldown.timeout.connect(_on_mutation_cooldown_timeout)
	add_child(mutation_cooldown)
	_setup_talk_sound()

	# Automatic dialogue
	if auto_start:
		if not is_instance_valid(dialogue_resource):
			push_error("Dialogue resource is missing.")
			return

		start()


func _process(_delta: float) -> void:

	if not is_instance_valid(dialogue_line):
		return

	# Show the progress indicator and continue hint
	var can_continue := (
		not dialogue_label.is_typing
		and dialogue_line.responses.is_empty()
		and not dialogue_line.has_tag("voice")
	)
	progress.visible = can_continue
	if is_instance_valid(continue_hint):
		continue_hint.visible = can_continue and is_waiting_for_input

	# Check whether the player has left the father's collision
	if close_when_player_leaves and is_instance_valid(_active_actionable):

		if not _player_is_inside_actionable():
			close_dialogue()


## Handle keyboard input
func _unhandled_input(event: InputEvent) -> void:

	if _dialogue_closed or not is_instance_valid(dialogue_line):
		return

	if event.is_action_pressed(skip_action):
		get_viewport().set_input_as_handled()
		if dialogue_label.is_typing:
			dialogue_label.skip_typing()
		else:
			close_dialogue()
		return

	# E advances the dialogue
	if event.is_action_pressed(next_action):

		# If text is still typing, finish it first
		if dialogue_label.is_typing:
			get_viewport().set_input_as_handled()
			dialogue_label.skip_typing()
			return

		# Don't interrupt response choices
		if not dialogue_line.responses.is_empty():
			return

		# Go to the next dialogue line
		if is_waiting_for_input:
			get_viewport().set_input_as_handled()
			next(dialogue_line.next_id)
			return

	# Block other game input while dialogue is active
	if will_block_other_input:
		get_viewport().set_input_as_handled()


## Detect language changes
func _notification(what: int) -> void:

	if (
		what == NOTIFICATION_TRANSLATION_CHANGED
		and _locale != TranslationServer.get_locale()
		and is_instance_valid(dialogue_label)
		and is_instance_valid(dialogue_line)
	):

		_locale = TranslationServer.get_locale()

		var visible_ratio: float = dialogue_label.visible_ratio

		await dialogue_line.refresh()

		if visible_ratio < 1.0:
			dialogue_label.skip_typing()


## Start dialogue
func start(
	with_dialogue_resource: DialogueResource = null,
	cue: String = "",
	extra_game_states: Array = []
) -> void:

	_dialogue_closed = false
	_balloon_entered = false
	_is_closing = false
	is_waiting_for_input = false

	if is_instance_valid(panel):
		panel.modulate.a = 1.0
		panel.scale = Vector2.ONE

	temporary_game_states = [self] + extra_game_states

	if is_instance_valid(with_dialogue_resource):
		dialogue_resource = with_dialogue_resource

	if not cue.is_empty():
		start_from_cue = cue

	# Find the father's collision
	_active_actionable = _find_overlapping_actionable()

	if not is_instance_valid(dialogue_resource):
		push_error("Dialogue resource is missing.")
		close_dialogue()
		return

	dialogue_line = await dialogue_resource.get_next_dialogue_line(
		start_from_cue,
		temporary_game_states
	)

	if _dialogue_closed:
		return

	show()


## Find the Actionable area currently touching the player
func _find_overlapping_actionable() -> Area2D:

	for node in get_tree().get_nodes_in_group("dialogue_actionable"):

		if not node is Area2D:
			continue

		var actionable := node as Area2D

		for body in actionable.get_overlapping_bodies():

			if body is CharacterBody2D:
				return actionable

	return null


## Check if the player is still inside the father's collision
func _player_is_inside_actionable() -> bool:

	if not is_instance_valid(_active_actionable):
		return false

	for body in _active_actionable.get_overlapping_bodies():

		if body is CharacterBody2D:
			return true

	return false


## Close dialogue
func close_dialogue() -> void:

	if _dialogue_closed:
		return

	_dialogue_closed = true
	is_waiting_for_input = false
	will_hide_balloon = false

	mutation_cooldown.stop()

	_animate_balloon_out()


## Apply a dialogue line
func apply_dialogue_line() -> void:

	if _dialogue_closed or not is_instance_valid(dialogue_line):
		return

	mutation_cooldown.stop()

	progress.hide()
	is_waiting_for_input = false

	balloon.focus_mode = Control.FOCUS_ALL
	balloon.grab_focus()

	var speaker_name := tr(dialogue_line.character, "dialogue")
	_set_voice_for_speaker(speaker_name)
	character_label.visible = not speaker_name.is_empty()
	character_label.text = "[b][color=#7CC0FF]> %s[/color][/b]" % speaker_name
	if is_instance_valid(speaker_initial) and not speaker_name.is_empty():
		speaker_initial.text = speaker_name.substr(0, 1).to_upper()

	dialogue_label.hide()
	dialogue_label.dialogue_line = dialogue_line

	responses_menu.hide()
	responses_menu.responses = dialogue_line.responses

	# Show dialogue
	balloon.show()
	will_hide_balloon = false
	_animate_balloon_in()

	dialogue_label.show()

	# Type dialogue
	if not dialogue_line.text.is_empty():

		dialogue_label.type_out()

		if is_instance_valid(talk_sound_timer):
			talk_sound_timer.start()
			_play_talk_blip()

		await dialogue_label.finished_typing

		if is_instance_valid(talk_sound_timer):
			talk_sound_timer.stop()

	if _dialogue_closed or not is_instance_valid(dialogue_line):
		return

	# Voice lines
	if dialogue_line.has_tag("voice"):

		audio_stream_player.stream = load(
			dialogue_line.get_tag_value("voice")
		)

		audio_stream_player.play()

		await audio_stream_player.finished

		if not _dialogue_closed and is_instance_valid(dialogue_line):
			next(dialogue_line.next_id)

	# Response choices
	elif not dialogue_line.responses.is_empty():

		balloon.focus_mode = Control.FOCUS_NONE

		responses_menu.show()
		responses_menu.focus_first_item()

	# Automatic timed dialogue
	elif dialogue_line.time != "":

		var time: float = (
			dialogue_line.text.length() * 0.02
			if dialogue_line.time == "auto"
			else dialogue_line.time.to_float()
		)

		await get_tree().create_timer(time).timeout

		if not _dialogue_closed and is_instance_valid(dialogue_line):
			next(dialogue_line.next_id)

	# Wait for E
	else:

		is_waiting_for_input = true

		balloon.focus_mode = Control.FOCUS_ALL
		balloon.grab_focus()


## Go to next line
func next(next_id: String) -> void:

	if _dialogue_closed or next_id.is_empty():
		close_dialogue()
		return

	is_waiting_for_input = false

	dialogue_line = await dialogue_resource.get_next_dialogue_line(
		next_id,
		temporary_game_states
	)


func _setup_talk_sound() -> void:
	if not is_instance_valid(talk_sound_player):
		return

	talk_sound_player.volume_db = -30.0

	_talk_streams = {
		"father": _build_voice_bank(360.0, 0.055, 0),
		"kid": _build_voice_bank(500.0, 0.05, 3),
		"mother": _build_voice_bank(560.0, 0.05, 6),
		"default": _build_voice_bank(450.0, 0.055, 9),
	}

	talk_sound_timer = Timer.new()
	talk_sound_timer.wait_time = 0.115
	talk_sound_timer.one_shot = false
	talk_sound_timer.timeout.connect(_play_talk_blip)
	add_child(talk_sound_timer)


func _build_voice_bank(base_hz: float, length: float, seed_offset: int) -> Array:
	var bank: Array = []
	for variant in 4:
		bank.append(_make_cartoon_blip(base_hz, length, seed_offset + variant))
	return bank


func _make_cartoon_blip(base_hz: float, length: float, seed: int) -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_8_BITS
	stream.mix_rate = 22050
	stream.stereo = false
	stream.loop_mode = AudioStreamWAV.LOOP_DISABLED

	var frames := int(stream.mix_rate * length)
	var data := PackedByteArray()
	var bend := sin(float(seed) * 2.7) * 0.08
	var start_hz := base_hz * (1.0 + bend)
	var end_hz := base_hz * (1.0 - bend * 0.6)
	var phase := 0.0
	var smoothed := 0.0

	for i in range(frames):
		var p := float(i) / float(frames)
		var fade_in := clampf(p / 0.2, 0.0, 1.0)
		var fade_out := clampf((1.0 - p) / 0.35, 0.0, 1.0)
		var envelope := pow(sin(PI * p), 1.35) * fade_in * fade_out
		var glide := lerpf(start_hz, end_hz, p)
		var bounce := sin(p * TAU * 2.0 + float(seed)) * 0.04
		var wobble := sin(p * TAU * 7.0 + float(seed) * 0.7) * 0.012
		var freq := glide * (1.0 + bounce + wobble)
		phase += TAU * freq / float(stream.mix_rate)

		var wave := sin(phase)
		wave += sin(phase * 2.0 + 0.5) * 0.08
		wave /= 1.08
		smoothed = lerpf(smoothed, wave, 0.4)
		var value := int(round(128.0 + smoothed * envelope * 20.0))
		data.append(int(clamp(value, 0, 255)))

	stream.data = data
	return stream


func _set_voice_for_speaker(speaker: String) -> void:
	var key := speaker.strip_edges().to_lower()
	if not _talk_streams.has(key):
		key = "default"
	_voice_key = key
	if not is_instance_valid(talk_sound_timer):
		return
	match key:
		"kid": talk_sound_timer.wait_time = 0.105
		"mother": talk_sound_timer.wait_time = 0.1
		_: talk_sound_timer.wait_time = 0.115


func _play_talk_blip() -> void:
	if not is_instance_valid(talk_sound_player) or not is_instance_valid(dialogue_line):
		return
	if not dialogue_label.is_typing:
		return

	var bank: Array = _talk_streams.get(_voice_key, [])
	if bank.is_empty():
		return

	_blip_index = (_blip_index + 1) % bank.size()
	talk_sound_player.stream = bank[_blip_index]
	talk_sound_player.pitch_scale = randf_range(0.98, 1.12)
	talk_sound_player.play()


## Animate the panel in when the conversation begins
func _animate_balloon_in() -> void:
	if not is_instance_valid(panel) or _balloon_entered:
		return

	_balloon_entered = true
	panel.pivot_offset = Vector2(0.0, maxf(panel.size.y, 1.0) / 2.0)
	panel.modulate.a = 0.0
	panel.scale = Vector2(0.94, 0.94)

	if _panel_tween and _panel_tween.is_valid():
		_panel_tween.kill()

	_panel_tween = create_tween()
	_panel_tween.set_parallel(true)
	_panel_tween.tween_property(panel, "modulate:a", 1.0, 0.18)
	_panel_tween.tween_property(panel, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


## Animate the panel out before hiding or freeing the balloon
func _animate_balloon_out() -> void:
	if _is_closing:
		return

	_is_closing = true

	if not is_instance_valid(panel):
		_finish_close()
		return

	if _panel_tween and _panel_tween.is_valid():
		_panel_tween.kill()

	_panel_tween = create_tween()
	_panel_tween.set_parallel(true)
	_panel_tween.tween_property(panel, "modulate:a", 0.0, 0.12)
	_panel_tween.tween_property(panel, "scale", Vector2(0.82, 0.82), 0.12)
	_panel_tween.chain().tween_callback(_finish_close)


func _finish_close() -> void:
	if is_instance_valid(talk_sound_timer):
		talk_sound_timer.stop()

	if is_instance_valid(balloon):
		balloon.hide()

	hide()

	if owner == null:
		queue_free()


#region Signals


func _on_mutation_cooldown_timeout() -> void:

	if will_hide_balloon:
		will_hide_balloon = false
		balloon.hide()


func _on_mutated(mutation: Dictionary) -> void:

	if not mutation.is_inline:

		is_waiting_for_input = false
		will_hide_balloon = true

		mutation_cooldown.start(0.1)


## Mouse interaction
func _on_balloon_gui_input(event: InputEvent) -> void:

	if _dialogue_closed or not is_instance_valid(dialogue_line):
		return

	if dialogue_label.is_typing:

		if (
			event is InputEventMouseButton
			and event.button_index == MOUSE_BUTTON_LEFT
			and event.is_pressed()
		):

			get_viewport().set_input_as_handled()
			dialogue_label.skip_typing()

		return

	if not is_waiting_for_input:
		return

	if not dialogue_line.responses.is_empty():
		return

	if (
		event is InputEventMouseButton
		and event.is_pressed()
		and event.button_index == MOUSE_BUTTON_LEFT
	):

		get_viewport().set_input_as_handled()
		next(dialogue_line.next_id)


## Response selected
func _on_responses_menu_response_selected(response: DialogueResponse) -> void:

	next(response.next_id)


#endregion
