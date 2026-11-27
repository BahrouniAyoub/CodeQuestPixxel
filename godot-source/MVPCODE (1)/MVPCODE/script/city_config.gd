class_name CityConfig
extends RefCounted

const DEBUG := false

const TILE := 64.0
const WORLD_SIZE := Vector2(12800.0, 9600.0)
const CENTER_LINE_COLOR := Color("#e8d77a")
const ROAD_COLOR := Color("#414751")
const SIDEWALK_COLOR := Color("#b7b1a3")
const CROSSWALK_COLOR := Color("#d7d3c6")
const GRASS_COLOR := Color("#88a46b")
const PARK_COLOR := Color("#6f9962")
const PLAZA_COLOR := Color("#b8a887")

const HORIZONTAL_ROADS := [
	{"coord": -2400.0, "kind": "main"},
	{"coord": 0.0, "kind": "main"},
	{"coord": 2400.0, "kind": "main"},
]

const VERTICAL_ROADS := [
	{"coord": -3200.0, "kind": "main"},
	{"coord": 0.0, "kind": "main"},
	{"coord": 3200.0, "kind": "main"},
]

const BLOCK_CENTERS_X := [-4800.0, -1600.0, 1600.0, 4800.0]
const BLOCK_CENTERS_Y := [-3600.0, -1200.0, 1200.0, 3600.0]

const ROAD_WIDTHS := {"main": 520.0, "secondary": 380.0}
const SIDEWALK_WIDTHS := {"main": 130.0, "secondary": 120.0}
const LANE_OFFSETS := {
	"horizontal": {
		"main": {"1": [112.0], "-1": [-112.0]},
		"secondary": {"1": [82.0], "-1": [-82.0]},
	},
	"vertical": {
		"main": {"1": [-112.0], "-1": [112.0]},
		"secondary": {"1": [-82.0], "-1": [82.0]},
	},
}

const CARS := {
	"tiles_per_car": 30.0,
	"max_cars": 20,
	"min_cars": 10,
	"spawn_radius": 950.0,
	"despawn_radius": 2100.0,
	"follow_distance": 600.0,
	"safe_follow": 300.0,
	"minimum_gap": 220.0,
	"lane_tolerance": 48.0,
	"speed_min": 178.0,
	"speed_max": 214.0,
	"acceleration": 190.0,
	"braking": 460.0,
	"max_speed": 210.0,
	"turn_speed": 110.0,
	"turn_rate": 2.8,
	"intersection_lookahead": 460.0,
	"collision_width": 66.0,
	"collision_length": 112.0,
	"deadlock_seconds": 4.0,
	"blocked_seconds": 2.5,
	"blocked_min_speed": 40.0,
	"blocked_ratio": 0.3,
	"hit_cooldown": 8.0,
	"police_chance": 0.0,
	"atlas_row": 0,
	"engine_chance": 0.22,
	"spawn_clearance": 300.0,
	"paint_colors": [
		Color("#e5484d"),
		Color("#3b82f6"),
		Color("#34d399"),
		Color("#f59e0b"),
		Color("#a855f7"),
		Color("#22d3ee"),
		Color("#f8fafc"),
		Color("#f472b6"),
		Color("#65a30d"),
		Color("#fb923c"),
	],
}

const TRAFFIC := {
	"green": 10.0,
	"yellow": 2.0,
	"all_red": 2.0,
	"reservation_timeout": 6.0,
	"intersection_radius": 300.0,
	"stop_margin": 30.0,
	"signal_inset": 18.0,
}

const CROSSWALK := {
	"stripe_width": 24.0,
	"stripe_spacing": 118.0,
	"stripe_margin": 52.0,
	"depth_padding": 0.0,
}

const NPC := {
	"exit_pause": 1.0,
	"reboard_delay": 1.2,
}

const GARAGE := {
	"home": Vector2(-1200.0, -760.0),
	"building": Vector2(-760.0, -760.0),
	"car": Vector2(-760.0, -500.0),
	"player_spawn": Vector2(-1000.0, -500.0),
	"car_exit": Vector2(-640.0, -500.0),
	"interaction_radius": 260.0,
}

const PARKING := {
	"road_index": 1,
	"inset": 10.0,
	"bay_length": 210.0,
	"bay_width": 60.0,
	"spots": [Vector2(-2200.0, -1.0), Vector2(-1500.0, 1.0), Vector2(900.0, -1.0), Vector2(2100.0, 1.0)],
}

const AUDIO := {
	"master_volume_db": -6.0,
	"horn_volume_db": -22.0,
	"horn_min_seconds": 0.35,
	"horn_max_seconds": 0.55,
	"horn_cooldown": 5.0,
	"horn_chance": 0.015,
	"horn_max_distance": 1100.0,
	"horn_attenuation": 1.4,
	"engine_volume_db": -34.0,
	"player_engine_volume_db": -15.0,
	"ambience_volume_db": -30.0,
	"impact_volume_db": -20.0,
	"chirp_volume_db": -28.0,
}

const SPAWN := {
	"npc_min": 10,
	"npc_max": 18,
	"npc_spawn_radius": 900.0,
	"npc_despawn_radius": 2200.0,
	"npc_clearance": 220.0,
	"lamp_spacing_tiles": 7,
	"chunk_size": 1600.0,
	"chunk_radius": 2,
	"bird_count": 5,
	"bird_radius": 1600.0,
}

const UI := {
	"prompt_offset_y": -18.0,
	"prompt_width": 76.0,
	"prompt_height": 13.0,
	"prompt_margin": 6.0,
	"prompt_font_size": 5,
}
