extends Area2D

@export var desktop_os_url: String = "http://localhost:8080"
@export var interaction_key: Key = KEY_E
@export var prompt_label: Label
@onready var text : Label = $"../Label"

var player_nearby := false

func _ready() -> void:
	text.hide()
	if prompt_label:
		prompt_label.hide()
		

func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		text.show()
		player_nearby = true
		if prompt_label:
			prompt_label.show()

func _on_body_exited(body: Node2D) -> void:
	if body is CharacterBody2D:
		text.hide()
		player_nearby = false
		if prompt_label:
			prompt_label.hide()

func _unhandled_input(event: InputEvent) -> void:
	if not player_nearby:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == interaction_key:
		get_viewport().set_input_as_handled()
		if OS.has_feature("web"):
			# Tell the parent React page to show Pixel OS; do not open a new tab.
			JavaScriptBridge.eval("window.parent.postMessage({type:'codequest:open-os'}, window.location.origin);", true)
		else:
			# Keep desktop Godot behavior intact.
			var error := OS.shell_open(desktop_os_url)
			if error != OK:
				push_error("Unable to open CodeQuest OS: " + str(error))
