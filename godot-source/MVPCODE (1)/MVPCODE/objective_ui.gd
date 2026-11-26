extends CanvasLayer

const VISIBLE_X := 6.0
const HIDDEN_X := -84.0
const ACCENT_COLOR := Color(0.35, 0.65, 1.0)
const COMPLETE_COLOR := Color(1.0, 0.78, 0.3)

@onready var panel: PanelContainer = $PanelContainer
@onready var chapter_label: Label = $PanelContainer/Margin/VBox/Header/ChapterLabel
@onready var hint_label: Label = $PanelContainer/Margin/VBox/Header/HintLabel
@onready var close_button: Button = $PanelContainer/Margin/VBox/Header/CloseButton
@onready var title_label: Label = $PanelContainer/Margin/VBox/TitleLabel
@onready var objective_label: Label = $PanelContainer/Margin/VBox/ObjectiveLabel
@onready var open_tab: Button = $OpenTab

var _last_quest_id := ""
var _last_complete := false
var _tween: Tween
var _hide_timer: Timer
var _panel_style: StyleBoxFlat
var _tab_style: StyleBoxFlat
var _is_open := false


func _ready() -> void:
	_setup_style()

	panel.visible = false
	panel.modulate.a = 0.0
	open_tab.visible = false

	_hide_timer = Timer.new()
	_hide_timer.one_shot = true
	_hide_timer.timeout.connect(_hide_panel)
	add_child(_hide_timer)

	if not close_button.pressed.is_connected(_on_close_pressed):
		close_button.pressed.connect(_on_close_pressed)
	if not open_tab.pressed.is_connected(_on_open_pressed):
		open_tab.pressed.connect(_on_open_pressed)

	if QuestManager.has_signal("quest_state_changed"):
		QuestManager.quest_state_changed.connect(_on_quest_state_changed)

	if QuestManager.has_signal("objective_changed"):
		QuestManager.objective_changed.connect(_on_objective_changed)

	var snapshot: Dictionary = QuestManager.get_snapshot()

	if snapshot.is_empty():
		snapshot = CodeQuestBridge.get_active_quest_snapshot()

	_on_quest_state_changed(snapshot)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_objective"):
		get_viewport().set_input_as_handled()
		_toggle_panel()


func _toggle_panel() -> void:
	if _is_open:
		_hide_panel()
	else:
		_show_panel()


func _setup_style() -> void:
	panel.set_anchors_preset(Control.PRESET_TOP_LEFT)
	panel.custom_minimum_size = Vector2(0, 0)
	panel.position = Vector2(VISIBLE_X, 6.0)
	panel.scale = Vector2.ONE
	panel.pivot_offset = Vector2(0, panel.size.y / 2.0)
	panel.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	panel.size_flags_vertical = Control.SIZE_SHRINK_BEGIN

	_panel_style = StyleBoxFlat.new()
	_panel_style.bg_color = Color(0.03, 0.05, 0.085, 0.94)
	_panel_style.border_color = ACCENT_COLOR
	_panel_style.set_border_width(SIDE_LEFT, 2)
	_panel_style.set_border_width(SIDE_TOP, 1)
	_panel_style.set_border_width(SIDE_RIGHT, 1)
	_panel_style.set_border_width(SIDE_BOTTOM, 1)
	_panel_style.set_corner_radius_all(2)
	_panel_style.set_content_margin_all(0)
	_panel_style.shadow_color = Color(0, 0, 0, 0.55)
	_panel_style.shadow_size = 3
	_panel_style.shadow_offset = Vector2(0, 2)
	panel.add_theme_stylebox_override("panel", _panel_style)

	var margin := panel.get_node("Margin") as MarginContainer
	margin.add_theme_constant_override("margin_left", 5)
	margin.add_theme_constant_override("margin_right", 3)
	margin.add_theme_constant_override("margin_top", 2)
	margin.add_theme_constant_override("margin_bottom", 2)

	var vbox := panel.get_node("Margin/VBox") as VBoxContainer
	vbox.add_theme_constant_override("separation", 0)

	chapter_label.add_theme_font_size_override("font_size", 5)
	hint_label.add_theme_font_size_override("font_size", 5)
	title_label.add_theme_font_size_override("font_size", 7)
	objective_label.add_theme_font_size_override("font_size", 6)

	chapter_label.add_theme_color_override("font_color", ACCENT_COLOR)
	hint_label.add_theme_color_override("font_color", Color(0.4, 0.55, 0.72))
	title_label.add_theme_color_override("font_color", Color.WHITE)

	chapter_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	chapter_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER

	chapter_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	title_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	chapter_label.clip_text = true
	title_label.clip_text = true

	close_button.flat = true
	close_button.custom_minimum_size = Vector2(9, 9)
	close_button.add_theme_font_size_override("font_size", 7)
	close_button.add_theme_color_override("font_color", Color(0.45, 0.6, 0.8))
	close_button.add_theme_color_override("font_hover_color", Color.WHITE)

	_tab_style = StyleBoxFlat.new()
	_tab_style.bg_color = Color(0.03, 0.05, 0.085, 0.94)
	_tab_style.border_color = ACCENT_COLOR
	_tab_style.set_border_width_all(1)
	_tab_style.set_corner_radius_all(2)
	_tab_style.set_content_margin_all(3)
	open_tab.add_theme_stylebox_override("normal", _tab_style)

	var tab_hover := _tab_style.duplicate() as StyleBoxFlat
	tab_hover.bg_color = Color(0.08, 0.14, 0.24, 0.98)
	open_tab.add_theme_stylebox_override("hover", tab_hover)
	open_tab.add_theme_font_size_override("font_size", 5)
	open_tab.add_theme_color_override("font_color", ACCENT_COLOR)

	chapter_label.visible = true
	title_label.visible = true
	hint_label.visible = true
	objective_label.visible = false

	panel.size = Vector2(78, 28)
	panel.pivot_offset = Vector2(0, panel.size.y / 2.0)


func _set_accent(color: Color) -> void:
	_panel_style.border_color = color
	_tab_style.border_color = color
	chapter_label.add_theme_color_override("font_color", color)
	open_tab.add_theme_color_override("font_color", color)


func _on_close_pressed() -> void:
	_toggle_panel()


func _on_open_pressed() -> void:
	_toggle_panel()


func _on_objective_changed(title: String, description: String) -> void:
	if not _current_snapshot_has_data():
		chapter_label.text = "OBJECTIVE"
		title_label.text = title
		_show_panel()


func _current_snapshot_has_data() -> bool:
	var snapshot: Dictionary = QuestManager.get_snapshot()
	return (
		not _last_quest_id.is_empty()
		or bool(snapshot.get("chapterComplete", false))
	)


func _on_quest_state_changed(snapshot: Dictionary) -> void:
	var chapter_complete := bool(snapshot.get("chapterComplete", false))
	var quest_id := String(snapshot.get("questId", ""))
	var quest_title := String(snapshot.get("questTitle", ""))

	chapter_label.text = "CHAPTER COMPLETE" if chapter_complete else "OBJECTIVE"
	_set_accent(COMPLETE_COLOR if chapter_complete else ACCENT_COLOR)

	if chapter_complete:
		title_label.text = "Chapter 1 Complete!"
	elif not quest_title.is_empty():
		title_label.text = quest_title
	else:
		title_label.text = "New Quest"

	var changed := quest_id != _last_quest_id or chapter_complete != _last_complete
	_last_quest_id = quest_id
	_last_complete = chapter_complete

	if changed and (not quest_id.is_empty() or chapter_complete):
		_show_panel()


func _show_panel() -> void:
	_is_open = true

	if _tween and _tween.is_valid():
		_tween.kill()

	_hide_timer.stop()
	open_tab.visible = false

	panel.visible = true
	panel.modulate.a = 0.0
	panel.position.x = HIDDEN_X
	panel.scale = Vector2(0.94, 0.94)
	panel.pivot_offset = Vector2(0, panel.size.y / 2.0)

	_tween = create_tween()
	_tween.set_parallel(true)
	_tween.tween_property(panel, "modulate:a", 1.0, 0.2)
	_tween.tween_property(panel, "position:x", VISIBLE_X, 0.28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_property(panel, "scale", Vector2.ONE, 0.28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.chain().tween_callback(_pulse_panel)

	_hide_timer.start(12.0)


func _pulse_panel() -> void:
	if not panel.visible:
		return

	_tween = create_tween()
	_tween.tween_property(panel, "scale", Vector2(1.03, 1.03), 0.09)
	_tween.tween_property(panel, "scale", Vector2.ONE, 0.12)


func _hide_panel() -> void:
	_is_open = false

	if not panel.visible:
		return

	if _tween and _tween.is_valid():
		_tween.kill()

	_hide_timer.stop()

	_tween = create_tween()
	_tween.set_parallel(true)
	_tween.tween_property(panel, "modulate:a", 0.0, 0.14)
	_tween.tween_property(panel, "position:x", HIDDEN_X, 0.22).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	_tween.tween_property(panel, "scale", Vector2(0.94, 0.94), 0.22)
	_tween.chain().tween_callback(_show_open_tab)


func _show_open_tab() -> void:
	panel.visible = false
	open_tab.visible = true
	open_tab.modulate.a = 0.0
	open_tab.scale = Vector2(0.8, 0.8)
	open_tab.pivot_offset = open_tab.size / 2.0

	_tween = create_tween()
	_tween.set_parallel(true)
	_tween.tween_property(open_tab, "modulate:a", 1.0, 0.16)
	_tween.tween_property(open_tab, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
