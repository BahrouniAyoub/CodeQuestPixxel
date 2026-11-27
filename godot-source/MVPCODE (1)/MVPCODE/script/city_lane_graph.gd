class_name CityLaneGraph
extends RefCounted

var roads: Array[Dictionary] = []
var segments: Dictionary = {}
var sidewalks: Dictionary = {}
var nodes: Dictionary = {}
var links: Dictionary = {}
var _rng := RandomNumberGenerator.new()


func _init() -> void:
	_rng.randomize()
	build()


func build() -> void:
	roads.clear()
	segments.clear()
	sidewalks.clear()
	nodes.clear()
	links.clear()
	_build_roads()
	_build_segments()
	_build_sidewalks()
	_build_links()


func _build_roads() -> void:
	for i in CityConfig.HORIZONTAL_ROADS.size():
		var raw: Dictionary = CityConfig.HORIZONTAL_ROADS[i]
		roads.append({
			"key": "h%d" % i,
			"axis": 0,
			"coord": float(raw["coord"]),
			"kind": String(raw["kind"]),
			"index": i,
			"width": float(CityConfig.ROAD_WIDTHS[String(raw["kind"])]),
		})
	for i in CityConfig.VERTICAL_ROADS.size():
		var raw: Dictionary = CityConfig.VERTICAL_ROADS[i]
		roads.append({
			"key": "v%d" % i,
			"axis": 1,
			"coord": float(raw["coord"]),
			"kind": String(raw["kind"]),
			"index": i,
			"width": float(CityConfig.ROAD_WIDTHS[String(raw["kind"])]),
		})


func _crossings_for(road: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if int(road["axis"]) == 0:
		for other in roads:
			if int(other["axis"]) == 1:
				result.append({
					"road": other,
					"coord": float(other["coord"]),
					"key": intersection_key(int(road["index"]), int(other["index"])),
				})
	else:
		for other in roads:
			if int(other["axis"]) == 0:
				result.append({
					"road": other,
					"coord": float(other["coord"]),
					"key": intersection_key(int(other["index"]), int(road["index"])),
				})
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a["coord"]) < float(b["coord"]))
	return result


func intersection_key(horizontal_index: int, vertical_index: int) -> String:
	return "h%d_v%d" % [horizontal_index, vertical_index]


func _build_segments() -> void:
	for road in roads:
		var axis: int = int(road["axis"])
		var min_edge: float = (-CityConfig.WORLD_SIZE.x if axis == 0 else -CityConfig.WORLD_SIZE.y) / 2.0 + 180.0
		var max_edge: float = (CityConfig.WORLD_SIZE.x if axis == 0 else CityConfig.WORLD_SIZE.y) / 2.0 - 180.0
		var gap: float = float(road["width"]) / 2.0 + 42.0
		var crossings: Array[Dictionary] = _crossings_for(road)
		var points: Array[float] = [min_edge]
		for crossing in crossings:
			points.append(float(crossing["coord"]) - gap)
			points.append(float(crossing["coord"]) + gap)
		points.append(max_edge)
		points.sort()
		_register_node("%s_min" % road["key"], _axis_point(road, min_edge))
		_register_node("%s_max" % road["key"], _axis_point(road, max_edge))
		for crossing in crossings:
			_register_node(String(crossing["key"]), Vector2(
				float(crossing["road"]["coord"]) if axis == 0 else float(road["coord"]),
				float(road["coord"]) if axis == 0 else float(crossing["road"]["coord"]),
			))

		var lane_group: String = "horizontal" if axis == 0 else "vertical"
		var lanes: Dictionary = CityConfig.LANE_OFFSETS[lane_group][String(road["kind"])]
		for direction in [1, -1]:
			var lane_values: Array = lanes[str(direction)]
			for lane_index in lane_values.size():
				var lane: float = float(lane_values[lane_index])
				for pair in range(0, points.size() - 1, 2):
					var low: float = points[pair]
					var high: float = points[pair + 1]
					if high - low < 120.0:
						continue
					var from_value: float = low if direction > 0 else high
					var to_value: float = high if direction > 0 else low
					var id := "%s_%d_%d_%d" % [road["key"], direction, lane_index, int(pair / 2)]
					segments[id] = {
						"id": id,
						"road_key": road["key"],
						"axis": axis,
						"coord": float(road["coord"]),
						"direction": direction,
						"lane": lane,
						"from": _lane_point(road, from_value, lane),
						"to": _lane_point(road, to_value, lane),
						"start_node": _endpoint_node(road, crossings, from_value, gap, min_edge, max_edge),
						"end_node": _endpoint_node(road, crossings, to_value, gap, min_edge, max_edge),
						"length": absf(high - low),
					}


func _register_node(key: String, position: Vector2) -> void:
	if not nodes.has(key):
		nodes[key] = {"key": key, "position": position}


func _axis_point(road: Dictionary, value: float) -> Vector2:
	if int(road["axis"]) == 0:
		return Vector2(value, float(road["coord"]))
	return Vector2(float(road["coord"]), value)


func _lane_point(road: Dictionary, value: float, lane: float) -> Vector2:
	if int(road["axis"]) == 0:
		return Vector2(value, float(road["coord"]) + lane)
	return Vector2(float(road["coord"]) + lane, value)


func _endpoint_node(road: Dictionary, crossings: Array[Dictionary], value: float, gap: float, min_edge: float, max_edge: float) -> String:
	if absf(value - min_edge) < 1.0:
		return "%s_min" % road["key"]
	if absf(value - max_edge) < 1.0:
		return "%s_max" % road["key"]
	for crossing in crossings:
		var center: float = float(crossing["coord"])
		if absf(value - (center - gap)) < 1.0 or absf(value - (center + gap)) < 1.0:
			return String(crossing["key"])
	return "%s_min" % road["key"]


func _build_sidewalks() -> void:
	for road in roads:
		var axis: int = int(road["axis"])
		var min_edge: float = (-CityConfig.WORLD_SIZE.x if axis == 0 else -CityConfig.WORLD_SIZE.y) / 2.0 + 220.0
		var max_edge: float = (CityConfig.WORLD_SIZE.x if axis == 0 else CityConfig.WORLD_SIZE.y) / 2.0 - 220.0
		var gap: float = 70.0
		var crossings: Array[Dictionary] = _crossings_for(road)
		var points: Array[float] = [min_edge]
		for crossing in crossings:
			points.append(float(crossing["coord"]) - gap)
			points.append(float(crossing["coord"]) + gap)
		points.append(max_edge)
		points.sort()
		var offset: float = float(road["width"]) / 2.0 + float(CityConfig.SIDEWALK_WIDTHS[String(road["kind"])]) / 2.0
		for side in [1, -1]:
			for pair in range(0, points.size() - 1, 2):
				var low: float = points[pair]
				var high: float = points[pair + 1]
				if high - low < 100.0:
					continue
				var id := "%s_walk_%d_%d" % [road["key"], side, int(pair / 2)]
				var start_key := "%s_walk_%d" % [road["key"], side] if pair == 0 else _walk_node_key(road, crossings, low, gap)
				var end_key := "%s_walk_%d" % [road["key"], side] if pair + 1 == points.size() - 1 else _walk_node_key(road, crossings, high, gap)
				sidewalks[id] = {
					"id": id,
					"axis": axis,
					"coord": float(road["coord"]) + float(side) * offset,
					"offset": float(side) * offset,
					"from": _axis_point_for_coord(road, low, float(road["coord"]) + float(side) * offset),
					"to": _axis_point_for_coord(road, high, float(road["coord"]) + float(side) * offset),
					"start_node": start_key,
					"end_node": end_key,
				}
				_register_node(start_key, _axis_point_for_coord(road, low, float(road["coord"]) + float(side) * offset))
				_register_node(end_key, _axis_point_for_coord(road, high, float(road["coord"]) + float(side) * offset))


func _axis_point_for_coord(road: Dictionary, value: float, coord: float) -> Vector2:
	if int(road["axis"]) == 0:
		return Vector2(value, coord)
	return Vector2(coord, value)


func _walk_node_key(road: Dictionary, crossings: Array[Dictionary], value: float, gap: float) -> String:
	for crossing in crossings:
		var center: float = float(crossing["coord"])
		if absf(value - (center - gap)) < 1.0:
			return "%s_before" % String(crossing["key"])
		if absf(value - (center + gap)) < 1.0:
			return "%s_after" % String(crossing["key"])
	return "%s_walk_%d" % [road["key"], 0]


func _build_links() -> void:
	for id in segments.keys():
		var outgoing: Array[String] = []
		var segment: Dictionary = segments[id]
		var from_point: Vector2 = segment["from"]
		var to_point: Vector2 = segment["to"]
		var direction: Vector2 = (to_point - from_point).normalized()
		for other_id in segments.keys():
			if other_id == id:
				continue
			var other: Dictionary = segments[other_id]
			if String(other["start_node"]) != String(segment["end_node"]):
				continue
			var other_direction: Vector2 = (Vector2(other["to"]) - Vector2(other["from"])).normalized()
			if direction.dot(other_direction) < -0.4:
				continue
			outgoing.append(other_id)
		links[id] = outgoing


func get_segment(id: String) -> Dictionary:
	return segments.get(id, {})


func get_node_position(key: String) -> Vector2:
	var data: Variant = nodes.get(key, null)
	if data is Dictionary:
		return (data as Dictionary)["position"] as Vector2
	return Vector2.ZERO


func get_outgoing(id: String) -> Array[String]:
	return links.get(id, [])


func is_terminal(id: String) -> bool:
	return get_outgoing(id).is_empty()


func point_on_segment(id: String, progress: float) -> Vector2:
	var segment: Dictionary = segments.get(id, {})
	if segment.is_empty():
		return Vector2.ZERO
	var start: Vector2 = segment["from"]
	var end: Vector2 = segment["to"]
	return start.lerp(end, clampf(progress / maxf(float(segment["length"]), 1.0), 0.0, 1.0))


func direction_on_segment(id: String) -> Vector2:
	var segment: Dictionary = segments.get(id, {})
	if segment.is_empty():
		return Vector2.RIGHT
	return (Vector2(segment["to"]) - Vector2(segment["from"])).normalized()


func choose_next(id: String) -> String:
	var options: Array[String] = get_outgoing(id)
	if options.is_empty():
		return ""
	var current: Vector2 = direction_on_segment(id)
	var straight: Array[String] = []
	var right_turns: Array[String] = []
	for option in options:
		var other: Vector2 = direction_on_segment(option)
		var dot: float = current.dot(other)
		if dot > 0.9:
			straight.append(option)
		elif current.cross(other) > 0.1:
			right_turns.append(option)
	if not straight.is_empty() and (_rng.randf() < 0.65 or right_turns.is_empty()):
		return straight[_rng.randi_range(0, straight.size() - 1)]
	if right_turns.is_empty():
		return "" if straight.is_empty() else straight[_rng.randi_range(0, straight.size() - 1)]
	return right_turns[_rng.randi_range(0, right_turns.size() - 1)]


func turn_curve(from_id: String, to_id: String) -> PackedVector2Array:
	var from_segment: Dictionary = segments.get(from_id, {})
	var to_segment: Dictionary = segments.get(to_id, {})
	if from_segment.is_empty() or to_segment.is_empty():
		return PackedVector2Array()
	var start: Vector2 = from_segment["to"]
	var end: Vector2 = to_segment["from"]
	var control: Vector2 = get_node_position(String(from_segment["end_node"]))
	var points := PackedVector2Array()
	for i in 9:
		var t: float = float(i) / 8.0
		var inv: float = 1.0 - t
		points.append(start * (inv * inv) + control * (2.0 * inv * t) + end * (t * t))
	return points


func polyline_length(points: PackedVector2Array) -> float:
	var total: float = 0.0
	for i in range(points.size() - 1):
		total += points[i].distance_to(points[i + 1])
	return total


func point_on_polyline(points: PackedVector2Array, distance: float) -> Vector2:
	if points.is_empty():
		return Vector2.ZERO
	if points.size() == 1:
		return points[0]
	var remaining: float = maxf(0.0, distance)
	for i in range(points.size() - 1):
		var a: Vector2 = points[i]
		var b: Vector2 = points[i + 1]
		var segment_length: float = a.distance_to(b)
		if remaining <= segment_length:
			return a.lerp(b, remaining / maxf(segment_length, 0.001))
		remaining -= segment_length
	return points[points.size() - 1]


func tangent_on_polyline(points: PackedVector2Array, distance: float) -> Vector2:
	if points.size() < 2:
		return Vector2.RIGHT
	var remaining: float = maxf(0.0, distance)
	for i in range(points.size() - 1):
		var a: Vector2 = points[i]
		var b: Vector2 = points[i + 1]
		var segment_length: float = a.distance_to(b)
		if remaining <= segment_length:
			return (b - a).normalized()
		remaining -= segment_length
	return (points[points.size() - 1] - points[points.size() - 2]).normalized()


func random_segment_near(center: Vector2, min_radius: float, max_radius: float) -> String:
	var candidates: Array[String] = []
	for id in segments.keys():
		var segment: Dictionary = segments[id]
		var midpoint: Vector2 = (Vector2(segment["from"]) + Vector2(segment["to"])) * 0.5
		var distance: float = midpoint.distance_to(center)
		if distance >= min_radius and distance <= max_radius:
			candidates.append(id)
	if candidates.is_empty():
		return ""
	return candidates[_rng.randi_range(0, candidates.size() - 1)]


func random_sidewalk_near(center: Vector2, min_radius: float, max_radius: float) -> String:
	var candidates: Array[String] = []
	for id in sidewalks.keys():
		var walk: Dictionary = sidewalks[id]
		var midpoint: Vector2 = (Vector2(walk["from"]) + Vector2(walk["to"])) * 0.5
		var distance: float = midpoint.distance_to(center)
		if distance >= min_radius and distance <= max_radius:
			candidates.append(id)
	if candidates.is_empty():
		return ""
	return candidates[_rng.randi_range(0, candidates.size() - 1)]


func sidewalk_crossing_point(walk_id: String, use_end: bool) -> Dictionary:
	var walk: Dictionary = sidewalks.get(walk_id, {})
	if walk.is_empty():
		return {}
	var node_key: String = String(walk["end_node"] if use_end else walk["start_node"])
	var node_position: Vector2 = get_node_position(node_key)
	var direction: Vector2 = (Vector2(walk["to"]) - Vector2(walk["from"])).normalized()
	var across: Vector2 = direction if use_end else -direction
	var crossing_axis: int = 1 - int(walk["axis"])
	var point: Vector2 = node_position + across * 94.0
	if int(walk["axis"]) == 0:
		point.y = float(walk["coord"])
	else:
		point.x = float(walk["coord"])
	return {"point": point, "axis": crossing_axis, "node": node_key}
