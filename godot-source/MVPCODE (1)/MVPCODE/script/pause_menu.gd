extends CanvasLayer

@onready var panel: PanelContainer = $Dim/Panel
@onready var name_label: Label = $Dim/Panel/Margin/VBox/NameLabel
@onready var status_label: Label = $Dim/Panel/Margin/VBox/StatusLabel
@onready var main_page: Control = $Dim/Panel/Margin/VBox/MainPage
@onready var load_page: Control = $Dim/Panel/Margin/VBox/LoadPage
@onready var slot_buttons: Array = [
	$Dim/Panel/Margin/VBox/LoadPage/AutoButton,
	$Dim/Panel/Margin/VBox/LoadPage/Slot1Button,
	$Dim/Panel/Margin/VBox/LoadPage/Slot2Button,
	$Dim/Panel/Margin/VBox/LoadPage/Slot3Button,
]

var _slot_names := {
	"auto": "AUTO",
	"quick": "AUTO",
	"1": "SLOT 1",
	"2": "SLOT 2",
	"3": "SLOT 3",
}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	hide()
	$Dim/Panel/Margin/VBox/MainPage/BackToGameButton.pressed.connect(close)
	$Dim/Panel/Margin/VBox/MainPage/SaveGameButton.pressed.connect(_open_save_menu)
	$Dim/Panel/Margin/VBox/MainPage/LoadGameButton.pressed.connect(_show_load)
	$Dim/Panel/Margin/VBox/MainPage/QuitButton.pressed.connect(_quit_to_menu)
	$Dim/Panel/Margin/VBox/LoadPage/AutoButton.pressed.connect(_load_slot.bind("auto"))
	$Dim/Panel/Margin/VBox/LoadPage/Slot1Button.pressed.connect(_load_slot.bind("1"))
	$Dim/Panel/Margin/VBox/LoadPage/Slot2Button.pressed.connect(_load_slot.bind("2"))
	$Dim/Panel/Margin/VBox/LoadPage/Slot3Button.pressed.connect(_load_slot.bind("3"))
	$Dim/Panel/Margin/VBox/LoadPage/LoadBackButton.pressed.connect(_show_main)
	CodeQuestStateSync.save_list_received.connect(_on_save_list_received)
	CodeQuestStateSync.load_failed.connect(_on_load_failed)


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey):
		return
	var key := event as InputEventKey
	var save_menu := get_tree().get_first_node_in_group("save_menu")
	if save_menu != null and save_menu.visible:
		return
	if key.pressed and not key.echo and key.keycode == KEY_ESCAPE:
		get_viewport().set_input_as_handled()
		if visible:
			close()
		else:
			open()


func open() -> void:
	if visible:
		return
	get_tree().paused = true
	show()
	panel.modulate.a = 1.0
	panel.scale = Vector2.ONE
	_show_main()
	name_label.text = "PLAYER: %s" % _current_name()
	CodeQuestStateSync.refresh_save_list()


func close() -> void:
	if not visible:
		return
	hide()
	get_tree().paused = false


func _show_main() -> void:
	load_page.hide()
	main_page.show()
	status_label.text = ""


func _show_load() -> void:
	main_page.hide()
	load_page.show()
	status_label.text = "Choose a save to load"
	CodeQuestStateSync.refresh_save_list()


func _open_save_menu() -> void:
	var save_menu := get_tree().get_first_node_in_group("save_menu")
	if save_menu != null and save_menu.has_method("open"):
		save_menu.call("open")


func _load_slot(slot: String) -> void:
	status_label.text = "Loading %s..." % String(_slot_names.get(slot, slot))
	CodeQuestStateSync.request_load(slot)


func _quit_to_menu() -> void:
	close()
	get_tree().change_scene_to_file("res://scene/main_menu.tscn")


func _current_name() -> String:
	var name_value := String(CodeQuestBridge.last_character_snapshot.get("name", "")).strip_edges()
	if name_value.is_empty():
		name_value = CharacterSettings.character_name.strip_edges()
	return name_value if not name_value.is_empty() else "PLAYER"


func _on_load_failed(reason: String) -> void:
	if visible:
		status_label.text = reason


func _on_save_list_received(saves: Array) -> void:
	if not visible:
		return
	for save in saves:
		if not (save is Dictionary):
			continue
		var item := save as Dictionary
		var slot := String(item.get("slot", ""))
		var label := String(_slot_names.get(slot, slot.to_upper()))
		var name_value := String(item.get("name", "PLAYER"))
		for button in slot_buttons:
			if button.name == "AutoButton" and (slot == "auto" or slot == "quick"):
				button.text = "%s  %s" % [label, name_value]
			elif button.name == "Slot1Button" and slot == "1":
				button.text = "%s  %s" % [label, name_value]
			elif button.name == "Slot2Button" and slot == "2":
				button.text = "%s  %s" % [label, name_value]
			elif button.name == "Slot3Button" and slot == "3":
				button.text = "%s  %s" % [label, name_value]
