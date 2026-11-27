class_name CityTrafficController
extends Node

signal phase_changed(axis: int, state: String)

var _axis: int = 0
var _state: String = "green"
var _timer: float = 0.0
var _reservations: Dictionary = {}


func _ready() -> void:
	add_to_group("traffic_controller")
	reset()


func _process(delta: float) -> void:
	_tick(delta)


func reset() -> void:
	_axis = 0
	_state = "green"
	_timer = float(CityConfig.TRAFFIC["green"])
	_reservations.clear()
	phase_changed.emit(_axis, _state)


func _tick(delta: float) -> void:
	_timer -= delta
	while _timer <= 0.0:
		match _state:
			"green":
				_state = "yellow"
				_timer = float(CityConfig.TRAFFIC["yellow"])
			"yellow":
				_state = "all_red"
				_timer = float(CityConfig.TRAFFIC["all_red"])
			_:
				_axis = 1 - _axis
				_state = "green"
				_timer = float(CityConfig.TRAFFIC["green"])
		phase_changed.emit(_axis, _state)
	for key in _reservations.keys():
		var entry: Dictionary = _reservations[key]
		entry["time"] = float(entry["time"]) - delta
		var car: Variant = entry.get("car", null)
		if not is_instance_valid(car):
			_reservations.erase(key)
			continue
		if float(entry["time"]) <= 0.0 or not (car is Node):
			_reservations.erase(key)


func state_for_axis(axis: int) -> String:
	if _state == "all_red":
		return "red"
	if axis == _axis:
		return _state
	return "red"


func can_pass(axis: int) -> bool:
	return state_for_axis(axis) == "green"


func can_pedestrian_cross(cross_axis: int) -> bool:
	return state_for_axis(cross_axis) == "red"


func is_axis_red(axis: int) -> bool:
	return state_for_axis(axis) == "red"


func request_entry(node_key: String, axis: int, car: Node) -> bool:
	if not can_pass(axis):
		return false
	var key: String = "%s|%d" % [node_key, car.get_instance_id()]
	var existing: Variant = _reservations.get(key, null)
	if existing is Dictionary:
		(existing as Dictionary)["time"] = float(CityConfig.TRAFFIC["reservation_timeout"])
		return true
	_reservations[key] = {
		"node": node_key,
		"car": car,
		"time": float(CityConfig.TRAFFIC["reservation_timeout"]),
		"axis": axis,
	}
	return true


func release_entry(node_key: String, car: Node) -> void:
	for key in _reservations.keys():
		var entry: Variant = _reservations.get(key, null)
		if entry is Dictionary and (entry as Dictionary).get("node", "") == node_key and (entry as Dictionary).get("car", null) == car:
			_reservations.erase(key)


func has_entry(node_key: String, car: Node) -> bool:
	for key in _reservations.keys():
		var entry: Variant = _reservations.get(key, null)
		if entry is Dictionary and (entry as Dictionary).get("node", "") == node_key and (entry as Dictionary).get("car", null) == car:
			return true
	return false


func debug_state() -> Dictionary:
	return {
		"axis": _axis,
		"state": _state,
		"timer": _timer,
		"reservations": _reservations.size(),
	}
