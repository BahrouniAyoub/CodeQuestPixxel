import { describe, expect, it } from "vitest";
import { CHAPTER1_QUESTS } from "./chapter1Quests";
import actionableSource from "../../../godot-source/MVPCODE (1)/MVPCODE/scene/actionable.gd?raw";
import closetAreaSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/area_2d.gd?raw";
import closetSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/customizercloset.gd?raw";
import bedSaveSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/bed_save.gd?raw";
import bridgeSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/codequest_bridge.gd?raw";
import gameSceneSource from "../../../godot-source/MVPCODE (1)/MVPCODE/scene/Game.tscn?raw";
import mainMenuSceneSource from "../../../godot-source/MVPCODE (1)/MVPCODE/scene/main_menu.tscn?raw";
import mainMenuScriptSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/main_menu.gd?raw";
import pauseMenuSceneSource from "../../../godot-source/MVPCODE (1)/MVPCODE/scene/pause_menu.tscn?raw";
import pauseMenuScriptSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/pause_menu.gd?raw";
import saveMenuSceneSource from "../../../godot-source/MVPCODE (1)/MVPCODE/scene/save_menu.tscn?raw";
import saveMenuScriptSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/save_menu.gd?raw";
import computerSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/computer_interaction.gd?raw";
import fatherSource from "../../../godot-source/MVPCODE (1)/MVPCODE/scene/father.gd?raw";
import projectSource from "../../../godot-source/MVPCODE (1)/MVPCODE/project.godot?raw";
import questManagerSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/QuestManager.gd?raw";
import saveStoreSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/codequest_save_store.gd?raw";
import stateSyncSource from "../../../godot-source/MVPCODE (1)/MVPCODE/script/chapter1_state_sync.gd?raw";

/** Returns the body of one top-level GDScript function. */
function functionBody(source: string, functionName: string): string {
  const marker = `func ${functionName}(`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const next = source.indexOf("\nfunc ", start + marker.length);
  return next < 0 ? source.slice(start) : source.slice(start, next);
}

describe("Godot source contract", () => {
  it("posts the exact CH1-01 and CH1-02 payloads from CodeQuestBridge", () => {
    expect(bridgeSource).toContain(
      'const INTRO_COMPLETE_EVENT_TYPE := "codequest:chapter1-intro-complete"',
    );
    expect(bridgeSource).toContain('const INTRO_DIALOGUE_ID := "father-intro-v1"');
    expect(bridgeSource).toContain('const INTRO_EVENT_ID := "ch1-01-father-dialogue-v1"');
    expect(bridgeSource).toContain(
      'const COMPUTER_COMPLETE_EVENT_TYPE := "codequest:chapter1-computer-complete"',
    );
    expect(bridgeSource).toContain('const COMPUTER_DIALOGUE_ID := "computer-interaction-v1"');
    expect(bridgeSource).toContain('const COMPUTER_EVENT_ID := "ch1-02-computer-interaction-v1"');
    expect(functionBody(bridgeSource, "notify_father_intro_completed")).toContain(
      "INTRO_COMPLETE_EVENT_TYPE",
    );
    expect(functionBody(bridgeSource, "notify_computer_interaction_completed")).toContain(
      "COMPUTER_COMPLETE_EVENT_TYPE",
    );
  });

  it("uses the canonical Chapter 1 objective text in the native fallback map", () => {
    for (const quest of CHAPTER1_QUESTS) {
      expect(bridgeSource).toContain(`"${quest.id}": "${quest.objective}"`);
    }
    expect(bridgeSource).toContain('"CH1-08": "Go home and tell Dad about your job"');
  });

  it("emits CH1-01 only on the true father dialogue end, never on open or premature close", () => {
    expect(actionableSource).toContain(
      "DialogueManager.dialogue_ended.connect(_on_dialogue_ended)",
    );
    expect(functionBody(actionableSource, "_on_dialogue_ended")).toContain(
      "CodeQuestBridge.notify_father_intro_completed()",
    );
    expect(functionBody(actionableSource, "_close_dialogue")).not.toContain(
      "notify_father_intro_completed",
    );
    expect(functionBody(actionableSource, "_on_dialogue_closed")).not.toContain(
      "notify_father_intro_completed",
    );
    expect(functionBody(actionableSource, "_on_dialogue_closed")).not.toContain(
      "notify_father_dialogue_completed",
    );
    expect(functionBody(actionableSource, "_on_dialogue_closed")).not.toContain(
      "Go to your computer",
    );
    expect(actionableSource).toContain("dialogue_balloon.tree_exited.connect(_on_dialogue_closed)");
  });

  it("emits CH1-02 only inside the real E-key interaction", () => {
    const input = functionBody(computerSource, "_unhandled_input");
    const ready = functionBody(computerSource, "_ready");

    expect(input).toContain("event is InputEventKey and event.pressed and not event.echo");
    expect(input).toContain("event.keycode == interaction_key");
    expect(input).toContain("CodeQuestBridge.notify_computer_interaction_completed()");
    expect(input).toContain("codequest:open-os");
    expect(ready).not.toContain("notify_computer_interaction_completed");
    expect(computerSource).not.toContain("QuestManager.complete_quest()");
  });

  it("refreshes the Godot objective from React state instead of polling or reloading", () => {
    expect(questManagerSource).toContain(
      "CodeQuestStateSync.chapter_state_changed.connect(_on_chapter_state_changed)",
    );
    expect(questManagerSource).toContain("CodeQuestBridge.get_active_quest_snapshot()");
    expect(questManagerSource).not.toContain("_poll_chapter_objective");
    expect(questManagerSource).not.toContain("for _i in range(12)");
    expect(fatherSource).not.toContain("change_scene");

    expect(stateSyncSource).toContain("window.addEventListener('message'");
    expect(stateSyncSource).toContain("event.origin!==window.location.origin");
    expect(stateSyncSource).toContain("event.source!==window.parent");
    expect(stateSyncSource).toContain("codequest:chapter-state");
    expect(projectSource).toContain('CodeQuestStateSync="*res://script/chapter1_state_sync.gd"');
  });

  it("centralizes quest markers in QuestManager with single active target", () => {
    expect(questManagerSource).toContain('"CH1-01"');
    expect(questManagerSource).toContain('"CH1-02"');
    expect(questManagerSource).toContain('"CH1-08"');
    expect(questManagerSource).toContain('"father"');
    expect(questManagerSource).toContain('"screen"');
    expect(questManagerSource).toContain("hide_marker()");
    // CH1-03..CH1-07 should not create world marker targets.
    expect(questManagerSource).toContain("CH1-03..CH1-07");
  });

  it("wires the J-key quest journal and blocks world interaction while open", () => {
    expect(projectSource).toContain("toggle_journal");
    expect(projectSource).toContain('physical_keycode":74');
    expect(actionableSource).toContain("QuestManager.journal_open");
    expect(computerSource).toContain("QuestManager.journal_open");
  });

  it("guards father post-completion dialogue and prevents repeat final completion", () => {
    expect(actionableSource).toContain("post_complete_dialogue_resource");
    expect(actionableSource).toContain("_using_post_complete_dialogue");
    expect(functionBody(actionableSource, "_on_dialogue_ended")).toContain(
      "CodeQuestBridge.is_chapter_complete()",
    );
    expect(functionBody(actionableSource, "_on_dialogue_ended")).toContain(
      "notify_father_dialogue_completed()",
    );
  });

  it("starts in a static fullscreen Godot menu backed by Godot save files", () => {
    expect(projectSource).toContain('run/main_scene="uid://cqmainmenu001"');
    expect(mainMenuSceneSource).toContain('path="res://script/main_menu.gd"');
    for (const text of ["NEW GAME", "CONTINUE", "LOAD GAME", "PARAMETERS", "CONTROLS", "QUIT"]) {
      expect(mainMenuSceneSource).toContain(`text = "${text}"`);
    }
    expect(mainMenuScriptSource).toContain("CodeQuestBridge.notify_new_game()");
    expect(mainMenuScriptSource).toContain('CodeQuestStateSync.request_load("auto")');
    expect(mainMenuScriptSource).toContain("CodeQuestStateSync.refresh_save_list()");
    expect(mainMenuScriptSource).not.toContain("func _process(");
    expect(mainMenuScriptSource).not.toContain("func _animate_in(");
    expect(mainMenuSceneSource).toContain("anchor_right = 1.0");
    expect(mainMenuSceneSource).toContain("anchor_bottom = 1.0");
    expect(mainMenuSceneSource).toContain('text = "PLAYER: NO SAVE YET"');
    expect(saveStoreSource).toContain('const SAVE_PATH := "user://codequest_saves.json"');
    expect(saveStoreSource).toContain("static func normalize_character(");
    expect(saveStoreSource).toContain("static func write_record(");
  });

  it("opens Godot save slots from E and an Escape pause menu with load and quit", () => {
    expect(gameSceneSource).toContain('node name="PauseMenu"');
    expect(gameSceneSource).toContain('node name="SaveMenu"');
    expect(gameSceneSource).toContain('groups=["save_menu"]');
    expect(bedSaveSource).toContain('get_tree().get_first_node_in_group("save_menu")');
    expect(saveMenuSceneSource).toContain('text = "AUTO SAVE"');
    expect(saveMenuSceneSource).toContain('text = "SLOT 1"');
    expect(pauseMenuSceneSource).toContain('text = "BACK TO GAME"');
    expect(pauseMenuSceneSource).toContain('text = "QUIT TO MENU"');
    expect(pauseMenuScriptSource).toContain("KEY_ESCAPE");
    expect(pauseMenuScriptSource).toContain("CodeQuestStateSync.request_load(slot)");
    expect(saveMenuScriptSource).toContain(
      'CodeQuestBridge.notify_request_state(slot, "Bedroom rest")',
    );
    expect(functionBody(bridgeSource, "notify_save_game")).toContain("notify_request_state(slot");
  });

  it("saves closet outfit changes immediately so save and continue keeps them", () => {
    expect(functionBody(closetSource, "_cycle")).toContain("save_appearance()");
    expect(functionBody(closetSource, "_randomize_outfit")).toContain("save_appearance()");
    expect(functionBody(closetSource, "save_appearance")).toContain(
      "CharacterSettings.top_index = top_index",
    );
    expect(functionBody(closetSource, "save_appearance")).toContain(
      "CodeQuestBridge.notify_character_snapshot(",
    );
    expect(functionBody(closetAreaSource, "_close_customizer")).toContain(
      'customizer.call("save_appearance")',
    );
  });

  it("stores complete Godot saves and restores character and quest state on load", () => {
    expect(bridgeSource).toContain(
      'const CHARACTER_SNAPSHOT_EVENT_TYPE := "codequest:character-snapshot"',
    );
    expect(bridgeSource).toContain('const REQUEST_STATE_EVENT_TYPE := "codequest:request-state"');
    expect(bridgeSource).toContain('const STATE_SNAPSHOT_EVENT_TYPE := "codequest:state-snapshot"');
    expect(bridgeSource).toContain('const LOAD_STATE_EVENT_TYPE := "codequest:load-state"');
    expect(bridgeSource).toContain('const STATE_COMMIT_EVENT_TYPE := "codequest:state-commit"');
    expect(functionBody(bridgeSource, "notify_save_game")).toContain("notify_request_state(slot");
    expect(functionBody(bridgeSource, "notify_request_state")).toContain(
      'if not OS.has_feature("web"):',
    );
    expect(functionBody(bridgeSource, "notify_request_state")).toContain(
      "CodeQuestStateSync.save_native_state(normalized_slot, reason)",
    );
    expect(functionBody(bridgeSource, "notify_new_game")).toContain("reset_native_state()");
    expect(stateSyncSource).toContain("func save_native_state(");
    expect(stateSyncSource).toContain("CodeQuestBridge.get_active_quest_snapshot()");
    expect(stateSyncSource).toContain("CharacterSettings.character_name");
    expect(stateSyncSource).toContain("CodeQuestSaveStore.write_record(record)");
    expect(bedSaveSource).toContain('get_tree().get_first_node_in_group("save_menu")');
    expect(gameSceneSource).toContain('node name="BedSave"');
    expect(stateSyncSource).toContain("codequest:state-snapshot");
    expect(stateSyncSource).toContain("codequest:load-state");
    expect(stateSyncSource).toContain("CodeQuestBridge.apply_chapter_state(chapter_state)");
    expect(questManagerSource).toContain("func prime_from_snapshot(");
    expect(questManagerSource).toContain("if not is_instance_valid(marker):");
  });
});
