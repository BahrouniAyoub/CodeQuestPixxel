extends CanvasLayer

@onready var panel: PanelContainer = $PanelContainer
@onready var chapter_label: Label = $PanelContainer/Margin/VBox/ChapterLabel
@onready var title_label: Label = $PanelContainer/Margin/VBox/TitleLabel
@onready var objective_label: Label = $PanelContainer/Margin/VBox/ObjectiveLabel
@onready var hint_label: Label = $PanelContainer/Margin/VBox/HintLabel

var _last_quest_id := ""
var _tween: Tween


func _ready() -> void:
	_setup_style()
	if QuestManager.has_signal("quest_state_changed"):
		QuestManager.quest_state_changed.connect(_on_quest_state_changed)
	QuestManager.objective_changed.connect(_on_objective_changed)

	var snapshot := QuestManager.get_snapshot()
	if snapshot.is_empty():
		snapshot = CodeQuestBridge.get_active_quest_snapshot()
	_on_quest_state_changed(snapshot)


func _setup_style() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.07, 0.10, 0.92)
	style.border_color = Color(0.85, 0.68, 0.32, 0.95)
	style.set_border_width_all(1)
	style.set_corner_radius_all(2)
	style.set_content_margin_all(3)
	style.shadow_color = Color(0, 0, 0, 0.35)
	style.shadow_size = 2
	panel.add_theme_stylebox_override("panel", style)

	chapter_label.add_theme_color_override("font_color", Color(0.95, 0.80, 0.45, 1.0))
	title_label.add_theme_color_override("font_color", Color(0.98, 0.95, 0.88, 1.0))
	objective_label.add_theme_color_override("font_color", Color(0.82, 0.86, 0.90, 1.0))
	hint_label.add_theme_color_override("font_color", Color(0.72, 0.66, 0.50, 0.9))

	chapter_label.add_theme_font_size_override("font_size", 5)
	title_label.add_theme_font_size_override("font_size", 6)
	objective_label.add_theme_font_size_override("font_size", 5)
	hint_label.add_theme_font_size_override("font_size", 4)

	objective_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	objective_label.max_lines_visible = 2


func _on_objective_changed(title: String, description: String) -> void:
	# Rich updates come through quest_state_changed; keep this as fallback.
	if not _current_snapshot_has_data():
		title_label.text = title
		objective_label.text = description
		chapter_label.text = CodeQuestBridge.get_chapter_title()
		hint_label.text = "J · Journal"


func _current_snapshot_has_data() -> bool:
	return not _last_quest_id.is_empty() or bool(QuestManager.get_snapshot().get("chapterComplete", false))


func _on_quest_state_changed(snapshot: Dictionary) -> void:
	var chapter_complete := bool(snapshot.get("chapterComplete", false))
	var quest_id := String(snapshot.get("questId", ""))
	var chapter_title := String(snapshot.get("chapterTitle", "Chapter 1 — The First Paycheck"))
	var quest_title := String(snapshot.get("questTitle", ""))
	var objective := String(snapshot.get("questObjective", ""))

	chapter_label.text = chapter_title.to_upper()
	hint_label.text = "J · Journal"

	if chapter_complete:
		title_label.text = "Chapter Complete"
		objective_label.text = "You finished your first job. Great work!"
	elif quest_id.is_empty():
		title_label.text = "Quest"
		objective_label.text = objective if not objective.is_empty() else "Check your journal for details."
	else:
		title_label.text = quest_title
		objective_label.text = objective

	var changed := quest_id != _last_quest_id
	_last_quest_id = quest_id
	if changed and is_node_ready():
		_play_change_transition()


func _play_change_transition() -> void:
	if _tween and _tween.is_valid():
		_tween.kill()
	panel.modulate.a = 0.55
	var base_pos := panel.position
	panel.position = base_pos + Vector2(0, -2)
	_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_property(panel, "modulate:a", 1.0, 0.22)
	_tween.tween_property(panel, "position", base_pos, 0.22)
