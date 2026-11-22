extends CanvasLayer

@onready var backdrop: ColorRect = $Backdrop
@onready var panel: PanelContainer = $Backdrop/Center/Panel
@onready var title_label: Label = $Backdrop/Center/Panel/Margin/VBox/Header/Title
@onready var chapter_label: Label = $Backdrop/Center/Panel/Margin/VBox/Header/Chapter
@onready var progress_label: Label = $Backdrop/Center/Panel/Margin/VBox/Progress
@onready var mission_title: Label = $Backdrop/Center/Panel/Margin/VBox/MissionTitle
@onready var mission_desc: Label = $Backdrop/Center/Panel/Margin/VBox/MissionDesc
@onready var objective_label: Label = $Backdrop/Center/Panel/Margin/VBox/Objective
@onready var location_label: Label = $Backdrop/Center/Panel/Margin/VBox/Location
@onready var completed_label: Label = $Backdrop/Center/Panel/Margin/VBox/Completed
@onready var footer_label: Label = $Backdrop/Center/Panel/Margin/VBox/Footer

var _player_blocked_by_journal := false


func _ready() -> void:
	visible = false
	backdrop.visible = false
	_setup_style()
	if QuestManager.has_signal("quest_state_changed"):
		QuestManager.quest_state_changed.connect(_on_quest_state_changed)
	QuestManager.journal_open_changed.connect(_on_journal_open_changed)
	_refresh(QuestManager.get_snapshot())


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_journal"):
		if QuestManager.journal_open:
			_close_journal()
		else:
			_open_journal()
		get_viewport().set_input_as_handled()
		return

	if QuestManager.journal_open and event.is_action_pressed("ui_cancel"):
		_close_journal()
		get_viewport().set_input_as_handled()


func _setup_style() -> void:
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.10, 0.09, 0.12, 0.98)
	panel_style.border_color = Color(0.86, 0.69, 0.33, 1.0)
	panel_style.set_border_width_all(1)
	panel_style.set_corner_radius_all(2)
	panel_style.set_content_margin_all(4)
	panel.add_theme_stylebox_override("panel", panel_style)

	title_label.add_theme_color_override("font_color", Color(0.96, 0.82, 0.42, 1.0))
	chapter_label.add_theme_color_override("font_color", Color(0.78, 0.72, 0.58, 1.0))
	progress_label.add_theme_color_override("font_color", Color(0.86, 0.76, 0.48, 1.0))
	mission_title.add_theme_color_override("font_color", Color(0.98, 0.95, 0.88, 1.0))
	mission_desc.add_theme_color_override("font_color", Color(0.80, 0.84, 0.88, 1.0))
	objective_label.add_theme_color_override("font_color", Color(0.95, 0.90, 0.72, 1.0))
	location_label.add_theme_color_override("font_color", Color(0.72, 0.80, 0.86, 1.0))
	completed_label.add_theme_color_override("font_color", Color(0.68, 0.76, 0.66, 1.0))
	footer_label.add_theme_color_override("font_color", Color(0.65, 0.60, 0.50, 0.95))

	for lbl: Label in [title_label, chapter_label, progress_label, mission_title, mission_desc, objective_label, location_label, completed_label, footer_label]:
		lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	title_label.add_theme_font_size_override("font_size", 7)
	chapter_label.add_theme_font_size_override("font_size", 5)
	progress_label.add_theme_font_size_override("font_size", 5)
	mission_title.add_theme_font_size_override("font_size", 6)
	mission_desc.add_theme_font_size_override("font_size", 5)
	objective_label.add_theme_font_size_override("font_size", 5)
	location_label.add_theme_font_size_override("font_size", 5)
	completed_label.add_theme_font_size_override("font_size", 4)
	footer_label.add_theme_font_size_override("font_size", 4)


func _open_journal() -> void:
	if QuestManager.journal_open:
		return
	# Avoid opening over an active dialogue.
	var player := _get_player()
	if player != null and not player.can_move and not _player_blocked_by_journal:
		return
	QuestManager.set_journal_open(true)


func _close_journal() -> void:
	if not QuestManager.journal_open:
		return
	QuestManager.set_journal_open(false)


func _on_journal_open_changed(is_open: bool) -> void:
	visible = is_open
	backdrop.visible = is_open
	if is_open:
		_refresh(QuestManager.get_snapshot())
		_block_player(true)
	else:
		_block_player(false)


func _block_player(block: bool) -> void:
	var player := _get_player()
	if player == null:
		return
	if block:
		if player.can_move:
			player.can_move = false
			_player_blocked_by_journal = true
	else:
		if _player_blocked_by_journal:
			player.can_move = true
		_player_blocked_by_journal = false


func _get_player() -> Node:
	var players := get_tree().get_nodes_in_group("player")
	if players.is_empty():
		return null
	return players[0]


func _on_quest_state_changed(snapshot: Dictionary) -> void:
	_refresh(snapshot)


func _refresh(snapshot: Dictionary) -> void:
	if snapshot.is_empty():
		snapshot = CodeQuestBridge.get_active_quest_snapshot()

	var chapter_complete := bool(snapshot.get("chapterComplete", false))
	var chapter_title := String(snapshot.get("chapterTitle", "Chapter 1 — The First Paycheck"))
	var quest_title := String(snapshot.get("questTitle", ""))
	var quest_objective := String(snapshot.get("questObjective", ""))
	var quest_description := String(snapshot.get("questDescription", ""))
	var quest_location := String(snapshot.get("questLocation", ""))
	var completed_ids: Array = snapshot.get("completedQuestIds", [])
	var total := int(snapshot.get("totalQuests", 8))
	var completed_count := completed_ids.size()

	title_label.text = "QUEST JOURNAL"
	chapter_label.text = chapter_title
	progress_label.text = "Progress: %d/%d quests complete" % [completed_count, total]

	if chapter_complete:
		mission_title.text = "Chapter Complete"
		mission_desc.text = "You finished your first programming job and earned your first paycheck."
		objective_label.text = "Objective: Explore, or get ready for the next chapter."
		location_label.text = "Location: Anywhere"
	else:
		mission_title.text = quest_title if not quest_title.is_empty() else "Current Mission"
		mission_desc.text = quest_description if not quest_description.is_empty() else "Check your objective for what to do next."
		objective_label.text = "Objective: " + (quest_objective if not quest_objective.is_empty() else "—")
		location_label.text = "Location: " + (quest_location if not quest_location.is_empty() else "—")

	completed_label.text = _completed_text(snapshot.get("completedQuests", completed_ids))
	footer_label.text = "J or Esc to close"


func _completed_text(completed: Array) -> String:
	if completed.is_empty():
		return "Completed: none yet"
	var names: Array[String] = []
	for entry in completed:
		if typeof(entry) == TYPE_DICTIONARY:
			var title := String((entry as Dictionary).get("title", ""))
			var quest_id := String((entry as Dictionary).get("id", ""))
			names.append(title if not title.is_empty() else _quest_title_for_id(quest_id))
		else:
			names.append(_quest_title_for_id(String(entry)))
	return "Completed: " + ", ".join(names)


func _quest_title_for_id(quest_id: String) -> String:
	# Small local map; React mirror is canonical but this is display-only.
	match quest_id:
		"CH1-01":
			return "A Tough Morning"
		"CH1-02":
			return "Check the Computer"
		"CH1-03":
			return "Find a Job"
		"CH1-04":
			return "Apply for the Job"
		"CH1-05":
			return "Build the Calculator"
		"CH1-06":
			return "Send Your Work"
		"CH1-07":
			return "Get Paid"
		"CH1-08":
			return "Share the Good News"
		_:
			return quest_id
