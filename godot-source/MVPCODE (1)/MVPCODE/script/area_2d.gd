
extends Area2D

@onready var customizer: CanvasItem = $"../Customizer"
@onready var text: Label = $"../Label"
var player_nearby: bool = false

func _ready() -> void:
	customizer.hide()
	text.hide()

func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = true
		text.show()

func _on_body_exited(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = false
		customizer.hide()
		text.hide()

func _unhandled_input(event: InputEvent) -> void:
	if not player_nearby:
		return

	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_E:
			text.hide()
			customizer.visible = not customizer.visible
			get_viewport().set_input_as_handled()
