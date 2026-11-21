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


static func is_ch1_08_active() -> bool:
	var state := get_chapter_state()
	return (
		int(state.get("schema", 0)) == 1
		and String(state.get("questId", "")) == CH1_08_QUEST_ID
		and bool(state.get("chapterComplete", true)) == false
	)


static func notify_father_dialogue_completed() -> void:
	if not OS.has_feature("web"):
		return

	var payload := {
		"type": COMPLETE_EVENT_TYPE,
		"source": EVENT_SOURCE,
		"questId": CH1_08_QUEST_ID,
		"dialogueId": RETURN_DIALOGUE_ID,
		"eventId": RETURN_EVENT_ID,
	}

	# JSON.stringify twice: once for the payload, once to make a safe JS literal.
	var escaped_json := JSON.stringify(JSON.stringify(payload))
	var script: String = "window.parent.postMessage(JSON.parse(%s), window.location.origin);" % escaped_json
	JavaScriptBridge.eval(script, true)
