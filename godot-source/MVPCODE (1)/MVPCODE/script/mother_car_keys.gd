extends Area2D

@export var dialogue_resource: DialogueResource
@export var dialogue_start: String = "start"
@export var prompt_label: Label
@export var player: CharacterBody2D
@export var npc: Node2D

var player_nearby := false
var dialogue_balloon: Node = null


func _ready() -> void:
	add_to_group("dialogue_actionable")
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	if prompt_label:
		prompt_label.hide()


func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = true
		if prompt_label and not is_instance_valid(dialogue_balloon):
			prompt_label.show()


func _on_body_exited(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = false
		if prompt_label:
			prompt_label.hide()


func action() -> void:
	if QuestManager.journal_open or dialogue_resource == null:
		return
	if is_instance_valid(dialogue_balloon):
		return

	if prompt_label:
		prompt_label.hide()
	set_characters_movement(false)

	dialogue_balloon = DialogueManager.show_example_dialogue_balloon(
		dialogue_resource,
		dialogue_start
	)

	if is_instance_valid(dialogue_balloon):
		if not DialogueManager.dialogue_ended.is_connected(_on_dialogue_ended):
			DialogueManager.dialogue_ended.connect(_on_dialogue_ended)
		dialogue_balloon.tree_exited.connect(_on_dialogue_closed)


func _on_dialogue_ended(resource: DialogueResource) -> void:
	if resource != dialogue_resource:
		return
	CharacterSettings.car_permission = true


func _on_dialogue_closed() -> void:
	if DialogueManager.dialogue_ended.is_connected(_on_dialogue_ended):
		DialogueManager.dialogue_ended.disconnect(_on_dialogue_ended)
	CharacterSettings.car_permission = true
	dialogue_balloon = null
	set_characters_movement(true)
	if prompt_label and player_nearby:
		prompt_label.show()


func set_characters_movement(enabled: bool) -> void:
	if is_instance_valid(player):
		player.set("can_move", enabled)
	if is_instance_valid(npc):
		npc.set("can_move", enabled)
