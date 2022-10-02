import {
    Extension,
} from "@codemirror/state"
import {solarizedDark} from 'cm6-theme-solarized-dark'
import {solarizedLight} from 'cm6-theme-solarized-light'
import {basicDark} from 'cm6-theme-basic-dark'
import {basicLight} from 'cm6-theme-basic-light'
import {gruvboxDark} from 'cm6-theme-gruvbox-dark'
import {gruvboxLight} from 'cm6-theme-gruvbox-light'
import {materialDark} from 'cm6-theme-material-dark'
import {nord} from 'cm6-theme-nord'

import {breakdwn} from "./breakdwn";
import {scarfman} from "./scarfman";
import {createMenubar, getMenuEntryById, isMenuCommand, isMenuParent, Menu, MenuCommand} from "./Menubar";
import {uploadToRetroStore} from "./RetroStore";
import {Emulator} from "./Emulator";
import {Editor} from "./Editor";

const simpleExample = `        .org 0x9000

        ld a,191
        ld hl,15360
        ld b,10
        
loop:
        ld (hl),a
        inc hl
        djnz loop

stop:
        jp stop
`;

const screenshotExample = `        .org 0x9000
        
        ld hl,screenshot
        ld de,15360
draw:
        ld a,(hl)
        or a
        jr z,enddraw
        ld (de),a
        inc de
        inc hl
        jr draw

enddraw:

stop:
        jp stop

        ; Screenshot
screenshot:
        .byte 65, 66
        ; End screenshot
        .byte 0
`;

const spaceInvaders = `        .org 0x9000
        di
        ; Set up stack.
        ld hl,0
        ld sp,hl

        ld hl,15360
        inc hl
        inc hl
        
        ld a,191
        ld b,100
        
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
        ld bc,1500
wait:
        dec bc
        ld a,b
        or a,c
        jr nz,wait
        pop bc
      
        djnz loop
      
stop:
        jp stop
`;

// Available themes.
const THEMES = [
    {
        extension: basicLight,
        name: 'Basic Light'
    },
    {
        extension: basicDark,
        name: 'Basic Dark'
    },
    {
        extension: solarizedLight,
        name: 'Solarized Light'
    },
    {
        extension: solarizedDark,
        name: 'Solarized Dark'
    },
    {
        extension: materialDark,
        name: 'Material Dark'
    },
    {
        extension: nord,
        name: 'Nord'
    },
    {
        extension: gruvboxLight,
        name: 'Gruvbox Light'
    },
    {
        extension: gruvboxDark,
        name: 'Gruvbox Dark'
    },
];
const DEFAULT_THEME_INDEX = 3;

// Available examples.
const EXAMPLES = [
    { name: "Simple", code: simpleExample },
    { name: "Screenshot", code: screenshotExample },
    { name: "Space Invaders", code: spaceInvaders },
    { name: "Breakdown", code: breakdwn },
    { name: "Scarfman", code: scarfman },
];

// Get the color theme we should use initially.
export function getDefaultTheme(): Extension {
    return THEMES[DEFAULT_THEME_INDEX].extension;
}

// Get the code we should display initially.
export function getDefaultExample(): string {
    return simpleExample;
}

// Everything related to the menus and the top-level UI.
export class UserInterface {
    public constructor(emulator: Emulator, editor: Editor) {
        // Pull-down menu.
        const menu: Menu = [
            {
                text: "File",
                menu: [
                    {
                        id: "examples-list",
                        text: "Examples",
                        menu: [],
                    },
                    {
                        text: "Upload to RetroStore",
                        action: async () => {
                            const assemblyResults = editor.getAssemblyResults();
                            await uploadToRetroStore(assemblyResults);
                        },
                    }
                ],
            },
            {
                text: "View",
                menu: [
                    {
                        id: "theme-list",
                        text: "Editor Theme",
                        menu: [],
                    },
                    {
                        text: "Presentation Mode",
                        action: (menuCommand: MenuCommand) => {
                            // Toggle current mode.
                            const presentationMode = !(menuCommand.checked ?? false);
                            editor.setPresentationMode(presentationMode);
                            document.body.classList.toggle("presentation-mode", presentationMode);
                            document.body.classList.toggle("work-mode", !presentationMode);
                            menuCommand.setChecked?.(presentationMode);
                        },
                    },
                    {
                        separator: true,
                    },
                    {
                        text: "Show Line Numbers",
                        checked: true,
                        action: (menuCommand: MenuCommand) => {
                            const show = !(menuCommand.checked ?? false);
                            editor.setShowLineNumbers(show);
                            menuCommand.setChecked?.(show);
                        },
                    },
                    {
                        text: "Show Addresses",
                        checked: true,
                        action: (menuCommand: MenuCommand) => {
                            const show = !(menuCommand.checked ?? false);
                            editor.setShowAddresses(show);
                            menuCommand.setChecked?.(show);
                        },
                    },
                    {
                        text: "Show Bytecode",
                        checked: true,
                        action: (menuCommand: MenuCommand) => {
                            const show = !(menuCommand.checked ?? false);
                            editor.setShowBytecode(show);
                            menuCommand.setChecked?.(show);
                        },
                    },
                    {
                        text: "Show Timing",
                        checked: false,
                        action: (menuCommand: MenuCommand) => {
                            const show = !(menuCommand.checked ?? false);
                            editor.setShowTiming(show);
                            menuCommand.setChecked?.(show);
                        },
                    },
                ],
            },
            {
                text: "Navigate",
                menu: [
                    {
                        text: "Declaration or Usages",
                        action: () => {
                            editor.jumpToDefinition(false);
                        },
                        hotkey: "Cmd-B",
                    },
                    {
                        text: "Next Declaration or Usages",
                        action: () => {
                            editor.jumpToDefinition(true);
                        },
                        hotkey: "Shift-Cmd-B",
                    },
                    {
                        separator: true,
                    },
                    {
                        text: "Next Error",
                        action: () => {
                            editor.nextError();
                        },
                        hotkey: "F2",
                    },
                    {
                        text: "Previous Error",
                        action: () => {
                            editor.prevError();
                        },
                        hotkey: "Shift-F2",
                    },
                ],
            },
            {
                text: "Run",
                menu: [
                    {
                        text: "Run",
                        action: () => {
                            const assemblyResults = editor.getAssemblyResults();
                            emulator.runProgram(assemblyResults);
                        },
                        hotkey: "Cmd-R",
                    },
                    {
                        id: "auto-run",
                        text: "Auto-run",
                        checked: editor.autoRun,
                        action: (menuCommand: MenuCommand) => {
                            const autoRun = !menuCommand.checked;
                            menuCommand.setChecked?.(autoRun);
                            editor.autoRun = autoRun;
                        },
                    },
                ],
            },
        ];

        const body = document.body;
        body.classList.add("light-mode", "work-mode");

        const content = document.createElement("div");
        content.classList.add("content");
        body.append(content);

        const editorPane = document.createElement("div");
        editorPane.classList.add("editor-pane");
        const examplesMenu = getMenuEntryById(menu, "examples-list");
        if (examplesMenu !== undefined && isMenuParent(examplesMenu)) {
            for (const example of EXAMPLES) {
                examplesMenu.menu.push({
                    text: example.name,
                    action: () => {
                        emulator.closeScreenEditor();
                        editor.loadExample(example.code);
                    },
                });
            }
        }
        const themeMenu = getMenuEntryById(menu, "theme-list");
        if (themeMenu !== undefined && isMenuParent(themeMenu)) {
            const menu = themeMenu.menu;

            function updateCheckmarks(index: number): void {
                for (let i = 0; i < THEMES.length; i++) {
                    const menuEntry = menu[i];
                    if (isMenuCommand(menuEntry)) {
                        menuEntry.setChecked?.(i === index);
                    }
                }
            }

            for (let i = 0; i < THEMES.length; i++) {
                const theme = THEMES[i];

                themeMenu.menu.push({
                    text: theme.name,
                    action: () => {
                        editor.setTheme(theme);
                        updateCheckmarks(i);
                    },
                    checked: i == DEFAULT_THEME_INDEX,
                });
            }
        }
        const menubar = createMenubar(menu);
        const toolbar = document.createElement("div");
        toolbar.classList.add("toolbar");
        // Toolbar is currently empty.
        const editorContainer = document.createElement("div");
        editorContainer.classList.add("editor-container");
        const editorDiv = document.createElement("div");
        editorDiv.classList.add("editor");
        editorDiv.append(editor.getNode(), editor.errorPill);
        editorContainer.append(editorDiv);
        editorPane.append(menubar, /*toolbar,*/ editorContainer);
        const emulatorDiv = document.createElement("div");
        emulatorDiv.id = "emulator";
        emulatorDiv.append(emulator.getNode());
        content.append(editorPane, emulatorDiv);
    }
}