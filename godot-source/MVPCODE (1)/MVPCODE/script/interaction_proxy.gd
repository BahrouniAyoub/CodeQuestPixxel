extends Area2D

@export var target: NodePath


func action() -> void:
	var node := get_node_or_null(target)
	if node != null and node.has_method("action"):
		node.call("action")
