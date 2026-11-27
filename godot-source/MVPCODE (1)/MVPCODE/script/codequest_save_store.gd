extends RefCounted
class_name CodeQuestSaveStore

const SAVE_PATH := "user://codequest_saves.json"
const SAVE_VERSION := 1
const SLOTS := ["auto", "1", "2", "3"]

static var _loaded := false
static var _saves: Dictionary = {}

static func normalize_slot(slot: String) -> String:
	var value := slot.strip_edges().to_lower()
	if value == "quick" or value == "auto":
		return "auto"
	if value == "1" or value == "2" or value == "3":
		return value
	return "auto"


static func normalize_character(raw: Variant) -> Dictionary:
	var source: Dictionary = {}
	if typeof(raw) == TYPE_DICTIONARY:
		source = raw as Dictionary

	var name_value := String(source.get("name", source.get("characterName", "Player"))).strip_edges()
	if name_value.is_empty():
		name_value = "Player"

	return {
		"name": name_value.substr(0, 24),
		"body_index": int(source.get("body_index", source.get("bodyIndex", 0))),
		"skin_index": int(source.get("skin_index", source.get("skinIndex", 0))),
		"hair_style_index": int(source.get("hair_style_index", source.get("hairStyleIndex", 0))),
		"hair_color_index": int(source.get("hair_color_index", source.get("hairColorIndex", 0))),
		"top_index": int(source.get("top_index", source.get("topIndex", 0))),
		"bottom_index": int(source.get("bottom_index", source.get("bottomIndex", 0))),
		"feet_index": int(source.get("feet_index", source.get("feetIndex", 0))),
		"car_permission": bool(source.get("car_permission", source.get("carPermission", false))),
	}


static func _ensure_loaded() -> void:
	if _loaded:
		return
	_loaded = true
	if not FileAccess.file_exists(SAVE_PATH):
		return

	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return

	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return

	var root := parsed as Dictionary
	if int(root.get("schema", 0)) != SAVE_VERSION:
		return
	if typeof(root.get("saves")) != TYPE_DICTIONARY:
		return
	_saves = (root.get("saves") as Dictionary).duplicate(true)


static func _flush() -> bool:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return false
	var payload := {"schema": SAVE_VERSION, "saves": _saves}
	file.store_string(JSON.stringify(payload))
	file.flush()
	file.close()
	return true


static func write_record(raw: Dictionary) -> bool:
	if raw.is_empty():
		return false
	_ensure_loaded()

	var slot := normalize_slot(String(raw.get("slot", "auto")))
	var record := raw.duplicate(true)
	var saved_at := String(record.get("savedAt", "")).strip_edges()
	if saved_at.is_empty():
		saved_at = Time.get_datetime_string_from_system(true) + "Z"

	record["schema"] = SAVE_VERSION
	record["version"] = SAVE_VERSION
	record["slot"] = slot
	record["savedAt"] = saved_at
	record["reason"] = String(record.get("reason", "Saved game"))
	record["character"] = normalize_character(record.get("character", {}))
	if typeof(record.get("progress")) != TYPE_DICTIONARY:
		record["progress"] = {}

	_saves[slot] = record
	return _flush()


static func import_record(raw: Dictionary) -> bool:
	if raw.is_empty():
		return false
	_ensure_loaded()
	var slot := normalize_slot(String(raw.get("slot", "auto")))
	if _saves.has(slot):
		return false
	return write_record(raw)


static func get_save(slot: String) -> Dictionary:
	_ensure_loaded()
	var key := normalize_slot(slot)
	if not _saves.has(key):
		return {}
	var record: Dictionary = _saves.get(key, {})
	return record.duplicate(true)


static func has_save(slot: String) -> bool:
	_ensure_loaded()
	return _saves.has(normalize_slot(slot))


static func find_latest() -> Dictionary:
	var saves := list_saves()
	if saves.is_empty():
		return {}
	return get_save(String((saves[0] as Dictionary).get("slot", "auto")))


static func list_saves() -> Array:
	_ensure_loaded()
	var result: Array = []
	for slot in _saves.keys():
		var record: Dictionary = _saves.get(slot, {})
		if record.is_empty():
			continue
		var character := normalize_character(record.get("character", {}))
		var progress: Dictionary = {}
		if typeof(record.get("progress")) == TYPE_DICTIONARY:
			progress = record.get("progress") as Dictionary
		var chapter_state: Dictionary = {}
		if typeof(record.get("chapterState")) == TYPE_DICTIONARY:
			chapter_state = record.get("chapterState") as Dictionary
		var quest_id := String(chapter_state.get("questId", ""))
		if quest_id.is_empty():
			quest_id = String(progress.get("currentQuestIndex", "0"))
		result.append({
			"slot": slot,
			"label": "AUTO" if slot == "auto" else "SLOT %s" % slot,
			"name": character.get("name", "Player"),
			"savedAt": String(record.get("savedAt", "")),
			"questId": quest_id,
			"questIndex": int(progress.get("currentQuestIndex", 0)),
			"reason": String(record.get("reason", "Saved game")),
		})

	for i in range(result.size()):
		for j in range(i + 1, result.size()):
			var left := String((result[i] as Dictionary).get("savedAt", ""))
			var right := String((result[j] as Dictionary).get("savedAt", ""))
			if right > left:
				var swap: Dictionary = result[i]
				result[i] = result[j]
				result[j] = swap
	return result


static func clear_saves() -> bool:
	_saves = {}
	_loaded = true
	return _flush()
