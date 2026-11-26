extends CanvasLayer

@onready var panel: PanelContainer = $Dim/Panel
@onready var status_label: Label = $Dim/Panel/Margin/VBox/StatusLabel
@onready var name_label: Label = $Dim/Panel/Margin/VBox/NameLabel
@onready var auto_button: Button = $Dim/Panel/Margin/VBox/SlotPage/AutoButton
@onready var slot_buttons: Array = [
	$Dim/Panel/Margin/VBox/SlotPage/Slot1Button,
	$Dim/Panel/Margin/VBox/SlotPage/Slot2Button,
	$Dim/Panel/Margin/VBox/SlotPage/Slot3Button,
]

var _previous_pause := false
var _saving := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	hide()
	$Dim/Panel/Margin/VBox/SlotPage/AutoButton.pressed.connect(_on_save_slot.bind("auto"))
	$Dim/Panel/Margin/VBox/SlotPage/Slot1Button.pressed.connect(_on_save_slot.bind("1"))
	$Dim/Panel/Margin/VBox/SlotPage/Slot2Button.pressed.connect(_on_save_slot.bind("2"))
	$Dim/Panel/Margin/VBox/SlotPage/Slot3Button.pressed.connect(_on_save_slot.bind("3"))
	$Dim/Panel/Margin/VBox/SlotPage/BackButton.pressed.connect(close)
	CodeQuestStateSync.save_saved.connect(_on_saved)
	CodeQuestStateSync.save_failed.connect(_on_failed)
	CodeQuestStateSync.save_list_received.connect(_on_save_list_received)


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventKey:
		var key := event as InputEventKey
		if key.pressed and not key.echo and key.keycode == KEY_ESCAPE:
			get_viewport().set_input_as_handled()
			close()


func open() -> void:
	if visible:
		return
	_previous_pause = get_tree().paused
	get_tree().paused = true
	show()
	_saving = false
	panel.modulate.a = 1.0
	panel.scale = Vector2.ONE
	_set_buttons_disabled(false)
	name_label.text = "PLAYER: %s" % _current_name()
	status_label.text = "Choose a slot to save"
	CodeQuestStateSync.refresh_save_list()


func close() -> void:
	if not visible:
		return
	hide()
	_saving = false
	get_tree().paused = _previous_pause


func _current_name() -> String:
	var name_value := String(CodeQuestBridge.last_character_snapshot.get("name", "")).strip_edges()
	if name_value.is_empty():
		name_value = CharacterSettings.character_name.strip_edges()
	return name_value if not name_value.is_empty() else "PLAYER"


func _on_save_slot(slot: String) -> void:
	if _saving:
		return
	_saving = true
	_set_buttons_disabled(true)
	status_label.text = "Saving to %s..." % ("AUTO" if slot == "auto" else "SLOT " + slot)
	CodeQuestBridge.notify_request_state(slot, "Bedroom rest")


func _set_buttons_disabled(value: bool) -> void:
	auto_button.disabled = value
	for button in slot_buttons:
		button.disabled = value


func _on_saved(slot: String) -> void:
	if not visible:
		return
	status_label.text = "Saved to %s" % ("AUTO" if slot == "auto" else "SLOT " + slot)
	await get_tree().create_timer(0.55, true).timeout
	close()


func _on_failed(reason: String) -> void:
	if not visible:
		return
	status_label.text = reason
	_saving = false
	_set_buttons_disabled(false)


func _on_save_list_received(saves: Array) -> void:
	if not visible:
		return
	for save in saves:
		if not (save is Dictionary):
			continue
		var item := save as Dictionary
		if String(item.get("slot", "")) == "auto":
			name_label.text = "PLAYER: %s" % String(item.get("name", _current_name()))
			return
