import {Panel} from "./Panel";
import {formatDate, makeButton, makeCloseIconButton, makeIcon, makeIconButton} from "./Utils";
import {clearElement, withCommas} from "teamten-ts-utils";
import {File} from "./File";
import {Context} from "./Context";
import {PageTabs} from "./PageTabs";
import {toHexByte, toHexWord} from "z80-base";
import {CanvasScreen} from "trs80-emulator";
import isEmpty from "lodash/isEmpty";

const SCREENSHOT_ATTR = "data-screenshot";

/**
 * Handles the file info tab in the file panel.
 */
class FileInfoTab {
    private readonly filePanel: FilePanel;
    private readonly nameInput: HTMLInputElement;
    private readonly filenameInput: HTMLInputElement;
    private readonly noteInput: HTMLTextAreaElement;
    private readonly typeInput: HTMLInputElement;
    private readonly sizeInput: HTMLInputElement;
    private readonly dateAddedInput: HTMLInputElement;
    private readonly dateModifiedInput: HTMLInputElement;
    private readonly screenshotsDiv: HTMLElement;
    private readonly revertButton: HTMLButtonElement;
    private readonly saveButton: HTMLButtonElement;

    constructor(filePanel: FilePanel, pageTabs: PageTabs) {
        this.filePanel = filePanel;

        const infoTab = pageTabs.newTab("File Info");
        infoTab.element.classList.add("file-info-tab");

        // Form for editing file info.
        const form = document.createElement("form");
        form.classList.add("file-panel-form");
        infoTab.element.append(form);

        const makeInputBox = (label: string, cssClass: string | undefined, enabled: boolean): HTMLInputElement => {
            const labelElement = document.createElement("label");
            if (cssClass !== undefined) {
                labelElement.classList.add(cssClass);
            }
            labelElement.innerText = label;
            form.append(labelElement);

            const inputElement = document.createElement("input");
            inputElement.disabled = !enabled;
            labelElement.append(inputElement);

            return inputElement;
        };

        this.nameInput = makeInputBox("Name", "name", true);
        this.filenameInput = makeInputBox("Filename", "filename", true);

        const noteLabel = document.createElement("label");
        noteLabel.classList.add("note");
        noteLabel.innerText = "Note";
        form.append(noteLabel);
        this.noteInput = document.createElement("textarea");
        this.noteInput.rows = 10;
        noteLabel.append(this.noteInput);

        const miscDiv = document.createElement("div");
        miscDiv.classList.add("misc");
        this.typeInput = makeInputBox("Type", undefined, false);
        this.dateAddedInput = makeInputBox("Date added", undefined, false);
        this.sizeInput = makeInputBox("Size", undefined, false);
        this.dateModifiedInput = makeInputBox("Date last modified", undefined, false);
        form.append(miscDiv);

        this.screenshotsDiv = document.createElement("div");
        this.screenshotsDiv.classList.add("screenshots");
        form.append(this.screenshotsDiv);

        const actionBar = document.createElement("div");
        actionBar.classList.add("action-bar");
        infoTab.element.append(actionBar);

        const runButton = makeButton("Run", "play_arrow", "play-button", () => {
            this.filePanel.runProgram(this.filePanel.file);
        });
        actionBar.append(runButton);
        const deleteButton = makeButton("Delete File", "delete", "delete-button", () => {
            this.filePanel.context.db.collection("files").doc(this.filePanel.file.id).delete()
                .then(() => {
                    this.filePanel.context.library.removeFile(this.filePanel.file);
                    this.filePanel.context.panelManager.popPanel();
                })
                .catch(error => {
                    // TODO.
                });
        });
        actionBar.append(deleteButton);
        this.revertButton = makeButton("Revert", "undo", "revert-button", undefined);
        actionBar.append(this.revertButton);
        this.saveButton = makeButton("Save", ["save", "cached", "check"], "save-button", undefined);
        actionBar.append(this.saveButton);

        for (const input of [this.nameInput, this.filenameInput, this.noteInput]) {
            input.addEventListener("input", () => this.updateButtonStatus());
        }
        this.nameInput.addEventListener("input", () => {
            let name = this.fileFromUi().name;
            if (name === "") {
                // If we completely blank out the span, the H1 shrinks, so keep it constant height with a space.
                this.filePanel.headerTextNode.innerHTML = "&nbsp;";
            } else {
                this.filePanel.headerTextNode.innerText = name;
            }
        });

        this.revertButton.addEventListener("click", () => {
            this.updateUi();
        });
        this.saveButton.addEventListener("click", () => {
            const newFile = this.fileFromUi().builder().withDateModified(new Date()).build();

            this.saveButton.classList.add("saving");

            // Disable right away so it's not clicked again.
            this.saveButton.disabled = true;

            this.filePanel.context.db.collection("files").doc(this.filePanel.file.id)
                .update(newFile.getUpdateDataComparedTo(this.filePanel.file))
                .then(() => {
                    this.saveButton.classList.remove("saving");
                    this.saveButton.classList.add("success");
                    setTimeout(() => {
                        this.saveButton.classList.remove("success");
                    }, 1000);
                    this.filePanel.file = newFile;
                    this.filePanel.context.library.modifyFile(newFile);
                    this.updateUi();
                })
                .catch(error => {
                    this.saveButton.classList.remove("saving");
                    // TODO show error.
                    // The document probably doesn't exist.
                    console.error("Error updating document: ", error);
                    this.updateUi();
                });
        });

        this.updateUi();
    }

    /**
     * Update UI after a change to file.
     */
    private updateUi(): void {
        const file = this.filePanel.file;

        this.nameInput.value = file.name;
        this.filenameInput.value = file.filename;
        this.noteInput.value = file.note;
        this.typeInput.value = file.getType();
        this.sizeInput.value = withCommas(file.binary.length) + " byte" + (file.binary.length === 1 ? "" : "s");
        this.dateAddedInput.value = formatDate(file.dateAdded);
        this.dateModifiedInput.value = formatDate(file.dateModified);

        this.populateScreenshots();
        this.updateButtonStatus();
    }

    /**
     * Fill the screenshots UI with those from the file.
     */
    private populateScreenshots(): void {
        clearElement(this.screenshotsDiv);

        for (const screenshot of this.filePanel.file.screenshots) {
            const screen = new CanvasScreen();
            screen.displayScreenshot(screenshot);
            const image = screen.asImage();

            const screenshotDiv = document.createElement("div");
            screenshotDiv.setAttribute(SCREENSHOT_ATTR, screenshot);
            screenshotDiv.classList.add("screenshot");
            screenshotDiv.append(image);
            const deleteButton = makeIconButton(makeIcon("delete"), "Delete screenshot", () => {
                screenshotDiv.remove();
                this.updateButtonStatus();
            });
            screenshotDiv.append(deleteButton);
            this.screenshotsDiv.append(screenshotDiv);
        }
    }

    /**
     * Update the save/restore buttons' enabled status based on input fields.
     */
    private updateButtonStatus(): void {
        const file = this.filePanel.file;
        const newFile = this.fileFromUi();

        const isSame = isEmpty(newFile.getUpdateDataComparedTo(file));
        const isValid = newFile.name.length > 0 &&
            newFile.filename.length > 0;

        const isDisabled = isSame || !isValid;

        this.revertButton.disabled = isDisabled;
        this.saveButton.disabled = isDisabled;
    }

    /**
     * Make a new File object based on the user's inputs.
     */
    private fileFromUi(): File {
        // Collect screenshots from UI.
        const screenshots: string[] = [];
        for (const screenshotDiv of this.screenshotsDiv.children) {
            let screenshot = screenshotDiv.getAttribute(SCREENSHOT_ATTR);
            if (screenshot === null) {
                console.error("Screenshot attribute " + SCREENSHOT_ATTR + " is null");
            } else {
                screenshots.push(screenshot);
            }
        }

        return this.filePanel.file.builder()
            .withName(this.nameInput.value.trim())
            .withFilename(this.filenameInput.value.trim())
            .withNote(this.noteInput.value.trim())
            .withScreenshots(screenshots)
            .build();
    }
}

/**
 * Tab for displaying the hex and ASCII of the binary.
 */
class HexdumpTab {
    private readonly binary: Uint8Array;
    private readonly hexdumpElement: HTMLElement;
    private collapse = true;

    constructor(filePanel: FilePanel, pageTabs: PageTabs) {
        this.binary = filePanel.file.binary;

        const infoTab = pageTabs.newTab("Hexdump");
        infoTab.element.classList.add("hexdump-tab");

        const outer = document.createElement("div");
        outer.classList.add("hexdump-outer");
        infoTab.element.append(outer);

        this.hexdumpElement = document.createElement("div");
        this.hexdumpElement.classList.add("hexdump");
        outer.append(this.hexdumpElement);
        this.generateHexdump();

        const actionBar = document.createElement("div");
        actionBar.classList.add("action-bar");
        infoTab.element.append(actionBar);

        const collapseLabel = document.createElement("label");
        const collapseCheckbox = document.createElement("input");
        collapseCheckbox.type = "checkbox";
        collapseCheckbox.checked = this.collapse;
        collapseLabel.append(collapseCheckbox);
        collapseLabel.append(" Collapse duplicate lines");
        collapseCheckbox.addEventListener("change", () => {
            this.collapse = collapseCheckbox.checked;
            this.generateHexdump();
        });
        actionBar.append(collapseLabel);
    }

    /**
     * Regenerate the HTML for the hexdump.
     */
    private generateHexdump(): void {
        const lines: HTMLElement[] = [];

        const STRIDE = 16;

        const newLine = (): HTMLElement => {
            const line = document.createElement("div");
            lines.push(line);
            return line;
        };

        const newSpan = (line: HTMLElement, cssClass: string, text: string): HTMLElement => {
            const e = document.createElement("span");
            e.classList.add(cssClass);
            e.innerText = text;
            line.append(e);
            return e;
        };

        const binary = this.binary;
        let lastAddr: number | undefined = undefined;
        for (let addr = 0; addr < binary.length; addr += STRIDE) {
            if (this.collapse && lastAddr !== undefined &&
                binary.length - addr >= STRIDE && HexdumpTab.segmentsEqual(binary, lastAddr, addr, STRIDE)) {

                if (addr === lastAddr + STRIDE) {
                    const line = newLine();

                    if (HexdumpTab.allSameByte(binary, addr, STRIDE)) {
                        // Lots of the same byte repeated. Say many there are.
                        const count = HexdumpTab.countConsecutive(binary, addr);
                        newSpan(line, "address", "      ... ");
                        newSpan(line, "ascii", count.toString());
                        newSpan(line, "address", " (");
                        newSpan(line, "ascii", "0x" + count.toString(16).toUpperCase());
                        newSpan(line, "address", ") consecutive bytes of ");
                        newSpan(line, "hex", "0x" + toHexByte(binary[addr]));
                        newSpan(line, "address", " ...");
                    } else {
                        // A repeating pattern, but not all the same byte. Say how many times repeated.
                        let count = 1;
                        for (let otherAddr = addr + STRIDE; otherAddr <= binary.length - STRIDE; otherAddr += STRIDE) {
                            if (HexdumpTab.segmentsEqual(binary, lastAddr, otherAddr, STRIDE)) {
                                count += 1;
                            } else {
                                break;
                            }
                        }
                        newSpan(line, "address", "      ... ");
                        newSpan(line, "ascii", count.toString());
                        const plural = count === 1 ? "" : "s";
                        newSpan(line, "address", ` repetition${plural} of previous row ...`);
                    }
                }
            } else {
                lastAddr = addr;
                const line = newLine();
                newSpan(line, "address", toHexWord(addr) + "  ");

                // Hex.
                let subAddr: number;
                let s = "";
                for (subAddr = addr; subAddr < binary.length && subAddr < addr + STRIDE; subAddr++) {
                    s += toHexByte(binary[subAddr]) + " ";
                }
                for (; subAddr < addr + STRIDE; subAddr++) {
                    s += "   ";
                }
                s += "  ";
                newSpan(line, "hex", s);

                // ASCII.
                let e: HTMLElement | undefined = undefined;
                let currentCssClass = undefined;
                for (subAddr = addr; subAddr < binary.length && subAddr < addr + STRIDE; subAddr++) {
                    const c = binary[subAddr];
                    let cssClass;
                    let char;
                    if (c >= 32 && c < 127) {
                        cssClass = "ascii";
                        char = String.fromCharCode(c);
                    } else {
                        cssClass = "ascii-unprintable";
                        char = ".";
                    }
                    if (e === undefined || cssClass !== currentCssClass) {
                        e = newSpan(line, cssClass, "");
                        currentCssClass = cssClass;
                    }
                    e.innerText += char;
                }
            }
        }

        newSpan(newLine(), "address", toHexWord(binary.length));

        clearElement(this.hexdumpElement);
        this.hexdumpElement.append(... lines);
    }

    /**
     * Compare two parts of an array for equality.
     */
    private static segmentsEqual(binary: Uint8Array, start1: number, start2: number, length: number): boolean {
        while (length-- > 0) {
            if (binary[start1++] !== binary[start2++]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Count consecutive bytes that are around "addr".
     */
    private static countConsecutive(binary: Uint8Array, addr: number) {
        const value = binary[addr];

        let startAddr = addr;
        while (startAddr > 0 && binary[startAddr - 1] === value) {
            startAddr--;
        }

        while (addr < binary.length - 1 && binary[addr + 1] === value) {
            addr++;
        }

        return addr - startAddr + 1;
    }

    /**
     * Whether this segment is made up of the same value.
     */
    private static allSameByte(binary: Uint8Array, addr: number, length: number): boolean {
        for (let i = 1; i < length; i++) {
            if (binary[addr + i] !== binary[addr]) {
                return false;
            }
        }

        return true;
    }
}

/**
 * Panel to explore a file.
 */
export class FilePanel extends Panel {
    public file: File;
    private readonly fileInfoTab: FileInfoTab;
    private readonly hexdumpTab: HexdumpTab;
    public readonly headerTextNode: HTMLElement;

    constructor(context: Context, file: File) {
        super(context);

        this.file = file;

        this.element.classList.add("file-panel");

        const header = document.createElement("h1");
        const backButton = makeIconButton(makeIcon("arrow_back"), "Back", () => this.context.panelManager.popPanel());
        backButton.classList.add("back-button");
        header.append(backButton);
        this.headerTextNode = document.createElement("span");
        this.headerTextNode.innerText = file.name;
        header.append(this.headerTextNode);
        header.append(makeCloseIconButton(() => this.context.panelManager.close()));
        this.element.append(header);

        const content = document.createElement("div");
        content.classList.add("panel-content");
        this.element.append(content);

        const pageTabs = new PageTabs(content);
        this.fileInfoTab = new FileInfoTab(this, pageTabs);
        this.hexdumpTab = new HexdumpTab(this, pageTabs);
    }
}