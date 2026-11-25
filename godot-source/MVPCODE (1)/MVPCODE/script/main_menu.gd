extends CanvasLayer

const SETTINGS_PATH := "user://codequest_menu.cfg"

@onready var frame: PanelContainer = $Frame
@onready var player_label: Label = $Frame/Margin/VBox/PlayerLabel
@onready var status_label: Label = $Frame/Margin/VBox/StatusLabel
@onready var title_page: Control = $Frame/Margin/VBox/TitlePage
@onready var load_page: Control = $Frame/Margin/VBox/LoadPage
@onready var parameters_page: Control = $Frame/Margin/VBox/ParametersPage
@onready var controls_page: Control = $Frame/Margin/VBox/ControlsPage
@onready var quit_page: Control = $Frame/Margin/VBox/QuitPage
@onready var auto_button: Button = $Frame/Margin/VBox/LoadPage/AutoButton
@onready var slot_buttons: Array[Button] = [
	$Frame/Margin/VBox/LoadPage/Slot1Button,
	$Frame/Margin/VBox/LoadPage/Slot2Button,
	$Frame/Margin/VBox/LoadPage/Slot3Button,
]
@onready var reduce_motion_check: CheckButton = $Frame/Margin/VBox/ParametersPage/ReduceMotionCheck
@onready var show_hints_check: CheckButton = $Frame/Margin/VBox/ParametersPage/ShowHintsCheck


func _ready() -> void:
	_load_settings()
	frame.modulate.a = 1.0
	frame.scale = Vector2.ONE

	$Frame/Margin/VBox/TitlePage/NewGameButton.pressed.connect(_on_new_game)
	$Frame/Margin/VBox/TitlePage/ContinueButton.pressed.connect(_on_continue)
	$Frame/Margin/VBox/TitlePage/LoadButton.pressed.connect(_show_load)
	$Frame/Margin/VBox/TitlePage/ParametersButton.pressed.connect(_show_parameters)
	$Frame/Margin/VBox/TitlePage/ControlsButton.pressed.connect(_show_controls)
	$Frame/Margin/VBox/TitlePage/QuitButton.pressed.connect(_show_quit)

	$Frame/Margin/VBox/LoadPage/AutoButton.pressed.connect(_load_slot.bind("auto"))
	$Frame/Margin/VBox/LoadPage/Slot1Button.pressed.connect(_load_slot.bind("1"))
	$Frame/Margin/VBox/LoadPage/Slot2Button.pressed.connect(_load_slot.bind("2"))
	$Frame/Margin/VBox/LoadPage/Slot3Button.pressed.connect(_load_slot.bind("3"))
	$Frame/Margin/VBox/LoadPage/LoadBackButton.pressed.connect(_show_title)
	$Frame/Margin/VBox/ParametersPage/ParametersBackButton.pressed.connect(_show_title)
	$Frame/Margin/VBox/ControlsPage/ControlsBackButton.pressed.connect(_show_title)
	$Frame/Margin/VBox/QuitPage/QuitBackButton.pressed.connect(_show_title)

	reduce_motion_check.toggled.connect(_on_setting_toggled)
	show_hints_check.toggled.connect(_on_setting_toggled)
	CodeQuestStateSync.load_failed.connect(_on_load_failed)
	CodeQuestStateSync.save_list_received.connect(_on_save_list_received)

	_show_title()
	CodeQuestStateSync.refresh_save_list()


func _all_pages() -> Array:
	return [title_page, load_page, parameters_page, controls_page, quit_page]


func _show_title() -> void:
	_show_page(title_page)


func _show_load() -> void:
	_show_page(load_page)


func _show_parameters() -> void:
	_show_page(parameters_page)


func _show_controls() -> void:
	_show_page(controls_page)


func _show_quit() -> void:
	_show_page(quit_page)


func _show_page(page: Control) -> void:
	for item in _all_pages():
		item.hide()
		item.modulate.a = 1.0
	page.show()
	page.modulate.a = 1.0
	page.scale = Vector2.ONE
	status_label.text = ""


func _on_new_game() -> void:
	status_label.text = "Creating a new character..."
	CodeQuestStateSync.reset_load_state()
	CodeQuestBridge.notify_new_game()
	get_tree().change_scene_to_file("res://scene/customizer.tscn")


func _on_continue() -> void:
	status_label.text = "Loading latest save..."
	CodeQuestStateSync.request_load("auto")


func _load_slot(slot: String) -> void:
	status_label.text = "Loading %s..." % ("AUTO" if slot == "auto" else "SLOT " + slot)
	CodeQuestStateSync.request_load(slot)


func _on_load_failed(reason: String) -> void:
	status_label.text = reason
	_show_title()
	status_label.text = reason


func _on_save_list_received(saves: Array) -> void:
	auto_button.text = "AUTO"
	var index := 0
	for button in slot_buttons:
		button.text = "SLOT %d" % (index + 1)
		index += 1

	var latest_name := ""
	for save in saves:
		if not (save is Dictionary):
			continue
		var item := save as Dictionary
		var slot := String(item.get("slot", ""))
		var name_value := String(item.get("name", "")).strip_edges()
		var label := "AUTO"
		if slot == "1" or slot == "2" or slot == "3":
			label = "SLOT %s" % slot
		var button: Button = null
		if slot == "auto" or slot == "quick":
			button = auto_button
		elif slot == "1":
			button = slot_buttons[0]
		elif slot == "2":
			button = slot_buttons[1]
		elif slot == "3":
			button = slot_buttons[2]
		if button != null and not name_value.is_empty():
			button.text = "%s  %s" % [label, name_value]
		if latest_name.is_empty() and not name_value.is_empty():
			latest_name = name_value

	if latest_name.is_empty():
		latest_name = String(CodeQuestBridge.last_character_snapshot.get("name", "")).strip_edges()
	if latest_name.is_empty():
		latest_name = "NO SAVE YET"
	player_label.text = "PLAYER: %s" % latest_name


func _load_settings() -> void:
	var config := ConfigFile.new()
	if config.load(SETTINGS_PATH) != OK:
		status_label.visible = true
		return
	reduce_motion_check.button_pressed = bool(config.get_value("menu", "reduce_motion", false))
	show_hints_check.button_pressed = bool(config.get_value("menu", "show_hints", true))
	status_label.visible = true


func _on_setting_toggled(_value: bool) -> void:
	var config := ConfigFile.new()
	config.set_value("menu", "reduce_motion", reduce_motion_check.button_pressed)
	config.set_value("menu", "show_hints", show_hints_check.button_pressed)
	config.save(SETTINGS_PATH)
	status_label.visible = true
