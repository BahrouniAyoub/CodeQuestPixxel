extends Node

signal objective_changed(title: String, description: String)

const QUEST_MARKER = preload("res://scene/QuestMarker.tscn")

var marker: Node2D
var current_target: Node2D

var current_objective := ""
var current_description := ""


func _ready():
	marker = QUEST_MARKER.instantiate()
	marker.visible = false


func set_objective(title: String, description: String):
	current_objective = title
	current_description = description

	objective_changed.emit(title, description)


func show_marker(target: Node2D, marker_offset: Vector2 = Vector2(0, -60)):
	if not is_instance_valid(target):
		return

	if marker.get_parent():
		marker.get_parent().remove_child(marker)

	current_target = target
	target.add_child(marker)

	marker.position = marker_offset
	marker.visible = true

	var animated_sprite = marker.get_node_or_null("AnimatedSprite2D")

	if animated_sprite:
		animated_sprite.play("default")


func complete_quest():
	if is_instance_valid(marker) and marker.get_parent():
		marker.get_parent().remove_child(marker)

	marker.visible = false
	current_target = null

	set_objective("Quest completed!", "You completed your objective.")
