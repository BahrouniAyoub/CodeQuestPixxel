extends Node

var body_index := 0
var skin_index := 0
var hair_style_index := 0
var hair_color_index := 0
var top_index := 0
var bottom_index := 0
var feet_index := 0
var character_name := ""
var car_permission := false
var city_vehicle_states: Dictionary = {}
var city_npc_states: Dictionary = {}


func clear_city_simulation_state() -> void:
	city_vehicle_states.clear()
	city_npc_states.clear()
