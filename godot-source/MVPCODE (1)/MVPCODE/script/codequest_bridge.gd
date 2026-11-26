extends RefCounted
class_name CodeQuestBridge

## Minimal Step 8G bridge. It reads the React state mirror and posts exactly one
## validated father-dialogue completion event. Existing open-os messaging is
## left in computer_interaction.gd and is intentionally unchanged.

const COMPLETE_EVENT_TYPE := "codequest:chapter1-father-complete"
const EVENT_SOURCE := "godot"
const CH1_08_QUEST_ID := "CH1-08"
const RETURN_DIALOGUE_ID := "father-return-v1"
const RETURN_EVENT_ID := "ch1-08-father-dialogue-v1"

const INTRO_COMPLETE_EVENT_TYPE := "codequest:chapter1-intro-complete"
const CH1_01_QUEST_ID := "CH1-01"
const INTRO_DIALOGUE_ID := "father-intro-v1"
const INTRO_EVENT_ID := "ch1-01-father-dialogue-v1"

const COMPUTER_COMPLETE_EVENT_TYPE := "codequest:chapter1-computer-complete"
const CH1_02_QUEST_ID := "CH1-02"
const COMPUTER_DIALOGUE_ID := "computer-interaction-v1"
const COMPUTER_EVENT_ID := "ch1-02-computer-interaction-v1"

const CHAPTER_STATE_EVENT_TYPE := "codequest:chapter-state"
const CHARACTER_SNAPSHOT_EVENT_TYPE := "codequest:character-snapshot"
const SAVE_GAME_EVENT_TYPE := "codequest:save-game"
const NEW_GAME_EVENT_TYPE := "codequest:new-game"
const REQUEST_SAVE_EVENT_TYPE := "codequest:request-save"
const REQUEST_SAVE_LIST_EVENT_TYPE := "codequest:request-save-list"
const SAVE_LIST_EVENT_TYPE := "codequest:save-list"
const SAVE_SAVED_EVENT_TYPE := "codequest:save-saved"
const SAVE_FAILED_EVENT_TYPE := "codequest:save-failed"
const REQUEST_STATE_EVENT_TYPE := "codequest:request-state"
const STATE_SNAPSHOT_EVENT_TYPE := "codequest:state-snapshot"
const LOAD_STATE_EVENT_TYPE := "codequest:load-state"
const LOAD_APPLIED_EVENT_TYPE := "codequest:load-applied"
const STATE_COMMIT_EVENT_TYPE := "codequest:state-commit"
const IMPORT_SAVES_EVENT_TYPE := "codequest:import-saves"

const CHAPTER_TITLE_FALLBACK := "Chapter 1 — The First Paycheck"

# Native fallback only. In the web export the quest data comes from React's
# canonical chapter1Quests.ts mirror. Keep these maps in sync with that module;
# they are never a second authority.
const OBJECTIVE_FALLBACKS := {
	"CH1-01": "Talk to Dad in the living room",
	"CH1-02": "Use the computer in your bedroom",
	"CH1-03": "Find a Python job on GigBoard",
	"CH1-04": "Apply to the café calculator project",
	"CH1-05": "Finish and test the café project",
	"CH1-06": "Submit the finished project to the client",
	"CH1-07": "Claim your $50 payment",
	"CH1-08": "Go home and tell Dad about your job",
}

const QUEST_TITLE_FALLBACKS := {
	"CH1-01": "A Tough Morning",
	"CH1-02": "Check the Computer",
	"CH1-03": "Find a Job",
	"CH1-04": "Apply for the Job",
	"CH1-05": "Build the Calculator",
	"CH1-06": "Send Your Work",
	"CH1-07": "Get Paid",
	"CH1-08": "Share the Good News",
}

const QUEST_DESCRIPTION_FALLBACKS := {
	"CH1-01": "Dad has something important to say. Listen to him to find out what's going on.",
	"CH1-02": "Your computer might help you find work. Head to your bedroom and turn it on.",
	"CH1-03": "Look through GigBoard on your computer and find a freelance job that fits your skills.",
	"CH1-04": "Send your application for the café calculator job so you can start working.",
	"CH1-05": "Complete the café calculator project and make sure it works before sending it off.",
	"CH1-06": "Your project is ready. Submit it so the café owner can review your work.",
	"CH1-07": "The client approved your work. Collect your first paycheck!",
	"CH1-08": "You earned your first paycheck. Head back to the living room and talk to Dad.",
}

const QUEST_LOCATION_FALLBACKS := {
	"CH1-01": "Living room · Dad",
	"CH1-02": "Bedroom · Computer",
	"CH1-03": "PixelOS · GigBoard",
	"CH1-04": "PixelOS · GigBoard",
	"CH1-05": "PixelOS · Code Editor",
	"CH1-06": "PixelOS · Submit Project",
	"CH1-07": "PixelOS · Mail",
	"CH1-08": "Living room · Dad",
}

const READ_STATE_JS := "(function(){try{var s=window.__codequestChapterState;if((!s||s.schema!==1)&&window.parent){s=window.parent.__codequestChapterState;}return s?JSON.stringify(s):'';}catch(e){return '';}})()"

static var last_character_snapshot: Dictionary = {}

static var _native_state: Dictionary = {
	"schema": 1,
	"chapterTitle": CHAPTER_TITLE_FALLBACK,
	"questId": "CH1-01",
	"questTitle": "A Tough Morning",
	"questObjective": "Talk to Dad in the living room",
	"questDescription": "Dad has something important to say. Listen to him to find out what's going on.",
	"questLocation": "Living room · Dad",
	"chapterComplete": false,
	"completedQuestIds": [],
	"totalQuests": 8,
}


static func get_chapter_state() -> Dictionary:
	if not OS.has_feature("web"):
		return _native_state.duplicate(true)

	var raw: Variant = JavaScriptBridge.eval(READ_STATE_JS, true)
	if typeof(raw) != TYPE_STRING:
		return {}

	var json_text := String(raw).strip_edges()
	if json_text.is_empty():
		return {}

	var parsed: Variant = JSON.parse_string(json_text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed as Dictionary


static func apply_chapter_state(state: Dictionary) -> void:
	if state.is_empty() or int(state.get("schema", 0)) != 1:
		return
	_native_state = state.duplicate(true)
	if not OS.has_feature("web"):
		return
	var escaped_json := JSON.stringify(JSON.stringify(state))
	JavaScriptBridge.eval(
		"window.__codequestChapterState=JSON.parse(%s);" % escaped_json,
		true
	)


static func is_quest_active(quest_id: String) -> bool:
	var state := get_chapter_state()
	return (
		int(state.get("schema", 0)) == 1
		and String(state.get("questId", "")) == quest_id
		and bool(state.get("chapterComplete", true)) == false
	)


static func is_ch1_01_active() -> bool:
	return is_quest_active(CH1_01_QUEST_ID)


static func is_ch1_02_active() -> bool:
	return is_quest_active(CH1_02_QUEST_ID)


static func is_ch1_08_active() -> bool:
	return is_quest_active(CH1_08_QUEST_ID)


static func get_chapter_quest_id() -> String:
	var quest_id := String(get_chapter_state().get("questId", "")).strip_edges()
	# Native Godot has no React mirror; the world always starts at CH1-01.
	return quest_id if not quest_id.is_empty() else CH1_01_QUEST_ID


static func get_chapter_objective() -> String:
	var state := get_chapter_state()
	var objective := String(state.get("questObjective", "")).strip_edges()
	if not objective.is_empty():
		return objective
	return String(OBJECTIVE_FALLBACKS.get(get_chapter_quest_id(), ""))


static func is_chapter_complete() -> bool:
	var state := get_chapter_state()
	return int(state.get("schema", 0)) == 1 and bool(state.get("chapterComplete", false))


static func get_chapter_title() -> String:
	var title := String(get_chapter_state().get("chapterTitle", "")).strip_edges()
	return title if not title.is_empty() else CHAPTER_TITLE_FALLBACK


static func get_chapter_quest_title() -> String:
	var state := get_chapter_state()
	var title := String(state.get("questTitle", "")).strip_edges()
	if not title.is_empty():
		return title
	return String(QUEST_TITLE_FALLBACKS.get(get_chapter_quest_id(), ""))


static func get_chapter_quest_description() -> String:
	var state := get_chapter_state()
	var description := String(state.get("questDescription", "")).strip_edges()
	if not description.is_empty():
		return description
	return String(QUEST_DESCRIPTION_FALLBACKS.get(get_chapter_quest_id(), ""))


static func get_chapter_quest_location() -> String:
	var state := get_chapter_state()
	var location := String(state.get("questLocation", "")).strip_edges()
	if not location.is_empty():
		return location
	return String(QUEST_LOCATION_FALLBACKS.get(get_chapter_quest_id(), ""))


static func get_completed_quest_ids() -> Array[String]:
	var raw: Variant = get_chapter_state().get("completedQuestIds", [])
	var ids: Array[String] = []
	if typeof(raw) != TYPE_ARRAY:
		return ids
	for value in raw as Array:
		if typeof(value) == TYPE_STRING:
			ids.append(String(value))
	return ids


static func get_total_quests() -> int:
	var state := get_chapter_state()
	var total := int(state.get("totalQuests", 0))
	if total > 0:
		return total
	return OBJECTIVE_FALLBACKS.size()


static func get_active_quest_snapshot() -> Dictionary:
	return {
		"chapterTitle": get_chapter_title(),
		"questId": get_chapter_quest_id(),
		"questTitle": get_chapter_quest_title(),
		"questObjective": get_chapter_objective(),
		"questDescription": get_chapter_quest_description(),
		"questLocation": get_chapter_quest_location(),
		"chapterComplete": is_chapter_complete(),
		"completedQuestIds": get_completed_quest_ids(),
		"totalQuests": get_total_quests(),
	}


static func _post_payload(payload: Dictionary) -> void:
	if not OS.has_feature("web"):
		return

	# JSON.stringify twice: once for the payload, once to make a safe JS literal.
	var escaped_json := JSON.stringify(JSON.stringify(payload))
	var script: String = "window.parent.postMessage(JSON.parse(%s), window.location.origin);" % escaped_json
	JavaScriptBridge.eval(script, true)


static func _advance_native_quest(quest_id: String, next_quest_id: String, complete: bool = false) -> void:
	if OS.has_feature("web"):
		return

	var completed: Array = _native_state.get("completedQuestIds", [])
	if not completed.has(quest_id):
		completed.append(quest_id)
	_native_state["completedQuestIds"] = completed
	_native_state["questId"] = next_quest_id
	_native_state["chapterComplete"] = complete
	_native_state["questTitle"] = String(QUEST_TITLE_FALLBACKS.get(next_quest_id, ""))
	_native_state["questObjective"] = String(OBJECTIVE_FALLBACKS.get(next_quest_id, ""))
	_native_state["questDescription"] = String(QUEST_DESCRIPTION_FALLBACKS.get(next_quest_id, ""))
	_native_state["questLocation"] = String(QUEST_LOCATION_FALLBACKS.get(next_quest_id, ""))


static func notify_father_intro_completed() -> void:
	_advance_native_quest(CH1_01_QUEST_ID, CH1_02_QUEST_ID)
	_post_payload({
		"type": INTRO_COMPLETE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"questId": CH1_01_QUEST_ID,
		"dialogueId": INTRO_DIALOGUE_ID,
		"eventId": INTRO_EVENT_ID,
	})


static func notify_computer_interaction_completed() -> void:
	_advance_native_quest(CH1_02_QUEST_ID, "CH1-03")
	_post_payload({
		"type": COMPUTER_COMPLETE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"questId": CH1_02_QUEST_ID,
		"dialogueId": COMPUTER_DIALOGUE_ID,
		"eventId": COMPUTER_EVENT_ID,
	})


static func notify_father_dialogue_completed() -> void:
	_advance_native_quest(CH1_08_QUEST_ID, "", true)
	_post_payload({
		"type": COMPLETE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"questId": CH1_08_QUEST_ID,
		"dialogueId": RETURN_DIALOGUE_ID,
		"eventId": RETURN_EVENT_ID,
	})


static func make_character_snapshot(
	character_name: String,
	body_index: int,
	skin_index: int,
	hair_style_index: int,
	hair_color_index: int,
	top_index: int,
	bottom_index: int,
	feet_index: int
) -> Dictionary:
	last_character_snapshot = {
		"name": character_name,
		"body_index": body_index,
		"skin_index": skin_index,
		"hair_style_index": hair_style_index,
		"hair_color_index": hair_color_index,
		"top_index": top_index,
		"bottom_index": bottom_index,
		"feet_index": feet_index,
	}
	return last_character_snapshot.duplicate(true)


static func notify_character_snapshot(character: Dictionary) -> void:
	last_character_snapshot = character.duplicate(true)
	_post_payload({
		"type": CHARACTER_SNAPSHOT_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"character": character,
	})


static func notify_save_game(character: Dictionary, slot: String = "auto") -> void:
	last_character_snapshot = CodeQuestSaveStore.normalize_character(character)
	notify_request_state(slot, "Bedroom rest")


static func notify_request_state(slot: String, reason: String = "Saved game") -> void:
	var normalized_slot := CodeQuestSaveStore.normalize_slot(slot)
	if not OS.has_feature("web"):
		CodeQuestStateSync.save_native_state(normalized_slot, reason)
		return

	var request_id := "save-%d" % Time.get_ticks_usec()
	var payload := {
		"type": REQUEST_STATE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"requestId": request_id,
		"slot": normalized_slot,
		"reason": reason,
	}
	if not last_character_snapshot.is_empty():
		payload["character"] = last_character_snapshot.duplicate(true)
	_post_payload(payload)


static func notify_load_state(save: Dictionary) -> void:
	_post_payload({
		"type": LOAD_STATE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"schema": CodeQuestSaveStore.SAVE_VERSION,
		"save": save.duplicate(true),
	})


static func notify_import_saves(saves: Array) -> void:
	_post_payload({
		"type": IMPORT_SAVES_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"saves": saves,
	})


static func reset_native_state() -> void:
	if OS.has_feature("web"):
		return
	_native_state = {
		"schema": 1,
		"chapterTitle": CHAPTER_TITLE_FALLBACK,
		"questId": CH1_01_QUEST_ID,
		"questTitle": QUEST_TITLE_FALLBACKS[CH1_01_QUEST_ID],
		"questObjective": OBJECTIVE_FALLBACKS[CH1_01_QUEST_ID],
		"questDescription": QUEST_DESCRIPTION_FALLBACKS[CH1_01_QUEST_ID],
		"questLocation": QUEST_LOCATION_FALLBACKS[CH1_01_QUEST_ID],
		"chapterComplete": false,
		"completedQuestIds": [],
		"totalQuests": 8,
	}
	last_character_snapshot = {}


static func notify_new_game() -> void:
	reset_native_state()
	_post_payload({
		"type": NEW_GAME_EVENT_TYPE,
		"source": EVENT_SOURCE,
	})


static func notify_request_save(slot: String) -> void:
	_post_payload({
		"type": REQUEST_SAVE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"slot": slot,
	})


static func notify_request_save_list() -> void:
	_post_payload({
		"type": REQUEST_SAVE_LIST_EVENT_TYPE,
		"source": EVENT_SOURCE,
	})
