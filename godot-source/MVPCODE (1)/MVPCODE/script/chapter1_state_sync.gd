extends Node

## One-way React → Godot Chapter 1 state notifications.
##
## React remains the sole authority. This autoload only forwards the mirrored
## state to scene nodes so they can refresh their objective UI immediately.

signal chapter_state_changed(state: Dictionary)
signal load_failed(reason: String)
signal save_list_received(saves: Array)
signal save_saved(slot: String)
signal save_failed(reason: String)

const STATE_EVENT_TYPE := "codequest:chapter-state"
const LOAD_STATE_EVENT_TYPE := "codequest:load-state"
const LOAD_APPLIED_EVENT_TYPE := "codequest:load-applied"
const STATE_SNAPSHOT_EVENT_TYPE := "codequest:state-snapshot"
const STATE_COMMIT_EVENT_TYPE := "codequest:state-commit"
const IMPORT_SAVES_EVENT_TYPE := "codequest:import-saves"

var _installed := false
var _js_callback: Variant = null


func _ready() -> void:
	if OS.has_feature("web"):
		_install_listener()
	refresh_save_list()


func refresh_from_mirror() -> void:
	chapter_state_changed.emit(CodeQuestBridge.get_chapter_state())


func reset_load_state() -> void:
	pass


func refresh_save_list() -> void:
	save_list_received.emit(CodeQuestSaveStore.list_saves())


func save_native_state(slot: String, reason: String = "Saved game") -> void:
	var key := CodeQuestSaveStore.normalize_slot(slot)
	var chapter_state := CodeQuestBridge.get_active_quest_snapshot()
	chapter_state["schema"] = 1
	var quest_id := String(chapter_state.get("questId", "CH1-01"))
	var record := {
		"schema": CodeQuestSaveStore.SAVE_VERSION,
		"version": CodeQuestSaveStore.SAVE_VERSION,
		"slot": key,
		"savedAt": Time.get_datetime_string_from_system(true) + "Z",
		"reason": reason,
		"character": _native_character_snapshot(),
		"progress": {
			"currentQuestIndex": _quest_index(quest_id),
			"completedQuestIds": chapter_state.get("completedQuestIds", []),
			"money": 0,
			"paymentClaimed": bool(chapter_state.get("chapterComplete", false)),
		},
		"payment": null,
		"chapterState": chapter_state,
	}
	if CodeQuestSaveStore.write_record(record):
		save_saved.emit(key)
		refresh_save_list()
	else:
		save_failed.emit("Could not write the Godot save file")


func _native_character_snapshot() -> Dictionary:
	var name_value := CharacterSettings.character_name.strip_edges()
	if name_value.is_empty():
		name_value = String(CodeQuestBridge.last_character_snapshot.get("name", "")).strip_edges()
	if name_value.is_empty():
		name_value = "Player"

	return {
		"name": name_value,
		"body_index": CharacterSettings.body_index,
		"skin_index": CharacterSettings.skin_index,
		"hair_style_index": CharacterSettings.hair_style_index,
		"hair_color_index": CharacterSettings.hair_color_index,
		"top_index": CharacterSettings.top_index,
		"bottom_index": CharacterSettings.bottom_index,
		"feet_index": CharacterSettings.feet_index,
	}


func _quest_index(quest_id: String) -> int:
	var parts := quest_id.split("-")
	if parts.size() == 2 and String(parts[1]).is_valid_int():
		return maxi(0, int(parts[1]) - 1)
	return 0


func request_load(slot: String) -> void:
	var key := CodeQuestSaveStore.normalize_slot(slot)
	var save := CodeQuestSaveStore.get_save(key)
	if save.is_empty():
		load_failed.emit("No save found in this slot.")
		return

	CodeQuestBridge.notify_load_state(save)
	_apply_load_state(save)


func _install_listener() -> void:
	if _installed:
		return
	_installed = true

	_js_callback = JavaScriptBridge.create_callback(_on_chapter_state_message)

	var window = JavaScriptBridge.get_interface("window")
	window.__codequestChapterStateCallback = _js_callback

	var js := "(function(){"
	js += "if(window.__codequestStateListenerInstalled)return;"
	js += "window.__codequestStateListenerInstalled=true;"
	js += "window.addEventListener('message',function(event){"
	js += "if(event.origin!==window.location.origin)return;"
	js += "if(event.source!==window.parent)return;"
	js += "if(!event.data)return;"
	js += "var t=event.data.type||'';"
	js += "if(t==='codequest:load-game'||t==='codequest:load-missing'||t==='codequest:save-list'||t==='codequest:save-saved'||t==='codequest:save-failed'||t==='codequest:state-snapshot'||t==='codequest:state-commit'||t==='codequest:load-applied'||t==='codequest:import-saves'){"
	js += "if(typeof window.__codequestChapterStateCallback==='function'){"
	js += "window.__codequestChapterStateCallback(JSON.stringify(event.data));"
	js += "}return;}"
	js += "if(event.data.type!=='codequest:chapter-state')return;"
	js += "if(!event.data.state||event.data.state.schema!==1)return;"
	js += "window.__codequestChapterState=event.data.state;"
	js += "if(typeof window.__codequestChapterStateCallback==='function'){"
	js += "window.__codequestChapterStateCallback(JSON.stringify(event.data.state));"
	js += "}"
	js += "});"
	js += "})();"
	JavaScriptBridge.eval(js, true)


func _on_chapter_state_message(args: Array) -> void:
	if args.is_empty():
		return

	var raw := String(args[0])
	var parsed: Variant = JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		return

	var state := parsed as Dictionary
	var event_type := String(state.get("type", ""))
	if event_type == "codequest:load-missing":
		load_failed.emit(String(state.get("reason", "No save found")))
		return
	if event_type == "codequest:save-list":
		save_list_received.emit(Array(state.get("saves", [])))
		return
	if event_type == "codequest:save-saved":
		save_saved.emit(String(state.get("slot", "auto")))
		return
	if event_type == "codequest:save-failed":
		save_failed.emit(String(state.get("reason", "Could not save game")))
		return
	if event_type == STATE_SNAPSHOT_EVENT_TYPE:
		_write_state_snapshot(state)
		return
	if event_type == STATE_COMMIT_EVENT_TYPE:
		CodeQuestBridge.notify_request_state(
			String(state.get("slot", "auto")),
			String(state.get("reason", "PixelOS task complete"))
		)
		return
	if event_type == IMPORT_SAVES_EVENT_TYPE:
		_import_saves(Array(state.get("saves", [])))
		return
	if int(state.get("schema", 0)) != 1:
		return

	chapter_state_changed.emit(state)


func _write_state_snapshot(state: Dictionary) -> void:
	var slot := CodeQuestSaveStore.normalize_slot(String(state.get("slot", "auto")))
	var record := {
		"schema": CodeQuestSaveStore.SAVE_VERSION,
		"version": CodeQuestSaveStore.SAVE_VERSION,
		"slot": slot,
		"savedAt": String(state.get("savedAt", "")),
		"reason": String(state.get("reason", "Saved game")),
		"character": CodeQuestSaveStore.normalize_character(state.get("character", {})),
		"progress": state.get("progress", {}),
		"payment": state.get("payment", null),
		"chapterState": state.get("chapterState", {}),
	}
	if CodeQuestSaveStore.write_record(record):
		save_saved.emit(slot)
		refresh_save_list()
	else:
		save_failed.emit("Could not write the Godot save file")


func _import_saves(saves: Array) -> void:
	var imported := false
	for value in saves:
		if typeof(value) != TYPE_DICTIONARY:
			continue
		if CodeQuestSaveStore.import_record(value as Dictionary):
			imported = true
	if imported:
		refresh_save_list()


func _apply_load_state(save: Dictionary) -> void:
	var character := CodeQuestSaveStore.normalize_character(save.get("character", {}))
	CharacterSettings.character_name = String(character.get("name", "Player"))
	CharacterSettings.body_index = int(character.get("body_index", 0))
	CharacterSettings.skin_index = int(character.get("skin_index", 0))
	CharacterSettings.hair_style_index = int(character.get("hair_style_index", 0))
	CharacterSettings.hair_color_index = int(character.get("hair_color_index", 0))
	CharacterSettings.top_index = int(character.get("top_index", 0))
	CharacterSettings.bottom_index = int(character.get("bottom_index", 0))
	CharacterSettings.feet_index = int(character.get("feet_index", 0))
	CodeQuestBridge.last_character_snapshot = character

	var chapter_state: Dictionary = {}
	if typeof(save.get("chapterState")) == TYPE_DICTIONARY:
		chapter_state = save.get("chapterState") as Dictionary
	if chapter_state.is_empty():
		chapter_state = CodeQuestBridge.get_active_quest_snapshot()

	get_tree().paused = false
	CodeQuestBridge.apply_chapter_state(chapter_state)
	get_tree().change_scene_to_file("res://scene/Game.tscn")

	await get_tree().process_frame
	QuestManager.prime_from_snapshot(chapter_state)
	QuestManager.apply_snapshot(CodeQuestBridge.get_active_quest_snapshot())
