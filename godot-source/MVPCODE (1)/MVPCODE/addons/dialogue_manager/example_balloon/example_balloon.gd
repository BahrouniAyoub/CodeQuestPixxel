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
@export_range(0.2, 1.0, 0.05) var balloon_scale: float = 0.45

## Close dialogue when player leaves the father's collision
@export var close_when_player_leaves: bool = true


@onready var audio_stream_player: AudioStreamPlayer = %AudioStreamPlayer
@onready var balloon: Control = %Balloon
@onready var character_label: RichTextLabel = %CharacterLabel
@onready var dialogue_label: DialogueLabel = %DialogueLabel
@onready var responses_menu: DialogueResponsesMenu = %ResponsesMenu
@onready var progress: Polygon2D = %Progress


var temporary_game_states: Array = []
var is_waiting_for_input: bool = false
var will_hide_balloon: bool = false
var locals: Dictionary = {}

var _locale: String = TranslationServer.get_locale()
var _dialogue_closed: bool = false
var _active_actionable: Area2D = null

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

			if owner == null:
				queue_free()
			else:
				hide()

	get:
		return dialogue_line


func _ready() -> void:

	# Hide the balloon initially
	balloon.hide()

	# Make the balloon smaller
	balloon.scale = Vector2.ONE * balloon_scale
	balloon.pivot_offset = balloon.size / 2.0

	# Connect Dialogue Manager mutations
	Engine.get_singleton("DialogueManager").mutated.connect(_on_mutated)

	# Set response menu input
	if responses_menu.next_action.is_empty():
		responses_menu.next_action = next_action

	# Mutation timer
	mutation_cooldown.timeout.connect(_on_mutation_cooldown_timeout)
	add_child(mutation_cooldown)

	# Automatic dialogue
	if auto_start:
		if not is_instance_valid(dialogue_resource):
			push_error("Dialogue resource is missing.")
			return

		start()


func _process(_delta: float) -> void:

	if not is_instance_valid(dialogue_line):
		return

	# Show the progress indicator
	progress.visible = (
		not dialogue_label.is_typing
		and dialogue_line.responses.is_empty()
		and not dialogue_line.has_tag("voice")
	)

	# Check whether the player has left the father's collision
	if close_when_player_leaves and is_instance_valid(_active_actionable):

		if not _player_is_inside_actionable():
			close_dialogue()


## Handle keyboard input
func _unhandled_input(event: InputEvent) -> void:

	if _dialogue_closed or not is_instance_valid(dialogue_line):
		return

	# Skip typing with the skip key
	if event.is_action_pressed(skip_action) and dialogue_label.is_typing:
		get_viewport().set_input_as_handled()
		dialogue_label.skip_typing()
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
	is_waiting_for_input = false

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

	if is_instance_valid(balloon):
		balloon.hide()

	hide()

	if owner == null:
		queue_free()


## Apply a dialogue line
func apply_dialogue_line() -> void:

	if _dialogue_closed or not is_instance_valid(dialogue_line):
		return

	mutation_cooldown.stop()

	progress.hide()
	is_waiting_for_input = false

	balloon.focus_mode = Control.FOCUS_ALL
	balloon.grab_focus()

	character_label.visible = not dialogue_line.character.is_empty()
	character_label.text = tr(dialogue_line.character, "dialogue")

	dialogue_label.hide()
	dialogue_label.dialogue_line = dialogue_line

	responses_menu.hide()
	responses_menu.responses = dialogue_line.responses

	# Show dialogue
	balloon.show()
	will_hide_balloon = false

	dialogue_label.show()

	# Type dialogue
	if not dialogue_line.text.is_empty():

		dialogue_label.type_out()

		await dialogue_label.finished_typing

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
