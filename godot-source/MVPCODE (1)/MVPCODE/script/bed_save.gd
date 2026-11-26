extends Area2D

@onready var text: Label = $Label

var player_nearby := false
var saved_timer: Timer


func _ready() -> void:
	text.hide()
	saved_timer = Timer.new()
	saved_timer.one_shot = true
	saved_timer.wait_time = 1.6
	saved_timer.timeout.connect(_restore_prompt)
	add_child(saved_timer)


func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = true
		_restore_prompt()
		text.show()


func _on_body_exited(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = false
		text.hide()


func _unhandled_input(event: InputEvent) -> void:
	if not player_nearby:
		return
	if QuestManager.journal_open:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_E:
		get_viewport().set_input_as_handled()
		var save_menu := get_tree().get_first_node_in_group("save_menu")
		if save_menu != null and save_menu.has_method("open"):
			save_menu.call("open")


func _character_snapshot() -> Dictionary:
	var body_index := CharacterSettings.body_index
	var skin_index := CharacterSettings.skin_index
	var hair_style_index := CharacterSettings.hair_style_index
	var hair_color_index := CharacterSettings.hair_color_index
	var top_index := CharacterSettings.top_index
	var bottom_index := CharacterSettings.bottom_index
	var feet_index := CharacterSettings.feet_index
	var player := get_tree().get_first_node_in_group("player") as CharacterBody2D

	if player != null:
		body_index = player.body_index
		skin_index = player.skin_index
		hair_style_index = player.hair_style_index
		hair_color_index = player.hair_color_index
		top_index = player.top_index
		bottom_index = player.bottom_index
		feet_index = player.feet_index

	return CodeQuestBridge.make_character_snapshot(
		CharacterSettings.character_name,
		body_index,
		skin_index,
		hair_style_index,
		hair_color_index,
		top_index,
		bottom_index,
		feet_index
	)


func _restore_prompt() -> void:
	text.text = "Press E to Rest & Save"
