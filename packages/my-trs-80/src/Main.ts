import {
    CassettePlayer, Config,
    Trs80
} from "trs80-emulator";
import {
    CanvasScreen,
    ControlPanel,
    DriveIndicators, flashNode,
    PanelType, ProgressBar,
    SettingsPanel, WebKeyboard
} from "trs80-emulator-web";
import firebase from 'firebase/app';
// These imports load individual services into the firebase namespace.
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/analytics';
import * as firebaseui from "firebaseui";
import {makeIcon, makeIconButton, makeTextButton} from "./Utils";
import {PanelManager} from "./PanelManager";
import {LibraryPanel} from "./LibraryPanel";
import {Context} from "./Context";
import {Library} from "./Library";
import {FileBuilder} from "./File";
import {DialogBox} from "./DialogBox";
import {AuthUser} from "./User";
import {Database} from "./Database";
import {File} from "./File";
import {Editor} from "trs80-emulator-web";
import {isRegisterSetField, toHexWord} from "z80-base";
import {disasmForTrs80} from "trs80-disasm";
import {Cassette, CassetteSpeed} from "trs80-base";
import {
    concatAudio,
    encodeHighSpeed,
    encodeLowSpeed,
    frameToTimestamp, totalAudioSamples,
    wrapHighSpeed,
    wrapLowSpeed
} from "trs80-cassette";
import {WebSoundPlayer} from "trs80-emulator-web";

/**
 * A cassette player based on a CAS file.
 */
export class CasFileCassettePlayer extends CassettePlayer {
    private samples: Int16Array = new Int16Array(0);
    private frame: number = 0;
    private progressBar: ProgressBar | undefined;
    private motorOn = false;
    private rewinding = false;

    /**
     * Create the audio for the cassette file.
     *
     * @param casFile cassette file to convert to audio.
     * @param skip position the tape after the first "skip" files.
     */
    public setCasFile(casFile: Cassette, skip: number): void {
        // Make audio for each file at the appropriate speed.
        const samplesList: Int16Array[] = [];
        this.frame = 0;
        for (const cassetteFile of casFile.files) {
            let samples: Int16Array;

            switch (cassetteFile.speed) {
                case CassetteSpeed.LOW_SPEED:
                    samples = encodeLowSpeed(wrapLowSpeed(cassetteFile.file.binary), this.samplesPerSecond, 500);
                    break;

                case CassetteSpeed.HIGH_SPEED:
                    samples = encodeHighSpeed(wrapHighSpeed(cassetteFile.file.binary), this.samplesPerSecond);
                    break;
            }

            // Skip to this file.
            if (skip === 0) {
                this.frame = totalAudioSamples(samplesList);
            }
            skip -= 1;

            samplesList.push(samples);

            // Silence between files.
            samplesList.push(new Int16Array(this.samplesPerSecond));
        }

        this.samples = concatAudio(samplesList);
        this.progressBar?.setMaxValue(this.samples.length);
    }

    public rewind(): void {
        if (this.progressBar === undefined) {
            this.frame = 0;
        } else {
            this.rewinding = true;
            this.updateProgressBarVisibility();
            const updateRewind = () => {
                if (this.frame > 0) {
                    this.frame = Math.max(0, Math.round(this.frame - this.samples.length/30));
                    this.progressBar?.setValue(this.frame);
                    window.requestAnimationFrame(updateRewind);
                } else {
                    this.rewinding = false;
                    this.updateProgressBarVisibility();
                }
            };
            // Wait for progress bar to become visible.
            setTimeout(updateRewind, 150);
        }
    }

    public setProgressBar(progressBar: ProgressBar): void {
        this.progressBar = progressBar;
        this.progressBar.setMaxValue(this.samples.length);
    }

    public onMotorStart(): void {
        this.motorOn = true;
        this.updateProgressBarVisibility();
    }

    public readSample(): number {
        if (this.rewinding) {
            // Can't read while rewinding.
            return 0;
        } else {
            if (this.frame % this.samplesPerSecond === 0) {
                console.log("Reading tape at " + frameToTimestamp(this.frame, this.samplesPerSecond));
            }
            if (this.progressBar !== undefined &&
                (this.frame % Math.floor(this.samplesPerSecond / 10) === 0 ||
                    this.frame == this.samples.length - 1)) {

                this.progressBar.setValue(this.frame);
            }

            return this.frame < this.samples.length ? this.samples[this.frame++] / 32768 : 0;
        }
    }

    public onMotorStop(): void {
        this.motorOn = false;
        this.updateProgressBarVisibility();
    }

    private updateProgressBarVisibility() {
        if (this.progressBar !== undefined) {
            if (this.motorOn || this.rewinding) {
                this.progressBar.show();
            } else {
                this.progressBar.hide();
            }
        }
    }
}

function createNavbar(openLibrary: () => void, signIn: () => void, signOut: () => void): HTMLElement {
    const body = document.querySelector("body") as HTMLElement;

    const navbar = document.createElement("div");
    navbar.classList.add("navbar");

    const title = document.createElement("a");
    title.classList.add("home-button");
    title.textContent = "My TRS-80";
    title.href = "/";
    navbar.append(title);

    const libraryButton = makeIconButton(makeIcon("folder_open"), "Open library (Ctrl-L)", openLibrary);
    libraryButton.classList.add("library-button");
    navbar.append(libraryButton);

    const themeButton = makeIconButton(makeIcon("brightness_medium"), "Toggle theme", () => {
        body.classList.toggle("light-mode");
        body.classList.toggle("dark-mode");
    });
    themeButton.classList.add("theme-button");
    navbar.append(themeButton);

    const signInButton = makeTextButton("Sign In", "person", "sign-in-button", signIn);
    const signOutButton = makeTextButton("Sign Out", "person", "sign-out-button", signOut);
    navbar.append(signInButton, signOutButton);

    return navbar;
}

const FLAG_STRING = "CNP3H5ZS"; // From LSB to MSB.
/**
 * Convert an 8-bit flag byte to a debug string.
 * TODO: Move this to z80-base.
 */
function makeFlagString(f: number): string {
    let flagString = "";

    for (let i = 0; i < 8; i++) {
        flagString += (f & 0x01) !== 0 ? FLAG_STRING[i] : "-";
        f >>= 1;
    }

    return flagString;
}

export function main() {
    const args = Context.parseFragment(window.location.hash);
    const runFileId = args.get("runFile")?.[0];
    const userId = args.get("user")?.[0];

    const body = document.querySelector("body") as HTMLElement;
    body.classList.add("signed-out");

    // Configuration for Firebase.
    firebase.initializeApp({
        apiKey: "AIzaSyAfGZY9BaDUmy4qNtg11JHd_kLd1JmgdBI",
        authDomain: "my-trs-80.firebaseapp.com",
        projectId: "my-trs-80",
        storageBucket: "my-trs-80.appspot.com",
        messagingSenderId: "438103442091",
        appId: "1:438103442091:web:0fe42c43917ba1add52dee"
    });
    firebase.analytics();

    // Configuration for Firebase sign-in screen.
    const uiConfig = {
        signInSuccessUrl: '/',
        signInOptions: [
            // Leave the lines as is for the providers you want to offer your users.
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
            // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
            // firebase.auth.GithubAuthProvider.PROVIDER_ID,
            // firebase.auth.EmailAuthProvider.PROVIDER_ID,
            // firebase.auth.PhoneAuthProvider.PROVIDER_ID,
            // firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
        ],
        // Pop up a browser window for the actual sign-in page:
        signInFlow: "popup",
        callbacks: {
            signInSuccessWithAuthResult: (authResult: any): boolean => {
                // Don't use stuff here, the user will get passed to onAuthStateChanged().
                // I don't see much else useful in authResult.
                // console.log(authResult);

                // Don't redirect, we've taken care of it.
                return false;
            },
        },
    };

    let firebaseAuth = firebase.auth();
    const firebaseAuthUi = new firebaseui.auth.AuthUI(firebaseAuth);

    const signInDiv = document.createElement("div");
    const signInInstructions = document.createElement("div");
    signInInstructions.classList.add("sign-in-instructions");
    signInInstructions.innerText = "Sign in to My TRS-80 to have a persistent place to store your files.";
    const signInFirebase = document.createElement("div");
    signInDiv.append(signInInstructions, signInFirebase);
    let signInDialog: DialogBox | undefined = undefined;

    const db = new Database(firebase.firestore());

    firebaseAuth.onAuthStateChanged(firebaseUser => {
        if (firebaseUser !== null) {
            //console.log(firebaseUser);

            const authUser = AuthUser.fromFirebaseUser(firebaseUser);

            db.userFromAuthUser(authUser)
                .then(user => context.user = user)
                .catch(error => {
                    // TODO.
                    console.error(error);
                });

            if (signInDialog !== undefined) {
                signInDialog.close();
                signInDialog = undefined;
            }
        } else {
            // No user signed in, render sign-in UI.
            firebaseAuthUi.reset();
            firebaseAuthUi.start(signInFirebase, uiConfig);

            context.user = undefined;
        }
    });

    const panelManager = new PanelManager();
    const library = new Library();

    const navbar = createNavbar(
        () => panelManager.open(),
        () => {
            if (signInDialog !== undefined) {
                signInDialog.close();
            }
            signInDialog = new DialogBox("Sign In", signInDiv, "sign-in-dialog-box");
        },
        () => firebase.auth().signOut());
    const screenDiv = document.createElement("div");
    screenDiv.classList.add("main-computer-screen");

    const screen = new CanvasScreen(1.5);
    const keyboard = new WebKeyboard();
    const cassettePlayer = new CasFileCassettePlayer();
    const soundPlayer = new WebSoundPlayer();
    const progressBar = new ProgressBar(screen.getNode());
    cassettePlayer.setProgressBar(progressBar);
    const trs80 = new Trs80(Config.makeDefault(), screen, keyboard, cassettePlayer, soundPlayer);
    keyboard.configureKeyboard();

    const editor = new Editor(trs80, screen);
    screenDiv.append(editor.node);

    const reboot = () => {
        trs80.reset();
        trs80.start();
    };

    const hardwareSettingsPanel = new SettingsPanel(screen.getNode(), trs80, PanelType.HARDWARE);
    const viewPanel = new SettingsPanel(screen.getNode(), trs80, PanelType.VIEW);
    const controlPanel = new ControlPanel(screen.getNode());
    controlPanel.addResetButton(reboot);
    controlPanel.addTapeRewindButton(() => {
        cassettePlayer.rewind();
    });
    controlPanel.addSettingsButton(hardwareSettingsPanel);
    controlPanel.addSettingsButton(viewPanel);
    controlPanel.addMuteButton(soundPlayer);

    const driveIndicators = new DriveIndicators(screen.getNode(), trs80.getMaxDrives());
    trs80.onMotorOn.subscribe(drive => driveIndicators.setActiveDrive(drive));

    body.append(navbar);
    body.append(screenDiv);

    let createdLibraryPanel = false;
    let wasTrs80Started = false;
    panelManager.onOpenClose.subscribe(isOpen => {
        if (isOpen && !createdLibraryPanel) {
            panelManager.pushPanel(new LibraryPanel(context));
            createdLibraryPanel = true;
        }

        if (isOpen) {
            wasTrs80Started = trs80.stop();
        } else {
            if (wasTrs80Started) {
                trs80.start();
            }
        }
    });

    reboot();

    const context = new Context(library, trs80, cassettePlayer, db, panelManager);

    const screenshotButton = controlPanel.addScreenshotButton(() => {
        if (context.runningFile !== undefined) {
            let file = context.runningFile;
            const screenshot = trs80.getScreenshot();
            flashNode(screen.getNode());
            const screenshots = [...file.screenshots, screenshot]; // Don't modify original array.
            file = file.builder()
                .withScreenshots(screenshots)
                .withModifiedAt(new Date())
                .build();
            context.db.updateFile(context.runningFile, file)
                .then(() => context.library.modifyFile(file))
                .catch(error => {
                    // TODO.
                    console.error(error);
                });
        }
    });
    // Start hidden, since the user isn't signed in until later.
    screenshotButton.classList.add("hidden");

    controlPanel.addEditorButton(() => editor.startEdit());

    let logging = false;
    const logs: string[] = [];
    const MAX_LOGS = 16*1024;
    const disasm = disasmForTrs80();
    const readMemory = (address: number): number => trs80.readMemory(address);
    let stepPc = 0;
    trs80.onPreStep.subscribe(() => {
        stepPc = trs80.z80.regs.pc;
    });
    trs80.onPostStep.subscribe(() => {
        if (logging) {
            const instruction = disasm.disassembleTrace(stepPc, readMemory);
            const values: string[] = [];
            for (const arg of instruction.args) {
                for (const reg of arg.split(/[^a-zA-Z']+/)) {
                    const regExpanded = reg.replace("'", "Prime");
                    if (isRegisterSetField(regExpanded)) {
                        const value = trs80.z80.regs.getValue(regExpanded);
                        values.push(reg + "=" + toHexWord(value));
                    }
                }
            }
            const line = toHexWord(stepPc) + "  " +
                instruction.binText().padEnd(11) + "  " +
                instruction.toText().padEnd(20) + "  " +
                makeFlagString(trs80.z80.regs.f) + "  " +
                values.join(", ");
            logs.push(line.trimEnd());
            if (logs.length > MAX_LOGS) {
                logs.splice(0, logs.length - MAX_LOGS);
            }
        }
    });

    /*
    controlPanel.addResetButton(() => {
        if (logging) {
            const dump = logs.join("\n");
            const blob = new Blob([dump], {type: "text/plain"});
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.download = "trace.lst";
            a.click();

            logging = false;
        } else {
            logs.splice(0, logs.length);
            logging = true;
        }
    });
    */

    /**
     * Update whether the user can take a screenshot of the running program.
     */
    function updateScreenshotButtonVisibility() {
        const canSaveScreenshot = context.runningFile !== undefined &&
            context.user !== undefined &&
            context.runningFile.uid === context.user.uid;
        screenshotButton.classList.toggle("hidden", !canSaveScreenshot);
    }

    context.onRunningFile.subscribe(() => {
        window.location.hash = context.getFragment();
        updateScreenshotButtonVisibility();
    });

    context.onUser.subscribe(user => {
        body.classList.toggle("signed-in", user !== undefined);
        body.classList.toggle("signed-out", user === undefined);
        updateScreenshotButtonVisibility();

        library.removeAll();
        if (user !== undefined) {
            // Fetch all files.
            context.db.getAllFiles(userId ?? user.uid)
                .then((querySnapshot) => {
                    // Sort files before adding them to the library so that they show up in the UI in order
                    // and the screenshots get loaded with the visible ones first.
                    const files: File[] = [];
                    for (const doc of querySnapshot.docs) {
                        files.push(FileBuilder.fromDoc(doc).build());
                    }
                    files.sort(File.compare);
                    for (const file of files) {
                        library.addFile(file);

                        // Update hash if necessary.
                        if (file.binary.length !== 0 && file.isOldHash()) {
                            // This updates the hash.
                            const newFile = file.builder().withBinary(file.binary).build();
                            console.log("Hash for " + file.name + " has been recomputed");
                            context.db.updateFile(file, newFile)
                                .then(() => {
                                    library.modifyFile(newFile);
                                });
                        }
                    }
                    // We should now be in sync with the cloud database.
                    library.setInSync(true);
                })
                .catch(error => {
                    // TODO
                    console.error(error);
                    if (error.name === "FirebaseError") {
                        // code can be "permission-denied".
                        console.error(error.code, error.message);
                    }
                });
        }
    });

    // See if we should run an app right away.
    context.onUserResolved.subscribe(() => {
        // We're signed in, or not, and can now read the database.
        if (runFileId !== undefined) {
            db.getFile(runFileId)
                .then(file => {
                    context.runProgram(file);
                })
                .catch(() => {
                    // TODO Should probably display error message.
                });
        }
    });
}
