class_name SceneDoor
extends Area2D

@export var target_scene: String = ""
@export var target_spawn_marker: String = ""
@export var prompt_label: Label

static var pending_spawn_marker: String = ""

var player_nearby := false


func _ready() -> void:
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
	if QuestManager.journal_open or target_scene.is_empty():
		return
	pending_spawn_marker = target_spawn_marker
	get_tree().change_scene_to_file(target_scene)


static func consume_pending_spawn() -> String:
	var marker := pending_spawn_marker
	pending_spawn_marker = ""
	return marker
