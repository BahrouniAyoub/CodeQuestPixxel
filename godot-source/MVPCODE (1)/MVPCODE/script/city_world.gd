extends Node2D

const ASSET_DIR := "res://assests/city_assets/"

const ROAD_COLOR := Color("#414751")
const ROAD_LINE_COLOR := Color("#e8d77a")
const SIDEWALK_COLOR := Color("#b7b1a3")
const DIRT_COLOR := Color("#7a6247")
const GRASS_DARK := Color("#6f8c5c")
const WINDOW_COLOR := Color("#f7d98a")
const WINDOW_DARK := Color("#334654")

var graph: CityLaneGraph
var controller: CityTrafficController

var _building_root: Node2D
var _decor_root: Node2D
var _light_root: Node2D
var _npc_root: Node2D
var _car_root: Node2D
var _collision_root: Node2D
var _chunk_root: Node2D

var _chunks: Dictionary = {}
var _lamps: Array[PointLight2D] = []
var _traffic: Array[CityCar] = []
var _pedestrians: Array[CityNpc] = []
var _next_traffic_id: int = 0
var _next_npc_id: int = 0
var _scheduled_pedestrian: CityNpc = null


func _ready() -> void:
	randomize()
	_building_root = _make_root("Buildings")
	_decor_root = _make_root("Decor")
	_light_root = _make_root("Lights")
	_npc_root = _make_root("People")
	_car_root = _make_root("Cars")
	_collision_root = _make_root("Collision")
	_chunk_root = _make_root("Chunks")
	controller = CityTrafficController.new()
	controller.name = "TrafficController"
	add_child(controller)
	graph = CityLaneGraph.new()

	var ambience := CityAudio.create_player(self, CityAudio.ambience_stream(), float(CityConfig.AUDIO["ambience_volume_db"]))
	ambience.name = "Ambience"
	ambience.play()

	_rect(Vector2.ZERO, CityConfig.WORLD_SIZE, CityConfig.GRASS_COLOR, -40, self)
	_add_parking_bays()
	_add_home_and_garage()
	_add_traffic_lights()
	_add_traffic()
	_add_parked_cars()
	_add_player_car()
	_add_birds()
	_add_world_bounds()
	_update_chunks(_camera_center())


func _process(_delta: float) -> void:
	var center := _camera_center()
	_update_chunks(center)
	_update_traffic(center)
	_update_pedestrians(center)
	_update_lamp_energy()


func _make_root(name: String) -> Node2D:
	var node := Node2D.new()
	node.name = name
	add_child(node)
	return node


func _camera_center() -> Vector2:
	var camera := get_viewport().get_camera_2d()
	if is_instance_valid(camera):
		return camera.get_screen_center_position()
	return Vector2.ZERO


func _update_chunks(center: Vector2) -> void:
	var size: float = float(CityConfig.SPAWN["chunk_size"])
	var radius: int = int(CityConfig.SPAWN["chunk_radius"])
	var cx: int = int(floor(center.x / size))
	var cy: int = int(floor(center.y / size))
	for x in range(cx - radius, cx + radius + 1):
		for y in range(cy - radius, cy + radius + 1):
			var key := "%d_%d" % [x, y]
			if not _chunks.has(key):
				_chunks[key] = _build_chunk(key, x, y)
			var chunk: Node2D = _chunks[key]
			if is_instance_valid(chunk):
				chunk.visible = true
	for key in _chunks.keys():
		var coordinates: PackedStringArray = String(key).split("_")
		if coordinates.size() < 2:
			continue
		var x: int = int(coordinates[0])
		var y: int = int(coordinates[1])
		if absi(x - cx) > radius or absi(y - cy) > radius:
			var chunk: Node2D = _chunks[key]
			if is_instance_valid(chunk):
				chunk.visible = false


func _build_chunk(key: String, cx: int, cy: int) -> Node2D:
	var root := Node2D.new()
	root.name = "Chunk_" + key
	_chunk_root.add_child(root)
	var size: float = float(CityConfig.SPAWN["chunk_size"])
	var center := Vector2((float(cx) + 0.5) * size, (float(cy) + 0.5) * size)
	var half: float = size / 2.0
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(key)
	_add_chunk_roads(root, center, half)
	_add_chunk_buildings(root, center, half, rng)
	_add_chunk_lamps(root, center, half)
	_add_chunk_trees(root, center, half, rng)
	return root


func _add_chunk_roads(parent: Node2D, center: Vector2, half: float) -> void:
	var size: float = half * 2.0
	for road in graph.roads:
		var width: float = float(road["width"])
		var sidewalk_width: float = float(CityConfig.SIDEWALK_WIDTHS[String(road["kind"])])
		var coord: float = float(road["coord"])
		if int(road["axis"]) == 0:
			if absf(coord - center.y) > half + width / 2.0 + sidewalk_width:
				continue
			_rect(Vector2(center.x, coord), Vector2(size, width), ROAD_COLOR, -30, parent)
			_rect(Vector2(center.x, coord - width / 2.0 - sidewalk_width / 2.0), Vector2(size, sidewalk_width), SIDEWALK_COLOR, -28, parent)
			_rect(Vector2(center.x, coord + width / 2.0 + sidewalk_width / 2.0), Vector2(size, sidewalk_width), SIDEWALK_COLOR, -28, parent)
			if String(road["kind"]) == "main":
				_rect(Vector2(center.x, coord - 5.0), Vector2(size, 5.0), ROAD_LINE_COLOR, -27, parent)
				_rect(Vector2(center.x, coord + 5.0), Vector2(size, 5.0), ROAD_LINE_COLOR, -27, parent)
			else:
				_rect(Vector2(center.x, coord), Vector2(size, 5.0), ROAD_LINE_COLOR, -27, parent)
			for side in [-1, 1]:
				var marker_y: float = coord + float(side) * (width / 2.0 - 12.0)
				_rect(Vector2(center.x, marker_y), Vector2(size, 4.0), Color("#d8d2c4"), -26, parent)
			for i in range(int(size / 180.0)):
				var x: float = center.x - half + 90.0 + float(i) * 180.0
				if _near_crossing(x, 0, 170.0):
					continue
				for side in [-1, 1]:
					var lane_y: float = coord + float(side) * (width / 4.0 + 8.0)
					_rect(Vector2(x, lane_y), Vector2(70.0, 4.0), Color("#d8d2c4"), -26, parent)
			for vertical in CityConfig.VERTICAL_ROADS:
				var x: float = float(vertical["coord"])
				if x < center.x - half or x >= center.x + half:
					continue
				var v_width: float = float(CityConfig.ROAD_WIDTHS[String(vertical["kind"])])
				var v_sidewalk: float = float(CityConfig.SIDEWALK_WIDTHS[String(vertical["kind"])])
				var cross_offset: float = v_width / 2.0 + v_sidewalk / 2.0
				var cross_span: float = v_width - 2.0 * float(CityConfig.CROSSWALK["stripe_margin"])
				for side in [-1, 1]:
					_add_crosswalk(Vector2(x + float(side) * cross_offset, coord), true, cross_span, width, parent)
		else:
			if absf(coord - center.x) > half + width / 2.0 + sidewalk_width:
				continue
			_rect(Vector2(coord, center.y), Vector2(width, size), ROAD_COLOR, -30, parent)
			_rect(Vector2(coord - width / 2.0 - sidewalk_width / 2.0, center.y), Vector2(sidewalk_width, size), SIDEWALK_COLOR, -28, parent)
			_rect(Vector2(coord + width / 2.0 + sidewalk_width / 2.0, center.y), Vector2(sidewalk_width, size), SIDEWALK_COLOR, -28, parent)
			if String(road["kind"]) == "main":
				_rect(Vector2(coord - 5.0, center.y), Vector2(5.0, size), ROAD_LINE_COLOR, -27, parent)
				_rect(Vector2(coord + 5.0, center.y), Vector2(5.0, size), ROAD_LINE_COLOR, -27, parent)
			else:
				_rect(Vector2(coord, center.y), Vector2(5.0, size), ROAD_LINE_COLOR, -27, parent)
			for side in [-1, 1]:
				var marker_x: float = coord + float(side) * (width / 2.0 - 12.0)
				_rect(Vector2(marker_x, center.y), Vector2(4.0, size), Color("#d8d2c4"), -26, parent)
			for i in range(int(size / 180.0)):
				var y: float = center.y - half + 90.0 + float(i) * 180.0
				if _near_crossing(y, 1, 170.0):
					continue
				for side in [-1, 1]:
					var lane_x: float = coord + float(side) * (width / 4.0 + 8.0)
					_rect(Vector2(lane_x, y), Vector2(4.0, 70.0), Color("#d8d2c4"), -26, parent)
			for horizontal in CityConfig.HORIZONTAL_ROADS:
				var y: float = float(horizontal["coord"])
				if y < center.y - half or y >= center.y + half:
					continue
				var h_width: float = float(CityConfig.ROAD_WIDTHS[String(horizontal["kind"])])
				var h_sidewalk: float = float(CityConfig.SIDEWALK_WIDTHS[String(horizontal["kind"])])
				var cross_offset: float = h_width / 2.0 + h_sidewalk / 2.0
				var cross_span: float = h_width - 2.0 * float(CityConfig.CROSSWALK["stripe_margin"])
				for side in [-1, 1]:
					_add_crosswalk(Vector2(coord, y + float(side) * cross_offset), false, cross_span, width, parent)


func _add_crosswalk(center: Vector2, vertical_stripes: bool, span: float, depth: float, parent: Node2D) -> void:
	var stripe_width: float = float(CityConfig.CROSSWALK["stripe_width"])
	var stripe_spacing: float = float(CityConfig.CROSSWALK["stripe_spacing"])
	var usable: float = maxf(span - stripe_width, 1.0)
	var count: int = maxi(3, int(usable / stripe_spacing) + 1)
	var step: float = usable / float(count - 1)
	var stripe_depth: float = depth + float(CityConfig.CROSSWALK["depth_padding"])
	for i in count:
		var offset: float = -usable / 2.0 + step * float(i)
		if vertical_stripes:
			_rect(Vector2(center.x + offset, center.y), Vector2(stripe_width, stripe_depth), CityConfig.CROSSWALK_COLOR, -25, parent)
		else:
			_rect(Vector2(center.x, center.y + offset), Vector2(stripe_depth, stripe_width), CityConfig.CROSSWALK_COLOR, -25, parent)


func _near_crossing(value: float, axis: int, buffer: float) -> bool:
	var crossings: Array = CityConfig.VERTICAL_ROADS if axis == 0 else CityConfig.HORIZONTAL_ROADS
	for other in crossings:
		var road: Dictionary = other
		if absf(value - float(road["coord"])) < float(CityConfig.ROAD_WIDTHS[String(road["kind"])]) / 2.0 + buffer:
			return true
	return false


func _add_chunk_buildings(parent: Node2D, center: Vector2, half: float, rng: RandomNumberGenerator) -> void:
	for bx in CityConfig.BLOCK_CENTERS_X:
		if bx < center.x - half or bx >= center.x + half:
			continue
		for by in CityConfig.BLOCK_CENTERS_Y:
			if by < center.y - half or by >= center.y + half:
				continue
			var pos := Vector2(bx, by)
			if absf(pos.x) > CityConfig.WORLD_SIZE.x / 2.0 - 400.0 or absf(pos.y) > CityConfig.WORLD_SIZE.y / 2.0 - 400.0:
				continue
			if absf(pos.x - float(CityConfig.GARAGE["building"].x)) < 900.0 and absf(pos.y - float(CityConfig.GARAGE["building"].y)) < 900.0:
				continue
			var kind: int = rng.randi_range(0, 7)
			if kind == 0:
				_add_park(pos, parent, rng)
			elif kind == 1:
				_add_plaza(pos, parent, rng)
			else:
				var size := Vector2(rng.randf_range(380.0, 470.0), rng.randf_range(320.0, 400.0))
				var color: Color = Color("#7b8794") if rng.randf() < 0.5 else Color("#6f7f8b")
				var label: String = ["CITY BLOCK", "SHOPS", "APARTMENTS", "OFFICES", "STUDIO"][rng.randi_range(0, 4)]
				_add_building(pos, size, color, label, parent)


func _near_road(pos: Vector2, clearance: float) -> bool:
	for road in graph.roads:
		var coord: float = float(road["coord"])
		var axis: int = int(road["axis"])
		var value: float = pos.x if axis == 0 else pos.y
		if absf(value - coord) < float(road["width"]) / 2.0 + clearance:
			return true
	return false


func _add_park(pos: Vector2, parent: Node2D, rng: RandomNumberGenerator) -> void:
	var size := Vector2(rng.randf_range(320.0, 480.0), rng.randf_range(300.0, 440.0))
	_rect(pos, size, CityConfig.PARK_COLOR, -18, parent)
	for i in 7:
		var tree_pos := pos + Vector2(rng.randf_range(-size.x * 0.38, size.x * 0.38), rng.randf_range(-size.y * 0.38, size.y * 0.38))
		_add_tree(tree_pos, rng.randf_range(0.8, 1.5), parent)
	var bench := _rect(pos + Vector2(0.0, size.y * 0.25), Vector2(90.0, 22.0), Color("#7b6246"), -14, parent)
	bench.z_index = -14


func _add_plaza(pos: Vector2, parent: Node2D, rng: RandomNumberGenerator) -> void:
	var size := Vector2(rng.randf_range(300.0, 420.0), rng.randf_range(280.0, 380.0))
	_rect(pos, size, CityConfig.PLAZA_COLOR, -18, parent)
	_add_circle(pos, 42.0, Color("#7fa2c0"), -16, parent)
	_add_circle(pos, 26.0, Color("#9fc8d8"), -15, parent)
	for i in 4:
		_add_tree(pos + Vector2(rng.randf_range(-size.x * 0.4, size.x * 0.4), rng.randf_range(-size.y * 0.4, size.y * 0.4)), rng.randf_range(0.7, 1.2), parent)


func _add_building(pos: Vector2, size: Vector2, color: Color, label: String, parent: Node2D) -> void:
	_rect(pos + Vector2(10.0, 12.0), size, Color(0.0, 0.0, 0.0, 0.18), -14, parent)
	_rect(pos, size, color, -12, parent)
	_rect(pos + Vector2(0.0, -size.y / 2.0 + 10.0), Vector2(size.x, 18.0), color.darkened(0.25), -11, parent)
	var cols: int = maxi(2, int(size.x / 76.0))
	var rows: int = maxi(2, int(size.y / 62.0))
	for r in rows:
		for c in cols:
			var wx: float = pos.x - size.x / 2.0 + 48.0 + float(c) * 70.0
			var wy: float = pos.y - size.y / 2.0 + 52.0 + float(r) * 58.0
			if wx > pos.x + size.x / 2.0 - 25.0 or wy > pos.y + size.y / 2.0 - 20.0:
				continue
			var window_color: Color = WINDOW_COLOR if (r + c) % 3 != 0 else WINDOW_DARK
			_rect(Vector2(wx, wy), Vector2(30.0, 24.0), window_color, -10, parent)
	var sign := Label.new()
	sign.text = label
	sign.position = pos + Vector2(-70.0, -14.0)
	sign.size = Vector2(140.0, 28.0)
	sign.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sign.add_theme_font_size_override("font_size", 18)
	sign.add_theme_color_override("font_color", Color.WHITE)
	sign.z_index = -9
	parent.add_child(sign)
	_static_body(pos, size, parent)


func _add_tree(pos: Vector2, scale_value: float, parent: Node2D) -> void:
	var trunk := _rect(pos + Vector2(0.0, 18.0 * scale_value), Vector2(14.0 * scale_value, 48.0 * scale_value), Color("#6b4b32"), -22, parent)
	trunk.z_index = -22
	_add_circle(pos + Vector2(-18.0, -8.0) * scale_value, 35.0 * scale_value, Color("#3f7a43"), -21, parent)
	_add_circle(pos + Vector2(18.0, -10.0) * scale_value, 34.0 * scale_value, Color("#4c8a4c"), -21, parent)
	_add_circle(pos + Vector2(0.0, -34.0) * scale_value, 40.0 * scale_value, Color("#559752"), -21, parent)


func _add_circle(pos: Vector2, radius: float, color: Color, z: int, parent: Node2D) -> Polygon2D:
	var polygon := Polygon2D.new()
	polygon.position = pos
	polygon.z_index = z
	var points := PackedVector2Array()
	for i in 12:
		var angle: float = TAU * float(i) / 12.0
		points.append(Vector2(cos(angle), sin(angle)) * radius)
	polygon.polygon = points
	polygon.color = color
	parent.add_child(polygon)
	return polygon


func _add_chunk_lamps(parent: Node2D, center: Vector2, half: float) -> void:
	var spacing: float = float(CityConfig.TILE) * float(CityConfig.SPAWN["lamp_spacing_tiles"])
	for road in graph.roads:
		var axis: int = int(road["axis"])
		var coord: float = float(road["coord"])
		var width: float = float(road["width"])
		var sidewalk_width: float = float(CityConfig.SIDEWALK_WIDTHS[String(road["kind"])])
		var offset: float = width / 2.0 + sidewalk_width / 2.0
		var extent: float = CityConfig.WORLD_SIZE.x if axis == 0 else CityConfig.WORLD_SIZE.y
		var start: float = -extent / 2.0 + spacing * 0.5
		var end: float = extent / 2.0 - spacing * 0.5
		var value: float = start
		while value <= end:
			if not _near_crossing(value, axis, 240.0):
				for side in [-1, 1]:
					var pos: Vector2 = Vector2(value, coord + float(side) * offset) if axis == 0 else Vector2(coord + float(side) * offset, value)
					if pos.x >= center.x - half and pos.x < center.x + half and pos.y >= center.y - half and pos.y < center.y + half:
						_add_lamp(pos, parent)
			value += spacing


func _add_lamp(pos: Vector2, parent: Node2D) -> void:
	var sprite := Sprite2D.new()
	sprite.texture = _atlas(ASSET_DIR + "street-lamp-selout-64.png", 0, 0)
	sprite.position = pos
	sprite.scale = Vector2(1.7, 1.7)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.z_index = -3
	parent.add_child(sprite)

	var light := PointLight2D.new()
	light.texture = _glow_texture()
	light.texture_scale = 2.6
	light.energy = 1.1
	light.color = Color("#ffd28a")
	light.position = pos + Vector2(0.0, -52.0)
	light.z_index = 5
	parent.add_child(light)
	_lamps.append(light)


func _add_chunk_trees(parent: Node2D, center: Vector2, half: float, rng: RandomNumberGenerator) -> void:
	for road in graph.roads:
		if String(road["kind"]) != "secondary":
			continue
		var axis: int = int(road["axis"])
		var coord: float = float(road["coord"])
		var extent: float = CityConfig.WORLD_SIZE.x if axis == 0 else CityConfig.WORLD_SIZE.y
		var value: float = -extent / 2.0 + 240.0
		while value < extent / 2.0 - 240.0:
			var pos: Vector2 = Vector2(value, coord - 420.0) if axis == 0 else Vector2(coord - 420.0, value)
			if absf(pos.x - center.x) <= half and absf(pos.y - center.y) <= half and rng.randf() < 0.5:
				_add_tree(pos, rng.randf_range(0.9, 1.6), parent)
			value += 720.0


func _add_home_and_garage() -> void:
	var home: Vector2 = CityConfig.GARAGE["home"]
	var garage: Vector2 = CityConfig.GARAGE["building"]
	var driveway: Vector2 = CityConfig.GARAGE["car"]
	var door_y: float = garage.y + 166.0
	_add_building(home, Vector2(420.0, 300.0), Color("#c07a5b"), "HOME", _building_root)
	_add_building(garage, Vector2(400.0, 300.0), Color("#718292"), "GARAGE", _building_root)
	_rect(Vector2(garage.x, door_y), Vector2(270.0, 105.0), Color("#252a31"), -8, _building_root)
	_rect(Vector2(garage.x, door_y + 50.0), Vector2(300.0, 18.0), Color("#353b45"), -7, _building_root)
	for side in [-1, 1]:
		_rect(Vector2(garage.x + float(side) * 155.0, door_y), Vector2(30.0, 125.0), Color("#5a6672"), -7, _building_root)
		_add_tree(Vector2(garage.x + float(side) * 252.0, door_y + 26.0), 0.8, _building_root)
	_rect(driveway, Vector2(340.0, 220.0), Color("#60666e"), -29, _building_root)
	for side in [-1, 1]:
		_rect(Vector2(driveway.x + float(side) * 140.0, driveway.y), Vector2(8.0, 200.0), Color("#d8d2c4"), -26, _building_root)
	_rect(Vector2(driveway.x, driveway.y + 100.0), Vector2(300.0, 8.0), Color("#d8d2c4"), -26, _building_root)
	_add_lamp(Vector2(garage.x + 260.0, driveway.y), _building_root)
	_rect(Vector2(home.x, -380.0), Vector2(90.0, 220.0), SIDEWALK_COLOR, -27, self)
	_rect(Vector2(garage.x, -380.0), Vector2(90.0, 220.0), SIDEWALK_COLOR, -27, self)
	var door := Area2D.new()
	door.name = "HouseExit"
	door.collision_layer = 1
	door.collision_mask = 1
	door.script = load("res://script/scene_door.gd")
	door.set("target_scene", "res://scene/Game.tscn")
	door.set("target_spawn_marker", "FromCitySpawn")
	var door_shape := CollisionShape2D.new()
	var door_rect := RectangleShape2D.new()
	door_rect.size = Vector2(90.0, 36.0)
	door_shape.shape = door_rect
	door.add_child(door_shape)
	door.add_child(_make_prompt("Press E to Enter Home"))
	door.set("prompt_label", NodePath("Prompt"))
	door.position = Vector2(home.x, home.y + 166.0)
	add_child(door)


func _make_prompt(text: String) -> Label:
	var prompt := Label.new()
	prompt.name = "Prompt"
	prompt.text = text
	prompt.position = Vector2(-100.0, -54.0)
	prompt.size = Vector2(200.0, 28.0)
	prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt.add_theme_font_size_override("font_size", 16)
	prompt.add_theme_color_override("font_color", Color.WHITE)
	prompt.add_theme_color_override("font_shadow_color", Color.BLACK)
	prompt.add_theme_constant_override("shadow_offset_x", 2)
	prompt.add_theme_constant_override("shadow_offset_y", 2)
	prompt.z_index = 8
	return prompt


func _add_traffic_lights() -> void:
	var script := load("res://script/city_traffic_light.gd")
	for h_index in CityConfig.HORIZONTAL_ROADS.size():
		for v_index in CityConfig.VERTICAL_ROADS.size():
			var h_road: Dictionary = CityConfig.HORIZONTAL_ROADS[h_index]
			var v_road: Dictionary = CityConfig.VERTICAL_ROADS[v_index]
			var h_coord: float = float(h_road["coord"])
			var v_coord: float = float(v_road["coord"])
			var signal_inset: float = float(CityConfig.TRAFFIC["signal_inset"])
			var h_offset: float = float(CityConfig.ROAD_WIDTHS[String(h_road["kind"])]) / 2.0 + float(CityConfig.SIDEWALK_WIDTHS[String(h_road["kind"])]) - signal_inset
			var v_offset: float = float(CityConfig.ROAD_WIDTHS[String(v_road["kind"])]) / 2.0 + float(CityConfig.SIDEWALK_WIDTHS[String(v_road["kind"])]) - signal_inset
			var key: String = graph.intersection_key(h_index, v_index)
			_add_light(script, Vector2(v_coord - v_offset, h_coord - h_offset), 1, key, 0)
			_add_light(script, Vector2(v_coord + v_offset, h_coord + h_offset), 1, key, 2)
			_add_light(script, Vector2(v_coord + v_offset, h_coord - h_offset), 0, key, 3)
			_add_light(script, Vector2(v_coord - v_offset, h_coord + h_offset), 0, key, 1)


func _add_light(script: Script, position: Vector2, axis: int, intersection_key: String, facing: int) -> void:
	var light := Node2D.new()
	light.script = script
	light.set("controller", controller)
	light.set("axis", axis)
	light.set("intersection_id", intersection_key)
	light.set("facing", facing)
	light.position = position
	light.z_index = 6
	_light_root.add_child(light)


func _add_traffic() -> void:
	var target: int = int(CityConfig.CARS["min_cars"])
	for i in target:
		_spawn_traffic_car(Vector2.ZERO, true)


func _spawn_traffic_car(center: Vector2, initial: bool = false) -> bool:
	if graph == null:
		return false
	var min_radius: float = float(CityConfig.CARS["spawn_radius"]) if not initial else 0.0
	var max_radius: float = float(CityConfig.CARS["despawn_radius"])
	var segment_id: String = graph.random_segment_near(center, min_radius, max_radius)
	if segment_id.is_empty():
		return false
	var segment: Dictionary = graph.get_segment(segment_id)
	var length: float = float(segment.get("length", 0.0))
	var progress: float = randf_range(40.0, maxf(60.0, length - 40.0))
	var point: Vector2 = graph.point_on_segment(segment_id, progress)
	if not _is_spawn_clear(point, float(CityConfig.CARS["spawn_clearance"])):
		return false
	var visual := _random_car_visual()
	var with_driver: bool = randf() < 0.72
	var speed: float = randf_range(
		float(CityConfig.CARS["speed_min"]), float(CityConfig.CARS["speed_max"])
	)
	var car := _create_vehicle(load("res://script/city_car.gd"), String(visual["path"]))
	car.collision_layer = 2
	car.collision_mask = 6
	car.name = "traffic_%d" % _next_traffic_id
	_next_traffic_id += 1
	car.set("engine_audio_enabled", with_driver and randf() < float(CityConfig.CARS["engine_chance"]))
	car.set("engine_volume_db", float(CityConfig.AUDIO["engine_volume_db"]))
	car.call(
		"configure_lane", car.name, graph, controller, segment_id,
		progress, speed,
		float(CityConfig.CARS["acceleration"]), float(CityConfig.CARS["braking"]),
		visual["color"], String(visual["path"]), with_driver,
		int(visual["row"]), int(visual["col"])
	)
	_car_root.add_child(car)
	_traffic.append(car)
	if with_driver:
		_next_npc_id += 1
		_add_driver(car, "driver_%d" % _next_npc_id, 0 if int(segment["direction"]) > 0 else 1)
	return true


func _is_spawn_clear(point: Vector2, clearance: float) -> bool:
	for car in _traffic:
		if is_instance_valid(car) and car.global_position.distance_to(point) < clearance:
			return false
	var player := _car_root.get_node_or_null("FatherCar") as CityVehicleBase
	if player != null and player.global_position.distance_to(point) < clearance + 120.0:
		return false
	return true


func _update_traffic(center: Vector2) -> void:
	for i in range(_traffic.size() - 1, -1, -1):
		var car: CityCar = _traffic[i]
		if not is_instance_valid(car):
			_traffic.remove_at(i)
			continue
		if car.global_position.distance_to(center) > float(CityConfig.CARS["despawn_radius"]):
			var driver: Variant = car.occupant
			if driver is CityNpc and is_instance_valid(driver):
				if driver.has_method("prepare_for_vehicle_removal"):
					driver.call("prepare_for_vehicle_removal")
				(driver as CityNpc).queue_free()
			car.queue_free()
			_traffic.remove_at(i)

	for car in _traffic:
		if not is_instance_valid(car) or car.state != CityCar.State.DRIVING:
			continue
		if car.occupant != null:
			car.driver_requested = false
		elif car.requires_driver:
			var requested_at: int = int(car.get_meta("driver_requested_at", 0))
			if car.driver_requested and Time.get_ticks_msec() - requested_at < 2000:
				continue
			car.driver_requested = true
			car.set_meta("driver_requested_at", Time.get_ticks_msec())
			_next_npc_id += 1
			var seat: int = 0 if not car.occupants.has(0) else 1
			_add_driver(car, "driver_%d" % _next_npc_id, seat)
	var target: int = _target_traffic_count(center)
	var attempts: int = 0
	while _traffic.size() < target and attempts < 8:
		attempts += 1
		if not _spawn_traffic_car(center):
			continue


func _target_traffic_count(center: Vector2) -> int:
	var radius: float = float(CityConfig.CARS["despawn_radius"])
	var lane_length: float = 0.0
	for id in graph.segments.keys():
		var segment: Dictionary = graph.segments[id]
		var midpoint: Vector2 = (Vector2(segment["from"]) + Vector2(segment["to"])) * 0.5
		if midpoint.distance_to(center) <= radius:
			lane_length += float(segment["length"])
	var density: float = float(CityConfig.TILE) * float(CityConfig.CARS["tiles_per_car"])
	var target: int = clampi(int(lane_length / density), int(CityConfig.CARS["min_cars"]), int(CityConfig.CARS["max_cars"]))
	return target


func _random_car_visual() -> Dictionary:
	var paints: Array = CityConfig.CARS["paint_colors"]
	var police: bool = randf() < float(CityConfig.CARS["police_chance"])
	var path := ASSET_DIR + ("police-car-selout-64.png" if police else "car-selout-64.png")
	return {
		"path": path,
		"row": int(CityConfig.CARS["atlas_row"]),
		"col": 0,
		"color": paints[randi_range(0, paints.size() - 1)],
	}


func _add_driver(car: CityVehicleBase, p_id: String, p_seat: int) -> void:
	var npc := Node2D.new()
	npc.name = p_id
	npc.script = load("res://script/city_npc.gd")
	_npc_root.add_child(npc)
	npc.call_deferred("configure_driver", car, p_seat, p_id)


func _add_parking_bays() -> void:
	var road: Dictionary = CityConfig.HORIZONTAL_ROADS[int(CityConfig.PARKING["road_index"])]
	var center: float = float(road["coord"])
	var road_width: float = float(CityConfig.ROAD_WIDTHS[String(road["kind"])])
	var bay_offset: float = road_width / 2.0 - float(CityConfig.PARKING["inset"])
	var bay_length: float = float(CityConfig.PARKING["bay_length"])
	var bay_width: float = float(CityConfig.PARKING["bay_width"])
	for spot in CityConfig.PARKING["spots"]:
		var point := spot as Vector2
		var side: float = signf(point.y)
		var bay_center := Vector2(point.x, center + side * bay_offset)
		_rect(bay_center, Vector2(bay_length, bay_width), Color("#3a414b"), -27, _decor_root)
		for edge in [-1, 1]:
			_rect(Vector2(bay_center.x + float(edge) * bay_length / 2.0, bay_center.y), Vector2(6.0, bay_width), Color("#d8d2c4"), -26, _decor_root)
		_rect(Vector2(bay_center.x, bay_center.y + side * bay_width / 2.0), Vector2(bay_length, 6.0), Color("#d8d2c4"), -26, _decor_root)


func _add_parked_cars() -> void:
	var road: Dictionary = CityConfig.HORIZONTAL_ROADS[int(CityConfig.PARKING["road_index"])]
	var center: float = float(road["coord"])
	var road_width: float = float(CityConfig.ROAD_WIDTHS[String(road["kind"])])
	var bay_offset: float = road_width / 2.0 - float(CityConfig.PARKING["inset"])
	var first_car: CityVehicleBase = null
	var index: int = 0
	for spot in CityConfig.PARKING["spots"]:
		var point := spot as Vector2
		var side: float = signf(point.y)
		var visual := _random_car_visual()
		var position := Vector2(point.x, center + side * bay_offset)
		var heading: float = 0.0 if side < 0.0 else PI
		var car := _add_parked_car("parked_car_%d" % (index + 1), position, heading, visual["color"], String(visual["path"]), int(visual["row"]), int(visual["col"]))
		if index == 0:
			first_car = car
		index += 1
	_scheduled_parked_car = first_car


var _scheduled_parked_car: CityVehicleBase


func _add_parked_car(
	vehicle_id: String,
	position: Vector2,
	heading: float,
	color: Color,
	texture_path: String,
	atlas_row: int,
	atlas_col: int
) -> CityCar:
	var car := _create_vehicle(load("res://script/city_car.gd"), texture_path) as CityCar
	car.name = vehicle_id
	car.call("configure_parked", vehicle_id, position, heading, color, texture_path, atlas_row, atlas_col)
	_car_root.add_child(car)
	return car


func _create_vehicle(script: Script, texture_path: String) -> CharacterBody2D:
	var car := CharacterBody2D.new()
	car.script = script
	car.collision_layer = 2
	car.collision_mask = 2
	car.set("texture_path", texture_path)
	var sprite := Sprite2D.new()
	sprite.name = "Sprite2D"
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.scale = Vector2(2.4, 2.4)
	sprite.z_index = 3
	car.add_child(sprite)
	var shape := CollisionShape2D.new()
	shape.name = "CollisionShape2D"
	var rect := RectangleShape2D.new()
	rect.size = Vector2(float(CityConfig.CARS["collision_width"]), float(CityConfig.CARS["collision_length"]))
	shape.shape = rect
	car.add_child(shape)
	return car


func _add_player_car() -> void:
	var car := _create_vehicle(load("res://script/player_car.gd"), ASSET_DIR + "car-selout-64.png")
	car.collision_layer = 4
	car.collision_mask = 2
	car.name = "FatherCar"
	car.position = CityConfig.GARAGE["car"]
	car.set("heading", 0.0)
	car.set("player_path", NodePath("../../Player"))
	car.set("exit_marker", NodePath("../../CarExitSpawn"))
	car.set("engine_audio_enabled", true)
	car.set("engine_volume_db", float(CityConfig.AUDIO["player_engine_volume_db"]))
	car.set("headlight_enabled", true)
	var visual := _random_car_visual()
	car.set("atlas_row", int(visual["row"]))
	car.set("atlas_col", 0)
	car.set("paint_color", visual["color"])
	car.set("body_color", Color.WHITE)

	var camera := Camera2D.new()
	camera.name = "Camera2D"
	camera.zoom = Vector2(0.22, 0.22)
	car.add_child(camera)

	var interaction := Area2D.new()
	interaction.name = "Interaction"
	interaction.collision_layer = 1
	interaction.collision_mask = 1
	interaction.script = load("res://script/interaction_proxy.gd")
	var interaction_shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = float(CityConfig.GARAGE["interaction_radius"])
	interaction_shape.shape = circle
	interaction.add_child(interaction_shape)
	car.add_child(interaction)

	_car_root.add_child(car)
	car.call("configure_player", NodePath("../../Player"), NodePath("../../CarExitSpawn"), "father_car", 380.0, 260.0, 340.0, 1.8)
	interaction.set("target", car.get_path())


func _add_pedestrians() -> void:
	var target: int = int(CityConfig.SPAWN["npc_min"])
	for i in target:
		_spawn_pedestrian(Vector2.ZERO, true)
	if _pedestrians.size() > 0 and is_instance_valid(_scheduled_parked_car):
		_pedestrians[0].call("schedule_vehicle_use", _scheduled_parked_car, 3.0)


func _spawn_pedestrian(center: Vector2, initial: bool = false) -> bool:
	if graph == null:
		return false
	var min_radius: float = float(CityConfig.SPAWN["npc_spawn_radius"]) if not initial else 0.0
	var max_radius: float = float(CityConfig.SPAWN["npc_despawn_radius"])
	var walk_id: String = graph.random_sidewalk_near(center, min_radius, max_radius)
	if walk_id.is_empty():
		return false
	var walk: Dictionary = graph.sidewalks[walk_id]
	var use_end: bool = randf() < 0.5
	var start: Vector2 = Vector2(walk["to"]) if use_end else Vector2(walk["from"])
	var end: Vector2 = Vector2(walk["from"]) if use_end else Vector2(walk["to"])
	if not _is_npc_spawn_clear(start):
		return false
	var route: Array[Vector2] = [start, end]
	if randf() < 0.45:
		var crossing: Dictionary = graph.sidewalk_crossing_point(walk_id, use_end)
		if not crossing.is_empty() and controller.can_pedestrian_cross(int(crossing["axis"])):
			var crossing_point: Vector2 = crossing["point"]
			route.append(crossing_point)
			var continuation: Vector2 = _continuation_point(crossing_point, int(walk["axis"]), walk_id, use_end)
			if continuation != Vector2.ZERO:
				route.append(continuation)
	var npc := Node2D.new()
	npc.name = "city_npc_%d" % _next_npc_id
	_next_npc_id += 1
	npc.script = load("res://script/city_npc.gd")
	_npc_root.add_child(npc)
	var use_vehicles: bool = _pedestrians.size() < 3
	npc.call("configure", route, randf_range(38.0, 54.0), randf_range(0.4, 1.1), randf_range(2.7, 3.1), npc.name, use_vehicles, randf_range(5.0, 9.0))
	_pedestrians.append(npc)
	return true


func _continuation_point(point: Vector2, axis: int, exclude_id: String, use_end: bool) -> Vector2:
	var sign: float = 1.0 if use_end else -1.0
	var best: Vector2 = Vector2.ZERO
	var best_distance: float = 0.0
	for id in graph.sidewalks.keys():
		if id == exclude_id:
			continue
		var walk: Dictionary = graph.sidewalks[id]
		if int(walk["axis"]) != axis:
			continue
		var coord: float = float(walk["coord"])
		var point_coord: float = point.x if axis == 0 else point.y
		if absf(coord - point_coord) > 12.0:
			continue
		for value in [walk["from"], walk["to"]]:
			var endpoint: Vector2 = value as Vector2
			var along: float = (endpoint.x - point.x) * sign if axis == 0 else (endpoint.y - point.y) * sign
			var distance: float = endpoint.distance_to(point)
			if along > 20.0 and distance < 620.0 and distance > best_distance:
				best = endpoint
				best_distance = distance
	return best


func _is_npc_spawn_clear(point: Vector2) -> bool:
	var clearance: float = float(CityConfig.SPAWN["npc_clearance"])
	for npc in _pedestrians:
		if is_instance_valid(npc) and npc.global_position.distance_to(point) < clearance:
			return false
	for car in _traffic:
		if is_instance_valid(car) and car.global_position.distance_to(point) < clearance:
			return false
	return true


func _update_pedestrians(center: Vector2) -> void:
	for i in range(_pedestrians.size() - 1, -1, -1):
		var npc: CityNpc = _pedestrians[i]
		if not is_instance_valid(npc):
			_pedestrians.remove_at(i)
			continue
		if npc.global_position.distance_to(center) > float(CityConfig.SPAWN["npc_despawn_radius"]):
			if npc.has_method("prepare_for_vehicle_removal"):
				npc.call("prepare_for_vehicle_removal")
			npc.queue_free()
			_pedestrians.remove_at(i)
	var target: int = clampi(
		int(float(CityConfig.SPAWN["npc_min"]) * (float(CityConfig.SPAWN["npc_max"]) / float(CityConfig.SPAWN["npc_min"])) * 0.72),
		int(CityConfig.SPAWN["npc_min"]),
		int(CityConfig.SPAWN["npc_max"])
	)
	var attempts: int = 0
	while _pedestrians.size() < target and attempts < 8:
		attempts += 1
		_spawn_pedestrian(center)


func _update_lamp_energy() -> void:
	var day_night: Node = get_tree().get_first_node_in_group("day_night")
	var night: float = 0.0
	if is_instance_valid(day_night) and day_night.has_method("get_night_level"):
		night = clampf(float(day_night.call("get_night_level")), 0.0, 1.0)
	for lamp in _lamps:
		if is_instance_valid(lamp):
			lamp.energy = 0.18 + 1.05 * night


func _add_birds() -> void:
	for i in int(CityConfig.SPAWN["bird_count"]):
		var bird := Node2D.new()
		bird.script = load("res://script/city_bird.gd")
		bird.position = Vector2(randf_range(-3000.0, 3000.0), randf_range(-2400.0, 2400.0))
		bird.z_index = 9
		_decor_root.add_child(bird)
		bird.call("configure", -CityConfig.WORLD_SIZE.x / 2.0, CityConfig.WORLD_SIZE.x / 2.0, randf_range(70.0, 130.0), randf_range(0.8, 1.5))


func _add_world_bounds() -> void:
	var half_x: float = CityConfig.WORLD_SIZE.x / 2.0
	var half_y: float = CityConfig.WORLD_SIZE.y / 2.0
	_static_body(Vector2(-half_x + 40.0, 0.0), Vector2(80.0, CityConfig.WORLD_SIZE.y), _collision_root)
	_static_body(Vector2(half_x - 40.0, 0.0), Vector2(80.0, CityConfig.WORLD_SIZE.y), _collision_root)
	_static_body(Vector2(0.0, -half_y + 40.0), Vector2(CityConfig.WORLD_SIZE.x, 80.0), _collision_root)
	_static_body(Vector2(0.0, half_y - 40.0), Vector2(CityConfig.WORLD_SIZE.x, 80.0), _collision_root)


func _static_body(pos: Vector2, size: Vector2, parent: Node) -> void:
	var body := StaticBody2D.new()
	body.position = pos
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = size
	shape.shape = rect
	body.add_child(shape)
	parent.add_child(body)


func _rect(center: Vector2, size: Vector2, color: Color, z: int, parent: Node) -> Polygon2D:
	var polygon := Polygon2D.new()
	polygon.position = center
	polygon.z_index = z
	polygon.polygon = PackedVector2Array([
		Vector2(-size.x / 2.0, -size.y / 2.0),
		Vector2(size.x / 2.0, -size.y / 2.0),
		Vector2(size.x / 2.0, size.y / 2.0),
		Vector2(-size.x / 2.0, size.y / 2.0),
	])
	polygon.color = color
	parent.add_child(polygon)
	return polygon


func _atlas(path: String, row: int, frame: int) -> AtlasTexture:
	var texture := load(path) as Texture2D
	var atlas := AtlasTexture.new()
	atlas.atlas = texture
	atlas.region = Rect2(float(frame) * 64.0, float(row) * 64.0, 64.0, 64.0)
	return atlas


func _glow_texture() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.set_color(0, Color.WHITE)
	gradient.set_color(1, Color(1.0, 1.0, 1.0, 0.0))
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	texture.width = 64
	texture.height = 64
	return texture
