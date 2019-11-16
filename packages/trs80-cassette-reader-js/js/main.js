
"use strict";

requirejs.config({
    // Force reloading of JS files.
    urlArgs: "bust=" + (new Date()).getTime()
});

requirejs(["Tape", "TapeBrowser", "Uploader"], function (Tape, TapeBrowser, Uploader) {
    /**
     * @param {AudioBuffer} audioBuffer 
     */
    function handleAudioBuffer(audioBuffer) {
        var dropScreen = document.getElementById("drop_screen");
        var dataScreen = document.getElementById("data_screen");
        var originalCanvas = document.getElementById("original_canvas");
        var filteredCanvas = document.getElementById("filtered_canvas");
    
        const samples = audioBuffer.getChannelData(0);
        const tape = new Tape(samples);
        var tapeBrowser = new TapeBrowser(tape, [originalCanvas, filteredCanvas]);
        tapeBrowser.draw();
        dropScreen.style.display = "none";
        dataScreen.style.display = "block";
    }

    (function () {
        var dropZone = document.getElementById("drop_zone");
        new Uploader(dropZone, handleAudioBuffer);
    })();
});