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


static func get_chapter_state() -> Dictionary:
	if not OS.has_feature("web"):
		return {}

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


static func notify_father_intro_completed() -> void:
	_post_payload({
		"type": INTRO_COMPLETE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"questId": CH1_01_QUEST_ID,
		"dialogueId": INTRO_DIALOGUE_ID,
		"eventId": INTRO_EVENT_ID,
	})


static func notify_computer_interaction_completed() -> void:
	_post_payload({
		"type": COMPUTER_COMPLETE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"questId": CH1_02_QUEST_ID,
		"dialogueId": COMPUTER_DIALOGUE_ID,
		"eventId": COMPUTER_EVENT_ID,
	})


static func notify_father_dialogue_completed() -> void:
	_post_payload({
		"type": COMPLETE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"questId": CH1_08_QUEST_ID,
		"dialogueId": RETURN_DIALOGUE_ID,
		"eventId": RETURN_EVENT_ID,
	})
