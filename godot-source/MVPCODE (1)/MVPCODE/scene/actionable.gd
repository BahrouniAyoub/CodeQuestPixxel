extends Area2D

@export var dialogue_resource: DialogueResource
@export var dialogue_start: String = "start"

# Step 8G: optional second dialogue, used only for CH1-08 and only when React's
# mirrored state says that quest is active.
@export var return_dialogue_resource: DialogueResource
@export var return_dialogue_start: String = "start"
@export var completion_quest_id: String = ""
@export var prompt_label: Label

@export var player: CharacterBody2D
@export var npc: Node2D

var dialogue_balloon: Node = null
var player_nearby := false
var _using_return_dialogue := false
var _return_event_sent := false


func _ready() -> void:
	add_to_group("dialogue_actionable")
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	if prompt_label:
		prompt_label.hide()


func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = true
		if prompt_label:
			prompt_label.show()


func _on_body_exited(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = false
		if prompt_label:
			prompt_label.hide()


func action() -> void:
	# If dialogue is already open, close it. Closing early never emits the
	# completion event; only DialogueManager.dialogue_ended does that.
	if is_instance_valid(dialogue_balloon):
		_close_dialogue()
		return

	_using_return_dialogue = (
		completion_quest_id == CodeQuestBridge.CH1_08_QUEST_ID
		and return_dialogue_resource != null
		and CodeQuestBridge.is_ch1_08_active()
	)

	var chosen_resource := dialogue_resource
	var chosen_start := dialogue_start
	if _using_return_dialogue:
		chosen_resource = return_dialogue_resource
		chosen_start = return_dialogue_start

	if prompt_label:
		prompt_label.hide()

	# Stop player and NPC movement.
	set_characters_movement(false)

	dialogue_balloon = DialogueManager.show_example_dialogue_balloon(
		chosen_resource,
		chosen_start
	)

	if is_instance_valid(dialogue_balloon):
		if _using_return_dialogue and not DialogueManager.dialogue_ended.is_connected(_on_return_dialogue_ended):
			DialogueManager.dialogue_ended.connect(_on_return_dialogue_ended)
		dialogue_balloon.tree_exited.connect(_on_dialogue_closed)


func _on_return_dialogue_ended(resource: DialogueResource) -> void:
	# The signal is global, so verify it belongs to this exact father dialogue.
	if not _using_return_dialogue or resource != return_dialogue_resource:
		return
	if _return_event_sent:
		return

	_return_event_sent = true
	QuestManager.set_objective(
		"Chapter 1 complete",
		"You told your father about the café job."
	)
	CodeQuestBridge.notify_father_dialogue_completed()


func _close_dialogue() -> void:
	if is_instance_valid(dialogue_balloon):
		dialogue_balloon.queue_free()
	dialogue_balloon = null
	_disconnect_return_signal()
	_using_return_dialogue = false
	set_characters_movement(true)
	if prompt_label and player_nearby:
		prompt_label.show()


func _disconnect_return_signal() -> void:
	if DialogueManager.dialogue_ended.is_connected(_on_return_dialogue_ended):
		DialogueManager.dialogue_ended.disconnect(_on_return_dialogue_ended)


func set_characters_movement(enabled: bool) -> void:
	if is_instance_valid(player):
		player.can_move = enabled

	if is_instance_valid(npc):
		npc.can_move = enabled


func _on_dialogue_closed() -> void:
	_disconnect_return_signal()

	if _using_return_dialogue:
		_using_return_dialogue = false
	else:
		QuestManager.set_objective(
			"Go to your computer",
			"Your father wants you to start looking for a job."
		)
		QuestManager.show_marker(get_node("../../screen"), Vector2(35, -2))

	dialogue_balloon = null
	set_characters_movement(true)
	if prompt_label and player_nearby:
		prompt_label.show()
