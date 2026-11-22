extends Node

## Backward-compatible signal used by existing HUD/UI code.
signal objective_changed(title: String, description: String)
## Rich quest snapshot for HUD and journal.
signal quest_state_changed(snapshot: Dictionary)
signal journal_open_changed(is_open: bool)

const QUEST_MARKER = preload("res://scene/QuestMarker.tscn")

var marker: Node2D
var current_target: Node2D

# Backward-compatible fields.
var current_objective := ""
var current_description := ""

var journal_open := false

var _current_snapshot: Dictionary = {}
var _marker_retry_left := 0.0


func _ready():
	marker = QUEST_MARKER.instantiate()
	marker.visible = false
	if not CodeQuestStateSync.chapter_state_changed.is_connected(_on_chapter_state_changed):
		CodeQuestStateSync.chapter_state_changed.connect(_on_chapter_state_changed)
	# Apply initial state after the scene has a chance to load.
	call_deferred("_refresh_from_bridge")


func _process(delta: float) -> void:
	if _marker_retry_left <= 0.0:
		return
	_marker_retry_left = maxf(_marker_retry_left - delta, 0.0)
	if _apply_marker_for_snapshot(_current_snapshot):
		_marker_retry_left = 0.0


func _refresh_from_bridge() -> void:
	apply_snapshot(CodeQuestBridge.get_active_quest_snapshot())


func _on_chapter_state_changed(_state: Dictionary) -> void:
	# Read through the bridge so web/native fallbacks stay consistent.
	_refresh_from_bridge()


func get_snapshot() -> Dictionary:
	return _current_snapshot.duplicate(true)


func set_journal_open(is_open: bool) -> void:
	if journal_open == is_open:
		return
	journal_open = is_open
	journal_open_changed.emit(journal_open)


func toggle_journal() -> void:
	set_journal_open(not journal_open)


func apply_snapshot(snapshot: Dictionary) -> void:
	_current_snapshot = snapshot.duplicate(true)

	var chapter_complete := bool(snapshot.get("chapterComplete", false))
	var quest_title := String(snapshot.get("questTitle", ""))
	var quest_objective := String(snapshot.get("questObjective", ""))
	var quest_description := String(snapshot.get("questDescription", ""))
	var chapter_title := String(snapshot.get("chapterTitle", "Chapter 1 — The First Paycheck"))

	if chapter_complete:
		current_objective = "Chapter 1 complete"
		current_description = "You finished your first programming job. Take a moment to explore!"
	else:
		current_objective = quest_objective
		current_description = quest_description

	# Backward-compatible signal: title=objective, description=description.
	objective_changed.emit(current_objective, current_description)
	quest_state_changed.emit(get_snapshot())
	_apply_marker_for_snapshot(snapshot)


func _apply_marker_for_snapshot(snapshot: Dictionary) -> bool:
	var quest_id := String(snapshot.get("questId", ""))
	var chapter_complete := bool(snapshot.get("chapterComplete", false))

	if chapter_complete or quest_id.is_empty():
		hide_marker()
		return true

	var target_info := _target_for_quest(quest_id)
	if target_info.is_empty():
		hide_marker()
		return true

	var scene := get_tree().current_scene
	if not is_instance_valid(scene):
		_marker_retry_left = 2.0
		return false

	var target := scene.get_node_or_null(String(target_info.get("path", "")))
	if not is_instance_valid(target):
		# Scene may not be ready yet; retry briefly.
		_marker_retry_left = 2.0
		return false

	var offset: Vector2 = target_info.get("offset", Vector2(0, -45))
	show_marker(target, offset)
	return true


func _target_for_quest(quest_id: String) -> Dictionary:
	match quest_id:
		"CH1-01":
			return {"path": "father", "offset": Vector2(0, -45)}
		"CH1-02":
			return {"path": "screen", "offset": Vector2(35, -2)}
		"CH1-08":
			return {"path": "father", "offset": Vector2(0, -45)}
		_:
			# CH1-03..CH1-07 happen in PixelOS; no world marker.
			return {}


## Backward-compatible API.
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


func hide_marker():
	if is_instance_valid(marker) and marker.get_parent():
		marker.get_parent().remove_child(marker)

	marker.visible = false
	current_target = null


func complete_quest():
	hide_marker()
	set_objective("Quest completed!", "You completed your objective.")
