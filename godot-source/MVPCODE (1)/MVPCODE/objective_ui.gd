extends CanvasLayer

@onready var panel: PanelContainer = $PanelContainer
@onready var title_label: Label = $PanelContainer/VBoxContainer/ObjectiveTitle
@onready var description_label: Label = $PanelContainer/VBoxContainer/ObjectiveDescription

func _ready():
	QuestManager.objective_changed.connect(update_objective)

	panel.position = Vector2(40, 0)
	panel.scale = Vector2(0.25, 0.25)

	update_objective(
		QuestManager.current_objective,
		QuestManager.current_description
	)


func update_objective(title: String, description: String):
	title_label.text = "OBJECTIVE: " + title
	description_label.text = description
