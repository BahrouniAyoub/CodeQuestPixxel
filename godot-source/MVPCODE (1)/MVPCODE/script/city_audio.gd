class_name CityAudio
extends RefCounted

const MIX_RATE := 22050

static var _engine: AudioStreamWAV = null
static var _horn: AudioStreamWAV = null
static var _impact: AudioStreamWAV = null
static var _chirp: AudioStreamWAV = null
static var _ambience: AudioStreamWAV = null
static var _horn_players: Dictionary = {}


static func engine_stream() -> AudioStreamWAV:
	if _engine != null:
		return _engine
	var frames: int = MIX_RATE / 2
	var samples := PackedFloat32Array()
	samples.resize(frames)
	for i in frames:
		var t: float = float(i) / float(MIX_RATE)
		var pulse: float = 0.5 + 0.5 * sin(TAU * 8.0 * t)
		var wave: float = sin(TAU * 42.0 * t) * 0.42
		wave += sin(TAU * 84.0 * t) * 0.20
		wave += sin(TAU * 126.0 * t) * 0.08
		wave += sin(TAU * 168.0 * t) * 0.05
		samples[i] = wave * (0.86 + 0.14 * pulse) * 0.26
	_engine = _build_stream(samples, true)
	return _engine


static func horn_stream() -> AudioStreamWAV:
	if _horn != null:
		return _horn
	var duration: float = (float(CityConfig.AUDIO["horn_min_seconds"]) + float(CityConfig.AUDIO["horn_max_seconds"])) * 0.5
	var frames: int = int(MIX_RATE * duration)
	var samples := PackedFloat32Array()
	samples.resize(frames)
	for i in frames:
		var t: float = float(i) / float(MIX_RATE)
		var attack: float = clampf(t / 0.035, 0.0, 1.0)
		var release: float = clampf((duration - t) / 0.08, 0.0, 1.0)
		var envelope: float = minf(attack * attack * (3.0 - 2.0 * attack), release * release * (3.0 - 2.0 * release))
		var wobble: float = 1.0 + 0.006 * sin(TAU * 5.0 * t)
		var tone: float = sin(TAU * 330.0 * t)
		tone += 0.72 * sin(TAU * 415.0 * t)
		tone += 0.18 * sin(TAU * 660.0 * t)
		samples[i] = tone * envelope * wobble * 0.20
	_horn = _build_stream(samples, false)
	return _horn


static func impact_stream() -> AudioStreamWAV:
	if _impact != null:
		return _impact
	var frames: int = int(MIX_RATE * 0.28)
	var samples := PackedFloat32Array()
	samples.resize(frames)
	for i in frames:
		var t: float = float(i) / float(MIX_RATE)
		var decay: float = exp(-16.0 * t)
		var thump: float = sin(TAU * 74.0 * t) * 0.55
		var noise: float = randf_range(-1.0, 1.0) * 0.45
		samples[i] = (thump + noise) * decay * 0.28
	_impact = _build_stream(samples, false)
	return _impact


static func chirp_stream() -> AudioStreamWAV:
	if _chirp != null:
		return _chirp
	var frames: int = int(MIX_RATE * 0.36)
	var samples := PackedFloat32Array()
	samples.resize(frames)
	for i in frames:
		var t: float = float(i) / float(MIX_RATE)
		var phase: float = TAU * (1900.0 * t + 900.0 * t * t)
		var envelope: float = sin(PI * clampf(t / 0.36, 0.0, 1.0))
		samples[i] = sin(phase) * envelope * 0.26
	_chirp = _build_stream(samples, false)
	return _chirp


static func ambience_stream() -> AudioStreamWAV:
	if _ambience != null:
		return _ambience
	var frames: int = MIX_RATE * 2
	var samples := PackedFloat32Array()
	samples.resize(frames)
	var smooth: float = 0.0
	for i in frames:
		var t: float = float(i) / float(MIX_RATE)
		smooth = lerpf(smooth, randf_range(-1.0, 1.0), 0.018)
		var breeze: float = sin(TAU * 0.23 * t) * 0.16
		samples[i] = (smooth * 0.55 + breeze) * 0.22
	_ambience = _build_stream(samples, true)
	return _ambience


static func create_player(p_parent: Node, p_stream: AudioStream, p_volume: float, p_pitch: float = 1.0) -> AudioStreamPlayer2D:
	var player := AudioStreamPlayer2D.new()
	player.stream = p_stream
	player.volume_db = p_volume + float(CityConfig.AUDIO["master_volume_db"])
	player.pitch_scale = p_pitch
	player.max_polyphony = 1
	p_parent.add_child(player)
	return player


static func play_one_shot(p_parent: Node, p_stream: AudioStream, p_volume: float, p_pitch: float = 1.0) -> void:
	if p_parent == null or not p_parent.is_inside_tree():
		return
	var player := AudioStreamPlayer2D.new()
	player.stream = p_stream
	player.volume_db = p_volume + float(CityConfig.AUDIO["master_volume_db"])
	player.pitch_scale = p_pitch
	p_parent.add_child(player)
	player.finished.connect(player.queue_free)
	player.play()


static func horn_player(p_parent: Node) -> AudioStreamPlayer2D:
	if p_parent == null or not p_parent.is_inside_tree():
		return null
	var key: int = p_parent.get_instance_id()
	var player: Variant = _horn_players.get(key, null)
	if is_instance_valid(player):
		return player as AudioStreamPlayer2D
	var created := create_player(p_parent, horn_stream(), float(CityConfig.AUDIO["horn_volume_db"]), randf_range(0.96, 1.04))
	created.name = "HornPlayer"
	created.max_polyphony = 1
	_horn_players[key] = created
	return created


static func play_horn(p_parent: Node) -> void:
	var player := horn_player(p_parent)
	if player == null or player.playing:
		return
	player.play()


static func start_horn(p_parent: Node) -> void:
	play_horn(p_parent)


static func stop_horn(p_parent: Node) -> void:
	if p_parent == null:
		return
	var player: Variant = _horn_players.get(p_parent.get_instance_id(), null)
	if is_instance_valid(player):
		(player as AudioStreamPlayer2D).stop()


static func play_impact(p_parent: Node, p_strength: float) -> void:
	var strength: float = clampf(p_strength, 0.05, 1.0)
	var volume: float = float(CityConfig.AUDIO["impact_volume_db"]) + 20.0 * log(strength) / log(10.0)
	play_one_shot(p_parent, impact_stream(), volume, randf_range(0.9, 1.1))


static func play_chirp(p_parent: Node) -> void:
	play_one_shot(p_parent, chirp_stream(), float(CityConfig.AUDIO["chirp_volume_db"]), randf_range(0.9, 1.35))


static func _tone_envelope(t: float, start: float, end: float, freq_a: float, freq_b: float) -> float:
	var local: float = (t - start) / maxf(end - start, 0.001)
	var envelope: float = sin(PI * clampf(local, 0.0, 1.0))
	var freq: float = lerpf(freq_a, freq_b, local)
	return sin(TAU * freq * (t - start)) * envelope


static func _build_stream(samples: PackedFloat32Array, loop: bool) -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = MIX_RATE
	stream.stereo = false
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		var value: int = int(clampf(samples[i], -1.0, 1.0) * 32767.0) & 0xFFFF
		bytes[i * 2] = value & 0xFF
		bytes[i * 2 + 1] = (value >> 8) & 0xFF
	stream.data = bytes
	if loop:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin = 0
		stream.loop_end = samples.size()
	return stream
