
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
		_close_customizer()
		text.hide()


func _close_customizer() -> void:
	if customizer.visible and customizer.has_method("save_appearance"):
		customizer.call("save_appearance")
	customizer.hide()


func _unhandled_input(event: InputEvent) -> void:
	if not player_nearby:
		return

	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_E:
			text.hide()
			if customizer.visible:
				_close_customizer()
			else:
				if customizer.has_method("refresh_appearance"):
					customizer.call("refresh_appearance")
				customizer.show()
			get_viewport().set_input_as_handled()
