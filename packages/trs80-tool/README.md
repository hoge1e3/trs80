# trs80-tool

Command-line tool for manipulating TRS-80 files.

# Installation

If you have Node installed, you can install `trs80-tool` using `npm`:

    % npm install -g trs80-tool

and update it later to new versions:

    % npm update -g trs80-tool

You can also download stand-alone binaries of the latest version:

* [trs80-tool for Linux](https://www.my-trs-80.com/trs80-tool/linux/trs80-tool)
* [trs80-tool for macOS](https://www.my-trs-80.com/trs80-tool/macos/trs80-tool)
* [trs80-tool for Windows 8.1+](https://www.my-trs-80.com/trs80-tool/windows/trs80-tool.exe)

# File formats

The `trs80-tool` program supports these file formats:

* **`.BAS`**: This is a Basic program. It's typically tokenized (token words like
  `PRINT` are stored as a single byte), but the tool supports reading Basic programs
  that are in text (non-tokenized) format. When writing a file with a `.BAS` extension,
  the file is always tokenized.
* **`.ASC`**: This is also a Basic program, but always in text (non-tokenized) format. The
  extension is mostly useful when writing a Basic file, because it tells the converter
  to use the non-tokenized format.
* **`.WAV`**: This is a cassette's audio stream. It can be at any sampling rate, either
  8 or 16 bits per sample, and either mono or stereo.
* **`.CAS`**: This is a cassette stored in a compact form where each bit on the cassette
  is stored as a bit in the file. It includes synchronization headers and bytes, as well
  as start bits (for high-speed cassettes). This is a decent archival format for
  cassettes.
* **`.CMD`**: This is a machine language program as stored on a floppy disk.
* **`.3BN`**: This is a machine language program as stored on a cassette. The name comes
  from "Model 3 BiNary". This is typically not used, and instead these files are
  stored within `.CAS` files.
* **`.JV1`**: This is a floppy disk format for the Model I. It's very simple, capturing
  the basic sector data. It does not capture enough information for copy-protected
  floppies. It's named after Jeff Vavasour.
* **`.JV3`**: This is a floppy disk format for the Model III. It's very simple, capturing
  the basic sector data and IDAM structure. It does not capture enough
  information for copy-protected floppies. It's slightly more capable than
  `.JV1` because it can encode a mix of FM and MFM signals on the same track.
* **`.DMK`**: Another floppy disk format, capturing more information from the floppy,
  such as some bits between sectors. Named after David M. Keil.
* **`.SCP`**: SuperCard Pro raw flux floppy disk format.
* **`.ASM`**: This is an assembly language file, generated by
  disassembling a `.CMD` or `.3BN` file using the `convert` command.
* **`.LST`**: This is an assembly language listing file, generated by
  disassembling a `.CMD` or `.3BN` file using the `convert` command.

# Usage

The tool takes a command as its first argument:

    % trs80-tool COMMAND args ...

Global flags are:

    --version         Show the tool's version number.
    --help            Show the usage message.
    --color=COLOR     Force color mode (off, 16, 256, 16m, or auto).

By default `trs80-tool` detects the color capabilities of the terminal
and sets the `--color` flag automatically. You can override this, either
to turn off color (if it bothers you) or to force it on (when piping into
a pager). For example:

    % trs80-tool --color=16 hexdump in.cmd | less

## `dir`

The `dir` command shows the contents of an archive file. Archives
files are files that can contain other files. These are cassette files
(in WAV or CAS format) and floppy disks (in JV1, JV3, DMK, or SCP format).

    % trs80-tool dir FILE

The output format depends on the type of archive. Cassette files show
baud rates, whereas floppy disks show creation date and type of file.

## `info`

The `info` command takes a list of filenames and displays a one-line
description of the contents of the file, such as its type (system
program, Basic program) and, if known, the embedded filename.

    % trs80-tool info in1.cmd in2.bas in3.cas in4.wav

The `--verbose` flag displays some information (like floppy geometry) for
some file types:

    % trs80-tool info --verbose in1.dmk in2.dsk

## `convert`

The `convert` command converts a list of input files to an output file or
directory. There are several different ways to use this command.

A single file can be converted to another format:

    % trs80-tool convert in.cmd out.3bn    (diskette to cassette format)
    % trs80-tool convert in.bas out.asc    (de-tokenize Basic program)

Several files can be put into an archive:

    % trs80-tool convert in1.bas in2.3bn in3.cmd out.wav

This creates a cassette audio file containing the three files. Note that the
`.CMD` file will be converted to `.3BN` format.

Archive files can be extracted if the destination is a directory:

    % mkdir out
    % trs80-tool convert in.wav out    (decode cassette and extract files)
    % trs80-tool convert in.cas out
    % trs80-tool convert in.dmk out

Archive files can be converted to other archive formats:

    % trs80-tool convert in.dmk out.wav
    % trs80-tool convert in.wav out.cas

When writing a cassette format, the baud rate of the input file will
be used, if it's known:

    % trs80-tool convert in1.cas in2.cas in3.cas out.wav

(The baud rate can be guessed from the `.CAS` file contents.) If the
baud rate can't be guessed, 500 baud (low-speed) will be used:

    % trs80-tool convert in1.bas in2.3bn out.wav

This can be overwritten using the `--baud` command-line flag:

    % trs80-tool convert --baud 1500 in1.cas in2.cas in3.cas out.wav
    % trs80-tool convert --baud 1500 in1.bas in2.3bn out.wav

If a system program doesn't have a built-in start address, one
will be guessed by the `info` command:

    % trs80-tool info in.cas
    in.cas: System program (VCEPRN, /17408) on a low speed cassette

The start address can be set with the `--start` flag:

    % trs80-tool convert --start 17408 in.cas out.cas
    Wrote out.cas: System program (VCEPRN) in low speed CAS file
    % trs80-tool info out.cas
    out.cas: System program (VCEPRN) on a low speed cassette

The address `auto` can be used to guess an appropriate start address:

    % trs80-tool convert --start auto in.cas out.cas
    Wrote out.cas: System program (VCEPRN) in low speed CAS file

An assembly language listing disassembly file can be generated from `.CMD`
and `.3BN` files:

    % trs80-tool convert in.cmd out.asm
    % trs80-tool convert in.3bn out.lst

The disassembler attempts to guess what is code and what is data. If the
input program relocates itself, some entry points will be missing and code
will instead be disassembled as data. You can explicitly list entry points:

    % trs80-tool convert --entry 0x7059,0x7064,0x71B9,0x7263 in.cas out.lst

See also the `disasm` command.

## `hexdump`

The `hexdump` command displays a hex dump of the input file, with annotations.
See the `--color` flag for how to force coloring on or off.
By default the command will collapse consecutive identical lines:

    % trs80-tool hexdump in.cmd

Use the `--no-collapse` flag to turn off this collapsing:

    % trs80-tool hexdump --no-collapse in.cmd

## `sectors`

The `sectors` command displays a table of the sectors in a floppy disk. The columns
are the sectors and the rows are the tracks. For each sector a character is displayed:

    - No sector.
    S Single-density sector.
    D Double-density sector.
    X Deleted sector.
    C CRC error (ID or data).

Use the `--contents` flag to also show the contents of the sectors.

## `asm`

The `asm` command assembles the specified assembly language source code:

    % trs80-tool asm program.asm program.cmd

It can generate `.CMD`, `.3BN`, `.CAS`, or `.WAV` files. For `.CAS` or
`.WAV` files the default baud rate is 500, but can be set with the `--baud`
flag:

    % trs80-tool asm --baud 1500 program.asm program.cas

A listing file can be generated with the `--listing` flag:

    % trs80-tool asm --listing program.lst program.asm program.cmd

## `disasm`

The `disasm` command disassembles the specified program:

    % trs80-tool disasm saucer.cmd

If the program is a `.CMD` or `.3BN` file, it is loaded into the correct place
in memory. If it's a `.ROM` or `.BIN` file, it is loaded at 0x0000, but this
can be change with the `--org` flag:

    % trs80-tool disasm --org 0x8000 file.bin

The disassembler tries to guess which bytes are code and which are data by
following the path of the program, starting with its main entry point. Additional
entry points can be specified with the `--entry` flag:

    % trs80-tool disasm --entry 0x0000,0x3799,0x377B ~/Downloads/model3.rom

Note that if any entry point is listed, then 0x0000 must be specified again if
applicable. A listing file can instead be generated with the `--listing` flag:

    % trs80-tool disasm --listing program.cmd

## `run`

Run a TRS-80 emulator in the shell:

    % trs80-tool run

This is experimental and does not currently work well with games, and may not
work at all in a Microsoft Windows shell.

Use the `--model` flag to specify the model (1, 3, or 4, defaults to 3) and
the `--level` flag to specify the Basic level (1 or 2, defaults to 2).

    % trs80-tool run --model 1 --level 1

Specify a program or floppy to load and run directly:

    % trs80-tool run tdos13a.dsk

The `--xray` flag shows nothing in the shell but starts a web server for the
X-ray debugger. This is experimental and not yet documented.

## `repl`

Starts an interactive session for exploring the Z80. Type "help" to get
a list of commands. Type an assembly language instruction (such as "ld a,5")
to assemble it, write it to memory, explain it, execute it, and show
its effects on flags and registers. This virtual machine is not in
a TRS-80 context (it has no ROM or peripherals).

## `help`

The `help` command shows more specific information about other commands:

    % trs80-tool help dir
    % trs80-tool help convert

# Limitations

* The tool cannot write floppy disk files.
* The tool can only read TRSDOS and LDOS floppy disks.

# Change log

## 2.3.0

* Add support for TRSDOS for Model I and 4, and for LDOS.
* Add `run` command.
* Add `asm` command.
* Add support for SCP SuperCard Pro raw flux floppy format.

## 2.2.0

* Add `sectors` command.
* Add `--verbose` flag to `info` command to display floppy geometry.
* Add `disasm` command.

## 2.1.0

* Add `hexdump` command.

## 2.0.10

* Add `--entry` flag to help with disassembling programs that relocate themselves.

## 2.0.8

* Can read, dir, and extract CAS files with multiple files.
* The `info` command will display a guessed start address for system programs
  with no specified start address.
* Added `--start` flag to set the start address of system files.

## 2.0.7

* Can read high-speed CAS files with non-aligned bytes.

## 2.0.6

* Add `info` command.
* Show more detailed information of output files in `convert` command.

## 2.0.5

* Can write multi-file CAS files.

## 2.0.4

* Can read and write text (non-tokenized) Basic files.
* Can convert Basic programs from disk format to cassette format.
* When extracting files from a TRSDOS floppy, retain original dates.
* Can generate disassembly listing files from CMD and 3BN files.

## 2.0.3

* Initial release.

# License

Copyright &copy; Lawrence Kesteloot, [MIT license](LICENSE).
