extends Area2D

@export var dialogue_resource: DialogueResource
@export var dialogue_start: String = "start"

# Step 8G: optional second dialogue, used only for CH1-08 and only when React's
# mirrored state says that quest is active.
@export var return_dialogue_resource: DialogueResource
@export var return_dialogue_start: String = "start"
@export var completion_quest_id: String = ""
# Optional friendly dialogue shown after Chapter 1 is complete.
@export var post_complete_dialogue_resource: DialogueResource
@export var post_complete_dialogue_start: String = "start"
@export var prompt_label: Label
@export var friendly_dialogue: bool = false

@export var player: CharacterBody2D
@export var npc: Node2D

var dialogue_balloon: Node = null
var player_nearby := false
var _using_return_dialogue := false
var _return_event_sent := false
var _using_intro_dialogue := false
var _intro_event_sent := false
var _using_post_complete_dialogue := false
var _using_friendly_dialogue := false


func _ready() -> void:
	add_to_group("dialogue_actionable")
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	if prompt_label:
		prompt_label.hide()


func _can_talk_now() -> bool:
	if QuestManager.journal_open:
		return false

	if friendly_dialogue:
		return dialogue_resource != null

	var chapter_complete := CodeQuestBridge.is_chapter_complete()
	var quest_id := CodeQuestBridge.get_chapter_quest_id()

	if chapter_complete:
		return post_complete_dialogue_resource != null

	if completion_quest_id == CodeQuestBridge.CH1_08_QUEST_ID and quest_id == CodeQuestBridge.CH1_08_QUEST_ID:
		return return_dialogue_resource != null

	return quest_id == CodeQuestBridge.CH1_01_QUEST_ID and dialogue_resource != null


func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = true
		if prompt_label:
			prompt_label.visible = _can_talk_now()


func _on_body_exited(body: Node2D) -> void:
	if body is CharacterBody2D:
		player_nearby = false
		if prompt_label:
			prompt_label.hide()


func action() -> void:
	if QuestManager.journal_open:
		return

	# If dialogue is already open, close it. Closing early never emits a
	# completion event; only DialogueManager.dialogue_ended does that.
	if is_instance_valid(dialogue_balloon):
		_close_dialogue()
		return

	if not _can_talk_now():
		return

	var chapter_complete := CodeQuestBridge.is_chapter_complete()
	var quest_id := CodeQuestBridge.get_chapter_quest_id()

	_using_friendly_dialogue = friendly_dialogue
	_using_return_dialogue = (
		not friendly_dialogue
		and not chapter_complete
		and completion_quest_id == CodeQuestBridge.CH1_08_QUEST_ID
		and return_dialogue_resource != null
		and quest_id == CodeQuestBridge.CH1_08_QUEST_ID
	)
	_using_intro_dialogue = (
		not friendly_dialogue
		and not chapter_complete
		and not _using_return_dialogue
		and dialogue_resource != null
		and quest_id == CodeQuestBridge.CH1_01_QUEST_ID
	)
	_using_post_complete_dialogue = (
		not friendly_dialogue
		and chapter_complete
		and not _using_return_dialogue
		and not _using_intro_dialogue
		and post_complete_dialogue_resource != null
	)

	var chosen_resource: DialogueResource = dialogue_resource
	var chosen_start := dialogue_start
	if _using_return_dialogue:
		chosen_resource = return_dialogue_resource
		chosen_start = return_dialogue_start
	elif _using_post_complete_dialogue:
		chosen_resource = post_complete_dialogue_resource
		chosen_start = post_complete_dialogue_start
	elif not _using_intro_dialogue and not _using_friendly_dialogue:
		return

	if chosen_resource == null:
		return

	if prompt_label:
		prompt_label.hide()

	# Stop player and NPC movement.
	set_characters_movement(false)

	dialogue_balloon = DialogueManager.show_example_dialogue_balloon(
		chosen_resource,
		chosen_start
	)

	if is_instance_valid(dialogue_balloon):
		var completion_tracked := _using_return_dialogue or _using_intro_dialogue
		if completion_tracked and not DialogueManager.dialogue_ended.is_connected(_on_dialogue_ended):
			DialogueManager.dialogue_ended.connect(_on_dialogue_ended)
		dialogue_balloon.tree_exited.connect(_on_dialogue_closed)


func _on_dialogue_ended(resource: DialogueResource) -> void:
	# The signal is global, so verify it belongs to the exact dialogue we opened.
	if _using_return_dialogue:
		if resource != return_dialogue_resource or _return_event_sent:
			return
		# Safety guard: never emit the final completion again after chapter is done.
		if CodeQuestBridge.is_chapter_complete():
			return
		_return_event_sent = true
		CodeQuestBridge.notify_father_dialogue_completed()
		_refresh_mirror_after_completion(true)
		return

	if _using_intro_dialogue:
		if resource != dialogue_resource or _intro_event_sent:
			return
		# Only complete CH1-01 once and only while it is active.
		if CodeQuestBridge.get_chapter_quest_id() != CodeQuestBridge.CH1_01_QUEST_ID or CodeQuestBridge.is_chapter_complete():
			return
		_intro_event_sent = true
		CodeQuestBridge.notify_father_intro_completed()
		_refresh_mirror_after_completion(false)


func _refresh_mirror_after_completion(wait_for_chapter_complete: bool) -> void:
	for i in 10:
		await get_tree().create_timer(0.25).timeout
		CodeQuestStateSync.refresh_from_mirror()
		var snapshot := CodeQuestBridge.get_active_quest_snapshot()
		if wait_for_chapter_complete:
			if bool(snapshot.get("chapterComplete", false)):
				return
		elif String(snapshot.get("questId", "")) != CodeQuestBridge.CH1_01_QUEST_ID:
			return


func _close_dialogue() -> void:
	if is_instance_valid(dialogue_balloon):
		dialogue_balloon.queue_free()
	dialogue_balloon = null
	_disconnect_dialogue_ended()
	_using_return_dialogue = false
	_using_intro_dialogue = false
	_using_post_complete_dialogue = false
	_using_friendly_dialogue = false
	set_characters_movement(true)
	if prompt_label and player_nearby:
		prompt_label.visible = _can_talk_now()


func _disconnect_dialogue_ended() -> void:
	if DialogueManager.dialogue_ended.is_connected(_on_dialogue_ended):
		DialogueManager.dialogue_ended.disconnect(_on_dialogue_ended)


func set_characters_movement(enabled: bool) -> void:
	if is_instance_valid(player):
		player.can_move = enabled

	if is_instance_valid(npc):
		npc.can_move = enabled


func _on_dialogue_closed() -> void:
	_disconnect_dialogue_ended()

	var ended_with_event := _intro_event_sent or _return_event_sent
	_using_return_dialogue = false
	_using_intro_dialogue = false
	_using_post_complete_dialogue = false
	_using_friendly_dialogue = false
	dialogue_balloon = null
	set_characters_movement(true)

	# A premature close has no bridge event, so restore the authoritative
	# objective from React instead of inventing a new quest state locally.
	if not ended_with_event:
		CodeQuestStateSync.refresh_from_mirror()

	if prompt_label and player_nearby:
		prompt_label.visible = _can_talk_now()
