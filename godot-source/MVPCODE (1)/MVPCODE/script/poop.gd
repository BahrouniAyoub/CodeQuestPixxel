
extends Area2D

@onready var area = $"."
@onready var interaction_image: Sprite2D = $"../pooping"
@onready var music: AudioStreamPlayer2D = $"../AudioStreamPlayer2D"
@onready var text:Label=$"../Label"
var player_nearby := false
var interacting := false
var camera: Camera2D
@onready var text2:Label=$"../Label2"


func _ready():
	text2.hide()
	text.hide()
	interaction_image.visible = false
	camera = get_viewport().get_camera_2d()


func _process(_delta):
	if player_nearby and Input.is_action_just_pressed("interact"):
		text2.show()
		text.hide()
		interacting = !interacting
		interaction_image.visible = interacting

		if interacting:
			music.play()
		else:
			text2.hide()
			music.stop()

	if interacting and is_instance_valid(camera):
		interaction_image.global_position = camera.get_screen_center_position()


func _on_body_entered(body):
	if body.is_in_group("player"):
		player_nearby = true
		text.show()


func _on_body_exited(body):
	if body.is_in_group("player"):
		player_nearby = false
		interacting = false
		interaction_image.visible = false
		music.stop()
		text.hide()
		text2.hide()
