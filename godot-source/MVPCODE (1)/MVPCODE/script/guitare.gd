
extends Area2D

@onready var interaction_image: Sprite2D = $"../interaction_image"
@onready var text: Label=$"../Label"
@onready var songs: Array[AudioStreamPlayer2D] = [
	$"../Song1",
	$"../Song2",
	$"../Song3",
	$"../Song4"
]

var player_nearby := false
var interacting := false
var camera: Camera2D
var last_song_index := -1


func _ready():
	text.hide()
	
	interaction_image.visible = false
	camera = get_viewport().get_camera_2d()

	for song in songs:
		song.finished.connect(_on_song_finished)


func _process(_delta):
	if player_nearby and Input.is_action_just_pressed("interact"):
		text.hide()
		interacting = !interacting
		interaction_image.visible = interacting

		if interacting:
			play_random_song()
		else:
			stop_all_songs()

	if interacting and is_instance_valid(camera):
		interaction_image.global_position = camera.get_screen_center_position()


func play_random_song():
	if not interacting:
		return

	var new_index = randi_range(0, songs.size() - 1)

	while songs.size() > 1 and new_index == last_song_index:
		new_index = randi_range(0, songs.size() - 1)

	last_song_index = new_index
	songs[new_index].play()


func _on_song_finished():
	if interacting:
		play_random_song()


func stop_all_songs():
	for song in songs:
		song.stop()


func _on_body_entered(body):
	
	if body.is_in_group("player"):
		player_nearby = true
		text.show()


func _on_body_exited(body):
	
	if body.is_in_group("player"):
		player_nearby = false
		interacting = false
		interaction_image.visible = false
		stop_all_songs()
		text.hide()
