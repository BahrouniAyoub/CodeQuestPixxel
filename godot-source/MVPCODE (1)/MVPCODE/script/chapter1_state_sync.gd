extends Node

## One-way React → Godot Chapter 1 state notifications.
##
## React remains the sole authority. This autoload only forwards the mirrored
## state to scene nodes so they can refresh their objective UI immediately.

signal chapter_state_changed(state: Dictionary)

const STATE_EVENT_TYPE := "codequest:chapter-state"

var _installed := false
var _js_callback: Variant = null


func _ready() -> void:
	if OS.has_feature("web"):
		_install_listener()


func refresh_from_mirror() -> void:
	chapter_state_changed.emit(CodeQuestBridge.get_chapter_state())


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
	js += "if(!event.data||event.data.type!=='codequest:chapter-state')return;"
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
	if int(state.get("schema", 0)) != 1:
		return

	chapter_state_changed.emit(state)
