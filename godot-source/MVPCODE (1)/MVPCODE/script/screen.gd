extends Node2D

@onready var color_rect = $ColorRect
@onready var light = $PointLight2D

func _ready():
	color_rect.visible = false
	light.enabled = false

func _on_area_2d_body_entered(body: Node2D):
	if body.is_in_group("player"):
		print("asba")
		color_rect.visible = true
		light.enabled = true

func _on_area_2d_body_exited(body: Node2D):
	if body.is_in_group("player"):
		color_rect.visible = false
		light.enabled = false
