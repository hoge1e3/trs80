
import {EditorView} from "@codemirror/view"
import {indentWithTab} from "@codemirror/commands"

import {keymap, highlightSpecialChars, drawSelection, highlightActiveLine, dropCursor} from "@codemirror/view"
import {Extension, EditorState} from "@codemirror/state"
import {history, historyKeymap} from "@codemirror/history"
import {foldGutter, foldKeymap} from "@codemirror/fold"
import {indentOnInput} from "@codemirror/language"
import {lineNumbers, highlightActiveLineGutter} from "@codemirror/gutter"
import {defaultKeymap} from "@codemirror/commands"
import {bracketMatching} from "@codemirror/matchbrackets"
import {closeBrackets, closeBracketsKeymap} from "@codemirror/closebrackets"
import {searchKeymap, highlightSelectionMatches} from "@codemirror/search"
import {autocompletion, completionKeymap} from "@codemirror/autocomplete"
import {commentKeymap} from "@codemirror/comment"
import {rectangularSelection} from "@codemirror/rectangular-selection"
import {defaultHighlightStyle} from "@codemirror/highlight"
import {lintKeymap, linter, Diagnostic, setDiagnostics} from "@codemirror/lint"

import {Asm, SourceFile} from "z80-asm";
import {CassettePlayer, Config, Trs80, Trs80State} from "trs80-emulator";
import {CanvasScreen} from "trs80-emulator-web";
import {ControlPanel, DriveIndicators, PanelType, SettingsPanel, WebKeyboard} from "trs80-emulator-web";
import {WebSoundPlayer} from "trs80-emulator-web";

const initial_code = `  .org 0x5000
  di
  ld a,191
  ld hl,15360
  ld b, 10
  
loop:
  ld (hl),a
  inc hl
  dec b
  jr nz,loop

stop:
  jp stop
`;

const space_invaders = `  .org 0x5000
  di
  ld hl,15360
  inc hl
  inc hl
  
  ld a,191
  ld b, 100
  
loop:
  push hl
  ld (hl),0x80
  inc hl
  ld (hl),0x89
  inc hl
  ld (hl),0xB7
  inc hl
  ld (hl),0x9D
  inc hl
  ld (hl),0x81
  inc hl

  pop hl
  inc hl

  push bc
  ld bc,5500
wait:
  dec bc
  ld a,b
  or a,c
  jr nz,wait
  pop bc

  dec b
  jr nz,loop

stop:
  jp stop
`;

const body = document.body;
{
  let e = document.createElement("div");
  e.id = "editor";
  body.append(e);
}
const assembleButton = document.createElement("button");
assembleButton.innerText = "Assemble";
body.append(assembleButton);
const saveButton = document.createElement("button");
saveButton.innerText = "Save";
body.append(saveButton);
const restoreButton = document.createElement("button");
restoreButton.innerText = "Restore";
body.append(restoreButton);
{
  const e = document.createElement("div");
  e.id = "emulator";
  body.append(e);
}

const extensions: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  defaultHighlightStyle.fallback,
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...commentKeymap,
    ...completionKeymap,
    ...lintKeymap,
      indentWithTab,
  ]),
  EditorView.updateListener.of(update => {
    if (update.focusChanged) {
      // TODO also take into account find UI.
      keyboard.interceptKeys = !update.view.hasFocus;
    }
    if (update.docChanged) {
      reassemble();
    }
  }),
  // linter(view => [
  //   {
  //     from: 3,
  //     to: 5,
  //     severity: "error",
  //     message: "bad",
  //   },
  // ], {
  //   delay: 750,
  // }),
];

let startState = EditorState.create({
  doc: initial_code,
  extensions: extensions,
});

let view = new EditorView({
  state: startState,
  parent: document.getElementById("editor") as HTMLDivElement
});

function reassemble() {
  const editorState = view.state;
  const doc = editorState.doc;
  const code = doc.toJSON();
  console.log(code);
  const asm = new Asm({
    readBinaryFile(pathname: string): Uint8Array | undefined {
      return undefined;
    }, readDirectory(pathname: string): string[] | undefined {
      return undefined;
    }, readTextFile(pathname: string): string[] | undefined {
      return code;
    }
  });
  const sourceFile = asm.assembleFile("current.asm");
  console.log(sourceFile);
  if (sourceFile === undefined) {
    // TODO, file not found.
    return;
  }

  const diagnostics: Diagnostic[] = [];
  for (const line of sourceFile.assembledLines) {
    if (line.error !== undefined && line.lineNumber !== undefined /* TODO */) {
      const lineInfo = doc.line(line.lineNumber + 1);
      diagnostics.push({
        from: lineInfo.from,  // TODO first non-blank.
        to: lineInfo.to,
        severity: "error",
        message: line.error,
      });
    }
  }
  const transactions = setDiagnostics(editorState, diagnostics);
  view.dispatch(transactions);

  if (diagnostics.length === 0) {
    if (trs80State === undefined) {
      trs80State = trs80.save();
    } else {
      trs80.restore(trs80State);
    }
    for (const line of sourceFile.assembledLines) {
      for (let i = 0; i < line.binary.length; i++) {
        trs80.writeMemory(line.address + i, line.binary[i]);
      }
    }
    let entryPoint = asm.entryPoint;
    if (entryPoint === undefined) {
      for (const line of sourceFile.assembledLines) {
        if (line.binary.length > 0) {
          entryPoint = line.address;
          break;
        }
      }
    }
    if (entryPoint !== undefined) {
      trs80.jumpTo(entryPoint);
    }
  }
}

assembleButton.addEventListener("click", () => reassemble());

let trs80State: Trs80State | undefined;

saveButton.addEventListener("click", () => {
  trs80State = trs80.save();
});
restoreButton.addEventListener("click", () => {
  if (trs80State !== undefined) {
    trs80.restore(trs80State);
  }
});

const emulatorDiv = document.getElementById("emulator") as HTMLDivElement;
const config = Config.makeDefault();
const screen = new CanvasScreen(1);
const keyboard = new WebKeyboard();
const cassettePlayer = new CassettePlayer();
const soundPlayer = new WebSoundPlayer();
const trs80 = new Trs80(config, screen, keyboard, cassettePlayer, soundPlayer);
keyboard.configureKeyboard();

const reboot = () => {
  trs80.reset();
  trs80.start();
};

const hardwareSettingsPanel = new SettingsPanel(screen.getNode(), trs80, PanelType.HARDWARE);
const viewPanel = new SettingsPanel(screen.getNode(), trs80, PanelType.VIEW);
const controlPanel = new ControlPanel(screen.getNode());
controlPanel.addResetButton(reboot);
// controlPanel.addTapeRewindButton(() => {
//   cassettePlayer.rewind();
// });
controlPanel.addSettingsButton(hardwareSettingsPanel);
controlPanel.addSettingsButton(viewPanel);
controlPanel.addMuteButton(soundPlayer);

const driveIndicators = new DriveIndicators(screen.getNode(), trs80.getMaxDrives());
trs80.onMotorOn.subscribe(drive => driveIndicators.setActiveDrive(drive));

emulatorDiv.append(screen.getNode());

reboot();
